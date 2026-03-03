// src/app/api/enablebanking/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ebFetch } from "@/lib/enablebanking";

interface EBTransaction {
  entry_reference?: string;
  transaction_amount?: { amount?: string; currency?: string };
  credit_debit_indicator?: "DBIT" | "CRDT";
  creditor?: { name?: string } | null;
  debtor?: { name?: string } | null;
  bank_transaction_code?: { description?: string; code?: string } | null;
  remittance_information?: string[];
  booking_date?: string;
  value_date?: string;
}

function log(step: string, data?: unknown, error?: unknown) {
  const prefix = error ? "❌" : "✅";
  const msg = `[EB Callback] ${prefix} ${step}`;
  if (error) console.error(msg, error);
  else if (data !== undefined)
    console.log(
      msg,
      typeof data === "object" ? JSON.stringify(data, null, 2) : data
    );
  else console.log(msg);
}

/**
 * PSU headers helpen vaak bij "online" fetch / minder throttling bij banken.
 * We nemen IP + UA mee uit de request.
 */
function getPsuHeaders(request: NextRequest): Record<string, string> {
  const ua = request.headers.get("user-agent") ?? undefined;
  const xff = request.headers.get("x-forwarded-for") ?? undefined;
  const ip = xff?.split(",")[0]?.trim() || undefined;

  return {
    ...(ip ? { "Psu-Ip-Address": ip } : {}),
    ...(ua ? { "Psu-User-Agent": ua } : {}),
  };
}

async function callInternalApi(path: string, request: NextRequest) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
    });
    const data = await res.json();
    log(`${path} voltooid`, data);
    return data;
  } catch (e) {
    log(`${path} mislukt (non-blocking)`, undefined, e);
    return null;
  }
}

// ── Paginering: haal ALLE transacties op voor een account ─────────────────────
// Enable Banking geeft max 50 per request terug.
// Pagination via continuation_key in de response.
//
// Fixes:
// - Gebruik strategy=longest voor eerste backfill (i.p.v. 1 jaar date_from)
// - Stop NIET op transactions.length === 0 als continuation_key nog bestaat
//   (EB kan lege pagina's geven met continuation_key)
type EBTransactionsResponse = {
  transactions?: EBTransaction[];
  continuation_key?: string | null;
};

async function fetchAllTransactions(
  accountId: string,
  request: NextRequest
): Promise<EBTransaction[]> {
  const allTransactions: EBTransaction[] = [];
  let continuationKey: string | null = null;
  let page = 1;
  const MAX_PAGES = 500;

  const firstQuery = "strategy=longest";

  const baseQuery = firstQuery; // "strategy=longest"

  do {
    const url: string =
      `/accounts/${encodeURIComponent(accountId)}/transactions?` +
      baseQuery +
      (continuationKey ? `&continuation_key=${continuationKey}` : "")

    const data: EBTransactionsResponse = await ebFetch<EBTransactionsResponse>(url, {
      method: "GET",
      headers: getPsuHeaders(request),
    });

    const transactions: EBTransaction[] = data.transactions ?? [];
    allTransactions.push(...transactions);

    log(
      `Pagina ${page} opgehaald`,
      `${transactions.length} transacties (totaal: ${allTransactions.length})`
    );

    continuationKey = data.continuation_key ?? null;
    page++;
  } while (continuationKey && page <= MAX_PAGES);

  if (page > MAX_PAGES) {
    log(
      "MAX_PAGES bereikt — mogelijk niet alle transacties opgehaald",
      `${allTransactions.length} totaal`
    );
  }

  return allTransactions;
}

// ── Betere accountnaam genereren ──────────────────────────────────────────────
// Enable Banking geeft soms de rekeninghoudersnaam terug (bijv. "S TER VELD CJ")
// Wij maken er een leesbare naam van op basis van het account type en product
function buildAccountName(account: Record<string, unknown>, iban: string): string {
  const cashType = (account.cash_account_type as string) ?? "";
  const product = (account.product as string) ?? "";
  const details = (account.details as string) ?? "";

  // Herken spaarproduten
  const savingsSignals = ["svgs", "direct sparen", "spaar", "savings", "deposito"];
  const isSavings = savingsSignals.some(
    (s) =>
      cashType.toLowerCase().includes(s) ||
      product.toLowerCase().includes(s) ||
      details.toLowerCase().includes(s)
  );

  if (isSavings) return "Spaarrekening";

  // Herken betaalrekening
  const checkingSignals = ["cacc", "current", "betaal", "checking"];
  const isChecking = checkingSignals.some(
    (s) => cashType.toLowerCase().includes(s) || product.toLowerCase().includes(s)
  );

  if (isChecking) return "Betaalrekening";

  // Fallback: gebruik laatste 4 cijfers van IBAN
  const last4 = iban.replace(/\s/g, "").slice(-4);
  return last4 ? `Rekening (...${last4})` : "Rekening";
}

// ── MAIN ROUTE ────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    log("Ontbrekende params", { code: !!code, state: !!state }, true);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=missing_params`
    );
  }

  const userId = state.split("::")[0];
  log("Gebruiker", userId);

  // ── Sessie aanmaken ──────────────────────────────────────────────────────────
  let session: Record<string, unknown>;
  try {
    session = await ebFetch("/sessions", {
      method: "POST",
      body: JSON.stringify({ code }),
      headers: getPsuHeaders(request),
    });

    log("Sessie ontvangen", {
      session_id: session.session_id,
      accounts: (session.accounts as unknown[])?.length ?? 0,
      valid_until: (session.access as Record<string, unknown>)?.valid_until,
    });
  } catch (e) {
    log("Sessie aanmaken mislukt", undefined, e);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=session_failed`
    );
  }

  const sessionId = session.session_id as string;
  const accounts = (session.accounts as Record<string, unknown>[]) ?? [];

  // ── Sessie opslaan ───────────────────────────────────────────────────────────
  const { error: sessionError } = await supabase
    .from("enablebanking_sessions")
    .upsert(
      {
        user_id: userId,
        session_id: sessionId,
        valid_until: (session.access as Record<string, unknown>)?.valid_until ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (sessionError) log("Sessie opslaan mislukt", undefined, sessionError);
  else log("Sessie opgeslagen");

  // ── Accounts + transacties verwerken ─────────────────────────────────────────
  let totalAccounts = 0;
  let totalTransactions = 0;
  let failedAccounts = 0;

  for (const account of accounts) {
    const ebAccountId = account.uid as string;
    const iban = (account.account_id as Record<string, string>)?.iban ?? "onbekend";
    const isSavings = (account.cash_account_type as string)?.toLowerCase() === "svgs";
    const accountName = buildAccountName(account, iban);

    console.log(`\n━━━ Account: ${iban} (${ebAccountId}) → ${accountName} ━━━`);

    // Balans ophalen
    let balance: number | null = null;
    try {
      const balanceData = await ebFetch<{
        balances?: Record<string, unknown>[];
      }>(`/accounts/${ebAccountId}/balances`, {
        method: "GET",
        headers: getPsuHeaders(request),
      });

      const booked = (balanceData.balances ?? [])?.find(
        (b) =>
          b.balance_type === "CLBD" ||
          b.balance_type === "ITBD" ||
          b.balance_type === "XPCD"
      );

      if (booked) {
        balance = parseFloat((booked.balance_amount as Record<string, string>).amount);
        log("Balans opgehaald", `€${balance} (${booked.balance_type})`);
      } else {
        log("Geen bruikbaar balanstype gevonden");
      }
    } catch (e) {
      log(`Balans ophalen mislukt voor ${iban}`, undefined, e);
    }

    // Account opslaan
    const { error: accountError } = await supabase
      .from("bank_accounts")
      .upsert(
        {
          user_id: userId,
          external_id: ebAccountId,
          account_name: accountName,
          iban,
          balance,
          account_type: isSavings ? "SAVINGS" : "CHECKING",
          provider: "enablebanking",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "external_id" }
      );

    if (accountError) {
      log(`Account opslaan mislukt voor ${iban}`, undefined, accountError);
      failedAccounts++;
      continue;
    }

    // Intern UUID ophalen
    const { data: savedAccount, error: lookupError } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("external_id", ebAccountId)
      .single();

    if (lookupError || !savedAccount?.id) {
      log(`Intern account ID niet gevonden voor ${iban}`, undefined, lookupError);
      failedAccounts++;
      continue;
    }

    const internalAccountId = savedAccount.id;
    log("Account opgeslagen", { internalId: internalAccountId, iban, name: accountName });
    totalAccounts++;

    // ── OPTIONAL: transacties alvast ophalen en counten (je redirect daarna toch naar /sync)
    // Als je dit niet wil in callback: verwijder dit blok.
    try {
      const tx = await fetchAllTransactions(ebAccountId, request);
      totalTransactions += tx.length;

      // Als je hier al transacties wilt opslaan, doe dat idempotent (entry_reference unique).
      // Jij doet het nu via /sync, dus ik laat het bij count/log.
      log("Transacties opgehaald (callback)", {
        account: iban,
        count: tx.length,
      });
    } catch (e) {
      log(`Transacties ophalen mislukt voor ${iban} (non-blocking)`, undefined, e);
    }

    // (optioneel) interne API triggers
    // await callInternalApi(`/api/enablebanking/something`, request)
  }

  log("Accounts klaar", {
    accounts_verwerkt: totalAccounts,
    accounts_mislukt: failedAccounts,
    transactions_totaal: totalTransactions,
  });

  // Transacties, categorisatie en recurring detect worden gedaan door de /sync pagina
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/sync?provider=enablebanking`)
}