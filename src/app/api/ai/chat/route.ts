import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { projectCashflow } from '@/lib/decision-engine'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Haal transacties op
    const { data: transactions } = await supabase
      .from('transactions')
      .select('description, amount, category, transaction_date')
      .eq('user_id', user.id)
      .not('category', 'is', null)
      .order('transaction_date', { ascending: false })
      .limit(100)

    // Haal abonnementen op
    const { data: subTransactions } = await supabase
      .from('transactions')
      .select('description, amount')
      .eq('user_id', user.id)
      .eq('category', 'abonnementen')
      .order('transaction_date', { ascending: false })

    const abonnementen: Record<string, number> = {}
    subTransactions?.forEach(tx => {
      const key = tx.description
      if (!abonnementen[key]) abonnementen[key] = Math.abs(parseFloat(tx.amount))
    })

    const abonnementenLijst = Object.entries(abonnementen)
      .map(([naam, bedrag]) => `- ${naam}: €${bedrag.toFixed(2)}/maand`)
      .join('\n')

    // Bereken financieel overzicht
    const uitgaven: Record<string, number> = {}
    let totaalUit = 0
    let totaalIn = 0

    transactions?.forEach(tx => {
      const amount = parseFloat(tx.amount)
      if (amount < 0) {
        const cat = tx.category ?? 'overig'
        uitgaven[cat] = (uitgaven[cat] ?? 0) + Math.abs(amount)
        if (cat !== 'sparen') totaalUit += Math.abs(amount)
      } else {
        totaalIn += amount
      }
    })

    const overzicht = Object.entries(uitgaven)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => `- ${cat}: €${total.toFixed(2)}`)
      .join('\n')

    // Decision Engine — cashflow projectie
    const projection = await projectCashflow(user.id, supabase)

    const systemPrompt = `Jij bent Fynn, een persoonlijke financiële coach. Je bent eerlijk, direct en warm — zoals een slimme vriend die toevallig alles van geld weet. Geen jargon, geen oordeel.

FINANCIËLE DATA VAN DEZE GEBRUIKER (afgelopen periode):
Totaal inkomen: €${totaalIn.toFixed(2)}
Totaal uitgaven: €${totaalUit.toFixed(2)}
Beschikbaar (huidig saldo): €${(totaalIn - totaalUit).toFixed(2)}

Uitgaven per categorie:
${overzicht}

Abonnementen:
${abonnementenLijst}
Totaal abonnementen: €${Object.values(abonnementen).reduce((a, b) => a + b, 0).toFixed(2)}/maand

CASHFLOW PROJECTIE (gebruik dit voor beslissingsvragen):
- Vrije ruimte deze maand: €${projection.projectedFreeSpace.toFixed(0)}
- Vaste lasten per maand: €${projection.fixedExpensesThisMonth.toFixed(0)}
- Nog te betalen vaste lasten: €${projection.stillToPay.toFixed(0)}
- Salaris verwacht: dag ${projection.salaryDate} (over ${projection.daysUntilSalary} dagen)
- Risico niveau: ${projection.riskLevel === 'safe' ? 'veilig' : projection.riskLevel === 'caution' ? 'let op' : 'kritiek'}

Aantal transacties: ${transactions?.length ?? 0}

REGELS:
- Wanneer iemand vraagt "kan ik X kopen/betalen/doen?" gebruik dan ALTIJD de vrije ruimte uit de cashflow projectie — NIET het huidige saldo
- Geef concrete, eerlijke antwoorden op basis van de echte cijfers
- Maximaal 150 woorden per antwoord
- Schrijf correct Nederlands
- Geen opsommingen of bullet points — schrijf in gewone zinnen
- Als je iets niet weet, zeg dat dan eerlijk`

    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...(history ?? []),
      { role: 'user', content: message }
    ]

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages,
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''

    return NextResponse.json({ reply })

  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}