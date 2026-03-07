// src/components/VasteLastenKalender.tsx
'use client'

import { useEffect, useState } from 'react'

interface CalendarItem {
  name: string
  amount: number
  nextDate: string
  thisMonthDate: string
  dayOfMonth: number
  daysUntil: number
  isPast: boolean
  warning: boolean
  merchantKey: string
  score: number
}

function daysLabel(days: number): string {
  if (days === 0) return 'Vandaag'
  if (days === 1) return 'Morgen'
  if (days === 2) return 'Overmorgen'
  if (days < 0) return '✓ Betaald deze maand'
  return `Over ${days} dagen`
}

function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

export default function VasteLastenKalender() {
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'lijst' | 'kalender'>('lijst')
  const [balanceWarning, setBalanceWarning] = useState(false)
  const [upcomingTotal, setUpcomingTotal] = useState(0)
  const [totalBalance, setTotalBalance] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/calendar')
      .then(r => r.json())
      .then(d => {
        const sorted = (d.items ?? []).sort((a: CalendarItem, b: CalendarItem) => a.dayOfMonth - b.dayOfMonth)
        setItems(sorted)
        setBalanceWarning(d.balanceWarning ?? false)
        setUpcomingTotal(d.upcomingTotal ?? 0)
        setTotalBalance(d.totalBalance ?? 0)
        setLoading(false)
      })
  }, [])

  async function deleteItem(merchantKey: string) {
    setDeleting(merchantKey)
    const res = await fetch('/api/calendar/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantKey }),
    })
    if (res.ok) {
      setItems(prev => prev.filter(i => i.merchantKey !== merchantKey))
    }
    setDeleting(null)
    setConfirmDelete(null)
  }

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const monthName = today.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })

  const byDay: Record<number, CalendarItem[]> = {}
  items.forEach(item => {
    const d = new Date(item.thisMonthDate)
    if (d.getMonth() === month && d.getFullYear() === year) {
      if (!byDay[d.getDate()]) byDay[d.getDate()] = []
      byDay[d.getDate()].push(item)
    }
  })

  const totalThisMonth = items.reduce((sum, i) => sum + i.amount, 0)
  const warnings = items.filter(i => i.warning)

  const recurringColor = 'var(--text)'
  const recurringBg = 'color-mix(in srgb, var(--brand) 20%, var(--tab-bg))'
  const paidColor = 'var(--muted)'
  const paidBg = 'color-mix(in srgb, var(--muted) 10%, transparent)'

  if (loading) return (
    <div className="rounded-2xl p-8 flex items-center justify-center"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
    </div>
  )

  if (items.length === 0) return (
    <div className="rounded-2xl p-8 text-center"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-3xl mb-3">📅</p>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Nog geen vaste lasten gevonden</p>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>Fynn detecteert vaste lasten automatisch zodra er genoeg transactiehistorie is.</p>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Confirm delete overlay */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setConfirmDelete(null)}>
          <div className="rounded-2xl p-5 w-full max-w-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>
              Vaste last verwijderen?
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              "{cleanName(items.find(i => i.merchantKey === confirmDelete)?.name ?? '')}" wordt niet meer getoond in je kalender.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)' }}>
                Annuleren
              </button>
              <button onClick={() => deleteItem(confirmDelete)}
                disabled={deleting === confirmDelete}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                {deleting === confirmDelete ? 'Verwijderen...' : 'Verwijderen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="rounded-2xl p-5"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-sm capitalize" style={{ color: 'var(--text)' }}>
              Vaste lasten — {monthName}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {items.length} terugkerende betalingen · €{totalThisMonth.toFixed(0)} totaal
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--tab-bg)' }}>
            {(['lijst', 'kalender'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-all capitalize"
                style={{
                  backgroundColor: view === v ? 'var(--tab-active)' : 'transparent',
                  color: view === v ? 'var(--tab-active-text)' : 'var(--muted)',
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {balanceWarning && (
          <div className="rounded-xl p-3 mb-2"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#EF4444' }}>⚠️ Mogelijk tekort</p>
            <p className="text-xs" style={{ color: '#EF4444' }}>
              Komende betalingen (€{upcomingTotal.toFixed(0)}) overschrijden je saldo (€{totalBalance.toFixed(0)})
            </p>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-xl p-3 mb-1"
            style={{
              backgroundColor: balanceWarning ? 'rgba(239,68,68,0.08)' : 'color-mix(in srgb, var(--brand) 10%, transparent)',
              border: `1px solid ${balanceWarning ? 'rgba(239,68,68,0.2)' : 'color-mix(in srgb, var(--brand) 30%, transparent)'}`,
            }}>
            <p className="text-xs font-semibold mb-2" style={{ color: balanceWarning ? '#EF4444' : 'var(--text)' }}>
              {balanceWarning ? '⚠️' : '📅'} Komt eraan (binnen 3 dagen)
            </p>
            {warnings.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-xs" style={{ color: balanceWarning ? '#EF4444' : 'var(--text)' }}>
                  {cleanName(item.name)} — {daysLabel(item.daysUntil).toLowerCase()}
                </p>
                <p className="text-xs font-semibold" style={{ color: balanceWarning ? '#EF4444' : 'var(--text)' }}>
                  €{item.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LIJST VIEW */}
      {view === 'lijst' && (
        <div className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          {items.map((item, i) => {
            const date = new Date(item.thisMonthDate)
            const isWarning = item.warning && balanceWarning
            const itemColor = isWarning ? '#EF4444' : item.warning ? 'var(--text)' : 'var(--muted)'

            return (
              <div key={i} className="px-5 py-4 flex items-center justify-between gap-3"
                style={{
                  borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                  opacity: item.isPast ? 0.6 : 1,
                }}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: item.warning
                        ? isWarning ? 'rgba(239,68,68,0.12)' : 'color-mix(in srgb, var(--brand) 12%, transparent)'
                        : item.isPast ? 'var(--tab-bg)' : 'color-mix(in srgb, var(--brand) 12%, transparent)',
                    }}>
                    <p className="text-xs font-bold leading-none" style={{ color: item.warning ? itemColor : 'var(--text)' }}>
                      {date.getDate()}
                    </p>
                    <p className="text-xs leading-none mt-0.5" style={{ color: item.warning ? itemColor : 'var(--muted)' }}>
                      {date.toLocaleDateString('nl-NL', { month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                      {cleanName(item.name)}
                    </p>
                    <p className="text-xs" style={{ color: itemColor }}>
                      {item.isPast ? '✓ Betaald deze maand'
                        : item.warning ? `${isWarning ? '⚠️' : '📅'} ${daysLabel(item.daysUntil)}`
                        : daysLabel(item.daysUntil)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    €{item.amount.toFixed(2)}
                  </p>
                  <button
                    onClick={() => setConfirmDelete(item.merchantKey)}
                    className="w-6 h-6 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'var(--tab-bg)' }}
                    title="Verwijder uit kalender">
                    <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1 }}>×</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* KALENDER VIEW */}
      {view === 'kalender' && (
        <div className="rounded-2xl"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', overflow: 'clip' }}>

          {/* Dag headers */}
          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
            {['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'].map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium" style={{ color: 'var(--muted)' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid cellen — overflow visible zodat tooltips niet worden afgesneden */}
          <div className="grid grid-cols-7" style={{ overflow: 'visible' }}>
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`}
                style={{
                  minHeight: 80,
                  borderRight: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const isToday = day === today.getDate()
              const dayItems = byDay[day] ?? []
              const hasWarning = dayItems.some(item => item.warning)
              const col = (firstDayOfMonth + day - 1) % 7
              const flipTooltip = col >= 5

              return (
                <div key={day}
                  className="p-1 flex flex-col"
                  style={{
                    minHeight: 80,
                    borderRight: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    overflow: 'visible',
                    position: 'relative',
                    backgroundColor: hasWarning && balanceWarning
                      ? 'rgba(239,68,68,0.05)'
                      : isToday ? 'var(--tab-bg)' : 'transparent',
                  }}>
                  <p className="text-xs font-medium leading-none mb-1"
                    style={{ color: isToday ? 'var(--brand)' : 'var(--text)', fontWeight: isToday ? 700 : 400 }}>
                    {day}
                  </p>

                  {dayItems.map((item, j) => {
                    const isRed = item.warning && balanceWarning
                    const itemBg = isRed ? 'rgba(239,68,68,0.15)'
                      : item.isPast ? paidBg
                      : recurringBg
                    const itemColor = isRed ? '#EF4444'
                      : item.isPast ? paidColor
                      : recurringColor

                  const row = Math.floor((firstDayOfMonth + day - 1) / 7)
                  const flipDown = row === 0 // eerste rij → tooltip naar beneden

                    return (
                      <div key={j}
                        className="group rounded px-1 leading-tight mb-0.5 cursor-pointer"
                        style={{ backgroundColor: itemBg, fontSize: 9, position: 'relative', zIndex: 1 }}>
                        <p className="truncate font-medium" style={{ color: itemColor }}>
                          {cleanName(item.name).split(' ')[0]}
                        </p>
                        <p style={{ color: itemColor, opacity: 0.8 }}>€{item.amount.toFixed(0)}</p>

                        {/* Tooltip — buiten de cel gerenderd via absolute positioning */}

                        <div
                          className="absolute hidden group-hover:block"
                          style={{
                            top: flipDown ? '100%' : 'auto',
                            bottom: flipDown ? 'auto' : '100%',
                            marginTop: flipDown ? 4 : 0,
                            marginBottom: flipDown ? 0 : 4,
                            minWidth: 180,
                            left: flipTooltip ? 'auto' : 0,
                            right: flipTooltip ? 0 : 'auto',
                            zIndex: 100,
                          }}>
                          <div className="rounded-xl p-3 shadow-xl"
                            style={{
                              backgroundColor: 'var(--bg)',
                              border: '1px solid var(--border)',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                            }}>
                            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
                              {cleanName(item.name)}
                            </p>
                            <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>
                              €{item.amount.toFixed(2)}
                            </p>
                            <div className="h-px mb-2" style={{ backgroundColor: 'var(--border)' }} />
                            <p className="text-xs" style={{ color: isRed ? '#EF4444' : 'var(--muted)' }}>
                              {item.isPast ? '✓ Betaald deze maand'
                                : `${isRed ? '⚠️' : '📅'} ${daysLabel(item.daysUntil)}`}
                            </p>
                            {isRed && (
                              <p className="text-xs mt-1" style={{ color: '#EF4444' }}>Mogelijk onvoldoende saldo</p>
                            )}
                            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>🔄 Terugkerend · maandelijks</p>
                          </div>
                          <div className="w-2 h-2 rotate-45"
                            style={{
                              backgroundColor: 'var(--surface)',
                              borderRight: flipDown ? 'none' : '1px solid var(--border)',
                              borderBottom: flipDown ? 'none' : '1px solid var(--border)',
                              borderLeft: flipDown ? '1px solid var(--border)' : 'none',
                              borderTop: flipDown ? '1px solid var(--border)' : 'none',
                              marginTop: flipDown ? -5 : undefined,
                              marginBottom: flipDown ? undefined : -5,
                              marginLeft: flipTooltip ? 'auto' : 8,
                              marginRight: flipTooltip ? 8 : 'auto',
                            }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Legenda */}
          <div className="px-4 py-3 flex items-center gap-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: recurringBg, border: `1px solid color-mix(in srgb, var(--brand) 60%, transparent)` }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Vaste last</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.15)' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Tekort</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: paidBg }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Betaald</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}