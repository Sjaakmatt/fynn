// src/app/(marketing)/beta/page.tsx
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

/* ═══════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════ */
const Icons = {
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  chat: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  pulse: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  mail: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
  dollar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  clock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  scissors: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>,
  heart: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
  target: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  zap: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
}

/* ═══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function PhoneMock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 260, borderRadius: 28, padding: 10,
      backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
      boxShadow: '0 24px 48px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{ width: 60, height: 5, borderRadius: 100, backgroundColor: 'var(--tab-bg)' }} />
      </div>
      <div style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: 'var(--bg)', minHeight: 300 }}>
        {children}
      </div>
    </div>
  )
}

function MockBar({ pct, color = 'var(--brand)' }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 4, borderRadius: 100, backgroundColor: 'var(--tab-bg)', overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 100, backgroundColor: color, width: `${pct}%` }} />
    </div>
  )
}

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

function SpotsLeft({ total = 150, offset = 23 }: { total?: number; offset?: number }) {
  const [taken, setTaken] = useState(offset)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/beta/count')
      .then(r => r.json())
      .then(data => { setTaken((data.count ?? 0) + offset); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [offset])

  const left = total - taken
  const pct = (taken / total) * 100

  return (
    <div style={{
      padding: '16px 20px', borderRadius: 14,
      backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
      opacity: loaded ? 1 : 0.5, transition: 'opacity 0.3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Beta plekken</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: left <= 20 ? '#EF4444' : 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
          {left} van {total} beschikbaar
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 100, backgroundColor: 'var(--tab-bg)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 100,
          backgroundColor: left <= 20 ? '#EF4444' : 'var(--brand)',
          width: `${pct}%`, transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MOCK UI SCREENS (identical to homepage)
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
        <p style={{ color: '#4ade80', fontWeight: 600 }}>Je spaardoel &quot;Vakantie&quot; ligt op schema.</p>
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

function MockCategorisatie() {
  return (
    <div style={{ padding: '16px 12px' }}>
      <p style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10 }}>Automatische Categorisatie</p>
      {[
        { name: 'Albert Heijn', cat: 'Boodschappen', amount: '−€67,43', color: 'var(--brand)' },
        { name: 'Shell Tankstation', cat: 'Transport', amount: '−€72,10', color: '#F59E0B' },
        { name: 'Bol.com', cat: 'Shopping', amount: '−€34,99', color: '#8B5CF6' },
        { name: 'Thuisbezorgd', cat: 'Uit eten', amount: '−€28,50', color: '#EF4444' },
        { name: 'Salaris Werkgever', cat: 'Inkomen', amount: '+€3.200', color: '#4ade80' },
      ].map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: t.color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 600 }}>{t.name}</p>
            <p style={{ fontSize: 10, color: 'var(--muted)' }}>{t.cat}</p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: t.amount.startsWith('+') ? '#4ade80' : 'var(--text)' }}>{t.amount}</span>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FEATURES DATA + MODAL
   ═══════════════════════════════════════════════════════════════ */

const FEATURES = [
  { tag: 'Kern feature', title: 'Chat Coach', icon: 'chat', desc: 'Stel elke financiële vraag in gewone taal. Fynn analyseert je bankdata, vaste lasten en spaartempo en geeft een eerlijk antwoord — op basis van een cashflow projectie, niet alleen je saldo.', mock: 'chat' },
  { tag: 'Real-time overzicht', title: 'Cashflow Radar', icon: 'pulse', desc: 'Zie hoeveel je echt kunt uitgeven — niet je saldo, maar wat er overblijft nadat alle vaste lasten en abonnementen eraf zijn. Met een 30-daagse vooruitblik.', mock: 'radar' },
  { tag: 'Elke maandag', title: 'Wekelijkse Briefing', icon: 'mail', desc: 'Max. 300 woorden. Wat ging goed, wat kan beter, welke actie moet je nu nemen. Geschreven als een vriend die alles van geld weet.', mock: 'briefing' },
  { tag: 'AI-gegenereerd', title: 'Budget Planner', icon: 'dollar', desc: 'Realistisch budget op basis van je uitgavenhistorie. Per categorie zie je hoeveel je hebt besteed en hoeveel je nog kunt uitgeven. Live bijgehouden.', mock: 'budget' },
  { tag: 'Voorkom verrassingen', title: 'Vaste Lasten Kalender', icon: 'calendar', desc: 'Visueel overzicht van alle vaste lasten: wanneer wordt wat afgeschreven? Fynn waarschuwt je 3 dagen van tevoren.', mock: 'vaste' },
  { tag: 'Bespaar automatisch', title: 'Abonnement Manager', icon: 'scissors', desc: 'Alle abonnementen automatisch gedetecteerd. Fynn waarschuwt als iets duurder wordt en helpt met opzeggen.', mock: 'abo' },
  { tag: 'Deel met vrienden', title: 'Financiële Gezondheidscore', icon: 'heart', desc: 'Je financiële gezondheid in één getal van 0–100. Gebaseerd op spaarpercentage, schuldratio, abonnementslast en spaartempo.', mock: 'score' },
  { tag: 'Doelen behalen', title: 'Spaargoal Coach', icon: 'target', desc: 'Stel je doel in, Fynn berekent wat je maandelijks moet sparen en stuurt alerts als je dreigt af te wijken.', mock: 'spaar' },
  { tag: 'Automatisch', title: 'Slimme Categorisatie', icon: 'zap', desc: 'AI herkent 50+ NL/BE merchants automatisch. Van Albert Heijn tot Ziggo — geen handmatige invoer.', mock: 'cat' },
] as const

const iconMap: Record<string, React.ReactNode> = {
  chat: Icons.chat, pulse: Icons.pulse, mail: Icons.mail, dollar: Icons.dollar,
  calendar: Icons.calendar, scissors: Icons.scissors, heart: Icons.heart,
  target: Icons.target, zap: Icons.zap,
}

function renderMock(key: string) {
  switch (key) {
    case 'chat': return <MockChatCoach />
    case 'radar': return <MockCashflowRadar />
    case 'briefing': return <MockBriefing />
    case 'budget': return <MockBudget />
    case 'vaste': return <MockVasteLasten />
    case 'abo': return <MockAbonnementen />
    case 'score': return <MockHealthScore />
    case 'spaar': return <MockSpaargoal />
    case 'cat': return <MockCategorisatie />
    default: return null
  }
}

function FeaturesModal({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState(0)
  const f = FEATURES[active]

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setActive(p => (p + 1) % FEATURES.length)
      if (e.key === 'ArrowLeft') setActive(p => (p - 1 + FEATURES.length) % FEATURES.length)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 720, maxHeight: '90vh',
          backgroundColor: 'var(--bg)', borderRadius: 24,
          border: '1px solid var(--border)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.15)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>Alle features</p>
            <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>Eén abonnement. Negen tools.</h3>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: 'var(--tab-bg)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: 'var(--muted)', fontFamily: 'inherit', flexShrink: 0,
          }}>×</button>
        </div>

        {/* Feature pills */}
        <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {FEATURES.map((feat, i) => (
              <button
                key={feat.title}
                onClick={() => setActive(i)}
                style={{
                  padding: '6px 12px', borderRadius: 100, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: active === i ? 700 : 500,
                  backgroundColor: active === i ? 'var(--brand)' : 'var(--tab-bg)',
                  color: active === i ? 'white' : 'var(--muted)',
                  transition: 'all 0.2s ease',
                }}
              >{feat.title}</button>
            ))}
          </div>
        </div>

        {/* Active feature — text + phone mock */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div key={active} style={{ animation: 'slideUp 0.3s ease' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 32, alignItems: 'center',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'var(--brand)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {iconMap[f.icon]}
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.tag}</p>
                    <h3 style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.5px' }}>{f.title}</h3>
                  </div>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.7, maxWidth: 360 }}>{f.desc}</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <PhoneMock>{renderMock(f.mock)}</PhoneMock>
              </div>
            </div>
          </div>
        </div>

        {/* Footer nav */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setActive(p => (p - 1 + FEATURES.length) % FEATURES.length)} style={{
              width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)',
              backgroundColor: 'var(--bg)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontSize: 16,
            }}>←</button>
            <button onClick={() => setActive(p => (p + 1) % FEATURES.length)} style={{
              width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)',
              backgroundColor: 'var(--bg)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontSize: 16,
            }}>→</button>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>
              {active + 1} / {FEATURES.length}
            </span>
          </div>
          <Link href="/signup?ref=beta" onClick={onClose} style={{
            padding: '12px 24px', borderRadius: 12,
            backgroundColor: 'var(--brand)', color: 'white',
            fontWeight: 700, fontSize: 14, textDecoration: 'none',
            transition: 'transform 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >Claim je bèta plek</Link>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN BETA PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function BetaPage() {
  const [mounted, setMounted] = useState(false)
  const [showFeatures, setShowFeatures] = useState(false)
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
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text)' }}>
            <>
              <img src="/logo-light.png" alt="Fynn" className="logo-light" style={{ height: 40, width: 'auto' }} />
              <img src="/logo.png" alt="Fynn" className="logo-dark" style={{ height: 40, width: 'auto' }} />
            </>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ThemeToggle />
            <Link href="/login" className="hidden sm:inline-block" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 14, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Inloggen</Link>
            <Link href="/signup?ref=beta" style={{ padding: '10px 16px', borderRadius: 12, fontSize: 14, backgroundColor: 'var(--brand)', color: 'white', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>Beta aanmelden</Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════ HERO ═══════════════ */}
      <section style={{ padding: '80px 24px 60px', maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--brand) 8%, transparent) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{
          ...stagger(0),
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 100,
          backgroundColor: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)',
          marginBottom: 28,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#F59E0B' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B' }}>Exclusieve bèta — 100 plekken</span>
        </div>

        <h1 style={{ ...stagger(1), fontSize: 'clamp(34px, 5vw, 56px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2px', marginBottom: 20 }}>
          Wees er als eerste bij.<br />Betaal voor altijd minder.
        </h1>

        <p style={{ ...stagger(2), fontSize: 17, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 520, margin: '0 auto 36px' }}>
          Test Fynn 3 maanden gratis. Geef feedback die het product vormgeeft. En betaal daarna voor altijd <span style={{ fontWeight: 700, color: 'var(--text)' }}>€4,99/maand</span> in plaats van €12,99.
        </p>

        <div style={{ ...stagger(3), display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
          <Link href="/signup?ref=beta" style={{
            padding: '16px 32px', borderRadius: 14, fontSize: 16, fontWeight: 700,
            textDecoration: 'none', color: 'white', backgroundColor: 'var(--brand)',
            transition: 'transform 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >Claim je plek</Link>
          <button onClick={() => setShowFeatures(true)} style={{
            padding: '16px 28px', borderRadius: 14, fontSize: 15,
            color: 'var(--text)', backgroundColor: 'var(--tab-bg)',
            fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'transform 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >Bekijk alle features</button>
        </div>

        <p style={{ ...stagger(4), fontSize: 13, color: 'var(--muted)', marginBottom: 40 }}>Geen creditcard nodig · Eerste 3 maanden gratis</p>

        <div style={stagger(5)}>
          <SpotsLeft/>
        </div>
      </section>

      {/* ═══════════════ DE DEAL ═══════════════ */}
      <section style={{ padding: '60px 24px 80px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>De deal</p>
              <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: '-1px' }}>
                Wat je krijgt als bèta tester
              </h2>
            </div>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
            {[
              { icon: Icons.clock, title: '3 maanden gratis', desc: 'Volledige toegang tot alle features. Geen beperkingen, geen creditcard nodig bij de start.' },
              { icon: Icons.dollar, title: '€4,99/maand — voor altijd', desc: 'Na de testperiode betaal je €4,99 in plaats van €12,99. Dit tarief verandert nooit. Levenslang.' },
              { icon: Icons.users, title: 'Invloed op het product', desc: 'Jouw feedback bepaalt welke features worden gebouwd. Directe lijn met de founder.' },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08}>
                <div style={{
                  padding: '32px 24px', height: '100%',
                  backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: i === 0 ? '16px 0 0 16px' : i === 2 ? '0 16px 16px 0' : 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'color-mix(in srgb, var(--brand) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', marginBottom: 16 }}>
                    {item.icon}
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, letterSpacing: '-0.3px' }}>{item.title}</h3>
                  <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.65 }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ WAT WE VRAGEN ═══════════════ */}
      <section style={{ padding: '60px 24px 80px', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Wat we vragen</p>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 800, letterSpacing: '-0.5px' }}>
                Eerlijke feedback — gestructureerd
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.7, marginTop: 16 }}>
                Geen dagelijks werk. Drie korte momenten in drie maanden.
              </p>
            </div>
          </Reveal>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { week: 'Week 1', title: 'Eerste indruk', desc: 'Korte vragenlijst (5 min). Was het koppelen duidelijk? Klopt de categorisatie? Wat miste je?' },
              { week: 'Week 4', title: 'Gebruikservaring', desc: 'Korte vragenlijst (5 min). Gebruik je Fynn nog? Wat is het meest waardevolle onderdeel? Wat irriteert?' },
              { week: 'Week 12', title: 'Eindoordeel', desc: 'Korte vragenlijst (5 min) + optioneel een videocall van 30 minuten. Hoe heeft Fynn je financiën beïnvloed?' },
            ].map((item, i) => (
              <Reveal key={item.week} delay={i * 0.1}>
                <div style={{
                  padding: '20px 24px', borderRadius: i === 0 ? '16px 16px 0 0' : i === 2 ? '0 0 16px 16px' : 0,
                  backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
                  display: 'flex', gap: 18, alignItems: 'flex-start',
                }}>
                  <div style={{
                    padding: '4px 10px', borderRadius: 8,
                    backgroundColor: 'color-mix(in srgb, var(--brand) 8%, transparent)',
                    fontSize: 12, fontWeight: 700, color: 'var(--brand)',
                    flexShrink: 0, marginTop: 2,
                  }}>{item.week}</div>
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

      {/* ═══════════════ PRICING ═══════════════ */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Alles inbegrepen</p>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 800, letterSpacing: '-0.5px' }}>
                Volledige toegang. Geen beperkingen.
              </h2>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div style={{ padding: '32px', borderRadius: 20, backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div>
                <span style={{ fontSize: 14, color: 'var(--muted)', textDecoration: 'line-through' }}>€12,99/maand</span>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums' }}>€4,99</span>
                  <span style={{ color: 'var(--muted)', fontSize: 16 }}> / maand — voor altijd</span>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4, marginBottom: 28 }}>Na 3 maanden gratis bèta</p>
              </div>

              <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
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

              <Link href="/signup?ref=beta" style={{
                display: 'block', padding: '16px', borderRadius: 14,
                backgroundColor: 'var(--brand)', color: 'white',
                fontWeight: 700, fontSize: 16, textDecoration: 'none', textAlign: 'center',
                transition: 'transform 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >Claim je bèta plek</Link>
              <p style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Geen creditcard nodig · 3 maanden gratis · Daarna €4,99 voor altijd</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ VEILIGHEID ═══════════════ */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Reveal>
            <div style={{ padding: '32px', borderRadius: 20, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
              {[
                { icon: Icons.shield, title: 'PSD2 beveiligd', desc: 'Alleen leestoegang. Het is technisch onmogelijk om geld te verplaatsen.' },
                { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>, title: 'EU-datacenters', desc: 'Versleuteld opgeslagen in Frankfurt. Row Level Security.' },
                { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="17" y1="11" x2="23" y2="11" /></svg>, title: 'Nooit gedeeld', desc: 'Geen advertenties. Jouw data blijft van jou.' },
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
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>Vragen over de bèta?</h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 32 }}>Hier zijn de antwoorden.</p>
        </Reveal>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {[
            { q: 'Wat kost het na de bèta?', a: 'Na 3 maanden gratis betaal je €4,99 per maand. Dit tarief is levenslang — het verandert nooit, ongeacht toekomstige prijsverhogingen.' },
            { q: 'Hoeveel plekken zijn er?', a: '100 plekken, eerste come first served. Als ze vol zijn, is de bèta gesloten en geldt het reguliere tarief van €12,99/maand.' },
            { q: 'Wat wordt er van mij verwacht?', a: 'Drie korte vragenlijsten in drie maanden (elk ~5 minuten). In week 12 is er optioneel een videocall van 30 minuten. Verder gewoon Fynn gebruiken.' },
            { q: 'Kan ik opzeggen tijdens de bèta?', a: 'Ja, altijd. Geen verplichtingen, geen opzegtermijn. Je betaalt pas na de 3 maanden gratis.' },
            { q: 'Welke banken worden ondersteund?', a: 'ING, Rabobank, ABN AMRO, SNS, ASN, Bunq, Triodos, RegioBank (NL) en KBC, BNP Paribas Fortis, Belfius, ING België (BE).' },
            { q: 'Is mijn bankdata veilig?', a: 'Ja. PSD2 beveiligd, alleen leestoegang. Versleuteld opgeslagen in EU-datacenters. We delen nooit data met derden.' },
            { q: 'Is Fynn een financieel adviseur?', a: 'Nee. Fynn geeft inzicht op basis van je eigen data — geen beleggingsadvies. Voor persoonlijk advies raden we een erkend adviseur aan.' },
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
              100 plekken.<br />Eerste come, first served.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 17, marginBottom: 40 }}>3 maanden gratis. Daarna €4,99/maand — voor altijd.</p>
            <Link href="/signup?ref=beta" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '18px 40px', borderRadius: 14,
              backgroundColor: 'white', color: 'var(--brand)',
              fontWeight: 700, fontSize: 17, textDecoration: 'none',
              transition: 'transform 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >Claim je bèta plek</Link>
          </div>
        </Reveal>
      </section>

      {/* ═══════════════ FEATURES MODAL ═══════════════ */}
      {showFeatures && <FeaturesModal onClose={() => setShowFeatures(false)} />}

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer style={{ padding: '28px 24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.png" alt="Fynn" style={{ height: 32, width: 'auto' }} />
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