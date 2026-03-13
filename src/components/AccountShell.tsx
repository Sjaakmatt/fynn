// src/components/AccountShell.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from './ThemeToggle'
import MFASettings from './mfa/Mfasettings'

interface Props {
  user: {
    id: string
    email: string
    fullName: string | null
  }
  subscription: {
    status: string | null
    trialEndsAt: string | null
    hasStripe: boolean
  }
  accounts: {
    id: string
    account_name: string
    iban: string
    balance?: number | null
    account_type: string
    created_at: string
  }[]
}

export default function AccountShell({ user, subscription, accounts }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState(user.fullName ?? '')
  const [editingName, setEditingName] = useState(false)
  const [saving, setSaving] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const initials = (user.fullName ?? user.email)
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('')

  // ── Handlers ──────────────────────────────────────────────────

  async function handleSaveName() {
    const trimmed = fullName.trim()
    if (!trimmed) return
    setSaving(true)
    await supabase.from('profiles').update({ full_name: trimmed }).eq('id', user.id)
    await supabase.auth.updateUser({ data: { full_name: trimmed } })
    setSaving(false)
    setEditingName(false)
  }

  async function handleManageSubscription() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setPortalLoading(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      await fetch('/api/account/delete', { method: 'DELETE' })
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      setDeleting(false)
    }
  }

  // ── Badge ─────────────────────────────────────────────────────

  function getBadge(): { label: string; color: string } {
    switch (subscription.status) {
      case 'active':
        return { label: 'Pro', color: '#4ade80' }
      case 'trialing': {
        const d = subscription.trialEndsAt
          ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86400000))
          : 0
        return { label: `Trial · ${d}d`, color: '#F59E0B' }
      }
      case 'past_due':
        return { label: 'Betaling mislukt', color: '#EF4444' }
      default:
        return { label: 'Free', color: 'var(--muted)' }
    }
  }

  const badge = getBadge()

  function maskIban(iban: string | null) {
    if (!iban) return '····'
    if (iban.length <= 8) return iban
    return `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`
  }

  return (
    <div className="min-h-screen transition-colors" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-20 border-b transition-colors"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--text)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
            </svg>
            Account
          </button>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* ── Profiel hero ───────────────────────────────────────── */}
        <Card>
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-xl font-bold text-white select-none"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              {initials}
            </div>

            {editingName ? (
              <div className="flex items-center gap-2 max-w-xs mx-auto mb-1">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoFocus
                  maxLength={50}
                  className="flex-1 px-4 py-2 text-sm text-center rounded-xl outline-none"
                  style={{
                    backgroundColor: 'var(--tab-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') { setEditingName(false); setFullName(user.fullName ?? '') }
                  }}
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving || !fullName.trim()}
                  className="px-3 py-2 text-xs font-semibold text-white rounded-xl disabled:opacity-30 transition-opacity"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  {saving ? '…' : '✓'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-base font-semibold mb-0.5 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text)' }}
              >
                {user.fullName || 'Naam instellen'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline ml-1.5 opacity-40">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}

            <p className="text-xs" style={{ color: 'var(--muted)' }}>{user.email}</p>

            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-xl text-xs font-medium mt-3"
              style={{
                backgroundColor: `color-mix(in srgb, ${badge.color} 10%, transparent)`,
                color: badge.color,
                border: `1px solid color-mix(in srgb, ${badge.color} 25%, transparent)`,
              }}
            >
              {badge.label}
            </span>
          </div>
        </Card>

        {/* ── Abonnement ─────────────────────────────────────────── */}
        <Card>
          <Row
            icon={<CreditCardIcon />}
            label={
              subscription.status === 'active' ? 'Fynn Pro'
              : subscription.status === 'trialing' ? 'Fynn Pro (Trial)'
              : 'Fynn Free'
            }
            sublabel={
              subscription.status === 'active' ? '€12,99/maand'
              : subscription.status === 'trialing' ? 'Trial actief'
              : 'Beperkte functies'
            }
            action={
              subscription.hasStripe ? (
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="px-3 py-1.5 text-xs rounded-xl transition-opacity disabled:opacity-30"
                  style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  {portalLoading ? '…' : 'Beheren'}
                </button>
              ) : (
                <button
                  onClick={() => router.push('/pricing')}
                  className="px-3 py-1.5 text-xs font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  Upgraden
                </button>
              )
            }
          />
        </Card>

        {/* ── Beveiliging ────────────────────────────────────────── */}
        <Section label="Beveiliging">
          <MFASettings />
        </Section>

        {/* ── Gekoppelde rekeningen ───────────────────────────────── */}
        {accounts.length > 0 && (
          <Section label="Gekoppelde rekeningen">
            <Card>
              {accounts.map((acc, i) => (
                <div key={acc.id}>
                  {i > 0 && <Divider />}
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base shrink-0">
                        {acc.account_type === 'SAVINGS' ? '💰' : '🏦'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text)' }}>
                          {acc.account_name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          {maskIban(acc.iban)}
                        </p>
                      </div>
                    </div>
                    {acc.balance != null && (
                      <span
                        className="text-sm font-semibold tabular-nums shrink-0 ml-3"
                        style={{ color: 'var(--text)' }}
                      >
                        €{Number(acc.balance).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          </Section>
        )}

        {/* ── Voorkeuren ─────────────────────────────────────────── */}
        <Section label="Voorkeuren">
          <Card>
            <Row
              icon={<ThemeIcon />}
              label="Weergave"
              sublabel="Donker of licht thema"
              action={<ThemeToggle />}
            />
          </Card>
        </Section>

        {/* ── Links ──────────────────────────────────────────────── */}
        <Card>
          <LinkRow href="/privacy" label="Privacybeleid" />
          <Divider />
          <LinkRow href="/terms" label="Algemene voorwaarden" />
        </Card>

        {/* ── Uitloggen ──────────────────────────────────────────── */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full py-3.5 text-sm font-semibold rounded-2xl transition-opacity disabled:opacity-30"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            color: '#EF4444',
          }}
        >
          {loggingOut ? 'Uitloggen…' : 'Uitloggen'}
        </button>

        {/* ── Danger zone ────────────────────────────────────────── */}
        <div className="pt-2 pb-10">
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="w-full text-center text-xs py-2 transition-opacity hover:opacity-70"
              style={{ color: 'var(--muted)' }}
            >
              Account verwijderen
            </button>
          ) : (
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{
                backgroundColor: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>
                Weet je het zeker?
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Al je data wordt permanent verwijderd — transacties, bankrekeningen, coaching.
                Dit kan niet ongedaan worden gemaakt.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 py-3.5 text-xs rounded-xl transition-opacity"
                  style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)' }}
                >
                  Annuleren
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-3.5 text-xs font-semibold rounded-xl text-white disabled:opacity-30 transition-opacity"
                  style={{ backgroundColor: '#EF4444' }}
                >
                  {deleting ? 'Bezig…' : 'Definitief verwijderen'}
                </button>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}

// ── Herbruikbare bouwblokken ──────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5 transition-colors"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {children}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="text-xs uppercase tracking-wider px-1 mb-2"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

function Divider() {
  return <div style={{ borderTop: '1px solid var(--border)', margin: '0 -20px' }} />
}

function Row({ icon, label, sublabel, action }: {
  icon: React.ReactNode
  label: string
  sublabel?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="shrink-0" style={{ color: 'var(--muted)' }}>{icon}</span>
        <div className="min-w-0">
          <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{label}</p>
          {sublabel && <p className="text-xs" style={{ color: 'var(--muted)' }}>{sublabel}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between py-2 transition-opacity hover:opacity-70"
    >
      <span className="text-sm" style={{ color: 'var(--text)' }}>{label}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)' }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </a>
  )
}

// ── Icons ────────────────────────────────────────────────────────

function CreditCardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function ThemeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}