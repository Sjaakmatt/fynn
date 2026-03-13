// src/app/api/subscriptions/cancel/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = 'annuleren@meetfynn.nl'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const { subscriptionName, action } = body

    if (!subscriptionName || typeof subscriptionName !== 'string') {
      return NextResponse.json({ error: 'Abonnementsnaam is verplicht' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const userName = profile?.full_name || user.user_metadata?.full_name || ''
    const userEmail = profile?.email || user.email || ''

    // ── Lookup merchant ───────────────────────────────────────────────────
    const searchKey = subscriptionName.toLowerCase().trim()

    let { data: merchant } = await supabase
      .from('merchant_cancellations')
      .select('*')
      .eq('merchant_key', searchKey)
      .single()

    if (!merchant) {
      const { data: fuzzy } = await supabase
        .from('merchant_cancellations')
        .select('*')
        .ilike('merchant_name', `%${searchKey}%`)
        .limit(1)
      merchant = fuzzy?.[0] ?? null
    }

    if (!merchant) {
      return NextResponse.json({
        error: 'provider_not_found',
        message: `Geen opzeggegevens gevonden voor "${subscriptionName}".`,
      }, { status: 404 })
    }

    // ── ACTION: lookup ────────────────────────────────────────────────────
    if (action === 'lookup') {
      return NextResponse.json({
        merchant: {
          merchantKey: merchant.merchant_key,
          name: merchant.merchant_name,
          category: merchant.category,
          cancelMethod: merchant.cancel_method,
          cancelUrl: merchant.cancel_url,
          cancelEmail: merchant.cancel_email,
          cancelPhone: merchant.cancel_phone,
          requiresLogin: merchant.requires_login,
          difficulty: merchant.difficulty,
          instructions: merchant.instructions,
          noticeDays: merchant.notice_days,
          notes: merchant.notes,
        },
        userName,
        userEmail,
      })
    }

    // ── ACTION: send (EMAIL method — via Resend) ──────────────────────────
    if (action === 'send') {
      if (merchant.cancel_method !== 'EMAIL') {
        return NextResponse.json({ error: 'Dit abonnement wordt niet via email opgezegd' }, { status: 400 })
      }

      const { subject, body: emailBody, serviceEmail, reason } = body

      if (!subject || !emailBody || !merchant.cancel_email) {
        return NextResponse.json({ error: 'Onderwerp, inhoud en ontvanger zijn verplicht' }, { status: 400 })
      }

      const replyToEmail = serviceEmail?.includes('@') ? serviceEmail : userEmail

      // 24h dedup
      const { data: existing } = await supabase
        .from('subscription_cancellations')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider_key', merchant.merchant_key)
        .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json({
          error: 'already_sent',
          message: 'Er is al een opzegging verstuurd in de afgelopen 24 uur.',
        }, { status: 409 })
      }

      const senderName = userName || 'Gebruiker'
      const { data: emailResult, error: emailError } = await resend.emails.send({
        from: `${senderName} via Fynn <${FROM_EMAIL}>`,
        to: [merchant.cancel_email],
        replyTo: replyToEmail,
        subject,
        text: emailBody,
      })

      if (emailError) {
        console.error('Resend error:', emailError)
        return NextResponse.json({ error: 'Email kon niet verstuurd worden' }, { status: 500 })
      }

      await supabase.from('subscription_cancellations').insert({
        user_id: user.id,
        provider_key: merchant.merchant_key,
        provider_name: merchant.merchant_name,
        cancel_method: 'EMAIL',
        cancel_email: merchant.cancel_email,
        subject,
        reason: reason || null,
        sent_at: new Date().toISOString(),
        resend_id: emailResult?.id ?? null,
      })

      return NextResponse.json({
        success: true,
        message: `Opzegging verstuurd naar ${merchant.cancel_email}`,
      })
    }

    // ── ACTION: log (for LINK/APP_STORE — track user action) ──────────────
    if (action === 'log') {
      const { reason } = body
      await supabase.from('subscription_cancellations').insert({
        user_id: user.id,
        provider_key: merchant.merchant_key,
        provider_name: merchant.merchant_name,
        cancel_method: merchant.cancel_method,
        reason: reason || null,
        sent_at: new Date().toISOString(),
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 })
  } catch (err) {
    console.error('Cancel error:', err)
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}