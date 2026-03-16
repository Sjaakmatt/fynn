// src/lib/clean-description.ts
//
// Merchant extraction & normalization engine.
// Converts raw bank transaction descriptions into:
// - merchantName: UI-friendly display name
// - merchantKey:  stable, deterministic identity key for merchant_map
//
// ⚠️  Must work generically across all NL/BE bank formats (ING, Rabo, ABN, Bunq, KBC, etc.)

type MerchantExtract = {
  merchantName: string;   // UI-friendly
  merchantKey: string;    // stable, deterministic key
  processor?: "mollie" | "adyen" | "stripe" | "paypal" | "klarna" | "riverty" | "ccv" | "unknown";
  channel?: "card" | "sepa" | "ideal" | "transfer" | "cash" | "unknown";
};

// ── KNOWN NAMES ────────────────────────────────────────────────
// Keys are matched with includes() on lowercased description.
// Order matters: longer/more specific keys should come first to prevent
// shorter keys from matching prematurely (e.g. "nn verzekering" before "nn").
//
// ⚠️  Keys must be long enough to avoid false positives across
//     thousands of users with diverse transaction descriptions.

const KNOWN_NAMES: [string, string][] = [
  // Specifiek → generiek volgorde (langere matches eerst)
  ["nationale-nederlanden", "Nationale-Nederlanden"],
  ["nn verzekering", "Nationale-Nederlanden"],
  ["albert heijn", "Albert Heijn"],
  ["ah to go", "AH to go"],
  ["abn amro bank", "ABN AMRO"],
  ["abn amro", "ABN AMRO"],
  ["ing bank", "ING"],
  ["uber eats", "Uber Eats"],

  // Telecom (vang alle varianten op)
  ["vodafone libertel", "Vodafone"],
  ["vodafone", "Vodafone"],
  ["ziggo services", "Ziggo"],
  ["ziggo", "Ziggo"],
  ["odido", "Odido"],
  ["kpn", "KPN"],

  // Streaming / SaaS (vang alle varianten op)
  ["netflix international", "Netflix"],
  ["netflix.com", "Netflix"],
  ["netflix", "Netflix"],
  ["spotify", "Spotify"],
  ["disney+", "Disney+"],
  ["adobe systems", "Adobe"],
  ["adobe creative", "Adobe"],
  ["adobe", "Adobe"],
  ["canva pty", "Canva"],
  ["canva", "Canva"],
  ["microsoft", "Microsoft"],
  ["openai", "OpenAI"],
  ["claude.ai", "Claude AI"],
  ["google", "Google"],
  ["dropbox", "Dropbox"],
  ["apple services", "Apple Services"],
  ["apple.com", "Apple"],

  // Energie
  ["vattenfall klantenservice", "Vattenfall"],
  ["vattenfall", "Vattenfall"],
  ["delta energie", "Delta Energie"],
  ["delta fiber", "DELTA Fiber"],
  ["eneco", "Eneco"],
  ["essent", "Essent"],
  ["greenchoice", "Greenchoice"],

  // Verzekeringen
  ["centraal beheer", "Centraal Beheer"],
  ["nh1816", "NH1816 Verzekeringen"],
  ["nh 1816", "NH1816 Verzekeringen"],

  // Water
  ["pwn waterleidingbedrijf", "PWN"],
  ["pwn", "PWN"],
  ["vitens", "Vitens"],
  ["dunea", "Dunea"],

  // Overheid
  ["belastingdienst", "Belastingdienst"],
  ["hoogheemraadschap", "Hoogheemraadschap"],
  ["duo hoofdrekening", "DUO"],

  // Winkels / eten
  ["bol.com", "Bol.com"],
  ["amazon", "Amazon"],
  ["zalando", "Zalando"],
  ["thuisbezorgd", "Thuisbezorgd"],
  ["deliveroo", "Deliveroo"],
  ["uber", "Uber"],
  ["tikkie", "Tikkie"],
  ["jumbo", "Jumbo"],
  ["lidl", "Lidl"],
  ["aldi", "Aldi"],
  ["starbucks", "Starbucks"],
  ["mcdonald", "McDonald's"],

  // Payment processors
  ["klarna", "Klarna"],
  ["paypal", "PayPal"],

  // Overig
  ["uwv", "UWV"],
  ["svb", "SVB"],
  ["aegon", "Aegon"],
  ["interpolis", "Interpolis"],
  ["rabobank", "Rabobank"],
  ["wodify", "Wodify"],
  ["crossfit", "CrossFit"],
  ["basic-fit", "Basic-Fit"],
  ["mvmnt", "MVMNT Gym"],
  ["optisport", "Optisport"],

  // Supermarkten (stabiele keys)
  ["deen supermarkt", "Deen"],
  ["l.m. deen", "Deen"],
  ["dekamarkt", "DekaMarkt"],
  ["vomar", "Vomar"],

  // Bouwmarkten
  ["gamma", "Gamma"],
  ["praxis", "Praxis"],
  ["hornbach", "Hornbach"],
  ["karwei", "Karwei"],
  ["intratuin", "Intratuin"],

  // Overheid
  ["belastingdienst", "Belastingdienst"],
  ["hoogheemraadschap", "Hoogheemraadschap"],
  ["duo hoofdrekening", "DUO"],

  // Restaurants/cafes (common chains)
  ["la mere anne", "La Mere Anne"],
  ["kfc", "KFC"],
];

// ── SPECIAL DESCRIPTION PATTERNS ───────────────────────────────
// Detected BEFORE normal name extraction. These override everything
// because the description keyword is a stronger identity signal than
// the counterparty name (e.g. "ABN AMRO BANK" can be salary, mortgage, or fees).

interface SpecialPattern {
  test: (description: string) => boolean;
  merchantName: string;
  merchantKey: string;
}

const SPECIAL_PATTERNS: SpecialPattern[] = [
  // Salary: "Salarisrekening" or "Salaris" in REMI/Omschrijving field
  {
    test: (d) => /\bsalarisrekening\b/i.test(d) || /\bomschrijving:\s*salaris\b/i.test(d),
    merchantName: "Salaris",
    merchantKey: "nl:salaris",
  },
  // Dividend: "dividend" keyword — extract fund manager, not full description
  {
    test: (d) => /\bdividend\b/i.test(d),
    merchantName: "Dividend",
    merchantKey: "nl:dividend",
  },
  // Rente: interest payments
  {
    test: (d) => /\brente\b/i.test(d) && /\b(spaar|deposito|rekening)\b/i.test(d),
    merchantName: "Rente",
    merchantKey: "nl:rente",
  },
  // ABN AMRO Hypotheek: large SEPA incasso from ABN AMRO Bank N.V. (not salary, not bankkosten)
  {
    test: (d) => {
      const lower = d.toLowerCase();
      return lower.includes('abn amro bank') && 
        !lower.includes('salarisrekening') && !lower.includes('salaris') &&
        !lower.includes('basispakket') && !lower.includes('bankkosten') &&
        /incasso|hypotheek/i.test(d);
    },
    merchantName: "Hypotheek",
    merchantKey: "nl:hypotheek",
  },
  // ABN AMRO Bankkosten: "Basispakket" / "Bankkosten" pattern
  {
    test: (d) => /\bbasispakket\b/i.test(d) || (/\bbankkosten\b/i.test(d) && /abn amro/i.test(d)),
    merchantName: "ABN AMRO Bankkosten",
    merchantKey: "nl:abn-amro-bankkosten",
  },
  // Gemeente: matches "Gemeente X" pattern — key is always nl:gemeente
  {
    test: (d) => /\bgemeente\s+\w/i.test(d) && !/\bgemeenteheffing\b/i.test(d) && !/\bgemeentebelasting\b/i.test(d),
    merchantName: "Gemeente",
    merchantKey: "nl:gemeente",
  },
];

// -------------------------------
// Public API
// -------------------------------

export function extractMerchant(raw: string, amount?: number): MerchantExtract {
  const d = (raw ?? "").trim();
  if (!d) return { merchantName: "Onbekend", merchantKey: "nl:unknown" };

  const channel = detectChannel(d);
  const processor = detectProcessor(d);

  // 0) Check special patterns FIRST — these override normal extraction
  for (const pattern of SPECIAL_PATTERNS) {
    if (pattern.test(d)) {
      return {
        merchantName: pattern.merchantName,
        merchantKey: pattern.merchantKey,
        processor,
        channel,
      };
    }
  }

  // 1) Extract a best-effort "name candidate"
  const nameCandidate = extractNameCandidate(d);

  // 2) Convert to display name
  const merchantName = cleanDisplayName(nameCandidate, amount);

  // 3) Convert to stable key (identity)
  const merchantKey = makeMerchantKey(nameCandidate, processor);

  return { merchantName, merchantKey, processor, channel };
}

export function cleanDescription(raw: string): string {
  return extractMerchant(raw).merchantName;
}

export function cleanDescriptionWithAmount(raw: string, amount: number): string {
  return extractMerchant(raw, amount).merchantName;
}

export function makeMerchantKey(rawNameOrDescription: string, processor?: string): string {
  // Check KNOWN_NAMES first — this prevents duplicate keys for the same merchant
  // (e.g. "Netflix International B.V." and "netflix.com" both → "nl:netflix")
  const lower = (rawNameOrDescription ?? "").toLowerCase();
  for (const [key] of KNOWN_NAMES) {
    if (lower.includes(key)) {
      // Use the KNOWN_NAMES key as the merchant identity
      const normalizedKnown = key.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      const proc = normalizeProcessor(processor);
      return proc ? `nl:${proc}:${normalizedKnown}` : `nl:${normalizedKnown}`;
    }
  }

  // Fallback: normalize the raw input
  const base = normalizeMerchantToken(rawNameOrDescription);
  const aliased = applyKnownAliases(base);
  const stripped = stripNonIdentityNoise(aliased);
  const proc = normalizeProcessor(processor);
  const key = stripped || "unknown";
  return proc ? `nl:${proc}:${key}` : `nl:${key}`;
}

// -------------------------------
// Extraction helpers
// -------------------------------

function extractNameCandidate(d: string): string {
  // ── 1. /TRTP/ structured format (iDEAL, SEPA Overboeking)
  const trptNameMatch = d.match(/\/NAME\/([^/]+)\//i);
  if (trptNameMatch) {
    const name = trptNameMatch[1].trim();
    // If NAME is a payment processor, look deeper for real merchant
    const resolved = resolveProcessorName(name, d);
    if (resolved) return resolved;
    return name;
  }

  // ── 2. "Naam: X" (SEPA)
  const naamMatch = d.match(
    /\bNaam:\s*(.+?)(?:\s+(?:Machtiging|Omschrijving|IBAN|Kenmerk|BIC|Incassant|Ref\.|EREF)|$)/i
  );
  if (naamMatch) {
    const name = naamMatch[1].trim();
    const resolved = resolveProcessorName(name, d);
    if (resolved) return resolved;
    return name;
  }

  // ── 3. BEA / Betaalpas PIN
  const beaMatch = d.match(/BEA,?\s+(?:Apple Pay\s+)?(.+?),PAS\d+/i);
  if (beaMatch) return beaMatch[1].trim();

  // ── 4. eCom (online betaling)
  const ecomMatch = d.match(/eCom,?\s+(?:Apple Pay\s+)?(.+?)\s{2,}/i);
  if (ecomMatch) return ecomMatch[1].trim();

  // ── 5. Common PSP patterns (Mollie/Adyen/Stripe/PayPal) — try to grab merchant-ish part
  const pspMatch = d.match(/\b(?:mollie|adyen|stripe|paypal)\b[^a-z0-9]*([a-z0-9 .\-&_/]{3,})/i);
  if (pspMatch) return pspMatch[1].trim();

  // ── 6. First chunk fallback
  const firstChunk = d.split(/\s{2,}|\n|,\s*PAS|\s+IBAN:|\s+BIC:/)[0];
  if (firstChunk && firstChunk.trim().length < 80) return firstChunk.trim();

  return d.slice(0, 80).trim();
}

function cleanDisplayName(name: string, amount?: number): string {
  const base = formatName(name);

  // Ambiguous merchant split — use absolute amount for comparison
  // since transaction amounts can be negative (expenses) or positive (income)
  // NOTE: salary is already handled by SPECIAL_PATTERNS, so this only applies
  // to non-salary ABN AMRO transactions (hypotheek, bankkosten, etc.)
  if (base === "ABN AMRO" && typeof amount === "number" && Number.isFinite(amount)) {
    const abs = Math.abs(amount);
    if (abs > 500) return "Hypotheek";
    if (abs < 20) return "ABN AMRO Bankkosten";
  }

  return base;
}

function formatName(name: string): string {
  if (!name) return "Onbekend";

  // Known names mapping — uses ordered array for specificity
  const lower = name.toLowerCase();
  for (const [key, value] of KNOWN_NAMES) {
    if (lower.includes(key)) return value;
  }

  // Remove weird spacing artifacts
  const cleaned = name
    .replace(/\s+/g, " ")
    .replace(/\b([A-Z][a-z]{0,2})\s+([a-z])/g, "$1$2")
    .trim();

  // Title case if ALL CAPS
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    return cleaned
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bBv\b/gi, "B.V.")
      .replace(/\bNv\b/gi, "N.V.");
  }

  return cleaned;
}

// -------------------------------
// Normalization / key building
// -------------------------------

function normalizeMerchantToken(input: string): string {
  // Lowercase, strip diacritics, keep [a-z0-9] and spaces
  let s = (input ?? "").toLowerCase();

  // Remove diacritics
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Replace separators with spaces
  s = s.replace(/[_/\\|]+/g, " ");
  s = s.replace(/[*\u2022\u00B7]+/g, " ");
  s = s.replace(/[^\p{L}\p{N}\s\-.&]+/gu, " "); // unicode letters/numbers

  // Remove obvious IDs / refs / long numbers
  s = s.replace(/\b\d{6,}\b/g, " ");

  // Remove IBAN-like tokens
  s = s.replace(/\b[a-z]{2}\d{2}[a-z0-9]{10,}\b/gi, " ");

  // Remove amounts like "4 30", "1 50", "3 70", "14 95" (prices from bank descriptions)
  s = s.replace(/\b\d{1,3}\s+\d{2}\b/g, " ");

  // Remove standalone small numbers (leftover amounts, dates, etc.)
  s = s.replace(/\b\d{1,4}\b/g, " ");

  // Remove legal suffixes
  s = s.replace(/\b(?:b\.?v\.?|n\.?v\.?|ltd|limited|gmbh|inc|s\.?a\.?|pte|pty)\b/gi, " ");

  // Remove generic business words that don't identify the merchant
  s = s.replace(/\b(?:international|services|klantenservice|libertel|nederland)\b/gi, " ");

  // Remove "dd-" patterns (Netflix "DD- -8288-" style references)
  s = s.replace(/\bdd-[\s\-\d]*/gi, " ");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function applyKnownAliases(base: string): string {
  const aliases: Array<[RegExp, string]> = [
    [/\bbol\.com\b/g, "bol"],
    [/\balbert heijn\b/g, "albert heijn"],
    [/\bah to go\b/g, "albert heijn to go"],
    [/\bthuisbezorgd\b/g, "thuisbezorgd"],
    [/\bamazon\b/g, "amazon"],
    [/\bzalando\b/g, "zalando"],
    [/\bvodafone\b/g, "vodafone"],
    [/\bziggo\b/g, "ziggo"],
    [/\bodido\b/g, "odido"],
    [/\bkpn\b/g, "kpn"],
    [/\bnetflix\b/g, "netflix"],
    [/\bspotify\b/g, "spotify"],
    [/\bmicrosoft\b|\bmsft\b/g, "microsoft"],
    [/\bapple\.com\b|\bapple services\b/g, "apple"],
    [/\bgoogle\b/g, "google"],
    [/\bklarna\b/g, "klarna"],
    [/\bpaypal\b/g, "paypal"],
    [/\buber eats\b/g, "uber eats"],
    [/\buber\b/g, "uber"],
    [/\bdeliveroo\b/g, "deliveroo"],
  ];

  let s = base;
  for (const [re, rep] of aliases) s = s.replace(re, rep);
  return s.trim();
}

function stripNonIdentityNoise(s: string): string {
  const NOISE = [
    "sepa",
    "incasso",
    "periodieke",
    "overboeking",
    "ideal",
    "betaalpas",
    "pas",
    "pin",
    "bea",
    "ecom",
    "machtiging",
    "kenmerk",
    "omschrijving",
    "iban",
    "bic",
    "eref",
    "trtp",
    "name",
    "ref",
    "betaling",
    "term",
    "terminal",
    "kaart",
    "card",
    "contactloos",
    "apple pay",
    "google pay",
  ];

  let out = ` ${s} `;
  for (const w of NOISE) {
    const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
    out = out.replace(re, " ");
  }

  out = out.replace(/\s+/g, " ").trim();

  // Keep it bounded
  if (out.length > 80) out = out.slice(0, 80).trim();
  return out;
}

function normalizeProcessor(p?: string): MerchantExtract["processor"] | undefined {
  const s = (p ?? "").toLowerCase();
  if (!s) return undefined;
  if (s.includes("mollie")) return "mollie";
  if (s.includes("adyen")) return "adyen";
  if (s.includes("stripe")) return "stripe";
  if (s.includes("paypal")) return "paypal";
  if (s.includes("klarna")) return "klarna";
  if (s.includes("riverty")) return "riverty";
  if (s.includes("ccv")) return "ccv";
  return undefined;
}

function detectProcessor(d: string): MerchantExtract["processor"] | undefined {
  const s = d.toLowerCase();
  if (s.includes("mollie")) return "mollie";
  if (s.includes("adyen")) return "adyen";
  if (s.includes("stripe")) return "stripe";
  if (s.includes("paypal")) return "paypal";
  if (s.includes("klarna")) return "klarna";
  if (s.includes("riverty")) return "riverty";
  if (s.includes("ccv*") || s.includes("ccv *") || s.includes("ccv")) return "ccv";
  return undefined;
}

// ── PAYMENT PROCESSOR PASS-THROUGH ────────────────────────────
// When the NAME field contains a payment processor (PPRO, Mollie, Adyen, etc.)
// instead of the actual merchant, look deeper in the description for the real brand.

const PROCESSOR_NAMES = [
  'ppro payment services',
  'ppro',
  'mollie',
  'adyen',
  'stripe',
  'buckaroo',
  'multisafepay',
  'pay.nl',
];

function resolveProcessorName(name: string, fullDescription: string): string | null {
  const lower = name.toLowerCase();
  const isProcessor = PROCESSOR_NAMES.some(p => lower.includes(p));
  if (!isProcessor) return null;

  const dLower = fullDescription.toLowerCase();

  // Check KNOWN_NAMES against the full description (not just the NAME field)
  for (const [key, displayName] of KNOWN_NAMES) {
    if (dLower.includes(key)) {
      // Don't match the processor itself as the merchant
      if (PROCESSOR_NAMES.some(p => key.includes(p))) continue;
      return displayName;
    }
  }

  // Try /REMI/ field: "/REMI/769T3Y2 Adobe" → "Adobe"
  const remiMatch = fullDescription.match(/\/REMI\/[^\s]*\s+([A-Za-z][A-Za-z0-9 .&\-]+)/);
  if (remiMatch) return remiMatch[1].trim();

  // Try "Omschrijving: XXX" field
  const omschMatch = fullDescription.match(/Omschrijving:\s*\S+\s+([A-Za-z][A-Za-z0-9 .&\-]+)/i);
  if (omschMatch) return omschMatch[1].trim();

  // Try /MARF/ field for brand clues: "ADOBE-AE05286800068CNL"
  const marfMatch = fullDescription.match(/\/MARF\/([A-Za-z]+)/);
  if (marfMatch) {
    const brand = marfMatch[1].trim();
    // Look up brand in KNOWN_NAMES
    for (const [key, displayName] of KNOWN_NAMES) {
      if (brand.toLowerCase().includes(key)) return displayName;
    }
  }

  return null;
}

function detectChannel(d: string): MerchantExtract["channel"] {
  const s = d.toLowerCase();
  if (s.includes("/trtp/") || s.includes("ideal")) return "ideal";
  if (s.includes("incasso") || s.includes("sepa")) return "sepa";
  if (s.includes("bea") || s.includes("betaalpas") || s.includes("pas")) return "card";
  if (s.includes("geldautomaat") || s.includes("atm") || s.includes("opname")) return "cash";
  if (s.includes("overboeking")) return "transfer";
  return "unknown";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}