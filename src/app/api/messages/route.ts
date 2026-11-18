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

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "read");
    if (authErr || !caller) return authErr!;

    const supabase = createServerAdminClient();

    // 1. Fetch available contacts (public display info only - no emails or phone numbers)
    const [
      { data: allProfiles },
      { data: allRoles },
      { data: allBiz },
    ] = await Promise.all([
      supabase
        .from("account_profiles")
        .select("id, display_name, avatar_path, avatar_color")
        .neq("id", caller.id)
        .eq("profile_visible", true)
        .limit(100),
      supabase.from("account_roles").select("user_id, role"),
      supabase.from("business_profiles").select("owner_id, name"),
    ]);

    const roleMap = new Map<string, string>();
    for (const r of allRoles || []) {
      if (r.role === "business" || !roleMap.has(r.user_id)) {
        roleMap.set(r.user_id, r.role);
      }
    }
    const bizNameMap = new Map<string, string>();
    for (const b of allBiz || []) {
      bizNameMap.set(b.owner_id, b.name);
    }

    const contacts = (allProfiles || []).map((p) => {
      const r = roleMap.get(p.id) || "talent";
      const bizName = bizNameMap.get(p.id);
      return {
        id: p.id,
        name: bizName ? `${p.display_name} (${bizName})` : p.display_name,
        role: r === "business" ? "Business" : r === "admin" ? "Admin" : "Talent",
        avatar_path: p.avatar_path || null,
        avatar_color: p.avatar_color || "#087EAD",
      };
    });

    // 2. Fetch conversations where caller is a registered participant
    const { data: myMemberships, error: memErr } = await supabase
      .from("messaging_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", caller.id);

    if (memErr || !myMemberships || myMemberships.length === 0) {
      return jsonResponse({ conversations: [], contacts });
    }

    const convIds = myMemberships.map((m) => m.conversation_id);

    // 3. Fetch conversation details, participants, and non-deleted messages
    const [
      { data: convs },
      { data: participants },
      { data: messages },
    ] = await Promise.all([
      supabase
        .from("messaging_conversations")
        .select("id, project_id, subject, created_at, updated_at, project:project_listings(title)")
        .in("id", convIds)
        .order("updated_at", { ascending: false }),
      supabase
        .from("messaging_participants")
        .select("conversation_id, user_id, last_read_at, profile:account_profiles(id, display_name, avatar_path, avatar_color)")
        .in("conversation_id", convIds),
      supabase
        .from("messaging_messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .in("conversation_id", convIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
    ]);

    const enriched = (convs || []).map((c: any) => {
      const cParticipants = (participants || []).filter(
        (p: any) => p.conversation_id === c.id
      );
      const otherParticipant =
        cParticipants.find((p: any) => p.user_id !== caller.id) ||
        cParticipants[0];
      const otherProfile = (otherParticipant as any)?.profile;
      const cMessages = (messages || []).filter(
        (m: any) => m.conversation_id === c.id
      );
      const lastMsg = cMessages[cMessages.length - 1];

      return {
        id: c.id,
        subject: c.subject || (c.project as any)?.title || "Direct Collaboration",
        other_name: otherProfile?.display_name || "Collaborator",
        other_avatar: otherProfile?.avatar_path || null,
        other_color: otherProfile?.avatar_color || "#087EAD",
        last_message: lastMsg?.body || "Conversation started",
        updated_at: lastMsg?.created_at || c.updated_at || c.created_at,
        messages: cMessages.map((m: any) => ({
          id: m.id,
          sender_id: m.sender_id,
          mine: m.sender_id === caller.id,
          body: m.body,
          created_at: m.created_at,
        })),
      };
    });

    return jsonResponse({ conversations: enriched, contacts });
  } catch (err: any) {
    console.error("[GET /api/messages error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "write");
    if (authErr || !caller) return authErr!;

    const body = await req.json();
    const action = body.action || "send";
    const supabase = createServerAdminClient();

    // 1. START NEW CONVERSATION
    if (action === "start") {
      const { recipient_id, subject, message, project_id } = body;

      if (!isValidUUID(recipient_id) || recipient_id === caller.id) {
        return errorResponse("Valid recipient_id is required and cannot be self", 400);
      }

      // Check recipient exists and is active
      const { data: recipientProfile } = await supabase
        .from("account_profiles")
        .select("id")
        .eq("id", recipient_id)
        .single();

      if (!recipientProfile) {
        return errorResponse("Recipient does not exist", 404);
      }

      // Check for existing conversation between these two users
      const { data: callerConvs } = await supabase
        .from("messaging_participants")
        .select("conversation_id")
        .eq("user_id", caller.id);

      const callerConvIds = (callerConvs || []).map((c) => c.conversation_id);
      let existingConvId: string | null = null;

      if (callerConvIds.length > 0) {
        const { data: shared } = await supabase
          .from("messaging_participants")
          .select("conversation_id")
          .eq("user_id", recipient_id)
          .in("conversation_id", callerConvIds)
          .limit(1)
          .maybeSingle();

        if (shared) {
          existingConvId = shared.conversation_id;
        }
      }

      if (!existingConvId) {
        const cleanSubject = sanitizeString(subject, 100) || "Project Collaboration";
        const cleanProjectId = isValidUUID(project_id) ? project_id : null;

        const { data: createdConv, error: cErr } = await supabase
          .from("messaging_conversations")
          .insert({
            project_id: cleanProjectId,
            subject: cleanSubject,
          })
          .select("id")
          .single();

        if (cErr || !createdConv) {
          return errorResponse(cErr?.message || "Failed to create conversation", 500);
        }

        existingConvId = createdConv.id;

        await supabase.from("messaging_participants").insert([
          {
            conversation_id: existingConvId,
            user_id: caller.id,
            last_read_at: new Date().toISOString(),
          },
          {
            conversation_id: existingConvId,
            user_id: recipient_id,
          },
        ]);
      }

      const cleanMessage = sanitizeMultiline(message, 2000);
      if (cleanMessage) {
        await supabase.from("messaging_messages").insert({
          conversation_id: existingConvId,
          sender_id: caller.id,
          body: cleanMessage,
        });

        await supabase.from("notification_inbox").insert({
          user_id: recipient_id,
          kind: "message_received",
          title: "New Message",
          body: cleanMessage.slice(0, 100),
          conversation_id: existingConvId,
        });
      }

      return jsonResponse({ success: true, conversation_id: existingConvId }, 201);
    }

    // 2. SEND MESSAGE TO EXISTING CONVERSATION
    const { conversation_id, message } = body;

    if (!isValidUUID(conversation_id)) {
      return errorResponse("Valid conversation_id is required", 400);
    }

    const cleanMessage = sanitizeMultiline(message, 2000);
    if (!cleanMessage) {
      return errorResponse("Message content cannot be empty", 400);
    }

    // Strict membership verification
    const { data: membership } = await supabase
      .from("messaging_participants")
      .select("conversation_id")
      .eq("conversation_id", conversation_id)
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!membership) {
      return errorResponse("Forbidden: You are not a participant in this conversation", 403);
    }

    const { data: msg, error: mErr } = await supabase
      .from("messaging_messages")
      .insert({
        conversation_id,
        sender_id: caller.id,
        body: cleanMessage,
      })
      .select("id, conversation_id, sender_id, body, created_at")
      .single();

    if (mErr || !msg) {
      return errorResponse(mErr?.message || "Failed to send message", 500);
    }

    // Update caller's last_read_at
    await supabase
      .from("messaging_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversation_id)
      .eq("user_id", caller.id);

    // Notify other participants
    const { data: others } = await supabase
      .from("messaging_participants")
      .select("user_id")
      .eq("conversation_id", conversation_id)
      .neq("user_id", caller.id);

    if (others && others.length > 0) {
      const notifs = others.map((o) => ({
        user_id: o.user_id,
        kind: "message_received",
        title: `Message from ${caller.displayName || "Collaborator"}`,
        body: cleanMessage.slice(0, 100),
        conversation_id,
      }));
      await supabase.from("notification_inbox").insert(notifs);
    }

    return jsonResponse({ success: true, message: msg }, 201);
  } catch (err: any) {
    console.error("[POST /api/messages error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
