// src/app/api/sync/recategorize/route.ts
// Hercategoriseer alle transacties + vul merchant_map categories aan
//
// Logica:
// 1. merchant_user_overrides (altijd prioriteit)
// 2. merchant_map.category (als gevuld en niet 'overig')
// 3. Rule engine op description
//
// Updatet OOK merchant_map.category als die null was en de rule engine iets beters vindt.
// Dit zorgt ervoor dat toekomstige transacties van dezelfde merchant direct goed gecategoriseerd worden.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { categorizeTransaction } from '@/lib/categorize-engine'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 1) Haal ALLE transacties op (geen limit)
    let allTransactions: any[] = []
    let from = 0
    const PAGE_SIZE = 1000

    while (true) {
      const { data: batch, error } = await supabase
        .from('transactions')
        .select('id, description, amount, merchant_key, merchant_name, category')
        .eq('user_id', user.id)
        .range(from, from + PAGE_SIZE - 1)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!batch || batch.length === 0) break
      allTransactions.push(...batch)
      if (batch.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    if (allTransactions.length === 0) {
      return NextResponse.json({ updated: 0, message: 'Geen transacties gevonden' })
    }

    // 2) Haal alleen relevante merchants op (scoped aan user's transacties)
    const userMerchantKeys = [...new Set(
      allTransactions
        .map((tx: any) => tx.merchant_key)
        .filter((k: any): k is string => typeof k === 'string' && k.length > 0)
    )]

    const globalCategories = new Map<string, string | null>()
    for (let i = 0; i < userMerchantKeys.length; i += 500) {
      const batch = userMerchantKeys.slice(i, i + 500)
      const { data: mmRows } = await supabase
        .from('merchant_map')
        .select('merchant_key, category')
        .in('merchant_key', batch)
      for (const m of mmRows ?? []) {
        globalCategories.set(m.merchant_key, m.category)
      }
    }

    // 3) Haal user overrides op
    const { data: overrides } = await supabase
      .from('merchant_user_overrides')
      .select('merchant_key, category')
      .eq('user_id', user.id)

    const userCategories = new Map<string, string>()
    for (const o of overrides ?? []) {
      if (o.category) userCategories.set(o.merchant_key, o.category)
    }

    // 3b) Haal user IBANs op voor interne overboeking detectie
    const { data: ibanRows } = await supabase
      .from('bank_accounts')
      .select('iban')
      .eq('user_id', user.id)
      .not('iban', 'is', null)

    const userIbans = (ibanRows ?? [])
      .map((a: any) => a.iban)
      .filter((iban: any): iban is string => typeof iban === 'string' && iban.length > 0)

    // 4) Hercategoriseer
    let updated = 0
    const txUpdates: { id: string; category: string }[] = []
    const merchantCategoryUpdates = new Map<string, string>()

    for (const tx of allTransactions) {
      const merchantKey = tx.merchant_key as string | null

      let merchantCategory: string | null = null

      if (merchantKey) {
        if (userCategories.has(merchantKey)) {
          merchantCategory = userCategories.get(merchantKey)!
        } else {
          const mapCategory = globalCategories.get(merchantKey)
          if (mapCategory && mapCategory !== 'overig') {
            merchantCategory = mapCategory
          }
        }
      }

      const amt = Number(tx.amount ?? 0)
      const newCategory = categorizeTransaction(
        tx.description ?? '',
        Number.isFinite(amt) ? amt : 0,
        merchantCategory,
        userIbans,
        tx.merchant_name ?? null,
      )

      // Update als category anders is OF als category nog null is (backfill)
      if (newCategory !== tx.category) {
        txUpdates.push({ id: tx.id, category: newCategory })
        updated++
      }

      if (merchantKey && newCategory !== 'overig') {
        const currentMapCategory = globalCategories.get(merchantKey)
        if (!currentMapCategory || currentMapCategory === 'overig') {
          merchantCategoryUpdates.set(merchantKey, newCategory)
          globalCategories.set(merchantKey, newCategory)
        }
      }
    }

    // 5) Bulk update transacties — batch van 500 via Promise.all
    const BATCH_SIZE = 500
    let updateErrors = 0
    for (let i = 0; i < txUpdates.length; i += BATCH_SIZE) {
      const batch = txUpdates.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(({ id, category }) =>
          supabase
            .from('transactions')
            .update({ category })
            .eq('id', id)
        )
      )
      const errors = results.filter(r => r.error)
      if (errors.length > 0) {
        updateErrors += errors.length
        console.error(`[Recategorize] ${errors.length} update errors in batch ${Math.floor(i / BATCH_SIZE) + 1}`)
      }
    }

    // 6) Bulk upsert merchant_map — 1 DB call per 500 rows
    const now = new Date().toISOString()
    const mmBatch = Array.from(merchantCategoryUpdates.entries()).map(
      ([merchantKey, category]) => ({
        merchant_key: merchantKey,
        category,
        confidence: 0.6,
        updated_at: now,
      })
    )

    for (let i = 0; i < mmBatch.length; i += 500) {
      const batch = mmBatch.slice(i, i + 500)
      const { error: mmErr } = await supabase
        .from('merchant_map')
        .upsert(batch, { onConflict: 'merchant_key' })
      if (mmErr) {
        console.error('[Recategorize] merchant_map upsert error:', mmErr.message)
      }
    }
    const merchantMapUpdated = mmBatch.length

    // Cache invalideren na hercategorisatie
    invalidateDashboardCache(supabase, user.id).catch(() => {})

    return NextResponse.json({
      success: true,
      total: allTransactions.length,
      updated,
      updateErrors,
      unchanged: allTransactions.length - updated,
      merchantMapUpdated,
      summary: `${updated} transacties gehercategoriseerd, ${merchantMapUpdated} merchants bijgewerkt`,
    })
  } catch (error) {
    console.error('Recategorize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}