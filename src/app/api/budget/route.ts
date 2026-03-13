// src/app/api/ai/budget/route.ts
// Budget API — deterministisch voor cijfers, AI alleen voor tips
// Recurring merchants als floor zodat hypotheek/energie niet te laag uitvalt

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();

const CATEGORY_ICONS: Record<string, string> = {
  wonen: "🏠",
  boodschappen: "🛒",
  "eten & drinken": "🍽️",
  transport: "🚆",
  abonnementen: "📱",
  kleding: "👕",
  gezondheid: "💊",
  entertainment: "🎬",
  sparen: "💰",
  beleggen: "📈",
  overig: "📦",
};

const MAX_MONTHS_DATA = 6;
const MIN_SAVINGS_RATE = 0.1;
const PAGE_SIZE = 1000;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type BudgetCategory = {
  category: string;
  budget: number;
  icon: string;
  tip: string;
};

// ─── HELPERS ──────────────────────────────────────────────

function monthsAgoUTC(n: number): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1))
    .toISOString()
    .slice(0, 10);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Paginated fetch helper */
async function paginatedFetch(
  queryFn: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
): Promise<any[]> {
  let all: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await queryFn(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    all = all.concat(data ?? []);
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

/** Bereken maandelijks inkomen via merchant_map income_hint */
async function getMonthlyIncome(
  userId: string,
  supabase: SupabaseClient
): Promise<{ amount: number; salaryDay: number }> {
  const { data: incomeMap } = await supabase
    .from("merchant_map")
    .select("merchant_key")
    .eq("income_hint", true);

  if (!incomeMap || incomeMap.length === 0) return { amount: 0, salaryDay: 25 };

  const keys = incomeMap.map((i) => i.merchant_key as string);
  const cutoff = monthsAgoUTC(MAX_MONTHS_DATA);

  const incomeTx = await paginatedFetch((from, to) =>
    supabase
      .from("transactions")
      .select("merchant_key, amount, transaction_date")
      .eq("user_id", userId)
      .gt("amount", 0)
      .gte("transaction_date", cutoff)
      .in("merchant_key", keys)
      .range(from, to)
  );

  if (incomeTx.length === 0) return { amount: 0, salaryDay: 25 };

  const groups = new Map<string, { amounts: number[]; days: number[] }>();
  for (const tx of incomeTx) {
    const key = (tx as any).merchant_key as string;
    if (!groups.has(key)) groups.set(key, { amounts: [], days: [] });
    const g = groups.get(key)!;
    g.amounts.push(Number((tx as any).amount));
    g.days.push(new Date((tx as any).transaction_date).getUTCDate());
  }

  let totalMonthly = 0;
  let earliestDay = 31;

  for (const g of groups.values()) {
    totalMonthly += median(g.amounts);
    const day = median(g.days);
    if (day < earliestDay) earliestDay = Math.round(day);
  }

  return { amount: totalMonthly, salaryDay: earliestDay || 25 };
}

/**
 * Bereken recurring floor per categorie.
 * = som van mediaan bedragen van alle recurring merchants in die categorie.
 */
async function getRecurringFloorByCategory(
  userId: string,
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const { data: merchantMap } = await supabase
    .from("merchant_map")
    .select("merchant_key, merchant_name, category")
    .eq("recurring_hint", true)
    .or("is_variable.is.null,is_variable.eq.false");

  if (!merchantMap || merchantMap.length === 0) return {};

  const { data: overrides } = await supabase
    .from("merchant_user_overrides")
    .select("merchant_key, category, is_variable")
    .eq("user_id", userId);

  const overrideMap = new Map<
    string,
    { category?: string; is_variable?: boolean }
  >();
  for (const o of overrides ?? []) overrideMap.set(o.merchant_key, o);

  // Map voor O(1) lookup
  const merchantMapByKey = new Map<string, { category: string }>();
  for (const m of merchantMap) {
    merchantMapByKey.set(m.merchant_key, { category: m.category });
  }

  const recurringKeys = merchantMap
    .filter((m) => !overrideMap.get(m.merchant_key)?.is_variable)
    .map((m) => m.merchant_key as string);

  if (recurringKeys.length === 0) return {};

  const cutoff = monthsAgoUTC(MAX_MONTHS_DATA);

  // Pagineer transacties in batches van keys (Supabase .in() limiet)
  const txs: Array<{ merchant_key: string; amount: number; category: string }> = [];
  for (let i = 0; i < recurringKeys.length; i += PAGE_SIZE) {
    const keyBatch = recurringKeys.slice(i, i + PAGE_SIZE);
    const { data } = await supabase
      .from("transactions")
      .select("merchant_key, amount, category")
      .eq("user_id", userId)
      .lt("amount", 0)
      .gte("transaction_date", cutoff)
      .in("merchant_key", keyBatch);

    for (const tx of data ?? []) {
      txs.push({
        merchant_key: tx.merchant_key,
        amount: Number(tx.amount),
        category: tx.category,
      });
    }
  }

  if (txs.length === 0) return {};

  const merchantAmounts = new Map<string, number[]>();
  for (const tx of txs) {
    if (!tx.merchant_key) continue;
    if (!merchantAmounts.has(tx.merchant_key))
      merchantAmounts.set(tx.merchant_key, []);
    merchantAmounts.get(tx.merchant_key)!.push(Math.abs(tx.amount));
  }

  const result: Record<string, number> = {};
  for (const [key, amounts] of merchantAmounts) {
    const medianAmount = median(amounts);
    const override = overrideMap.get(key);
    const mapEntry = merchantMapByKey.get(key);
    const category = override?.category ?? mapEntry?.category ?? "overig";
    if (category === "inkomen") continue;
    result[category] = (result[category] ?? 0) + medianAmount;
  }

  return result;
}

/** Bereken mediaan uitgaven per categorie per maand over de laatste N maanden */
async function getMedianSpendingByCategory(
  userId: string,
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const cutoff = monthsAgoUTC(MAX_MONTHS_DATA);

  const txs = await paginatedFetch((from, to) =>
    supabase
      .from("transactions")
      .select("amount, category, transaction_date")
      .eq("user_id", userId)
      .lt("amount", 0)
      .gte("transaction_date", cutoff)
      .not("category", "is", null)
      .not("category", "eq", "inkomen")
      .range(from, to)
  );

  if (txs.length === 0) return {};

  const monthlyByCategory = new Map<string, Map<string, number>>();
  for (const tx of txs) {
    const t = tx as any;
    const cat = (t.category ?? "overig") as string;
    const monthKey = (t.transaction_date as string).slice(0, 7);
    if (!monthlyByCategory.has(cat)) monthlyByCategory.set(cat, new Map());
    const catMap = monthlyByCategory.get(cat)!;
    catMap.set(monthKey, (catMap.get(monthKey) ?? 0) + Math.abs(Number(t.amount)));
  }

  const result: Record<string, number> = {};
  for (const [cat, monthMap] of monthlyByCategory) {
    const monthlyTotals = [...monthMap.values()];
    if (monthlyTotals.length === 0) continue;
    result[cat] = median(monthlyTotals);
  }

  return result;
}

/** Haal uitgaven huidige maand op */
async function getCurrentMonthSpending(
  userId: string,
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const now = new Date();
  const startOfMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const txs = await paginatedFetch((from, to) =>
    supabase
      .from("transactions")
      .select("amount, category")
      .eq("user_id", userId)
      .lt("amount", 0)
      .gte("transaction_date", startOfMonth)
      .not("category", "is", null)
      .range(from, to)
  );

  const result: Record<string, number> = {};
  for (const tx of txs) {
    const t = tx as any;
    const cat = (t.category ?? "overig") as string;
    const amount = Number(t.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    result[cat] = (result[cat] ?? 0) + Math.abs(amount);
  }
  return result;
}

// ─── GET — Budget + voortgang ophalen ──────────────────────

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [budgetResult, income, spending] = await Promise.all([
      supabase.from("budgets").select("*").eq("user_id", user.id).single(),
      getMonthlyIncome(user.id, supabase),
      getCurrentMonthSpending(user.id, supabase),
    ]);

    return NextResponse.json({
      budget: budgetResult.data,
      uitgavenDezeMaand: spending,
      totalInkomen: income.amount,
      salaryDay: income.salaryDay,
    });
  } catch (error) {
    console.error("Budget GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── POST — Budget genereren (deterministisch + AI tips) ───

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Subscription check (POST genereert AI tips) ─────────
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
        { error: "Upgrade naar Pro voor budget coaching" },
        { status: 403 }
      );
    }

    const [income, medianSpending, recurringFloor] = await Promise.all([
      getMonthlyIncome(user.id, supabase),
      getMedianSpendingByCategory(user.id, supabase),
      getRecurringFloorByCategory(user.id, supabase),
    ]);

    if (income.amount === 0) {
      return NextResponse.json(
        {
          error:
            "Geen inkomen gedetecteerd. Controleer of je salarisbetaling correct is gecategoriseerd.",
        },
        { status: 400 }
      );
    }

    // ── Bouw budget per categorie: max(mediaan, recurring floor) ──
    const allCategories = new Set([
      ...Object.keys(medianSpending),
      ...Object.keys(recurringFloor),
    ]);

    const categories: BudgetCategory[] = [];

    for (const cat of allCategories) {
      if (cat === "inkomen" || cat === "sparen") continue;
      const med = medianSpending[cat] ?? 0;
      const floor = recurringFloor[cat] ?? 0;
      const budgetAmount = Math.round(Math.max(med, floor));
      if (budgetAmount < 5) continue;
      categories.push({
        category: cat,
        budget: budgetAmount,
        icon: CATEGORY_ICONS[cat] ?? "📦",
        tip: "",
      });
    }

    categories.sort((a, b) => b.budget - a.budget);

    // ── Schaal variabele kosten als totaal > inkomen ─────────
    const totalBeforeSavings = categories.reduce((s, c) => s + c.budget, 0);
    const minSavings = Math.round(income.amount * MIN_SAVINGS_RATE);
    const maxBudgetExSavings = income.amount - minSavings;

    if (totalBeforeSavings > maxBudgetExSavings) {
      const fixedCategories = new Set(Object.keys(recurringFloor));
      const variableTotal = categories
        .filter((c) => !fixedCategories.has(c.category))
        .reduce((s, c) => s + c.budget, 0);
      const fixedTotal = categories
        .filter((c) => fixedCategories.has(c.category))
        .reduce((s, c) => s + c.budget, 0);

      const variableBudgetAvailable = maxBudgetExSavings - fixedTotal;

      if (variableTotal > 0 && variableBudgetAvailable > 0) {
        const scaleFactor = Math.min(1, variableBudgetAvailable / variableTotal);
        for (const cat of categories) {
          if (!fixedCategories.has(cat.category)) {
            cat.budget = Math.round(cat.budget * scaleFactor);
          }
        }
      } else if (variableBudgetAvailable <= 0) {
        const fixed = categories.filter((c) =>
          fixedCategories.has(c.category)
        );
        categories.length = 0;
        categories.push(...fixed);
      }
    }

    // ── Sparen toevoegen ────────────────────────────────────
    const totalAllocated = categories.reduce((s, c) => s + c.budget, 0);
    const savingsAmount = Math.max(minSavings, income.amount - totalAllocated);

    categories.push({
      category: "sparen",
      budget: Math.round(savingsAmount),
      icon: "💰",
      tip: "",
    });

    // ── AI tips (mag falen) ─────────────────────────────────
    try {
      const budgetSummary = categories
        .map((c) => `${c.category}: €${c.budget}`)
        .join(", ");

      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `Je bent Fynn, een financiële coach. Geef voor elk budget-categorie één korte, praktische tip (max 10 woorden per tip).

Inkomen: €${income.amount.toFixed(0)}/maand
Budget: ${budgetSummary}

Geef je antwoord als JSON object met categorie als key en tip als value. Alleen de JSON, niets anders.
Voorbeeld: {"wonen": "Check je energiecontract jaarlijks", "boodschappen": "Weekmenu bespaart gemiddeld 20%"}`,
          },
        ],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";
      const cleaned = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const tips: Record<string, string> = JSON.parse(cleaned);
      for (const cat of categories) {
        if (tips[cat.category]) cat.tip = tips[cat.category];
      }
    } catch {
      // Tips zijn nice-to-have
    }

    // ── Opslaan ─────────────────────────────────────────────
    await supabase.from("budgets").upsert(
      {
        user_id: user.id,
        categories,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({
      success: true,
      categories,
      totalInkomen: income.amount,
    });
  } catch (error) {
    console.error("Budget POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── PATCH — Budget handmatig aanpassen ─────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { categories } = await request.json();

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: "categories moet een array zijn" },
        { status: 400 }
      );
    }

    // Valideer structuur
    const valid = categories.every(
      (c: any) =>
        typeof c.category === "string" &&
        c.category.length > 0 &&
        typeof c.budget === "number" &&
        Number.isFinite(c.budget) &&
        c.budget >= 0
    );

    if (!valid) {
      return NextResponse.json(
        { error: "Elke categorie moet een naam (string) en budget (getal ≥ 0) hebben" },
        { status: 400 }
      );
    }

    // Sanitize: alleen toegestane velden opslaan
    const sanitized: BudgetCategory[] = categories.map((c: any) => ({
      category: String(c.category).slice(0, 50),
      budget: Math.round(Math.max(0, Number(c.budget))),
      icon: CATEGORY_ICONS[c.category] ?? "📦",
      tip: typeof c.tip === "string" ? c.tip.slice(0, 200) : "",
    }));

    const { error } = await supabase.from("budgets").upsert(
      {
        user_id: user.id,
        categories: sanitized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Budget PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}