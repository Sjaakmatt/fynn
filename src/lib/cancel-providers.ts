// src/lib/cancel-providers.ts

export interface CancelProvider {
  /** Canonical key — must match merchant_map keys (lowercase, trimmed) */
  key: string
  /** Display name */
  name: string
  /** Email address to send cancellation to */
  cancelEmail: string
  /** Notice period in days (0 = direct) */
  noticeDays: number
  /** Extra notes for the cancellation letter */
  notes?: string
  /** Category for grouping */
  category: 'streaming' | 'telecom' | 'sport' | 'insurance' | 'energy' | 'media' | 'software' | 'other'
}

export const CANCEL_PROVIDERS: CancelProvider[] = [
  // ── Streaming ───────────────────────────────────────────────────────────────
  { key: 'netflix',          name: 'Netflix',             cancelEmail: 'info@netflix.com',                noticeDays: 0,  category: 'streaming', notes: 'Opzegging gaat in aan het einde van de huidige factureringsperiode.' },
  { key: 'spotify',          name: 'Spotify',             cancelEmail: 'support@spotify.com',             noticeDays: 0,  category: 'streaming' },
  { key: 'disney',           name: 'Disney+',             cancelEmail: 'disney-plus-service@disney.com',  noticeDays: 0,  category: 'streaming' },
  { key: 'videoland',        name: 'Videoland',           cancelEmail: 'klantenservice@videoland.com',    noticeDays: 0,  category: 'streaming' },
  { key: 'hbo',              name: 'HBO Max',             cancelEmail: 'support@hbomax.com',              noticeDays: 0,  category: 'streaming' },
  { key: 'amazon prime',     name: 'Amazon Prime',        cancelEmail: 'prime-support@amazon.nl',         noticeDays: 0,  category: 'streaming' },
  { key: 'apple tv',         name: 'Apple TV+',           cancelEmail: 'support@apple.com',               noticeDays: 0,  category: 'streaming' },
  { key: 'viaplay',          name: 'Viaplay',             cancelEmail: 'klantenservice@viaplay.nl',       noticeDays: 30, category: 'streaming', notes: 'Opzegtermijn van 1 maand.' },
  { key: 'youtube premium',  name: 'YouTube Premium',     cancelEmail: 'support@youtube.com',             noticeDays: 0,  category: 'streaming' },

  // ── Telecom ─────────────────────────────────────────────────────────────────
  { key: 'kpn',              name: 'KPN',                 cancelEmail: 'klantenservice@kpn.com',          noticeDays: 30, category: 'telecom', notes: 'Check contractdatum — voortijdig opzeggen kan boete opleveren.' },
  { key: 'odido',            name: 'Odido (T-Mobile)',    cancelEmail: 'klantenservice@odido.nl',         noticeDays: 30, category: 'telecom', notes: 'Voorheen T-Mobile Nederland.' },
  { key: 't-mobile',         name: 'T-Mobile',            cancelEmail: 'klantenservice@odido.nl',         noticeDays: 30, category: 'telecom' },
  { key: 'vodafone',         name: 'Vodafone',            cancelEmail: 'klantenservice@vodafone.nl',      noticeDays: 30, category: 'telecom' },
  { key: 'ziggo',            name: 'Ziggo',               cancelEmail: 'klantenservice@ziggo.nl',         noticeDays: 30, category: 'telecom', notes: 'Opzegtermijn 1 maand. Apparatuur moet geretourneerd worden.' },
  { key: 'tele2',            name: 'Tele2',               cancelEmail: 'klantenservice@tele2.nl',         noticeDays: 30, category: 'telecom' },
  { key: 'simpel',           name: 'Simpel',              cancelEmail: 'info@simpel.nl',                  noticeDays: 30, category: 'telecom' },
  { key: 'lebara',           name: 'Lebara',              cancelEmail: 'klantenservice@lebara.nl',        noticeDays: 30, category: 'telecom' },
  { key: 'ben',              name: 'Ben',                 cancelEmail: 'klantenservice@ben.nl',           noticeDays: 30, category: 'telecom' },

  // ── Sport / Fitness ─────────────────────────────────────────────────────────
  { key: 'basic-fit',        name: 'Basic-Fit',           cancelEmail: 'opzeggen@basic-fit.nl',           noticeDays: 30, category: 'sport', notes: 'Opzeggen kan ook via Mijn Basic-Fit. Let op contractduur.' },
  { key: 'fit for free',     name: 'Fit For Free',        cancelEmail: 'klantenservice@fitforfree.nl',    noticeDays: 30, category: 'sport' },
  { key: 'anytime fitness',  name: 'Anytime Fitness',     cancelEmail: 'info@anytimefitness.nl',          noticeDays: 30, category: 'sport', notes: 'Opzegtermijn verschilt per vestiging.' },
  { key: 'sportcity',        name: 'SportCity',           cancelEmail: 'klantenservice@sportcity.nl',     noticeDays: 30, category: 'sport' },

  // ── Media / Nieuws ──────────────────────────────────────────────────────────
  { key: 'volkskrant',       name: 'de Volkskrant',       cancelEmail: 'klantenservice@volkskrant.nl',    noticeDays: 30, category: 'media' },
  { key: 'nrc',              name: 'NRC',                 cancelEmail: 'abonnementen@nrc.nl',             noticeDays: 30, category: 'media' },
  { key: 'ad',               name: 'AD',                  cancelEmail: 'klantenservice@ad.nl',            noticeDays: 30, category: 'media' },
  { key: 'telegraaf',        name: 'De Telegraaf',        cancelEmail: 'klantenservice@telegraaf.nl',     noticeDays: 30, category: 'media' },
  { key: 'fd',               name: 'Het Financieele Dagblad', cancelEmail: 'klantenservice@fd.nl',        noticeDays: 30, category: 'media' },
  { key: 'parool',           name: 'Het Parool',          cancelEmail: 'klantenservice@parool.nl',        noticeDays: 30, category: 'media' },
  { key: 'trouw',            name: 'Trouw',               cancelEmail: 'klantenservice@trouw.nl',         noticeDays: 30, category: 'media' },

  // ── Software / Apps ─────────────────────────────────────────────────────────
  { key: 'adobe',            name: 'Adobe',               cancelEmail: 'support@adobe.com',               noticeDays: 0,  category: 'software', notes: 'Vroegtijdig opzeggen kan een boete opleveren bij jaarabonnement.' },
  { key: 'microsoft',        name: 'Microsoft 365',       cancelEmail: 'support@microsoft.com',           noticeDays: 0,  category: 'software' },
  { key: 'canva',            name: 'Canva',               cancelEmail: 'support@canva.com',               noticeDays: 0,  category: 'software' },
  { key: 'notion',           name: 'Notion',              cancelEmail: 'team@makenotion.com',             noticeDays: 0,  category: 'software' },
  { key: 'chatgpt',          name: 'ChatGPT Plus',        cancelEmail: 'support@openai.com',              noticeDays: 0,  category: 'software' },
  { key: 'openai',           name: 'OpenAI',              cancelEmail: 'support@openai.com',              noticeDays: 0,  category: 'software' },
  { key: 'dropbox',          name: 'Dropbox',             cancelEmail: 'support@dropbox.com',             noticeDays: 0,  category: 'software' },
  { key: 'github',           name: 'GitHub',              cancelEmail: 'support@github.com',              noticeDays: 0,  category: 'software' },

  // ── Energie ─────────────────────────────────────────────────────────────────
  { key: 'vattenfall',       name: 'Vattenfall',          cancelEmail: 'klantenservice@vattenfall.nl',    noticeDays: 30, category: 'energy', notes: 'Opzegtermijn 30 dagen. Check einddatum contract.' },
  { key: 'eneco',            name: 'Eneco',               cancelEmail: 'klantenservice@eneco.nl',         noticeDays: 30, category: 'energy' },
  { key: 'essent',           name: 'Essent',              cancelEmail: 'klantenservice@essent.nl',        noticeDays: 30, category: 'energy' },
  { key: 'greenchoice',      name: 'Greenchoice',         cancelEmail: 'klantenservice@greenchoice.nl',   noticeDays: 30, category: 'energy' },
  { key: 'budget energie',   name: 'Budget Energie',      cancelEmail: 'klantenservice@budgetenergie.nl', noticeDays: 30, category: 'energy' },

  // ── Verzekering ─────────────────────────────────────────────────────────────
  { key: 'centraal beheer',  name: 'Centraal Beheer',     cancelEmail: 'klantenservice@centraalbeheer.nl', noticeDays: 30, category: 'insurance' },
  { key: 'interpolis',       name: 'Interpolis',          cancelEmail: 'klantenservice@interpolis.nl',    noticeDays: 30, category: 'insurance' },
  { key: 'unive',            name: 'Univé',               cancelEmail: 'klantenservice@unive.nl',         noticeDays: 30, category: 'insurance' },
  { key: 'aegon',            name: 'Aegon',               cancelEmail: 'klantenservice@aegon.nl',         noticeDays: 30, category: 'insurance' },
  { key: 'nationale nederlanden', name: 'Nationale-Nederlanden', cancelEmail: 'klantenservice@nn.nl',     noticeDays: 30, category: 'insurance' },

  // ── Overig ──────────────────────────────────────────────────────────────────
  { key: 'bol',              name: 'Bol Select',          cancelEmail: 'klantenservice@bol.com',          noticeDays: 0,  category: 'other' },
  { key: 'thuisbezorgd',     name: 'Thuisbezorgd+',       cancelEmail: 'klantenservice@thuisbezorgd.nl',  noticeDays: 0,  category: 'other' },
  { key: 'gorillas',         name: 'Gorillas',            cancelEmail: 'support@gorillas.io',             noticeDays: 0,  category: 'other' },
  { key: 'picnic',           name: 'Picnic',              cancelEmail: 'klantenservice@picnic.app',       noticeDays: 0,  category: 'other' },
  { key: 'anwb',             name: 'ANWB',                cancelEmail: 'ledenservice@anwb.nl',            noticeDays: 30, category: 'other', notes: 'Lidmaatschap opzeggen voor einde kalenderjaar.' },
  { key: 'hema',             name: 'HEMA',                cancelEmail: 'klantenservice@hema.nl',          noticeDays: 0,  category: 'other' },
]

/**
 * Find a cancel provider by matching against subscription name.
 * Uses substring matching — e.g. "Netflix B.V." matches "netflix".
 */
export function findCancelProvider(subscriptionName: string): CancelProvider | null {
  const lower = subscriptionName.toLowerCase()
  // Exact key match first
  const exact = CANCEL_PROVIDERS.find(p => lower === p.key)
  if (exact) return exact
  // Substring match
  return CANCEL_PROVIDERS.find(p => lower.includes(p.key)) ?? null
}