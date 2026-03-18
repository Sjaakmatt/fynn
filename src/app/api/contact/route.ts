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

    const cleanName = (name || "").trim().slice(0, 200);
    const cleanEmail = email.trim().toLowerCase().slice(0, 320);
    const cleanSubject = (subject || "Algemeen").trim().slice(0, 200);
    const cleanMessage = message.trim().slice(0, 5000);

    // Store in database
    const { error } = await supabase.from("contact_messages").insert({
      user_id: user?.id ?? null,
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
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

    // Send email notification via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Fynn <noreply@meetfynn.nl>",
            to: "info@meetfynn.nl",
            subject: `Nieuw contactbericht: ${cleanSubject}`,
            html: `
              <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
                <h2 style="color: #1A3A2A; font-size: 18px; margin-bottom: 24px;">
                  Nieuw bericht via contactformulier
                </h2>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280; font-size: 14px; width: 100px;">Naam</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px;">${cleanName || "Niet ingevuld"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">E-mail</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px;">
                      <a href="mailto:${cleanEmail}" style="color: #1A3A2A;">${cleanEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Onderwerp</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px;">${cleanSubject}</td>
                  </tr>
                  ${user ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">User ID</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 13px; font-family: monospace;">${user.id}</td>
                  </tr>
                  ` : ""}
                </table>

                <div style="background: #F9FAFB; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                  <p style="color: #6B7280; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.05em;">Bericht</p>
                  <p style="color: #111827; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${cleanMessage}</p>
                </div>

                <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                  Via contactformulier op meetfynn.nl
                </p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        // Non-blocking — bericht is al opgeslagen in DB
        console.error("Resend email error:", emailError);
      }
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