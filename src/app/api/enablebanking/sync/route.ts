import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ebFetch } from "@/lib/enablebanking";
import { extractMerchant } from "@/lib/clean-description";

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

function getPsuHeaders(request: NextRequest): Record<string, string> {
  const ua = request.headers.get("user-agent") ?? undefined;
  const xff = request.headers.get("x-forwarded-for") ?? undefined;
  const ip = xff?.split(",")[0]?.trim() || undefined;

  return {
    ...(ip ? { "Psu-Ip-Address": ip } : {}),
    ...(ua ? { "Psu-User-Agent": ua } : {}),
  };
}

function stableId(input: string): string {
  // deterministic, short, safe for unique indexes
  let h = 2166136261; // FNV-1a 32-bit
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // unsigned
  return (h >>> 0).toString(16).padStart(8, "0");
}

function toISODate(d?: string | null): string | null {
  if (!d) return null;
  // EB geeft meestal YYYY-MM-DD; we accepteren dat
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  // fallback: probeer te parsen
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function asNumberAmount(a?: string | null): number | null {
  if (a == null) return null;
  const n = Number(a);
  return Number.isFinite(n) ? n : null;
}

/**
 * EB: first sync -> strategy=longest
 * incremental -> date_from=YYYY-MM-DD (we nemen maxDate-7d buffer)
 * pagination: continuation_key doorpollen ook bij lege pages
 */
async function fetchTransactionsEB(
  ebAccountId: string,
  request: NextRequest,
  mode: { kind: "longest" } | { kind: "date_from"; dateFrom: string }
): Promise<EBTransaction[]> {
  const all: EBTransaction[] = [];
  let continuationKey: string | null = null;
  let page = 1;
  const MAX_PAGES = 800;

  const firstQuery =
    mode.kind === "longest"
      ? "strategy=longest"
      : `date_from=${encodeURIComponent(mode.dateFrom)}`;

  do {
    const url: string = continuationKey
        ? `/accounts/${ebAccountId}/transactions?continuation_key=${encodeURIComponent(
            continuationKey
        )}`
        : `/accounts/${ebAccountId}/transactions?${firstQuery}`;

    const data: EBTransactionsResponse = await ebFetch<EBTransactionsResponse>(url, {
        method: "GET",
        headers: getPsuHeaders(request),
    });

    const txs = data.transactions ?? [];
    all.push(...txs);

    continuationKey = data.continuation_key ?? null;
    page++;
  } while (continuationKey && page <= MAX_PAGES);

  return all;
}

function cutoffDateISO(monthsBack: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
  return d.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
    const mode = body?.mode === "reset" ? "reset" : "merge";

    if (mode === "reset") {
    // delete enablebanking data for this user
    await supabase.from("transactions")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", "enablebanking");

    await supabase.from("bank_accounts")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", "enablebanking");

    await supabase.from("enablebanking_sessions")
        .delete()
        .eq("user_id", user.id);
    }

  // 1) check session exists
  const { data: sess, error: sessErr } = await supabase
    .from("enablebanking_sessions")
    .select("session_id, valid_until")
    .eq("user_id", user.id)
    .single();

  if (sessErr || !sess?.session_id) {
    return NextResponse.json({ error: "No EnableBanking session found" }, { status: 400 });
  }

  // 2) get accounts for this user/provider
  const { data: accounts, error: accErr } = await supabase
    .from("bank_accounts")
    .select("id, external_id, iban")
    .eq("user_id", user.id)
    .eq("provider", "enablebanking");

  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });

  const cutoff24m = cutoffDateISO(24);

  let insertedOrUpdated = 0;
  let processedAccounts = 0;
  let totalFetched = 0;

  for (const acc of accounts ?? []) {
    const internalAccountId = acc.id as string;
    const ebAccountId = acc.external_id as string;

    // 3) determine incremental start: max existing tx date for this account/provider
    const { data: maxRow, error: maxErr } = await supabase
      .from("transactions")
      .select("transaction_date")
      .eq("user_id", user.id)
      .eq("account_id", internalAccountId)
      .eq("provider", "enablebanking")
      .order("transaction_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxErr) {
      return NextResponse.json({ error: maxErr.message }, { status: 500 });
    }

    let mode: { kind: "longest" } | { kind: "date_from"; dateFrom: string };

    if (!maxRow?.transaction_date) {
      mode = { kind: "longest" };
    } else {
      // buffer 7 dagen terug
      const maxDate = String(maxRow.transaction_date); // YYYY-MM-DD
      const dt = new Date(`${maxDate}T00:00:00Z`);
      dt.setUTCDate(dt.getUTCDate() - 7);
      const dateFrom = dt.toISOString().slice(0, 10);
      mode = { kind: "date_from", dateFrom };
    }

    const fetched = await fetchTransactionsEB(ebAccountId, request, mode);
    totalFetched += fetched.length;

    // 4) normalize -> upsert
    const rowsToUpsert: any[] = [];
    const merchantSeeds = new Map<string, { merchant_key: string; merchant_name: string }>();

    for (const t of fetched) {
      const booking = toISODate(t.booking_date) ?? toISODate(t.value_date);
      if (!booking) continue;

      // 24m cutoff: voor “longest” backfill knippen we af
      if (booking < cutoff24m) continue;

      const amt = asNumberAmount(t.transaction_amount?.amount ?? null);
      if (amt == null) continue;

      const currency = t.transaction_amount?.currency ?? "EUR";

      // DBIT = uitgave (negatief), CRDT = inkomen (positief)
      const signedAmount =
        t.credit_debit_indicator === "DBIT" ? -Math.abs(amt) : Math.abs(amt);

      const remi = (t.remittance_information ?? []).join(" ").trim();
      const counterparty =
        (t.credit_debit_indicator === "DBIT"
          ? t.creditor?.name
          : t.debtor?.name) ?? "";

      const description = [counterparty, remi].filter(Boolean).join(" — ").trim() || "Onbekend";

      const { merchantName, merchantKey } = extractMerchant(description, Math.abs(signedAmount));

      // IMPORTANT: jouw schema heeft unique(external_id) (global).
      // Dus we maken external_id provider-safe door account te prefixen.
      // Later: beter is unique(provider, external_id) in DB.
      const entryRef = t.entry_reference ?? `${booking}:${description}`; // fallback
      const externalId = `eb:${ebAccountId}:${stableId(entryRef)}`;

      rowsToUpsert.push({
        user_id: user.id,
        account_id: internalAccountId,
        amount: Number(signedAmount.toFixed(2)),
        currency,
        description,
        transaction_date: booking,
        provider: "enablebanking",
        external_id: externalId,

        merchant_name: merchantName,
        merchant_key: merchantKey,
      });

      if (merchantKey && merchantName) {
        if (!merchantSeeds.has(merchantKey)) {
          merchantSeeds.set(merchantKey, { merchant_key: merchantKey, merchant_name: merchantName });
        }
      }
    }

    // Upsert in batches
    const BATCH = 500;
    for (let i = 0; i < rowsToUpsert.length; i += BATCH) {
      const batch = rowsToUpsert.slice(i, i + BATCH);

      const { error } = await supabase
        .from("transactions")
        .upsert(batch, { onConflict: "external_id" });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      insertedOrUpdated += batch.length;
    }

    // Seed merchant_map (global)
    const seeds = Array.from(merchantSeeds.values());
    if (seeds.length > 0) {
      const { error: mmErr } = await supabase
        .from("merchant_map")
        .upsert(
          seeds.map((s) => ({
            merchant_key: s.merchant_key,
            merchant_name: s.merchant_name,
            source: "imported",
            confidence: 0.2,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "merchant_key" }
        );

      // non-blocking: sync moet niet falen op map seed
      if (mmErr) console.warn("[merchant_map seed] failed:", mmErr.message);
    }

    processedAccounts++;
  }

  return NextResponse.json({
    ok: true,
    processedAccounts,
    totalFetched,
    upserted: insertedOrUpdated,
    cutoff24m,
  });
}