// src/lib/categorize-engine.ts
// Rule-based transactie categorisatie — geen AI calls
// Prioriteit: merchant_user_overrides > merchant_map.category > rules > 'overig'
// Deterministisch, gratis, <1ms per transactie

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
      'salarisrekening',
      'degiro', 'bux ', 'peaks ', 'brand new day', 'meesman', 'binck', 'saxo',
      'beleggingsrekening', 'pensioenpremie', 'lijfrente', 'deposito',
      'northern trust', 'vanguard', 'indexfonds',
    ],
    category: 'sparen',
    amountCheck: (a) => a < 0,
  },

  // ── WONEN ────────────────────────────────────────────────────────
  {
    keywords: [
      'huur', 'hypotheek', 'servicekosten', 'vve ', 'huurcommissie',
      'woonbron', 'vestia', 'ymere', 'havensteder', 'woningstichting',
      'stadswonen', 'huurpenningen',
      'nuon', 'vattenfall', 'eneco', 'essent', 'greenchoice',
      'budget energie', 'tibber', 'electrabel', 'eandis', 'fluvius',
      'delta energie',
      'waternet', 'evides', 'brabant water', 'vitens', 'dunea', 'pwn',
      'waterrekening', 'drinkwater', 'waterleidingbedrijf',
      'ozb', 'rioolheffing', 'afvalstoffenheffing', 'gemeenteheffing',
      'gemeentebelasting', 'gemeente ',
      'woonverzekering', 'inboedelverzekering', 'opstalverzekering',
      'vve bijdrage', 'erfpacht', 'woonlasten',
      'ziggo', 'kpn internet', 'odido thuis', 't-mobile thuis',
      'tele2 thuis', 'delta fiber', 'caiway', 'online.nl',
      'loodgieter', 'installateur', 'cv ketel', 'cv en lucht',
      'liftinstallatie', 'dakdekker', 'schilder', 'glazenwasser',
      'schoorsteenveger', 'elektricien',
    ],
    category: 'wonen',
  },

  // ── KINDEROPVANG (nieuw — vóór overheid) ─────────────────────────
  {
    keywords: [
      'kinderdagverblijf', 'buitenschoolse opvang', 'bso ',
      'kinderopvang', 'gastouder', 'peuterspeelzaal', 'kdv ',
      'naschoolse opvang', 'nso ',
    ],
    category: 'overig', // TODO: maak 'kinderen' categorie als je dat wilt
  },

  // ── OVERHEID & BELASTINGEN ──────────────────────────────────────
  {
    keywords: [
      'belastingdienst',
      'waterschapsbelasting', 'hoogheemraadschap', 'waterschap',
      'cak ', 'centraal administratie kantoor',
      'rdw ', 'rijksdienst voor',
      'cjib ', 'boete ', 'naheffing',
      'duo ', 'dienst uitvoering onderwijs',
    ],
    category: 'overig',
  },

  // ── TRANSPORT ────────────────────────────────────────────────────
  {
    keywords: [
      'ns ', 'ns.nl', 'ov-chipkaart', 'ov chipkaart', 'translink',
      'gvb ', 'ret ', 'htm ', 'connexxion', 'arriva ', 'qbuzz',
      'de lijn', 'mivb', 'stib', 'nmbs', 'sncb',
      'uber ', 'bolt taxi', 'lyft', 'taxi ', 'cabify',
      'shell ', 'bp ', 'esso ', 'total ', 'q8 ', 'texaco',
      'tinq ', 'tango ', 'jet ', 'brandstof', 'benzine', 'diesel',
      'tankstation', 'tanken',
      'parkeren', 'parkeermeter', 'q-park', 'apcoa', 'interparking',
      'parkbee', 'yellowbrick', 'p1 parking',
      'wegenbelasting', 'motorrijtuigenbelasting', 'mrb ',
      'anwb ', 'autoverzekering',
      'volkswagen pon', 'autolease', 'lease plan', 'athlon',
      'swapfiets', 'lease fiets',
      'felyx', 'check scooter', 'dott ', 'tier ', 'lime ',
      'ryanair', 'transavia', 'easyjet', 'klm ', 'tui fly', 'wizz',
      'schiphol', 'eindhoven airport',
      'ns treinen', 'trein',
    ],
    category: 'transport',
  },

  // ── ENTERTAINMENT (vóór boodschappen — voorkomt Mediamarkt bug) ──
  {
    keywords: [
      'mediamarkt', 'coolblue', 'fnac', 'bcc ',
      'steam ', 'playstation', 'xbox ', 'nintendo', 'epic games',
      'bioscoop', 'pathe', 'vue cinema', 'kinepolis',
      'theater', 'concertzaal', 'museum', 'attractiepark',
      'pretpark', 'efteling', 'walibi', 'duinrell',
      'managementboek', 'standaard boekhandel',
      'booking.com', 'airbnb', 'hotels.com', 'expedia',
      'sunweb', 'tui ', 'd-reizen', 'corendon', 'neckermann',
      'ticketmaster', 'eventbrite', 'ticketswap',
      'amazon', 'bol.com',
    ],
    category: 'entertainment',
  },

  // ── BOODSCHAPPEN ─────────────────────────────────────────────────
  {
    keywords: [
      'albert heijn', 'ah ', 'ah to go',
      'jumbo', 'lidl', 'aldi',
      'plus supermarkt', 'coop supermarkt', 'spar ',
      'hoogvliet', 'vomar', 'dirk', 'dekamarkt',
      'jan linders', 'boni ', 'poiesz',
      'picnic', 'getir', 'gorillas', 'flink ', 'crisp',
      'delhaize', 'colruyt', 'carrefour', 'okay supermarkt',
      'bio-planet', 'sligro', 'makro', 'metro cash',
      'supermarkt', 'groenteboer', 'slager ', 'bakkerij',
    ],
    category: 'boodschappen',
  },

  // ── ETEN & DRINKEN ───────────────────────────────────────────────
  {
    keywords: [
      'thuisbezorgd', 'uber eats', 'deliveroo', 'just eat', 'takeaway',
      'hellofresh', 'marley spoon', 'goodfood', 'hello chef', 'maaltijdbox',
      'mcdonalds', 'burger king', 'kfc ', 'subway ', 'five guys',
      'taco bell', 'dominos', 'domino', 'new york pizza', 'pizza hut',
      'cafetaria', 'snackbar', 'shoarma', 'kebab ', 'falafel',
      'restaurant', 'cafe ', 'café ', 'bistro', 'brasserie',
      'eetcafe', 'pizzeria', 'sushi', 'ramen', 'noodle', 'wokrestaurant',
      'broodjeszaak', 'lunchroom', 'lunchcafe', 'lunchbar',
      'broodje', 'kruimel', 'bakker ',
      'wetherspoon', 'drie gezusters', 'proeflokaal', 'kroeg',
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
      'spotify', 'apple music', 'deezer', 'tidal ',
      'itunes', 'apple one', 'apple icloud', 'google play',
      'google one', 'youtube premium', 'youtube music',
      'adobe ', 'canva ', 'figma ', 'notion ', 'slack ', 'dropbox',
      'microsoft 365', 'office 365', 'onedrive', 'icloud storage',
      'chatgpt', 'openai', 'anthropic', 'midjourney', 'github',
      'kpn ', 'vodafone ', 't-mobile ', 'odido ', 'tele2 ', 'simpel ',
      'lebara', 'lycamobile', 'ben ', 'hollandsnieuwe',
      'nrc ', 'volkskrant', 'fd ', 'telegraaf', 'trouw ', 'ad.nl',
      'blendle', 'readly', 'scribd',
      'basic-fit', 'anytime fitness', 'sportschool', 'fit for free',
      'planet fitness', 'clubsportive', 'healthcity',
      'subscription', 'abonnement', 'maandelijks lidmaatschap',
      'tinder', 'bumble', 'hinge ', 'nordvpn', 'expressvpn',
      'lastpass', 'dashlane', '1password',
    ],
    category: 'abonnementen',
  },

  // ── GEZONDHEID ───────────────────────────────────────────────────
  {
    keywords: [
      'apotheek', 'etos ', 'kruidvat',
      'huisarts', 'tandarts', 'fysiotherap', 'psycholog', 'therapeut',
      'zorgverzekering', 'cz ', 'vgz ', 'menzis', 'zilveren kruis',
      'achmea zorg', 'eno ', 'dsw ', 'onvz ', 'ditzo', 'unive zorg',
      'eigen risico', 'zorgpremie', 'ziekenhuis', 'kliniek',
      'drogist', 'da drogist', 'optician', 'brillen', 'lenzen', 'contactlens',
      'hans anders', 'eyes and more', 'specsavers', 'pearle',
      'holland barrett', 'vitaminstore', 'gezondheidswinkel',
      'centraal beheer', 'nationale nederlanden', 'nationale-nederlanden',
      'nn verzekering',
      'interpolis', 'aegon verzekering', 'asr verzekering',
      'allianz', 'reaal', 'unive',
      'nh1816', 'inshared', 'hema verzekering',
    ],
    category: 'gezondheid',
  },

  // ── KLEDING ──────────────────────────────────────────────────────
  {
    keywords: [
      'zara ', 'h&m', 'mango ', 'primark', 'uniqlo', 'cos ',
      'weekday', 'arket', 'other stories',
      'nike ', 'adidas ', 'puma ', 'new balance', 'vans ', 'converse',
      'zalando', 'aboutyou', 'about you', 'asos ', 'shein ',
      'wehkamp', 'the sting', 'scotch soda',
      'jack jones', 'only ', 'vero moda', 'tommy hilfiger',
      'calvin klein', 'ralph lauren', 'lacoste',
      'schoenenreus', 'footlocker', 'omoda', 'sacha schoenen',
      'zeeman', 'wibra', 'action ',
    ],
    category: 'kleding',
  },
]

// ── INTERNE OVERBOEKING DETECTIE ───────────────────────────────

const INTERNAL_TRANSFER_PATTERNS = [
  'rekening ',      // "Rekening Sjaak", "Rekening Lisa"
  'eigen rekening',
  'overboeking eigen',
  'van spaarrekening',
  'naar spaarrekening',
  'tussenrekening',
  'kruisposten',
]

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/'/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s&+\-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

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
  for (const pattern of INTERNAL_TRANSFER_PATTERNS) {
    if (normalized.includes(normalize(pattern))) {
      // Interne overboekingen: negatief = sparen, positief = ignore (geen inkomen)
      return amount < 0 ? 'sparen' : 'overig'
    }
  }

  // 3) Rule-based
  for (const rule of RULES) {
    if (rule.amountCheck && !rule.amountCheck(amount)) continue
    for (const keyword of rule.keywords) {
      if (normalized.includes(normalize(keyword))) {
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