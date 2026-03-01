// src/app/api/enablebanking/callback/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ebFetch } from '@/lib/enablebanking'

interface EBTransaction {
  entry_reference?: string
  transaction_amount?: { amount?: string; currency?: string }
  credit_debit_indicator?: 'DBIT' | 'CRDT'
  creditor?: { name?: string } | null
  debtor?: { name?: string } | null
  bank_transaction_code?: { description?: string; code?: string } | null
  remittance_information?: string[]
  booking_date?: string
  value_date?: string
}

function log(step: string, data?: unknown, error?: unknown) {
  const prefix = error ? '❌' : '✅'
  const msg = `[EB Callback] ${prefix} ${step}`
  if (error) console.error(msg, error)
  else if (data !== undefined) console.log(msg, typeof data === 'object' ? JSON.stringify(data, null, 2) : data)
  else console.log(msg)
}

// Roept een interne API route aan met de sessie-cookie van de originele request
async function callInternalApi(path: string, request: NextRequest) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') ?? '',
      },
    })
    const data = await res.json()
    log(`${path} voltooid`, data)
    return data
  } catch (e) {
    log(`${path} mislukt (non-blocking)`, undefined, e)
    return null
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    log('Ontbrekende params', { code: !!code, state: !!state }, true)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=missing_params`)
  }

  const userId = state.split('::')[0]
  log('Gebruiker', userId)

  // ── Sessie aanmaken ────────────────────────────────────────────────────────
  let session: Record<string, unknown>
  try {
    session = await ebFetch('/sessions', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
    log('Sessie ontvangen', {
      session_id: session.session_id,
      accounts: (session.accounts as unknown[])?.length ?? 0,
      valid_until: (session.access as Record<string, unknown>)?.valid_until,
    })
  } catch (e) {
    log('Sessie aanmaken mislukt', undefined, e)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=session_failed`)
  }

  const sessionId = session.session_id as string
  const accounts = (session.accounts as Record<string, unknown>[]) ?? []

  // ── Sessie opslaan ─────────────────────────────────────────────────────────
  const { error: sessionError } = await supabase.from('enablebanking_sessions').upsert({
    user_id: userId,
    session_id: sessionId,
    valid_until: (session.access as Record<string, unknown>)?.valid_until ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (sessionError) log('Sessie opslaan mislukt', undefined, sessionError)
  else log('Sessie opgeslagen')

  // ── Accounts + transacties verwerken ──────────────────────────────────────
  let totalAccounts = 0
  let totalTransactions = 0
  let failedAccounts = 0

  for (const account of accounts) {
    const ebAccountId = account.uid as string
    const iban = (account.account_id as Record<string, string>)?.iban ?? 'onbekend'

    console.log(`\n━━━ Account: ${iban} (${ebAccountId}) ━━━`)

    // Balans ophalen
    let balance: number | null = null
    try {
      const balanceData = await ebFetch(`/accounts/${ebAccountId}/balances`)
      const booked = (balanceData.balances as Record<string, unknown>[])?.find(
        (b) => b.balance_type === 'CLBD' || b.balance_type === 'ITBD' || b.balance_type === 'XPCD'
      )
      if (booked) {
        balance = parseFloat((booked.balance_amount as Record<string, string>).amount)
        log('Balans opgehaald', `€${balance} (${booked.balance_type})`)
      } else {
        log('Geen bruikbaar balanstype gevonden')
      }
    } catch (e) {
      log(`Balans ophalen mislukt voor ${iban}`, undefined, e)
    }

    // Account opslaan
    const { error: accountError } = await supabase.from('bank_accounts').upsert({
      user_id: userId,
      external_id: ebAccountId,
      account_name: account.name ?? account.product ?? account.details ?? 'Rekening',
      iban,
      balance,
      account_type: account.cash_account_type === 'SVGS' ? 'SAVINGS' : 'CHECKING',
      provider: 'enablebanking',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'external_id' })

    if (accountError) {
      log(`Account opslaan mislukt voor ${iban}`, undefined, accountError)
      failedAccounts++
      continue
    }

    // Intern UUID ophalen
    const { data: savedAccount, error: lookupError } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('external_id', ebAccountId)
      .single()

    if (lookupError || !savedAccount?.id) {
      log(`Intern account ID niet gevonden voor ${iban}`, undefined, lookupError)
      failedAccounts++
      continue
    }

    const internalAccountId = savedAccount.id
    log('Account opgeslagen', { internalId: internalAccountId, iban })
    totalAccounts++

    // Transacties ophalen en opslaan
    try {
      const txData = await ebFetch(`/accounts/${ebAccountId}/transactions`)
      const transactions = (txData.transactions ?? []) as EBTransaction[]
      log('Transacties ontvangen', `${transactions.length} stuks`)

      let txSuccess = 0
      let txFailed = 0

      for (const tx of transactions) {
        const rawAmount = parseFloat(tx.transaction_amount?.amount ?? '0')
        const amount = tx.credit_debit_indicator === 'DBIT' ? -rawAmount : rawAmount
        const date = tx.booking_date ?? tx.value_date

        const remittance = Array.isArray(tx.remittance_information) && tx.remittance_information.length > 0
          ? tx.remittance_information.join(' ').replace(/\n/g, ' ').trim()
          : null

        const description = remittance
          ?? tx.creditor?.name
          ?? tx.debtor?.name
          ?? tx.bank_transaction_code?.description
          ?? 'Onbekend'

        const { error: txError } = await supabase.from('transactions').upsert({
          user_id: userId,
          external_id: tx.entry_reference ?? `${ebAccountId}-${date}-${amount}-${Math.random()}`,
          account_id: internalAccountId,
          description,
          amount,
          transaction_date: date,
          category: null,   // categorisatie gebeurt in de volgende stap
          provider: 'enablebanking',
        }, { onConflict: 'external_id' })

        if (txError) {
          txFailed++
          if (txFailed === 1) log('TX fout (eerste)', undefined, txError)
        } else {
          txSuccess++
        }
      }

      log('Transacties opgeslagen', `${txSuccess} ✅  ${txFailed} ❌`)
      totalTransactions += txSuccess
    } catch (e) {
      log(`Transacties ophalen mislukt voor ${iban}`, undefined, e)
    }
  }

  // ── Samenvatting ───────────────────────────────────────────────────────────
  console.log('\n━━━ SAMENVATTING ━━━')
  log('Sync klaar', {
    accounts_verwerkt: totalAccounts,
    accounts_mislukt: failedAccounts,
    transacties_opgeslagen: totalTransactions,
  })

  // ── Post-sync pipeline ─────────────────────────────────────────────────────
  // Stap 1: categoriseer alle transacties met category = null
  await callInternalApi('/api/categorize', request)

  // Stap 2: detecteer vaste lasten + inkomen op basis van transactiehistorie
  await callInternalApi('/api/recurring/detect', request)

  // Beide zijn non-blocking — als ze falen komt de gebruiker nog steeds op dashboard
  // De data wordt bij de volgende sync of refresh alsnog correct

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?connected=true`)
}