import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = {
  merchantKey: string;
  category?: string | null;
  isVariable?: boolean | null;
  recurringHint?: boolean | null;
};

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as Body;

    const merchantKey = (body.merchantKey ?? "").trim();
    if (!merchantKey) {
      return NextResponse.json({ error: "Missing merchantKey" }, { status: 400 });
    }

    const payload: {
      user_id: string;
      merchant_key: string;
      category?: string | null;
      is_variable?: boolean | null;
      recurring_hint?: boolean | null;
      updated_at: string;
    } = {
      user_id: user.id,
      merchant_key: merchantKey,
      updated_at: new Date().toISOString(),
    };

    // Only set fields explicitly provided (so PATCH is partial)
    if ("category" in body) payload.category = body.category ?? null;
    if ("isVariable" in body) payload.is_variable = body.isVariable ?? null;
    if ("recurringHint" in body) payload.recurring_hint = body.recurringHint ?? null;

    const { error } = await supabase
      .from("merchant_user_overrides")
      .upsert(payload, { onConflict: "user_id,merchant_key" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("merchant override error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}