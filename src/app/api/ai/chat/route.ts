import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { projectCashflow } from "@/lib/decision-engine";

const client = new Anthropic();
const MAX_HISTORY = 10;
const RATE_LIMIT_PER_HOUR = 30;

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

function analyzeTxs(txs: TxRow[], incomeKeys: Set<string>) {
  const uitgaven: Record<string, number> = {};
  const merchants: Record<string, number> = {};
  const dagUitgaven: Record<string, number> = {};
  let totaalUit = 0;
  let totaalIn = 0;
  let spaarbedrag = 0;

  for (const tx of txs) {
    const amount = Number(tx.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    const cat = tx.category ?? "overig";

    if (amount > 0 && tx.merchant_key && incomeKeys.has(tx.merchant_key)) {
      totaalIn += amount;
      continue;
    }
    if (amount >= 0) continue;

    if (cat === "sparen") {
      spaarbedrag += Math.abs(amount);
      continue;
    }
    if (EXCLUDE_FROM_SPENDING.includes(cat)) continue;

    const abs = Math.abs(amount);
    uitgaven[cat] = (uitgaven[cat] ?? 0) + abs;
    totaalUit += abs;

    const name = tx.merchant_name ?? tx.description ?? "onbekend";
    merchants[name] = (merchants[name] ?? 0) + abs;

    const dag = tx.transaction_date?.slice(0, 10) ?? "onbekend";
    dagUitgaven[dag] = (dagUitgaven[dag] ?? 0) + abs;
  }

  return {
    totaalUit,
    totaalIn,
    spaarbedrag,
    uitgaven: Object.entries(uitgaven)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6),
    merchants: Object.entries(merchants)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    piekDagen: Object.entries(dagUitgaven)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3),
    txCount: txs.length,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return NextResponse.json({ error: "Bericht is leeg" }, { status: 400 });
    }

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

    const pStatus = profile?.subscription_status;
    const isPro =
      pStatus === "active" ||
      (pStatus === "trialing" &&
        profile?.trial_ends_at &&
        new Date(profile.trial_ends_at) > new Date());

    if (!isPro) {
      return NextResponse.json(
        { error: "Upgrade naar Pro om met Fynn te chatten" },
        { status: 403 }
      );
    }

    // ── Rate limiting ─────────────────────────────────────
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        {
          error:
            "Je hebt het maximum aantal berichten per uur bereikt. Probeer straks opnieuw.",
        },
        { status: 429 }
      );
    }

    // ── Fetch all data in parallel ────────────────────────
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dertigDagen = new Date(now);
    dertigDagen.setDate(dertigDagen.getDate() - 30);

    const [
      incomeMapResult,
      txMonthResult,
      txWeekResult,
      recurringResult,
      goalResult,
      projectionResult,
      budgetResult,
    ] = await Promise.allSettled([
      supabase
        .from("merchant_map")
        .select("merchant_key")
        .eq("income_hint", true),

      supabase
        .from("transactions")
        .select(
          "description, amount, category, transaction_date, merchant_name, merchant_key"
        )
        .eq("user_id", user.id)
        .gte("transaction_date", dertigDagen.toISOString().slice(0, 10))
        .order("transaction_date", { ascending: false })
        .limit(200),

      supabase
        .from("transactions")
        .select(
          "description, amount, category, transaction_date, merchant_name, merchant_key"
        )
        .eq("user_id", user.id)
        .gte("transaction_date", weekAgo.toISOString().slice(0, 10))
        .order("transaction_date", { ascending: false })
        .limit(100),

      supabase
        .from("merchant_map")
        .select("merchant_key, merchant_name, category")
        .eq("recurring_hint", true)
        .not("category", "is", null)
        .limit(30),

      supabase
        .from("savings_goals")
        .select("name, target_amount, current_amount")
        .eq("user_id", user.id)
        .limit(3),

      projectCashflow(user.id, supabase),

      supabase
        .from("budgets")
        .select("category, budget_amount")
        .eq("user_id", user.id),
    ]);

    const incomeKeys = new Set(
      (
        (incomeMapResult.status === "fulfilled"
          ? incomeMapResult.value.data
          : null) ?? []
      ).map((r: any) => r.merchant_key as string)
    );

    const txMonth =
      txMonthResult.status === "fulfilled"
        ? ((txMonthResult.value.data ?? []) as TxRow[])
        : [];

    const txWeek =
      txWeekResult.status === "fulfilled"
        ? ((txWeekResult.value.data ?? []) as TxRow[])
        : [];

    const recurring =
      recurringResult.status === "fulfilled"
        ? (recurringResult.value.data ?? [])
        : [];

    const goals =
      goalResult.status === "fulfilled"
        ? (goalResult.value.data ?? [])
        : [];

    const projection =
      projectionResult.status === "fulfilled"
        ? projectionResult.value
        : null;

    const budgets =
      budgetResult.status === "fulfilled"
        ? (budgetResult.value.data ?? [])
        : [];

    // ── Analyze ───────────────────────────────────────────
    const month = analyzeTxs(txMonth, incomeKeys);
    const week = analyzeTxs(txWeek, incomeKeys);

    // Monthly spending by category (for budget comparison)
    // Filter to current calendar month for budget tracking
    const txThisMonth = txMonth.filter(
      (tx) =>
        tx.transaction_date &&
        tx.transaction_date >= monthStart.toISOString().slice(0, 10)
    );
    const mtd = analyzeTxs(txThisMonth, incomeKeys);

    // ── Build context blocks ──────────────────────────────
    const overzicht30d = month.uitgaven
      .map(([cat, total]) => `${cat}: €${total.toFixed(0)}`)
      .join(", ");

    const weekOverzicht = week.uitgaven
      .map(([cat, total]) => `${cat}: €${total.toFixed(0)}`)
      .join(", ");

    const abonnementenLijst = recurring
      .filter((r: any) => !EXCLUDE_FROM_SPENDING.includes(r.category))
      .map((r: any) => `${r.merchant_name} (${r.category})`)
      .join(", ");

    // Budget block
    let budgetBlock = "";
    if (budgets.length > 0) {
      const lines = budgets
        .map((b: any) => {
          const budget = Number(b.budget_amount);
          const spent =
            mtd.uitgaven.find(([cat]) => cat === b.category)?.[1] ?? 0;
          const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
          const flag =
            spent > budget ? "OVER" : pct > 80 ? "BIJNA" : "OK";
          return `  ${b.category}: €${spent.toFixed(0)}/€${budget.toFixed(0)} (${pct}%) [${flag}]`;
        })
        .join("\n");
      budgetBlock = `\nBUDGET (maand tot nu):\n${lines}`;
    }

    // Goals block
    let goalBlock = "";
    if (goals.length > 0) {
      goalBlock = goals
        .map(
          (g: any) =>
            `Spaardoel "${g.name}": €${Number(g.current_amount ?? 0).toFixed(0)} / €${Number(g.target_amount).toFixed(0)}`
        )
        .join(" | ");
    } else {
      goalBlock = "Geen spaardoel ingesteld";
    }

    // Peak days (this week)
    const piekDagTekst =
      week.piekDagen.length > 0
        ? week.piekDagen
            .map(
              ([dag, total]) =>
                `${new Date(dag).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}: €${total.toFixed(0)}`
            )
            .join(", ")
        : "geen data";

    // Projection block
    let projectionBlock: string;
    if (projection) {
      projectionBlock = `CASHFLOW PROJECTIE (gebruik bij "kan ik X betalen?"):
  Vrije ruimte deze maand: €${projection.projectedFreeSpace.toFixed(0)}
  Vaste lasten/maand: €${projection.fixedExpensesThisMonth.toFixed(0)}
  Nog te betalen: €${projection.stillToPay.toFixed(0)}
  Salaris verwacht: dag ${projection.salaryDate} (over ${projection.daysUntilSalary} dagen)
  Risico: ${projection.riskLevel === "safe" ? "veilig" : projection.riskLevel === "caution" ? "let op" : "kritiek"}`;
    } else {
      projectionBlock = `CASHFLOW PROJECTIE: niet beschikbaar — baseer antwoorden op de uitgaven data.`;
    }

    // Day of month context
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();

    // ── System prompt ─────────────────────────────────────
    const systemPrompt = `Jij bent Fynn, een persoonlijke financiële coach. Eerlijk, direct en warm — een slimme vriend die alles van geld weet. Geen jargon, geen oordeel.

═══ AFGELOPEN 7 DAGEN ═══
Uitgaven: €${week.totaalUit.toFixed(0)} | Inkomen: €${week.totaalIn.toFixed(0)}
Per categorie: ${weekOverzicht || "geen uitgaven"}
Duurste dagen: ${piekDagTekst}

═══ AFGELOPEN 30 DAGEN ═══
Uitgaven: €${month.totaalUit.toFixed(0)} | Inkomen: €${month.totaalIn.toFixed(0)}
Per categorie: ${overzicht30d || "geen data"}
Vaste lasten: ${abonnementenLijst || "geen data"}
${goalBlock}
${budgetBlock}

═══ MAANDCONTEXT ═══
Dag ${dayOfMonth}/${daysInMonth} van de maand

${projectionBlock}

═══ REGELS ═══
- Bij "kan ik X kopen/betalen?" → gebruik ALTIJD de vrije ruimte uit cashflow projectie, NIET het saldo
- Bij "hoe gaat het deze week?" → gebruik de 7-dagendata en vergelijk met maandgemiddelde
- Bij budget vragen → gebruik de BUDGET data als die beschikbaar is
- Concrete, eerlijke antwoorden op basis van echte cijfers
- Maximaal 150 woorden per antwoord
- Correct Nederlands ("deze maand" niet "dit maand"), geen opsommingen, gewone zinnen
- Als je iets niet weet, zeg dat eerlijk
- Verwijs NOOIT naar "de data die ik heb" of "mijn systeem" — praat alsof je het gewoon weet
- Gebruik geen markdown opmaak, geen **bold**, geen bullet points — schrijf lopende tekst`;

    // ── Cap history ───────────────────────────────────────
    const safeHistory: { role: "user" | "assistant"; content: string }[] = (
      Array.isArray(history) ? history : []
    )
      .filter(
        (m: { role?: string; content?: string }) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .slice(-MAX_HISTORY);

    const messages = [
      ...safeHistory,
      { role: "user" as const, content: message.trim() },
    ];

    // ── Claude API call ───────────────────────────────────
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: systemPrompt,
      messages,
    });

    const reply =
      response.content[0].type === "text" ? response.content[0].text : "";

    // ── Log chat message ──────────────────────────────────
    try {
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        role: "user",
        content: message.trim().slice(0, 1000),
        created_at: new Date().toISOString(),
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}