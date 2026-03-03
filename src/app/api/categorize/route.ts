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

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1) Haal merchant overrides op
    const { data: overrides, error: ovErr } = await supabase
      .from("merchant_user_overrides")
      .select("merchant_key, category")
      .eq("user_id", user.id);

    if (ovErr) throw ovErr;

    const overrideMap = new Map<string, string>();
    (overrides ?? []).forEach((o) => overrideMap.set(o.merchant_key, o.category));

    // 2) Haal transacties op die nog geen category hebben
    // We nemen merchant_key mee; als die null is, berekenen we hem en backfillen we meteen.
    const { data: transactions, error: txErr } = await supabase
      .from("transactions")
      .select("id, description, amount, merchant_key, merchant_name")
      .eq("user_id", user.id)
      .or("category.is.null,merchant_key.is.null");

    if (txErr) throw txErr;

    const txs = (transactions ?? []) as TxRow[];
    if (txs.length === 0) {
      return NextResponse.json({ success: true, message: "Geen transacties om te categoriseren", categorized: 0 });
    }

    // 3) Categorize + (optioneel) backfill merchant fields in dezelfde batch
    const updates: Array<{
      id: string;
      user_id: string;
      category: string;
      merchant_key?: string;
      merchant_name?: string;
    }> = [];

    // 2.5) Bulk fetch merchant_map categories (1 query)
    const keys = Array.from(
      new Set(
        txs
          .map((t) => t.merchant_key)
          .filter((k): k is string => typeof k === "string" && k.length > 0)
      )
    );

    let merchantMapCategory = new Map<string, string>();
    if (keys.length > 0) {
      const { data: mmRows, error: mmErr } = await supabase
        .from("merchant_map")
        .select("merchant_key, category")
        .in("merchant_key", keys);

      if (mmErr) throw mmErr;

      merchantMapCategory = new Map(
        (mmRows ?? [])
          .filter((r) => !!r.category)
          .map((r) => [r.merchant_key as string, r.category as string])
      );
    }

    for (const tx of txs) {
      const amt = Number(tx.amount ?? 0);
      const amountAbs = Math.abs(Number.isFinite(amt) ? amt : 0);

      // Zorg dat merchant_key bestaat
      let merchantKey = tx.merchant_key;
      let merchantName = tx.merchant_name;

      if (!merchantKey) {
        const ex = extractMerchant(tx.description ?? "", amountAbs);
        merchantKey = ex.merchantKey;
        merchantName = ex.merchantName;
      }

      // Override wins
      const overrideCategory = merchantKey ? overrideMap.get(merchantKey) : undefined;

      // 0) merchantKey moet bestaan (we berekenen hem hierboven al)
      const mapCategory = merchantKey ? (merchantMapCategory.get(merchantKey) ?? null) : null;

      // 1) user override wint
      // 2) global merchant_map category daarna
      // 3) fallback rules op merchantName (niet raw description)
      const category =
        overrideCategory ??
        mapCategory ??
        categorizeTransaction(merchantName ?? tx.description ?? "", Number.isFinite(amt) ? amt : 0);

      updates.push({
        id: tx.id,
        user_id: user.id,
        category,
        ...(merchantKey ? { merchant_key: merchantKey } : {}),
        ...(merchantName ? { merchant_name: merchantName } : {}),
      });
    }

    // 4) Single batch write
    const { error: upErr } = await supabase
      .from("transactions")
      .upsert(updates, { onConflict: "id" });

    if (upErr) throw upErr;

    return NextResponse.json({
      success: true,
      categorized: updates.length,
    });
  } catch (error) {
    console.error("Categorize error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}