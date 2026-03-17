// src/components/CoachModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import ChatCoach from './ChatCoach'
import UitgaveCheck from './UitgaveCheck'
import AFMDisclaimer from './AFMDisclaimer'

type ActiveView = 'coach' | 'check'

interface Props {
  isPro: boolean
}

export default function CoachModal({ isPro }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<ActiveView>('coach')
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Escape handler
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  if (!mounted) return null

  return createPortal(
    <>
      {/* ── Floating button ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl font-semibold text-sm text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
            right: 20,
            backgroundColor: 'var(--brand)',
            boxShadow: '0 4px 24px rgba(26,58,42,0.5)',
          }}
        >
          <span style={{ fontSize: 16 }}>✦</span>
          Vraag Fynn
        </button>
      )}

      {/* ── Modal overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col"
            style={{ backgroundColor: 'var(--bg)', maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle — mobiel only */}
            <div className="sm:hidden flex justify-center pt-3">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
            </div>

            {/* Header */}
            <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-3">
              {/* Toggle */}
              <div className="flex p-0.5 rounded-lg shrink-0" style={{ backgroundColor: 'var(--tab-bg)' }}>
                {([
                  { value: 'coach' as const, label: '✦ Coach' },
                  { value: 'check' as const, label: '✓ Check' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setView(opt.value)}
                    className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                    style={{
                      backgroundColor: view === opt.value ? 'var(--tab-active)' : 'transparent',
                      color: view === opt.value ? 'var(--tab-active-text)' : 'var(--muted)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {isPro ? (
                <>
                  {view === 'coach' && <ChatCoach embedded />}
                  {view === 'check' && <UitgaveCheck />}
                </>
              ) : (
                <div className="py-12 text-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}
                  >
                    <span className="text-xl" style={{ color: 'var(--brand)' }}>✦</span>
                  </div>
                  <p className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>
                    Fynn Coach is Pro
                  </p>
                  <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                    Stel Fynn vragen over je financiën en check of je iets kunt betalen — op basis van je échte bankdata.
                  </p>
                  <button
                    onClick={() => { setOpen(false); router.push('/pricing') }}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: 'var(--brand)', color: 'white' }}
                  >
                    Upgrade naar Pro
                  </button>
                </div>
              )}
            </div>

            {/* Footer — AFM disclaimer */}
            {isPro && (
              <div className="px-6 pb-4 pt-1 flex-shrink-0 border-t" style={{ borderColor: 'var(--border)' }}>
                <AFMDisclaimer />
              </div>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  )
}