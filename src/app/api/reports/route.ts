import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import {
  isValidUUID,
  sanitizeString,
  sanitizeMultiline,
  jsonResponse,
  errorResponse,
} from "@/lib/server/security";
import { logAuditEvent } from "@/lib/server/audit";

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "write");
    if (authErr || !caller) return authErr!;

    const body = await req.json();
    const {
      reported_user_id,
      project_id,
      review_id,
      message_id,
      reason,
      details,
    } = body;

    // Strict constraint: exactly one target must be non-null
    const targets = [
      reported_user_id && isValidUUID(reported_user_id) ? reported_user_id : null,
      project_id && isValidUUID(project_id) ? project_id : null,
      review_id && isValidUUID(review_id) ? review_id : null,
      message_id && isValidUUID(message_id) ? message_id : null,
    ].filter(Boolean);

    if (targets.length !== 1) {
      return errorResponse(
        "A report must target exactly one entity (user, project, review, or message)",
        400
      );
    }

    const cleanReason = sanitizeString(reason, 100);
    const cleanDetails = sanitizeMultiline(details, 2000);

    if (!cleanReason || cleanReason.length < 3) {
      return errorResponse("A meaningful report reason is required", 400);
    }

    const supabase = createServerAdminClient();

    const { data: report, error } = await supabase
      .from("moderation_reports")
      .insert({
        reporter_id: caller.id,
        reported_user_id: reported_user_id || null,
        project_id: project_id || null,
        review_id: review_id || null,
        message_id: message_id || null,
        reason: cleanReason,
        details: cleanDetails || null,
        status: "open",
      })
      .select()
      .single();

    if (error || !report) {
      return errorResponse(error?.message || "Failed to submit report", 500);
    }

    await logAuditEvent({
      actorId: caller.id,
      action: "report.file",
      entityTable: "moderation_reports",
      entityId: report.id,
      details: { reason: cleanReason },
    });

    return jsonResponse(
      {
        success: true,
        message:
          "Report submitted successfully. Our safety team will review it promptly.",
      },
      201
    );
  } catch (err: any) {
    console.error("[POST /api/reports error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
