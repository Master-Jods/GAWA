/**
 * SMS sending utilities for auth system.
 * Configurable SMS provider gateway (Twilio, Generic HTTP SMS Gateway, etc.)
 *
 * Required env vars:
 *   SMS_PROVIDER   - e.g. "twilio", "generic"
 *   SMS_API_KEY    - API Key or Auth Token
 *   SMS_API_SECRET - API Secret / Account SID (for Twilio)
 *   SMS_FROM       - Verified sender phone number or Alphanumeric Sender ID
 *   SMS_GATEWAY_URL- (For generic HTTP gateway) endpoint URL
 */

export interface SmsSendResult {
  ok: boolean;
  error?: string;
  provider?: string;
}

export function isSmsConfigured(): boolean {
  const provider = (process.env.SMS_PROVIDER || "").toLowerCase().trim();
  const apiKey = process.env.SMS_API_KEY || "";
  return Boolean(provider && apiKey);
}

export async function sendOtpSms(
  toPhoneNumber: string,
  otpCode: string,
  expiresMinutes: number = 5
): Promise<SmsSendResult> {
  const provider = (process.env.SMS_PROVIDER || "").toLowerCase().trim();
  const apiKey = process.env.SMS_API_KEY || "";
  const apiSecret = process.env.SMS_API_SECRET || "";
  const fromNumber = process.env.SMS_FROM || "GAWA";

  if (!provider || !apiKey) {
    return {
      ok: false,
      error: "SMS provider is not configured. Please set SMS_PROVIDER and SMS_API_KEY.",
    };
  }

  const message = `Your GAWA verification code is: ${otpCode}. Valid for ${expiresMinutes} minutes. Do not share this code.`;

  try {
    if (provider === "twilio") {
      // Twilio REST API integration
      if (!apiSecret) {
        return {
          ok: false,
          error: "Twilio provider requires SMS_API_SECRET (Account SID).",
        };
      }
      const accountSid = apiSecret;
      const authToken = apiKey;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

      const params = new URLSearchParams();
      params.append("To", toPhoneNumber);
      params.append("From", fromNumber);
      params.append("Body", message);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          ok: false,
          error: errorData.message || `Twilio SMS delivery failed with status ${res.status}`,
        };
      }

      return { ok: true, provider: "twilio" };
    } else if (provider === "generic") {
      // Generic HTTP SMS Gateway integration
      const gatewayUrl = process.env.SMS_GATEWAY_URL;
      if (!gatewayUrl) {
        return {
          ok: false,
          error: "Generic SMS provider requires SMS_GATEWAY_URL.",
        };
      }

      const res = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: toPhoneNumber,
          from: fromNumber,
          message,
        }),
      });

      if (!res.ok) {
        return {
          ok: false,
          error: `SMS Gateway failed with HTTP ${res.status}`,
        };
      }

      return { ok: true, provider: "generic" };
    } else {
      return {
        ok: false,
        error: `Unsupported SMS provider: '${provider}'. Supported: 'twilio', 'generic'.`,
      };
    }
  } catch (err: any) {
    console.error("[sendOtpSms error]:", err);
    return {
      ok: false,
      error: err?.message || "Failed to dispatch SMS",
    };
  }
}

