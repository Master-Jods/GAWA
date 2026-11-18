import { NextRequest } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding window cache for rate limiting
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale entries periodically
let lastCleanup = Date.now();
function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < 60000) return; // run at most once per minute
  lastCleanup = now;

  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export type RateLimitTier = "read" | "write" | "sensitive";

interface TierConfig {
  windowMs: number;
  maxRequests: number;
}

const TIER_CONFIGS: Record<RateLimitTier, TierConfig> = {
  read: { windowMs: 60 * 1000, maxRequests: 120 }, // 120 reads / min
  write: { windowMs: 60 * 1000, maxRequests: 40 }, // 40 writes / min
  sensitive: { windowMs: 60 * 1000, maxRequests: 15 }, // 15 sensitive ops / min (hire, payment, auth)
};

/**
 * Extracts client identifier from request headers (IP or forwarding proxies).
 */
export function getClientIdentifier(req: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`;

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return `ip:${firstIp}`;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return `ip:${realIp}`;

  return "ip:127.0.0.1";
}

/**
 * Checks rate limit for the given request and tier.
 */
export function checkRateLimit(
  req: NextRequest,
  tier: RateLimitTier = "read",
  userId?: string
): { allowed: boolean; remaining: number; retryAfter?: number } {
  cleanupStaleEntries();

  const config = TIER_CONFIGS[tier];
  const clientId = getClientIdentifier(req, userId);
  const key = `${tier}:${clientId}`;
  const now = Date.now();

  const record = rateLimitStore.get(key);

  if (!record || record.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
    };
  }

  if (record.count >= config.maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
  };
}
