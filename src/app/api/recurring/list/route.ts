import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Row = {
  merchant_key: string;
  merchant_name: string;
  confidence: number | null;
};

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1) all recurring merchants (global map) - later: join with user overrides if needed
  const { data: mm, error: mmErr } = await supabase
    .from("merchant_map")
    .select("merchant_key, merchant_name, confidence")
    .eq("recurring_hint", true)
    .order("confidence", { ascending: false });

  if (mmErr) return NextResponse.json({ error: mmErr.message }, { status: 500 });

  const merchants = (mm ?? []) as Row[];
  if (merchants.length === 0) return NextResponse.json({ items: [] });

  // 2) fetch last seen + typical amount from transactions for THIS user
  const keys = merchants.map((m) => m.merchant_key);

  // Na regel met `const keys = merchants.map(...)`
// Voeg datumfilter + batching toe:

const cutoff = new Date();
cutoff.setMonth(cutoff.getMonth() - 12);
const fromDate = cutoff.toISOString().slice(0, 10);

let allTxs: any[] = [];
for (let i = 0; i < keys.length; i += 500) {
  const batch = keys.slice(i, i + 500);
  const { data, error } = await supabase
    .from("transactions")
    .select("merchant_key, amount, transaction_date, category")
    .eq("user_id", user.id)
    .in("merchant_key", batch)
    .lt("amount", 0)
    .gte("transaction_date", fromDate)
    .order("transaction_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  allTxs = allTxs.concat(data ?? []);
}                       

  // build stats per merchant
  const byKey = new Map<string, { lastSeen: string; amounts: number[]; category: string | null }>();
  for (const t of allTxs ?? []) {
    const k = (t as any).merchant_key as string | null;
    const d = (t as any).transaction_date as string | null;
    const a = Number((t as any).amount ?? 0);
    const c = ((t as any).category ?? null) as string | null;
    if (!k || !d) continue;

    if (!byKey.has(k)) byKey.set(k, { lastSeen: d, amounts: [], category: c });
    byKey.get(k)!.amounts.push(Math.abs(a));
    if (!byKey.get(k)!.category && c) byKey.get(k)!.category = c;
  }

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const v = [...arr].sort((a, b) => a - b);
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };

  const items = merchants.map((m) => {
    const stats = byKey.get(m.merchant_key);
    return {
      merchant_key: m.merchant_key,
      name: m.merchant_name,
      confidence: m.confidence ?? 0,
      last_seen: stats?.lastSeen ?? null,
      typical_amount: Math.round(median(stats?.amounts ?? []) * 100) / 100,
      category: stats?.category ?? null,
    };
  });

  return NextResponse.json({ items });
}