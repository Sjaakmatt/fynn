import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;

  const category = sp.get("category");
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 100), 1), 500);
  const cursor = sp.get("cursor"); // ISO date string (YYYY-MM-DD) or null

  

  const month = sp.get("month") // format: "2026-03"

  let query = supabase
    .from("transactions")
    .select("id, description, amount, transaction_date, category, merchant_key, merchant_name")
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false })
    .limit(limit);

  if (category) query = query.eq("category", category);
  if (cursor) query = query.lt("transaction_date", cursor);

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number)
    const start = new Date(y, m - 1, 1).toISOString().split('T')[0]
    const end = new Date(y, m, 0).toISOString().split('T')[0]
    query = query.gte("transaction_date", start).lte("transaction_date", end)
  }

  if (category) query = query.eq("category", category);
  if (cursor) query = query.lt("transaction_date", cursor);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const nextCursor =
    data && data.length === limit
      ? (data[data.length - 1]?.transaction_date ?? null)
      : null;

  return NextResponse.json({
    transactions: data ?? [],
    nextCursor,
  });
}