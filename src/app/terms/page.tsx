// src/app/terms/page.tsx

export const metadata = {
  title: 'Algemene Voorwaarden | Fynn',
  description: 'Algemene voorwaarden van Fynn — AI persoonlijk financieel coach',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <a
            href="/"
            className="text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--brand)' }}
          >
            ← Terug naar Fynn
          </a>
          <h1 className="text-2xl font-semibold mt-6 mb-2" style={{ color: 'var(--text)' }}>
            Algemene Voorwaarden
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Versie 1.0 — Laatst bijgewerkt: 1 maart 2026
          </p>
        </div>

        <div className="max-w-none space-y-10 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>

          {/* Intro */}
          <section>
            <p>
              Deze algemene voorwaarden zijn van toepassing op het gebruik van Fynn, een AI-ondersteunde
              persoonlijke financiële coach aangeboden door <strong style={{ color: 'var(--text)' }}>Fynn B.V.</strong> (hierna: &quot;Fynn&quot;,
              &quot;wij&quot; of &quot;ons&quot;), gevestigd in Nederland. Door een account aan te maken
              en gebruik te maken van onze diensten, ga je akkoord met deze voorwaarden.
            </p>
          </section>

          <Section number="1" title="Definities">
            <p>In deze voorwaarden wordt verstaan onder:</p>
            <ul>
              <li><strong style={{ color: 'var(--text)' }}>Dienst:</strong> de Fynn-applicatie, inclusief alle functies zoals bankintegratie, AI-coaching, uitgavenanalyse en financiële inzichten.</li>
              <li><strong style={{ color: 'var(--text)' }}>Gebruiker:</strong> de natuurlijke persoon die een account aanmaakt en de Dienst gebruikt voor persoonlijk, niet-commercieel gebruik.</li>
              <li><strong style={{ color: 'var(--text)' }}>Bankdata:</strong> transactiegegevens en rekeningsaldi die via PSD2-geautoriseerde open banking worden opgehaald bij jouw bank.</li>
              <li><strong style={{ color: 'var(--text)' }}>Abonnement:</strong> het betaalde toegangsrecht tot de volledige functionaliteit van de Dienst.</li>
            </ul>
          </Section>

          <Section number="2" title="De Dienst">
            <p>
              Fynn is een persoonlijk financieel inzichtstool. De Dienst analyseert jouw bankdata en
              geeft inzicht in uitgaven, vaste lasten en financiële patronen. Alle analyses en
              AI-gegenereerde inzichten zijn <strong style={{ color: 'var(--text)' }}>informatief van aard</strong> en vormen
              geen financieel, juridisch of fiscaal advies.
            </p>
            <p>
              Fynn is <strong style={{ color: 'var(--text)' }}>geen financieel adviseur</strong> in de zin van de Wet op het financieel toezicht (Wft).
              Beslissingen over investeringen, leningen, verzekeringen of andere financiële producten neem
              je altijd op eigen verantwoordelijkheid.
            </p>
          </Section>

          <Section number="3" title="Toegang tot bankdata via PSD2">
            <p>
              Fynn maakt gebruik van PSD2 (Payment Services Directive 2) om met jouw toestemming
              toegang te krijgen tot jouw bankrekening(en). Dit gebeurt via een geregistreerde
              Account Information Service Provider (AISP).
            </p>
            <ul>
              <li>Fynn heeft uitsluitend <strong style={{ color: 'var(--text)' }}>leestoegang</strong> tot je bankdata. Wij kunnen nooit betalingen initiëren of geld overmaken.</li>
              <li>Toegang wordt verleend voor een periode van maximaal <strong style={{ color: 'var(--text)' }}>90 dagen</strong>, waarna je opnieuw toestemming geeft.</li>
              <li>Je kunt de koppeling op elk moment intrekken via de app of direct bij je bank.</li>
              <li>Bankdata wordt verwerkt conform onze <a href="/privacy" style={{ color: 'var(--brand)' }}>Privacyverklaring</a> en de AVG/GDPR.</li>
            </ul>
          </Section>

          <Section number="4" title="Account en toegang">
            <p>
              Om Fynn te gebruiken, maak je een persoonlijk account aan. Je bent verantwoordelijk voor:
            </p>
            <ul>
              <li>De juistheid van de door jou verstrekte gegevens.</li>
              <li>De vertrouwelijkheid van je inloggegevens.</li>
              <li>Alle activiteiten die plaatsvinden via jouw account.</li>
            </ul>
            <p>
              Fynn is uitsluitend bestemd voor personen van <strong style={{ color: 'var(--text)' }}>18 jaar en ouder</strong> die
              woonachtig zijn in Nederland of België.
            </p>
          </Section>

          <Section number="5" title="Abonnement en betaling">
            <p>
              Fynn biedt een betaald abonnement aan. De actuele prijzen zijn altijd te vinden op
              onze website. Op dit moment bieden wij:
            </p>
            <ul>
              <li><strong style={{ color: 'var(--text)' }}>Gratis proefperiode:</strong> 14 dagen volledige toegang, geen creditcard vereist.</li>
              <li><strong style={{ color: 'var(--text)' }}>Fynn Pro maandelijks:</strong> €12,99/maand, maandelijks opzegbaar.</li>
              <li><strong style={{ color: 'var(--text)' }}>Fynn Pro jaarlijks:</strong> €99/jaar, jaarlijks opzegbaar.</li>
            </ul>
            <p>
              Betalingen worden verwerkt via Stripe. Abonnementen worden automatisch verlengd
              tenzij je minimaal <strong style={{ color: 'var(--text)' }}>24 uur voor het einde</strong> van de lopende periode opzegt.
              Je kunt opzeggen via de instellingen in de app.
            </p>
            <p>
              Terugbetalingen worden beoordeeld op individuele basis. Bij technische storingen van
              onze kant streven wij naar een redelijke compensatie.
            </p>
          </Section>

          <Section number="6" title="Toegestaan gebruik">
            <p>Je mag de Dienst uitsluitend gebruiken voor persoonlijke, niet-commerciële doeleinden. Het is niet toegestaan om:</p>
            <ul>
              <li>De Dienst te gebruiken voor zakelijke of commerciële doeleinden zonder voorafgaande schriftelijke toestemming.</li>
              <li>De Dienst te reverse-engineeren, kopiëren of afgeleide producten te maken.</li>
              <li>Geautomatiseerde toegang te gebruiken (bots, scrapers) anders dan de officiële API-integraties.</li>
              <li>De Dienst te gebruiken op een manier die in strijd is met toepasselijk recht.</li>
            </ul>
          </Section>

          <Section number="7" title="Beschikbaarheid en wijzigingen">
            <p>
              Wij streven naar een beschikbaarheid van 99,5% per maand, maar garanderen dit niet.
              Wij kunnen de Dienst of onderdelen daarvan tijdelijk offline halen voor onderhoud.
            </p>
            <p>
              Wij behouden het recht om functies toe te voegen, te wijzigen of te verwijderen.
              Bij ingrijpende wijzigingen informeren wij je minimaal <strong style={{ color: 'var(--text)' }}>30 dagen van tevoren</strong>{' '}
              via e-mail.
            </p>
          </Section>

          <Section number="8" title="Aansprakelijkheid">
            <p>
              Fynn is niet aansprakelijk voor schade die voortvloeit uit:
            </p>
            <ul>
              <li>Financiële beslissingen genomen op basis van inzichten of analyses van de Dienst.</li>
              <li>Onvolledige of onjuiste bankdata aangeleverd door jouw bank.</li>
              <li>Tijdelijke onbeschikbaarheid van de Dienst.</li>
              <li>Ongeautoriseerde toegang tot je account als gevolg van nalatigheid van jouw kant.</li>
            </ul>
            <p>
              Onze aansprakelijkheid is in alle gevallen beperkt tot het bedrag dat jij in de
              afgelopen drie maanden aan abonnementskosten hebt betaald.
            </p>
          </Section>

          <Section number="9" title="Intellectueel eigendom">
            <p>
              Alle rechten op de Dienst, inclusief software, ontwerp, teksten en AI-modellen,
              berusten bij Fynn B.V. of haar licentiegevers. Jij behoudt alle rechten op je
              eigen financiële data.
            </p>
          </Section>

          <Section number="10" title="Beëindiging">
            <p>
              Je kunt je account op elk moment verwijderen via de instellingen. Na verwijdering
              worden je persoonsgegevens verwijderd conform onze Privacyverklaring.
            </p>
            <p>
              Wij kunnen je account opschorten of beëindigen bij ernstig misbruik of overtreding
              van deze voorwaarden, na voorafgaande waarschuwing tenzij de ernst van de overtreding
              directe beëindiging rechtvaardigt.
            </p>
          </Section>

          <Section number="11" title="Toepasselijk recht en geschillen">
            <p>
              Op deze voorwaarden is <strong style={{ color: 'var(--text)' }}>Nederlands recht</strong> van toepassing.
              Geschillen worden bij voorkeur in onderling overleg opgelost. Lukt dat niet,
              dan is de bevoegde rechter in het arrondissement Amsterdam exclusief bevoegd.
            </p>
            <p>
              Als consument kun je ook gebruik maken van het ODR-platform van de Europese
              Commissie: <a href="https://ec.europa.eu/odr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>ec.europa.eu/odr</a>.
            </p>
          </Section>

          <Section number="12" title="Wijzigingen in de voorwaarden">
            <p>
              Wij kunnen deze voorwaarden aanpassen. Bij wijzigingen die jouw rechten beperken,
              ontvang je minimaal 30 dagen van tevoren een e-mail. Door de Dienst te blijven
              gebruiken na de ingangsdatum ga je akkoord met de nieuwe voorwaarden.
            </p>
          </Section>

          <Section number="13" title="Contact">
            <p>
              Heb je vragen over deze voorwaarden? Neem contact op via:{' '}
              <a href="mailto:support@meetfynn.nl" style={{ color: 'var(--brand)' }}>support@meetfynn.nl</a>
            </p>
            <p className="text-xs mt-4" style={{ color: 'var(--muted)' }}>
              Fynn B.V.<br />
              Nederland<br />
              KVK: [in te vullen na inschrijving]
            </p>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 text-center text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
          <p>© {new Date().getFullYear()} ter Veld Holding B.V. — Fynn</p>
        </div>
      </div>
    </main>
  )
}

function Section({ number, title, children }: {
  number: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2
        className="text-lg font-semibold mb-3 pb-2"
        style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
      >
        Artikel {number}. {title}
      </h2>
      <div className="space-y-3 text-sm" style={{ color: 'var(--muted)' }}>
        {children}
      </div>
    </section>
  )
}