/**
 * POST /api/auth/logout
 *
 * Terminates user session:
 * - Revokes server session in private.user_sessions
 * - Clears HttpOnly cookies
 * - Calls Supabase admin signOut
 * - Records audit event
 */
import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { jsonResponse, errorResponse } from "@/lib/server/security";
import { logAuditEvent } from "@/lib/server/audit";
import { clearAuthCookies, revokeAllUserSessions, validateCsrf } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  if (!validateCsrf(req)) {
    return errorResponse("CSRF validation failed", 403);
  }

  const caller = await getAuthenticatedUser(req);

  const response = jsonResponse({
    success: true,
    message: "Logged out successfully",
  });

  // Clear HttpOnly cookies
  clearAuthCookies(response);

  if (caller) {
    // Revoke sessions in database
    await revokeAllUserSessions(caller.id);

    await logAuditEvent({
      actorId: caller.id,
      action: "auth.logout",
      entityTable: "public.user_sessions",
      entityId: caller.id,
    });
  }

  return response;
}

