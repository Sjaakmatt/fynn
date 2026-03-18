// src/app/(marketing)/contact/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

const SUBJECTS = [
  'Algemene vraag',
  'Beta programma',
  'Technisch probleem',
  'Privacy & data',
  'Samenwerking',
  'Anders',
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: 'Algemene vraag', message: '' })
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
      setForm({ name: '', email: '', subject: 'Algemene vraag', message: '' })
    } catch {
      setErrorMsg('Kan geen verbinding maken. Probeer het later opnieuw.')
      setStatus('error')
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg, #ffffff)' }}>
      {/* Nav */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: '1px solid var(--border, #e5e7eb)',
          backgroundColor: 'var(--bg, #ffffff)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <img src="/logo-light.png" alt="Fynn" className="logo-light" style={{ height: 40, width: 'auto' }} />
            <img src="/logo.png" alt="Fynn" className="logo-dark" style={{ height: 40, width: 'auto' }} />
          </Link>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link href="/beta" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text, #1a1a1a)', textDecoration: 'none' }}>
              Beta
            </Link>
            <Link
              href="/login"
              style={{
                fontSize: 14,
                fontWeight: 600,
                padding: '8px 20px',
                borderRadius: 12,
                backgroundColor: 'var(--brand, #1A3A2A)',
                color: 'white',
                textDecoration: 'none',
              }}
            >
              Inloggen
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '64px 24px 40px' }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: 'var(--text, #1a1a1a)',
            marginBottom: 8,
          }}
        >
          Contact
        </h1>
        <p style={{ fontSize: 16, color: 'var(--muted, #6b7280)', lineHeight: 1.6 }}>
          Heb je een vraag, opmerking of wil je samenwerken? Stuur ons een bericht en we reageren zo snel mogelijk.
        </p>
      </div>

      {/* Form */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 24px 80px' }}>
        {status === 'sent' ? (
          <div
            style={{
              padding: 32,
              borderRadius: 16,
              backgroundColor: 'var(--surface, #f9fafb)',
              border: '1px solid var(--border, #e5e7eb)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text, #1a1a1a)', marginBottom: 8 }}>
              Bericht verstuurd
            </h2>
            <p style={{ fontSize: 14, color: 'var(--muted, #6b7280)', lineHeight: 1.6 }}>
              Bedankt voor je bericht. We reageren meestal binnen 24 uur.
            </p>
            <button
              onClick={() => setStatus('idle')}
              style={{
                marginTop: 24,
                padding: '10px 24px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                backgroundColor: 'var(--brand, #1A3A2A)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Nog een bericht sturen
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Name */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text, #1a1a1a)' }}>
                Naam
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Je naam"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--border, #e5e7eb)',
                  backgroundColor: 'var(--surface, #f9fafb)',
                  color: 'var(--text, #1a1a1a)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text, #1a1a1a)' }}>
                E-mail <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="je@email.nl"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--border, #e5e7eb)',
                  backgroundColor: 'var(--surface, #f9fafb)',
                  color: 'var(--text, #1a1a1a)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Subject */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text, #1a1a1a)' }}>
                Onderwerp
              </label>
              <select
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--border, #e5e7eb)',
                  backgroundColor: 'var(--surface, #f9fafb)',
                  color: 'var(--text, #1a1a1a)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
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
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text, #1a1a1a)' }}>
                Bericht <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                required
                minLength={10}
                maxLength={5000}
                rows={6}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Vertel ons hoe we je kunnen helpen..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--border, #e5e7eb)',
                  backgroundColor: 'var(--surface, #f9fafb)',
                  color: 'var(--text, #1a1a1a)',
                  fontSize: 14,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  lineHeight: 1.6,
                }}
              />
              <p style={{ fontSize: 11, color: 'var(--muted, #9ca3af)', marginTop: 4, textAlign: 'right' }}>
                {form.message.length}/5000
              </p>
            </div>

            {/* Error */}
            {status === 'error' && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: 13,
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === 'sending'}
              style={{
                padding: '14px 24px',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                backgroundColor: 'var(--brand, #1A3A2A)',
                color: 'white',
                border: 'none',
                cursor: status === 'sending' ? 'wait' : 'pointer',
                opacity: status === 'sending' ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {status === 'sending' ? 'Versturen...' : 'Verstuur bericht'}
            </button>

            {/* Info */}
            <p style={{ fontSize: 12, color: 'var(--muted, #9ca3af)', lineHeight: 1.6 }}>
              Je kunt ons ook direct mailen op{' '}
              <a href="mailto:info@meetfynn.nl" style={{ color: 'var(--brand, #1A3A2A)', fontWeight: 500 }}>
                info@meetfynn.nl
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}