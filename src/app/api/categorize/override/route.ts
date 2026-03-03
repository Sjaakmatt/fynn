import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractMerchant } from "@/lib/clean-description";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { transactionId, category } = await request.json();
    if (!transactionId || !category) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // 1) Fetch tx: we need merchant_key (or we compute it)
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, description, amount, merchant_key, merchant_name")
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .single();

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const amt = Number(tx.amount ?? 0);
    const amountAbs = Math.abs(Number.isFinite(amt) ? amt : 0);

    let merchantKey: string | null = tx.merchant_key ?? null;
    let merchantName: string | null = tx.merchant_name ?? null;

    if (!merchantKey) {
      const ex = extractMerchant(tx.description ?? "", amountAbs);
      merchantKey = ex.merchantKey;
      merchantName = ex.merchantName;
    }

    // 2) Update transaction category (+ backfill merchant fields if needed)
    const { error: upTxErr } = await supabase
      .from("transactions")
      .update({
        category,
        ...(merchantKey ? { merchant_key: merchantKey } : {}),
        ...(merchantName ? { merchant_name: merchantName } : {}),
      })
      .eq("id", transactionId)
      .eq("user_id", user.id);

    if (upTxErr) return NextResponse.json({ error: upTxErr.message }, { status: 500 });

    // 3) Save override for future (merchant_key-based)
    // 3) Save override for future (single source of truth)
    if (merchantKey) {
      const { error: ovErr } = await supabase
        .from("merchant_user_overrides")
        .upsert(
          {
            user_id: user.id,
            merchant_key: merchantKey,
            category,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,merchant_key" }
        );

      if (ovErr) return NextResponse.json({ error: ovErr.message }, { status: 500 });
    }

    // 4) Also update global merchant_map category (fast-path for future tx)
    // Non-blocking is ok, but for "perfect" we fail hard if this can't write.
    if (merchantKey) {
      const { error: mmErr } = await supabase
        .from("merchant_map")
        .upsert(
          {
            merchant_key: merchantKey,
            merchant_name: merchantName ?? "Onbekend",
            category,
            source: "user_override",
            confidence: 0.9,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "merchant_key" }
        );

      if (mmErr) return NextResponse.json({ error: mmErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, merchant_key: merchantKey });
  } catch (error) {
    console.error("Override error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}