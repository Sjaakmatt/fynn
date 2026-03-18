import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { projectCashflow } from "@/lib/decision-engine";

const client = new Anthropic();
const RATE_LIMIT_PER_HOUR = 20;

const EXCLUDE_FROM_SPENDING = [
  "inkomen",
  "interne_overboeking",
  "toeslagen",
  "sparen",
];

export async function POST(request: NextRequest) {
  try {
    const { bedrag, omschrijving } = await request.json();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Input validatie ───────────────────────────────────
    const amount = Number(bedrag);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Voer een geldig bedrag in" },
        { status: 400 }
      );
    }

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
        { error: "Upgrade naar Pro voor de uitgavecheck" },
        { status: 403 }
      );
    }

    // ── Rate limiting ─────────────────────────────────────
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "check")
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        {
          error:
            "Maximum aantal checks per uur bereikt. Probeer straks opnieuw.",
        },
        { status: 429 }
      );
    }

    // ── Fetch data in parallel ────────────────────────────
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);

    const [projectionResult, budgetResult, goalResult, txMtdResult] =
      await Promise.allSettled([
        projectCashflow(user.id, supabase),

        supabase
          .from("budgets")
          .select("category, budget_amount")
          .eq("user_id", user.id),

        supabase
          .from("savings_goals")
          .select("name, target_amount, current_amount")
          .eq("user_id", user.id)
          .limit(3),

        supabase
          .from("transactions")
          .select("amount, category, merchant_key")
          .eq("user_id", user.id)
          .gte("transaction_date", monthStart)
          .limit(500),
      ]);

    const projection =
      projectionResult.status === "fulfilled"
        ? projectionResult.value
        : null;

    const budgets =
      budgetResult.status === "fulfilled"
        ? (budgetResult.value.data ?? [])
        : [];

    const goals =
      goalResult.status === "fulfilled"
        ? (goalResult.value.data ?? [])
        : [];

    const txMtd =
      txMtdResult.status === "fulfilled"
        ? (txMtdResult.value.data ?? [])
        : [];

    // ── Cashflow context ──────────────────────────────────
    let vrijRuimte: number;
    let cashflowContext: string;

    if (projection) {
      vrijRuimte = projection.projectedFreeSpace;
      cashflowContext = `Vrije ruimte deze maand: €${vrijRuimte.toFixed(0)}
Vaste lasten: €${projection.fixedExpensesThisMonth.toFixed(0)}/maand
Nog te betalen: €${projection.stillToPay.toFixed(0)}
Salaris verwacht: dag ${projection.salaryDate} (over ${projection.daysUntilSalary} dagen)
Risico: ${projection.riskLevel === "safe" ? "veilig" : projection.riskLevel === "caution" ? "let op" : "kritiek"}`;
    } else {
      // Fallback
      const { data: incomeMap } = await supabase
        .from("merchant_map")
        .select("merchant_key")
        .eq("income_hint", true);

      const incomeKeys = new Set(
        (incomeMap ?? []).map((r: any) => r.merchant_key as string)
      );

      const { data: txs } = await supabase
        .from("transactions")
        .select("amount, category, merchant_key")
        .eq("user_id", user.id)
        .gte("transaction_date", thirtyDaysAgo)
        .limit(200);

      let totaalUit = 0;
      let totaalIn = 0;

      for (const tx of txs ?? []) {
        const a = Number(tx.amount ?? 0);
        if (!Number.isFinite(a)) continue;

        if (a > 0 && tx.merchant_key && incomeKeys.has(tx.merchant_key)) {
          totaalIn += a;
        } else if (a < 0) {
          const cat = tx.category ?? "overig";
          if (!EXCLUDE_FROM_SPENDING.includes(cat)) {
            totaalUit += Math.abs(a);
          }
        }
      }

      vrijRuimte = totaalIn - totaalUit;
      cashflowContext = `Geschat beschikbaar (30d inkomen - uitgaven): €${vrijRuimte.toFixed(0)}
Let op: schatting zonder exacte vaste lasten.`;
    }

    // ── Budget context (MTD spending per category) ────────
    let budgetContext = "";
    if (budgets.length > 0) {
      // Calculate MTD spending per category
      const mtdSpending: Record<string, number> = {};
      for (const tx of txMtd) {
        const a = Number(tx.amount ?? 0);
        if (!Number.isFinite(a) || a >= 0) continue;
        const cat = tx.category ?? "overig";
        if (EXCLUDE_FROM_SPENDING.includes(cat)) continue;
        mtdSpending[cat] = (mtdSpending[cat] ?? 0) + Math.abs(a);
      }

      const lines = budgets
        .map((b: any) => {
          const budget = Number(b.budget_amount);
          const spent = mtdSpending[b.category] ?? 0;
          const remaining = budget - spent;
          return `  ${b.category}: €${spent.toFixed(0)} besteed / €${budget.toFixed(0)} budget (€${remaining.toFixed(0)} over)`;
        })
        .join("\n");

      budgetContext = `\nBudget (maand tot nu):\n${lines}`;
    }

    // ── Savings goal context ──────────────────────────────
    let goalContext = "";
    if (goals.length > 0) {
      goalContext =
        "\nSpaardoelen: " +
        goals
          .map(
            (g: any) =>
              `"${g.name}" €${Number(g.current_amount ?? 0).toFixed(0)}/${Number(g.target_amount).toFixed(0)}`
          )
          .join(", ");
    }

    // ── Prompt ────────────────────────────────────────────
    const kanHet = amount <= vrijRuimte;
    const pctVanRuimte =
      vrijRuimte > 0 ? ((amount / vrijRuimte) * 100).toFixed(0) : "∞";

    const prompt = `Jij bent Fynn, een persoonlijke financiële coach. Eerlijk, direct, warm.

FINANCIËLE SITUATIE:
${cashflowContext}
${budgetContext}
${goalContext}

VRAAG: Kan ik €${amount.toFixed(2)} uitgeven aan ${omschrijving || "dit"}?

ANALYSE:
- Bedrag is ${pctVanRuimte}% van de vrije ruimte
- Technisch ${kanHet ? "mogelijk" : "niet verantwoord"} op basis van de cijfers

Geef een eerlijk antwoord in maximaal 80 woorden. Begin met JA of NEE (of "Ja, maar..." / "Nee, tenzij..."). Gebruik echte cijfers.

REGELS:
- Als een budget relevant is voor deze uitgave, benoem dat (bijv. "je hebt nog €X over voor uit eten")
- Als er een spaardoel is en deze uitgave het onder druk zet, benoem dat kort
- Schrijf correct Nederlands, geen bullet points, geen **bold** — lopende zinnen
- Verwijs NOOIT naar "mijn data" of "het systeem"
- Maximaal 80 woorden`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const advies =
      message.content[0].type === "text" ? message.content[0].text : "";

    // ── Log voor rate limiting ────────────────────────────
    try {
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        role: "check",
        content: `€${amount.toFixed(2)} - ${(omschrijving || "onbekend").slice(0, 200)}`,
        created_at: new Date().toISOString(),
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      advies,
      vrijRuimte: Math.round(vrijRuimte),
      kanHet,
      pctVanRuimte: Number(pctVanRuimte),
    });
  } catch (error) {
    console.error("Check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}