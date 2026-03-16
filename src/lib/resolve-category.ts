// src/lib/resolve-category.ts
//
// Single source of truth for transaction category resolution.
//
// Priority:
// 0. Internal transfer (IBAN-based) — always wins
// 1. user_override → per-user merchant category
// 2. merchant_map → global merchant category (skip 'overig' — fall through)
// 3. rule engine → keyword-based categorization
// 4. 'overig' as final fallback
//
// NEVER use tx.category directly — it's a stale cache that can be wrong.
// Always use this function to compute the live category.

import {
  categorizeTransaction,
  isInternalTransfer,
} from './categorize-engine'

export interface CategoryMaps {
  /** merchant_key → category from merchant_map */
  merchantMap: Map<string, string>
  /** merchant_key → category from merchant_user_overrides (per user) */
  userOverrides: Map<string, string>
  /** All user IBANs for internal transfer detection */
  userIbans?: string[]
}

/**
 * Resolve the category for a transaction.
 *
 * Priority:
 * 0) IBAN-based internal transfer (always wins — eigen rekeningen)
 * 1) User override (explicit user choice)
 * 2) merchant_map (global, but SKIP 'overig' — fall through to rule engine)
 * 3) Rule engine (keyword-based from categorize-engine.ts)
 * 4) 'overig' as final fallback
 */
export function resolveCategory(
  tx: {
    merchant_key?: string | null
    description?: string
    amount?: number
  },
  maps: CategoryMaps,
): string {
  const key = tx.merchant_key

  // 0) IBAN-based internal transfer — always check first
  if (
    tx.description &&
    maps.userIbans &&
    maps.userIbans.length > 0 &&
    isInternalTransfer(tx.description, maps.userIbans)
  ) {
    return 'interne_overboeking'
  }

  // 1) User override (highest priority after internal transfers)
  if (key && maps.userOverrides.has(key)) {
    return maps.userOverrides.get(key)!
  }

  // 2) merchant_map — but SKIP 'overig' (let rule engine try harder)
  if (key && maps.merchantMap.has(key)) {
    const mapCat = maps.merchantMap.get(key)!
    if (mapCat !== 'overig') {
      return mapCat
    }
    // 'overig' in merchant_map → fall through to rule engine
  }

  // 3) Rule engine fallback
  if (tx.description) {
    return categorizeTransaction(
      tx.description,
      Number(tx.amount ?? 0),
      undefined, // no merchantMapCategory — we already checked above
      maps.userIbans,
    )
  }

  return 'overig'
}

/**
 * Build CategoryMaps from Supabase query results.
 * Use this in every route that needs categories.
 */
export function buildCategoryMaps(
  merchantMapRows: { merchant_key: string; category: string | null }[] | null,
  userOverrideRows: { merchant_key: string; category: string | null }[] | null,
  userIbans?: string[],
): CategoryMaps {
  const merchantMap = new Map<string, string>()
  for (const row of merchantMapRows ?? []) {
    if (row.category) merchantMap.set(row.merchant_key, row.category)
  }

  const userOverrides = new Map<string, string>()
  for (const row of userOverrideRows ?? []) {
    if (row.category) userOverrides.set(row.merchant_key, row.category)
  }

  return { merchantMap, userOverrides, userIbans }
}