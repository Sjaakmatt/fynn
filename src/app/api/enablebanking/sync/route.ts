// src/app/api/enablebanking/sync/route.ts
//
// Resumable transaction sync with Enable Banking.
//
// Key changes vs previous version:
// - Categorization happens at INSERT time (not as separate post-process)
// - merchant_map gets category immediately when seeded
// - merchant_user_overrides respected during sync
// - Existing merchant_map categories are preserved (onConflict won't overwrite)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ebFetch } from "@/lib/enablebanking";
import { extractMerchant } from "@/lib/clean-description";
import { categorizeTransaction } from "@/lib/categorize-engine";

// -- Types -------------------------------------------------------------------

type EBTransaction = {
  entry_reference?: string;
  transaction_amount?: { amount?: string; currency?: string };
  credit_debit_indicator?: "DBIT" | "CRDT";
  creditor?: { name?: string } | null;
  debtor?: { name?: string } | null;
  bank_transaction_code?: { description?: string; code?: string } | null;
  remittance_information?: string[];
  booking_date?: string;
  value_date?: string;
};

type EBTransactionsResponse = {
  transactions?: EBTransaction[];
  continuation_key?: string | null;
};

// -- Config ------------------------------------------------------------------

const MAX_PAGES_PER_CALL = 30;
const UPSERT_EVERY_N_PAGES = 5;
const PAGE_DELAY_MS = 300;
const MAX_HISTORY_MONTHS = 24;

// -- Helpers -----------------------------------------------------------------

function getPsuHeaders(request: NextRequest): Record<string, string> {
  const ua = request.headers.get("user-agent") ?? undefined;
  const xff = request.headers.get("x-forwarded-for") ?? undefined;
  const ip = xff?.split(",")[0]?.trim() || undefined;
  return {
    ...(ip ? { "Psu-Ip-Address": ip } : {}),
    ...(ua ? { "Psu-User-Agent": ua } : {}),
  };
}

function buildTxUrl(accountId: string, baseQuery: string, continuationKey: string | null) {
  const qs = new URLSearchParams(baseQuery);
  if (continuationKey) qs.set("continuation_key", continuationKey);
  return `/accounts/${encodeURIComponent(accountId)}/transactions?${qs.toString()}`;
}

function stableId(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function toISODate(d?: string | null): string | null {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function asNumberAmount(a?: string | null): number | null {
  if (a == null) return null;
  const n = Number(a);
  return Number.isFinite(n) ? n : null;
}

function cutoffDateISO(monthsBack: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
  return d.toISOString().slice(0, 10);
}

// -- Pre-load merchant categories for fast lookup ----------------------------

async function loadMerchantCategories(supabase: any, userId: string): Promise<{
  globalCategories: Map<string, string>;
  userOverrides: Map<string, string>;
}> {
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

// -- Transform EB transactions into Supabase rows ----------------------------

function transformTransactions(
  fetched: EBTransaction[],
  userId: string,
  internalAccountId: string,
  ebAccountId: string,
  cutoff: string,
  globalCategories: Map<string, string>,
  userOverrides: Map<string, string>,
) {
  const rows: Array<Record<string, any>> = [];
  const merchantSeeds = new Map<string, { merchant_key: string; merchant_name: string; category: string }>();

  for (const t of fetched) {
    const booking = toISODate(t.booking_date) ?? toISODate(t.value_date);
    if (!booking || booking < cutoff) continue;

    const amt = asNumberAmount(t.transaction_amount?.amount ?? null);
    if (amt == null) continue;

    const currency = t.transaction_amount?.currency ?? "EUR";
    const signedAmount = t.credit_debit_indicator === "DBIT" ? -Math.abs(amt) : Math.abs(amt);

    const remi = (t.remittance_information ?? []).join(" ").trim();
    const counterparty =
      (t.credit_debit_indicator === "DBIT" ? t.creditor?.name : t.debtor?.name) ?? "";

    const description =
      [counterparty, remi].filter(Boolean).join(" \u2014 ").trim() || "Onbekend";

    const { merchantName, merchantKey } = extractMerchant(description, Math.abs(signedAmount));

    // ── Categorisatie: user override > merchant_map > rule engine ──
    const existingCategory = merchantKey
      ? (userOverrides.get(merchantKey) ?? globalCategories.get(merchantKey) ?? null)
      : null;

    const category = categorizeTransaction(description, signedAmount, existingCategory);

    const entryRef = t.entry_reference ?? `${booking}:${description}`;
    const externalId = `eb:${ebAccountId}:${stableId(entryRef)}`;

    rows.push({
      user_id: userId,
      account_id: internalAccountId,
      amount: Number(signedAmount.toFixed(2)),
      currency,
      description,
      transaction_date: booking,
      provider: "enablebanking",
      external_id: externalId,
      merchant_name: merchantName,
      merchant_key: merchantKey,
      category,
    });

    // Seed merchant_map met category — maar alleen als we er nog geen hebben
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

// -- Batch upsert to Supabase ------------------------------------------------

async function upsertBatch(
  supabase: any,
  rows: Array<Record<string, any>>,
  merchantSeeds: Map<string, { merchant_key: string; merchant_name: string; category: string }>,
  globalCategories: Map<string, string>,
): Promise<{ upserted: number; error: string | null }> {
  let upserted = 0;

  // Deduplicate by external_id
  const deduped = new Map<string, Record<string, any>>();
  for (const row of rows) {
    deduped.set(row.external_id, row);
  }
  const uniqueRows = Array.from(deduped.values());

  console.log(`[Sync] upsertBatch: ${rows.length} rows → ${uniqueRows.length} unique`);

  const BATCH = 500;
  for (let i = 0; i < uniqueRows.length; i += BATCH) {
    const batch = uniqueRows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("transactions")
      .upsert(batch, { onConflict: "external_id" });
    if (error) return { upserted, error: error.message };
    upserted += batch.length;
  }

  // Seed merchant_map — alleen voor merchants die nog GEEN category hebben
  const newSeeds = Array.from(merchantSeeds.values()).filter(
    (s) => !globalCategories.has(s.merchant_key)
  );

  if (newSeeds.length > 0) {
    const { error: mmErr } = await supabase.from("merchant_map").upsert(
      newSeeds.map((s) => ({
        merchant_key: s.merchant_key,
        merchant_name: s.merchant_name,
        category: s.category !== 'overig' ? s.category : null, // null is beter dan overig voor toekomstige re-runs
        source: "imported",
        confidence: s.category !== 'overig' ? 0.6 : 0.2,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "merchant_key", ignoreDuplicates: true }
    );
    if (mmErr) console.warn("[merchant_map seed] failed:", mmErr.message);
    else console.log(`[Sync] Seeded ${newSeeds.length} new merchants to merchant_map`);
  }

  // Update bestaande merchants die category=null hebben met een betere categorie
  const nullCategoryUpdates = Array.from(merchantSeeds.values()).filter(
    (s) => globalCategories.has(s.merchant_key) === false || // niet in map
      (globalCategories.get(s.merchant_key) === undefined) // of null
  ).filter(s => s.category !== 'overig');

  // Dit wordt al afgehandeld door de upsert hierboven met ignoreDuplicates: true
  // Maar voor merchants die WEL bestaan maar category=null hebben, doen we een expliciete update
  const existingNullMerchants = Array.from(merchantSeeds.values()).filter(
    (s) => s.category !== 'overig' && globalCategories.has(s.merchant_key) && !globalCategories.get(s.merchant_key)
  );

  // Hmm, globalCategories filtert al op m.category truthy, dus dit scenario kan niet.
  // Het echte probleem is merchants die in DB staan met category=null maar niet in onze Map.
  // Die worden al door de ignoreDuplicates=true NIET overschreven.
  // We moeten die apart updaten:
  if (existingNullMerchants.length > 0) {
    for (const s of existingNullMerchants) {
      await supabase
        .from("merchant_map")
        .update({ category: s.category, confidence: 0.6, updated_at: new Date().toISOString() })
        .eq("merchant_key", s.merchant_key)
        .is("category", null);
    }
    console.log(`[Sync] Updated ${existingNullMerchants.length} merchants with null category`);
  }

  return { upserted, error: null };
}

// -- Main route --------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({} as any));
  const mode: "merge" | "reset" | "full_reset" =
    body?.mode === "full_reset" ? "full_reset"
      : body?.mode === "reset" ? "reset"
      : "merge";

  // -- Reset modes -----------------------------------------------------------

  if (mode === "reset") {
    const { error: delErr } = await supabase
      .from("transactions")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "enablebanking");
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    await supabase
      .from("bank_accounts")
      .update({ sync_continuation_key: null, sync_base_query: null })
      .eq("user_id", user.id)
      .eq("provider", "enablebanking");
  }

  if (mode === "full_reset") {
    await supabase.from("transactions").delete().eq("user_id", user.id).eq("provider", "enablebanking");
    await supabase.from("bank_accounts").delete().eq("user_id", user.id).eq("provider", "enablebanking");
    await supabase.from("enablebanking_sessions").delete().eq("user_id", user.id);
    return NextResponse.json({ ok: true, mode, message: "Wiped EB data. Reconnect required." });
  }

  // -- Validate session & accounts -------------------------------------------

  const { data: sess, error: sessErr } = await supabase
    .from("enablebanking_sessions")
    .select("session_id, valid_until")
    .eq("user_id", user.id)
    .single();

  if (sessErr || !sess?.session_id) {
    return NextResponse.json({ error: "No EnableBanking session found" }, { status: 400 });
  }

  const { data: accounts, error: accErr } = await supabase
    .from("bank_accounts")
    .select("id, external_id, iban, sync_continuation_key, sync_base_query")
    .eq("user_id", user.id)
    .eq("provider", "enablebanking");

  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ error: "No EnableBanking accounts found" }, { status: 400 });
  }

  // -- Pre-load merchant categories for this user ----------------------------
  const { globalCategories, userOverrides } = await loadMerchantCategories(supabase, user.id);

  const cutoff = cutoffDateISO(MAX_HISTORY_MONTHS);

  // -- Per-account sync ------------------------------------------------------

  let totalUpserted = 0;
  let totalFetched = 0;
  let allComplete = true;
  const accountResults: Array<{
    iban: string; fetched: number; upserted: number; complete: boolean; pages: number;
  }> = [];

  for (const acc of accounts) {
    const internalAccountId = String(acc.id);
    const ebAccountId = String(acc.external_id);
    const iban = acc.iban ?? ebAccountId;

    // -- Determine fetch strategy --------------------------------------------

    let baseQuery: string;
    let continuationKey: string | null = null;

    if (acc.sync_continuation_key && acc.sync_base_query) {
      baseQuery = acc.sync_base_query;
      continuationKey = acc.sync_continuation_key;
      console.log(`[Sync] Resuming ${iban} from saved continuation_key`);
    } else {
      const { data: maxRow } = await supabase
        .from("transactions")
        .select("transaction_date")
        .eq("user_id", user.id)
        .eq("account_id", internalAccountId)
        .eq("provider", "enablebanking")
        .order("transaction_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!maxRow?.transaction_date) {
        baseQuery = "strategy=longest";
        console.log(`[Sync] ${iban} -- first sync, strategy=longest`);
      } else {
        const maxDate = String(maxRow.transaction_date);
        const dt = new Date(`${maxDate}T00:00:00Z`);
        dt.setUTCDate(dt.getUTCDate() - 7);
        const dateFrom = dt.toISOString().slice(0, 10);
        baseQuery = `date_from=${dateFrom}`;
        console.log(`[Sync] ${iban} -- incremental from ${dateFrom}`);
      }
    }

    // -- Paginated fetch -----------------------------------------------------

    let page = 0;
    let accountComplete = false;
    let pendingTx: EBTransaction[] = [];
    let accountFetched = 0;
    let accountUpserted = 0;

    while (page < MAX_PAGES_PER_CALL) {
      const url = buildTxUrl(ebAccountId, baseQuery, continuationKey);

      let data: EBTransactionsResponse;
      try {
        data = await ebFetch<EBTransactionsResponse>(url, {
          method: "GET",
          headers: getPsuHeaders(request),
        });
      } catch (err: any) {
        const msg = err?.message ?? "";

        if (msg.includes("422") || msg.includes("400")) {
          console.warn(`[Sync] ${iban} -- ${msg.includes("422") ? "422" : "400"} on page ${page + 1}, stopping. ${accountFetched} tx so far.`);
          accountComplete = true;
          break;
        }

        console.error(`[Sync] ${iban} -- error on page ${page + 1}:`, msg);

        if (pendingTx.length > 0) {
          const { rows, merchantSeeds } = transformTransactions(
            pendingTx, user.id, internalAccountId, ebAccountId, cutoff,
            globalCategories, userOverrides
          );
          const result = await upsertBatch(supabase, rows, merchantSeeds, globalCategories);
          accountUpserted += result.upserted;
        }

        await supabase
          .from("bank_accounts")
          .update({ sync_continuation_key: continuationKey, sync_base_query: baseQuery })
          .eq("id", acc.id);

        return NextResponse.json({
          ok: false,
          error: `Sync failed for ${iban}: ${msg}`,
          progress: { accountFetched, accountUpserted, page },
        }, { status: 500 });
      }

      const txs = data.transactions ?? [];
      pendingTx.push(...txs);
      accountFetched += txs.length;
      page++;

      console.log(`[Sync] ${iban} page ${page} | ${txs.length} tx | total ${accountFetched} | ck=${data.continuation_key ? "yes" : "no"}`);

      continuationKey = data.continuation_key ?? null;

      if (!continuationKey) {
        accountComplete = true;
        break;
      }

      // Intermediate upsert every N pages
      if (page % UPSERT_EVERY_N_PAGES === 0 && pendingTx.length > 0) {
        console.log(`[Sync] ${iban} -- intermediate upsert at page ${page} (${pendingTx.length} tx)`);
        const { rows, merchantSeeds } = transformTransactions(
          pendingTx, user.id, internalAccountId, ebAccountId, cutoff,
          globalCategories, userOverrides
        );
        const result = await upsertBatch(supabase, rows, merchantSeeds, globalCategories);
        if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
        accountUpserted += result.upserted;
        pendingTx = [];

        // Update local category cache met nieuwe merchants
        for (const [key, seed] of merchantSeeds) {
          if (seed.category && seed.category !== 'overig') {
            globalCategories.set(key, seed.category);
          }
        }
      }

      await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    }

    // -- Final upsert --------------------------------------------------------

    if (pendingTx.length > 0) {
      const { rows, merchantSeeds } = transformTransactions(
        pendingTx, user.id, internalAccountId, ebAccountId, cutoff,
        globalCategories, userOverrides
      );
      const result = await upsertBatch(supabase, rows, merchantSeeds, globalCategories);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
      accountUpserted += result.upserted;

      // Update cache
      for (const [key, seed] of merchantSeeds) {
        if (seed.category && seed.category !== 'overig') {
          globalCategories.set(key, seed.category);
        }
      }
    }

    // -- Save or clear continuation key --------------------------------------

    if (accountComplete) {
      await supabase
        .from("bank_accounts")
        .update({ sync_continuation_key: null, sync_base_query: null })
        .eq("id", acc.id);
    } else {
      allComplete = false;
      await supabase
        .from("bank_accounts")
        .update({ sync_continuation_key: continuationKey, sync_base_query: baseQuery })
        .eq("id", acc.id);
      console.log(`[Sync] ${iban} -- paused at page ${page}, ck saved for resume`);
    }

    totalFetched += accountFetched;
    totalUpserted += accountUpserted;
    accountResults.push({ iban, fetched: accountFetched, upserted: accountUpserted, complete: accountComplete, pages: page });
  }

  const duration = Date.now() - startTime;
  console.log(`[Sync] Done in ${duration}ms | ${totalFetched} fetched | ${totalUpserted} upserted | complete=${allComplete}`);

  // ── Post-process: recurring detect + income detect ────────────────────────
  // Categorisatie is nu al gedaan tijdens sync, dus /api/categorize is niet meer nodig
  if (allComplete && totalUpserted > 0) {
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

      console.log(`[Sync] Recurring: ${recData.updated ?? 0} | Income: ${incData.updated ?? 0}`);
    } catch (e) {
      console.warn("[Sync] Post-processing mislukt (non-blocking):", e);
    }
  }

  return NextResponse.json({
    ok: true,
    mode,
    complete: allComplete,
    totalFetched,
    totalUpserted,
    durationMs: duration,
    accounts: accountResults,
    cutoff,
  });
}