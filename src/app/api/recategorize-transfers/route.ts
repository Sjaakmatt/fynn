// src/app/api/recategorize-transfers/route.ts
//
// POST /api/recategorize-transfers
//
// Scant alle transacties van de ingelogde user en hercategoriseert interne
// overboekingen naar 'interne_overboeking'. Pakt ook transacties die eerder
// als 'sparen' waren gecategoriseerd door de oude keyword-detectie.
//
// One-time backfill — run na deploy van IBAN-based transfer detectie.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isInternalTransfer } from '@/lib/categorize-engine'

const PAGE_SIZE = 1000

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 1. Haal alle IBANs van de user op
    const { data: userAccounts } = await supabase
      .from('bank_accounts')
      .select('iban')
      .eq('user_id', user.id)
      .not('iban', 'is', null)

    const userIbans: string[] = (userAccounts ?? [])
      .map(a => a.iban)
      .filter((iban): iban is string => iban !== null && iban !== '')

    if (userIbans.length === 0) {
      return NextResponse.json({
        message: 'Geen bankrekeningen met IBAN gevonden',
        updated: 0,
      })
    }

    // 2. Haal alle transacties op die NIET al interne_overboeking zijn (gepagineerd)
    let allTransactions: { id: string; description: string | null }[] = []
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, description')
        .eq('user_id', user.id)
        .neq('category', 'interne_overboeking')
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw error
      if (!data || data.length === 0) break

      allTransactions = allTransactions.concat(data)
      if (data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    if (allTransactions.length === 0) {
      return NextResponse.json({ message: 'Geen transacties gevonden', updated: 0 })
    }

    // 3. Check elke transactie via IBAN matching
    const toUpdate: string[] = []

    for (const tx of allTransactions) {
      if (tx.description && isInternalTransfer(tx.description, userIbans)) {
        toUpdate.push(tx.id)
      }
    }

    if (toUpdate.length === 0) {
      return NextResponse.json({
        message: 'Geen interne overboekingen gevonden',
        scanned: allTransactions.length,
        updated: 0,
      })
    }

    // 4. Batch update in chunks van 100
    let updated = 0
    for (let i = 0; i < toUpdate.length; i += 100) {
      const chunk = toUpdate.slice(i, i + 100)
      const { error } = await supabase
        .from('transactions')
        .update({ category: 'interne_overboeking' })
        .eq('user_id', user.id)
        .in('id', chunk)

      if (error) {
        console.warn(`[recategorize-transfers] Batch ${i} fout:`, error.message)
      } else {
        updated += chunk.length
      }
    }

    return NextResponse.json({
      success: true,
      scanned: allTransactions.length,
      updated,
      userIbans: userIbans.length,
    })

  } catch (error) {
    console.error('[recategorize-transfers] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}