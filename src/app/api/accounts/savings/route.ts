// src/app/api/accounts/savings/route.ts
// Slaat een handmatig ingevoerd spaarsaldo op als bank_accounts record met provider 'manual'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, balance, iban } = body

    if (!name || balance === undefined || balance === null) {
      return NextResponse.json({ error: 'name en balance zijn verplicht' }, { status: 400 })
    }

    const balanceNum = parseFloat(balance)
    if (isNaN(balanceNum) || balanceNum < 0) {
      return NextResponse.json({ error: 'Ongeldig saldo' }, { status: 400 })
    }

    // Check of er al een manual savings account is met dit IBAN
    if (iban) {
      const { data: existing } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('iban', iban)
        .eq('provider', 'manual')
        .maybeSingle()

      if (existing) {
        const { error: updErr } = await supabase
          .from('bank_accounts')
          .update({ balance: balanceNum, account_name: name, updated_at: new Date().toISOString() })
          .eq('id', existing.id)

        if (updErr) throw updErr
        return NextResponse.json({ success: true, action: 'updated' })
      }
    }

    // Nieuw handmatig spaarsaldo account aanmaken
    const { error } = await supabase.from('bank_accounts').insert({
      user_id: user.id,
      institution_name: 'Handmatig',
      account_name: name,
      iban: iban ?? null,
      currency: 'EUR',
      provider: 'manual',
      external_id: `manual_${crypto.randomUUID()}`,
      balance: balanceNum,
      account_type: 'SAVINGS',
    })

    if (error) throw error

    return NextResponse.json({ success: true, action: 'created' })
  } catch (error) {
    console.error('Savings account error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: accounts } = await supabase
      .from('bank_accounts')
      .select('id, account_name, iban, balance')
      .eq('user_id', user.id)
      .eq('provider', 'manual')
      .eq('account_type', 'SAVINGS')

    return NextResponse.json({ accounts: accounts ?? [] })
  } catch (error) {
    console.error('Get savings accounts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}