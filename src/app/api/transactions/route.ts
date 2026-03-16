// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveCategory, buildCategoryMaps } from "@/lib/resolve-category";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;

  const categoryFilter = sp.get("category");
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 100), 1), 500);
  const cursor = sp.get("cursor");
  const month = sp.get("month"); // format: "2026-03"

  // ── Fetch transactions (no category filter on DB — we resolve live) ──
  let query = supabase
    .from("transactions")
    .select("id, description, amount, transaction_date, merchant_key, merchant_name")
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false })
    .limit(categoryFilter ? 3000 : limit); // fetch more when filtering client-side

  if (cursor) query = query.lt("transaction_date", cursor);

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1).toISOString().split('T')[0];
    const end = new Date(y, m, 0).toISOString().split('T')[0];
    query = query.gte("transaction_date", start).lte("transaction_date", end);
  }

  const [{ data, error }, { data: mmRows }, { data: ovRows }, { data: ibanRows }] = await Promise.all([
    query,
    supabase.from("merchant_map").select("merchant_key, category").not("category", "is", null),
    supabase.from("merchant_user_overrides").select("merchant_key, category").eq("user_id", user.id).not("category", "is", null),
    supabase.from("bank_accounts").select("iban").eq("user_id", user.id).not("iban", "is", null),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIbans = (ibanRows ?? []).map(a => a.iban).filter(Boolean);
  const maps = buildCategoryMaps(mmRows, ovRows, userIbans);

  // ── Resolve category and filter ──
  let results = (data ?? []).map(tx => ({
    ...tx,
    category: resolveCategory(tx, maps),
  }));

  if (categoryFilter) {
    results = results.filter(tx => tx.category === categoryFilter);
  }

  // Apply limit after filtering
  const limited = results.slice(0, limit);

  const nextCursor =
    limited.length === limit
      ? (limited[limited.length - 1]?.transaction_date ?? null)
      : null;

  return NextResponse.json({
    transactions: limited,
    nextCursor,
  });
}