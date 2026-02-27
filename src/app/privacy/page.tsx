import Link from 'next/link'

export const metadata = {
  title: 'Privacyverklaring — Fynn',
  description: 'Hoe Fynn omgaat met jouw gegevens en bankdata.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg, #f9fafb)' }}>

      {/* Nav */}
      <nav className="border-b" style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#1A3A2A' }}>
              <span className="text-white text-xs font-bold">F</span>
            </div>
            <span className="font-semibold text-gray-900">Fynn</span>
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← Terug
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-10">
          <p className="text-sm font-medium mb-2" style={{ color: '#1A3A2A' }}>Versie 1.0 — {new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Privacyverklaring</h1>
          <p className="text-gray-500 text-base">
            Fynn neemt jouw privacy serieus. In deze verklaring leggen we uit welke gegevens we verwerken, waarom, en wat jouw rechten zijn.
          </p>
        </div>

        <div className="space-y-10">

          {/* 1 */}
          <Section title="1. Wie zijn wij?">
            <p>Fynn is een dienst van:</p>
            <div className="mt-3 p-4 rounded-xl text-sm space-y-1" style={{ backgroundColor: '#f3f4f6' }}>
              <p className="font-semibold text-gray-900">ter Veld Holding B.V.</p>
              <p className="text-gray-600">Julianastraat 15, 1616CH Hoogkarspel</p>
              <p className="text-gray-600">E-mail: <a href="mailto:info@meetfynn.com" className="underline" style={{ color: '#1A3A2A' }}>info@meetfynn.com</a></p>
              <p className="text-gray-600">Website: <a href="https://www.meetfynn.nl" className="underline" style={{ color: '#1A3A2A' }}>www.meetfynn.nl</a></p>
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
              <div className="mt-3 p-3 rounded-xl text-sm font-medium flex items-start gap-2" style={{ backgroundColor: '#f0fdf4', color: '#166534' }}>
                <span>🔒</span>
                <span>Wij hebben nooit schrijftoegang tot jouw bankrekening. We kunnen geen betalingen initiëren.</span>
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
              <p>Betalingen worden verwerkt via Stripe. Wij slaan geen volledige betaalkaartgegevens op. Stripe verwerkt jouw betaalgegevens conform hun eigen privacybeleid (<a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#1A3A2A' }}>stripe.com/privacy</a>).</p>
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
            <p className="mt-3 font-medium text-gray-900">Wij verkopen jouw gegevens nooit aan derden en gebruiken ze niet voor advertentiedoeleinden.</p>
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
            <div className="overflow-hidden rounded-xl border" style={{ borderColor: '#e5e7eb' }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Categorie</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Bewaartermijn</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#f3f4f6' }}>
                  {[
                    ['Transactiegegevens', '12 maanden na ophalen'],
                    ['Accountgegevens', 'Zolang account actief is'],
                    ['AI-briefings en adviezen', '12 maanden'],
                    ['Spaardoelen en notities', 'Tot verwijdering door gebruiker'],
                    ['Betalingsgegevens', '7 jaar (wettelijke bewaarplicht)'],
                  ].map(([cat, term]) => (
                    <tr key={cat}>
                      <td className="px-4 py-3 text-gray-900">{cat}</td>
                      <td className="px-4 py-3 text-gray-600">{term}</td>
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
              <div className="mt-3 p-3 rounded-xl text-sm" style={{ backgroundColor: '#fffbeb', color: '#92400e' }}>
                <strong>Let op:</strong> Anthropic ontvangt uitsluitend de geanonimiseerde financiële context die nodig is voor het genereren van jouw advies. Ruwe transactiegegevens en IBAN-nummers worden nooit doorgegeven aan Anthropic.
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
                <div key={right} className="flex gap-3 p-3 rounded-xl" style={{ backgroundColor: '#f9fafb' }}>
                  <span className="font-semibold text-sm w-32 flex-shrink-0" style={{ color: '#1A3A2A' }}>{right}</span>
                  <span className="text-sm text-gray-600">{desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-4">Neem contact op via <a href="mailto:info@meetfynn.com" className="underline font-medium" style={{ color: '#1A3A2A' }}>info@meetfynn.com</a> — wij reageren binnen 30 dagen.</p>
            <p className="mt-2 text-sm text-gray-500">Je hebt ook het recht een klacht in te dienen bij de <a href="https://www.autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#1A3A2A' }}>Autoriteit Persoonsgegevens</a>.</p>
          </Section>

          {/* 9 */}
          <Section title="9. Cookies">
            <p>Fynn maakt uitsluitend gebruik van functionele cookies voor het bijhouden van jouw ingelogde sessie. Wij gebruiken geen tracking cookies of advertentiecookies.</p>
          </Section>

          {/* 10 */}
          <Section title="10. AI-gegenereerde inhoud">
            <div className="p-4 rounded-xl border-l-4 text-sm" style={{ backgroundColor: '#f0fdf4', borderColor: '#1A3A2A' }}>
              <p className="font-semibold text-gray-900 mb-1">Fynn is een informatieplatform, geen financieel adviseur.</p>
              <p className="text-gray-600">Alle AI-gegenereerde inhoud is uitsluitend bedoeld als persoonlijk inzicht op basis van jouw eigen transactiedata. Dit vormt geen financieel advies in de zin van de Wet op het financieel toezicht (Wft). Voor persoonlijk financieel advies raden wij aan een erkend financieel adviseur te raadplegen.</p>
            </div>
          </Section>

          {/* 11 */}
          <Section title="11. Wijzigingen">
            <p>Wij kunnen deze privacyverklaring periodiek aanpassen. Materiële wijzigingen communiceren wij via e-mail of een melding in de app. De meest actuele versie is altijd beschikbaar op <a href="https://www.meetfynn.nl/privacy" className="underline" style={{ color: '#1A3A2A' }}>www.meetfynn.nl/privacy</a>.</p>
          </Section>

          {/* 12 */}
          <Section title="12. Contact">
            <div className="p-4 rounded-xl text-sm space-y-1" style={{ backgroundColor: '#f3f4f6' }}>
              <p className="font-semibold text-gray-900">ter Veld Holding B.V. — Fynn</p>
              <p className="text-gray-600">Julianastraat 15, 1616CH Hoogkarspel</p>
              <p className="text-gray-600">E-mail: <a href="mailto:info@meetfynn.com" className="underline" style={{ color: '#1A3A2A' }}>info@meetfynn.com</a></p>
              <p className="text-gray-600">Website: <a href="https://www.meetfynn.nl" className="underline" style={{ color: '#1A3A2A' }}>www.meetfynn.nl</a></p>
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t text-center text-xs text-gray-400" style={{ borderColor: '#e5e7eb' }}>
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
      <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b" style={{ borderColor: '#e5e7eb' }}>
        {title}
      </h2>
      <div className="text-gray-600 text-sm leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}