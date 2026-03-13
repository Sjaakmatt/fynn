// src/app/api/ai/briefing/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();
const PAGE_SIZE = 1000;
const COOLDOWN_HOURS = 6;

type TxRow = {
  description: string | null;
  amount: string | number | null;
  category: string | null;
  transaction_date: string | null;
  merchant_name: string | null;
};

// ── Helpers ─────────────────────────────────────────────────────

function dateRange(monthsBack: number): { from: string; to: string } {
  const now = new Date();
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1)
  );
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack + 1, 0)
  );
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function analyzeTransactions(txs: TxRow[]) {
  const uitgaven: Record<string, number> = {};
  let totaalUit = 0;
  let totaalIn = 0;
  let spaarbedrag = 0;
  const merchants: Record<string, number> = {};

  for (const tx of txs) {
    const amount = Number(tx.amount ?? 0);
    if (!Number.isFinite(amount)) continue;

    if (amount < 0) {
      const cat = tx.category ?? "overig";
      const abs = Math.abs(amount);
      uitgaven[cat] = (uitgaven[cat] ?? 0) + abs;

      if (cat === "sparen") {
        spaarbedrag += abs;
      } else {
        totaalUit += abs;
        // Track top merchants (excl. sparen)
        const name = tx.merchant_name ?? tx.description ?? "onbekend";
        merchants[name] = (merchants[name] ?? 0) + abs;
      }
    } else {
      totaalIn += amount;
    }
  }

  const topCategorieen = Object.entries(uitgaven)
    .filter(([cat]) => cat !== "sparen")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topMerchants = Object.entries(merchants)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    totaalUit,
    totaalIn,
    spaarbedrag,
    spaarpct: totaalIn > 0 ? ((spaarbedrag / totaalIn) * 100).toFixed(1) : "0",
    topCategorieen,
    topMerchants,
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
      .select("description, amount, category, transaction_date, merchant_name")
      .eq("user_id", userId)
      .not("category", "is", null)
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

// ── Route ───────────────────────────────────────────────────────

export async function POST(_request: NextRequest) {
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

    // ── Rate limiting (1x per COOLDOWN_HOURS) ─────────────────
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

    // ── Fetch deze maand + vorige maand ───────────────────────
    const dezeMaand = dateRange(0);
    const vorigeMaand = dateRange(1);

    const [txDezeMaand, txVorigeMaand] = await Promise.all([
      fetchTransactions(supabase, user.id, dezeMaand.from, dezeMaand.to),
      fetchTransactions(supabase, user.id, vorigeMaand.from, vorigeMaand.to),
    ]);

    if (txDezeMaand.length === 0) {
      return NextResponse.json(
        { error: "Geen transacties gevonden voor deze periode" },
        { status: 400 }
      );
    }

    const huidig = analyzeTransactions(txDezeMaand);
    const vorig = analyzeTransactions(txVorigeMaand);

    // ── Recurring kosten ophalen ──────────────────────────────
    const { data: recurring } = await supabase
      .from("merchant_map")
      .select("merchant_name, category")
      .eq("recurring_hint", true)
      .not("category", "is", null)
      .limit(20);

    const recurringList = (recurring ?? [])
      .map((r) => `${r.merchant_name} (${r.category})`)
      .join(", ");

    // ── Savings goal ──────────────────────────────────────────
    const { data: goal } = await supabase
      .from("savings_goals")
      .select("name, target_amount, current_amount")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    // ── Build prompt ──────────────────────────────────────────
    const catLines = huidig.topCategorieen
      .map(([cat, total]) => `  ${cat}: €${total.toFixed(2)}`)
      .join("\n");

    const merchantLines = huidig.topMerchants
      .map(([name, total]) => `  ${name}: €${total.toFixed(2)}`)
      .join("\n");

    const vergelijking =
      vorig.txCount > 0
        ? `
Vergelijking met vorige maand:
  Uitgaven: €${vorig.totaalUit.toFixed(2)} → €${huidig.totaalUit.toFixed(2)} (${huidig.totaalUit > vorig.totaalUit ? "+" : ""}${(huidig.totaalUit - vorig.totaalUit).toFixed(2)})
  Inkomen: €${vorig.totaalIn.toFixed(2)} → €${huidig.totaalIn.toFixed(2)}
  Spaarquote: ${vorig.spaarpct}% → ${huidig.spaarpct}%`
        : "";

    const goalContext = goal
      ? `\nSpaardoel: "${goal.name}" — €${Number(goal.current_amount ?? 0).toFixed(0)} / €${Number(goal.target_amount).toFixed(0)} (${((Number(goal.current_amount ?? 0) / Number(goal.target_amount)) * 100).toFixed(0)}%)`
      : "";

    const prompt = `Jij bent Fynn, een persoonlijke financiële coach. Je toon is die van een slimme, eerlijke vriend — geen bank, geen jargon, geen oordeel. Direct, warm, motiverend.

Schrijf een financiële briefing van maximaal 280 woorden op basis van deze data:

Periode: lopende maand (${dezeMaand.from} t/m vandaag)
Totaal uitgegeven (excl. sparen): €${huidig.totaalUit.toFixed(2)}
Totaal inkomen: €${huidig.totaalIn.toFixed(2)}
Gespaard: €${huidig.spaarbedrag.toFixed(2)} (${huidig.spaarpct}% van inkomen)
Aantal transacties: ${huidig.txCount}

Top categorieën:
${catLines}

Grootste uitgaven (merchants):
${merchantLines}
${vergelijking}
${recurringList ? `\nVaste lasten: ${recurringList}` : ""}${goalContext}

Regels:
- Begin NIET met een # of markdown kopje
- Geen markdown opmaak, geen bullet points
- Scheid alinea's met een witregel
- Schrijf correct Nederlands
- Geen kopjes of titels, alleen lopende tekst
- Begin NIET met "Hallo" of een begroeting — begin direct met een observatie
- Als er vergelijkingsdata is: benoem de trend (beter/slechter dan vorige maand)
- Noem minimaal 1 concreet positief punt
- Noem minimaal 1 concreet verbeterpunt met een specifieke actie
- Als er een spaardoel is: benoem de voortgang
- Eindig met één motiverende zin
- Maximaal 280 woorden`;

    // ── Claude API call ───────────────────────────────────────
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const briefing =
      message.content[0].type === "text" ? message.content[0].text : "";

    // ── Opslaan ───────────────────────────────────────────────
    await supabase.from("briefings").upsert(
      {
        user_id: user.id,
        content: briefing,
        totaal_uitgaven: huidig.totaalUit,
        totaal_inkomen: huidig.totaalIn,
        gespaard: huidig.spaarbedrag,
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