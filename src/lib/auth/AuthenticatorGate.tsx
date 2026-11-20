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

  return <main className="auth-main view-transition-wrap" style={{ minHeight: "100vh", background: "#F1E4D1" }}>
    <section className="panel gawa-modal-panel" key={factorId ? (enrollment ? "enroll" : "verify") : "prompt"} style={{ padding: 32, maxWidth: 480, width: "100%", background: "#FFFDF9", borderColor: "#E2D2BC" }}>
      <span className="auth-kicker">GAWA ACCOUNT SECURITY</span>
      <h1 style={{ fontSize: 26, margin: "12px 0" }}>{factorId && !enrollment ? "Enter your Authenticator code" : "Set up Google Authenticator"}</h1>
      <p style={{ marginBottom: 20 }}>Regular logins require your password and the current code from Google Authenticator. Email is used to verify your account at signup.</p>
      {error && <p role="alert" className="gawa-alert-banner gawa-alert-error" style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: 10, marginBottom: 16 }}>{error}</p>}
      {!ready ? <p className="gawa-step-transition">Checking account security…</p> : !factorId ?
        <button className={`btn btn-primary full ${busy ? "is-loading" : ""}`} disabled={busy} onClick={enroll}>{busy ? "Preparing…" : "Set up Authenticator"}</button> :
        <form className="gawa-step-transition" onSubmit={verify}>
          {enrollment && <>
            <p>In Google Authenticator, tap + and scan this QR code, or enter the setup key manually.</p>
            <img className="gawa-item-enter" src={enrollment.qr_code.startsWith("data:") ? enrollment.qr_code : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr_code)}`} width={200} height={200} alt="Scan with Google Authenticator" style={{ margin: "16px auto", borderRadius: 12, padding: 8, background: "#FFF", border: "1px solid #E2D2BC" }} />
            <p style={{ overflowWrap: "anywhere", marginBottom: 20 }}><b>Setup key:</b> {enrollment.secret}</p>
            <p>Keep your Authenticator account backed up. This flow does not issue the legacy custom recovery codes.</p>
          </>}
          <label>Authenticator code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required style={{ width: "100%", padding: 12, border: "1px solid #E2D2BC", borderRadius: 10, margin: "8px 0 16px" }} /></label>
          <button className={`btn btn-primary full ${busy ? "is-loading" : ""}`} disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify and continue"}</button>
        </form>}
      <button className="btn btn-ghost full" style={{ marginTop: 12 }} onClick={onCancel}>Sign out</button>
    </section>
  </main>;
}
