// src/app/api/score/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Scope naar afgelopen 3 maanden — representatief en binnen Supabase limieten
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const fromDate = threeMonthsAgo.toISOString().slice(0, 10);

    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount, category")
      .eq("user_id", user.id)
      .not("category", "is", null)
      .gte("transaction_date", fromDate)
      .limit(3000);

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ score: null });
    }

    let totalInkomen = 0;
    let totalUitgaven = 0;
    let totalSparen = 0;
    let totalAbonnementen = 0;
    const categorySet = new Set<string>();

    for (const tx of transactions) {
      const amount = Number(tx.amount ?? 0);
      if (!Number.isFinite(amount)) continue;

      categorySet.add(tx.category);

      if (amount > 0) {
        totalInkomen += amount;
      } else {
        const abs = Math.abs(amount);
        if (tx.category === "sparen") totalSparen += abs;
        else if (tx.category === "abonnementen") totalAbonnementen += abs;
        else totalUitgaven += abs;
      }
    }

    // ── Score berekening ──────────────────────────────────────
    let score = 0;
    const breakdown: Record<string, number> = {};

    // 1. Spaarquote (max 30 punten)
    const spaarquote =
      totalInkomen > 0 ? (totalSparen / totalInkomen) * 100 : 0;
    const spaarScore = Math.min(Math.round((spaarquote / 20) * 30), 30);
    breakdown.sparen = spaarScore;
    score += spaarScore;

    // 2. Abonnementslast (max 20 punten)
    const aboPct =
      totalInkomen > 0 ? (totalAbonnementen / totalInkomen) * 100 : 0;
    const aboScore =
      aboPct < 5
        ? 20
        : aboPct < 10
          ? 15
          : aboPct < 15
            ? 10
            : aboPct < 20
              ? 5
              : 0;
    breakdown.abonnementen = aboScore;
    score += aboScore;

    // 3. Uitgaven vs inkomen (max 30 punten)
    const uitgavenRatio =
      totalInkomen > 0 ? (totalUitgaven / totalInkomen) * 100 : 100;
    const uitgavenScore =
      uitgavenRatio < 60
        ? 30
        : uitgavenRatio < 70
          ? 25
          : uitgavenRatio < 80
            ? 15
            : uitgavenRatio < 90
              ? 5
              : 0;
    breakdown.uitgaven = uitgavenScore;
    score += uitgavenScore;

    // 4. Diversiteit (max 20 punten) — spaart EN belegt?
    const diversiteitScore = categorySet.has("beleggen")
      ? 20
      : categorySet.has("sparen")
        ? 10
        : 0;
    breakdown.diversiteit = diversiteitScore;
    score += diversiteitScore;

    const label =
      score >= 80
        ? "Uitstekend"
        : score >= 65
          ? "Goed"
          : score >= 50
            ? "Redelijk"
            : score >= 35
              ? "Matig"
              : "Aandacht nodig";

    const color =
      score >= 80
        ? "#4ADE80"
        : score >= 65
          ? "#86EFAC"
          : score >= 50
            ? "#FCD34D"
            : score >= 35
              ? "#FB923C"
              : "#EF4444";

    return NextResponse.json({
      score,
      label,
      color,
      breakdown,
      stats: {
        spaarquote: spaarquote.toFixed(1),
        aboPct: aboPct.toFixed(1),
        uitgavenRatio: uitgavenRatio.toFixed(1),
      },
    });
  } catch (error) {
    console.error("Score error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}