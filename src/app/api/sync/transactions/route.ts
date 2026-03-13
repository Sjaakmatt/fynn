// src/app/api/sync/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { POST as enableBankingSync } from "@/app/api/enablebanking/sync/route";
import { POST as plaidSync } from "@/app/api/plaid/sync/route";

const provider = process.env.NEXT_PUBLIC_BANKING_PROVIDER ?? "enablebanking";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const handler = provider === "plaid" ? plaidSync : enableBankingSync;
    return await handler(request);
  } catch (error) {
    console.error("[sync/transactions] Error:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}