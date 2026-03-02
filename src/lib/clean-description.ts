// src/lib/clean-description.ts
// Haalt de leesbare naam uit ruwe banktransactie omschrijvingen.
// Werkt voor SEPA Incasso, iDEAL, BEA/Apple Pay, periodieke overboekingen etc.

// Bekende prefixes die we willen vervangen door een mooiere naam
const KNOWN_NAMES: Record<string, string> = {
  'netflix': 'Netflix',
  'spotify': 'Spotify',
  'apple': 'Apple',
  'google': 'Google',
  'bol.com': 'Bol.com',
  'amazon': 'Amazon',
  'thuisbezorgd': 'Thuisbezorgd',
  'deliveroo': 'Deliveroo',
  'uber': 'Uber',
  'tikkie': 'Tikkie',
  'albert heijn': 'Albert Heijn',
  'jumbo': 'Jumbo',
  'lidl': 'Lidl',
  'aldi': 'Aldi',
  'ns ': 'NS',
  'klarna': 'Klarna',
  'paypal': 'PayPal',
  'odido': 'Odido',
  'vodafone': 'Vodafone',
  'kpn': 'KPN',
  'ziggo': 'Ziggo',
  'vattenfall': 'Vattenfall',
  'eneco': 'Eneco',
  'nuon': 'Nuon',
  'essent': 'Essent',
  'greenchoice': 'Greenchoice',
  'nationale nederlanden': 'Nationale-Nederlanden',
  'nn ': 'Nationale-Nederlanden',
  'aegon': 'Aegon',
  'centraal beheer': 'Centraal Beheer',
  'interpolis': 'Interpolis',
  'microsof': 'Microsoft',
  'adobe': 'Adobe',
  'dropbox': 'Dropbox',
  'facebook': 'Meta',
  'ing ': 'ING',
  'abn amro': 'ABN AMRO',
  'rabobank': 'Rabobank',
  'pwn ': 'PWN',
  'vitens': 'Vitens',
  'dunea': 'Dunea',
  'uwv': 'UWV',
  'svb': 'SVB',
  'belasting': 'Belastingdienst',
  'duo ': 'DUO',
}

export function cleanDescription(raw: string): string {
  if (!raw) return 'Onbekend'

  const d = raw.trim()

  // 1. Probeer "Naam: X" te extraheren (SEPA Incasso formaat)
  const naamMatch = d.match(/\bNaam:\s*([^\n\r]+?)(?:\s+(?:Machtiging|Omschrijving|IBAN|Kenmerk|BIC|Ref|Incassant):|$)/i)
  if (naamMatch) {
    return formatName(naamMatch[1].trim())
  }

  // 2. BEA/Apple Pay: "BEA, Apple Pay [Winkel]" of "BEA, [Winkel]"
  const beaMatch = d.match(/BEA,?\s+(?:Apple Pay\s+)?(.+?),PAS\d+/i)
  if (beaMatch) {
    return formatName(beaMatch[1].trim())
  }

  // 3. eCom/Apple Pay
  const ecomMatch = d.match(/eCom,?\s+(?:Apple Pay\s+)?(.+?)\s{2,}/i)
  if (ecomMatch) {
    return formatName(ecomMatch[1].trim())
  }

  // 4. iDEAL: "/NAME/X/REMI/" of "IBAN: X BIC: Y Naam: Z"
  const idealNaamMatch = d.match(/\/NAME\/([^/]+)\//i)
  if (idealNaamMatch) {
    return formatName(idealNaamMatch[1].trim())
  }

  // 5. SEPA Overboeking "Naam: X" aan het einde
  const sepaNaamMatch = d.match(/Naam:\s*([^I\n\r]+?)(?:\s+I[BP]AN|$)/i)
  if (sepaNaamMatch) {
    return formatName(sepaNaamMatch[1].trim())
  }

  // 6. Check op bekende namen in de volledige string
  const lower = d.toLowerCase()
  for (const [key, value] of Object.entries(KNOWN_NAMES)) {
    if (lower.includes(key)) return value
  }

  // 7. Neem het eerste stuk vóór dubbele spaties of leestekens
  const firstChunk = d.split(/\s{2,}|\n|,\s*PAS|\s+IBAN:|;\s*/)[0]
  if (firstChunk && firstChunk.length < 50) {
    return formatName(firstChunk.trim())
  }

  // 8. Fallback: eerste 40 tekens
  return d.slice(0, 40).trim()
}

function formatName(name: string): string {
  // Check bekende namen
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(KNOWN_NAMES)) {
    if (lower.includes(key)) return value
  }

  // Verwijder overtollige witruimte
  const cleaned = name.replace(/\s+/g, ' ').trim()

  // Capitalize eerste letter van elk woord als het ALL CAPS is
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    return cleaned
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\bBv\b/g, 'B.V.')
      .replace(/\bNv\b/g, 'N.V.')
  }

  return cleaned
}