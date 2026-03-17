// src/app/api/calendar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractMerchant } from "@/lib/clean-description";

type TxRow = {
  description: string | null;
  amount: string | number | null;
  transaction_date: string | null;
  merchant_key?: string | null;
  merchant_name?: string | null;
};

type CalendarItem = {
  name: string;
  amount: number;
  nextDate: string;
  thisMonthDate: string;
  dayOfMonth: number;
  daysUntil: number;
  isPast: boolean;
  warning: boolean;
  merchantKey: string;
  score: number;
};

type Occurrence = { date: string; amount: number };

type MerchantMapRow = {
  merchant_key: string;
  merchant_name: string;
  category: string | null;
  is_variable: boolean | null;
  recurring_hint: boolean | null;
  confidence: number;
};

type OverrideRow = {
  merchant_key: string;
  category: string | null;
  is_variable: boolean | null;
  recurring_hint: boolean | null;
};

const PAGE_SIZE = 1000;
const IN_BATCH = 500;

function clampDayUTC(year: number, month0: number, day: number) {
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return Math.min(Math.max(day, 1), daysInMonth);
}

function median(nums: number[]) {
  if (nums.length === 0) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function stddev(nums: number[]) {
  if (nums.length < 2) return 999;
  const mean = nums.reduce((s, x) => s + x, 0) / nums.length;
  const v = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

function recurringScore(occ: Occurrence[], quarterly: boolean) {
  const byMonth: Record<string, number> = {};
  const days: number[] = [];

  for (const o of occ) {
    const mk = o.date.slice(0, 7);
    byMonth[mk] = (byMonth[mk] ?? 0) + o.amount;
    days.push(Number(o.date.slice(8, 10)));
  }

  const monthsActive = Object.keys(byMonth).length;
  const monthTotals = Object.values(byMonth);
  const mMed = median(monthTotals);
  const mStd = stddev(monthTotals);
  const amountCV = mMed > 0 ? mStd / mMed : 999;
  const dayStd = stddev(days);

  const monthsTarget = quarterly ? 4 : 6;
  const sMonths = Math.min(1, monthsActive / monthsTarget);
  const sDay = quarterly
    ? Math.min(1, 1 - dayStd / 10)
    : Math.min(1, 1 - dayStd / 6);
  const sAmt = Math.min(1, 1 - amountCV);

  const score = Math.max(0, Math.min(1, 0.45 * sMonths + 0.35 * sDay + 0.2 * sAmt));

  return { score, byMonth, monthsActive, medianMonthly: mMed };
}

/** Batched .in() query helper */
async function batchedIn<T>(
  supabase: any,
  table: string,
  column: string,
  keys: string[],
  select: string,
  extraFilters?: (q: any) => any
): Promise<T[]> {
  const all: T[] = [];
  for (let i = 0; i < keys.length; i += IN_BATCH) {
    const batch = keys.slice(i, i + IN_BATCH);
    let q = supabase.from(table).select(select).in(column, batch);
    if (extraFilters) q = extraFilters(q);
    const { data } = await q;
    all.push(...((data ?? []) as T[]));
  }
  return all;
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Subscription check ────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, trial_ends_at")
      .eq("id", user.id)
      .single();

    const subStatus = profile?.subscription_status;
    const isPro =
      subStatus === "active" ||
      (subStatus === "trialing" &&
        profile?.trial_ends_at &&
        new Date(profile.trial_ends_at) > new Date());

    if (!isPro) {
      return NextResponse.json(
        { error: "Upgrade naar Pro voor de vaste lasten kalender" },
        { status: 403 }
      );
    }

    // NL "today midnight"
    const nlDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Amsterdam",
    }).format(new Date());
    const [todayYear, todayMonth1, todayDay] = nlDate.split("-").map(Number);
    const todayMonth0 = todayMonth1 - 1;
    const todayMidnight = new Date(Date.UTC(todayYear, todayMonth0, todayDay));

    const twelveMonthsAgo = new Date(
      Date.UTC(todayYear, todayMonth0 - 12, 1)
    )
      .toISOString()
      .split("T")[0];

    // ── Fetch transacties — gepagineerd ───────────────────────
    let allTxs: TxRow[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "description, amount, transaction_date, merchant_key, merchant_name"
        )
        .eq("user_id", user.id)
        .lt("amount", 0)
        .gte("transaction_date", twelveMonthsAgo)
        .order("transaction_date", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      allTxs = allTxs.concat(data ?? []);
      if (!data || data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (allTxs.length === 0) {
      return NextResponse.json({
        items: [],
        totalBalance: 0,
        upcomingTotal: 0,
        balanceWarning: false,
      });
    }

    // Latest date from data
    const dates = allTxs
      .map((t) => t.transaction_date)
      .filter((d): d is string => typeof d === "string" && d.length >= 10)
      .sort()
      .reverse();

    const latestDate = dates[0];
    if (!latestDate) {
      return NextResponse.json({
        items: [],
        totalBalance: 0,
        upcomingTotal: 0,
        balanceWarning: false,
      });
    }

    const latestYear = Number(latestDate.slice(0, 4));
    const latestMonth1 = Number(latestDate.slice(5, 7));
    const latestMonth0 = latestMonth1 - 1;

    const refMonthStart = new Date(Date.UTC(latestYear, latestMonth0 - 1, 1))
      .toISOString()
      .split("T")[0];
    const refMonthEnd = new Date(Date.UTC(latestYear, latestMonth0, 0))
      .toISOString()
      .split("T")[0];
    const refMonthCurrent = new Date(Date.UTC(latestYear, latestMonth0, 1))
      .toISOString()
      .split("T")[0];
    const threeMonthsBeforeLatest = new Date(
      Date.UTC(latestYear, latestMonth0 - 3, 1)
    )
      .toISOString()
      .split("T")[0];
    const refMonthKey = `${latestYear}-${String(latestMonth1).padStart(2, "0")}`;

    // ── Group by merchant_key ─────────────────────────────────
    const groups = new Map<
      string,
      { name: string; occurrences: Occurrence[]; quarterlyHint: boolean }
    >();
    const merchantKeys: string[] = [];

    for (const tx of allTxs) {
      const rawDate = tx.transaction_date ?? "";
      if (!rawDate || rawDate.length < 10) continue;

      const amountAbs = Math.abs(Number(tx.amount) || 0);
      if (!Number.isFinite(amountAbs) || amountAbs <= 0) continue;

      const { merchantName, merchantKey } = tx.merchant_key
        ? {
            merchantName: tx.merchant_name ?? "Onbekend",
            merchantKey: tx.merchant_key,
          }
        : extractMerchant(tx.description ?? "", amountAbs);

      const key = merchantKey || "nl:unknown";
      if (!groups.has(key)) {
        groups.set(key, {
          name: merchantName,
          occurrences: [],
          quarterlyHint: false,
        });
        merchantKeys.push(key);
      }

      groups.get(key)!.occurrences.push({ date: rawDate, amount: amountAbs });

      const lower = merchantName.toLowerCase();
      if (
        lower.includes("gemeente") ||
        lower.includes("hoogheemraadschap") ||
        lower.includes("waterschap") ||
        lower.includes("belastingdienst") ||
        lower.includes("pwn") ||
        lower.includes("vitens") ||
        lower.includes("dunea") ||
        lower.includes("waternet") ||
        lower.includes("evides")
      ) {
        groups.get(key)!.quarterlyHint = true;
      }
    }

    // ── Fetch merchant_map + overrides — batched ──────────────
    const mapRows = await batchedIn<MerchantMapRow>(
      supabase,
      "merchant_map",
      "merchant_key",
      merchantKeys,
      "merchant_key, merchant_name, category, is_variable, recurring_hint, confidence"
    );

    const overrideRows = await batchedIn<OverrideRow>(
      supabase,
      "merchant_user_overrides",
      "merchant_key",
      merchantKeys,
      "merchant_key, category, is_variable, recurring_hint",
      (q: any) => q.eq("user_id", user.id)
    );

    const mapByKey = new Map<string, MerchantMapRow>();
    for (const r of mapRows) mapByKey.set(r.merchant_key, r);

    const overrideByKey = new Map<string, OverrideRow>();
    for (const r of overrideRows) overrideByKey.set(r.merchant_key, r);

    // ── Build calendar items ──────────────────────────────────
    const items: CalendarItem[] = [];

    for (const [merchantKey, group] of groups) {
      const occ = group.occurrences;
      if (occ.length < 2) continue;

      const global = mapByKey.get(merchantKey);
      const userOv = overrideByKey.get(merchantKey);

      const isVar = userOv?.is_variable ?? global?.is_variable ?? false;
      if (isVar) continue;

      const category = userOv?.category ?? global?.category ?? null;
      if (
        category === "sparen" ||
        category === "inkomen" ||
        category === "intern"
      )
        continue;
        

      // Als user expliciet recurring_hint = false heeft gezet → altijd skippen
      if (userOv?.recurring_hint === false) continue;

      const recurring =
        userOv?.recurring_hint ?? global?.recurring_hint ?? false;
      const quarterly = recurring ? false : group.quarterlyHint;
      const name = global?.merchant_name ?? group.name;

      // Blacklist generieke merchant keys (ruis)
      const BLACKLIST_KEYS = new Set([
        'nl:mollie:payment', 'nl:payment', 'nl:unknown', 'nl:onbekend',
      ])
      if (BLACKLIST_KEYS.has(merchantKey)) continue

      // Skip variabele winkel-categorieën (geen vaste lasten)
      const VARIABLE_CATEGORIES = new Set([
        'boodschappen', 'eten & drinken', 'kleding', 'entertainment',
      ])
      if (VARIABLE_CATEGORIES.has(category ?? '') && !recurring) continue

      // Must be recent enough
      const recentCutoff = quarterly
        ? threeMonthsBeforeLatest
        : refMonthStart;
      const recentOcc = occ.filter(
        (o) =>
          (o.date >= recentCutoff && o.date <= refMonthEnd) ||
          o.date >= refMonthCurrent
      );
      if (recentOcc.length === 0) continue;

      // Use merchant_map confidence if available, otherwise compute
      let score: number;
      let byMonth: Record<string, number>;
      let medianMonthly: number;

      if (recurring && global?.confidence) {
        // Vertrouw op de score van sync/recurring
        score = global.confidence;
        const computed = recurringScore(occ, quarterly);
        byMonth = computed.byMonth;
        medianMonthly = computed.medianMonthly;
      } else {
        const computed = recurringScore(occ, quarterly);
        score = computed.score;
        byMonth = computed.byMonth;
        medianMonthly = computed.medianMonthly;
      }

      const threshold = quarterly ? 0.55 : 0.75;
      if (score < threshold && !recurring) continue;

      const amount =
        Math.round(((byMonth[refMonthKey] ?? medianMonthly) || 0) * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const days = recentOcc
        .map((o) => Number(o.date.slice(8, 10)))
        .filter((d) => Number.isFinite(d));
      const dom = median(days) || 1;

      const dayThis = clampDayUTC(todayYear, todayMonth0, dom);
      const dayNext = clampDayUTC(todayYear, todayMonth0 + 1, dom);

      const thisMonth = new Date(Date.UTC(todayYear, todayMonth0, dayThis));
      const nextMonth = new Date(
        Date.UTC(todayYear, todayMonth0 + 1, dayNext)
      );
      const daysUntil = Math.round(
        (thisMonth.getTime() - todayMidnight.getTime()) / 86400000
      );

      items.push({
        name,
        amount,
        nextDate: nextMonth.toISOString().split("T")[0],
        thisMonthDate: thisMonth.toISOString().split("T")[0],
        dayOfMonth: dayThis,
        daysUntil,
        isPast: daysUntil < 0,
        warning: daysUntil >= 0 && daysUntil <= 3,
        merchantKey,
        score: Math.round(score * 100) / 100,
      });
    }

    items.sort((a, b) => a.dayOfMonth - b.dayOfMonth);

    // ── Saldo check ─────────────────────────────────────────
    const { data: accounts } = await supabase
      .from("bank_accounts")
      .select("balance, account_type")
      .eq("user_id", user.id);

    const totalBalance =
      accounts
        ?.filter(
          (a: any) =>
            a.account_type === "CHECKING" || a.account_type === "CACC" || a.account_type === null
        )
        .reduce(
          (sum: number, a: any) => sum + (Number(a.balance) || 0),
          0
        ) ?? 0;

    const upcomingTotal = items
      .filter((i) => !i.isPast && i.daysUntil <= 3)
      .reduce((sum, i) => sum + i.amount, 0);

    return NextResponse.json({
      items,
      totalBalance,
      upcomingTotal,
      balanceWarning: upcomingTotal > totalBalance,
    });
  } catch (error) {
    console.error("Calendar error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}