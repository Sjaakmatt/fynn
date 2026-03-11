import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid";
import { Products, CountryCode } from "plaid";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Fynn",
      products: [Products.Transactions],
      country_codes: [CountryCode.Nl, CountryCode.Be],
      language: "nl",
      redirect_uri: undefined, // niet nodig voor webview
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error: any) {
    console.error("[Plaid] create-link-token error:", error?.response?.data ?? error.message);
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 }
    );
  }
}