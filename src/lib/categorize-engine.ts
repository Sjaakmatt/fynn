// src/lib/categorize-engine.ts
// Rule-based transactie categorisatie — geen AI calls
// Prioriteit: merchant_user_overrides > merchant_map.category > rules > 'overig'
// Deterministisch, gratis, <1ms per transactie
//
// ⚠️  Ontworpen voor duizenden gebruikers — geen bias op individuele transactiedata.
//     Keywords moeten generiek werken voor alle NL/BE banken en beschrijvingsformaten.
//
// ⚠️  Keywords moeten matchen op ZOWEL BEA/PIN descriptions ("Albert Heijn 1664")
//     ALS iDEAL/SEPA descriptions ("Etos B.V.", "Amazon EU SARL", "Canva Pty Ltd").
//     Voeg daarom altijd een korte/generieke variant toe naast specifieke varianten.

export type Category =
  | 'wonen'
  | 'boodschappen'
  | 'eten & drinken'
  | 'transport'
  | 'abonnementen'
  | 'kleding'
  | 'gezondheid'
  | 'entertainment'
  | 'sparen'
  | 'inkomen'
  | 'toeslagen'
  | 'interne_overboeking'
  | 'overig'

interface Rule {
  keywords: string[]
  category: Category
  amountCheck?: (amount: number) => boolean
}

// ── RULES (fallback als merchant_map geen category heeft) ──────
//
// Volgorde is belangrijk: eerste match wint.
// Meer specifieke regels staan boven bredere regels.
// Keywords zijn lowercase en worden pre-genormaliseerd bij module load.

const RULES: Rule[] = [
  // ── INKOMEN (alleen echt verdiend inkomen) ─────────────────────
  {
    keywords: [
      'salaris', 'loon', 'salary', 'werkgever', 'payroll', 'nettoloon',
      'salarisrekening',
      'maandloon', 'uitbetaling loon', 'vakantiegeld', 'dertiende maand',
      'tantieme', 'freelance betaling', 'zzp betaling', 'factuur ontvangen',
      'rente-inkomsten', 'rente inkomsten', 'rentevergoeding',
      'uwv', 'ww uitkering', 'wga',
      'pensioen uitkering',
      'dividenduitkering', 'dividend',
    ],
    category: 'inkomen',
    amountCheck: (a) => a > 0,
  },

  // ── TOESLAGEN (overheid, apart van inkomen) ──────────────────
  {
    keywords: [
      'zorgtoeslag', 'huurtoeslag', 'kinderbijslag', 'kindertoeslag',
      'kinderopvangtoeslag', 'toeslagen',
      'svb', 'sociale verzekeringsbank',
      'aow', 'bijstand', 'belastingteruggave', 'belasting teruggave',
    ],
    category: 'toeslagen',
    amountCheck: (a) => a > 0,
  },

  // ── SPAREN ───────────────────────────────────────────────────────
  {
    keywords: [
      'spaarrekening', 'spaartegoed', 'naar spaar', 'spaarrekening overboeking',
      'oranje spaarrekening', 'rabo sparen', 'asr sparen', 'nn sparen',
      'direct sparen', 'internetsparen', 'flexibel sparen', 'jongerengroeirekening',
      'degiro', 'bux zero', 'peaks ', 'brand new day', 'meesman', 'binck', 'saxo',
      'beleggingsrekening', 'pensioenpremie', 'lijfrente', 'deposito',
      'northern trust', 'vanguard', 'indexfonds',
    ],
    category: 'sparen',
    amountCheck: (a) => a < 0,
  },

  // ── WONEN ────────────────────────────────────────────────────────
  {
    keywords: [
      'huur', 'hypotheek', 'servicekosten', 'vve bijdrage', 'huurcommissie',
      'woonbron', 'vestia', 'ymere', 'havensteder', 'woningstichting',
      'stadswonen', 'huurpenningen', 'huurprijs',
      'nuon', 'vattenfall', 'vattenfall klantenservice', 'eneco', 'essent', 'greenchoice',
      'budget energie', 'tibber', 'electrabel', 'eandis', 'fluvius',
      'delta energie',
      'waternet', 'evides', 'brabant water', 'vitens', 'dunea', 'pwn',
      'waterrekening', 'drinkwater', 'waterleidingbedrijf',
      'ozb', 'rioolheffing', 'afvalstoffenheffing', 'gemeenteheffing',
      'gemeentebelasting',
      'erfpacht', 'woonlasten',
      'ziggo', 'kpn internet', 'odido thuis', 't-mobile thuis',
      'tele2 thuis', 'delta fiber', 'caiway', 'online.nl',
      'loodgieter', 'installateur', 'cv ketel', 'cv en lucht',
      'liftinstallatie', 'dakdekker', 'schilder', 'glazenwasser',
      'schoorsteenveger', 'elektricien',
      'basispakket', 'bankkosten',
      'gamma', 'praxis', 'hornbach', 'karwei', 'bouwmarkt',
      // Verzekeringen (wonen, niet gezondheid — want het is een vaste last)
      'woonverzekering', 'inboedelverzekering', 'opstalverzekering',
      'centraal beheer', 'nationale-nederlanden',
      'nn verzekering', 'interpolis', 'aegon verzekering',
      'asr verzekering', 'allianz verzekering', 'reaal verzekering',
      'unive verzekering', 'nh1816', 'nh 1816', 'inshared',
      'hema verzekering', 'autoverzekering',
      // Overheid & belastingen (vaste last)
      'belastingdienst',
      'waterschapsbelasting', 'hoogheemraadschap', 'waterschap',
      'duo studiefinanciering', 'dienst uitvoering onderwijs', 'duo hoofdrekening',
      // Kinderopvang (vaste last)
      'kinderdagverblijf', 'buitenschoolse opvang',
      'kinderopvang', 'gastouder', 'peuterspeelzaal',
      'naschoolse opvang',
      // Gemeente
      'gemeente',
    ],
    category: 'wonen',
  },

  // ── OVERHEID (overig — niet wonen, niet inkomen) ────────────────
  {
    keywords: [
      'cak eigen bijdrage', 'centraal administratie kantoor',
      'rdw kentekenregistratie', 'rijksdienst voor',
      'cjib boete', 'naheffing',
    ],
    category: 'overig',
  },

  // ── TRANSPORT ────────────────────────────────────────────────────
  {
    keywords: [
      'ns reizigers', 'ns.nl', 'ov-chipkaart', 'ov chipkaart', 'translink',
      'gvb amsterdam', 'ret rotterdam', 'htm den haag', 'connexxion', 'arriva bus',
      'qbuzz', 'de lijn', 'mivb', 'stib', 'nmbs', 'sncb',
      'uber trip', 'uber ride', 'bolt taxi', 'lyft', 'cabify',
      'shell tankstation', 'bp tankstation', 'esso ', 'total energies',
      'q8 tankstation', 'texaco',
      'tinq ', 'tango tankstation', 'brandstof', 'benzine', 'diesel',
      'tankstation', 'tanken',
      'parkeren', 'parkeermeter', 'q-park', 'apcoa', 'interparking',
      'parkbee', 'yellowbrick', 'p1 parking', 'parkmobile',
      'wegenbelasting', 'motorrijtuigenbelasting',
      'anwb lidmaatschap', 'autoverzekering',
      'volkswagen pon', 'autolease', 'lease plan', 'athlon',
      'swapfiets', 'lease fiets',
      'felyx', 'check scooter', 'dott scooter', 'tier scooter', 'lime scooter',
      'ryanair', 'transavia', 'easyjet', 'klm ', 'tui fly', 'wizz air',
      'schiphol', 'eindhoven airport',
      'ns treinen', 'treinkaartje',
      'tamoil', 'wasstraat',
      'parkeergelden',
    ],
    category: 'transport',
  },

  // ── ENTERTAINMENT (vóór boodschappen — voorkomt overlap) ─────────
  {
    keywords: [
      'mediamarkt', 'coolblue', 'fnac', 'bcc electronica',
      'steam store', 'playstation store', 'xbox store', 'nintendo eshop',
      'epic games',
      'bioscoop', 'pathe bioscoop', 'vue cinema', 'kinepolis',
      'theater', 'concertzaal', 'museum', 'attractiepark',
      'pretpark', 'efteling', 'walibi', 'duinrell',
      'sprookjeswonderland', 'artis', 'madurodam', 'nemo science',
      'booking.com', 'airbnb', 'hotels.com', 'expedia',
      'sunweb', 'tui reizen', 'd-reizen', 'corendon', 'neckermann',
      'ticketmaster', 'eventbrite', 'ticketswap',
      // Amazon & Bol — bare keywords voor iDEAL ("Amazon EU SARL", "BOLCOM BV")
      'amazon.nl', 'amazon.de', 'amazon.com', 'amazon ', 'bol.com', 'bolcom',
      // Huishoudwinkels (niet kleding, niet boodschappen)
      'hema', 'action ',
      // Huisdier
      'brekz',
    ],
    category: 'entertainment',
  },

  // ── BOODSCHAPPEN ─────────────────────────────────────────────────
  {
    keywords: [
      'albert heijn', 'ah to go',
      'jumbo supermarkt', 'jumbo ',
      'lidl nederland', 'lidl ',
      'aldi markt', 'aldi ',
      'plus supermarkt', 'coop supermarkt', 'spar supermarkt',
      'hoogvliet', 'vomar', 'dirk van den broek', 'dekamarkt',
      'jan linders', 'boni supermarkt', 'poiesz',
      'picnic bv', 'getir', 'gorillas', 'flink boodschappen', 'crisp',
      'delhaize', 'colruyt', 'carrefour', 'okay supermarkt',
      'bio-planet', 'sligro', 'makro', 'metro cash',
      'supermarkt', 'groenteboer', 'slagerij', 'bakkerij',
      // Deen supermarkt (diverse varianten in bankbeschrijvingen)
      'deen supermarkt', 'l.m. deen', 'deen ',
      // Online boodschappen
      'e-food',
    ],
    category: 'boodschappen',
  },

  // ── ETEN & DRINKEN ───────────────────────────────────────────────
  {
    keywords: [
      'thuisbezorgd', 'uber eats', 'deliveroo', 'just eat', 'takeaway',
      'hellofresh', 'marley spoon', 'goodfood', 'hello chef', 'maaltijdbox',
      'mcdonalds', 'burger king', 'kfc restaurant', 'subway restaurant',
      'five guys', 'taco bell', 'dominos pizza', 'new york pizza', 'pizza hut',
      'cafetaria', 'snackbar', 'shoarma', 'kebab ', 'falafel',
      'restaurant', 'cafe ', 'bistro', 'brasserie',
      'eetcafe', 'pizzeria', 'sushi', 'ramen', 'noodle', 'wokrestaurant',
      'broodjeszaak', 'lunchroom', 'lunchcafe', 'lunchbar',
      'grand cafe', 'eetbar', 'wine bar',
      'friethuys', 'friethuis', 'friet ', 'frituur',
      'bedrijfsrest', 'kantine',
      'starbucks', 'costa coffee', 'espressobar', 'koffiezaak',
      'coffee company', 'bagels and beans',
      // Markt / food (generiek)
      'foodhal', 'food market',
    ],
    category: 'eten & drinken',
  },

  // ── ABONNEMENTEN (alleen echte digitale/telecom abonnementen) ───
  {
    keywords: [
      // Streaming video
      'netflix', 'disney+', 'disney plus', 'videoland', 'npo plus',
      'hbo max', 'max.com', 'paramount+', 'amazon prime', 'prime video',
      'dazn ', 'viaplay', 'ziggo sport', 'discovery+', 'apple tv',
      // Streaming muziek
      'spotify', 'apple music', 'deezer', 'tidal music',
      'itunes', 'apple one', 'apple icloud', 'google play',
      'google one', 'youtube premium', 'youtube music',
      // Software/SaaS — bare keywords voor iDEAL ("Adobe Inc", "Canva Pty Ltd")
      'adobe creative', 'adobe ', 'canva pro', 'canva ', 'figma ', 'notion ', 'slack ', 'dropbox',
      'microsoft 365', 'office 365', 'onedrive', 'icloud storage',
      'chatgpt', 'openai', 'anthropic', 'midjourney', 'github',
      'claude.ai', 'claude ai',
      // Gaming (abonnement, niet entertainment)
      'discord',
      // Telecom mobiel (alleen met "mobiel" — zonder = wonen/internet)
      'kpn mobiel', 'vodafone mobiel', 't-mobile mobiel', 'odido mobiel',
      'tele2 mobiel', 'simpel mobiel',
      'lebara', 'lycamobile', 'hollandsnieuwe',
      // Telecom providers (generiek — vallen vaak onder wonen maar als er
      // geen "internet"/"thuis" in zit dan zijn het mobiel-achtige abonnementen)
      'odido', 'vodafone', 'kpn',
      // Kranten/media
      'nrc handelsblad', 'volkskrant', 'financieele dagblad',
      'telegraaf', 'trouw ', 'ad.nl',
      'blendle', 'readly', 'scribd',
      // Productized services
      'the insiders lab', 'insiders lab',
      // Dating/VPN/password
      'tinder gold', 'bumble premium', 'nordvpn', 'expressvpn',
      'lastpass', 'dashlane', '1password',
      // Apple (generiek — subscription incasso's)
      'apple.com/bill',
    ],
    category: 'abonnementen',
  },

  // ── GEZONDHEID (inclusief sport & verzorging) ─────────────────
  {
    keywords: [
      // Sport & fitness
      'basic-fit', 'anytime fitness', 'sportschool', 'fit for free',
      'planet fitness', 'clubsportive', 'healthcity',
      'optisport', 'crossfit', 'mvmnt gym', 'mvmnt',
      'sportinstituut', 'health & sport',
      // Apotheek & drogist — bare keywords voor iDEAL ("Etos B.V.")
      'apotheek', 'etos drogist', 'etos ', 'kruidvat',
      // Zorg
      'huisarts', 'tandarts', 'fysiotherap', 'psycholog', 'therapeut',
      'eigen risico', 'zorgpremie', 'ziekenhuis', 'kliniek',
      'zorgverzekering', 'zilveren kruis', 'menzis',
      'achmea zorg', 'dsw zorgverzekeraar', 'onvz', 'ditzo',
      // Optica — bare keywords voor iDEAL
      'drogist', 'da drogist', 'optician', 'brillen', 'contactlens',
      'hans anders', 'eyes and more', 'specsavers', 'pearle',
      'alensa',
      // Supplementen
      'holland barrett', 'vitaminstore', 'gezondheidswinkel',
      // Verzorging
      'barbershop', 'kapper', 'kapster', 'hairdresser', 'barber',
    ],
    category: 'gezondheid',
  },

  // ── KLEDING ──────────────────────────────────────────────────────
  {
    keywords: [
      // H&M — "h&m" matcht BEA, "h.m" matcht iDEAL ("H.M Online")
      'zara ', 'h&m', 'h.m ', 'mango ', 'primark', 'uniqlo', 'cos store',
      'weekday', 'arket', 'other stories',
      'nike store', 'adidas store', 'puma store', 'new balance',
      'vans store', 'converse',
      'zalando', 'aboutyou', 'about you', 'asos ', 'shein ',
      'wehkamp', 'the sting', 'scotch soda',
      'jack jones', 'vero moda', 'tommy hilfiger',
      'calvin klein', 'ralph lauren', 'lacoste',
      'schoenenreus', 'footlocker', 'omoda', 'sacha schoenen',
      'zeeman', 'wibra',
      // C&A — iDEAL variant
      'c&a', 'c . a online', 'c.a ',
      // Shoeby
      'shoeby',
    ],
    category: 'kleding',
  },
]

// ── KEYWORD-BASED INTERNE OVERBOEKING DETECTIE (fallback) ──────

const INTERNAL_TRANSFER_PATTERNS = [
  'eigen rekening',
  'overboeking eigen',
  'van spaarrekening',
  'naar spaarrekening',
  'tussenrekening',
  'kruisposten',
]

// ── IBAN EXTRACTIE (voor IBAN-based transfer detectie) ──────────
//
// Patronen uit echte ABN AMRO, ING, Rabobank transacties:
//   ABN oud:  "SEPA Periodieke overb.  IBAN: NL38ABNA0140722238  BIC: ABNANL2A  Naam: ..."
//   ABN nieuw: "/TRTP/SEPA OVERBOEKING/IBAN/NL39ABNA0104545003/BIC/ABNANL2A/NAME/..."
//   ING:       "NL42INGB0001234567 Naam tegenpartij"
//   Generic:   "IBAN: NL65ABNA0105321699"

const IBAN_PATTERNS = [
  /\/IBAN\/([A-Z]{2}\d{2}[A-Z]{4}\d{7,20})/i,       // /TRTP/ formaat
  /IBAN:\s*([A-Z]{2}\d{2}[A-Z]{4}\d{7,20})/i,       // IBAN: formaat
  /\b(NL\d{2}[A-Z]{4}\d{10})\b/,                     // NL IBAN los in tekst
  /\b(BE\d{2}\d{12})\b/,                             // BE IBAN los in tekst
]

/**
 * Haalt de tegenpartij-IBAN uit een transactiebeschrijving.
 * Retourneert null als er geen IBAN gevonden wordt.
 */
export function extractIbanFromDescription(description: string): string | null {
  for (const pattern of IBAN_PATTERNS) {
    const match = description.match(pattern)
    if (match?.[1]) {
      return match[1].toUpperCase()
    }
  }
  return null
}

/**
 * Checkt of een transactie een interne overboeking is op basis van
 * IBAN-matching: als de tegenpartij-IBAN voorkomt in userIbans → intern.
 *
 * @param description  - Ruwe transactie beschrijving
 * @param userIbans    - Alle IBANs van deze user (uit bank_accounts tabel)
 */
export function isInternalTransfer(
  description: string,
  userIbans: string[],
): boolean {
  if (userIbans.length === 0) return false

  const counterIban = extractIbanFromDescription(description)
  if (!counterIban) return false

  const normalizedUserIbans = userIbans.map(iban =>
    iban.replace(/\s/g, '').toUpperCase()
  )
  return normalizedUserIbans.includes(counterIban.replace(/\s/g, '').toUpperCase())
}

// ── NORMALISATIE ───────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/\u2019/g, '')  // right single quotation mark
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s&+\-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── PRE-NORMALIZE bij module load (performance: O(1) i.p.v. O(n) per transactie) ──

const NORMALIZED_RULES = RULES.map(rule => ({
  ...rule,
  normalizedKeywords: rule.keywords.map(k => normalize(k)),
}))

const NORMALIZED_TRANSFER_PATTERNS = INTERNAL_TRANSFER_PATTERNS.map(p => normalize(p))

// ── CATEGORISATIE ──────────────────────────────────────────────

/**
 * Categoriseer een transactie.
 *
 * Prioriteit:
 * 1. merchantMapCategory (uit merchant_map.category of merchant_user_overrides)
 * 2. IBAN-based interne overboeking (als userIbans meegegeven)
 * 3. Keyword-based interne overboeking (fallback zonder IBANs)
 * 4. Rule-based matching op description
 * 5. 'overig' als fallback
 *
 * @param description        - Transactie beschrijving
 * @param amount             - Bedrag (positief = bij, negatief = af)
 * @param merchantMapCategory - Categorie uit merchant_map of user override (optioneel)
 * @param userIbans          - Alle IBANs van de user (optioneel, voor IBAN-based detectie)
 */
export function categorizeTransaction(
  description: string,
  amount: number,
  merchantMapCategory?: string | null,
  userIbans?: string[],
): Category {
  // 1) merchant_map / user override heeft prioriteit
  if (merchantMapCategory && isValidCategory(merchantMapCategory)) {
    return merchantMapCategory as Category
  }

  // 2) IBAN-based interne overboeking (meest betrouwbaar)
  if (userIbans && userIbans.length > 0 && isInternalTransfer(description, userIbans)) {
    return 'interne_overboeking'
  }

  const normalized = normalize(description)

  // 3) Keyword-based interne overboeking (fallback als geen IBANs beschikbaar)
  for (const pattern of NORMALIZED_TRANSFER_PATTERNS) {
    if (normalized.includes(pattern)) {
      return 'interne_overboeking'
    }
  }

  // 4) Rule-based (pre-normalized keywords)
  for (const rule of NORMALIZED_RULES) {
    if (rule.amountCheck && !rule.amountCheck(amount)) continue
    for (const kw of rule.normalizedKeywords) {
      if (normalized.includes(kw)) {
        return rule.category
      }
    }
  }

  return 'overig'
}

/**
 * Batch categorisatie.
 * Accepteert optioneel merchantMapCategory per transactie + userIbans.
 */
export function categorizeTransactions(
  transactions: {
    id: string
    description: string
    amount: number
    merchantMapCategory?: string | null
  }[],
  userIbans?: string[],
): { id: string; category: Category }[] {
  return transactions.map(t => ({
    id: t.id,
    category: categorizeTransaction(t.description, t.amount, t.merchantMapCategory, userIbans),
  }))
}

function isValidCategory(cat: string): boolean {
  const valid: Set<string> = new Set([
    'wonen', 'boodschappen', 'eten & drinken', 'transport',
    'abonnementen', 'kleding', 'gezondheid', 'entertainment',
    'sparen', 'inkomen', 'toeslagen', 'interne_overboeking', 'overig',
  ])
  return valid.has(cat)
}