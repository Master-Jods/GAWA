"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/** Supabase issues an AAL2 session only after verifying an enrolled TOTP factor. */
export function AuthenticatorGate({ onVerified, onCancel }: {
  onVerified: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<{ secret: string; qr_code: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      else setFactorId(data.totp.find(f => f.status === "verified")?.id || "");
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  const enroll = async () => {
    setBusy(true); setError("");
    try {
      // Remove abandoned, unverified enrollments without touching an active factor.
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const existing = factors.totp.find(f => f.status === "verified");
      if (existing) { setFactorId(existing.id); return; }
      for (const factor of factors.all.filter(f => f.factor_type === "totp" && f.status === "unverified")) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "GAWA Google Authenticator", issuer: "GAWA" });
      if (error) throw error;
      setFactorId(data.id); setEnrollment(data.totp);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to start Authenticator setup."); }
    finally { setBusy(false); }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
      await onVerified();
    } catch (err) { setError(err instanceof Error ? err.message : "Verification failed."); }
    finally { setBusy(false); }
  };

  return <main className="auth-main" style={{ minHeight: "100vh", background: "#f6f9fc" }}>
    <section className="panel" style={{ padding: 32, maxWidth: 480, width: "100%" }}>
      <span className="auth-kicker">GAWA ACCOUNT SECURITY</span>
      <h1 style={{ fontSize: 26, margin: "12px 0" }}>{factorId && !enrollment ? "Enter your Authenticator code" : "Set up Google Authenticator"}</h1>
      <p style={{ marginBottom: 20 }}>Regular logins require your password and the current code from Google Authenticator. Email is used to verify your account at signup.</p>
      {error && <p role="alert" style={{ color: "#b91c1c", marginBottom: 16 }}>{error}</p>}
      {!ready ? <p>Checking account security…</p> : !factorId ?
        <button className="btn btn-primary full" disabled={busy} onClick={enroll}>{busy ? "Preparing…" : "Set up Authenticator"}</button> :
        <form onSubmit={verify}>
          {enrollment && <>
            <p>In Google Authenticator, tap + and scan this QR code, or enter the setup key manually.</p>
            <img src={enrollment.qr_code.startsWith("data:") ? enrollment.qr_code : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr_code)}`} width={200} height={200} alt="Scan with Google Authenticator" style={{ margin: "16px auto" }} />
            <p style={{ overflowWrap: "anywhere", marginBottom: 20 }}><b>Setup key:</b> {enrollment.secret}</p>
            <p>Keep your Authenticator account backed up. This flow does not issue the legacy custom recovery codes.</p>
          </>}
          <label>Authenticator code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required style={{ width: "100%", padding: 12, border: "1px solid #dce7ed", borderRadius: 10, margin: "8px 0 16px" }} /></label>
          <button className="btn btn-primary full" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify and continue"}</button>
        </form>}
      <button className="btn btn-ghost full" style={{ marginTop: 12 }} onClick={onCancel}>Sign out</button>
    </section>
  </main>;
}
