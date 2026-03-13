import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { POST as recurringSync } from "@/app/api/sync/recurring/route";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return await recurringSync(request);
  } catch (error) {
    console.error("Recurring wrapper error:", error);
    return NextResponse.json(
      { error: "Recurring detection failed" },
      { status: 500 }
    );
  }
} 