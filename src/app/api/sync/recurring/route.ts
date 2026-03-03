import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TxRow = {
  merchant_key: string | null;
  merchant_name: string | null;
  amount: string | number | null; // signed
  transaction_date: string | null; // YYYY-MM-DD
};

type OverrideRow = {
  merchant_key: string;
  is_variable: boolean | null;
  recurring_hint: boolean | null;
};

type Candidate = {
  merchant_key: string;
  merchant_name: string;
  score: number; // 0..1
  cadence: "monthly" | "4w" | "quarterly" | "unknown";
  typical_amount: number; // abs
  typical_day: number; // 1..31
  forced?: "user_recurring" | "user_not_recurring" | "user_variable";
};

function num(x: string | number | null): number {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86400000);
}

function cadenceFromIntervals(intervals: number[]) {
  if (intervals.length === 0) return { cadence: "unknown" as const, fit: 0 };

  const m = median(intervals);
  const fitTo = (target: number, tol: number) => {
    const within =
      intervals.filter((d) => Math.abs(d - target) <= tol).length / intervals.length;
    const dist = Math.abs(m - target);
    const distScore = clamp01(1 - dist / (tol * 2));
    return clamp01(0.7 * within + 0.3 * distScore);
  };

  const monthly = fitTo(30, 5); // 25..35
  const fourW = fitTo(28, 3); // 25..31
  const quarterly = fitTo(91, 10); // 81..101

  const best = Math.max(monthly, fourW, quarterly);
  if (best === monthly) return { cadence: "monthly" as const, fit: monthly };
  if (best === fourW) return { cadence: "4w" as const, fit: fourW };
  if (best === quarterly) return { cadence: "quarterly" as const, fit: quarterly };
  return { cadence: "unknown" as const, fit: best };
}

function amountStability(amountsAbs: number[]) {
  if (amountsAbs.length < 2) return 0;
  const m = median(amountsAbs);
  if (m <= 0) return 0;
  const deviations = amountsAbs.map((a) => Math.abs(a - m) / m);
  const medDev = median(deviations);
  return clamp01(1 - medDev / 0.5);
}

function dayStability(days: number[]) {
  if (days.length < 2) return 0;
  const m = median(days);
  const dev = median(days.map((d) => Math.abs(d - m)));
  return clamp01(1 - dev / 10);
}

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1))
    .toISOString()
    .slice(0, 10);

  // 1) Load transactions (expenses only)
  const { data, error } = await supabase
    .from("transactions")
    .select("merchant_key, merchant_name, amount, transaction_date")
    .eq("user_id", user.id)
    .lt("amount", 0)
    .gte("transaction_date", from)
    .not("merchant_key", "is", null)
    .order("transaction_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const txs = (data ?? []) as TxRow[];
  if (txs.length === 0) {
    return NextResponse.json({ success: true, candidates: [], updated: 0 });
  }

  // 2) Load user overrides (these WIN)
  const { data: ovr, error: ovrErr } = await supabase
    .from("merchant_user_overrides")
    .select("merchant_key, is_variable, recurring_hint")
    .eq("user_id", user.id);

  if (ovrErr) return NextResponse.json({ error: ovrErr.message }, { status: 500 });

  const ovByKey = new Map<string, OverrideRow>();
  for (const r of (ovr ?? []) as OverrideRow[]) ovByKey.set(r.merchant_key, r);

  // 3) Group by merchant_key
  const byKey = new Map<string, TxRow[]>();
  for (const t of txs) {
    const k = t.merchant_key!;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(t);
  }

  const candidates: Candidate[] = [];

  for (const [k, rows] of byKey) {
    if (rows.length < 2) continue;

    const ov = ovByKey.get(k);

    // USER OVERRIDE: variable => never recurring
    if (ov?.is_variable === true) {
      continue;
    }

    const dates = rows
      .map((r) => r.transaction_date)
      .filter((d): d is string => !!d && d.length >= 10);

    if (dates.length < 2) continue;

    const amountsAbs = rows.map((r) => Math.abs(num(r.amount)));
    const days = dates.map((d) => Number(d.slice(8, 10))).filter((x) => x >= 1 && x <= 31);

    // USER OVERRIDE: force recurring
    if (ov?.recurring_hint === true) {
      candidates.push({
        merchant_key: k,
        merchant_name: rows[rows.length - 1].merchant_name ?? "Onbekend",
        score: 1,
        cadence: "unknown",
        typical_amount: Math.round(median(amountsAbs) * 100) / 100,
        typical_day: Math.round(median(days)) || 1,
        forced: "user_recurring",
      });
      continue;
    }

    // USER OVERRIDE: force NOT recurring (optional behavior)
    if (ov?.recurring_hint === false) {
      continue;
    }

    // intervals
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const d = daysBetween(dates[i - 1], dates[i]);
      if (d > 0 && d < 400) intervals.push(d);
    }

    const { cadence, fit } = cadenceFromIntervals(intervals);
    const amtScore = amountStability(amountsAbs);
    const dayScore = dayStability(days);
    const occScore = clamp01((rows.length - 2) / 6);

    const score = clamp01(0.45 * fit + 0.30 * amtScore + 0.15 * dayScore + 0.10 * occScore);
    if (score < 0.70) continue;

    candidates.push({
      merchant_key: k,
      merchant_name: rows[rows.length - 1].merchant_name ?? "Onbekend",
      score,
      cadence,
      typical_amount: Math.round(median(amountsAbs) * 100) / 100,
      typical_day: Math.round(median(days)) || 1,
    });
  }

  // 4) Writeback to merchant_map (recurring_hint=true for candidates)
  let updated = 0;
  if (candidates.length > 0) {
    const upserts = candidates.map((c) => ({
      merchant_key: c.merchant_key,
      merchant_name: c.merchant_name,
      recurring_hint: true,
      confidence: Math.max(0.2, Math.min(0.95, c.score)),
      source: c.forced === "user_recurring" ? "user_override" : "recurring_detector",
      updated_at: new Date().toISOString(),
    }));

    const { error: mmErr } = await supabase
      .from("merchant_map")
      .upsert(upserts, { onConflict: "merchant_key" });

    if (mmErr) return NextResponse.json({ error: mmErr.message }, { status: 500 });
    updated = upserts.length;
  }

  candidates.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    success: true,
    candidates,
    updated,
  });
}