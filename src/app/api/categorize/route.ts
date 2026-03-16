// src/app/api/categorize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { categorizeTransaction } from "@/lib/categorize-engine";
import { extractMerchant } from "@/lib/clean-description";

type TxRow = {
  id: string;
  description: string | null;
  amount: string | number | null;
  merchant_key: string | null;
  merchant_name: string | null;
};

const PAGE_SIZE = 1000;
const UPSERT_BATCH = 500;

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── 1) Haal merchant overrides op ───────────────────────────
    const { data: overrides, error: ovErr } = await supabase
      .from("merchant_user_overrides")
      .select("merchant_key, category")
      .eq("user_id", user.id);

    if (ovErr) throw ovErr;

    const overrideMap = new Map<string, string>();
    for (const o of overrides ?? []) overrideMap.set(o.merchant_key, o.category);

    // ── 2) Haal user IBANs op voor interne overboeking detectie ─
    const { data: userAccounts } = await supabase
      .from("bank_accounts")
      .select("iban")
      .eq("user_id", user.id)
      .not("iban", "is", null);

    const userIbans: string[] = (userAccounts ?? [])
      .map((a) => a.iban)
      .filter((iban): iban is string => iban !== null && iban !== "");

    // ── 3) Haal transacties op — gepagineerd ────────────────────
    let allTxs: TxRow[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, description, amount, merchant_key, merchant_name")
        .eq("user_id", user.id)
        .is("merchant_key", null)
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      allTxs = allTxs.concat(data ?? []);
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    if (allTxs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Geen transacties om te categoriseren",
        categorized: 0,
      });
    }

    // ── 4) Bulk fetch merchant_map categories (1 query) ─────────
    const keys = Array.from(
      new Set(
        allTxs
          .map((t) => t.merchant_key)
          .filter((k): k is string => typeof k === "string" && k.length > 0)
      )
    );

    const merchantMapCategory = new Map<string, string>();

    if (keys.length > 0) {
      // Pagineer ook merchant_map voor grote datasets
      for (let i = 0; i < keys.length; i += PAGE_SIZE) {
        const batch = keys.slice(i, i + PAGE_SIZE);
        const { data: mmRows, error: mmErr } = await supabase
          .from("merchant_map")
          .select("merchant_key, category")
          .in("merchant_key", batch);

        if (mmErr) throw mmErr;
        for (const r of mmRows ?? []) {
          if (r.category) merchantMapCategory.set(r.merchant_key, r.category);
        }
      }
    }

    // ── 5) Backfill merchant fields (NO category write — category lives in merchant_map) ──
    const updates: Array<{
      id: string;
      merchant_key?: string;
      merchant_name?: string;
    }> = [];

    for (const tx of allTxs) {
      const amt = Number(tx.amount ?? 0);
      const safeAmt = Number.isFinite(amt) ? amt : 0;
      const amountAbs = Math.abs(safeAmt);

      let merchantKey = tx.merchant_key;
      let merchantName = tx.merchant_name;

      if (!merchantKey) {
        const ex = extractMerchant(tx.description ?? "", amountAbs);
        merchantKey = ex.merchantKey;
        merchantName = ex.merchantName;
      }

      // Only update if we have something new to write
      if (merchantKey && (!tx.merchant_key || !tx.merchant_name)) {
        updates.push({
          id: tx.id,
          ...(merchantKey ? { merchant_key: merchantKey } : {}),
          ...(merchantName ? { merchant_name: merchantName } : {}),
        });
      }
    }

    // ── 6) Batched upsert ───────────────────────────────────────
    for (let i = 0; i < updates.length; i += UPSERT_BATCH) {
      const batch = updates.slice(i, i + UPSERT_BATCH);
      const { error: upErr } = await supabase
        .from("transactions")
        .upsert(batch, { onConflict: "id" });

      if (upErr) throw upErr;
    }

    return NextResponse.json({
      success: true,
      categorized: updates.length,
    });
  } catch (error) {
    console.error("Categorize error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}