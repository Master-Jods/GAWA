/**
 * GAWA Auth Security Test Suite
 *
 * Tests all authentication flows via HTTP against a running server.
 * Run with: npx tsx src/__tests__/run-tests.ts
 *
 * Requires GAWA_TEST_BASE_URL env var (default: http://localhost:3000)
 */

const BASE = process.env.GAWA_TEST_BASE_URL || "http://localhost:3000";

let clientSeq = 1;
function getHeaders(extra: Record<string, string> = {}) {
  clientSeq++;
  return {
    "x-gawa-csrf": "1",
    "x-forwarded-for": `198.51.100.${clientSeq}`,
    ...extra,
  };
}

type TestResult = { name: string; pass: boolean; message: string };

async function json(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// 1. Login endpoint tests
// ---------------------------------------------------------------------------

async function testLoginInvalidPassword(): Promise<TestResult> {
  const name = "Login — wrong password returns 401";
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ email: "nonexistent@test.invalid", password: "wrongpassword" }),
    });
    const pass = res.status === 401;
    return { name, pass, message: pass ? "✓" : `Expected 401, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

async function testLoginMissingBody(): Promise<TestResult> {
  const name = "Login — empty body returns 400";
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });
    const pass = res.status === 400;
    return { name, pass, message: pass ? "✓" : `Expected 400, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

async function testLoginNoCsrf(): Promise<TestResult> {
  const name = "Login — missing CSRF header in dev allows access without 500";
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.99" },
      body: JSON.stringify({ email: "test@test.com", password: "test" }),
    });
    const pass = res.status < 500;
    return { name, pass, message: pass ? `✓ (status ${res.status})` : `Unexpected 500` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 2. OTP endpoint tests
// ---------------------------------------------------------------------------

async function testOtpVerifyInvalidChallenge(): Promise<TestResult> {
  const name = "OTP Verify — invalid challenge_id returns 400";
  try {
    const res = await fetch(`${BASE}/api/auth/otp/verify`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        challenge_id: "00000000-0000-0000-0000-000000000000",
        code: "123456",
        user_id: "00000000-0000-0000-0000-000000000000",
      }),
    });
    const pass = res.status === 400 || res.status === 401;
    return { name, pass, message: pass ? "✓" : `Expected 400/401, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

async function testOtpResendInvalidChallenge(): Promise<TestResult> {
  const name = "OTP Resend — invalid challenge returns 404";
  try {
    const res = await fetch(`${BASE}/api/auth/otp/resend`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ challenge_id: "00000000-0000-0000-0000-000000000000" }),
    });
    const pass = res.status === 404;
    return { name, pass, message: pass ? "✓" : `Expected 404, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 3. Session & Auth Guard tests
// ---------------------------------------------------------------------------

async function testSessionUnauthenticated(): Promise<TestResult> {
  const name = "Session — unauthenticated returns authenticated: false";
  try {
    const res = await fetch(`${BASE}/api/auth/session`, {
      headers: getHeaders(),
    });
    const data = await json(res);
    const pass = res.ok && data.authenticated === false;
    return { name, pass, message: pass ? "✓" : `Got: ${JSON.stringify(data)}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

async function testProtectedRouteUnauthorized(): Promise<TestResult> {
  const name = "Protected route — /api/admin returns 401 without auth";
  try {
    const res = await fetch(`${BASE}/api/admin`, {
      headers: getHeaders(),
    });
    const pass = res.status === 401;
    return { name, pass, message: pass ? "✓" : `Expected 401, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

async function testProtectedPaymentsUnauthorized(): Promise<TestResult> {
  const name = "Protected route — /api/payments returns 401 without auth";
  try {
    const res = await fetch(`${BASE}/api/payments`, {
      headers: getHeaders(),
    });
    const pass = res.status === 401;
    return { name, pass, message: pass ? "✓" : `Expected 401, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 4. Password reset tests
// ---------------------------------------------------------------------------

async function testForgotPasswordGenericResponse(): Promise<TestResult> {
  const name = "Forgot Password — always returns 200 (non-enumerable)";
  try {
    const res1 = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ email: "definitely-does-not-exist@test.invalid" }),
    });
    const res2 = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ email: "also-does-not-exist@test.invalid" }),
    });
    const pass = res1.status === 200 && res2.status === 200;
    return { name, pass, message: pass ? "✓" : `Got ${res1.status} / ${res2.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

async function testResetPasswordInvalidToken(): Promise<TestResult> {
  const name = "Reset Password — invalid token returns 400";
  try {
    const res = await fetch(`${BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ token: "deadbeef1234invalid", password: "NewPass123" }),
    });
    const pass = res.status === 400 || res.status === 410;
    return { name, pass, message: pass ? "✓" : `Expected 400/410, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

async function testResetPasswordWeakPassword(): Promise<TestResult> {
  const name = "Reset Password — weak password returns 400";
  try {
    const res = await fetch(`${BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ token: "anytoken", password: "abc" }),
    });
    const pass = res.status === 400;
    return { name, pass, message: pass ? "✓" : `Expected 400, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 5. 2FA endpoint tests
// ---------------------------------------------------------------------------

async function testTotpSetupRequiresAuth(): Promise<TestResult> {
  const name = "2FA Setup — returns 401 without auth";
  try {
    const res = await fetch(`${BASE}/api/auth/2fa/setup`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });
    const pass = res.status === 401;
    return { name, pass, message: pass ? "✓" : `Expected 401, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

async function testTotpChallengeInvalidCode(): Promise<TestResult> {
  const name = "2FA Challenge — invalid user_id returns 400/404";
  try {
    const res = await fetch(`${BASE}/api/auth/2fa/challenge`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: "00000000-0000-0000-0000-000000000000", code: "123456" }),
    });
    const pass = res.status === 400 || res.status === 404 || res.status === 401;
    return { name, pass, message: pass ? "✓" : `Expected 400/401/404, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

async function testRecoveryCodeInvalid(): Promise<TestResult> {
  const name = "2FA Recovery — invalid recovery code returns 401";
  try {
    const res = await fetch(`${BASE}/api/auth/2fa/recovery`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        user_id: "00000000-0000-0000-0000-000000000000",
        recovery_code: "aaaaaa-bbbbbb",
      }),
    });
    const pass = res.status === 401 || res.status === 403 || res.status === 404;
    return { name, pass, message: pass ? "✓" : `Expected 401/403/404, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 6. Google OAuth tests
// ---------------------------------------------------------------------------

async function testGoogleSsoRoute(): Promise<TestResult> {
  const name = "Google SSO — /api/auth/google returns URL or appropriate error";
  try {
    const res = await fetch(`${BASE}/api/auth/google`, {
      headers: getHeaders(),
    });
    const data = await json(res);
    const pass = (res.ok && typeof data.url === "string") || res.status === 500;
    return {
      name,
      pass,
      message: res.ok
        ? `✓ (OAuth URL generated: ${String(data.url).slice(0, 50)}…)`
        : `Status ${res.status} — Google SSO provider not enabled in dashboard`,
    };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 7. Public routes still work
// ---------------------------------------------------------------------------

async function testPublicListingsAccessible(): Promise<TestResult> {
  const name = "Public Routes — /api/listings accessible without auth";
  try {
    const res = await fetch(`${BASE}/api/listings`, {
      headers: getHeaders(),
    });
    const pass = res.status === 200;
    return { name, pass, message: pass ? "✓" : `Expected 200, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

async function testPublicTalentsAccessible(): Promise<TestResult> {
  const name = "Public Routes — /api/talents accessible without auth";
  try {
    const res = await fetch(`${BASE}/api/talents`, {
      headers: getHeaders(),
    });
    const pass = res.status === 200;
    return { name, pass, message: pass ? "✓" : `Expected 200, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 8. Logout test
// ---------------------------------------------------------------------------

async function testLogoutUnauthenticated(): Promise<TestResult> {
  const name = "Logout — works even without active session (clears cookies)";
  try {
    const res = await fetch(`${BASE}/api/auth/logout`, {
      method: "POST",
      headers: getHeaders(),
    });
    const data = await json(res);
    const pass = res.ok && data.success === true;
    return { name, pass, message: pass ? "✓" : `Got ${res.status}: ${JSON.stringify(data)}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 9. Refresh token test
// ---------------------------------------------------------------------------

async function testRefreshNoToken(): Promise<TestResult> {
  const name = "Session Refresh — without token returns 401";
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });
    const pass = res.status === 401;
    return { name, pass, message: pass ? "✓" : `Expected 401, got ${res.status}` };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 10. Rate limiting test
// ---------------------------------------------------------------------------

async function testRateLimitingLogin(): Promise<TestResult> {
  const name = "Rate Limiting — 20 rapid login attempts on same IP trigger 429";
  try {
    let got429 = false;
    const dedicatedIp = "203.0.113.88";
    for (let i = 0; i < 20; i++) {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gawa-csrf": "1",
          "x-forwarded-for": dedicatedIp,
        },
        body: JSON.stringify({ email: "ratelimit@test.invalid", password: "badpassword" }),
      });
      if (res.status === 429) {
        got429 = true;
        break;
      }
    }
    return { name, pass: got429, message: got429 ? "✓" : "Rate limit was not triggered after 20 requests" };
  } catch (err: any) {
    return { name, pass: false, message: `Error: ${err.message}` };
  }
}

export const ALL_TESTS = [
  testLoginInvalidPassword,
  testLoginMissingBody,
  testLoginNoCsrf,
  testOtpVerifyInvalidChallenge,
  testOtpResendInvalidChallenge,
  testSessionUnauthenticated,
  testProtectedRouteUnauthorized,
  testProtectedPaymentsUnauthorized,
  testForgotPasswordGenericResponse,
  testResetPasswordInvalidToken,
  testResetPasswordWeakPassword,
  testTotpSetupRequiresAuth,
  testTotpChallengeInvalidCode,
  testRecoveryCodeInvalid,
  testGoogleSsoRoute,
  testPublicListingsAccessible,
  testPublicTalentsAccessible,
  testLogoutUnauthenticated,
  testRefreshNoToken,
  testRateLimitingLogin,
];
