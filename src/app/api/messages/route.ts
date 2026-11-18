import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerAdminClient();

    // Fetch available contacts (other users) so user can easily start a new conversation
    const [
      { data: allProfiles },
      { data: allRoles },
      { data: allBiz },
    ] = await Promise.all([
      supabase
        .from("account_profiles")
        .select("id, display_name, avatar_path, avatar_color")
        .neq("id", caller.id),
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

    // Find conversations where caller is a participant
    const { data: myMemberships, error: memErr } = await supabase
      .from("messaging_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", caller.id);

    if (memErr || !myMemberships || myMemberships.length === 0) {
      return NextResponse.json({ conversations: [], contacts });
    }

    const convIds = myMemberships.map((m) => m.conversation_id);

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

    return NextResponse.json({ conversations: enriched, contacts });
  } catch (err: any) {
    console.error("Error in GET /api/messages:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action = "send", conversation_id, recipient_id, subject, message, project_id } = body;

    const supabase = createServerAdminClient();

    if (action === "start") {
      if (!recipient_id || recipient_id === caller.id) {
        return NextResponse.json(
          { error: "Valid recipient_id is required" },
          { status: 400 }
        );
      }

      // Check if a conversation already exists between caller and recipient
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
        const { data: createdConv, error: cErr } = await supabase
          .from("messaging_conversations")
          .insert({
            project_id: project_id || null,
            subject: subject || "Project Collaboration",
          })
          .select("id")
          .single();

        if (cErr || !createdConv) {
          return NextResponse.json(
            { error: cErr?.message || "Failed to start conversation" },
            { status: 500 }
          );
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

      if (message?.trim()) {
        await supabase.from("messaging_messages").insert({
          conversation_id: existingConvId,
          sender_id: caller.id,
          body: message.trim(),
        });

        await supabase.from("notification_inbox").insert({
          user_id: recipient_id,
          kind: "message_received",
          title: "New Message",
          body: message.trim().slice(0, 120),
          conversation_id: existingConvId,
        });
      }

      return NextResponse.json({ success: true, conversation_id: existingConvId });
    }

    // Send message in existing conversation
    if (!conversation_id || !message?.trim()) {
      return NextResponse.json(
        { error: "conversation_id and message are required" },
        { status: 400 }
      );
    }

    const { data: member } = await supabase
      .from("messaging_participants")
      .select("conversation_id")
      .eq("conversation_id", conversation_id)
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: msg, error: mErr } = await supabase
      .from("messaging_messages")
      .insert({
        conversation_id,
        sender_id: caller.id,
        body: message.trim(),
      })
      .select("id, conversation_id, sender_id, body, created_at")
      .single();

    if (mErr || !msg) {
      return NextResponse.json(
        { error: mErr?.message || "Failed to send message" },
        { status: 500 }
      );
    }

    await supabase
      .from("messaging_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversation_id)
      .eq("user_id", caller.id);

    return NextResponse.json({ success: true, message: msg });
  } catch (err: any) {
    console.error("Error in POST /api/messages:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
