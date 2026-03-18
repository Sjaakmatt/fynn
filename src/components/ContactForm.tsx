// src/components/ContactForm.tsx
'use client'

import { useState } from 'react'

const SUBJECTS = [
  'Algemene vraag',
  'Technisch probleem',
  'Privacy & data',
  'Feedback',
  'Anders',
]

interface Props {
  email?: string
  name?: string
}

export default function ContactForm({ email = '', name = '' }: Props) {
  const [form, setForm] = useState({ name, email, subject: 'Algemene vraag', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Er ging iets mis.')
        setStatus('error')
        return
      }

      setStatus('sent')
      setForm(f => ({ ...f, message: '', subject: 'Algemene vraag' }))
    } catch {
      setErrorMsg('Kan geen verbinding maken. Probeer het later opnieuw.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: 'color-mix(in srgb, var(--brand) 15%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: 20,
            color: 'var(--brand)',
          }}
        >
          ✓
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Bericht verstuurd
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
          We reageren meestal binnen 24 uur.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="text-xs font-medium mt-3"
          style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Nog een bericht sturen
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Subject */}
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>
          Onderwerp
        </label>
        <select
          value={form.subject}
          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-xl"
          style={{
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
            appearance: 'none',
          }}
        >
          {SUBJECTS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>
          Bericht
        </label>
        <textarea
          required
          minLength={10}
          maxLength={5000}
          rows={4}
          value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          placeholder="Vertel ons hoe we je kunnen helpen..."
          className="w-full px-3 py-2 text-sm rounded-xl"
          style={{
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.6,
          }}
        />
        <p className="text-right mt-0.5" style={{ fontSize: 10, color: 'var(--muted)' }}>
          {form.message.length}/5000
        </p>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div
          className="px-3 py-2 rounded-xl text-xs"
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{
          backgroundColor: 'var(--brand)',
          color: 'white',
          border: 'none',
          cursor: status === 'sending' ? 'wait' : 'pointer',
          opacity: status === 'sending' ? 0.6 : 1,
        }}
      >
        {status === 'sending' ? 'Versturen...' : 'Verstuur bericht'}
      </button>
    </form>
  )
}