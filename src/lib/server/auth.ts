import { NextRequest } from "next/server";
import { createServerAdminClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/server/security";
import { checkRateLimit, RateLimitTier } from "@/lib/server/rate-limit";

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  businessId?: string;
  displayName?: string;
}

/**
 * Extracts authentication token from either Authorization header or cookies.
 */
function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // Check Supabase cookies
  const cookies = req.cookies;
  const cookieToken =
    cookies.get("sb-access-token")?.value ||
    cookies.get("sb-auth-token")?.value;

  if (cookieToken) return cookieToken;

  return null;
}

/**
 * Validates authentication token against Supabase Auth and checks active status.
 */
export async function getAuthenticatedUser(
  req: NextRequest
): Promise<AuthenticatedUser | null> {
  const token = extractToken(req);
  if (!token) return null;

  try {
    const supabase = createServerAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return null;
    }

    // getUser validated the token above; require Supabase's signed MFA assurance claim.
    let claims: { aal?: string };
    try { claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); }
    catch { return null; }
    if (claims.aal !== "aal2" || !user.email_confirmed_at) return null;

    // 1. Check account active status (Must be 'active')
    const { data: statusData } = await supabase
      .from("account_statuses")
      .select("status")
      .eq("user_id", user.id)
      .single();

    if (statusData?.status !== "active") {
      // User is either suspended, closed, or pending
      return null;
    }

    // 2. Fetch assigned roles
    const { data: roleData } = await supabase
      .from("account_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = (roleData || []).map((r) => r.role);

    // 3. Fetch public profile display name
    const { data: profile } = await supabase
      .from("account_profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    // 4. If business role, resolve business profile id
    let businessId: string | undefined;
    if (roles.includes("business")) {
      const { data: bData } = await supabase
        .from("business_profiles")
        .select("id")
        .eq("owner_id", user.id)
        .single();
      if (bData) {
        businessId = bData.id;
      }
    }

    return {
      id: user.id,
      email: user.email || "",
      roles,
      businessId,
      displayName: profile?.display_name || undefined,
    };
  } catch (err) {
    console.error("[getAuthenticatedUser error]:", err);
    return null;
  }
}

/**
 * Route guard: requires active authenticated user with optional rate limiting.
 */
export async function requireAuth(
  req: NextRequest,
  tier: RateLimitTier = "read"
) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) {
    return {
      caller: null,
      error: errorResponse("Unauthorized: Active session required", 401),
    };
  }

  const rateCheck = checkRateLimit(req, tier, caller.id);
  if (!rateCheck.allowed) {
    return {
      caller: null,
      error: errorResponse(
        "Rate limit exceeded. Please try again shortly.",
        429,
        { retryAfter: rateCheck.retryAfter }
      ),
    };
  }

  return { caller, error: null };
}

/**
 * Route guard: requires specific role membership.
 */
export async function requireRole(
  req: NextRequest,
  role: "talent" | "business" | "admin",
  tier: RateLimitTier = "read"
) {
  const { caller, error } = await requireAuth(req, tier);
  if (error || !caller) return { caller: null, error };

  if (!caller.roles.includes(role) && !caller.roles.includes("admin")) {
    return {
      caller: null,
      error: errorResponse(
        `Forbidden: '${role}' permissions required`,
        403
      ),
    };
  }

  return { caller, error: null };
}

/**
 * Route guard: strictly requires verified Business owner profile.
 */
export async function requireBusiness(
  req: NextRequest,
  tier: RateLimitTier = "write"
) {
  const { caller, error } = await requireRole(req, "business", tier);
  if (error || !caller) return { caller: null, error };

  if (!caller.businessId) {
    return {
      caller: null,
      error: errorResponse(
        "Forbidden: Verified business profile not found",
        403
      ),
    };
  }

  return { caller, error: null };
}

/**
 * Route guard: strictly requires Admin privileges.
 */
export async function requireAdmin(
  req: NextRequest,
  tier: RateLimitTier = "read"
) {
  const { caller, error } = await requireAuth(req, tier);
  if (error || !caller) return { caller: null, error };

  if (!caller.roles.includes("admin")) {
    return {
      caller: null,
      error: errorResponse("Forbidden: Administrator access required", 403),
    };
  }

  return { caller, error: null };
}
