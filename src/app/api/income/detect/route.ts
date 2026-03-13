// src/app/api/income/detect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { POST as incomeSync } from "@/app/api/sync/income/route";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return await incomeSync(request);
  } catch (error) {
    console.error("[income/detect] Error:", error);
    return NextResponse.json(
      { error: "Income detection failed" },
      { status: 500 }
    );
  }
}