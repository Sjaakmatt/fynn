import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectIncome } from '@/lib/detect-income'

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await detectIncome(supabase, user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('[Income] Error:', error)
    return NextResponse.json({ error: error.message ?? 'Detection failed' }, { status: 500 })
  }
}