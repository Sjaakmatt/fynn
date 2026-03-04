// src/lib/categorize-engine.ts
// Rule-based transactie categorisatie — geen AI calls
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
      'salarisrekening', // interne ABN AMRO overboekingen
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
      'waternet', 'evides', 'brabant water', 'vitens', 'dunea', 'pwn ',
      'waterrekening', 'drinkwater',
      'ozb', 'rioolheffing', 'afvalstoffenheffing', 'gemeenteheffing',
      'woonverzekering', 'inboedelverzekering', 'opstalverzekering',
      'vve bijdrage', 'erfpacht', 'woonlasten',
      'ziggo', 'kpn internet', 'odido thuis', 't-mobile thuis',
      'tele2 thuis', 'delta fiber', 'caiway', 'online.nl',
      // Installateurs & onderhoud
      'loodgieter', 'installateur', 'cv ketel', 'cv en lucht',
      'liftinstallatie', 'dakdekker', 'schilder', 'glazenwasser',
      'schoorsteenveger', 'elektricien',
    ],
    category: 'wonen',
  },

  // ── OVERHEID & BELASTINGEN (vóór transport — voorkomt miscategorisatie) ──
  {
    keywords: [
      'belastingdienst', 'belasting ', 'gemeentebelasting',
      'waterschapsbelasting', 'hoogheemraadschap', 'waterschap',
      'cak ', 'centraal administratie kantoor',
      'rdw ', 'rijksdienst voor',
      'cjib ', 'boete ', 'naheffing',
      'duo ', 'dienst uitvoering onderwijs',
      'svb ', 'sociale verzekeringsbank',
    ],
    category: 'overig', // overheid valt in overig, niet transport
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
      'swapfiets', 'lease fiets',
      'felyx', 'check scooter', 'dott ', 'tier ', 'lime ',
      'ryanair', 'transavia', 'easyjet', 'klm ', 'tui fly', 'wizz',
      'schiphol', 'eindhoven airport',
      'ns treinen', 'trein',
    ],
    category: 'transport',
  },

  // ── ABONNEMENTEN ─────────────────────────────────────────────────
  {
    keywords: [
      // Streaming video
      'netflix', 'disney+', 'disney plus', 'videoland', 'npo plus',
      'hbo max', 'max.com', 'paramount+', 'amazon prime', 'prime video',
      'dazn ', 'viaplay', 'ziggo sport', 'discovery+', 'apple tv',
      // Streaming audio
      'spotify', 'apple music', 'deezer', 'tidal ',
      // Apple/Google
      'itunes', 'apple one', 'apple icloud', 'google play',
      'google one', 'youtube premium', 'youtube music',
      // Software
      'adobe ', 'canva ', 'figma ', 'notion ', 'slack ', 'dropbox',
      'microsoft 365', 'office 365', 'onedrive', 'icloud storage',
      'chatgpt', 'openai', 'anthropic', 'midjourney', 'github',
      // Telecom
      'kpn ', 'vodafone ', 't-mobile ', 'odido ', 'tele2 ', 'simpel ',
      'lebara', 'lycamobile', 'ben ', 'hollandsnieuwe',
      // Media
      'nrc ', 'volkskrant', 'fd ', 'telegraaf', 'trouw ', 'ad.nl',
      'blendle', 'readly', 'scribd',
      // Sport
      'basic-fit', 'anytime fitness', 'sportschool', 'fit for free',
      'planet fitness', 'clubsportive', 'healthcity',
      // Generieke subscription patterns
      'subscription', 'abonnement', 'maandelijks lidmaatschap',
      // Overig
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
      // Verzekeraars (algemeen)
      'centraal beheer', 'nationale nederlanden', 'nn verzekering',
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
      'zeeman', 'wibra', 'action ', // goedkope kleding/huishoud
    ],
    category: 'kleding',
  },
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

export function categorizeTransaction(description: string, amount: number): Category {
  const normalized = normalize(description)

  for (const rule of RULES) {
    if (rule.amountCheck && !rule.amountCheck(amount)) continue

    for (const keyword of rule.keywords) {
      const normalizedKeyword = normalize(keyword)
      if (normalized.includes(normalizedKeyword)) {
        return rule.category
      }
    }
  }
  return 'overig'
}

export function categorizeTransactions(
  transactions: { id: string; description: string; amount: number }[]
): { id: string; category: Category }[] {
  return transactions.map(t => ({
    id: t.id,
    category: categorizeTransaction(t.description, t.amount),
  }))
}