import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractMerchant } from "@/lib/clean-description";

type TxRow = {
  description: string | null;
  amount: string | number | null;
  transaction_date: string | null; // YYYY-MM-DD
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

  // handig voor UI/overrides
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

function clampDayUTC(year: number, month0: number, day: number) {
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return Math.min(Math.max(day, 1), daysInMonth);
}

function median(nums: number[]) {
  if (nums.length === 0) return 0;
  const a = [...nums].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}

function stddev(nums: number[]) {
  if (nums.length < 2) return 999;
  const mean = nums.reduce((s, x) => s + x, 0) / nums.length;
  const v = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

function recurringScore(occ: Occurrence[], quarterly: boolean) {
  // Group by month totals
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

  // Scoring (0..1)
  // months: 3 maanden is basis voor monthly; quarterly mag 2 kwartalen (≈ 2-3 maanden actief) ook al ok zijn
  const monthsTarget = quarterly ? 4 : 6;
  const sMonths = Math.min(1, monthsActive / monthsTarget);

  const sDay = quarterly ? Math.min(1, 1 - (dayStd / 10)) : Math.min(1, 1 - (dayStd / 6));
  const sAmt = Math.min(1, 1 - amountCV); // cv <1 => positief

  // gewicht
  let score = 0.45 * sMonths + 0.35 * sDay + 0.20 * sAmt;

  // clamp
  score = Math.max(0, Math.min(1, score));

  return {
    score,
    byMonth,
    monthsActive,
    medianMonthly: mMed,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // NL “today midnight”
    const nlDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
    const [todayYear, todayMonth1, todayDay] = nlDate.split("-").map(Number);
    const todayMonth0 = todayMonth1 - 1;
    const todayMidnight = new Date(Date.UTC(todayYear, todayMonth0, todayDay));

    // Detect window: 12m is ok voor recurring candidates; later kan dit 24m worden
    const twelveMonthsAgo = new Date(Date.UTC(todayYear, todayMonth0 - 12, 1)).toISOString().split("T")[0];

    const { data } = await supabase
      .from("transactions")
      .select("description, amount, transaction_date, merchant_key, merchant_name")
      .eq("user_id", user.id)
      .lt("amount", 0)
      .gte("transaction_date", twelveMonthsAgo)
      .order("transaction_date", { ascending: false });

    const txs = (data ?? []) as TxRow[];
    if (txs.length === 0) {
      return NextResponse.json({ items: [], totalBalance: 0, upcomingTotal: 0, balanceWarning: false });
    }

    // Latest date = based on actual data
    const dates = txs
      .map(t => t.transaction_date)
      .filter((d): d is string => typeof d === "string" && d.length >= 10)
      .sort()
      .reverse();

    const latestDate = dates[0];
    if (!latestDate) {
      return NextResponse.json({ items: [], totalBalance: 0, upcomingTotal: 0, balanceWarning: false });
    }

    const latestYear = Number(latestDate.slice(0, 4));
    const latestMonth1 = Number(latestDate.slice(5, 7));
    const latestMonth0 = latestMonth1 - 1;

    const refMonthStart = new Date(Date.UTC(latestYear, latestMonth0 - 1, 1)).toISOString().split("T")[0];
    const refMonthEnd = new Date(Date.UTC(latestYear, latestMonth0, 0)).toISOString().split("T")[0];
    const refMonthCurrent = new Date(Date.UTC(latestYear, latestMonth0, 1)).toISOString().split("T")[0];
    const threeMonthsBeforeLatest = new Date(Date.UTC(latestYear, latestMonth0 - 3, 1)).toISOString().split("T")[0];
    const refMonthKey = `${latestYear}-${String(latestMonth1).padStart(2, "0")}`;

    // Group by merchant_key (compute on the fly if missing)
    const groups = new Map<string, { name: string; occurrences: Occurrence[]; quarterlyHint: boolean }>();
    const merchantKeys: string[] = [];

    for (const tx of txs) {
      const rawDate = tx.transaction_date ?? "";
      if (!rawDate || rawDate.length < 10) continue;

      const amountAbs = Math.abs(Number(tx.amount) || 0);
      if (!Number.isFinite(amountAbs) || amountAbs <= 0) continue;

      const { merchantName, merchantKey } = tx.merchant_key
        ? { merchantName: tx.merchant_name ?? "Onbekend", merchantKey: tx.merchant_key }
        : extractMerchant(tx.description ?? "", amountAbs);

      const key = merchantKey || "nl:unknown";
      if (!groups.has(key)) {
        groups.set(key, { name: merchantName, occurrences: [], quarterlyHint: false });
        merchantKeys.push(key);
      }

      groups.get(key)!.occurrences.push({ date: rawDate, amount: amountAbs });

      // super simpele quarterly hint voor overheid/water/municipality; later uit merchant_map category halen
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

    // Fetch global map + user overrides
    const { data: mapRows } = await supabase
      .from("merchant_map")
      .select("merchant_key, merchant_name, category, is_variable, recurring_hint, confidence")
      .in("merchant_key", merchantKeys);

    const { data: overrideRows } = await supabase
      .from("merchant_user_overrides")
      .select("merchant_key, category, is_variable, recurring_hint")
      .eq("user_id", user.id)
      .in("merchant_key", merchantKeys);

    const mapByKey = new Map<string, MerchantMapRow>();
    for (const r of (mapRows ?? []) as MerchantMapRow[]) mapByKey.set(r.merchant_key, r);

    const overrideByKey = new Map<string, OverrideRow>();
    for (const r of (overrideRows ?? []) as OverrideRow[]) overrideByKey.set(r.merchant_key, r);

    const items: CalendarItem[] = [];

    for (const [merchantKey, group] of groups) {
      const occ = group.occurrences;

      // Need at least 2 occurrences
      if (occ.length < 2) continue;

      const global = mapByKey.get(merchantKey);
      const userOv = overrideByKey.get(merchantKey);

      const isVar = userOv?.is_variable ?? global?.is_variable ?? false;
      if (isVar) continue;

      // user can force recurring
      const recurring = userOv?.recurring_hint ?? global?.recurring_hint ?? false;
      const quarterly = recurring ? false : group.quarterlyHint; // keep your old quarterly hint as fallback (we refine later)

      const name = global?.merchant_name ?? group.name;

      // Must be recent enough
      const recentCutoff = quarterly ? threeMonthsBeforeLatest : refMonthStart;
      const recentOcc = occ.filter(o => (o.date >= recentCutoff && o.date <= refMonthEnd) || o.date >= refMonthCurrent);
      if (recentOcc.length === 0) continue;

      // Compute score + monthly totals
      const { score, byMonth, medianMonthly } = recurringScore(occ, quarterly);

      // Decision threshold
      // monthly: require stronger evidence, quarterly slightly lower
      const threshold = quarterly ? 0.55 : 0.65;
      if (score < threshold && !recurring) continue;

      // Amount: ref month total if present else median monthly
      const amount = Math.round(((byMonth[refMonthKey] ?? medianMonthly) || 0) * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) continue;

      // day-of-month: median of recent occurrences
      const days = recentOcc.map(o => Number(o.date.slice(8, 10))).filter(d => Number.isFinite(d));
      const dom = median(days) || 1;

      const dayThis = clampDayUTC(todayYear, todayMonth0, dom);
      const dayNext = clampDayUTC(todayYear, todayMonth0 + 1, dom);

      const thisMonth = new Date(Date.UTC(todayYear, todayMonth0, dayThis));
      const nextMonth = new Date(Date.UTC(todayYear, todayMonth0 + 1, dayNext));
      const daysUntil = Math.round((thisMonth.getTime() - todayMidnight.getTime()) / 86400000);

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

    const { data: accounts } = await supabase
      .from("bank_accounts")
      .select("balance, account_type")
      .eq("user_id", user.id);

    const totalBalance =
      accounts
        ?.filter((a: any) => a.account_type === "CHECKING" || a.account_type == null)
        .reduce((sum: number, a: any) => sum + (Number(a.balance) || 0), 0) ?? 0;

    const upcomingTotal = items
      .filter(i => !i.isPast && i.daysUntil <= 3)
      .reduce((sum, i) => sum + i.amount, 0);

    return NextResponse.json({
      items,
      totalBalance,
      upcomingTotal,
      balanceWarning: upcomingTotal > totalBalance,
    });
  } catch (error) {
    console.error("Calendar error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}