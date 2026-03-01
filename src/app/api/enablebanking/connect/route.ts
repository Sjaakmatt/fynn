import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ebFetch } from '@/lib/enablebanking'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const bankName = searchParams.get('bank') ?? 'Rabobank'
    const bankCountry = searchParams.get('country') ?? 'NL'

    const validUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    const state = `${user.id}::${Date.now()}`

    const body = {
      access: {
        balances: true,
        transactions: true,
        valid_until: validUntil,
      },
      aspsp: {
        name: bankName,
        country: bankCountry,
      },
      state,
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/enablebanking/callback`,
      psu_type: 'personal',
    }

    const data = await ebFetch('/auth', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    return NextResponse.redirect(data.url)
  } catch (error) {
    console.error('Enable Banking connect error:', error)
    return NextResponse.json({ error: 'Failed to start bank connection' }, { status: 500 })
  }
}