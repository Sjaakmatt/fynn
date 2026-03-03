import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Call new recurring detector (same-origin)
    const res = await fetch(new URL("/api/sync/recurring", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error ?? "Recurring detection failed" },
        { status: res.status }
      );
    }

    // Keep old response shape-ish for frontend compatibility
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    return NextResponse.json({
      success: true,
      detected: candidates.length,
      // optional extra info
      candidates,
      updated: data?.updated ?? 0,
    });
  } catch (error) {
    console.error("Recurring wrapper error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}