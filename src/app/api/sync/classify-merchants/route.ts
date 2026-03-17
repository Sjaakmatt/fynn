// src/app/api/sync/classify-merchants/route.ts
// AI-classificatie voor merchants die de rule engine niet herkent
// Draait op merchant_map niveau (niet per transactie) → goedkoop & schaalbaar
// Eénmalig per merchant, resultaat wordt opgeslagen in merchant_map

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

const VALID_CATEGORIES = [
  'wonen', 'boodschappen', 'eten & drinken', 'transport',
  'abonnementen', 'kleding', 'gezondheid', 'entertainment',
  'verzekering', 'kinderopvang', 'schulden', 'toeslagen',
  'sparen', 'inkomen', 'overig',
] as const

const BATCH_SIZE = 50 // merchants per AI call

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 1) Haal alle merchants op met null of overig category
    const { data: nullMerchants, error: mmErr } = await supabase
      .from('merchant_map')
      .select('merchant_key, merchant_name')
      .or('category.is.null,category.eq.overig')

    if (mmErr) return NextResponse.json({ error: mmErr.message }, { status: 500 })
    if (!nullMerchants || nullMerchants.length === 0) {
      return NextResponse.json({ success: true, classified: 0, message: 'Alle merchants zijn al gecategoriseerd' })
    }

    // 2) Haal transactie-context op per merchant: gemiddeld bedrag + richting
    const merchantKeys = nullMerchants.map(m => m.merchant_key)
    const contextMap = new Map<string, { avgAmount: number; isExpense: boolean; txCount: number }>()

    for (let i = 0; i < merchantKeys.length; i += 100) {
      const chunk = merchantKeys.slice(i, i + 100)
      const { data: txs } = await supabase
        .from('transactions')
        .select('merchant_key, amount')
        .in('merchant_key', chunk)

      if (txs) {
        const grouped = new Map<string, number[]>()
        for (const tx of txs) {
          if (!tx.merchant_key) continue
          if (!grouped.has(tx.merchant_key)) grouped.set(tx.merchant_key, [])
          grouped.get(tx.merchant_key)!.push(Number(tx.amount) || 0)
        }
        for (const [key, amounts] of grouped) {
          const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
          contextMap.set(key, {
            avgAmount: Math.round(Math.abs(avg) * 100) / 100,
            isExpense: avg < 0,
            txCount: amounts.length,
          })
        }
      }
    }

    // 3) Bereid batches voor met context
    const merchantsWithContext = nullMerchants.map(m => {
      const ctx = contextMap.get(m.merchant_key)
      return {
        key: m.merchant_key,
        name: m.merchant_name ?? m.merchant_key.replace('nl:', ''),
        avgAmount: ctx?.avgAmount ?? 0,
        isExpense: ctx?.isExpense ?? true,
        txCount: ctx?.txCount ?? 0,
      }
    })

    // 4) Classificeer in batches via Claude Haiku
    const allResults: Record<string, string> = {}
    let totalClassified = 0
    let totalOverig = 0

    for (let i = 0; i < merchantsWithContext.length; i += BATCH_SIZE) {
      const batch = merchantsWithContext.slice(i, i + BATCH_SIZE)

      const merchantList = batch.map((m, idx) => {
        const direction = m.isExpense ? 'uitgave' : 'inkomst'
        const amountStr = m.avgAmount > 0 ? ` (gem. €${m.avgAmount} ${direction}, ${m.txCount}x)` : ''
        return `${idx + 1}. "${m.name}"${amountStr}`
      }).join('\n')

      try {
        const message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Classificeer deze Nederlandse bankafschrift-merchants in exact één categorie per merchant.

Categorieën: ${VALID_CATEGORIES.join(', ')}

Regels:
- Persoonsnamen (voor- en achternaam) → overig (waarschijnlijk persoonlijke overboekingen)
- Zorgverzekeraars (Zilveren Kruis, CZ, Menzis, VinkVink, etc.) → verzekering
- Schadeverzekeraars (Centraal Beheer, FBTO, InShared, etc.) → verzekering
- Kinderdagverblijf, BSO, gastouder → kinderopvang
- DUO, studiefinanciering → schulden
- Zorgtoeslag, huurtoeslag, kinderbijslag → toeslagen
- Supermarkten → boodschappen
- Restaurants, cafés, bezorging → eten & drinken
- Tankstations, OV, parkeren → transport
- Energie, water, hypotheek, huur → wonen
- Telecom, streaming, software → abonnementen
- Sportscholen, fysiotherapie, apotheek → gezondheid
- Tikkie, Klarna, PayPal → overig (onderliggende categorie varieert)
- Bij twijfel → overig

Merchants:
${merchantList}

Antwoord ALLEEN met JSON: {"1": "categorie", "2": "categorie", ...}
Alleen de JSON, niets anders.`
          }]
        })

        const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        let classifications: Record<string, string>
        try {
          classifications = JSON.parse(cleaned)
        } catch {
          console.warn(`[Classify] JSON parse failed for batch ${i / BATCH_SIZE + 1}, skipping`)
          continue
        }

        for (const [numStr, category] of Object.entries(classifications)) {
          const idx = parseInt(numStr) - 1
          if (idx < 0 || idx >= batch.length) continue

          const cat = category.toLowerCase().trim()
          if (!VALID_CATEGORIES.includes(cat as any)) continue

          const merchant = batch[idx]
          allResults[merchant.key] = cat

          if (cat === 'overig') totalOverig++
          else totalClassified++
        }
      } catch (aiError) {
        console.error(`[Classify] AI call failed for batch ${i / BATCH_SIZE + 1}:`, aiError)
        // Ga door met volgende batch
      }
    }

    // 5) Update merchant_map met classificaties
    let updated = 0
    for (const [merchantKey, category] of Object.entries(allResults)) {
      if (category === 'overig') continue // overig laten we als null, eerlijker voor toekomstige re-runs

      const { error } = await supabase
        .from('merchant_map')
        .update({
          category,
          confidence: 0.7,
          source: 'ai_classified',
          updated_at: new Date().toISOString(),
        })
        .eq('merchant_key', merchantKey)

      if (!error) updated++
    }

    // 6) Draai recategorize om transacties bij te werken
    let recategorized = 0
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const res = await fetch(`${baseUrl}/api/sync/recategorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('cookie') ?? '',
        },
      })
      const recatData = await res.json().catch(() => ({}))
      recategorized = recatData.updated ?? 0
    } catch (e) {
      console.warn('[Classify] Auto-recategorize failed:', e)
    }

    return NextResponse.json({
      success: true,
      totalMerchants: nullMerchants.length,
      classified: totalClassified,
      remainingOverig: totalOverig,
      merchantMapUpdated: updated,
      transactionsRecategorized: recategorized,
      summary: `${totalClassified} merchants geclassificeerd, ${updated} merchant_map updates, ${recategorized} transacties bijgewerkt`,
    })
  } catch (error) {
    console.error('Classify merchants error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}