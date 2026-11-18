import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import { isValidUUID, jsonResponse, errorResponse } from "@/lib/server/security";

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "read");
    if (authErr || !caller) return authErr!;

    const supabase = createServerAdminClient();

    const { data: notifications, error } = await supabase
      .from("notification_inbox")
      .select("id, kind, title, body, project_id, conversation_id, read_at, created_at")
      .eq("user_id", caller.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return errorResponse(error.message, 500);
    }

    const unreadCount = (notifications || []).filter((n) => !n.read_at).length;

    return jsonResponse({
      notifications: notifications || [],
      unreadCount,
    });
  } catch (err: any) {
    console.error("[GET /api/notifications error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "write");
    if (authErr || !caller) return authErr!;

    const body = await req.json().catch(() => ({}));
    const { notification_id } = body;
    const supabase = createServerAdminClient();

    let query = supabase
      .from("notification_inbox")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", caller.id);

    if (notification_id && isValidUUID(notification_id)) {
      query = query.eq("id", notification_id);
    } else {
      query = query.is("read_at", null);
    }

    const { error } = await query;

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error("[PATCH /api/notifications error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "write");
    if (authErr || !caller) return authErr!;

    const { searchParams } = new URL(req.url);
    const notificationId = searchParams.get("id");
    const supabase = createServerAdminClient();

    let query = supabase.from("notification_inbox").delete().eq("user_id", caller.id);

    if (notificationId && isValidUUID(notificationId)) {
      query = query.eq("id", notificationId);
    }

    const { error } = await query;

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ success: true, message: "Notifications cleared" });
  } catch (err: any) {
    console.error("[DELETE /api/notifications error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
