import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { projectCashflow, detectRecurringItems } from '@/lib/decision-engine'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [projection, recurring] = await Promise.all([
      projectCashflow(user.id, supabase),
      detectRecurringItems(user.id, supabase),
    ])

    // Haal opgeslagen signalen op
    const { data: events } = await supabase
      .from('cashflow_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({ projection, recurring, events: events ?? [] })
  } catch (error) {
    console.error('Engine error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}