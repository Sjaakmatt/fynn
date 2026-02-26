import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { transactionId, category } = await request.json()
    if (!transactionId || !category) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Haal description op voor de override regel
    const { data: tx } = await supabase
      .from('transactions')
      .select('description')
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .single()

    // Update de transactie
    await supabase
      .from('transactions')
      .update({ category })
      .eq('id', transactionId)
      .eq('user_id', user.id)

    // Sla override op zodat toekomstige transacties automatisch correct zijn
    if (tx?.description) {
      const pattern = tx.description.toLowerCase().replace(/'/g, '').trim()
      await supabase.from('category_overrides').upsert({
        user_id: user.id,
        description_pattern: pattern,
        category,
      }, { onConflict: 'user_id,description_pattern' })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Override error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}