// src/app/api/subscriptions/route.ts
// Detecteert ALLE terugkerende kosten — niet alleen category='abonnementen'.
// Gebruikt: merchant_map (recurring_hint + category), transactie frequentie-analyse,
// en merchant_cancellations voor opzegbaarheid.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Categorieën die nooit getoond worden (geen uitgaven)
const EXCLUDE_CATEGORIES = ['inkomen', 'interne_overboeking', 'toeslagen', 'sparen']

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const fromDate = twelveMonthsAgo.toISOString().slice(0, 10)

    // 1) Haal alle uitgaande transacties op met merchant_key (12 maanden)
    const { data: transactions } = await supabase
      .from('transactions')
      .select('merchant_key, merchant_name, amount, transaction_date, description')
      .eq('user_id', user.id)
      .lt('amount', 0)
      .gte('transaction_date', fromDate)
      .not('merchant_key', 'is', null)
      .order('transaction_date', { ascending: false })
      .limit(5000)

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ subscriptions: [], vasteLasten: [], totaalPerMaand: 0 })
    }

    // 2) Haal merchant_map op voor recurring_hint en category
    const { data: merchantMap } = await supabase
      .from('merchant_map')
      .select('merchant_key, merchant_name, category, recurring_hint')

    const mapByKey = new Map(
      (merchantMap ?? []).map(m => [m.merchant_key, m])
    )

    // 3) Haal user overrides op
    const { data: overrides } = await supabase
      .from('merchant_user_overrides')
      .select('merchant_key, category, is_variable')
      .eq('user_id', user.id)

    const overrideMap = new Map(
      (overrides ?? []).map(o => [o.merchant_key, o])
    )

    // 4) Haal merchant_cancellations op voor opzegbaarheid
    const { data: cancellations } = await supabase
      .from('merchant_cancellations')
      .select('merchant_key, merchant_name, cancel_method, difficulty')

    const cancelMap = new Map(
      (cancellations ?? []).map(c => [c.merchant_key, c])
    )

    // 5) Groepeer transacties per merchant_key
    const grouped = new Map<string, {
      name: string
      category: string
      amounts: number[]
      dates: string[]
      isRecurringHint: boolean
    }>()

    for (const tx of transactions) {
      const key = tx.merchant_key!
      // Priority: user override → merchant_map → rule engine (NEVER tx.category)
      const cat = overrideMap.get(key)?.category ?? mapByKey.get(key)?.category ?? 'overig'

      // Skip excluded categories
      if (EXCLUDE_CATEGORIES.includes(cat)) continue

      // Skip if user marked as variable
      if (overrideMap.get(key)?.is_variable) continue

      if (!grouped.has(key)) {
        grouped.set(key, {
          name: tx.merchant_name ?? mapByKey.get(key)?.merchant_name ?? key,
          category: cat,
          amounts: [],
          dates: [],
          isRecurringHint: mapByKey.get(key)?.recurring_hint === true,
        })
      }
      const g = grouped.get(key)!
      g.amounts.push(Math.abs(Number(tx.amount)))
      g.dates.push(tx.transaction_date)
    }

    // 6) Detecteer recurring patronen
    const allItems: SubscriptionItem[] = []

    for (const [key, g] of grouped) {
      // Minimum 3 transacties om als recurring te tellen
      // (2x ergens geweest is toeval, niet een abonnement)
      if (g.amounts.length < 3 && !g.isRecurringHint) continue
      if (g.amounts.length < 2) continue

      // Analyseer frequentie
      const sortedDates = [...g.dates].sort()
      const intervals: number[] = []
      for (let i = 1; i < sortedDates.length; i++) {
        const days = Math.round(
          (new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime()) / 86400000
        )
        intervals.push(days)
      }

      const avgInterval = intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0

      // Bepaal cadans
      let cadence: 'maandelijks' | 'kwartaal' | 'jaarlijks' | null = null
      if (avgInterval > 0 && avgInterval <= 45) cadence = 'maandelijks'
      else if (avgInterval > 45 && avgInterval <= 120) cadence = 'kwartaal'
      else if (avgInterval > 300 && g.amounts.length >= 2) cadence = 'jaarlijks'

      // Als geen duidelijke cadans EN niet in merchant_map als recurring → skip
      if (!cadence && !g.isRecurringHint) continue

      // Als geen cadans maar wel recurring_hint, neem maandelijks aan
      if (!cadence && g.isRecurringHint) cadence = 'maandelijks'

      // Consistentie check: bedragen moeten redelijk consistent zijn
      const sorted = [...g.amounts].sort((a, b) => a - b)
      const medianAmount = sorted[Math.floor(sorted.length / 2)]
      const variance = sorted.length > 1
        ? Math.abs(sorted[sorted.length - 1] - sorted[0]) / medianAmount
        : 0

      // Hoge variatie (>50%) en niet in merchant_map → geen abonnement
      // Echte abonnementen hebben (bijna) identieke bedragen
      if (variance > 0.5 && !g.isRecurringHint) continue

      // Extra check voor items zonder recurring_hint:
      // intervals moeten ook consistent zijn (stddev < 40% van gemiddelde)
      if (!g.isRecurringHint && intervals.length >= 2) {
        const avgInt = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const stdDev = Math.sqrt(intervals.reduce((sum, i) => sum + (i - avgInt) ** 2, 0) / intervals.length)
        if (avgInt > 0 && stdDev / avgInt > 0.4) continue
      }

      const monthlyAmount = cadence === 'jaarlijks' ? medianAmount / 12
        : cadence === 'kwartaal' ? medianAmount / 3
        : medianAmount

      // Filter: minimum €1/maand
      if (monthlyAmount < 1) continue

      // Check of nog actief
      const lastDate = g.dates[0] // already sorted desc from query
      if (!isActive(lastDate, cadence!)) continue

      // Bepaal of opzegbaar via Fynn
      const cancelInfo = cancelMap.get(key)
      const hasCancelInfo = !!cancelInfo

      allItems.push({
        key,
        name: g.name,
        amount: medianAmount,
        monthlyAmount,
        cadence: cadence!,
        occurrences: g.dates.length,
        lastDate,
        category: g.category,
        amountVariance: variance,
        isActive: true,
        canCancel: hasCancelInfo,
        cancelMethod: cancelInfo?.cancel_method ?? null,
        cancelDifficulty: cancelInfo?.difficulty ?? null,
      })
    }

    // 7) Sorteer op maandbedrag (hoogst eerst)
    allItems.sort((a, b) => b.monthlyAmount - a.monthlyAmount)

    // 8) Split: abonnementen vs vaste lasten
    //
    // Een abonnement is NIET "alles met category='abonnementen'".
    // AI-classificatie labelt soms winkels/horeca als 'abonnementen' als je er
    // regelmatig komt. Dat is onjuist en schaalt niet.
    //
    // Daarom: dubbele check.
    // Een item is een ABONNEMENT als het voldoet aan:
    //   A) category 'abonnementen' OF canCancel
    //   B) EN het bedrag is consistent (variance < 20%) — echte abonnementen
    //      hebben een vast bedrag, een snackbar niet
    //   C) TENZIJ canCancel=true (merchant_cancellations is handmatig gecureerd,
    //      die vertrouwen we altijd)
    //   D) NIET als het in een vaste-lasten-categorie valt
    //
    // Alles wat recurring is maar niet als abonnement kwalificeert → vaste lasten

    const VASTE_LASTEN_CATEGORIES = ['wonen']

    // Categorieen die NOOIT als abonnement geteld worden, zelfs als category='abonnementen'
    // Dit vangt AI-misclassificaties op schaal
    const NEVER_SUBSCRIPTION_CATEGORIES = ['eten & drinken', 'boodschappen', 'entertainment', 'kleding']

    function isSubscription(item: SubscriptionItem): boolean {
      // Altijd vaste last als categorie wonen is
      if (VASTE_LASTEN_CATEGORIES.includes(item.category)) return false

      // canCancel uit merchant_cancellations is handmatig gecureerd → vertrouw altijd
      if (item.canCancel) return true

      // Categorieen die per definitie geen abonnement zijn
      if (NEVER_SUBSCRIPTION_CATEGORIES.includes(item.category)) return false

      // Moet category 'abonnementen' hebben
      if (item.category !== 'abonnementen') return false

      // Bedrag moet consistent zijn — echte abonnementen wijken max 20% af
      // Dit filtert snackbars, winkels etc. die toevallig als 'abonnementen' gelabeld zijn
      if (item.amountVariance > 0.2) return false

      return true
    }

    const subscriptions = allItems.filter(isSubscription).map(cleanItem)
    const vasteLasten = allItems.filter(s => !isSubscription(s)).map(cleanItem)

    const totaalPerMaand = allItems.reduce((s, sub) => s + sub.monthlyAmount, 0)
    const totaalAbonnementen = subscriptions.reduce((s, sub) => s + sub.monthlyAmount, 0)
    const totaalVasteLasten = vasteLasten.reduce((s, sub) => s + sub.monthlyAmount, 0)

    return NextResponse.json({
      subscriptions,
      vasteLasten,
      totaalPerMaand,
      totaalAbonnementen,
      totaalVasteLasten,
    })

  } catch (error) {
    console.error('Subscriptions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── Types ──────────────────────────────────────────────────────

interface SubscriptionItem {
  key: string
  name: string
  amount: number
  monthlyAmount: number
  cadence: 'maandelijks' | 'kwartaal' | 'jaarlijks'
  occurrences: number
  lastDate: string
  category: string
  amountVariance: number
  isActive: boolean
  canCancel: boolean
  cancelMethod: string | null
  cancelDifficulty: string | null
}

function cleanItem(s: SubscriptionItem) {
  return {
    name: s.name,
    amount: s.amount,
    monthlyAmount: s.monthlyAmount,
    cadence: s.cadence,
    occurrences: s.occurrences,
    lastDate: s.lastDate,
    category: s.category,
    isActive: s.isActive,
    canCancel: s.canCancel,
    cancelMethod: s.cancelMethod,
    cancelDifficulty: s.cancelDifficulty,
  }
}

function isActive(lastDate: string, cadence: string): boolean {
  const last = new Date(lastDate)
  const daysSince = Math.round((Date.now() - last.getTime()) / 86400000)
  const threshold = cadence === 'jaarlijks' ? 400
    : cadence === 'kwartaal' ? 130
    : 50
  return daysSince <= threshold
}