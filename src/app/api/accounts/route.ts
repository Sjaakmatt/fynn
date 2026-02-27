import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET /api/accounts ────────────────────────────────────────────────────────
// Geeft alle bank_accounts terug voor de ingelogde user.
// Gebruikt door client-side components die accounts nodig hebben zonder server-side props.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: accounts, error } = await supabase
      .from('bank_accounts')
      .select('id, account_name, iban, balance, account_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[accounts GET]', error)
      return NextResponse.json({ error: 'Database fout' }, { status: 500 })
    }

    return NextResponse.json({ accounts: accounts ?? [] })
  } catch (error) {
    console.error('[accounts GET] unexpected:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}