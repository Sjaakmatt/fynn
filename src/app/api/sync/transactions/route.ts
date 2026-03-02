// src/app/api/sync/transactions/route.ts
// Haalt alle transacties op voor bestaande Enable Banking sessie.
// Wordt aangeroepen door de /sync pagina (niet de callback).

import { NextResponse } from 'next/server'
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

async function fetchAllTransactions(accountId: string): Promise<EBTransaction[]> {
  const all: EBTransaction[] = []
  let continuationKey: string | null = null
  let page = 1
  const MAX_PAGES = 50

  const dateFrom = new Date()
  dateFrom.setFullYear(dateFrom.getFullYear() - 1)
  const dateFromStr = dateFrom.toISOString().split('T')[0]

  do {
    const url = continuationKey
      ? `/accounts/${accountId}/transactions?continuation_key=${encodeURIComponent(continuationKey)}`
      : `/accounts/${accountId}/transactions?date_from=${dateFromStr}`

    const data = await ebFetch(url)
    const transactions = (data.transactions ?? []) as EBTransaction[]
    all.push(...transactions)

    continuationKey = data.continuation_key ?? null
    page++
    if (transactions.length === 0) break
  } while (continuationKey && page <= MAX_PAGES)

  return all
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Haal bestaande Enable Banking accounts op
    const { data: accounts } = await supabase
      .from('bank_accounts')
      .select('id, external_id, iban')
      .eq('user_id', user.id)
      .eq('provider', 'enablebanking')

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: 'Geen Enable Banking accounts gevonden' }, { status: 404 })
    }

    let totalSaved = 0

    for (const account of accounts) {
      const transactions = await fetchAllTransactions(account.external_id)

      const txRows = transactions.map(tx => {
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

        return {
          user_id: user.id,
          external_id: tx.entry_reference ?? `${account.external_id}-${date}-${amount}-${Math.random()}`,
          account_id: account.id,
          description,
          amount,
          transaction_date: date,
          category: null,
          provider: 'enablebanking',
        }
      })

      // Batch upsert per 100
      for (let i = 0; i < txRows.length; i += 100) {
        const batch = txRows.slice(i, i + 100)
        const { data } = await supabase
          .from('transactions')
          .upsert(batch, { onConflict: 'external_id', ignoreDuplicates: true })
          .select('id')
        totalSaved += data?.length ?? 0
      }
    }

    return NextResponse.json({ success: true, saved: totalSaved })
  } catch (error) {
    console.error('Sync transactions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}