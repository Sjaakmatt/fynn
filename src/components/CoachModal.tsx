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
            bottom: 24,
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
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[150]"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setOpen(false)}
          />

          {/* Bottom sheet */}
          <div
            className="fixed z-[160] flex flex-col w-full sm:w-auto sm:max-w-lg sm:right-5 sm:bottom-5 sm:rounded-2xl sm:left-auto sm:top-auto"
            style={{
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: '85vh',
              backgroundColor: 'var(--surface)',
              borderRadius: '20px 20px 0 0',
              border: '1px solid var(--border)',
              boxShadow: '0 -4px 40px rgba(0,0,0,0.15)',
            }}
          >
            {/* Handle (mobile only) */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0 sm:hidden">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
            </div>

            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <div
                className="flex p-1 rounded-xl"
                style={{ backgroundColor: 'var(--tab-bg)' }}
              >
                <button
                  onClick={() => setView('coach')}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: view === 'coach' ? 'var(--tab-active)' : 'transparent',
                    color: view === 'coach' ? 'var(--tab-active-text)' : 'var(--muted)',
                  }}
                >
                  ✦ Coach
                </button>
                <button
                  onClick={() => setView('check')}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: view === 'check' ? 'var(--tab-active)' : 'transparent',
                    color: view === 'check' ? 'var(--tab-active-text)' : 'var(--muted)',
                  }}
                >
                  ✓ Check
                </button>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-sm"
                style={{ backgroundColor: 'var(--tab-bg)', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {isPro ? (
                <>
                  {view === 'coach' && <ChatCoach embedded />}
                  {view === 'check' && <UitgaveCheck />}
                </>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-4xl mb-4">✦</p>
                  <p className="text-base font-semibold mb-2" style={{ color: 'var(--text)' }}>
                    Fynn Coach is Pro
                  </p>
                  <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                    Stel Fynn vragen over je financiën en check of je iets kunt betalen — op basis van je échte bankdata.
                  </p>
                  <button
                    onClick={() => { setOpen(false); router.push('/pricing') }}
                    className="px-6 py-3 rounded-2xl text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--brand)' }}
                  >
                    Upgrade naar Pro
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            {isPro && (
              <div className="px-5 pb-4 pt-1 flex-shrink-0">
                <AFMDisclaimer />
              </div>
            )}
          </div>
        </>
      )}
    </>,
    document.body
  )
}