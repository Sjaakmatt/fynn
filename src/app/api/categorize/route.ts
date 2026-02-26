import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { categorizeTransaction } from '@/lib/categorize-engine'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Haal user-specifieke overrides op
    const { data: overrides } = await supabase
      .from('category_overrides')
      .select('description_pattern, category')
      .eq('user_id', user.id)

    const overrideMap: Record<string, string> = {}
    overrides?.forEach(o => { overrideMap[o.description_pattern] = o.category })

    // Haal ongecategoriseerde transacties op
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id, description, amount')
      .eq('user_id', user.id)
      .is('category', null)

    if (error) throw error

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ message: 'Geen transacties om te categoriseren', categorized: 0 })
    }

    // Override eerst, dan rule-based engine als fallback
    const categorized = transactions.map(tx => {
      const pattern = tx.description.toLowerCase().replace(/'/g, '').trim()
      const category = overrideMap[pattern] ?? categorizeTransaction(tx.description, tx.amount)
      return { id: tx.id, category }
    })

    // Batch update
    await Promise.all(
      categorized.map(item =>
        supabase
          .from('transactions')
          .update({ category: item.category })
          .eq('id', item.id)
          .eq('user_id', user.id)
      )
    )

    return NextResponse.json({
      success: true,
      categorized: categorized.length,
    })

  } catch (error) {
    console.error('Categorize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}