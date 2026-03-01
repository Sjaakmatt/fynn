import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
})

// POST /api/stripe/callback
// Wordt aangeroepen nadat de gebruiker de Stripe FC modal heeft doorlopen.
// Haalt accounts en transacties op via de Stripe API en slaat ze op in Supabase.
export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'No sessionId provided' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Haal de volledige session op inclusief gekoppelde accounts
    const session = await stripe.financialConnections.sessions.retrieve(sessionId, {
      expand: ['accounts'],
    })

    const accounts = session.accounts?.data ?? []
    console.log(`[stripe/callback] ${accounts.length} accounts gevonden`)

    for (const account of accounts) {
      // ── Saldo ophalen ──────────────────────────────────────────────────
      let balance: number | null = null
      // Balance direct lezen van account object uit de session
      try {
        const cash = account.balance?.cash?.available
        if (cash) {
          const cashRecord = cash as Record<string, number>
          const eurCents = cashRecord['eur'] ?? cashRecord['EUR'] ?? Object.values(cashRecord)[0] ?? null
          balance = eurCents != null ? Number(eurCents) / 100 : null
        }
      } catch (err) {
        console.warn(`[stripe/callback] Balance lezen mislukt voor ${account.id}:`, err)
      }

      // ── Account opslaan ────────────────────────────────────────────────
      const ownershipData = account.ownership as { owners?: { data: { name?: string }[] } } | null
      const ownerName = ownershipData?.owners?.data?.[0]?.name ?? account.display_name ?? 'Rekening'

      const { data: savedAccount } = await supabase
        .from('bank_accounts')
        .upsert({
          user_id: user.id,
          stripe_account_id: account.id,
          institution_name: account.institution_name ?? 'Bank',
          account_name: ownerName,
          iban: account.last4 ? `****${account.last4}` : null,
          currency: account.balance_refresh?.last_attempted_at ? 'EUR' : 'EUR',
          account_type: account.subcategory ?? account.category ?? 'checking',
          balance,
        }, { onConflict: 'user_id, stripe_account_id' })
        .select('id')
        .single()

      if (!savedAccount) continue

      // ── Transacties ophalen ────────────────────────────────────────────
      try {
        // Subscibe voor transacties als dat nog niet is gedaan
        await stripe.financialConnections.accounts.subscribe(account.id, {
          features: ['transactions'],
        })

        // Wacht kort zodat Stripe transacties kan laden
        await new Promise(resolve => setTimeout(resolve, 2000))

        const txResponse = await stripe.financialConnections.transactions.list({
          account: account.id,
          limit: 100,
        })

        console.log(`[stripe/callback] ${txResponse.data.length} transacties voor account ${account.id}`)

        for (const tx of txResponse.data) {
          // Stripe bedragen zijn in centen, negatief = uitgave
          const amountEur = tx.amount / 100

          await supabase
            .from('transactions')
            .upsert({
              user_id: user.id,
              account_id: savedAccount.id,
              stripe_transaction_id: tx.id,
              amount: amountEur,
              currency: tx.currency.toUpperCase(),
              description: tx.description ?? '',
              category: null, // wordt ingevuld door categorisatie engine
              transaction_date: new Date(tx.transacted_at * 1000).toISOString().split('T')[0],
            }, { onConflict: 'stripe_transaction_id' })
        }
      } catch (err) {
        console.warn(`[stripe/callback] Transacties ophalen mislukt voor ${account.id}:`, err)
      }
    }

    // ── Trigger categorisatie ────────────────────────────────────────────
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/categorize`, {
      method: 'POST',
      headers: { 'Cookie': request.headers.get('cookie') ?? '' },
    })

    return NextResponse.json({
      success: true,
      accountsImported: accounts.length,
    })

  } catch (error) {
    console.error('[stripe/callback] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}