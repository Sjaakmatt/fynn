import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanDescriptionWithAmount } from "@/lib/clean-description";

const VARIABLE_KEYWORDS = [
  "albert heijn",
  "dekamarkt",
  "jumbo",
  "lidl",
  "aldi",
  "dirk",
  "ah ",
  "plus ",
  "spar ",
  "coop ",
  "picnic",
  "vinkvink",
  "'t broodhuys",
  "chris kaas",
  "bas zijp",
  "etos",
  "kruidvat",
  "da ",
  "drogisterij",
  "bck*etos",
  "bck*droge",
  "tango",
  "shell",
  "bp ",
  "esso",
  "tinq",
  "tamoil",
  "brandstof",
  "ns ",
  "connexxion",
  "ret ",
  "arriva",
  "parkeer",
  "q-park",
  "selecteer",
  "mcdonalds",
  "burger king",
  "kfc",
  "dominos",
  "thuisbezorgd",
  "deliveroo",
  "tikkie",
  "geldautomaat",
  "atm ",
  "opname",
  "bedrijfsrest",
  "action ",
  "hema ",
  "speeltuin",
  "gamma ",
  "bol.com",
  "zalando",
  "verf van",
  "bmn ",
  "ccv*cafe",
  "ccv*ronalds",
  "ccv*agricentrum",
  "ccv*petit",
  "ccv*garage",
  "stadhuisfoods",
  "decathlon",
  "paypal",
  "riverty",
  "ter veld via tikkie",
];

function isVariable(name: string): boolean {
  const lower = name.toLowerCase();
  return VARIABLE_KEYWORDS.some((kw) => lower.includes(kw));
}

const QUARTERLY_KEYWORDS = [
  "gemeente",
  "hoogheemraadschap",
  "waterschap",
  "pwn",
  "vitens",
  "dunea",
  "belastingdienst",
  "waternet",
  "evides",
];

function isQuarterly(name: string): boolean {
  const lower = name.toLowerCase();
  return QUARTERLY_KEYWORDS.some((kw) => lower.includes(kw));
}

type TxRow = {
  description: string | null;
  amount: string | number | null;
  transaction_date: string | null; // YYYY-MM-DD
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
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Huidige Nederlandse datum — voor display (daysUntil etc.)
    const nlDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Amsterdam",
    }).format(new Date()); // YYYY-MM-DD

    const [todayYear, todayMonth1, todayDay] = nlDate.split("-").map(Number); // month1 = 1..12
    const todayMonth0 = todayMonth1 - 1; // 0..11
    const todayMidnight = new Date(Date.UTC(todayYear, todayMonth0, todayDay));

    // 12 maanden terug voor patroon detectie
    const twelveMonthsAgo = new Date(Date.UTC(todayYear, todayMonth0 - 12, 1))
      .toISOString()
      .split("T")[0];

    const { data: transactions } = await supabase
      .from("transactions")
      .select("description, amount, transaction_date")
      .eq("user_id", user.id)
      .lt("amount", 0)
      .gte("transaction_date", twelveMonthsAgo)
      .order("transaction_date", { ascending: false });

    const txs = (transactions ?? []) as TxRow[];

    if (txs.length === 0) {
      return NextResponse.json({
        items: [],
        totalBalance: 0,
        upcomingTotal: 0,
        balanceWarning: false,
      });
    }

    // ── Bepaal referentiemaand op basis van WERKELIJKE data ──────────────────
    const dates = txs
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
    const latestMonth1 = Number(latestDate.slice(5, 7)); // 1..12
    const latestMonth0 = latestMonth1 - 1; // 0..11

    // Referentiemaand = de maand VOOR de meest recente transactie
    const refMonthStart = new Date(Date.UTC(latestYear, latestMonth0 - 1, 1))
      .toISOString()
      .split("T")[0];

    const refMonthEnd = new Date(Date.UTC(latestYear, latestMonth0, 0))
      .toISOString()
      .split("T")[0];

    const refMonthCurrent = new Date(Date.UTC(latestYear, latestMonth0, 1))
      .toISOString()
      .split("T")[0];

    const threeMonthsBeforeLatest = new Date(Date.UTC(latestYear, latestMonth0 - 3, 1))
      .toISOString()
      .split("T")[0];

    // Correcte key: YYYY-MM met 01..12
    const refMonthKey = `${latestYear}-${String(latestMonth1).padStart(2, "0")}`;

    // ── Groepeer op schone naam ───────────────────────────────────────────────
    interface Occurrence {
      date: string; // YYYY-MM-DD
      amount: number; // absolute
    }
    interface Group {
      name: string;
      occurrences: Occurrence[];
    }

    const groups = new Map<string, Group>();

    for (const tx of txs) {
      const rawDesc = tx.description ?? "";
      const rawAmount = tx.amount ?? 0;
      const rawDate = tx.transaction_date ?? "";

      if (!rawDate || rawDate.length < 10) continue;

      const amountAbs = Math.abs(Number(rawAmount) || 0);
      if (!Number.isFinite(amountAbs) || amountAbs <= 0) continue;

      const name = cleanDescriptionWithAmount(rawDesc, amountAbs);
      const key = name.toLowerCase().trim();
      if (!groups.has(key)) groups.set(key, { name, occurrences: [] });

      groups.get(key)!.occurrences.push({
        date: rawDate,
        amount: amountAbs,
      });
    }

    const items: CalendarItem[] = [];

    for (const [, group] of groups) {
      const { name, occurrences } = group;

      // Filter 1: variabele uitgaven
      if (isVariable(name)) continue;

      // Filter 2: minimaal 2x voorgekomen
      if (occurrences.length < 2) continue;

      // Filter 3: moet in referentiemaand OF huidige maand voorgekomen zijn
      const quarterly = isQuarterly(name);
      const recentCutoff = quarterly ? threeMonthsBeforeLatest : refMonthStart;

      const recentOccurrences = occurrences.filter(
        (o) =>
          (o.date >= recentCutoff && o.date <= refMonthEnd) || o.date >= refMonthCurrent
      );
      if (recentOccurrences.length === 0) continue;

      // Filter 4: consistent maandtotaal (±50%) — median-safe
      const byMonth: Record<string, number> = {};
      for (const o of occurrences) {
        const mk = o.date.slice(0, 7); // YYYY-MM
        byMonth[mk] = (byMonth[mk] ?? 0) + o.amount;
      }

      const monthlyAmounts = Object.values(byMonth).sort((a, b) => a - b);
      const median = monthlyAmounts[Math.floor(monthlyAmounts.length / 2)] ?? 0;

      const consistent =
        median === 0
          ? monthlyAmounts.every((a) => a === 0)
          : monthlyAmounts.every((a) => Math.abs(a - median) / median < 0.5);

      if (!consistent) continue;

      // Bedrag = maandtotaal van referentiemaand (meest actueel) OF median fallback
      const amount = Math.round(((byMonth[refMonthKey] ?? median) || 0) * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) continue;

      // Dag = mediaan van recente voorkomens
      const recentDays = recentOccurrences
        .map((o) => Number(o.date.split("-")[2]))
        .filter((d) => Number.isFinite(d) && d >= 1 && d <= 31)
        .sort((a, b) => a - b);

      let dayOfMonth = recentDays[Math.floor(recentDays.length / 2)] ?? 1;

      // Clamp day-of-month naar geldige dag in huidige/volgende maand (voorkomt rollover bugs)
      const daysInThisMonth = new Date(Date.UTC(todayYear, todayMonth0 + 1, 0)).getUTCDate();
      const daysInNextMonth = new Date(Date.UTC(todayYear, todayMonth0 + 2, 0)).getUTCDate();

      dayOfMonth = Math.min(dayOfMonth, daysInThisMonth);

      const thisMonth = new Date(Date.UTC(todayYear, todayMonth0, dayOfMonth));
      const nextMonth = new Date(
        Date.UTC(todayYear, todayMonth0 + 1, Math.min(dayOfMonth, daysInNextMonth))
      );

      const daysUntil = Math.round((thisMonth.getTime() - todayMidnight.getTime()) / 86400000);

      items.push({
        name,
        amount,
        nextDate: nextMonth.toISOString().split("T")[0],
        thisMonthDate: thisMonth.toISOString().split("T")[0],
        dayOfMonth,
        daysUntil,
        isPast: daysUntil < 0,
        warning: daysUntil >= 0 && daysUntil <= 3,
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}