import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid";
import { extractMerchant } from "@/lib/clean-description";
import { categorizeTransaction } from "@/lib/categorize-engine";
import type { Transaction, RemovedTransaction } from "plaid";

// -- Config ------------------------------------------------------------------

const MAX_PAGES = 50;
const UPSERT_EVERY_N_PAGES = 5;

// -- Helpers -----------------------------------------------------------------

function stableId(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

async function loadMerchantCategories(supabase: any, userId: string) {
  const [{ data: merchantMap }, { data: overrides }] = await Promise.all([
    supabase.from("merchant_map").select("merchant_key, category"),
    supabase
      .from("merchant_user_overrides")
      .select("merchant_key, category")
      .eq("user_id", userId),
  ]);

  const globalCategories = new Map<string, string>();
  for (const m of merchantMap ?? []) {
    if (m.category) globalCategories.set(m.merchant_key, m.category);
  }

  const userOverrides = new Map<string, string>();
  for (const o of overrides ?? []) {
    if (o.category) userOverrides.set(o.merchant_key, o.category);
  }

  return { globalCategories, userOverrides };
}

// -- Transform Plaid transactions into Supabase rows -------------------------

function transformTransactions(
  transactions: Transaction[],
  userId: string,
  accountIdMap: Map<string, string>, // plaid account_id → internal UUID
  globalCategories: Map<string, string>,
  userOverrides: Map<string, string>,
) {
  const rows: Array<Record<string, any>> = [];
  const merchantSeeds = new Map<string, {
    merchant_key: string;
    merchant_name: string;
    category: string;
  }>();

  for (const t of transactions) {
    const internalAccountId = accountIdMap.get(t.account_id);
    if (!internalAccountId) continue;

    const booking = t.date;
    if (!booking) continue;

    const amount = t.amount;
    if (amount == null) continue;

    // Plaid: positief = geld eruit (debit), negatief = geld erin (credit)
    // Fynn conventie: negatief = uitgave, positief = inkomst
    const signedAmount = -amount;

    const counterparty = t.merchant_name ?? t.name ?? "";
    const description = counterparty || "Onbekend";

    const { merchantName, merchantKey } = extractMerchant(
      description,
      Math.abs(signedAmount)
    );

    // Categorisatie: user override > merchant_map > Plaid category > rule engine
    const existingCategory = merchantKey
      ? (userOverrides.get(merchantKey) ?? globalCategories.get(merchantKey) ?? null)
      : null;

    const category = categorizeTransaction(description, signedAmount, existingCategory);

    const externalId = `plaid:${t.transaction_id}`;

    rows.push({
      user_id: userId,
      account_id: internalAccountId,
      amount: Number(signedAmount.toFixed(2)),
      currency: t.iso_currency_code ?? t.unofficial_currency_code ?? "EUR",
      description,
      transaction_date: booking,
      provider: "plaid",
      external_id: externalId,
      merchant_name: merchantName,
      merchant_key: merchantKey,
      category,
    });

    if (merchantKey && merchantName && !merchantSeeds.has(merchantKey)) {
      merchantSeeds.set(merchantKey, {
        merchant_key: merchantKey,
        merchant_name: merchantName,
        category,
      });
    }
  }

  return { rows, merchantSeeds };
}

// -- Batch upsert ------------------------------------------------------------

async function upsertBatch(
  supabase: any,
  rows: Array<Record<string, any>>,
  merchantSeeds: Map<string, {
    merchant_key: string;
    merchant_name: string;
    category: string;
  }>,
  globalCategories: Map<string, string>,
): Promise<{ upserted: number; error: string | null }> {
  let upserted = 0;

  const deduped = new Map<string, Record<string, any>>();
  for (const row of rows) deduped.set(row.external_id, row);
  const uniqueRows = Array.from(deduped.values());

  const BATCH = 500;
  for (let i = 0; i < uniqueRows.length; i += BATCH) {
    const batch = uniqueRows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("transactions")
      .upsert(batch, { onConflict: "external_id" });
    if (error) return { upserted, error: error.message };
    upserted += batch.length;
  }

  // Seed merchant_map
  const newSeeds = Array.from(merchantSeeds.values()).filter(
    (s) => !globalCategories.has(s.merchant_key)
  );

  if (newSeeds.length > 0) {
    const { error: mmErr } = await supabase.from("merchant_map").upsert(
      newSeeds.map((s) => ({
        merchant_key: s.merchant_key,
        merchant_name: s.merchant_name,
        category: s.category !== "overig" ? s.category : null,
        source: "imported",
        confidence: s.category !== "overig" ? 0.6 : 0.2,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "merchant_key", ignoreDuplicates: true }
    );
    if (mmErr) console.warn("[Plaid Sync] merchant_map seed failed:", mmErr.message);
    else console.log(`[Plaid Sync] Seeded ${newSeeds.length} new merchants`);
  }

  return { upserted, error: null };
}

// -- Main route --------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Haal alle Plaid items op voor deze user
  const { data: items, error: itemsErr } = await supabase
    .from("plaid_items")
    .select("id, item_id, access_token, cursor")
    .eq("user_id", user.id);

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No Plaid connections found" }, { status: 400 });
  }

  // Haal alle bank_accounts op en bouw een map: plaid account_id → internal UUID
  const { data: accounts } = await supabase
    .from("bank_accounts")
    .select("id, external_id")
    .eq("user_id", user.id)
    .eq("provider", "plaid");

  const accountIdMap = new Map<string, string>();
  for (const acc of accounts ?? []) {
    accountIdMap.set(acc.external_id, String(acc.id));
  }

  // Pre-load merchant categories
  const { globalCategories, userOverrides } = await loadMerchantCategories(supabase, user.id);

  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;
  let totalUpserted = 0;

  for (const item of items) {
    let cursor = item.cursor ?? "";
    let hasMore = true;
    let page = 0;

    let pendingAdded: Transaction[] = [];
    let pendingModified: Transaction[] = [];
    let pendingRemoved: RemovedTransaction[] = [];

    console.log(`[Plaid Sync] Starting sync for item ${item.item_id} | cursor=${cursor ? "resuming" : "initial"}`);

    while (hasMore && page < MAX_PAGES) {
      try {
        const response = await plaidClient.transactionsSync({
          access_token: item.access_token,
          cursor: cursor || undefined,
          count: 500,
        });

        const data = response.data;

        pendingAdded.push(...data.added);
        pendingModified.push(...data.modified);
        pendingRemoved.push(...data.removed);

        cursor = data.next_cursor;
        hasMore = data.has_more;
        page++;

        console.log(
          `[Plaid Sync] Page ${page} | +${data.added.length} ~${data.modified.length} -${data.removed.length} | has_more=${hasMore}`
        );

        // Intermediate upsert
        if (page % UPSERT_EVERY_N_PAGES === 0 && pendingAdded.length > 0) {
          const { rows, merchantSeeds } = transformTransactions(
            pendingAdded, user.id, accountIdMap, globalCategories, userOverrides
          );
          const result = await upsertBatch(supabase, rows, merchantSeeds, globalCategories);
          if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
          totalUpserted += result.upserted;
          totalAdded += pendingAdded.length;

          for (const [key, seed] of merchantSeeds) {
            if (seed.category && seed.category !== "overig") {
              globalCategories.set(key, seed.category);
            }
          }
          pendingAdded = [];
        }
      } catch (error: any) {
        console.error(`[Plaid Sync] Error on page ${page + 1}:`, error?.response?.data ?? error.message);

        // Sla cursor op zodat we kunnen hervatten
        await supabase
          .from("plaid_items")
          .update({ cursor, updated_at: new Date().toISOString() })
          .eq("id", item.id);

        return NextResponse.json({
          ok: false,
          error: `Sync failed: ${error?.response?.data?.error_message ?? error.message}`,
          progress: { added: totalAdded, upserted: totalUpserted, page },
        }, { status: 500 });
      }
    }

    // Final upsert voor added + modified
    const allPending = [...pendingAdded, ...pendingModified];
    if (allPending.length > 0) {
      const { rows, merchantSeeds } = transformTransactions(
        allPending, user.id, accountIdMap, globalCategories, userOverrides
      );
      const result = await upsertBatch(supabase, rows, merchantSeeds, globalCategories);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
      totalUpserted += result.upserted;
      totalAdded += pendingAdded.length;
      totalModified += pendingModified.length;

      for (const [key, seed] of merchantSeeds) {
        if (seed.category && seed.category !== "overig") {
          globalCategories.set(key, seed.category);
        }
      }
    }

    // Verwijder removed transactions
    if (pendingRemoved.length > 0) {
      const removeIds = pendingRemoved
        .map((r) => `plaid:${r.transaction_id}`)
        .filter(Boolean);

      if (removeIds.length > 0) {
        const { error: delErr } = await supabase
          .from("transactions")
          .delete()
          .eq("user_id", user.id)
          .in("external_id", removeIds);

        if (delErr) console.warn("[Plaid Sync] Remove failed:", delErr.message);
        else totalRemoved += removeIds.length;
      }
    }

    // Sla cursor op
    await supabase
      .from("plaid_items")
      .update({ cursor, updated_at: new Date().toISOString() })
      .eq("id", item.id);

    console.log(`[Plaid Sync] Item ${item.item_id} done | cursor saved`);
  }

  const duration = Date.now() - startTime;
  console.log(
    `[Plaid Sync] Complete in ${duration}ms | +${totalAdded} ~${totalModified} -${totalRemoved} | upserted=${totalUpserted}`
  );

  // Post-process: recurring + income detect
  if (totalUpserted > 0) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const headers = {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      };

      const [recRes, incRes] = await Promise.all([
        fetch(`${baseUrl}/api/recurring/detect`, { method: "POST", headers }),
        fetch(`${baseUrl}/api/income/detect`, { method: "POST", headers }),
      ]);

      const recData = await recRes.json().catch(() => ({}));
      const incData = await incRes.json().catch(() => ({}));
      console.log(`[Plaid Sync] Recurring: ${recData.updated ?? 0} | Income: ${incData.updated ?? 0}`);
    } catch (e) {
      console.warn("[Plaid Sync] Post-processing mislukt (non-blocking):", e);
    }
  }

  return NextResponse.json({
    ok: true,
    complete: true,
    added: totalAdded,
    modified: totalModified,
    removed: totalRemoved,
    upserted: totalUpserted,
    durationMs: duration,
  });
}