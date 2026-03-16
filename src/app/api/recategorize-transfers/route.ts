// src/app/api/recategorize-transfers/route.ts
//
// POST /api/recategorize-transfers
//
// Legacy backfill route. With the new architecture, category is computed live
// via resolveCategory() which calls isInternalTransfer() automatically.
// This route is kept for backward compatibility but no longer writes to transactions.

import { NextRequest, NextResponse } from 'next/server'

export async function POST(_request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Category is nu live berekend via resolveCategory — geen backfill nodig.',
    updated: 0,
  })
}