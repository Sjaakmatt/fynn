import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Haal transacties op van afgelopen 30 dagen
    const dertigDagenGeleden = new Date()
    dertigDagenGeleden.setDate(dertigDagenGeleden.getDate() - 30)

    const { data: transactions } = await supabase
      .from('transactions')
      .select('description, amount, category, transaction_date')
      .eq('user_id', user.id)
      .not('category', 'is', null)
      .gte('transaction_date', dertigDagenGeleden.toISOString().split('T')[0])
      .order('transaction_date', { ascending: false })

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ error: 'Geen transacties gevonden' }, { status: 400 })
    }

    // Bereken statistieken
    const uitgaven: Record<string, number> = {}
    let totaalUit = 0
    let totaalIn = 0

    transactions.forEach(tx => {
      const amount = parseFloat(tx.amount)
      if (amount < 0) {
        const cat = tx.category ?? 'overig'
        uitgaven[cat] = (uitgaven[cat] ?? 0) + Math.abs(amount)
        if (cat !== 'sparen') totaalUit += Math.abs(amount)
      } else {
        totaalIn += amount
      }
    })

    const topCategorieen = Object.entries(uitgaven)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat, total]) => `${cat}: €${total.toFixed(2)}`)
      .join(', ')

    const spaarbedrag = uitgaven['sparen'] ?? 0
    const spaarkans = totaalIn > 0 ? ((spaarbedrag / totaalIn) * 100).toFixed(1) : '0'

    const prompt = `Jij bent Fynn, een persoonlijke financiële coach. Je toon is die van een slimme, eerlijke vriend — geen bank, geen jargon, geen oordeel. Direct, warm, motiverend.

Schrijf een wekelijkse financiële briefing van maximaal 280 woorden op basis van deze data:

Periode: afgelopen 30 dagen
Totaal uitgegeven: €${totaalUit.toFixed(2)}
Totaal inkomen: €${totaalIn.toFixed(2)}
Gespaard: €${spaarbedrag.toFixed(2)} (${spaarkans}% van inkomen)
Top uitgaven: ${topCategorieen}
Aantal transacties: ${transactions.length}

Regels:
- Begin NIET met een # of markdown kopje
- Geen markdown opmaak
- Scheid alinea's met een witregel
- Schrijf correct Nederlands — gebruik "deze maand" niet "dit maand"
- Geen kopjes of titels in de briefing, alleen lopende tekst
- Begin NIET met "Hallo" of een begroeting
- Begin direct met een observatie of inzicht
- Noem minimaal 1 concrete positief punt
- Noem minimaal 1 concreet verbeterpunt met een specifieke actie
- Eindig met één motiverende zin
- Gebruik geen bullet points — schrijf in alinea's
- Maximaal 280 woorden`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })

    const briefing = message.content[0].type === 'text' ? message.content[0].text : ''

    // Sla op in Supabase
    await supabase.from('briefings').upsert({
      user_id: user.id,
      content: briefing,
      totaal_uitgaven: totaalUit,
      totaal_inkomen: totaalIn,
      gespaard: spaarbedrag,
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return NextResponse.json({ success: true, briefing })

  } catch (error) {
    console.error('Briefing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}