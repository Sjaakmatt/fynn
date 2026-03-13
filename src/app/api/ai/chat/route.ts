// src/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { projectCashflow } from "@/lib/decision-engine";

const client = new Anthropic();
const MAX_HISTORY = 10; // max berichten in context
const RATE_LIMIT_PER_HOUR = 30;

type TxRow = {
  description: string | null;
  amount: string | number | null;
  category: string | null;
  transaction_date: string | null;
  merchant_name: string | null;
  merchant_key: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Bericht is leeg" }, { status: 400 });
    }

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

    const status = profile?.subscription_status;
    const isPro =
      status === "active" ||
      (status === "trialing" &&
        profile?.trial_ends_at &&
        new Date(profile.trial_ends_at) > new Date());

    if (!isPro) {
      return NextResponse.json(
        { error: "Upgrade naar Pro om met Fynn te chatten" },
        { status: 403 }
      );
    }

    // ── Rate limiting (simple: count briefings in last hour) ──
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: "Je hebt het maximum aantal berichten per uur bereikt. Probeer straks opnieuw." },
        { status: 429 }
      );
    }

    // ── Haal financiële data op (parallel) ────────────────────
    const dertigDagen = new Date();
    dertigDagen.setDate(dertigDagen.getDate() - 30);
    const fromDate = dertigDagen.toISOString().slice(0, 10);

    const [txResult, recurringResult, goalResult, projectionResult] =
      await Promise.allSettled([
        // Recente transacties (100 is genoeg voor chat context)
        supabase
          .from("transactions")
          .select(
            "description, amount, category, transaction_date, merchant_name, merchant_key"
          )
          .eq("user_id", user.id)
          .not("category", "is", null)
          .gte("transaction_date", fromDate)
          .order("transaction_date", { ascending: false })
          .limit(100),

        // Recurring uit merchant_map (beter dan raw transacties)
        supabase
          .from("merchant_map")
          .select("merchant_key, merchant_name, category, confidence")
          .eq("recurring_hint", true)
          .not("category", "is", null)
          .limit(30),

        // Spaardoel
        supabase
          .from("savings_goals")
          .select("name, target_amount, current_amount")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),

        // Cashflow projectie
        projectCashflow(user.id, supabase),
      ]);

    const transactions =
      txResult.status === "fulfilled"
        ? ((txResult.value.data ?? []) as TxRow[])
        : [];

    const recurring =
      recurringResult.status === "fulfilled"
        ? (recurringResult.value.data ?? [])
        : [];

    const goal =
      goalResult.status === "fulfilled" ? goalResult.value.data : null;

    const projection =
      projectionResult.status === "fulfilled" ? projectionResult.value : null;

    // ── Bereken uitgaven overzicht ────────────────────────────
    const uitgaven: Record<string, number> = {};
    let totaalUit = 0;
    let totaalIn = 0;

    for (const tx of transactions) {
      const amount = Number(tx.amount ?? 0);
      if (!Number.isFinite(amount)) continue;

      if (amount < 0) {
        const cat = tx.category ?? "overig";
        const abs = Math.abs(amount);
        uitgaven[cat] = (uitgaven[cat] ?? 0) + abs;
        if (cat !== "sparen") totaalUit += abs;
      } else {
        totaalIn += amount;
      }
    }

    const overzicht = Object.entries(uitgaven)
      .filter(([cat]) => cat !== "sparen")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat, total]) => `${cat}: €${total.toFixed(0)}`)
      .join(", ");

    // ── Abonnementen uit merchant_map ─────────────────────────
    const abonnementenLijst = recurring
      .map((r) => `${r.merchant_name} (${r.category})`)
      .join(", ");

    // ── Spaardoel context ─────────────────────────────────────
    const goalText = goal
      ? `Spaardoel: "${goal.name}" — €${Number(goal.current_amount ?? 0).toFixed(0)} / €${Number(goal.target_amount).toFixed(0)}`
      : "Geen spaardoel ingesteld";

    // ── Projection context (met fallback) ─────────────────────
    let projectionBlock: string;
    if (projection) {
      projectionBlock = `CASHFLOW PROJECTIE (gebruik dit voor "kan ik X betalen?" vragen):
- Vrije ruimte deze maand: €${projection.projectedFreeSpace.toFixed(0)}
- Vaste lasten per maand: €${projection.fixedExpensesThisMonth.toFixed(0)}
- Nog te betalen vaste lasten: €${projection.stillToPay.toFixed(0)}
- Salaris verwacht: dag ${projection.salaryDate} (over ${projection.daysUntilSalary} dagen)
- Risico: ${projection.riskLevel === "safe" ? "veilig" : projection.riskLevel === "caution" ? "let op" : "kritiek"}`;
    } else {
      projectionBlock = `CASHFLOW PROJECTIE: niet beschikbaar — baseer antwoorden op de uitgaven data hierboven.`;
    }

    // ── System prompt ─────────────────────────────────────────
    const systemPrompt = `Jij bent Fynn, een persoonlijke financiële coach. Je bent eerlijk, direct en warm — zoals een slimme vriend die toevallig alles van geld weet. Geen jargon, geen oordeel.

FINANCIËLE DATA (afgelopen 30 dagen):
Inkomen: €${totaalIn.toFixed(0)} | Uitgaven: €${totaalUit.toFixed(0)}
Uitgaven per categorie: ${overzicht}
Vaste lasten/abonnementen: ${abonnementenLijst || "geen data"}
${goalText}

${projectionBlock}

REGELS:
- Bij "kan ik X kopen/betalen?" → gebruik ALTIJD de vrije ruimte uit de cashflow projectie, NIET het saldo
- Concrete, eerlijke antwoorden op basis van echte cijfers
- Maximaal 150 woorden per antwoord
- Correct Nederlands, geen opsommingen, gewone zinnen
- Als je iets niet weet, zeg dat eerlijk
- Verwijs NOOIT naar "de data die ik heb" of "mijn systeem" — praat alsof je het gewoon weet`;

    // ── Cap history ───────────────────────────────────────────
    const safeHistory: { role: "user" | "assistant"; content: string }[] = (
      Array.isArray(history) ? history : []
    )
      .filter(
        (m: { role?: string; content?: string }) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .slice(-MAX_HISTORY);

    const messages = [...safeHistory, { role: "user" as const, content: message.trim() }];

    // ── Claude API call ───────────────────────────────────────
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages,
    });

    const reply =
      response.content[0].type === "text" ? response.content[0].text : "";

   // ── Log chat message (voor rate limiting + analytics) ─────
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