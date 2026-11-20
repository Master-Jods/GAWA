import { NextResponse } from "next/server";

/** Legacy custom OTP/TOTP sessions do not satisfy Supabase AAL2. */
export async function POST() {
  return NextResponse.json({
    error: "This legacy authentication endpoint is disabled. Use the current signup and Google Authenticator flow.",
  }, { status: 410 });
}
