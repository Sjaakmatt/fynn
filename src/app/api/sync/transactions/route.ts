import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Wrapper: oude endpoint blijft bestaan, maar gebruikt de nieuwe EB sync
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // default merge; support reset for debugging
  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === "reset" ? "reset" : "merge";

  // Call internal route (same origin)
  const res = await fetch(new URL("/api/enablebanking/sync", request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: request.headers.get("cookie") ?? "" },
    body: JSON.stringify({ mode }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json({ error: data?.error ?? "EnableBanking sync failed" }, { status: res.status });
  }

  return NextResponse.json({ success: true, ...data });
}