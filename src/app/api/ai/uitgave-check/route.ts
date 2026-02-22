import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { bedrag, omschrijving } = await request.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: transactions } = await supabase
      .from('transactions')
      .select('description, amount, category, transaction_date')
      .eq('user_id', user.id)
      .not('category', 'is', null)
      .order('transaction_date', { ascending: false })
      .limit(100)

    let totaalUit = 0
    let totaalIn = 0
    let gespaard = 0

    transactions?.forEach(tx => {
      const amount = parseFloat(tx.amount)
      if (amount < 0) {
        if (tx.category === 'sparen') gespaard += Math.abs(amount)
        else totaalUit += Math.abs(amount)
      } else {
        totaalIn += amount
      }
    })

    const beschikbaar = totaalIn - totaalUit - gespaard

    const prompt = `Jij bent Fynn, een persoonlijke financiële coach. Eerlijk, direct, warm.

FINANCIËLE SITUATIE:
Inkomen: €${totaalIn.toFixed(2)}
Uitgaven: €${totaalUit.toFixed(2)}
Gespaard: €${gespaard.toFixed(2)}
Beschikbaar: €${beschikbaar.toFixed(2)}

VRAAG: Kan ik €${bedrag} uitgeven aan ${omschrijving || 'dit'}?

Geef een eerlijk antwoord in maximaal 80 woorden. Begin met een duidelijk JA of NEE (of "Ja, maar..." / "Nee, tenzij..."). Gebruik de echte cijfers. 

REGELS:
- Schrijf correct Nederlands zonder spelfouten
- Geen bullet points — schrijf in lopende zinnen
- Geen vetgedrukte tekst
- Gebruik "deze maand" niet "dit maand"
- Maximaal 80 woorden`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    })

    const advies = message.content[0].type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ advies, beschikbaar })

  } catch (error) {
    console.error('Uitgave check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}