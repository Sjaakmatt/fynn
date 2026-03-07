// src/lib/clean-description.ts

type MerchantExtract = {
  merchantName: string;   // UI-friendly
  merchantKey: string;    // stable, deterministic key
  processor?: "mollie" | "adyen" | "stripe" | "paypal" | "klarna" | "riverty" | "ccv" | "unknown";
  channel?: "card" | "sepa" | "ideal" | "transfer" | "cash" | "unknown";
};

const KNOWN_NAMES: Record<string, string> = {
  "netflix": "Netflix",
  "spotify": "Spotify",
  "apple services": "Apple Services",
  "apple.com": "Apple",
  "google": "Google",
  "microsoft": "Microsoft",
  "adobe": "Adobe",
  "dropbox": "Dropbox",
  "bol.com": "Bol.com",
  "amazon": "Amazon",
  "zalando": "Zalando",
  "thuisbezorgd": "Thuisbezorgd",
  "deliveroo": "Deliveroo",
  "uber eats": "Uber Eats",
  "uber": "Uber",
  "tikkie": "Tikkie",
  "albert heijn": "Albert Heijn",
  "jumbo": "Jumbo",
  "lidl": "Lidl",
  "aldi": "Aldi",
  "klarna": "Klarna",
  "paypal": "PayPal",
  "odido": "Odido",
  "vodafone": "Vodafone",
  "kpn": "KPN",
  "ziggo": "Ziggo",
  "vattenfall": "Vattenfall",
  "delta energie": "Delta Energie",
  "eneco": "Eneco",
  "nuon": "Nuon",
  "essent": "Essent",
  "greenchoice": "Greenchoice",
  "nationale-nederlanden": "Nationale-Nederlanden",
  "nn ": "Nationale-Nederlanden",
  "aegon": "Aegon",
  "centraal beheer": "Centraal Beheer",
  "interpolis": "Interpolis",
  "abn amro bank": "ABN AMRO",
  "abn amro": "ABN AMRO",
  "rabobank": "Rabobank",
  "ing bank": "ING",
  "ingb": "ING",
  "pwn ": "PWN",
  "vitens": "Vitens",
  "dunea": "Dunea",
  "uwv": "UWV",
  "svb": "SVB",
  "belastingdienst": "Belastingdienst",
  "duo ": "DUO",
  "duo hoofdrekening": "DUO",
  "gemeente": "Gemeente",
  "hoogheemraadschap": "Hoogheemraadschap",
  "wodify": "Wodify",
  "crossfit": "CrossFit",
  "mvmnt": "MVMNT Gym",
};

// -------------------------------
// Public API
// -------------------------------

export function extractMerchant(raw: string, amount?: number): MerchantExtract {
  const d = (raw ?? "").trim();
  if (!d) return { merchantName: "Onbekend", merchantKey: "nl:unknown" };

  const channel = detectChannel(d);
  const processor = detectProcessor(d);

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
  // If someone passes full description, still works because we normalize heavily.
  const base = normalizeMerchantToken(rawNameOrDescription);

  // Apply known aliases to unify keys across variants
  const aliased = applyKnownAliases(base);

  // Remove generic noise tokens that don't identify a merchant
  const stripped = stripNonIdentityNoise(aliased);

  // If processor is known and the merchant is ambiguous, keep processor prefix
  const proc = normalizeProcessor(processor);

  // Final key: stable + short
  const key = stripped || "unknown";
  return proc ? `nl:${proc}:${key}` : `nl:${key}`;
}

// -------------------------------
// Extraction helpers
// -------------------------------

function extractNameCandidate(d: string): string {
  // ── 1. /TRTP/ structured format (iDEAL, SEPA Overboeking)
  const trptNameMatch = d.match(/\/NAME\/([^/]+)\//i);
  if (trptNameMatch) return trptNameMatch[1].trim();

  // ── 2. "Naam: X" (SEPA)
  const naamMatch = d.match(
    /\bNaam:\s*(.+?)(?:\s+(?:Machtiging|Omschrijving|IBAN|Kenmerk|BIC|Incassant|Ref\.|EREF)|$)/i
  );
  if (naamMatch) return naamMatch[1].trim();

  // ── 3. BEA / Betaalpas PIN
  const beaMatch = d.match(/BEA,?\s+(?:Apple Pay\s+)?(.+?),PAS\d+/i);
  if (beaMatch) return beaMatch[1].trim();

  // ── 4. eCom (online betaling)
  const ecomMatch = d.match(/eCom,?\s+(?:Apple Pay\s+)?(.+?)\s{2,}/i);
  if (ecomMatch) return ecomMatch[1].trim();

  // ── 5. Common PSP patterns (Mollie/Adyen/Stripe/PayPal) — try to grab merchant-ish part
  // Examples vary a lot; we keep it conservative:
  // "MOLLIE *BOL.COM" -> "BOL.COM"
  // "ADYEN *UBER" -> "UBER"
  // "STRIPE *NETFLIX" -> "NETFLIX"
  const pspMatch = d.match(/\b(?:mollie|adyen|stripe|paypal)\b[^a-z0-9]*([a-z0-9 .\-&_/]{3,})/i);
  if (pspMatch) return pspMatch[1].trim();

  // ── 6. First chunk fallback
  const firstChunk = d.split(/\s{2,}|\n|,\s*PAS|\s+IBAN:|\s+BIC:/)[0];
  if (firstChunk && firstChunk.trim().length < 80) return firstChunk.trim();

  return d.slice(0, 80).trim();
}

function cleanDisplayName(name: string, amount?: number): string {
  const base = formatName(name);

  // Ambiguous merchant split examples (keep display logic here)
  if (base === "ABN AMRO" && typeof amount === "number" && Number.isFinite(amount)) {
    if (amount > 500) return "Hypotheek";
    if (amount < 20) return "ABN AMRO Bankkosten";
  }

  return base;
}

function formatName(name: string): string {
  if (!name) return "Onbekend";

  // Known names mapping
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(KNOWN_NAMES)) {
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
  s = s.replace(/[*•·]+/g, " ");
  s = s.replace(/[^\p{L}\p{N}\s\-.&]+/gu, " "); // unicode letters/numbers

  // Remove obvious IDs / refs / long numbers
  s = s.replace(/\b\d{6,}\b/g, " ");

  // Remove IBAN-like tokens
  s = s.replace(/\b[a-z]{2}\d{2}[a-z0-9]{10,}\b/gi, " ");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function applyKnownAliases(base: string): string {
  // Unify key variants to a canonical token (identity-level)
  // Keep this small; it’s your “seed”.
  const aliases: Array<[RegExp, string]> = [
    [/\bbol\.com\b/g, "bol"],
    [/\balbert heijn\b|\bah\b/g, "albert heijn"],
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
    [/\buber\b/g, "uber"],
    [/\bdeliveroo\b/g, "deliveroo"],
  ];

  let s = base;
  for (const [re, rep] of aliases) s = s.replace(re, rep);
  return s.trim();
}

function stripNonIdentityNoise(s: string): string {
  // Remove payment/channel words that appear in many descriptions
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