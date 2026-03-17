// src/app/(marketing)/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

/* ═══════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════ */
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useInView(0.08)
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(32px)',
      transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`,
    }}>
      {children}
    </div>
  )
}

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const { ref, visible } = useInView()
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!visible) return
    let start = 0
    const dur = 1200
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / dur, 1)
      setVal(Math.floor(p * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [visible, target])
  return <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>{val}{suffix}</span>
}

/* ═══════════════════════════════════════════════════════════════
   MINI COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/* Shared SVG icons */
const Icons = {
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  checkBrand: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  chat: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  pulse: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  dollar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  clock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  bell: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  target: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  zap: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  scissors: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>,
  heart: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
  mail: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
}

/* Phone mock frame */
function PhoneMock({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div style={{
      width: compact ? 240 : 280,
      borderRadius: compact ? 24 : 32,
      padding: compact ? 8 : 12,
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      boxShadow: '0 24px 48px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: compact ? 8 : 12 }}>
        <div style={{ width: compact ? 60 : 80, height: 5, borderRadius: 100, backgroundColor: 'var(--tab-bg)' }} />
      </div>
      <div style={{ borderRadius: compact ? 16 : 20, overflow: 'hidden', backgroundColor: 'var(--bg)', minHeight: compact ? 280 : 400 }}>
        {children}
      </div>
    </div>
  )
}

/* Progress bar for mock UIs */
function MockBar({ pct, color = 'var(--brand)' }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 4, borderRadius: 100, backgroundColor: 'var(--tab-bg)', overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 100, backgroundColor: color, width: `${pct}%` }} />
    </div>
  )
}

/* FAQ Item */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '20px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text)', fontSize: 16, fontWeight: 600,
        textAlign: 'left', gap: 16, fontFamily: 'inherit',
      }}>
        <span>{q}</span>
        <span style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: 8,
          backgroundColor: open ? 'var(--brand)' : 'var(--tab-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: open ? 'white' : 'var(--muted)',
          transition: 'all 0.2s',
        }}>{open ? '−' : '+'}</span>
      </button>
      <div style={{
        maxHeight: open ? 400 : 0, overflow: 'hidden',
        transition: 'max-height 0.3s ease, opacity 0.3s ease',
        opacity: open ? 1 : 0,
      }}>
        <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.7, paddingBottom: 20 }}>{a}</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FEATURE ROW WITH MOCK UI
   ═══════════════════════════════════════════════════════════════ */
function FeatureRow({ reverse, tag, title, desc, mockContent, icon }: {
  reverse?: boolean; tag: string; title: string; desc: string;
  mockContent: React.ReactNode; icon: React.ReactNode
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: 48, alignItems: 'center',
      direction: reverse ? 'rtl' : 'ltr',
    }}>
      <Reveal>
        <div style={{ direction: 'ltr' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'var(--brand)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tag}</p>
              <h3 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.5px' }}>{title}</h3>
            </div>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.7, maxWidth: 420 }}>{desc}</p>
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <div style={{ display: 'flex', justifyContent: reverse ? 'flex-start' : 'flex-end', direction: 'ltr' }}>
          <PhoneMock compact>{mockContent}</PhoneMock>
        </div>
      </Reveal>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MOCK UI SCREENS
   ═══════════════════════════════════════════════════════════════ */

function MockChatCoach() {
  return (
    <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginBottom: 4 }}>Chat Coach</p>
      <div style={{ alignSelf: 'flex-end', maxWidth: '80%', padding: '10px 12px', borderRadius: '12px 12px 4px 12px', backgroundColor: 'var(--brand)', color: 'white', fontSize: 12, lineHeight: 1.4 }}>
        Kan ik volgende maand naar Barcelona?
      </div>
      <div style={{ alignSelf: 'flex-start', maxWidth: '85%', padding: '10px 12px', borderRadius: '12px 12px 12px 4px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>
        <span style={{ fontWeight: 600 }}>Ja, dat kan.</span> Na je vaste lasten houd je ~€480 vrij. Een weekend Barcelona kost gemiddeld €350. Je spaardoel blijft op koers.
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, padding: '8px 10px', borderRadius: 10, backgroundColor: 'var(--tab-bg)', fontSize: 11, color: 'var(--muted)' }}>Stel een vraag…</div>
        <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </div>
      </div>
    </div>
  )
}

function MockCashflowRadar() {
  return (
    <div style={{ padding: '16px 12px' }}>
      <p style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Cashflow Radar</p>
      <p style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginBottom: 2 }}>€1.247</p>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>vrij te besteden deze maand</p>
      {[
        { label: 'Inkomen', val: '€3.200', pct: 100, color: '#4ade80' },
        { label: 'Vaste lasten', val: '−€1.580', pct: 49, color: '#EF4444' },
        { label: 'Variabel', val: '−€373', pct: 12, color: '#F59E0B' },
      ].map(r => (
        <div key={r.label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.val}</span>
          </div>
          <MockBar pct={r.pct} color={r.color} />
        </div>
      ))}
      <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <p style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>Autoverzekering over 12 dagen</p>
        <p style={{ fontSize: 10, color: 'var(--muted)' }}>€145 — houd hier rekening mee</p>
      </div>
    </div>
  )
}

function MockBriefing() {
  return (
    <div style={{ padding: '16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'white' }}>F</span>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)' }}>WEKELIJKSE BRIEFING</p>
          <p style={{ fontSize: 10, color: 'var(--muted)' }}>Maandag 10 maart</p>
        </div>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text)' }}>
        <p style={{ marginBottom: 8 }}>Goedemorgen! Afgelopen week heb je <span style={{ fontWeight: 600 }}>€180 meer</span> uitgegeven aan eten dan gemiddeld — grotendeels vrijdagavond en zaterdag.</p>
        <p style={{ marginBottom: 8 }}>Je abonnement bij Spotify is <span style={{ fontWeight: 600 }}>€2 duurder</span> geworden. Wist je dat?</p>
        <p style={{ color: '#4ade80', fontWeight: 600 }}>Je spaardoel "Vakantie" ligt op schema.</p>
      </div>
    </div>
  )
}

function MockBudget() {
  return (
    <div style={{ padding: '16px 12px' }}>
      <p style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Budget — maart 2026</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { cat: 'Boodschappen', spent: 312, budget: 400, color: 'var(--brand)' },
          { cat: 'Uit eten', spent: 156, budget: 150, color: '#EF4444' },
          { cat: 'Transport', spent: 45, budget: 120, color: 'var(--brand)' },
          { cat: 'Shopping', spent: 89, budget: 100, color: '#F59E0B' },
        ].map(c => (
          <div key={c.cat}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{c.cat}</span>
              <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: c.spent > c.budget ? '#EF4444' : 'var(--text)' }}>€{c.spent} / €{c.budget}</span>
            </div>
            <MockBar pct={Math.min(100, (c.spent / c.budget) * 100)} color={c.color} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
        <p style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>Uit eten: €6 over budget</p>
      </div>
    </div>
  )
}

function MockVasteLasten() {
  return (
    <div style={{ padding: '16px 12px' }}>
      <p style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10 }}>Vaste Lasten Kalender</p>
      {[
        { day: '15 mrt', name: 'Zorgverzekering', amount: '€138', soon: true },
        { day: '17 mrt', name: 'Autoverzekering', amount: '€145', soon: true },
        { day: '28 mrt', name: 'Hypotheek', amount: '€895', soon: false },
        { day: '01 apr', name: 'Salaris', amount: '+€3.200', income: true, soon: false },
      ].map((r, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
          borderRadius: 10, marginBottom: 4,
          backgroundColor: r.soon ? 'rgba(245,158,11,0.06)' : 'transparent',
          border: r.soon ? '1px solid rgba(245,158,11,0.15)' : '1px solid transparent',
        }}>
          <div style={{ fontSize: 10, color: r.soon ? '#F59E0B' : 'var(--muted)', fontWeight: 700, width: 44, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{r.day}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{r.name}</p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: r.income ? '#4ade80' : 'var(--text)' }}>{r.amount}</span>
        </div>
      ))}
    </div>
  )
}

function MockAbonnementen() {
  return (
    <div style={{ padding: '16px 12px' }}>
      <p style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Abonnementen</p>
      <p style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}>€89,43 <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>/maand</span></p>
      {[
        { name: 'Netflix', price: '€17,99', change: '+€3' },
        { name: 'Spotify', price: '€11,99', change: '+€2' },
        { name: 'KPN', price: '€32,50' },
        { name: 'Sportschool', price: '€26,95' },
      ].map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'var(--tab-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{s.name[0]}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.price}</p>
            {s.change && <p style={{ fontSize: 10, color: '#EF4444', fontWeight: 600 }}>{s.change}</p>}
          </div>
        </div>
      ))}
      <button style={{ marginTop: 10, width: '100%', padding: '8px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', fontSize: 11, fontWeight: 600, color: '#EF4444', cursor: 'pointer', fontFamily: 'inherit' }}>
        Opzeg hulp voor Netflix
      </button>
    </div>
  )
}

function MockHealthScore() {
  return (
    <div style={{ padding: '16px 12px', textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 12 }}>Financiële Gezondheid</p>
      <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 12px' }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--tab-bg)" strokeWidth="6" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="#4ade80" strokeWidth="6" strokeDasharray={`${74 / 100 * 264} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>74</span>
          <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>Goed</span>
        </div>
      </div>
      {[
        { label: 'Spaarpercentage', score: '8/10' },
        { label: 'Schuldratio', score: '9/10' },
        { label: 'Abo-last', score: '6/10' },
        { label: 'Spaartempo', score: '7/10' },
      ].map(s => (
        <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{s.label}</span>
          <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.score}</span>
        </div>
      ))}
    </div>
  )
}

function MockSpaargoal() {
  return (
    <div style={{ padding: '16px 12px' }}>
      <p style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10 }}>Spaardoelen</p>
      {[
        { name: 'Vakantie Japan', target: 3000, saved: 1850, deadline: 'dec 2026', color: '#4ade80' },
        { name: 'Noodfonds', target: 5000, saved: 3200, deadline: 'jun 2026', color: 'var(--brand)' },
      ].map((g, i) => (
        <div key={i} style={{ padding: '10px', borderRadius: 12, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{g.name}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{g.deadline}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>€{g.saved.toLocaleString('nl-NL')}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>/ €{g.target.toLocaleString('nl-NL')}</span>
          </div>
          <MockBar pct={(g.saved / g.target) * 100} color={g.color} />
          <p style={{ fontSize: 10, color: '#4ade80', fontWeight: 600, marginTop: 6 }}>Op koers — €192/maand nodig</p>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   HERO CAROUSEL — auto-rotating feature slides
   ═══════════════════════════════════════════════════════════════ */
const HERO_SLIDES = [
  { label: 'Cashflow Radar', component: 'radar' },
  { label: 'Chat Coach', component: 'chat' },
  { label: 'Briefing', component: 'briefing' },
  { label: 'Budget', component: 'budget' },
  { label: 'Vaste Lasten', component: 'vaste' },
  { label: 'Abonnementen', component: 'abo' },
  { label: 'Score', component: 'score' },
  { label: 'Spaardoelen', component: 'spaar' },
] as const

function HeroCarousel() {
  const [active, setActive] = useState(0)
  const pausedUntil = useRef(0)
  const INTERVAL = 3500

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() < pausedUntil.current) return
      setActive(prev => (prev + 1) % HERO_SLIDES.length)
    }, INTERVAL)
    return () => clearInterval(id)
  }, [])

  const handleClick = (i: number) => {
    setActive(i)
    pausedUntil.current = Date.now() + 8000
  }

  const renderSlide = () => {
    switch (HERO_SLIDES[active].component) {
      case 'radar': return <MockCashflowRadar />
      case 'chat': return <MockChatCoach />
      case 'briefing': return <MockBriefing />
      case 'budget': return <MockBudget />
      case 'vaste': return <MockVasteLasten />
      case 'abo': return <MockAbonnementen />
      case 'score': return <MockHealthScore />
      case 'spaar': return <MockSpaargoal />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <PhoneMock>
        <div key={active} style={{ animation: 'heroSlideIn 0.4s ease' }}>
          {renderSlide()}
        </div>
        <style>{`
          @keyframes heroSlideIn {
            from { opacity: 0; transform: translateX(16px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes heroDotFill {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>
      </PhoneMock>
      {/* Pill indicators */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 280 }}>
        {HERO_SLIDES.map((slide, i) => (
          <button
            key={slide.label}
            onClick={() => handleClick(i)}
            style={{
              position: 'relative', overflow: 'hidden',
              padding: '4px 10px', borderRadius: 100, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11, fontWeight: active === i ? 700 : 500,
              backgroundColor: active === i ? 'var(--brand)' : 'var(--tab-bg)',
              color: active === i ? 'white' : 'var(--muted)',
              transition: 'background-color 0.3s ease, color 0.3s ease',
            }}
          >
            {slide.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const stagger = (i: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(24px)',
    transition: `all 0.7s ease ${0.1 + i * 0.1}s`,
  })

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", backgroundColor: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ═══════════════ NAV ═══════════════ */}
      <nav style={{
        position: 'fixed', width: '100%', top: 0, zIndex: 50,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        backgroundColor: 'color-mix(in srgb, var(--bg) 85%, transparent)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <>
              <img src="/logo-light.png" alt="Fynn" className="logo-light" style={{ height: 40, width: 'auto' }} />
              <img src="/logo.png" alt="Fynn" className="logo-dark" style={{ height: 40, width: 'auto' }} />
            </>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle />
            <Link href="/login" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 14, color: 'var(--muted)', textDecoration: 'none' }}>Inloggen</Link>
            <Link href="/signup" style={{ padding: '10px 20px', borderRadius: 12, fontSize: 14, backgroundColor: 'var(--brand)', color: 'white', textDecoration: 'none', fontWeight: 600 }}>Gratis starten</Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════ HERO ═══════════════ */}
      <section style={{ padding: '80px 24px 60px', maxWidth: 1120, margin: '0 auto', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -100, right: -150, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--brand) 8%, transparent) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 48, alignItems: 'center' }}>
          <div style={{ maxWidth: 580 }}>
            <div style={{
              ...stagger(0),
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 100,
              backgroundColor: 'color-mix(in srgb, var(--brand) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--brand) 15%, transparent)',
              marginBottom: 28,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4ade80' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)' }}>Beschikbaar in Nederland & België</span>
            </div>

            <h1 style={{ ...stagger(1), fontSize: 'clamp(38px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-2.5px', marginBottom: 20 }}>
              Weet of je het kunt veroorloven — vóórdat je het uitgeeft.
            </h1>

            <p style={{ ...stagger(2), fontSize: 17, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 480, marginBottom: 36 }}>
              Fynn koppelt je bankrekening, analyseert je cashflow en vertelt je precies hoeveel je kunt uitgeven. Elke dag. Elke week. Elke beslissing.
            </p>

            <div style={{ ...stagger(3), display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href="/signup" style={{
                padding: '16px 32px', borderRadius: 14, fontSize: 16, fontWeight: 700,
                textDecoration: 'none', color: 'white', backgroundColor: 'var(--brand)',
                transition: 'transform 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >Start 14 dagen gratis</Link>
              <a href="#features" style={{
                padding: '16px 28px', borderRadius: 14, fontSize: 15,
                textDecoration: 'none', color: 'var(--text)',
                backgroundColor: 'var(--tab-bg)', fontWeight: 600,
              }}>Bekijk alle features</a>
            </div>
            <p style={{ ...stagger(4), marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>Geen creditcard nodig · Altijd opzegbaar</p>
          </div>

          {/* Hero phone carousel — auto-rotating feature slides */}
          <div className="hidden lg:block" style={{ ...stagger(3) }}>
            <HeroCarousel />
          </div>
        </div>
      </section>

      {/* ═══════════════ TRUST BAR ═══════════════ */}
      <Reveal>
        <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', display: 'flex', flexWrap: 'wrap' }}>
            {[
              { val: 'PSD2', sub: 'Beveiligde bankconnectie' },
              { val: '< 3 min', sub: 'Koppelen duurt' },
              { val: '9', sub: 'Features inbegrepen' },
              { val: '€12,99', sub: 'Alles-in-één per maand' },
            ].map((item, i) => (
              <div key={item.val} style={{
                flex: '1 1 200px', padding: '24px 28px',
                borderRight: i < 3 ? '1px solid var(--border)' : 'none',
                textAlign: 'center',
              }}>
                <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>{item.val}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ═══════════════ PROBLEEM ═══════════════ */}
      <section style={{ padding: '100px 24px', maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 64, alignItems: 'center' }}>
          <Reveal>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20 }}>Het probleem</p>
              <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-1.5px', marginBottom: 20 }}>
                Je saldo liegt.
              </h2>
              <p style={{ color: 'var(--muted)', lineHeight: 1.75, fontSize: 16, maxWidth: 420 }}>
                Je ziet €1.200 op je rekening. Maar huur, verzekering en 12 abonnementen gaan er nog af. Je echte vrije ruimte? €180. En dat weet je pas als het te laat is.
              </p>
            </div>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { num: '01', title: 'Excel houdt niemand vol', desc: 'Handmatig bijhouden duurt 20 minuten per week. Na twee weken stop je ermee.' },
              { num: '02', title: 'Abonnementen sluipen omhoog', desc: 'Netflix +€3, Spotify +€2, sportschool +€5. Na een paar maanden is het al €30 extra per maand.' },
              { num: '03', title: 'Grote beslissingen voelen als gokken', desc: '"Kan ik die vakantie betalen?" Je raadt maar wat, want je hebt geen totaalbeeld van wat er nog afgeschreven wordt.' },
            ].map((item, i) => (
              <Reveal key={item.num} delay={i * 0.1}>
                <div style={{ padding: '20px 24px', borderRadius: 16, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', letterSpacing: '0.05em', flexShrink: 0, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{item.num}</span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{item.title}</p>
                    <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.55 }}>{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ HOE HET WERKT — JOURNEY ═══════════════ */}
      <section id="hoe-het-werkt" style={{ padding: '80px 24px 100px', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Zo werkt het</p>
              <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1px' }}>
                Van bank koppelen tot volledig inzicht.<br />In drie minuten.
              </h2>
            </div>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
            {[
              {
                step: '1', title: 'Koppel je bank', sub: '30 seconden',
                desc: 'Selecteer je bank — ING, Rabobank, ABN AMRO, Bunq, Triodos, KBC, Belfius of een andere. Log in via PSD2.',
                detail: 'Fynn krijgt alleen leestoegang. Het is technisch onmogelijk om geld te verplaatsen.',
              },
              {
                step: '2', title: 'Fynn analyseert', sub: 'automatisch',
                desc: 'Transacties worden gecategoriseerd. Vaste lasten gedetecteerd. Abonnementen herkend. Inkomen vastgesteld.',
                detail: 'AI herkent 50+ NL/BE merchants — van Albert Heijn tot Ziggo.',
              },
              {
                step: '3', title: 'Stel je vraag', sub: 'gewone taal',
                desc: '"Kan ik naar Barcelona?" Fynn kijkt naar cashflow, vaste lasten en spaardoelen en geeft een eerlijk antwoord.',
                detail: 'Op basis van een 30-daagse cashflow projectie, niet alleen je saldo.',
              },
              {
                step: '4', title: 'Fynn coacht wekelijks', sub: 'elke maandag',
                desc: 'Persoonlijke briefing, budget live bijgehouden, spaardoelen getracked, abonnementen bewaakt.',
                detail: 'Plus alerts bij prijsverhogingen, budgetoverschrijdingen en deadlines.',
              },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 0.08}>
                <div style={{
                  padding: '32px 24px', height: '100%',
                  backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: i === 0 ? '16px 0 0 16px' : i === 3 ? '0 16px 16px 0' : 0,
                  display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{item.step}</div>
                    <div style={{ padding: '3px 8px', borderRadius: 6, backgroundColor: 'var(--tab-bg)', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{item.sub}</div>
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, letterSpacing: '-0.3px' }}>{item.title}</h3>
                  <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.65, marginBottom: 16, flex: 1 }}>{item.desc}</p>
                  <p style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600, lineHeight: 1.5 }}>{item.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES — ALL 10 WITH MOCK UIs ═══════════════ */}
      <section id="features" style={{ padding: '100px 24px 40px', maxWidth: 1120, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Alle features</p>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1px' }}>
              Eén abonnement. Negen krachtige tools.
            </h2>
          </div>
        </Reveal>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 80 }}>
          <FeatureRow tag="Kern feature" title="Chat Coach" icon={Icons.chat}
            desc="Stel elke financiële vraag in gewone taal. Fynn analyseert je bankdata, vaste lasten en spaartempo en geeft een eerlijk antwoord — op basis van een cashflow projectie, niet alleen je saldo."
            mockContent={<MockChatCoach />} />
          <FeatureRow reverse tag="Real-time overzicht" title="Cashflow Radar" icon={Icons.pulse}
            desc="Zie hoeveel je echt kunt uitgeven — niet je saldo, maar wat er overblijft nadat alle vaste lasten en abonnementen eraf zijn. Met een 30-daagse vooruitblik die waarschuwt vóórdat je rood staat."
            mockContent={<MockCashflowRadar />} />
          <FeatureRow tag="Elke maandag" title="Wekelijkse Briefing" icon={Icons.mail}
            desc="Elke maandag max. 300 woorden. Wat ging goed, wat kan beter, welke actie moet je nu nemen. Geschreven als een vriend die alles van geld weet — niet als een bank."
            mockContent={<MockBriefing />} />
          <FeatureRow reverse tag="AI-gegenereerd" title="Budget Planner" icon={Icons.dollar}
            desc="Fynn maakt een realistisch budget op basis van je uitgavenhistorie. Per categorie zie je hoeveel je hebt besteed en hoeveel je nog kunt uitgeven. Live bijgehouden — niks handmatig."
            mockContent={<MockBudget />} />
          <FeatureRow tag="Voorkom verrassingen" title="Vaste Lasten Kalender" icon={Icons.calendar}
            desc="Visueel overzicht van alle vaste lasten: wanneer wordt wat afgeschreven? Fynn waarschuwt je 3 dagen van tevoren. Nooit meer rood staan door een vergeten verzekeringspremie."
            mockContent={<MockVasteLasten />} />
          <FeatureRow reverse tag="Bespaar automatisch" title="Abonnement Manager" icon={Icons.scissors}
            desc="Alle abonnementen automatisch gedetecteerd. Fynn toont wat je maandelijks betaalt en waarschuwt als er iets duurder wordt. Wil je opzeggen? Fynn schrijft het script, de e-mail of de brief."
            mockContent={<MockAbonnementen />} />
          <FeatureRow tag="Deel met vrienden" title="Financiële Gezondheidscore" icon={Icons.heart}
            desc="Je financiële gezondheid in één getal van 0–100. Op basis van spaarpercentage, schuldratio, abonnementslast en spaartempo. Wekelijks bijgewerkt. Deelbaar."
            mockContent={<MockHealthScore />} />
          <FeatureRow reverse tag="Doelen behalen" title="Spaargoal Coach" icon={Icons.target}
            desc="Stel je doel in: 'Ik wil €3.000 voor Japan in december.' Fynn berekent wat je maandelijks moet sparen, koppelt je spaarrekening en stuurt alerts als je dreigt af te wijken."
            mockContent={<MockSpaargoal />} />
        </div>
      </section>

      {/* ═══════════════ PRICING ═══════════════ */}
      <section style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Pricing</p>
              <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1px' }}>
                Eén plan. Alles erin.
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div style={{ padding: '40px', borderRadius: 24, backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'inline-flex', padding: '5px 12px', borderRadius: 8, backgroundColor: 'rgba(74,222,128,0.1)', fontSize: 12, color: '#4ade80', fontWeight: 700, marginBottom: 28, letterSpacing: '0.03em', textTransform: 'uppercase' }}>14 dagen gratis</div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums' }}>€12,99</span>
                <span style={{ color: 'var(--muted)', fontSize: 16 }}> / maand</span>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>Of €99 per jaar — twee maanden gratis</p>
              <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  'Chat Coach — stel elke financiële vraag',
                  'Cashflow Radar met 30-daagse projectie',
                  'Wekelijkse persoonlijke briefing',
                  'Budget Planner — AI-gegenereerd',
                  'Vaste Lasten Kalender met alerts',
                  'Abonnement Manager met opzeghulp',
                  'Financiële Gezondheidscore (0–100)',
                  'Spaargoal Coach met deadline tracking',
                  'Automatische categorisatie van alles',
                  'ING, Rabobank, ABN AMRO, KBC & meer',
                ].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {Icons.check}
                    <span style={{ fontSize: 14 }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/signup" style={{ display: 'block', padding: '16px', borderRadius: 14, backgroundColor: 'var(--brand)', color: 'white', fontWeight: 700, fontSize: 16, textDecoration: 'none', textAlign: 'center', transition: 'transform 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >Start gratis</Link>
              <p style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Geen creditcard nodig · Altijd opzegbaar · Veilig via Stripe</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ VEILIGHEID ═══════════════ */}
      <section style={{ padding: '60px 24px 80px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Reveal>
            <div style={{ padding: '32px', borderRadius: 20, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
              {[
                { icon: Icons.shield, title: 'PSD2 beveiligd', desc: 'Dezelfde standaard als je eigen bank. Alleen leestoegang, nooit schrijftoegang.' },
                { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>, title: 'Versleuteld opgeslagen', desc: 'EU-datacenters (Frankfurt). Row Level Security — niemand komt bij jouw data.' },
                { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="17" y1="11" x2="23" y2="11" /></svg>, title: 'Nooit gedeeld', desc: 'Geen advertenties. Geen verborgen verdienmodellen. Jouw data blijft van jou.' },
              ].map(s => (
                <div key={s.title} style={{ textAlign: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'color-mix(in srgb, var(--brand) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--brand)' }}>{s.icon}</div>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{s.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section style={{ padding: '0 24px 100px', maxWidth: 680, margin: '0 auto' }}>
        <Reveal>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>Vragen?</h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 32 }}>De antwoorden die je zoekt.</p>
        </Reveal>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {[
            { q: 'Kan Fynn geld van mijn rekening afschrijven?', a: 'Nee. Fynn heeft uitsluitend leestoegang via PSD2. Het is technisch onmogelijk om betalingen te doen of geld te verplaatsen.' },
            { q: 'Welke banken worden ondersteund?', a: 'ING, Rabobank, ABN AMRO, SNS, ASN, Bunq, Triodos, RegioBank (NL) en KBC, BNP Paribas Fortis, Belfius, ING België (BE). Meer banken worden regelmatig toegevoegd.' },
            { q: 'Hoe verschilt Fynn van andere finance apps?', a: 'De meeste apps tonen wat er al is gebeurd. Fynn vertelt je wat er gaat gebeuren — en of je een beslissing kunt veroorloven. De Chat Coach en Cashflow Radar kijken vooruit in plaats van achteruit.' },
            { q: 'Hoe helpt Fynn met abonnementen opzeggen?', a: 'Fynn detecteert al je abonnementen automatisch en waarschuwt als er iets duurder wordt. Wil je opzeggen? Fynn genereert een opzegbrief, e-mail template of telefoonscript voor die provider.' },
            { q: 'Wat is de Financiële Score?', a: 'Een getal van 0–100 dat je financiële gezondheid samenvat. Gebaseerd op spaarpercentage, schuldratio, abonnementslast en spaartempo. Wekelijks bijgewerkt en deelbaar.' },
            { q: 'Wat gebeurt er na de gratis trial?', a: 'Na 14 dagen betaal je €12,99/maand of €99/jaar. Je kunt op elk moment opzeggen — geen verborgen kosten, geen opzegtermijn.' },
            { q: 'Is mijn bankdata veilig?', a: 'Ja. Versleuteld opgeslagen in EU-datacenters. We delen nooit data met derden. Row Level Security zorgt dat niemand bij jouw data kan.' },
            { q: 'Is Fynn een financieel adviseur?', a: 'Nee. Fynn geeft inzicht op basis van je eigen data. Geen beleggingsadvies, geen Wft. Voor persoonlijk advies raden we een erkend adviseur aan.' },
          ].map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
        </div>
      </section>

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <section style={{ padding: '100px 24px', backgroundColor: 'var(--brand)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -200, right: -100, width: 500, height: 500, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -150, left: -80, width: 400, height: 400, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <Reveal>
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-1.5px', marginBottom: 16, color: 'white' }}>
              Stop met gissen.<br />Begin met weten.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 17, marginBottom: 40 }}>14 dagen gratis. Geen creditcard. Opzegbaar wanneer je wil.</p>
            <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '18px 40px', borderRadius: 14, backgroundColor: 'white', color: 'var(--brand)', fontWeight: 700, fontSize: 17, textDecoration: 'none', transition: 'transform 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >Gratis starten met Fynn</Link>
          </div>
        </Reveal>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer style={{ padding: '28px 24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'white' }}>F</div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Fynn</span>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>· Jouw financieel kompas</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <Link href="/privacy" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>Voorwaarden</Link>
            <a href="mailto:info@meetfynn.com" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>Contact</a>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>© {new Date().getFullYear()} ter Veld Holding B.V.</p>
        </div>
      </footer>
    </div>
  )
}