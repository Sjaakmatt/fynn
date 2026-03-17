import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectRecurring } from '@/lib/detect-recurring'

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await detectRecurring(supabase, user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Recurring] Error:', error)
    return NextResponse.json({ error: error.message ?? 'Detection failed' }, { status: 500 })
  }
}