'use client'

import { useState } from 'react'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Sora', sans-serif", backgroundColor: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', padding: '0 32px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              backgroundColor: '#1A3A2A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#F0EDE8'
            }}>F</div>
            <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px', color: 'var(--text)' }}>Fynn</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ThemeToggle />
            <Link href="/login" style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 14,
              color: 'var(--muted)', textDecoration: 'none', fontWeight: 500
            }}>Inloggen</Link>
            <Link href="/signup" style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 14,
              backgroundColor: '#1A3A2A', color: '#F0EDE8', textDecoration: 'none',
              fontWeight: 600
            }}>Gratis starten</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '120px 32px 100px', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ maxWidth: 680 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3A2A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 28 }}>
            AI Personal Finance · Nederland & België
          </p>
          <h1 style={{
            fontSize: 'clamp(42px, 6vw, 76px)',
            fontWeight: 800, lineHeight: 1.02,
            letterSpacing: '-2.5px', marginBottom: 28,
            color: 'var(--text)'
          }}>
            Eindelijk weten<br />waar je aan toe bent.
          </h1>
          <p style={{
            fontSize: 19, color: 'var(--muted)', lineHeight: 1.65,
            maxWidth: 520, marginBottom: 44, fontWeight: 400
          }}>
            Fynn koppelt je bankrekening, analyseert je cashflow en geeft je
            elke week een eerlijk antwoord — in gewone taal, zonder jargon.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/signup" style={{
              padding: '14px 28px', borderRadius: 10, fontSize: 16,
              fontWeight: 700, textDecoration: 'none', color: '#F0EDE8',
              backgroundColor: '#1A3A2A',
              display: 'inline-flex', alignItems: 'center', gap: 8
            }}>
              Start 14 dagen gratis
              <span>→</span>
            </Link>
            <a href="#hoe-het-werkt" style={{
              padding: '14px 24px', borderRadius: 10, fontSize: 15,
              fontWeight: 500, textDecoration: 'none', color: 'var(--muted)',
              border: '1px solid var(--border)',
            }}>
              Hoe werkt het?
            </a>
          </div>
          <p style={{ marginTop: 18, fontSize: 13, color: 'var(--muted)' }}>
            Geen creditcard nodig · €12,99/maand na trial · Altijd opzegbaar
          </p>
        </div>
      </section>

      {/* Divider met stats */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 32px', display: 'flex', gap: 0, flexWrap: 'wrap' }}>
          {[
            { num: 'PSD2', label: 'Alleen leestoegang' },
            { num: '< 3 min', label: 'Rekening koppelen' },
            { num: '14 dagen', label: 'Gratis proberen' },
            { num: '€12,99', label: 'Per maand daarna' },
          ].map((item, i) => (
            <div key={item.num} style={{
              flex: '1 1 180px', padding: '8px 32px',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)', letterSpacing: '-0.5px' }}>{item.num}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Probleem */}
      <section style={{ padding: '100px 32px', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 80, alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
              Het probleem
            </p>
            <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 20, color: 'var(--text)' }}>
              Je kijkt naar je saldo.<br />Niet naar je<br />echte situatie.
            </h2>
            <p style={{ color: 'var(--muted)', lineHeight: 1.75, fontSize: 16, maxWidth: 400 }}>
              Je saldo zegt €1.200. Maar de huur, verzekering en abonnementen
              gaan er nog af. Je echte vrije ruimte is €180 — en dat weet je niet.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              { num: '01', title: 'Je Excel houdt niemand bij', desc: 'Handmatig invoeren duurt 20 minuten en staat altijd achter.' },
              { num: '02', title: 'Abonnementen sluipen omhoog', desc: 'Netflix +€3, Spotify +€2 — je merkt het pas als het te laat is.' },
              { num: '03', title: 'Grote beslissingen voelen onzeker', desc: 'Kun je die vakantie betalen? Je gist maar een antwoord.' },
            ].map(item => (
              <div key={item.num} style={{
                padding: '22px 24px', borderRadius: 14,
                backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                display: 'flex', gap: 20, alignItems: 'flex-start'
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', letterSpacing: '0.05em', flexShrink: 0, marginTop: 2 }}>{item.num}</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: 'var(--text)' }}>{item.title}</p>
                  <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hoe het werkt */}
      <section id="hoe-het-werkt" style={{ padding: '80px 32px', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>
            Hoe het werkt
          </p>
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1px', textAlign: 'center', marginBottom: 64, color: 'var(--text)' }}>
            Klaar in drie minuten. Inzicht direct.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2 }}>
            {[
              { step: '1', title: 'Koppel je rekening', desc: 'Verbind via PSD2. Alleen leestoegang — schrijftoegang is technisch onmogelijk.', accent: '#1A3A2A' },
              { step: '2', title: 'Fynn analyseert', desc: 'Vaste lasten, spaartempo, cashflow — automatisch gedetecteerd. Nul handmatig werk.', accent: '#1A3A2A' },
              { step: '3', title: 'Stel je vraag', desc: '"Kan ik naar Barcelona?" Fynn antwoordt op basis van je projectie, niet je saldo.', accent: '#1A3A2A' },
              { step: '4', title: 'Ontvang je briefing', desc: 'Elke maandag 300 woorden. Wat ging goed, wat kan beter, wat moet je nu doen.', accent: '#1A3A2A' },
            ].map((item, i) => (
              <div key={item.step} style={{
                padding: '32px 28px',
                backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: i === 0 ? '16px 0 0 16px' : i === 3 ? '0 16px 16px 0' : 0,
                position: 'relative'
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  backgroundColor: '#1A3A2A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, color: '#F0EDE8', fontWeight: 800, marginBottom: 20
                }}>{item.step}</div>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, letterSpacing: '-0.2px', color: 'var(--text)' }}>{item.title}</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '100px 32px', maxWidth: 1080, margin: '0 auto' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>
          Alles inbegrepen
        </p>
        <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1px', textAlign: 'center', marginBottom: 64, color: 'var(--text)' }}>
          Geen 47 grafieken.<br />Één eerlijk antwoord.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {[
            { icon: '↗', title: 'Cashflow Radar', desc: 'Zie je echte vrije ruimte — inclusief alle vaste lasten die nog komen. Niet je saldo, maar je werkelijkheid.' },
            { icon: '◎', title: 'AI Coach', desc: 'Stel elke financiële vraag in gewone taal. Eerlijk antwoord op basis van jouw echte data, niet een AI die raadt.' },
            { icon: '✦', title: 'Wekelijkse Briefing', desc: 'Elke maandag een persoonlijk overzicht. Geschreven als een vriend die toevallig alles van geld weet.' },
            { icon: '◈', title: 'Budget Planner', desc: 'AI maakt een realistisch budget op basis van je geschiedenis. Aanpasbaar, live bijgehouden.' },
            { icon: '✓', title: 'Abonnement Manager', desc: 'Alle abonnementen automatisch gedetecteerd. Inclusief alerting als er iets omhoog gaat.' },
            { icon: '⬡', title: 'Gezondheidscore', desc: 'Je financiële situatie in één getal. Wekelijks bijgewerkt. Deelbaar met vrienden.' },
          ].map(f => (
            <div key={f.title} style={{
              padding: '28px',
              borderRadius: 16,
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                backgroundColor: '#1A3A2A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 18, fontSize: 15, color: '#F0EDE8', fontWeight: 700
              }}>{f.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, letterSpacing: '-0.3px', color: 'var(--text)' }}>{f.title}</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quote */}
      <section style={{ padding: '80px 32px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <p style={{ fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: 600, lineHeight: 1.5, letterSpacing: '-0.5px', marginBottom: 28, color: 'var(--text)' }}>
            "Ik had altijd het gevoel dat er te weinig overbleef aan het einde van de maand — maar ik wist niet waarom. Fynn liet me in één week zien waar het misging."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              backgroundColor: '#1A3A2A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#F0EDE8'
            }}>M</div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Marieke, 31 — Amsterdam</p>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Beta gebruiker</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '100px 32px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>
            Pricing
          </p>
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 48, color: 'var(--text)', textAlign: 'center' }}>
            Eén plan. Alles inbegrepen.
          </h2>
          <div style={{
            padding: '40px', borderRadius: 20,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
          }}>
            <div style={{
              display: 'inline-flex', padding: '4px 10px', borderRadius: 6,
              backgroundColor: '#1A3A2A',
              fontSize: 11, color: '#F0EDE8', fontWeight: 700, marginBottom: 24,
              letterSpacing: '0.05em', textTransform: 'uppercase'
            }}>14 dagen gratis</div>

            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-2px', color: 'var(--text)' }}>€12,99</span>
              <span style={{ color: 'var(--muted)', fontSize: 15 }}> / maand</span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>
              Of €99 per jaar — twee maanden gratis
            </p>

            <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'AI Coach — stel elke financiële vraag',
                'Cashflow Radar & 30-daagse projectie',
                'Wekelijkse persoonlijke briefing',
                'Automatische categorisatie',
                'Budget planner & gezondheidscore',
                'Abonnement manager met alerts',
                'ING, Rabobank, ABN AMRO, KBC & meer',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 5,
                    backgroundColor: '#1A3A2A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 10, color: '#F0EDE8', fontWeight: 700
                  }}>✓</div>
                  <span style={{ fontSize: 14, color: 'var(--text)' }}>{f}</span>
                </div>
              ))}
            </div>

            <Link href="/signup" style={{
              display: 'block', padding: '15px', borderRadius: 10,
              backgroundColor: '#1A3A2A',
              color: '#F0EDE8', fontWeight: 700, fontSize: 16,
              textDecoration: 'none', textAlign: 'center',
            }}>
              Start gratis →
            </Link>

            <p style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Geen creditcard nodig · Altijd opzegbaar · Veilig via Stripe
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '0 32px 100px', maxWidth: 680, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 32, color: 'var(--text)' }}>
          Veelgestelde vragen
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { q: 'Kan Fynn geld van mijn rekening afschrijven?', a: 'Nee. Fynn heeft uitsluitend leestoegang via de PSD2-standaard. Het is technisch onmogelijk om betalingen te doen of geld te verplaatsen.' },
            { q: 'Welke banken worden ondersteund?', a: 'ING, Rabobank, ABN AMRO, SNS, ASN en RegioBank (Nederland) en KBC, BNP Paribas Fortis en ING België (België). Meer banken worden regelmatig toegevoegd.' },
            { q: 'Hoe verschilt Fynn van Dyme?', a: 'Dyme toont je wat er al is gebeurd. Fynn vertelt je wat er gaat gebeuren — en of je een beslissing kunt veroorloven. De Chat Coach en Cashflow Radar zijn uniek.' },
            { q: 'Wat gebeurt er na de gratis trial?', a: 'Na 14 dagen betaal je automatisch €12,99/maand via kaart of SEPA incasso. Je kunt altijd opzeggen — er zijn geen verborgen kosten of opzegtermijn.' },
            { q: 'Is mijn bankdata veilig?', a: 'Ja. Je data wordt versleuteld opgeslagen en nooit gedeeld met derden. We gebruiken dezelfde PSD2-beveiligingsstandaard als Nederlandse banken.' },
          ].map((faq, i) => (
            <FaqItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '80px 32px', backgroundColor: '#1A3A2A' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-1.5px', marginBottom: 16, color: '#F0EDE8' }}>
            Stop met gissen.<br />Begin met weten.
          </h2>
          <p style={{ color: 'rgba(240,237,232,0.6)', fontSize: 17, marginBottom: 40 }}>
            14 dagen gratis. Geen creditcard. Opzegbaar wanneer je wil.
          </p>
          <Link href="/signup" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '16px 36px', borderRadius: 12,
            backgroundColor: '#F0EDE8',
            color: '#1A3A2A', fontWeight: 700, fontSize: 17,
            textDecoration: 'none',
          }}>
            Gratis starten met Fynn →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '28px 32px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              backgroundColor: '#1A3A2A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#F0EDE8'
            }}>F</div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Fynn</span>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>· Jouw financieel kompas</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Privacy', 'Voorwaarden', 'Contact'].map(link => (
              <a key={link} href="#" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>{link}</a>
            ))}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            © {new Date().getFullYear()} Fynn · Gemaakt in Nederland
          </p>
        </div>
      </footer>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      borderRadius: 10, border: '1px solid var(--border)',
      overflow: 'hidden', backgroundColor: 'var(--surface)',
      marginBottom: 2
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '16px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text)', fontFamily: "'Sora', sans-serif",
          fontSize: 15, fontWeight: 600, textAlign: 'left', gap: 16
        }}
      >
        <span>{q}</span>
        <span style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: 6,
          backgroundColor: open ? '#1A3A2A' : 'var(--tab-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: open ? '#F0EDE8' : 'var(--muted)',
          transition: 'all 0.15s'
        }}>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 16px', color: 'var(--muted)', fontSize: 14, lineHeight: 1.65 }}>
          {a}
        </div>
      )}
    </div>
  )
}