// src/lib/categorize-engine.ts
// Rule-based transactie categorisatie — geen AI calls
// Prioriteit: merchant_user_overrides > merchant_map.category > rules > 'overig'
// Deterministisch, gratis, <1ms per transactie
//
// ⚠️  Ontworpen voor duizenden gebruikers — geen bias op individuele transactiedata.
//     Keywords moeten generiek werken voor alle NL/BE banken en beschrijvingsformaten.

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
  // ── INKOMEN ──────────────────────────────────────────────────────
  {
    keywords: [
      'salaris', 'loon', 'salary', 'werkgever', 'payroll', 'nettoloon',
      'maandloon', 'uitbetaling loon', 'vakantiegeld', 'dertiende maand',
      'tantieme', 'freelance betaling', 'zzp betaling', 'factuur ontvangen',
      'rente-inkomsten', 'rente inkomsten', 'rentevergoeding',
      'uwv', 'ww uitkering', 'bijstand', 'zorgtoeslag', 'huurtoeslag',
      'kinderbijslag', 'kindertoeslag', 'aow', 'pensioen uitkering',
      'belastingteruggave', 'belasting teruggave', 'toeslagen',
      'dividenduitkering', 'dividend', 'uitkering',
      'svb', 'sociale verzekeringsbank',
    ],
    category: 'inkomen',
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
      'nuon', 'vattenfall', 'eneco', 'essent', 'greenchoice',
      'budget energie', 'tibber', 'electrabel', 'eandis', 'fluvius',
      'delta energie',
      'waternet', 'evides', 'brabant water', 'vitens', 'dunea', 'pwn',
      'waterrekening', 'drinkwater', 'waterleidingbedrijf',
      'ozb', 'rioolheffing', 'afvalstoffenheffing', 'gemeenteheffing',
      'gemeentebelasting',
      'woonverzekering', 'inboedelverzekering', 'opstalverzekering',
      'erfpacht', 'woonlasten',
      'ziggo', 'kpn internet', 'odido thuis', 't-mobile thuis',
      'tele2 thuis', 'delta fiber', 'caiway', 'online.nl',
      'loodgieter', 'installateur', 'cv ketel', 'cv en lucht',
      'liftinstallatie', 'dakdekker', 'schilder', 'glazenwasser',
      'schoorsteenveger', 'elektricien',
    ],
    category: 'wonen',
  },

  // ── OVERHEID & BELASTINGEN ──────────────────────────────────────
  {
    keywords: [
      'belastingdienst',
      'waterschapsbelasting', 'hoogheemraadschap', 'waterschap',
      'cak eigen bijdrage', 'centraal administratie kantoor',
      'rdw kentekenregistratie', 'rijksdienst voor',
      'cjib boete', 'naheffing',
      'duo studiefinanciering', 'dienst uitvoering onderwijs',
      'kinderdagverblijf', 'buitenschoolse opvang',
      'kinderopvang', 'gastouder', 'peuterspeelzaal',
      'naschoolse opvang',
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
      'booking.com', 'airbnb', 'hotels.com', 'expedia',
      'sunweb', 'tui reizen', 'd-reizen', 'corendon', 'neckermann',
      'ticketmaster', 'eventbrite', 'ticketswap',
      'amazon.nl', 'amazon.de', 'amazon.com', 'bol.com',
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
      'starbucks', 'costa coffee', 'espressobar', 'koffiezaak',
      'coffee company', 'bagels and beans',
    ],
    category: 'eten & drinken',
  },

  // ── ABONNEMENTEN ─────────────────────────────────────────────────
  {
    keywords: [
      'netflix', 'disney+', 'disney plus', 'videoland', 'npo plus',
      'hbo max', 'max.com', 'paramount+', 'amazon prime', 'prime video',
      'dazn ', 'viaplay', 'ziggo sport', 'discovery+', 'apple tv',
      'spotify', 'apple music', 'deezer', 'tidal music',
      'itunes', 'apple one', 'apple icloud', 'google play',
      'google one', 'youtube premium', 'youtube music',
      'adobe creative', 'canva pro', 'figma ', 'notion ', 'slack ', 'dropbox',
      'microsoft 365', 'office 365', 'onedrive', 'icloud storage',
      'chatgpt', 'openai', 'anthropic', 'midjourney', 'github',
      'kpn mobiel', 'vodafone mobiel', 't-mobile mobiel', 'odido mobiel',
      'tele2 mobiel', 'simpel mobiel',
      'lebara', 'lycamobile', 'hollandsnieuwe',
      'nrc handelsblad', 'volkskrant', 'financieele dagblad',
      'telegraaf', 'trouw ', 'ad.nl',
      'blendle', 'readly', 'scribd',
      'basic-fit', 'anytime fitness', 'sportschool', 'fit for free',
      'planet fitness', 'clubsportive', 'healthcity',
      'subscription', 'abonnement', 'maandelijks lidmaatschap',
      'tinder gold', 'bumble premium', 'nordvpn', 'expressvpn',
      'lastpass', 'dashlane', '1password',
    ],
    category: 'abonnementen',
  },

  // ── GEZONDHEID ───────────────────────────────────────────────────
  {
    keywords: [
      'apotheek', 'etos drogist', 'kruidvat',
      'huisarts', 'tandarts', 'fysiotherap', 'psycholog', 'therapeut',
      'zorgverzekering', 'zilveren kruis', 'menzis',
      'achmea zorg', 'dsw zorgverzekeraar', 'onvz', 'ditzo',
      'eigen risico', 'zorgpremie', 'ziekenhuis', 'kliniek',
      'drogist', 'da drogist', 'optician', 'brillen', 'contactlens',
      'hans anders', 'eyes and more', 'specsavers', 'pearle',
      'holland barrett', 'vitaminstore', 'gezondheidswinkel',
      'centraal beheer', 'nationale-nederlanden',
      'nn verzekering', 'interpolis', 'aegon verzekering',
      'asr verzekering', 'allianz verzekering', 'reaal verzekering',
      'unive verzekering', 'nh1816', 'inshared',
      'hema verzekering',
    ],
    category: 'gezondheid',
  },

  // ── KLEDING ──────────────────────────────────────────────────────
  {
    keywords: [
      'zara ', 'h&m', 'mango ', 'primark', 'uniqlo', 'cos store',
      'weekday', 'arket', 'other stories',
      'nike store', 'adidas store', 'puma store', 'new balance',
      'vans store', 'converse',
      'zalando', 'aboutyou', 'about you', 'asos ', 'shein ',
      'wehkamp', 'the sting', 'scotch soda',
      'jack jones', 'vero moda', 'tommy hilfiger',
      'calvin klein', 'ralph lauren', 'lacoste',
      'schoenenreus', 'footlocker', 'omoda', 'sacha schoenen',
      'zeeman', 'wibra',
    ],
    category: 'kleding',
  },
]

// ── INTERNE OVERBOEKING DETECTIE ───────────────────────────────

const INTERNAL_TRANSFER_PATTERNS = [
  'eigen rekening',
  'overboeking eigen',
  'van spaarrekening',
  'naar spaarrekening',
  'tussenrekening',
  'kruisposten',
]

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
 * 2. Rule-based matching op description
 * 3. 'overig' als fallback
 *
 * Als merchantMapCategory is meegegeven, wordt die gebruikt tenzij null/undefined.
 * De rule-engine draait alleen als er geen merchant_map categorie is.
 */
export function categorizeTransaction(
  description: string,
  amount: number,
  merchantMapCategory?: string | null,
): Category {
  // 1) merchant_map / user override heeft prioriteit
  if (merchantMapCategory && isValidCategory(merchantMapCategory)) {
    return merchantMapCategory as Category
  }

  const normalized = normalize(description)

  // 2) Check interne overboekingen
  for (const pattern of NORMALIZED_TRANSFER_PATTERNS) {
    if (normalized.includes(pattern)) {
      // Interne overboekingen: negatief = sparen, positief = ignore (geen inkomen)
      return amount < 0 ? 'sparen' : 'overig'
    }
  }

  // 3) Rule-based (pre-normalized keywords)
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
 * Accepteert optioneel merchantMapCategory per transactie.
 */
export function categorizeTransactions(
  transactions: {
    id: string
    description: string
    amount: number
    merchantMapCategory?: string | null
  }[]
): { id: string; category: Category }[] {
  return transactions.map(t => ({
    id: t.id,
    category: categorizeTransaction(t.description, t.amount, t.merchantMapCategory),
  }))
}

function isValidCategory(cat: string): boolean {
  const valid: Set<string> = new Set([
    'wonen', 'boodschappen', 'eten & drinken', 'transport',
    'abonnementen', 'kleding', 'gezondheid', 'entertainment',
    'sparen', 'inkomen', 'overig',
  ])
  return valid.has(cat)
}