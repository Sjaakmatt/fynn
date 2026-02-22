import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
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

    let totalInkomen = 0
    const uitgavenPerCategorie: Record<string, number> = {}

    transactions?.forEach(tx => {
      const amount = parseFloat(tx.amount)
      if (amount > 0) {
        totalInkomen += amount
      } else {
        const cat = tx.category ?? 'overig'
        uitgavenPerCategorie[cat] = (uitgavenPerCategorie[cat] ?? 0) + Math.abs(amount)
      }
    })

    const historieString = Object.entries(uitgavenPerCategorie)
      .map(([cat, total]) => `${cat}: €${total.toFixed(2)}`)
      .join('\n')

    const prompt = `Jij bent Fynn, een persoonlijke financiële coach. 

Analyseer deze financiële data en maak een realistisch maandbudget.

Maandinkomen: €${totalInkomen.toFixed(2)}
Huidige uitgaven per categorie (afgelopen periode):
${historieString}

Maak een persoonlijk maandbudget als JSON array. Gebruik deze categorieën waar van toepassing: wonen, boodschappen, eten & drinken, transport, abonnementen, kleding, gezondheid, entertainment, sparen, beleggen, overig.

Regels:
- Budgetten moeten realistisch zijn gebaseerd op de historische uitgaven
- Sparen moet minimaal 10% van inkomen zijn
- Beleggen alleen toevoegen als er ruimte is
- Totaal mag inkomen niet overschrijden
- Schrijf correct Nederlands
- Geef alleen de JSON array terug, niets anders

Format:
[
  {"category": "wonen", "budget": 800, "icon": "🏠", "tip": "Korte tip voor deze categorie"},
  ...
]`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
    
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Kon budget niet genereren' }, { status: 500 })
    }

    const categories = JSON.parse(jsonMatch[0])

    await supabase.from('budgets').upsert({
      user_id: user.id,
      categories,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return NextResponse.json({ success: true, categories, totalInkomen })

  } catch (error) {
    console.error('Budget POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('Budget GET aangeroepen')
    const supabase = await createClient()
    console.log('Supabase client aangemaakt')
    const { data: { user } } = await supabase.auth.getUser()
    console.log('User:', user?.id ?? 'null')

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    console.log('Start of month:', startOfMonth)

    const { data: budget } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, category, transaction_date')
      .eq('user_id', user.id)
      .not('category', 'is', null)
      .gte('transaction_date', startOfMonth)

    console.log('Transactions count:', transactions?.length)

    const uitgavenDezeMaand: Record<string, number> = {}
    transactions?.forEach(tx => {
      const amount = parseFloat(tx.amount)
      if (amount < 0) {
        const cat = tx.category ?? 'overig'
        uitgavenDezeMaand[cat] = (uitgavenDezeMaand[cat] ?? 0) + Math.abs(amount)
      }
    })

    console.log('Uitgaven deze maand:', JSON.stringify(uitgavenDezeMaand))

    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('amount, category')
      .eq('user_id', user.id)
      .not('category', 'is', null)

    let totalInkomen = 0
    allTransactions?.forEach(tx => {
      const amount = parseFloat(tx.amount)
      if (amount > 0) totalInkomen += amount
    })

    console.log('Total inkomen:', totalInkomen)

    return NextResponse.json({ budget, uitgavenDezeMaand, totalInkomen })

  } catch (error) {
    console.error('Budget GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { categories } = await request.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await supabase.from('budgets').upsert({
      user_id: user.id,
      categories,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Budget PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}