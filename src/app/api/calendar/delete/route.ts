// src/app/api/calendar/delete/route.ts
// Markeert een merchant als niet-recurring voor deze user

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { merchantKey } = await request.json()
    if (!merchantKey) return NextResponse.json({ error: 'Missing merchantKey' }, { status: 400 })

    // Sla op als user override: recurring_hint = false
    const { error } = await supabase
      .from('merchant_user_overrides')
      .upsert({
        user_id: user.id,
        merchant_key: merchantKey,
        recurring_hint: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,merchant_key' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Calendar delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}