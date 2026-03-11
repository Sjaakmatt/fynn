import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { public_token } = await request.json();
    if (!public_token) {
      return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
    }

    // Wissel public_token om voor permanent access_token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Sla Plaid item op (equivalent van enablebanking_sessions)
    const { error: itemError } = await supabase
      .from("plaid_items")
      .upsert(
        {
          user_id: user.id,
          item_id: itemId,
          access_token: accessToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "item_id" }
      );

    if (itemError) {
      console.error("[Plaid] Item opslaan mislukt:", itemError);
      return NextResponse.json({ error: "Failed to save connection" }, { status: 500 });
    }

    // Haal accounts op en sla ze op
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accounts = accountsResponse.data.accounts;
    let savedCount = 0;

    for (const account of accounts) {
      const accountType = account.subtype === "savings" ? "SAVINGS" : "CHECKING";
      const accountName = account.official_name ?? account.name ?? "Rekening";
      const iban = account.mask ? `****${account.mask}` : null;
      const balance = account.balances.current;

      const { error: accError } = await supabase
        .from("bank_accounts")
        .upsert(
          {
            user_id: user.id,
            external_id: account.account_id,
            account_name: accountName,
            iban,
            balance,
            account_type: accountType,
            provider: "plaid",
            plaid_item_id: itemId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "external_id" }
        );

      if (accError) {
        console.error(`[Plaid] Account opslaan mislukt:`, accError);
        continue;
      }
      savedCount++;
    }

    console.log(`[Plaid] ${savedCount}/${accounts.length} accounts opgeslagen voor item ${itemId}`);

    return NextResponse.json({
      ok: true,
      item_id: itemId,
      accounts_saved: savedCount,
      accounts_total: accounts.length,
    });
  } catch (error: any) {
    console.error("[Plaid] exchange-token error:", error?.response?.data ?? error.message);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}