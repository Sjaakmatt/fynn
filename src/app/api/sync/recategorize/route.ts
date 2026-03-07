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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 1) Haal merchant_map op — inclusief null categories
    const { data: merchantMap } = await supabase
      .from('merchant_map')
      .select('merchant_key, category')

    const globalCategories = new Map<string, string | null>()
    for (const m of merchantMap ?? []) {
      globalCategories.set(m.merchant_key, m.category)
    }

    // 2) Haal user overrides op
    const { data: overrides } = await supabase
      .from('merchant_user_overrides')
      .select('merchant_key, category')
      .eq('user_id', user.id)

    const userCategories = new Map<string, string>()
    for (const o of overrides ?? []) {
      if (o.category) userCategories.set(o.merchant_key, o.category)
    }

    // 3) Haal ALLE transacties op (geen limit)
    let allTransactions: any[] = []
    let from = 0
    const PAGE_SIZE = 1000

    while (true) {
      const { data: batch, error } = await supabase
        .from('transactions')
        .select('id, description, amount, merchant_key, category')
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

    // 4) Hercategoriseer
    let updated = 0
    const txUpdates: { id: string; category: string }[] = []
    // Track welke merchant_keys een betere category krijgen
    const merchantCategoryUpdates = new Map<string, string>()

    for (const tx of allTransactions) {
      const merchantKey = tx.merchant_key as string | null

      // Prioriteit: user override > merchant_map (als niet null/overig) > rule engine
      let merchantCategory: string | null = null

      if (merchantKey) {
        // User override heeft altijd prioriteit
        if (userCategories.has(merchantKey)) {
          merchantCategory = userCategories.get(merchantKey)!
        } else {
          const mapCategory = globalCategories.get(merchantKey)
          // Alleen gebruiken als het een echte, bruikbare category is
          if (mapCategory && mapCategory !== 'overig') {
            merchantCategory = mapCategory
          }
          // Als merchant_map null of 'overig' is → laat de rule engine het proberen
        }
      }

      const newCategory = categorizeTransaction(
        tx.description ?? '',
        Number(tx.amount),
        merchantCategory,
      )

      if (newCategory !== tx.category) {
        txUpdates.push({ id: tx.id, category: newCategory })
        updated++
      }

      // Als de rule engine iets beters vindt dan null/overig, sla dat op voor merchant_map
      if (merchantKey && newCategory !== 'overig') {
        const currentMapCategory = globalCategories.get(merchantKey)
        if (!currentMapCategory || currentMapCategory === 'overig') {
          merchantCategoryUpdates.set(merchantKey, newCategory)
          // Update ook de lokale cache zodat volgende tx van dezelfde merchant direct goed gaan
          globalCategories.set(merchantKey, newCategory)
        }
      }
    }

    // 5) Batch update transacties
    const BATCH_SIZE = 200
    for (let i = 0; i < txUpdates.length; i += BATCH_SIZE) {
      const batch = txUpdates.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(({ id, category }) =>
          supabase.from('transactions').update({ category }).eq('id', id)
        )
      )
    }

    // 6) Update merchant_map voor merchants die null/overig category hadden
    let merchantMapUpdated = 0
    for (const [merchantKey, category] of merchantCategoryUpdates) {
      const { error } = await supabase
        .from('merchant_map')
        .update({
          category,
          confidence: 0.6,
          updated_at: new Date().toISOString(),
        })
        .eq('merchant_key', merchantKey)
        .or('category.is.null,category.eq.overig')

      if (!error) merchantMapUpdated++
    }

    return NextResponse.json({
      success: true,
      total: allTransactions.length,
      updated,
      unchanged: allTransactions.length - updated,
      merchantMapUpdated,
      summary: `${updated} transacties gehercategoriseerd, ${merchantMapUpdated} merchants bijgewerkt`,
    })
  } catch (error) {
    console.error('Recategorize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}