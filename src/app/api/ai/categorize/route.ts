import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

const CATEGORIES = [
  'wonen',
  'boodschappen', 
  'eten & drinken',
  'transport',
  'abonnementen',
  'kleding',
  'gezondheid',
  'entertainment',
  'sparen',
  'inkomen',
  'overig'
]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Haal ongecategoriseerde transacties op
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, description, amount')
      .eq('user_id', user.id)
      .is('category', null)
      .limit(50)

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ message: 'Geen transacties om te categoriseren' })
    }

    // Stuur naar Claude
    const prompt = `Categoriseer deze bankttransacties. Geef alleen een JSON array terug, niets anders.

Beschikbare categorieën: ${CATEGORIES.join(', ')}

Transacties:
${transactions.map(t => `{"id": "${t.id}", "description": "${t.description}", "amount": ${t.amount}}`).join('\n')}

Geef terug als JSON array:
[{"id": "...", "category": "..."}, ...]`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096, // was 1024
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    // Strip markdown code blocks
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log('JSON match failed') // ← EN DIT
      return NextResponse.json({ error: 'Kon JSON niet parsen' }, { status: 500 })
    }
    
    const categorized: { id: string; category: string }[] = JSON.parse(jsonMatch[0])

    // Sla op in Supabase
    for (const item of categorized) {
      await supabase
        .from('transactions')
        .update({ category: item.category })
        .eq('id', item.id)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ 
      success: true, 
      categorized: categorized.length 
    })

  } catch (error) {
    console.error('Categorize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}