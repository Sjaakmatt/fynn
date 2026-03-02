'use client'

// src/components/SavingsSetup.tsx
// Toont na bank koppelen. Detecteert automatisch spaaroverschrijvingen
// en vraagt de gebruiker zijn spaarsaldo in te vullen.

import { useState, useEffect } from 'react'

interface DetectedSavings {
  iban: string
  name: string
  monthlyAmount: number
}

interface SavingsAccount {
  iban: string
  name: string
  balance: string  // string voor het input veld
  detected: boolean
}

interface Props {
  onComplete: () => void
}

export default function SavingsSetup({ onComplete }: Props) {
  const [detected, setDetected] = useState<DetectedSavings[]>([])
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    detectSavingsTransfers()
  }, [])

  async function detectSavingsTransfers() {
    try {
      // Haal transacties op en detecteer periodieke overboekingen
      const res = await fetch('/api/savings/detect')
      if (!res.ok) throw new Error()
      const data = await res.json()

      const detectedAccounts: DetectedSavings[] = data.savings ?? []
      setDetected(detectedAccounts)

      // Zet ze klaar als invoervelden
      setAccounts(detectedAccounts.map(d => ({
        iban: d.iban,
        name: d.name,
        balance: '',
        detected: true,
      })))
    } catch {
      // Als detectie mislukt, toon lege invulvelden
      setAccounts([{ iban: '', name: 'Mijn spaarrekening', balance: '', detected: false }])
    } finally {
      setLoading(false)
    }
  }

  function addAccount() {
    setAccounts(prev => [...prev, { iban: '', name: 'Spaarrekening', balance: '', detected: false }])
  }

  function removeAccount(index: number) {
    setAccounts(prev => prev.filter((_, i) => i !== index))
  }

  function updateAccount(index: number, field: keyof SavingsAccount, value: string) {
    setAccounts(prev => prev.map((acc, i) => i === index ? { ...acc, [field]: value } : acc))
  }

  async function handleSave() {
    setError('')
    const toSave = accounts.filter(a => a.balance !== '' && parseFloat(a.balance) >= 0)

    if (toSave.length === 0) {
      // Geen saldo ingevuld — gewoon doorgaan
      onComplete()
      return
    }

    setSaving(true)
    try {
      await Promise.all(toSave.map(acc =>
        fetch('/api/accounts/savings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: acc.name,
            balance: parseFloat(acc.balance),
            iban: acc.iban || null,
          }),
        })
      ))
      onComplete()
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  const totalMonthly = detected.reduce((s, d) => s + d.monthlyAmount, 0)

  if (loading) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="text-2xl mb-2">🔍</div>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Spaarrekeningen detecteren...</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="text-2xl mb-3">💰</div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>
          Wat staat er op je spaarrekening?
        </h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Je bank geeft geen saldo van spaarrekeningen vrij via PSD2. Vul je spaarsaldo handmatig in — je kunt dit altijd later bijwerken.
        </p>
      </div>

      {/* Gedetecteerde spaaroverschrijvingen */}
      {detected.length > 0 && (
        <div className="px-6 pt-4 pb-2">
          <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(26,92,58,0.08)', border: '1px solid rgba(26,92,58,0.15)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--brand)' }}>
              ✓ Fynn ziet dat je €{totalMonthly.toFixed(0)}/maand spaart
            </p>
            {detected.map((d, i) => (
              <p key={i} className="text-xs" style={{ color: 'var(--muted)' }}>
                → €{d.monthlyAmount.toFixed(0)}/mnd naar {d.name} ({d.iban.slice(0, 8)}...)
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Invoervelden */}
      <div className="p-6 space-y-4">
        {accounts.map((acc, i) => (
          <div key={i} className="space-y-2">
            {/* Naam */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={acc.name}
                onChange={e => updateAccount(i, 'name', e.target.value)}
                placeholder="Naam spaarrekening"
                className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--tab-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
              {accounts.length > 1 && (
                <button
                  onClick={() => removeAccount(i)}
                  className="text-xs px-2 py-2 rounded-lg"
                  style={{ color: 'var(--muted)' }}>
                  ✕
                </button>
              )}
            </div>

            {/* Saldo */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'var(--muted)' }}>
                €
              </span>
              <input
                type="number"
                value={acc.balance}
                onChange={e => updateAccount(i, 'balance', e.target.value)}
                placeholder="0,00"
                min="0"
                step="0.01"
                className="w-full rounded-xl pl-8 pr-4 py-2.5 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--tab-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>

            {/* IBAN (optioneel, alleen als niet gedetecteerd) */}
            {!acc.detected && (
              <input
                type="text"
                value={acc.iban}
                onChange={e => updateAccount(i, 'iban', e.target.value.toUpperCase())}
                placeholder="IBAN (optioneel, bijv. NL12ABNA...)"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none font-mono"
                style={{
                  backgroundColor: 'var(--tab-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            )}
          </div>
        ))}

        {/* Extra rekening toevoegen */}
        <button
          onClick={addAccount}
          className="w-full py-2.5 rounded-xl text-sm transition-all"
          style={{
            border: '1px dashed var(--border)',
            color: 'var(--muted)',
          }}>
          + Extra spaarrekening toevoegen
        </button>

        {error && (
          <p className="text-xs px-3 py-2 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {error}
          </p>
        )}

        {/* Knoppen */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onComplete}
            className="flex-1 py-3 rounded-xl text-sm transition-all"
            style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand)' }}>
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>

        <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
          Je kunt dit later altijd aanpassen via de Sparen-tab.
        </p>
      </div>
    </div>
  )
}