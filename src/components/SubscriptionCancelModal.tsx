// src/components/SubscriptionCancelModal.tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface Subscription {
  name: string
  amount: number
  monthlyAmount: number
  cadence: string
}

interface MerchantInfo {
  merchantKey: string
  name: string
  category: string | null
  cancelMethod: 'LINK' | 'EMAIL' | 'APP_STORE' | 'GOOGLE_PLAY' | 'PHONE' | 'MANUAL'
  cancelUrl: string | null
  cancelEmail: string | null
  cancelPhone: string | null
  requiresLogin: boolean
  difficulty: string
  instructions: string | null
  noticeDays: number
  notes: string | null
}

type Step =
  | 'loading'
  | 'not_found'
  // LINK flow
  | 'redirect'
  // EMAIL flow
  | 'reason'
  | 'details'
  | 'consent'
  | 'preview'
  | 'sending'
  // shared
  | 'done'

const REASONS = [
  'Ik gebruik het niet meer',
  'Te duur',
  'Overgestapt naar alternatief',
  'Niet tevreden over de dienst',
  'Tijdelijk niet nodig',
  'Anders',
]

const DIFFICULTY: Record<string, { label: string; color: string }> = {
  EASY: { label: 'Makkelijk', color: '#4ade80' },
  MEDIUM: { label: 'Gemiddeld', color: '#facc15' },
  HARD: { label: 'Lastig', color: '#f97316' },
  NIGHTMARE: { label: 'Moeilijk', color: '#ef4444' },
}

const inputCss: React.CSSProperties = {
  backgroundColor: 'var(--tab-bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
}

/* ─── Signature Pad ────────────────────────────────────────────────────────── */

function SignaturePad({ onChange }: { onChange: (d: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasDrawn = useRef(false)

  const pos = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const c = ref.current!
    const r = c.getBoundingClientRect()
    const sx = c.width / r.width
    const sy = c.height / r.height
    if ('touches' in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy }
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }
  }, [])

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    hasDrawn.current = true
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }, [pos])

  const move = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!drawing.current) return
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.lineTo(pos(e).x, pos(e).y)
    ctx.stroke()
  }, [pos])

  const end = useCallback(() => {
    drawing.current = false
    if (hasDrawn.current && ref.current) onChange(ref.current.toDataURL('image/png'))
  }, [onChange])

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    c.width = c.offsetWidth * 2
    c.height = c.offsetHeight * 2
    ctx.strokeStyle = '#888'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const clear = () => {
    const c = ref.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    hasDrawn.current = false
    onChange(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Handtekening</p>
        <button onClick={clear} className="text-xs" style={{ color: 'var(--brand)' }}>Wissen</button>
      </div>
      <canvas
        ref={ref}
        className="w-full rounded-xl cursor-crosshair"
        style={{ height: 100, touchAction: 'none', ...inputCss }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
    </div>
  )
}

/* ─── Input helper ─────────────────────────────────────────────────────────── */

function Input({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>{label}</p>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={inputCss}
      />
    </div>
  )
}

/* ─── Main Modal ───────────────────────────────────────────────────────────── */

export default function SubscriptionCancelModal({
  subscription,
  onClose,
}: {
  subscription: Subscription
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>('loading')
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  // Shared
  const [reason, setReason] = useState('')
  const [customReason, setCustomReason] = useState('')

  // Email flow
  const [serviceEmail, setServiceEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [street, setStreet] = useState('')
  const [postcode, setPostcode] = useState('')
  const [city, setCity] = useState('')
  const [consent, setConsent] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Auto-lookup on mount
  useEffect(() => { lookup() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function lookup() {
    try {
      const res = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionName: subscription.name, action: 'lookup' }),
      })
      if (res.status === 404) { setStep('not_found'); return }
      if (!res.ok) { setError('Kon gegevens niet laden'); return }
      const data = await res.json()
      setMerchant(data.merchant)
      setFullName(data.userName ?? '')

      // Route to correct flow
      if (data.merchant.cancelMethod === 'EMAIL') {
        setStep('reason') // EMAIL flow: reason → details → consent → preview → done
      } else {
        setStep('redirect') // LINK/APP_STORE/PHONE: redirect popup
      }
    } catch { setError('Verbindingsfout') }
  }

  const finalReason = reason === 'Anders' ? customReason : reason
  const yearly = subscription.monthlyAmount * 12
  const isEmail = merchant?.cancelMethod === 'EMAIL'

  function buildLetter() {
    if (!merchant) return
    const today = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    const notice = merchant.noticeDays > 0 ? `, met inachtneming van de opzegtermijn van ${merchant.noticeDays} dagen` : ''
    const addr = street.trim() ? `\n${street.trim()}\n${postcode.trim()} ${city.trim()}` : ''
    const birth = birthDate ? `\nGeboortedatum: ${new Date(birthDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''
    const reasonLine = finalReason ? `\nReden van opzegging: ${finalReason}` : ''

    setEditedSubject(`Opzegging abonnement ${merchant.name}`)
    setEditedBody(
`Geachte heer/mevrouw,

Hierbij zeg ik mijn abonnement bij ${merchant.name} op per eerst mogelijke datum${notice}.
${reasonLine}

Het betreft het abonnement op naam van:
${fullName.trim()}
${serviceEmail.trim()}${birth}${addr}

Graag ontvang ik een schriftelijke bevestiging van deze opzegging op bovenstaand e-mailadres.

Met vriendelijke groet,
${fullName.trim()}
${today}`)
  }

  async function send() {
    if (!merchant) return
    setStep('sending')
    setError('')
    try {
      const res = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionName: subscription.name,
          action: 'send',
          subject: editedSubject,
          body: editedBody,
          serviceEmail,
          reason: finalReason,
        }),
      })
      const data = await res.json()
      if (res.status === 409) { setError(data.message); setStep('preview'); return }
      if (!res.ok) { setError(data.error || 'Versturen mislukt'); setStep('preview'); return }
      setStep('done')
    } catch { setError('Verbindingsfout'); setStep('preview') }
  }

  async function logAndOpen() {
    if (!merchant?.cancelUrl) return
    try {
      await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionName: subscription.name, action: 'log', reason: finalReason }),
      })
    } catch { /* silent */ }
    window.open(merchant.cancelUrl, '_blank', 'noopener,noreferrer')
    setStep('done')
  }

  // Email flow progress
  const emailSteps: Step[] = ['reason', 'details', 'consent', 'preview']
  const emailIdx = emailSteps.indexOf(step)
  const detailsOk = serviceEmail.includes('@') && fullName.trim().length > 1
  const consentOk = consent && signature

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ backgroundColor: 'var(--bg)', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Abonnement opzeggen
            </p>
            <p className="text-lg font-semibold mt-1" style={{ color: 'var(--text)' }}>
              {subscription.name}
            </p>
          </div>
          <button onClick={onClose} className="mt-1 text-lg leading-none" style={{ color: 'var(--muted)' }}>✕</button>
        </div>

        {/* Progress — email flow only */}
        {isEmail && emailIdx >= 0 && (
          <div className="px-6 pb-4">
            <div className="h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  backgroundColor: 'var(--brand)',
                  width: step === 'sending' || step === 'done' ? '100%' : `${((emailIdx + 1) / emailSteps.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">

          {/* ── Loading ─────────────────────────────────────────────── */}
          {step === 'loading' && !error && (
            <div className="py-16 text-center">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent mx-auto mb-3 animate-spin"
                style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
            </div>
          )}
          {step === 'loading' && error && (
            <div className="py-16 text-center">
              <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>{error}</p>
              <button onClick={() => { setError(''); lookup() }} className="text-sm font-medium" style={{ color: 'var(--brand)' }}>Opnieuw</button>
            </div>
          )}

          {/* ── Not found ───────────────────────────────────────────── */}
          {step === 'not_found' && (
            <div className="py-16 text-center">
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                Geen opzeggegevens gevonden voor dit abonnement.
              </p>
              <button onClick={onClose} className="text-sm font-medium" style={{ color: 'var(--brand)' }}>Sluiten</button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* LINK / APP_STORE / PHONE — Redirect popup                */}
          {/* ══════════════════════════════════════════════════════════ */}
          {step === 'redirect' && merchant && (
            <div className="space-y-5">
              {/* Difficulty + savings */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DIFFICULTY[merchant.difficulty]?.color ?? 'var(--muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{DIFFICULTY[merchant.difficulty]?.label ?? merchant.difficulty}</p>
                </div>
                <p className="text-xs font-medium" style={{ color: 'var(--brand)' }}>€{yearly.toFixed(0)}/jaar besparing</p>
              </div>

              {/* Info box */}
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--tab-bg)' }}>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                  {merchant.cancelMethod === 'PHONE'
                    ? `${merchant.name} kan alleen telefonisch opgezegd worden`
                    : `Je wordt doorgestuurd naar ${merchant.name}`
                  }
                </p>
                {merchant.instructions && (
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                    {merchant.instructions}
                  </p>
                )}
              </div>

              {/* Notes */}
              {merchant.notes && (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Let op: {merchant.notes}
                </p>
              )}

              {merchant.noticeDays > 0 && (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Opzegtermijn: {merchant.noticeDays} dagen
                </p>
              )}

              {/* Action buttons */}
              {merchant.cancelMethod === 'PHONE' && merchant.cancelPhone ? (
                <a
                  href={`tel:${merchant.cancelPhone.replace(/[^0-9+]/g, '')}`}
                  className="block w-full py-3.5 rounded-xl text-sm font-semibold text-center"
                  style={{ backgroundColor: 'var(--brand)', color: 'white' }}
                >
                  Bel {merchant.cancelPhone}
                </a>
              ) : merchant.cancelUrl ? (
                <button
                  onClick={logAndOpen}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: 'var(--brand)', color: 'white' }}
                >
                  {merchant.cancelMethod === 'APP_STORE' || merchant.cancelMethod === 'GOOGLE_PLAY'
                    ? 'Open app store abonnementen'
                    : `Open ${merchant.name}`
                  }
                </button>
              ) : null}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* EMAIL FLOW — Step 1: Reden                               */}
          {/* ══════════════════════════════════════════════════════════ */}
          {step === 'reason' && merchant && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Waarom wil je opzeggen?</p>
                <p className="text-xs font-medium" style={{ color: 'var(--brand)' }}>€{yearly.toFixed(0)}/jaar besparing</p>
              </div>

              <div className="space-y-2">
                {REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
                    style={{
                      backgroundColor: reason === r ? 'color-mix(in srgb, var(--brand) 12%, transparent)' : 'var(--tab-bg)',
                      color: reason === r ? 'var(--brand)' : 'var(--text)',
                      border: reason === r ? '1px solid var(--brand)' : '1px solid transparent',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {reason === 'Anders' && (
                <input
                  type="text"
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder="Vertel ons waarom..."
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={inputCss}
                />
              )}

              {merchant.notes && (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Let op: {merchant.notes}</p>
              )}

              <button
                onClick={() => setStep('details')}
                disabled={!reason || (reason === 'Anders' && !customReason.trim())}
                className="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-30 transition-opacity"
                style={{ backgroundColor: 'var(--brand)', color: 'white' }}
              >
                Verder
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* EMAIL FLOW — Step 2: Gegevens                            */}
          {/* ══════════════════════════════════════════════════════════ */}
          {step === 'details' && merchant && (
            <div className="space-y-5">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Vul je gegevens in zoals bekend bij {merchant.name}.
              </p>
              <div className="space-y-3">
                <Input label="E-mailadres bij deze dienst *" type="email" value={serviceEmail} onChange={setServiceEmail} placeholder="jouw@email.nl" />
                <Input label="Volledige naam *" value={fullName} onChange={setFullName} placeholder="Voornaam Achternaam" />
                <Input label="Geboortedatum" type="date" value={birthDate} onChange={setBirthDate} />
                <Input label="Straat en huisnummer" value={street} onChange={setStreet} placeholder="Keizersgracht 1" />
                <div className="flex gap-3">
                  <div className="w-2/5"><Input label="Postcode" value={postcode} onChange={setPostcode} placeholder="1234 AB" /></div>
                  <div className="flex-1"><Input label="Stad" value={city} onChange={setCity} placeholder="Amsterdam" /></div>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setStep('reason')}
                  className="flex-1 py-3.5 rounded-xl text-sm"
                  style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)' }}>Terug</button>
                <button onClick={() => { buildLetter(); setStep('consent') }} disabled={!detailsOk}
                  className="flex-1 py-3.5 rounded-xl text-sm font-semibold disabled:opacity-30 transition-opacity"
                  style={{ backgroundColor: 'var(--brand)', color: 'white' }}>Verder</button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* EMAIL FLOW — Step 3: Toestemming + handtekening          */}
          {/* ══════════════════════════════════════════════════════════ */}
          {step === 'consent' && merchant && (
            <div className="space-y-6">
              <div>
                <p className="text-base font-semibold mb-2" style={{ color: 'var(--text)' }}>Toestemming</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Door te ondertekenen geef je Fynn toestemming om:</p>
              </div>
              <div className="space-y-2">
                {[
                  `Je overeenkomst met ${merchant.name} te beëindigen`,
                  `Dit namens jou per e-mail te versturen naar ${merchant.cancelEmail}`,
                ].map(t => (
                  <div key={t} className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--tab-bg)' }}>
                    <span className="text-xs mt-0.5 shrink-0" style={{ color: 'var(--brand)' }}>●</span>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>{t}</p>
                  </div>
                ))}
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded" style={{ accentColor: 'var(--brand)' }} />
                <span className="text-sm" style={{ color: 'var(--text)' }}>Ik geef toestemming</span>
              </label>
              <SignaturePad onChange={setSignature} />
              <div className="flex gap-3 pt-1">
                <button onClick={() => setStep('details')}
                  className="flex-1 py-3.5 rounded-xl text-sm"
                  style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)' }}>Terug</button>
                <button onClick={() => setStep('preview')} disabled={!consentOk}
                  className="flex-1 py-3.5 rounded-xl text-sm font-semibold disabled:opacity-30 transition-opacity"
                  style={{ backgroundColor: 'var(--brand)', color: 'white' }}>Verder</button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* EMAIL FLOW — Step 4: Brief preview                       */}
          {/* ══════════════════════════════════════════════════════════ */}
          {step === 'preview' && merchant && (
            <div className="space-y-5">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Controleer de brief en pas aan indien nodig.</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Onderwerp</p>
                  <input type="text" value={editedSubject} onChange={e => setEditedSubject(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={inputCss} />
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Brief</p>
                  <textarea value={editedBody} onChange={e => setEditedBody(e.target.value)} rows={10}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                    style={{ ...inputCss, lineHeight: 1.6 }} />
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Verstuurd naar {merchant.cancelEmail} · reply-to {serviceEmail}
              </p>
              {error && (
                <p className="text-xs rounded-xl p-3" style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)' }}>{error}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setStep('consent'); setError('') }}
                  className="flex-1 py-3.5 rounded-xl text-sm"
                  style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)' }}>Terug</button>
                <button onClick={send} disabled={!editedSubject.trim() || !editedBody.trim()}
                  className="flex-1 py-3.5 rounded-xl text-sm font-semibold disabled:opacity-30 transition-opacity"
                  style={{ backgroundColor: '#EF4444', color: 'white' }}>Versturen</button>
              </div>
            </div>
          )}

          {/* ── Sending ─────────────────────────────────────────────── */}
          {step === 'sending' && (
            <div className="py-16 text-center">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent mx-auto mb-3 animate-spin"
                style={{ borderColor: '#EF4444', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Wordt verstuurd...</p>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* DONE — shared between both flows                         */}
          {/* ══════════════════════════════════════════════════════════ */}
          {step === 'done' && merchant && (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}>
                <span className="text-xl" style={{ color: 'var(--brand)' }}>✓</span>
              </div>

              {isEmail ? (
                <>
                  <p className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>Verstuurd</p>
                  <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                    Opzegging verstuurd naar {merchant.cancelEmail}.<br />
                    Bevestiging wordt gestuurd naar {serviceEmail}.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>Opzegging gestart</p>
                  <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                    Voltooi de opzegging op de website van {merchant.name}.
                  </p>
                </>
              )}

              <p className="text-xs mb-6 font-medium" style={{ color: 'var(--brand)' }}>
                Besparing: €{yearly.toFixed(0)}/jaar
              </p>
              <button onClick={onClose} className="w-full py-3.5 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: 'var(--brand)', color: 'white' }}>Klaar</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}