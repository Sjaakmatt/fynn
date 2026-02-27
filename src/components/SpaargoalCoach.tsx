'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import AFMDisclaimer from './AFMDisclaimer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkedAccount {
  id: string
  account_name: string
  iban: string
  balance: number
  account_type: string
}

interface SavingsGoal {
  id: string
  name: string
  target_amount: number
  deadline: string
  account_ids: string[]
  photo_url: string | null
  notes: string | null
  ai_tip: string | null
  ai_tip_generated_at: string | null
  created_at: string
  linked_accounts: LinkedAccount[]
  current_amount: number
  monthly_needed: number
  months_left: number
  progress_pct: number
  on_track: boolean
}

interface BankAccount {
  id: string
  account_name: string
  iban: string
  balance: number
  account_type: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function deadlineLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('nl-NL', {
    month: 'long',
    year: 'numeric',
  })
}

// Genereer een gradient op basis van de naam (deterministic)
function goalGradient(name: string): string {
  const gradients = [
    'linear-gradient(135deg, #1a3a2a 0%, #0d2018 100%)',
    'linear-gradient(135deg, #1a2a3a 0%, #0d1820 100%)',
    'linear-gradient(135deg, #2a1a3a 0%, #180d20 100%)',
    'linear-gradient(135deg, #3a2a1a 0%, #20180d 100%)',
    'linear-gradient(135deg, #1a3a3a 0%, #0d2020 100%)',
  ]
  const idx = name.charCodeAt(0) % gradients.length
  return gradients[idx]
}

// ─── Goal Card (compact) ──────────────────────────────────────────────────────

function GoalCard({ goal, onClick }: { goal: SavingsGoal; onClick: () => void }) {
  const progressColor = goal.on_track ? '#4ade80' : goal.progress_pct > 50 ? '#f59e0b' : '#ef4444'

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.99]"
      style={{
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface)',
      }}
    >
      {/* Foto of gradient header */}
      <div
        className="w-full relative overflow-hidden"
        style={{ aspectRatio: '16/9' }}
      >
        {goal.photo_url ? (
          <img
            src={goal.photo_url}
            alt={goal.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: goalGradient(goal.name) }}
          >
            <span style={{ fontSize: 40 }}>🎯</span>
          </div>
        )}
        {/* Status badge over foto */}
        <div className="absolute top-2 right-2">
          <span
            className="text-xs font-semibold px-2 py-1 rounded-full"
            style={{
              backgroundColor: goal.on_track ? 'rgba(0,0,0,0.6)' : 'rgba(239,68,68,0.85)',
              color: goal.on_track ? '#4ade80' : '#fff',
              backdropFilter: 'blur(4px)',
            }}
          >
            {goal.on_track ? '✓ Op koers' : '⚠ Achter'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="font-semibold text-sm mb-1 truncate" style={{ color: 'var(--text)' }}>
          {goal.name}
        </p>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          {deadlineLabel(goal.deadline)}
        </p>

        {/* Progress bar */}
        <div
          className="w-full rounded-full overflow-hidden mb-2"
          style={{ height: 5, backgroundColor: 'var(--tab-bg)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${goal.progress_pct}%`, backgroundColor: progressColor }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {formatEuro(goal.current_amount)}
          </span>
          <span className="text-xs font-semibold" style={{ color: progressColor }}>
            {goal.progress_pct.toFixed(0)}%
          </span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {formatEuro(goal.target_amount)}
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Goal Detail Overlay ──────────────────────────────────────────────────────

function GoalDetail({
  goal: initialGoal,
  onClose,
  onDelete,
  onUpdate,
}: {
  goal: SavingsGoal
  onClose: () => void
  onDelete: (id: string) => void
  onUpdate: (goal: SavingsGoal) => void
}) {
  const [goal, setGoal] = useState(initialGoal)
  const [notes, setNotes] = useState(goal.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [loadingTip, setLoadingTip] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const notesTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const progressColor = goal.on_track ? '#4ade80' : goal.progress_pct > 50 ? '#f59e0b' : '#ef4444'

  // Auto-save notes met debounce
  function handleNotesChange(val: string) {
    setNotes(val)
    if (notesTimeout.current) clearTimeout(notesTimeout.current)
    notesTimeout.current = setTimeout(() => saveNotes(val), 1000)
  }

  async function saveNotes(val: string) {
    setSavingNotes(true)
    try {
      await fetch(`/api/savings-goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: val }),
      })
      const updated = { ...goal, notes: val }
      setGoal(updated)
      onUpdate(updated)
    } finally {
      setSavingNotes(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    setPhotoError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/savings-goals/${goal.id}/photo`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.photo_url) {
        // Cache-buster — zelfde URL path, maar browser denkt dat het een nieuw bestand is
        const busted = `${data.photo_url}?t=${Date.now()}`
        const updated = { ...goal, photo_url: busted }
        setGoal(updated)
        onUpdate(updated)
      } else if (data.error) {
        setPhotoError(data.error)
      }
    } catch {
      setPhotoError('Upload mislukt — probeer opnieuw')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function fetchTip() {
    setLoadingTip(true)
    try {
      const res = await fetch(`/api/savings-goals/${goal.id}/tip`, { method: 'POST' })
      const data = await res.json()
      if (data.tip) {
        const updated = {
          ...goal,
          ai_tip: data.tip,
          ai_tip_generated_at: new Date().toISOString(),
        }
        setGoal(updated)
        onUpdate(updated)
      }
    } finally {
      setLoadingTip(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--muted)' }}
        >
          <span>←</span> Terug
        </button>
        <p className="text-sm font-semibold truncate max-w-[200px]" style={{ color: 'var(--text)' }}>
          {goal.name}
        </p>
        <div style={{ width: 60 }} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* Hero foto */}
        <div className="max-w-2xl mx-auto w-full px-4 mt-4">
          <div
            className="w-full relative cursor-pointer group rounded-2xl"
            style={{ aspectRatio: '16/7', overflow: 'hidden', border: '1px solid var(--border)' }}
            onClick={() => fileInputRef.current?.click()}
          >
          {goal.photo_url ? (
            <img
              src={goal.photo_url}
              alt={goal.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: goalGradient(goal.name) }}
            >
              <span style={{ fontSize: 64 }}>🎯</span>
            </div>
          )}

          {/* Upload overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            {uploadingPhoto ? (
              <span className="text-white text-sm">Uploaden…</span>
            ) : (
              <div className="text-center">
                <p className="text-white text-sm font-medium">📷</p>
                <p className="text-white text-xs mt-1">
                  {goal.photo_url ? 'Foto wijzigen' : 'Foto toevoegen'}
                </p>
              </div>
            )}
          </div>

          {/* Status badge */}
          <div className="absolute top-3 right-3">
            <span
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: 'rgba(0,0,0,0.65)',
                color: progressColor,
                backdropFilter: 'blur(6px)',
              }}
            >
              {goal.on_track ? '✓ Op koers' : '⚠ Achter op schema'}
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>
        </div>
        {photoError && (
          <div
            className="mx-4 mt-2 px-4 py-2 rounded-xl text-xs"
            style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
          >
            ⚠ {photoError}
          </div>
        )}

        <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto">

          {/* Progress sectie */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Huidig gespaard</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
                  {formatEuro(goal.current_amount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Doelbedrag</p>
                <p className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                  {formatEuro(goal.target_amount)}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div
              className="w-full rounded-full overflow-hidden mb-3"
              style={{ height: 10, backgroundColor: 'var(--tab-bg)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${goal.progress_pct}%`, backgroundColor: progressColor }}
              />
            </div>
            <p className="text-xs text-center mb-4" style={{ color: 'var(--muted)' }}>
              {goal.progress_pct.toFixed(0)}% · deadline {deadlineLabel(goal.deadline)}
            </p>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <div
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: 'var(--tab-bg)' }}
              >
                <p className="text-base font-bold" style={{ color: 'var(--text)' }}>
                  {formatEuro(goal.monthly_needed)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>/maand nodig</p>
              </div>
              <div
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: 'var(--tab-bg)' }}
              >
                <p className="text-base font-bold" style={{ color: 'var(--text)' }}>
                  {goal.months_left === 0 ? 'Nu' : `${goal.months_left}m`}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>resterend</p>
              </div>
              <div
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: 'var(--tab-bg)' }}
              >
                <p className="text-base font-bold" style={{ color: 'var(--text)' }}>
                  {formatEuro(Math.max(0, goal.target_amount - goal.current_amount))}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>nog te gaan</p>
              </div>
            </div>
          </div>

          {/* Gekoppelde rekeningen */}
          {goal.linked_accounts.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  GEKOPPELDE REKENINGEN
                </p>
              </div>
              {goal.linked_accounts.map(acc => (
                <div
                  key={acc.id}
                  className="px-5 py-3 flex items-center justify-between border-b last:border-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    <span>{acc.account_type === 'SAVINGS' ? '🐷' : '🏦'}</span>
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text)' }}>{acc.account_name}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{acc.iban}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {formatEuro(Number(acc.balance))}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Notities */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="px-5 py-3 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--border)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                NOTITIES
              </p>
              {savingNotes && (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Opslaan…</p>
              )}
            </div>
            <textarea
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="Waarom wil je dit? Wat motiveert je? Schrijf het hier op…"
              rows={4}
              className="w-full px-5 py-4 text-sm resize-none outline-none"
              style={{
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
                caretColor: 'var(--brand)',
              }}
            />
          </div>

          {/* Fynn AI tip */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                FYNN ADVIES
              </p>
            </div>
            <div className="px-5 py-4">
              {goal.ai_tip ? (
                <>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>✦ Fynn zegt</span>
                    {goal.ai_tip_generated_at && (
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        · {new Date(goal.ai_tip_generated_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text)' }}>
                    {goal.ai_tip}
                  </p>
                  <button
                    onClick={fetchTip}
                    disabled={loadingTip}
                    className="text-xs"
                    style={{ color: 'var(--muted)' }}
                  >
                    {loadingTip ? 'Bezig…' : '↻ Nieuwe tip genereren'}
                  </button>
                </>
              ) : (
                <button
                  onClick={fetchTip}
                  disabled={loadingTip}
                  className="w-full py-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: 'var(--tab-bg)',
                    color: loadingTip ? 'var(--muted)' : 'var(--text)',
                    border: '1px dashed var(--border)',
                  }}
                >
                  {loadingTip ? (
                    <><span className="animate-spin text-xs">◌</span> Fynn denkt na…</>
                  ) : (
                    <>✦ Vraag Fynn om persoonlijk advies</>
                  )}
                </button>
              )}
            </div>
          </div>

          {goal.ai_tip && <AFMDisclaimer />}

          {/* Danger zone */}
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {showConfirmDelete ? (
              <div className="space-y-3">
                <p className="text-sm text-center" style={{ color: 'var(--text)' }}>
                  Doel "<strong>{goal.name}</strong>" definitief verwijderen?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDelete(goal.id)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                  >
                    Ja, verwijderen
                  </button>
                  <button
                    onClick={() => setShowConfirmDelete(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--muted)' }}
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="w-full text-sm text-center"
                style={{ color: 'var(--muted)' }}
              >
                Doel verwijderen
              </button>
            )}
          </div>

          {/* Bottom padding voor safe area */}
          <div style={{ height: 32 }} />
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── New Goal Form ────────────────────────────────────────────────────────────

function NewGoalForm({
  accounts,
  onCreated,
  onCancel,
}: {
  accounts: BankAccount[]
  onCreated: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toggleAccount(id: string) {
    setSelectedAccountIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const minDeadline = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().split('T')[0]
  })()

  async function handleSubmit() {
    setError(null)
    if (!name.trim()) { setError('Geef je doel een naam'); return }
    if (!targetAmount || Number(targetAmount) <= 0) { setError('Vul een geldig doelbedrag in'); return }
    if (!deadline) { setError('Kies een deadline'); return }

    setLoading(true)
    try {
      // Stap 1: goal aanmaken
      const res = await fetch('/api/savings-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          target_amount: Number(targetAmount),
          deadline,
          account_ids: selectedAccountIds,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Er ging iets mis'); return }

      // Stap 2: foto uploaden als geselecteerd
      if (photoFile && data.goal?.id) {
        const formData = new FormData()
        formData.append('file', photoFile)
        await fetch(`/api/savings-goals/${data.goal.id}/photo`, {
          method: 'POST',
          body: formData,
        })
      }

      onCreated()
    } catch {
      setError('Netwerk fout — probeer het opnieuw')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={onCancel}
          className="text-sm font-medium px-3 py-1.5 rounded-lg transition-all"
          style={{ color: 'var(--text)', backgroundColor: 'var(--tab-bg)' }}
        >
          ← Annuleren
        </button>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Nieuw spaardoel</p>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg transition-all text-white"
          style={{ backgroundColor: loading ? 'var(--muted)' : 'var(--brand)' }}
        >
          {loading ? '…' : 'Opslaan'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Foto picker — bovenaan */}
        <div className="max-w-2xl mx-auto w-full px-4">
        <div
          className="w-full relative cursor-pointer group rounded-2xl"
          style={{ aspectRatio: '16/7', overflow: 'hidden', border: '1px solid var(--border)' }}
          onClick={() => fileInputRef.current?.click()}
        >
          {photoPreview ? (
            <img src={photoPreview} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--tab-bg)', borderBottom: '1px solid var(--border)' }}
            >
              <span style={{ fontSize: 32 }}>📷</span>
              <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Foto toevoegen</p>
              <p className="text-xs" style={{ color: 'var(--muted)', opacity: 0.6 }}>Maak je doel tastbaar</p>
            </div>
          )}
          {/* Hover overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          >
            <p className="text-sm font-medium text-white">
              {photoPreview ? '📷 Foto wijzigen' : '📷 Foto kiezen'}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </div>
        </div>

        <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto w-full">

          {/* Naam */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              Naam van je doel
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="bijv. Vakantie Japan, Nieuwe auto, Eigen huis"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>

          {/* Bedrag + Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                Doelbedrag (€)
              </label>
              <input
                type="number"
                value={targetAmount}
                onChange={e => setTargetAmount(e.target.value)}
                placeholder="5000"
                min="1"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                min={minDeadline}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
          </div>

          {/* Rekeningen */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              Welke rekeningen tellen mee?
            </label>
            {accounts.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Geen rekeningen gevonden.</p>
            ) : (
              <div className="space-y-2">
                {accounts.map(acc => {
                  const selected = selectedAccountIds.includes(acc.id)
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => toggleAccount(acc.id)}
                      className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all"
                      style={{
                        backgroundColor: selected ? 'rgba(26,58,42,0.25)' : 'var(--surface)',
                        border: `1px solid ${selected ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span>{acc.account_type === 'SAVINGS' ? '🐷' : '🏦'}</span>
                        <div className="text-left">
                          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            {acc.account_name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>{acc.iban}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          {formatEuro(Number(acc.balance))}
                        </span>
                        <div
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0"
                          style={{
                            borderColor: selected ? '#4ade80' : 'var(--border)',
                            backgroundColor: selected ? '#4ade80' : 'transparent',
                          }}
                        >
                          {selected && <span style={{ color: '#000', fontSize: 10, fontWeight: 700 }}>✓</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notities */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              Notities <span style={{ opacity: 0.5 }}>(optioneel)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Waarom wil je dit? Wat motiveert je? Schrijf het hier op…"
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                caretColor: 'var(--brand)',
              }}
            />
          </div>

          {error && (
            <p
              className="text-xs px-3 py-2 rounded-xl"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
            >
              {error}
            </p>
          )}

          <div style={{ height: 16 }} />
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SpaargoalCoach() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [activeGoal, setActiveGoal] = useState<SavingsGoal | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const [goalsRes, accountsRes] = await Promise.all([
        fetch('/api/savings-goals'),
        fetch('/api/accounts'),
      ])
      const goalsData = await goalsRes.json()
      const accountsData = await accountsRes.json()
      setGoals(goalsData.goals ?? [])
      setAccounts(accountsData.accounts ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleDelete(id: string) {
    await fetch(`/api/savings-goals/${id}`, { method: 'DELETE' })
    setGoals(prev => prev.filter(g => g.id !== id))
    setActiveGoal(null)
  }

  function handleUpdate(updated: SavingsGoal) {
    setGoals(prev => prev.map(g => g.id === updated.id ? updated : g))
    if (activeGoal?.id === updated.id) setActiveGoal(updated)
  }

  function handleCreated() {
    setShowForm(false)
    loadData()
  }

  // Totaaloverzicht
  const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0)
  const totalCurrent = goals.reduce((sum, g) => sum + g.current_amount, 0)
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0

  if (loading) {
    return (
      <div
        className="rounded-2xl p-8 flex items-center justify-center"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden…</p>
      </div>
    )
  }

  return (
    <>
      {/* New goal form — full screen overlay */}
      {showForm && (
        <NewGoalForm
          accounts={accounts}
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Goal detail — full screen overlay */}
      {activeGoal && (
        <GoalDetail
          goal={activeGoal}
          onClose={() => setActiveGoal(null)}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      )}

      <div className="space-y-4">

        {/* Header */}
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                Spaargoal Coach
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                {goals.length === 0
                  ? 'Stel je eerste spaardoel in'
                  : `${goals.length} doel${goals.length !== 1 ? 'en' : ''} · ${formatEuro(totalCurrent)} gespaard`}
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              + Nieuw doel
            </button>
          </div>

          {/* Combined progress — alleen bij meerdere goals */}
          {goals.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Totaal voortgang</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                  {formatEuro(totalCurrent)} / {formatEuro(totalTarget)}
                </span>
              </div>
              <div
                className="w-full rounded-full overflow-hidden"
                style={{ height: 5, backgroundColor: 'var(--tab-bg)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${overallProgress}%`, backgroundColor: 'var(--brand)' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Lege state */}
        {goals.length === 0 && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
              Nog geen spaardoelen
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              Maak je eerste doel aan en Fynn houdt bij of je op schema ligt.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 rounded-xl text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              Eerste doel aanmaken
            </button>
          </div>
        )}

        {/* 2-koloms card grid */}
        {goals.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onClick={() => setActiveGoal(goal)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}