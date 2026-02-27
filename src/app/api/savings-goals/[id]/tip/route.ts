import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── POST /api/savings-goals/[id]/tip ────────────────────────────────────────
// Genereert een gepersonaliseerde AI tip op basis van:
//   - spaardoel voortgang (bedrag, deadline, op koers)
//   - uitgavenpatroon afgelopen 30 dagen (top categorieën)
// Als de user krap zit analyseert Claude waar ruimte te vinden is.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── 1. Goal ophalen ───────────────────────────────────────────────────────
    const { data: goal, error: goalError } = await supabase
      .from('savings_goals')
      .select('id, name, target_amount, deadline, account_ids, created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (goalError || !goal) {
      return NextResponse.json({ error: 'Doel niet gevonden' }, { status: 404 })
    }

    // ── 2. Gekoppelde rekeningen → huidig spaarsaldo ──────────────────────────
    let currentAmount = 0
    let linkedAccountNames: string[] = []
    if (goal.account_ids && goal.account_ids.length > 0) {
      const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('account_name, balance')
        .eq('user_id', user.id)
        .in('id', goal.account_ids)

      currentAmount = (accounts ?? []).reduce((sum, a) => sum + (Number(a.balance) || 0), 0)
      linkedAccountNames = (accounts ?? []).map(a => a.account_name).filter(Boolean)
    }

    // ── 3. Uitgaven afgelopen 30 dagen per categorie ──────────────────────────
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, category')
      .eq('user_id', user.id)
      .lt('amount', 0)
      .gte('transaction_date', thirtyDaysAgo.toISOString().split('T')[0])
      .not('category', 'is', null)
      .not('category', 'in', '("inkomen","sparen")')

    const byCategory: Record<string, number> = {}
    let totalUitgaven = 0

    ;(transactions ?? []).forEach(tx => {
      const cat = tx.category ?? 'overig'
      const amount = Math.abs(Number(tx.amount))
      byCategory[cat] = (byCategory[cat] ?? 0) + amount
      totalUitgaven += amount
    })

    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, total]) => ({
        cat,
        total: Math.round(total * 100) / 100,
        pct: totalUitgaven > 0 ? Math.round((total / totalUitgaven) * 100) : 0,
      }))

    // ── 4. Berekende velden ───────────────────────────────────────────────────
    const today = new Date()
    const deadline = new Date(goal.deadline + 'T00:00:00Z')

    const monthsLeft = Math.max(
      0,
      (deadline.getFullYear() - today.getFullYear()) * 12 +
        (deadline.getMonth() - today.getMonth())
    )
    const remaining = Math.max(0, goal.target_amount - currentAmount)
    const monthlyNeeded = monthsLeft > 0 ? remaining / monthsLeft : remaining
    const progressPct = Math.min(100, (currentAmount / goal.target_amount) * 100)

    const createdAt = new Date(goal.created_at)
    const monthsSinceCreated = Math.max(
      1,
      (today.getFullYear() - createdAt.getFullYear()) * 12 +
        (today.getMonth() - createdAt.getMonth())
    )
    const totalMonths = monthsSinceCreated + monthsLeft
    const expectedPct = totalMonths > 0 ? (monthsSinceCreated / totalMonths) * 100 : 0
    const onTrack = progressPct >= expectedPct * 0.9

    const deadlineStr = deadline.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })

    const spending30dStr = topCategories.length > 0
      ? topCategories.map(c => `  - ${c.cat}: €${c.total} (${c.pct}%)`).join('\n')
      : '  Geen uitgavedata beschikbaar'

    // ── 5. Claude prompt ──────────────────────────────────────────────────────
    const analysisInstruction = !onTrack && topCategories.length > 0
      ? `De gebruiker is ACHTER OP SCHEMA. Analyseer de uitgavencategorieën en benoem concreet waar ruimte zit om €${monthlyNeeded.toFixed(0)}/maand vrij te maken. Noem de categorie bij naam en geef een realistisch bespaarbedrag.`
      : onTrack
      ? `De gebruiker ligt op schema. Geef een motiverende tip om het momentum vast te houden of het doel eerder te halen.`
      : `Geen uitgavedata. Geef een algemene tip over hoe ze €${monthlyNeeded.toFixed(0)}/maand kunnen reserveren.`

    const content = `Je bent Fynn, een directe en vriendelijke AI financieel coach voor Nederlanders. Geef één concrete, persoonlijke tip van maximaal 4 zinnen.

SPAARDOEL
- Naam: "${goal.name}"
- Doelbedrag: €${goal.target_amount.toFixed(0)}
- Huidig gespaard: €${currentAmount.toFixed(0)} (${progressPct.toFixed(0)}%)
- Deadline: ${deadlineStr} (${monthsLeft} maanden)
- Nog nodig: €${remaining.toFixed(0)} → €${monthlyNeeded.toFixed(0)}/maand
- Op koers: ${onTrack ? 'ja' : 'NEE — achter op schema'}
${linkedAccountNames.length > 0 ? `- Rekeningen: ${linkedAccountNames.join(', ')}` : '- Geen rekeningen gekoppeld'}

UITGAVEN AFGELOPEN 30 DAGEN (€${totalUitgaven.toFixed(0)} totaal)
${spending30dStr}

${analysisInstruction}

Schrijf in jij-vorm, casual maar slim. Geen bullet points. Geen disclaimers. Geen "als financieel coach". Gewoon één krachtige tip.`

    // ── 6. Genereer + sla op ──────────────────────────────────────────────────
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content }],
    })

    const tip = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    await supabase
      .from('savings_goals')
      .update({
        ai_tip: tip,
        ai_tip_generated_at: new Date().toISOString(),
      })
      .eq('id', goal.id)
      .eq('user_id', user.id)

    return NextResponse.json({ tip })
  } catch (error) {
    console.error('[savings-goals tip] unexpected:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}