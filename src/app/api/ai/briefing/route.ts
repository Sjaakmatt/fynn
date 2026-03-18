import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();
const PAGE_SIZE = 1000;
const COOLDOWN_HOURS = 6;

// Categorieën die NIET als uitgave tellen
const EXCLUDE_FROM_SPENDING = [
  "inkomen",
  "interne_overboeking",
  "toeslagen",
  "sparen",
];

type TxRow = {
  description: string | null;
  amount: string | number | null;
  category: string | null;
  transaction_date: string | null;
  merchant_name: string | null;
  merchant_key: string | null;
};

type BudgetRow = {
  category: string;
  budget_amount: string | number;
};

// ── Helpers ─────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function analyzeTransactions(
  txs: TxRow[],
  incomeKeys: Set<string>
) {
  const uitgaven: Record<string, number> = {};
  let totaalUit = 0;
  let totaalIn = 0;
  let spaarbedrag = 0;
  const merchants: Record<string, number> = {};
  const dagUitgaven: Record<string, number> = {};

  for (const tx of txs) {
    const amount = Number(tx.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    const cat = tx.category ?? "overig";

    // Inkomen: alleen positieve bedragen van merchants met income_hint
    if (amount > 0 && tx.merchant_key && incomeKeys.has(tx.merchant_key)) {
      totaalIn += amount;
      continue;
    }

    // Positieve bedragen die geen inkomen zijn → skip
    if (amount >= 0) continue;

    // Sparen apart tracken
    if (cat === "sparen") {
      spaarbedrag += Math.abs(amount);
      continue;
    }

    // Uitgesloten categorieën skippen
    if (EXCLUDE_FROM_SPENDING.includes(cat)) continue;

    const abs = Math.abs(amount);
    uitgaven[cat] = (uitgaven[cat] ?? 0) + abs;
    totaalUit += abs;

    const name = tx.merchant_name ?? tx.description ?? "onbekend";
    merchants[name] = (merchants[name] ?? 0) + abs;

    // Track dagelijks voor patroonherkenning
    const dag = tx.transaction_date?.slice(0, 10) ?? "onbekend";
    dagUitgaven[dag] = (dagUitgaven[dag] ?? 0) + abs;
  }

  const topCategorieen = Object.entries(uitgaven)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topMerchants = Object.entries(merchants)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Piekdagen (top 3 duurste dagen)
  const piekDagen = Object.entries(dagUitgaven)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return {
    totaalUit,
    totaalIn,
    spaarbedrag,
    spaarpct: totaalIn > 0 ? ((spaarbedrag / totaalIn) * 100).toFixed(1) : "0",
    topCategorieen,
    topMerchants,
    piekDagen,
    txCount: txs.length,
  };
}

async function fetchTransactions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  from: string,
  to: string
): Promise<TxRow[]> {
  let all: TxRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "description, amount, category, transaction_date, merchant_name, merchant_key"
      )
      .eq("user_id", userId)
      .gte("transaction_date", from)
      .lte("transaction_date", to)
      .order("transaction_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    all = all.concat(data ?? []);
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

async function getIncomeKeys(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Set<string>> {
  const { data } = await supabase
    .from("merchant_map")
    .select("merchant_key")
    .eq("income_hint", true);

  return new Set((data ?? []).map((r: any) => r.merchant_key as string));
}

// ── Route ───────────────────────────────────────────────────

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Subscription check ────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, trial_ends_at")
      .eq("id", user.id)
      .single();

    const status = profile?.subscription_status;
    const isPro =
      status === "active" ||
      (status === "trialing" &&
        profile?.trial_ends_at &&
        new Date(profile.trial_ends_at) > new Date());

    if (!isPro) {
      return NextResponse.json(
        { error: "Upgrade naar Pro voor wekelijkse briefings" },
        { status: 403 }
      );
    }

    // ── Rate limiting (1x per COOLDOWN_HOURS) ─────────────
    const { data: lastBriefing } = await supabase
      .from("briefings")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastBriefing?.created_at) {
      const hoursSince =
        (Date.now() - new Date(lastBriefing.created_at).getTime()) / 3600000;
      if (hoursSince < COOLDOWN_HOURS) {
        const minutesLeft = Math.ceil((COOLDOWN_HOURS - hoursSince) * 60);
        return NextResponse.json(
          {
            error: `Je volgende briefing is beschikbaar over ${minutesLeft} minuten`,
            retryAfterMinutes: minutesLeft,
          },
          { status: 429 }
        );
      }
    }

    // ── Fetch all data in parallel ────────────────────────
    const todayStr = today();
    const weekAgo = daysAgo(7);
    const monthStart = startOfMonth();
    const prevWeekStart = daysAgo(14);
    const prevWeekEnd = daysAgo(7);

    const [
      incomeKeys,
      txWeek,
      txPrevWeek,
      txMonth,
      recurringData,
      goalData,
      budgetData,
    ] = await Promise.all([
      getIncomeKeys(supabase),
      fetchTransactions(supabase, user.id, weekAgo, todayStr),
      fetchTransactions(supabase, user.id, prevWeekStart, prevWeekEnd),
      fetchTransactions(supabase, user.id, monthStart, todayStr),
      supabase
        .from("merchant_map")
        .select("merchant_name, category")
        .eq("recurring_hint", true)
        .not("category", "is", null)
        .limit(20),
      supabase
        .from("savings_goals")
        .select("name, target_amount, current_amount")
        .eq("user_id", user.id)
        .limit(3),
      supabase
        .from("budgets")
        .select("category, budget_amount")
        .eq("user_id", user.id),
    ]);

    // Analyze each period
    const week = analyzeTransactions(txWeek, incomeKeys);
    const prevWeek = analyzeTransactions(txPrevWeek, incomeKeys);
    const month = analyzeTransactions(txMonth, incomeKeys);

    if (txWeek.length === 0 && txMonth.length === 0) {
      return NextResponse.json(
        { error: "Geen transacties gevonden" },
        { status: 400 }
      );
    }

    // ── Recurring kosten ──────────────────────────────────
    const recurringList = (recurringData.data ?? [])
      .filter((r: any) => !EXCLUDE_FROM_SPENDING.includes(r.category))
      .map((r: any) => `${r.merchant_name} (${r.category})`)
      .join(", ");

    // ── Budget vs actuals (MTD) ───────────────────────────
    const budgets = (budgetData.data ?? []) as BudgetRow[];
    let budgetBlock = "";
    if (budgets.length > 0) {
      const lines = budgets
        .map((b) => {
          const budget = Number(b.budget_amount);
          const spent = month.topCategorieen.find(
            ([cat]) => cat === b.category
          );
          const actual = spent ? spent[1] : 0;
          const pct = budget > 0 ? ((actual / budget) * 100).toFixed(0) : "0";
          const status =
            actual > budget ? "OVER" : Number(pct) > 80 ? "BIJNA" : "OK";
          return `  ${b.category}: €${actual.toFixed(0)} / €${budget.toFixed(0)} (${pct}%) [${status}]`;
        })
        .join("\n");
      budgetBlock = `\nBudget voortgang (maand tot nu):\n${lines}`;
    }

    // ── Savings goals ─────────────────────────────────────
    const goals = goalData.data ?? [];
    let goalBlock = "";
    if (goals.length > 0) {
      goalBlock =
        "\nSpaardoelen:\n" +
        goals
          .map((g: any) => {
            const current = Number(g.current_amount ?? 0);
            const target = Number(g.target_amount);
            const pct = target > 0 ? ((current / target) * 100).toFixed(0) : "0";
            return `  "${g.name}" — €${current.toFixed(0)} / €${target.toFixed(0)} (${pct}%)`;
          })
          .join("\n");
    }

    // ── Build data blocks for prompt ──────────────────────
    const weekCatLines = week.topCategorieen
      .map(([cat, total]) => `  ${cat}: €${total.toFixed(2)}`)
      .join("\n");

    const weekMerchantLines = week.topMerchants
      .map(([name, total]) => `  ${name}: €${total.toFixed(2)}`)
      .join("\n");

    const weekDagLines = week.piekDagen
      .map(
        ([dag, total]) =>
          `  ${new Date(dag).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "short" })}: €${total.toFixed(0)}`
      )
      .join("\n");

    // Week-over-week vergelijking
    let weekVergelijking = "";
    if (prevWeek.txCount > 0) {
      const diff = week.totaalUit - prevWeek.totaalUit;
      const diffPct =
        prevWeek.totaalUit > 0
          ? ((diff / prevWeek.totaalUit) * 100).toFixed(0)
          : "n/a";
      weekVergelijking = `\nVergelijking met vorige week:
  Vorige week: €${prevWeek.totaalUit.toFixed(0)} uitgegeven
  Deze week: €${week.totaalUit.toFixed(0)} uitgegeven (${diff > 0 ? "+" : ""}${diff.toFixed(0)}, ${diff > 0 ? "+" : ""}${diffPct}%)`;
    }

    // Maandtotaal context
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();
    const monthPct = ((dayOfMonth / daysInMonth) * 100).toFixed(0);

    const monthContext = `\nMaandoverzicht (dag ${dayOfMonth}/${daysInMonth} — ${monthPct}% van de maand):
  Uitgegeven deze maand: €${month.totaalUit.toFixed(0)}
  Inkomen deze maand: €${month.totaalIn.toFixed(0)}
  Gespaard deze maand: €${month.spaarbedrag.toFixed(0)}`;

    // ── Prompt ────────────────────────────────────────────
    const prompt = `Jij bent Fynn, een persoonlijke financiële coach. Je toon is die van een slimme, eerlijke vriend — geen bank, geen jargon, geen oordeel. Direct, warm, motiverend.

Schrijf een WEKELIJKSE financiële briefing van maximaal 280 woorden. Focus op de afgelopen 7 dagen, met de maandcontext erbij.

═══ DATA AFGELOPEN 7 DAGEN (${weekAgo} t/m ${todayStr}) ═══

Uitgaven (excl. sparen): €${week.totaalUit.toFixed(2)}
Inkomen ontvangen: €${week.totaalIn.toFixed(2)}
Gespaard: €${week.spaarbedrag.toFixed(2)}
Aantal transacties: ${week.txCount}

Top categorieën (deze week):
${weekCatLines || "  (geen uitgaven)"}

Grootste uitgaven (merchants):
${weekMerchantLines || "  (geen)"}

Duurste dagen:
${weekDagLines || "  (geen data)"}
${weekVergelijking}

═══ MAANDCONTEXT ═══
${monthContext}
${budgetBlock}
${recurringList ? `\nVaste lasten: ${recurringList}` : ""}
${goalBlock}

═══ REGELS ═══
- Dit is een WEKELIJKSE briefing — focus op wat er de afgelopen 7 dagen is gebeurd
- Gebruik de maandcontext om patronen te benoemen ("je zit halverwege de maand en hebt al X% van je budget gebruikt")
- Als er geen inkomen deze week is: dat is normaal als salaris op een andere dag valt. Benoem dit NIET als probleem.
- Als er budget-data is: benoem categorieën die over budget gaan of bijna over budget zijn
- Als er spaardoelen zijn: benoem kort de voortgang
- Begin NIET met een # of markdown kopje
- Geen markdown opmaak, geen bullet points, geen **bold**
- Scheid alinea's met een witregel
- Schrijf correct Nederlands (bijv. "deze maand" niet "dit maand")
- Geen kopjes of titels, alleen lopende tekst
- Begin NIET met "Hallo" of begroeting — begin direct met een observatie over deze week
- Noem piekdagen bij naam als ze opvallen (bijv. "vrijdag was je duurste dag")
- Noem minimaal 1 concreet positief punt
- Noem minimaal 1 concreet verbeterpunt met een specifieke actie
- Eindig met één motiverende zin
- Maximaal 280 woorden`;

    // ── Claude API call ───────────────────────────────────
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const briefing =
      message.content[0].type === "text" ? message.content[0].text : "";

    // ── Opslaan ───────────────────────────────────────────
    await supabase.from("briefings").upsert(
      {
        user_id: user.id,
        content: briefing,
        totaal_uitgaven: week.totaalUit,
        totaal_inkomen: week.totaalIn,
        gespaard: week.spaarbedrag,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ success: true, briefing });
  } catch (error) {
    console.error("Briefing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}