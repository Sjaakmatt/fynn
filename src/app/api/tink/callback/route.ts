import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json({ error: 'No code provided' }, { status: 400 })
    }

    // Wissel code in voor access token
    const tokenResponse = await fetch('https://api.tink.com/api/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.TINK_CLIENT_ID!,
        client_secret: process.env.TINK_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
      }),
    })

    const tokens = await tokenResponse.json()
    console.log('Token response:', tokens)

    if (!tokens.access_token) {
      return NextResponse.json({ error: 'No access token' }, { status: 400 })
    }

    // Haal accounts op
    const accountsResponse = await fetch('https://api.tink.com/data/v2/accounts', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const accountsData = await accountsResponse.json()
    console.log('Accounts:', JSON.stringify(accountsData, null, 2))

    // Haal transacties op
    const transactionsResponse = await fetch(
      'https://api.tink.com/data/v2/transactions?pageSize=100',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    )
    const transactionsData = await transactionsResponse.json()
    console.log('Transactions count:', transactionsData.transactions?.length)

    // Sla op in Supabase
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Sla access token op
    await supabase.from('tink_tokens').upsert({
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
    }, { onConflict: 'user_id' })

    // Sla accounts op
    if (accountsData.accounts) {
      for (const account of accountsData.accounts) {
        await supabase.from('bank_accounts').upsert({
          user_id: user.id,
          institution_name: account.financialInstitutionId ?? 'Demo Bank',
          account_name: account.name,
          tink_account_id: account.id,
          iban: account.identifiers?.iban?.iban ?? null,
          currency: account.currencyCode ?? 'EUR',
        }, { onConflict: 'user_id, iban' })
      }
    }

    // Sla transacties op
    if (transactionsData.transactions) {
      for (const tx of transactionsData.transactions) {
        await supabase.from('transactions').upsert({
          user_id: user.id,
          account_id: null,
          amount: tx.amount?.value?.unscaledValue / Math.pow(10, tx.amount?.value?.scale ?? 0),
          currency: tx.amount?.currencyCode ?? 'EUR',
          description: tx.descriptions?.display ?? tx.descriptions?.original ?? '',
          category: null,
          transaction_date: tx.dates?.booked ?? tx.dates?.value,
          tink_transaction_id: tx.id,
        }, { onConflict: 'tink_transaction_id' })
      }
    }

    // Trigger categorisatie  ← HIER, niet in catch
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/categorize`, {
      method: 'POST',
      headers: { 
        'Cookie': request.headers.get('cookie') ?? '' 
      }
    })

    return NextResponse.json({ success: true })  // ← dan pas return

  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}