import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { projectCashflow } from "@/lib/decision-engine";

const client = new Anthropic();
const RATE_LIMIT_PER_HOUR = 20;

const EXCLUDE_FROM_SPENDING = ['inkomen', 'interne_overboeking', 'toeslagen', 'sparen'];

export async function POST(request: NextRequest) {
  try {
    const { bedrag, omschrijving } = await request.json();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Input validatie ───────────────────────────────────────
    const amount = Number(bedrag);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Voer een geldig bedrag in" },
        { status: 400 }
      );
    }

    // ── Subscription check ────────────────────────────────────
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
        { error: "Upgrade naar Pro voor de uitgavecheck" },
        { status: 403 }
      );
    }

    // ── Rate limiting ─────────────────────────────────────────
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "check")
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: "Maximum aantal checks per uur bereikt. Probeer straks opnieuw." },
        { status: 429 }
      );
    }

    // ── Cashflow projectie (bron van waarheid) ────────────────
    let projection: Awaited<ReturnType<typeof projectCashflow>> | null = null;
    try {
      projection = await projectCashflow(user.id, supabase);
    } catch {
      // fallback hieronder
    }

    // ── Fallback: simpele berekening als projectie faalt ──────
    let vrijRuimte: number;
    let context: string;

    if (projection) {
      vrijRuimte = projection.projectedFreeSpace;
      context = `Vrije ruimte deze maand: €${vrijRuimte.toFixed(0)}
Vaste lasten: €${projection.fixedExpensesThisMonth.toFixed(0)}/maand
Nog te betalen deze maand: €${projection.stillToPay.toFixed(0)}
Salaris verwacht: dag ${projection.salaryDate} (over ${projection.daysUntilSalary} dagen)
Risico: ${projection.riskLevel === "safe" ? "veilig" : projection.riskLevel === "caution" ? "let op" : "kritiek"}`;
    } else {
      // Fallback: gebruik income_hint voor correct inkomen
      const { data: incomeMap } = await supabase
        .from("merchant_map")
        .select("merchant_key")
        .eq("income_hint", true);

      const incomeKeys = new Set((incomeMap ?? []).map((r: any) => r.merchant_key as string));

      const { data: txs } = await supabase
        .from("transactions")
        .select("amount, category, merchant_key")
        .eq("user_id", user.id)
        .gte(
          "transaction_date",
          new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
        )
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
      context = `Geschat beschikbaar (30d inkomen - uitgaven): €${vrijRuimte.toFixed(0)}
Let op: dit is een schatting zonder exacte vaste lasten.`;
    }

    // ── Prompt ────────────────────────────────────────────────
    const kanHet = amount <= vrijRuimte;
    const pctVanRuimte =
      vrijRuimte > 0 ? ((amount / vrijRuimte) * 100).toFixed(0) : "∞";

    const prompt = `Jij bent Fynn, een persoonlijke financiële coach. Eerlijk, direct, warm.

FINANCIËLE SITUATIE:
${context}

VRAAG: Kan ik €${amount.toFixed(2)} uitgeven aan ${omschrijving || "dit"}?

ANALYSE:
- Bedrag is ${pctVanRuimte}% van de vrije ruimte
- Technisch ${kanHet ? "mogelijk" : "niet verantwoord"} op basis van de cijfers

Geef een eerlijk antwoord in maximaal 80 woorden. Begin met een duidelijk JA of NEE (of "Ja, maar..." / "Nee, tenzij..."). Gebruik de echte cijfers.

REGELS:
- Schrijf correct Nederlands
- Geen bullet points, geen vetgedrukte tekst — lopende zinnen
- Gebruik "deze maand" niet "dit maand"
- Verwijs NOOIT naar "mijn data" of "het systeem" — praat alsof je het gewoon weet
- Maximaal 80 woorden`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const advies =
      message.content[0].type === "text" ? message.content[0].text : "";

    // ── Log voor rate limiting ────────────────────────────────
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