"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function SignupEmailVerification({ email, onBack }: {
  email: string; onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resendAt, setResendAt] = useState(Date.now() + 60000);
  const resend = async () => {
    if (Date.now() < resendAt) { setError("Please wait one minute before resending."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup", email,
        options: { emailRedirectTo: new URL("/", window.location.origin).toString() },
      });
      if (error) throw error;
      setResendAt(Date.now() + 60000);
      setMessage("A verification email was requested. Check your Inbox or Spam and follow the link.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to resend verification email."); }
    finally { setBusy(false); }
  };
  return <main className="auth-main view-transition-wrap" style={{ minHeight: "100vh", background: "#F1E4D1" }}><section className="panel gawa-modal-panel" style={{ padding: 32, maxWidth: 480, width: "100%", background: "#FFFDF9", borderColor: "#E2D2BC" }}>
    <span className="auth-kicker">GAWA EMAIL VERIFICATION</span>
    <h1 style={{ fontSize: 26, margin: "12px 0" }}>Check your email</h1>
    <p>Open the verification email sent to <strong>{email}</strong> and click the confirmation link to activate your account.</p>
    <p style={{ margin: "12px 0 20px" }}>After confirming your email, continue to GAWA to set up Google Authenticator. Regular logins will use your password and Authenticator code.</p>
    {error && <p role="alert" className="gawa-alert-banner gawa-alert-error" style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: 10, margin: "12px 0" }}>{error}</p>}
    {message && <p role="status" className="gawa-alert-banner gawa-alert-info" style={{ color: "#162660", background: "#D0E6FD", border: "1px solid #9AC6F9", padding: "10px 14px", borderRadius: 10, margin: "12px 0" }}>{message}</p>}
    <button className="btn btn-primary full" onClick={onBack}>Continue to login</button>
    <button className={`btn btn-white full ${busy ? "is-loading" : ""}`} style={{ marginTop: 12 }} disabled={busy} onClick={resend}>{busy ? "Sending…" : "Resend verification email"}</button>
  </section></main>;
}
