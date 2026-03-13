// src/components/VasteLastenKalender.tsx
'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

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

/** Get the Monday-start week containing a given date */
function getWeekDays(anchor: Date): Date[] {
  const d = new Date(anchor)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd
  })
}

function formatWeekLabel(weekDays: Date[]): string {
  const first = weekDays[0]
  const last = weekDays[6]
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${first.toLocaleDateString('nl-NL', opts)} – ${last.toLocaleDateString('nl-NL', opts)}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ─── Fullscreen Calendar Modal (mobile) ───────────────────────────────────────

function FullscreenCalendar({
  items,
  balanceWarning,
  onClose,
}: {
  items: CalendarItem[]
  balanceWarning: boolean
  onClose: () => void
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [calView, setCalView] = useState<'maand' | 'week'>('maand')
  const [weekAnchor, setWeekAnchor] = useState(new Date())
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Escape handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedDay !== null) setSelectedDay(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, selectedDay])

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

  const weekDays = getWeekDays(weekAnchor)

  function shiftWeek(dir: -1 | 1) {
    setWeekAnchor(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + dir * 7)
      return d
    })
    setSelectedDay(null)
  }

  const selectedItems = selectedDay ? (byDay[selectedDay] ?? []) : []

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <button onClick={onClose} className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <span>←</span> Terug
        </button>
        <p className="text-sm font-semibold capitalize" style={{ color: 'var(--text)' }}>
          {calView === 'maand' ? monthName : formatWeekLabel(weekDays)}
        </p>
        {/* Week / Maand toggle */}
        <div className="flex p-0.5 rounded-lg" style={{ backgroundColor: 'var(--tab-bg)' }}>
          {(['week', 'maand'] as const).map(v => (
            <button
              key={v}
              onClick={() => { setCalView(v); setSelectedDay(null) }}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-all capitalize"
              style={{
                backgroundColor: calView === v ? 'var(--tab-active)' : 'transparent',
                color: calView === v ? 'var(--tab-active-text)' : 'var(--muted)',
              }}
            >
              {v === 'week' ? 'W' : 'M'}
            </button>
          ))}
        </div>
      </div>

      {/* Week nav arrows — only in week view */}
      {calView === 'week' && (
        <div
          className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <button onClick={() => shiftWeek(-1)} className="px-3 py-1 rounded-lg text-sm" style={{ color: 'var(--muted)' }}>
            ← Vorige
          </button>
          {!isSameDay(weekDays[0], getWeekDays(today)[0]) && (
            <button
              onClick={() => { setWeekAnchor(new Date()); setSelectedDay(null) }}
              className="text-xs font-medium"
              style={{ color: 'var(--brand)' }}
            >
              Vandaag
            </button>
          )}
          <button onClick={() => shiftWeek(1)} className="px-3 py-1 rounded-lg text-sm" style={{ color: 'var(--muted)' }}>
            Volgende →
          </button>
        </div>
      )}

      {/* Calendar content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-2 pt-3 pb-2">

          {/* ── MAAND VIEW ── */}
          {calView === 'maand' && (
            <>
              <div className="grid grid-cols-7 mb-1">
                {['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'].map(d => (
                  <div key={d} className="py-1 text-center text-xs font-medium" style={{ color: 'var(--muted)' }}>
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ aspectRatio: '1' }} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const isToday = day === today.getDate()
                  const dayItems = byDay[day] ?? []
                  const hasItems = dayItems.length > 0
                  const hasWarning = dayItems.some(item => item.warning && balanceWarning)
                  const allPaid = hasItems && dayItems.every(item => item.isPast)
                  const isSelected = selectedDay === day

                  return (
                    <button
                      key={day}
                      onClick={() => hasItems ? setSelectedDay(isSelected ? null : day) : setSelectedDay(null)}
                      className="flex flex-col items-center justify-center rounded-xl transition-all"
                      style={{
                        aspectRatio: '1',
                        backgroundColor: isSelected
                          ? 'var(--brand)'
                          : hasWarning
                            ? 'rgba(239,68,68,0.1)'
                            : hasItems && !allPaid
                              ? 'color-mix(in srgb, var(--brand) 15%, var(--tab-bg))'
                              : isToday
                                ? 'var(--tab-bg)'
                                : 'transparent',
                        border: isToday && !isSelected ? '2px solid var(--brand)' : '2px solid transparent',
                      }}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{ color: isSelected ? 'white' : isToday ? 'var(--brand)' : 'var(--text)' }}
                      >
                        {day}
                      </span>
                      {hasItems && (
                        <div className="flex gap-0.5 mt-0.5">
                          {dayItems.slice(0, 3).map((item, j) => (
                            <div
                              key={j}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                backgroundColor: isSelected
                                  ? 'rgba(255,255,255,0.7)'
                                  : item.warning && balanceWarning ? '#EF4444'
                                  : item.isPast ? 'var(--muted)' : '#4ade80',
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* ── WEEK VIEW ── */}
          {calView === 'week' && (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {weekDays.map((d, i) => (
                  <div key={i} className="py-1 text-center text-xs font-medium" style={{ color: 'var(--muted)' }}>
                    {d.toLocaleDateString('nl-NL', { weekday: 'short' })}
                  </div>
                ))}
              </div>

              {/* Taller day cells with inline item previews */}
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((d, i) => {
                  const day = d.getDate()
                  const isCurrentMonth = d.getMonth() === month && d.getFullYear() === year
                  const isToday = isSameDay(d, today)
                  const dayItems = isCurrentMonth ? (byDay[day] ?? []) : []
                  const hasItems = dayItems.length > 0
                  const hasWarning = dayItems.some(item => item.warning && balanceWarning)
                  const allPaid = hasItems && dayItems.every(item => item.isPast)
                  const isSelected = selectedDay === day && isCurrentMonth

                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (!isCurrentMonth || !hasItems) { setSelectedDay(null); return }
                        setSelectedDay(isSelected ? null : day)
                      }}
                      className="flex flex-col items-center justify-start pt-3 rounded-xl transition-all"
                      style={{
                        minHeight: 100,
                        backgroundColor: isSelected
                          ? 'var(--brand)'
                          : hasWarning
                            ? 'rgba(239,68,68,0.1)'
                            : hasItems && !allPaid
                              ? 'color-mix(in srgb, var(--brand) 15%, var(--tab-bg))'
                              : isToday
                                ? 'var(--tab-bg)'
                                : 'transparent',
                        border: isToday && !isSelected ? '2px solid var(--brand)' : '2px solid transparent',
                        opacity: isCurrentMonth ? 1 : 0.3,
                      }}
                    >
                      <span
                        className="text-lg font-semibold"
                        style={{ color: isSelected ? 'white' : isToday ? 'var(--brand)' : 'var(--text)' }}
                      >
                        {day}
                      </span>
                      {hasItems && (
                        <div className="mt-1 space-y-0.5 w-full px-1">
                          {dayItems.slice(0, 2).map((item, j) => (
                            <div
                              key={j}
                              className="rounded px-1 py-0.5 text-center truncate"
                              style={{
                                fontSize: 8,
                                backgroundColor: isSelected
                                  ? 'rgba(255,255,255,0.2)'
                                  : item.warning && balanceWarning
                                    ? 'rgba(239,68,68,0.15)'
                                    : item.isPast
                                      ? 'color-mix(in srgb, var(--muted) 10%, transparent)'
                                      : 'color-mix(in srgb, var(--brand) 20%, var(--tab-bg))',
                                color: isSelected ? 'white' : item.warning && balanceWarning ? '#EF4444' : 'var(--text)',
                              }}
                            >
                              €{item.amount.toFixed(0)}
                            </div>
                          ))}
                          {dayItems.length > 2 && (
                            <p className="text-center" style={{ fontSize: 8, color: isSelected ? 'rgba(255,255,255,0.6)' : 'var(--muted)' }}>
                              +{dayItems.length - 2}
                            </p>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Week total */}
              {(() => {
                const weekTotal = weekDays.reduce((sum, d) => {
                  if (d.getMonth() !== month || d.getFullYear() !== year) return sum
                  return sum + (byDay[d.getDate()] ?? []).reduce((s, item) => s + item.amount, 0)
                }, 0)
                if (weekTotal === 0) return null
                return (
                  <div className="mt-3 px-2 flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Totaal deze week</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>€{weekTotal.toFixed(0)}</span>
                  </div>
                )
              })()}
            </>
          )}
        </div>

        {/* Selected day detail panel */}
        {selectedDay !== null && selectedItems.length > 0 && (
          <div className="px-4 pb-4">
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  {selectedDay}{' '}
                  {new Date(year, month, selectedDay).toLocaleDateString('nl-NL', { month: 'long' })}
                  {' '}· {selectedItems.length} betaling{selectedItems.length !== 1 ? 'en' : ''}
                </p>
              </div>
              {selectedItems.map((item, i) => {
                const isRed = item.warning && balanceWarning
                return (
                  <div
                    key={i}
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ borderBottom: i < selectedItems.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                        {cleanName(item.name)}
                      </p>
                      <p className="text-xs" style={{ color: isRed ? '#EF4444' : 'var(--muted)' }}>
                        {item.isPast
                          ? '✓ Betaald deze maand'
                          : `${isRed ? '⚠️ ' : ''}${daysLabel(item.daysUntil)}`}
                      </p>
                    </div>
                    <p className="text-sm font-semibold shrink-0 ml-3" style={{ color: isRed ? '#EF4444' : 'var(--text)' }}>
                      €{item.amount.toFixed(2)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Legenda */}
        <div className="px-4 pb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#4ade80' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Komend</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#EF4444' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Tekort</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Betaald</p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Desktop Calendar (inline) ────────────────────────────────────────────────

function DesktopCalendar({
  items,
  balanceWarning,
}: {
  items: CalendarItem[]
  balanceWarning: boolean
}) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()

  const recurringBg = 'color-mix(in srgb, var(--brand) 20%, var(--tab-bg))'
  const paidBg = 'color-mix(in srgb, var(--muted) 10%, transparent)'

  const byDay: Record<number, CalendarItem[]> = {}
  items.forEach(item => {
    const d = new Date(item.thisMonthDate)
    if (d.getMonth() === month && d.getFullYear() === year) {
      if (!byDay[d.getDate()]) byDay[d.getDate()] = []
      byDay[d.getDate()].push(item)
    }
  })

  return (
    <div
      className="rounded-2xl"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', overflow: 'clip' }}
    >
      <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
        {['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'].map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium" style={{ color: 'var(--muted)' }}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7" style={{ overflow: 'visible' }}>
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div
            key={`empty-${i}`}
            style={{ minHeight: 80, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
          />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const isToday = day === today.getDate()
          const dayItems = byDay[day] ?? []
          const hasWarning = dayItems.some(item => item.warning)
          const col = (firstDayOfMonth + day - 1) % 7
          const row = Math.floor((firstDayOfMonth + day - 1) / 7)
          const flipTooltip = col >= 5
          const flipDown = row === 0

          return (
            <div
              key={day}
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
              }}
            >
              <p
                className="text-xs font-medium leading-none mb-1"
                style={{ color: isToday ? 'var(--brand)' : 'var(--text)', fontWeight: isToday ? 700 : 400 }}
              >
                {day}
              </p>

              {dayItems.map((item, j) => {
                const isRed = item.warning && balanceWarning
                const itemBg = isRed ? 'rgba(239,68,68,0.15)' : item.isPast ? paidBg : recurringBg
                const itemColor = isRed ? '#EF4444' : item.isPast ? 'var(--muted)' : 'var(--text)'

                return (
                  <div
                    key={j}
                    className="group rounded px-1 leading-tight mb-0.5 cursor-pointer"
                    style={{ backgroundColor: itemBg, fontSize: 9, position: 'relative', zIndex: 1 }}
                  >
                    <p className="truncate font-medium" style={{ color: itemColor }}>
                      {cleanName(item.name).split(' ')[0]}
                    </p>
                    <p style={{ color: itemColor, opacity: 0.8 }}>€{item.amount.toFixed(0)}</p>

                    {/* Tooltip */}
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
                      }}
                    >
                      <div
                        className="rounded-xl p-3 shadow-xl"
                        style={{
                          backgroundColor: 'var(--surface)',
                          border: '1px solid var(--border)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        }}
                      >
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
                          {cleanName(item.name)}
                        </p>
                        <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>
                          €{item.amount.toFixed(2)}
                        </p>
                        <div className="h-px mb-2" style={{ backgroundColor: 'var(--border)' }} />
                        <p className="text-xs" style={{ color: isRed ? '#EF4444' : 'var(--muted)' }}>
                          {item.isPast
                            ? '✓ Betaald deze maand'
                            : `${isRed ? '⚠️' : '📅'} ${daysLabel(item.daysUntil)}`}
                        </p>
                        {isRed && (
                          <p className="text-xs mt-1" style={{ color: '#EF4444' }}>Mogelijk onvoldoende saldo</p>
                        )}
                        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>🔄 Terugkerend · maandelijks</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="px-4 py-3 flex items-center gap-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: recurringBg, border: '1px solid color-mix(in srgb, var(--brand) 60%, transparent)' }} />
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
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VasteLastenKalender() {
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'lijst' | 'kalender'>('lijst')
  const [balanceWarning, setBalanceWarning] = useState(false)
  const [upcomingTotal, setUpcomingTotal] = useState(0)
  const [totalBalance, setTotalBalance] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showMobileCalendar, setShowMobileCalendar] = useState(false)

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

  // Escape for confirm delete
  useEffect(() => {
    if (!confirmDelete) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmDelete(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [confirmDelete])

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
  const monthName = today.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
  const totalThisMonth = items.reduce((sum, i) => sum + i.amount, 0)
  const warnings = items.filter(i => i.warning)

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
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        Fynn detecteert vaste lasten automatisch zodra er genoeg transactiehistorie is.
      </p>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Fullscreen mobile calendar */}
      {showMobileCalendar && (
        <FullscreenCalendar
          items={items}
          balanceWarning={balanceWarning}
          onClose={() => setShowMobileCalendar(false)}
        />
      )}

      {/* Confirm delete overlay */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="rounded-2xl p-5 w-full max-w-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>
              Vaste last verwijderen?
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              "{cleanName(items.find(i => i.merchantKey === confirmDelete)?.name ?? '')}" wordt niet meer getoond in je kalender.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--text)' }}
              >
                Annuleren
              </button>
              <button
                onClick={() => deleteItem(confirmDelete)}
                disabled={deleting === confirmDelete}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444' }}
              >
                {deleting === confirmDelete ? 'Verwijderen...' : 'Verwijderen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-sm capitalize" style={{ color: 'var(--text)' }}>
              Vaste lasten — {monthName}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {items.length} terugkerende betalingen · €{totalThisMonth.toFixed(0)} totaal
            </p>
          </div>
          <div className="flex gap-1">
            {/* Desktop: inline toggle */}
            <div className="hidden sm:flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--tab-bg)' }}>
              {(['lijst', 'kalender'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-all capitalize"
                  style={{
                    backgroundColor: view === v ? 'var(--tab-active)' : 'transparent',
                    color: view === v ? 'var(--tab-active-text)' : 'var(--muted)',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
            {/* Mobile: kalender button opens fullscreen */}
            <button
              onClick={() => setShowMobileCalendar(true)}
              className="sm:hidden px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--muted)' }}
            >
              📅 Kalender
            </button>
          </div>
        </div>

        {balanceWarning && (
          <div
            className="rounded-xl p-3 mb-2"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: '#EF4444' }}>⚠️ Mogelijk tekort</p>
            <p className="text-xs" style={{ color: '#EF4444' }}>
              Komende betalingen (€{upcomingTotal.toFixed(0)}) overschrijden je saldo (€{totalBalance.toFixed(0)})
            </p>
          </div>
        )}

        {warnings.length > 0 && (
          <div
            className="rounded-xl p-3 mb-1"
            style={{
              backgroundColor: balanceWarning ? 'rgba(239,68,68,0.08)' : 'color-mix(in srgb, var(--brand) 10%, transparent)',
              border: `1px solid ${balanceWarning ? 'rgba(239,68,68,0.2)' : 'color-mix(in srgb, var(--brand) 30%, transparent)'}`,
            }}
          >
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
      <div className={view === 'kalender' ? 'sm:hidden' : ''}>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {items.map((item, i) => {
            const date = new Date(item.thisMonthDate)
            const isWarning = item.warning && balanceWarning
            const itemColor = isWarning ? '#EF4444' : item.warning ? 'var(--text)' : 'var(--muted)'

            return (
              <div
                key={i}
                className="px-5 py-4 flex items-center justify-between gap-3"
                style={{
                  borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                  opacity: item.isPast ? 0.6 : 1,
                }}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0"
                    style={{
                      backgroundColor: item.warning
                        ? isWarning ? 'rgba(239,68,68,0.12)' : 'color-mix(in srgb, var(--brand) 12%, transparent)'
                        : item.isPast ? 'var(--tab-bg)' : 'color-mix(in srgb, var(--brand) 12%, transparent)',
                    }}
                  >
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
                      {item.isPast
                        ? '✓ Betaald deze maand'
                        : item.warning
                          ? `${isWarning ? '⚠️' : '📅'} ${daysLabel(item.daysUntil)}`
                          : daysLabel(item.daysUntil)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    €{item.amount.toFixed(2)}
                  </p>
                  <button
                    onClick={() => setConfirmDelete(item.merchantKey)}
                    className="w-6 h-6 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'var(--tab-bg)' }}
                    title="Verwijder uit kalender"
                  >
                    <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1 }}>×</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* DESKTOP KALENDER VIEW — hidden on mobile */}
      {view === 'kalender' && (
        <div className="hidden sm:block">
          <DesktopCalendar items={items} balanceWarning={balanceWarning} />
        </div>
      )}
    </div>
  )
}