// src/app/api/categorize/override/route.ts
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

    // 1) Fetch tx
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, description, amount, merchant_key, merchant_name")
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .single();

    if (txErr) {
      console.error("[override] step 1 tx fetch:", txErr.message);
      return NextResponse.json({ error: txErr.message }, { status: 500 });
    }
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

    // 2) Backfill merchant_key/name on transaction if missing (NO category write)
    if (merchantKey && !tx.merchant_key) {
      const { error: upTxErr } = await supabase
        .from("transactions")
        .update({
          ...(merchantKey ? { merchant_key: merchantKey } : {}),
          ...(merchantName ? { merchant_name: merchantName } : {}),
        })
        .eq("id", transactionId)
        .eq("user_id", user.id);

      if (upTxErr) {
        console.error("[override] step 2 tx update:", upTxErr.message);
        return NextResponse.json({ error: upTxErr.message }, { status: 500 });
      }
    }

    // 3) Ensure merchant_map row exists (FK on merchant_user_overrides requires it)
    if (merchantKey) {
      const { data: existing } = await supabase
        .from("merchant_map")
        .select("merchant_key")
        .eq("merchant_key", merchantKey)
        .maybeSingle();

      if (!existing) {
        const { error: insertErr } = await supabase
          .from("merchant_map")
          .insert({
            merchant_key: merchantKey,
            merchant_name: merchantName ?? merchantKey,
          });

        if (insertErr) {
          console.warn("[override] step 3 merchant_map insert (non-fatal):", insertErr.message);
        }
      }
    }

    // 4) Save user override
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

      if (ovErr) {
        console.error("[override] step 4 user override:", ovErr.message);
        return NextResponse.json({ error: ovErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, merchant_key: merchantKey });
  } catch (error) {
    console.error("[override] uncaught:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}