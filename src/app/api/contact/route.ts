// src/app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const RATE_LIMIT_PER_HOUR = 3;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validate
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Vul een geldig e-mailadres in" },
        { status: 400 }
      );
    }
    if (!message || typeof message !== "string" || message.trim().length < 10) {
      return NextResponse.json(
        { error: "Bericht moet minimaal 10 tekens zijn" },
        { status: 400 }
      );
    }
    if (message.length > 5000) {
      return NextResponse.json(
        { error: "Bericht mag maximaal 5000 tekens zijn" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if user is logged in (optional - works for both logged in and anonymous)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Rate limiting by email
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabase
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("email", email.trim().toLowerCase())
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: "Je hebt het maximum aantal berichten per uur bereikt." },
        { status: 429 }
      );
    }

    // Store in database
    const { error } = await supabase.from("contact_messages").insert({
      user_id: user?.id ?? null,
      name: (name || "").trim().slice(0, 200),
      email: email.trim().toLowerCase().slice(0, 320),
      subject: (subject || "Algemeen").trim().slice(0, 200),
      message: message.trim().slice(0, 5000),
      status: "new",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Contact form error:", error);
      return NextResponse.json(
        { error: "Er ging iets mis. Probeer het later opnieuw." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}