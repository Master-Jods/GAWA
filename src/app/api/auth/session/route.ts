/**
 * GET /api/auth/session
 *
 * Validates the current user session from HttpOnly cookies or Authorization header.
 * Returns safe profile and role data without exposing tokens.
 */
import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { jsonResponse } from "@/lib/server/security";

export async function GET(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);

  if (!caller) {
    return jsonResponse({
      authenticated: false,
      user: null,
    });
  }

  const primaryRole = caller.roles.includes("admin")
    ? "admin"
    : caller.roles.includes("business")
    ? "business"
    : "talent";

  return jsonResponse({
    authenticated: true,
    user: {
      id: caller.id,
      email: caller.email,
      role: primaryRole,
      roles: caller.roles,
      displayName: caller.displayName,
      businessId: caller.businessId,
    },
  });
}

