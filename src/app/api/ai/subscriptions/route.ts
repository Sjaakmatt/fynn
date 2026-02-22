import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: transactions } = await supabase
      .from('transactions')
      .select('description, amount, transaction_date, category')
      .eq('user_id', user.id)
      .eq('category', 'abonnementen')
      .order('transaction_date', { ascending: false })

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ subscriptions: [] })
    }

    // Groepeer per beschrijving
    const grouped: Record<string, { amount: number; dates: string[] }> = {}

    transactions.forEach(tx => {
      const key = tx.description.toLowerCase()
      if (!grouped[key]) grouped[key] = { amount: Math.abs(parseFloat(tx.amount)), dates: [] }
      grouped[key].dates.push(tx.transaction_date)
    })

    const subscriptions = Object.entries(grouped).map(([key, data]) => ({
      name: transactions.find(t => t.description.toLowerCase() === key)?.description ?? key,
      amount: data.amount,
      occurrences: data.dates.length,
      lastDate: data.dates[0],
    }))

    return NextResponse.json({ subscriptions })

  } catch (error) {
    console.error('Subscriptions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}