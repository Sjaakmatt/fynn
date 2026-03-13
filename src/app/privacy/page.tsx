// src/app/privacy/page.tsx
import Link from 'next/link'

export const metadata = {
  title: 'Privacyverklaring — Fynn',
  description: 'Hoe Fynn omgaat met jouw gegevens en bankdata.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>

      {/* Nav */}
      <nav style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--brand)' }}>
              <span className="text-white text-xs font-semibold">F</span>
            </div>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>Fynn</span>
          </Link>
          <Link
            href="/"
            className="text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted)' }}
          >
            ← Terug
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--brand)' }}>
            Versie 1.0 — {new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-2xl font-semibold mb-3" style={{ color: 'var(--text)' }}>Privacyverklaring</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Fynn neemt jouw privacy serieus. In deze verklaring leggen we uit welke gegevens we verwerken, waarom, en wat jouw rechten zijn.
          </p>
        </div>

        <div className="space-y-10">

          {/* 1 */}
          <Section title="1. Wie zijn wij?">
            <p>Fynn is een dienst van:</p>
            <div className="mt-3 p-4 rounded-xl text-sm space-y-1" style={{ backgroundColor: 'var(--tab-bg)' }}>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>ter Veld Holding B.V.</p>
              <p>Julianastraat 15, 1616CH Hoogkarspel</p>
              <p>E-mail: <a href="mailto:info@meetfynn.com" className="underline" style={{ color: 'var(--brand)' }}>info@meetfynn.com</a></p>
              <p>Website: <a href="https://www.meetfynn.nl" className="underline" style={{ color: 'var(--brand)' }}>www.meetfynn.nl</a></p>
            </div>
            <p className="mt-3">
              Fynn is een AI-gestuurde persoonlijke financiële coach die via een PSD2-koppeling inzicht geeft in jouw bankrekeningen en uitgavenpatronen. Wij verwerken persoonsgegevens uitsluitend voor de doeleinden zoals beschreven in deze privacyverklaring.
            </p>
          </Section>

          {/* 2 */}
          <Section title="2. Welke gegevens verwerken wij?">
            <SubSection title="2.1 Accountgegevens">
              <ul className="list-disc list-inside space-y-1">
                <li>E-mailadres</li>
                <li>Naam (optioneel)</li>
                <li>Wachtwoord (versleuteld — nooit leesbaar voor ons)</li>
              </ul>
            </SubSection>
            <SubSection title="2.2 Bankgegevens via PSD2">
              <p className="mb-2">Via de PSD2-koppeling ontvangen wij uitsluitend <strong>leestoegang</strong> tot:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Rekeningnummer(s) (IBAN)</li>
                <li>Rekeningnaam en rekeningtype</li>
                <li>Saldo-informatie</li>
                <li>Transacties: datum, bedrag, omschrijving, tegenpartij</li>
              </ul>
              <div
                className="mt-3 p-3 rounded-xl text-sm flex items-start gap-2"
                style={{ backgroundColor: 'rgba(74,222,128,0.08)', color: '#4ade80' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span style={{ color: 'var(--text)' }}>Wij hebben nooit schrijftoegang tot jouw bankrekening. We kunnen geen betalingen initiëren.</span>
              </div>
            </SubSection>
            <SubSection title="2.3 Gebruiksgegevens">
              <ul className="list-disc list-inside space-y-1">
                <li>Door jou ingestelde spaardoelen, budgetten en notities</li>
                <li>Jouw voorkeuren en instellingen binnen de app</li>
                <li>Technische loggegevens (foutmeldingen, sessie-informatie)</li>
              </ul>
            </SubSection>
            <SubSection title="2.4 Betalingsgegevens">
              <p>Betalingen worden verwerkt via Stripe. Wij slaan geen volledige betaalkaartgegevens op. Stripe verwerkt jouw betaalgegevens conform hun eigen privacybeleid (<a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--brand)' }}>stripe.com/privacy</a>).</p>
            </SubSection>
          </Section>

          {/* 3 */}
          <Section title="3. Waarvoor gebruiken wij jouw gegevens?">
            <ul className="list-disc list-inside space-y-2">
              <li>Het leveren van de Fynn-dienst: automatisch categoriseren van transacties, berekenen van cashflow en beschikbaar budget</li>
              <li>Het genereren van jouw wekelijkse financiële briefing en AI-coachingberichten</li>
              <li>Het beheren van jouw account en abonnement</li>
              <li>Het verbeteren en beveiligen van onze dienst</li>
              <li>Het voldoen aan wettelijke verplichtingen</li>
            </ul>
            <p className="mt-3" style={{ color: 'var(--text)' }}>Wij verkopen jouw gegevens nooit aan derden en gebruiken ze niet voor advertentiedoeleinden.</p>
          </Section>

          {/* 4 */}
          <Section title="4. Op welke grondslag verwerken wij jouw gegevens?">
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Uitvoering overeenkomst (art. 6 lid 1 sub b AVG):</strong> de verwerking van bankgegevens en accountinformatie is noodzakelijk om de Fynn-dienst te leveren.</li>
              <li><strong>Gerechtvaardigd belang (art. 6 lid 1 sub f AVG):</strong> voor het verbeteren van onze dienst en het beveiligen van onze systemen.</li>
              <li><strong>Wettelijke verplichting (art. 6 lid 1 sub c AVG):</strong> voor zover wij verplicht zijn gegevens te bewaren op grond van wet- en regelgeving.</li>
            </ul>
          </Section>

          {/* 5 */}
          <Section title="5. Hoe lang bewaren wij jouw gegevens?">
            <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--tab-bg)' }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text)' }}>Categorie</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text)' }}>Bewaartermijn</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Transactiegegevens', '12 maanden na ophalen'],
                    ['Accountgegevens', 'Zolang account actief is'],
                    ['AI-briefings en adviezen', '12 maanden'],
                    ['Spaardoelen en notities', 'Tot verwijdering door gebruiker'],
                    ['Betalingsgegevens', '7 jaar (wettelijke bewaarplicht)'],
                  ].map(([cat, term], i, arr) => (
                    <tr
                      key={cat}
                      style={{ borderTop: '1px solid var(--border)' }}
                    >
                      <td className="px-4 py-3" style={{ color: 'var(--text)' }}>{cat}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{term}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3">Na verwijdering van jouw account worden al jouw persoonsgegevens binnen 30 dagen definitief gewist, met uitzondering van gegevens waarvoor een wettelijke bewaarplicht geldt.</p>
          </Section>

          {/* 6 */}
          <Section title="6. Delen wij jouw gegevens met derden?">
            <SubSection title="6.1 Verwerkers binnen de EU">
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Supabase</strong> — database en authenticatie (EU-regio, Frankfurt)</li>
                <li><strong>Stripe Financial Connections</strong> — PSD2/open banking koppeling, onderdeel van Stripe, Inc. (zie 6.2)</li>
                <li><strong>Vercel</strong> — hosting (EU-regio)</li>
              </ul>
            </SubSection>
            <SubSection title="6.2 Verwerkers buiten de EU">
              <p className="mb-2">Voor AI-coachingfunctionaliteit (briefings, adviezen, chatberichten) gebruiken wij:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Anthropic, PBC</strong> (Claude API) — VS, doorgifte via Standard Contractual Clauses (SCC)</li>
                <li><strong>Stripe, Inc.</strong> — betalingsverwerking én open banking koppeling (Stripe Financial Connections), VS, doorgifte via SCC</li>
              </ul>
              <div
                className="mt-3 p-3 rounded-xl text-sm"
                style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: '#F59E0B' }}
              >
                <span style={{ color: 'var(--text)' }}><strong>Let op:</strong> Anthropic ontvangt uitsluitend de geanonimiseerde financiële context die nodig is voor het genereren van jouw overzicht. Ruwe transactiegegevens en IBAN-nummers worden nooit doorgegeven aan Anthropic.</span>
              </div>
            </SubSection>
          </Section>

          {/* 7 */}
          <Section title="7. Hoe beveiligen wij jouw gegevens?">
            <ul className="list-disc list-inside space-y-2">
              <li>Versleutelde verbindingen (HTTPS/TLS) voor alle communicatie</li>
              <li>Versleutelde opslag van inloggegevens</li>
              <li>Row Level Security in onze database — jij hebt alleen toegang tot jouw eigen gegevens</li>
              <li>PSD2-koppeling is uitsluitend leestoegang — nooit schrijftoegang</li>
              <li>Toegangsbeperking tot persoonsgegevens voor geautoriseerde medewerkers</li>
            </ul>
          </Section>

          {/* 8 */}
          <Section title="8. Wat zijn jouw rechten?">
            <div className="grid grid-cols-1 gap-3">
              {[
                ['Inzage', 'Opvragen welke gegevens wij van jou verwerken'],
                ['Rectificatie', 'Onjuiste gegevens laten corrigeren'],
                ['Verwijdering', 'Verzoeken jouw gegevens te laten wissen (recht op vergetelheid)'],
                ['Beperking', 'Verwerking van jouw gegevens laten beperken'],
                ['Overdraagbaarheid', 'Jouw gegevens opvragen in een machine-leesbaar formaat'],
                ['Bezwaar', 'Bezwaar maken tegen verwerking op grond van gerechtvaardigd belang'],
              ].map(([right, desc]) => (
                <div key={right} className="flex gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--tab-bg)' }}>
                  <span className="text-sm w-32 flex-shrink-0" style={{ color: 'var(--brand)' }}>{right}</span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-4">Neem contact op via <a href="mailto:info@meetfynn.com" className="underline" style={{ color: 'var(--brand)' }}>info@meetfynn.com</a> — wij reageren binnen 30 dagen.</p>
            <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>Je hebt ook het recht een klacht in te dienen bij de <a href="https://www.autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--brand)' }}>Autoriteit Persoonsgegevens</a>.</p>
          </Section>

          {/* 9 */}
          <Section title="9. Cookies">
            <p>Fynn maakt uitsluitend gebruik van functionele cookies voor het bijhouden van jouw ingelogde sessie. Wij gebruiken geen tracking cookies of advertentiecookies.</p>
          </Section>

          {/* 10 */}
          <Section title="10. AI-gegenereerde inhoud">
            <div
              className="p-4 rounded-xl text-sm"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)',
                borderLeft: '4px solid var(--brand)',
              }}
            >
              <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Fynn is een informatieplatform, geen financieel adviseur.</p>
              <p style={{ color: 'var(--muted)' }}>Alle AI-gegenereerde inhoud is uitsluitend bedoeld als persoonlijk inzicht op basis van jouw eigen transactiedata. Dit vormt geen financieel advies in de zin van de Wet op het financieel toezicht (Wft). Voor persoonlijk financieel advies raden wij aan een erkend financieel adviseur te raadplegen.</p>
            </div>
          </Section>

          {/* 11 */}
          <Section title="11. Wijzigingen">
            <p>Wij kunnen deze privacyverklaring periodiek aanpassen. Materiële wijzigingen communiceren wij via e-mail of een melding in de app. De meest actuele versie is altijd beschikbaar op <a href="https://www.meetfynn.nl/privacy" className="underline" style={{ color: 'var(--brand)' }}>www.meetfynn.nl/privacy</a>.</p>
          </Section>

          {/* 12 */}
          <Section title="12. Contact">
            <div className="p-4 rounded-xl text-sm space-y-1" style={{ backgroundColor: 'var(--tab-bg)' }}>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>ter Veld Holding B.V. — Fynn</p>
              <p>Julianastraat 15, 1616CH Hoogkarspel</p>
              <p>E-mail: <a href="mailto:info@meetfynn.com" className="underline" style={{ color: 'var(--brand)' }}>info@meetfynn.com</a></p>
              <p>Website: <a href="https://www.meetfynn.nl" className="underline" style={{ color: 'var(--brand)' }}>www.meetfynn.nl</a></p>
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 text-center text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
          <p>© {new Date().getFullYear()} ter Veld Holding B.V. — Fynn</p>
          <p className="mt-1">KvK-registratie Nederland</p>
        </div>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="text-lg font-semibold mb-4 pb-2"
        style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
      >
        {title}
      </h2>
      <div className="text-sm leading-relaxed space-y-3" style={{ color: 'var(--muted)' }}>
        {children}
      </div>
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}