import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import {
  sanitizeString,
  sanitizeMultiline,
  validateEnum,
  jsonResponse,
  errorResponse,
} from "@/lib/server/security";
import { logAuditEvent } from "@/lib/server/audit";

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "read");
    if (authErr || !caller) return authErr!;

    const supabase = createServerAdminClient();

    const [
      { data: profile },
      { data: talentProfile },
      { data: businessProfile },
      { data: preferences },
    ] = await Promise.all([
      supabase.from("account_profiles").select("*").eq("id", caller.id).single(),
      supabase
        .from("talent_profiles")
        .select("*")
        .eq("user_id", caller.id)
        .maybeSingle(),
      caller.businessId
        ? supabase
            .from("business_profiles")
            .select("*")
            .eq("id", caller.businessId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("account_preferences")
        .select("*")
        .eq("user_id", caller.id)
        .maybeSingle(),
    ]);

    return jsonResponse({
      profile,
      talentProfile,
      businessProfile,
      preferences,
      roles: caller.roles,
    });
  } catch (err: any) {
    console.error("[GET /api/profile error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "write");
    if (authErr || !caller) return authErr!;

    const body = await req.json();
    const supabase = createServerAdminClient();

    // 1. Whitelisted updates for account_profiles
    const profileUpdates: Record<string, any> = {};
    if (body.display_name !== undefined) {
      profileUpdates.display_name = sanitizeString(body.display_name, 80);
    }
    if (body.bio !== undefined) {
      profileUpdates.bio = sanitizeMultiline(body.bio, 1000);
    }
    if (body.location !== undefined) {
      profileUpdates.location = sanitizeString(body.location, 100);
    }
    if (body.avatar_color !== undefined) {
      profileUpdates.avatar_color = sanitizeString(body.avatar_color, 20);
    }
    if (body.profile_visible !== undefined) {
      profileUpdates.profile_visible = Boolean(body.profile_visible);
    }

    if (Object.keys(profileUpdates).length > 0) {
      await supabase
        .from("account_profiles")
        .update(profileUpdates)
        .eq("id", caller.id);
    }

    // 2. Whitelisted updates for talent_profiles
    if (caller.roles.includes("talent") && body.talent) {
      const talentUpdates: Record<string, any> = {};
      if (body.talent.headline !== undefined) {
        talentUpdates.headline = sanitizeString(body.talent.headline, 120);
      }
      if (body.talent.school !== undefined) {
        talentUpdates.school = sanitizeString(body.talent.school, 120);
      }
      if (body.talent.course !== undefined) {
        talentUpdates.course = sanitizeString(body.talent.course, 120);
      }
      if (body.talent.work_setup !== undefined || body.talent.work_setup_preference !== undefined) {
        const ws = String(body.talent.work_setup || body.talent.work_setup_preference).toLowerCase();
        talentUpdates.remote_work = ws === "remote" || ws === "any";
        talentUpdates.hybrid_work = ws === "hybrid" || ws === "any";
        talentUpdates.onsite_work = ws === "onsite";
      }

      if (Object.keys(talentUpdates).length > 0) {
        await supabase
          .from("talent_profiles")
          .update(talentUpdates)
          .eq("user_id", caller.id);
      }
    }

    // 3. Whitelisted updates for business_profiles
    if (caller.businessId && body.business) {
      const bizUpdates: Record<string, any> = {};
      if (body.business.name !== undefined) {
        bizUpdates.name = sanitizeString(body.business.name, 120);
      }
      if (body.business.industry !== undefined) {
        bizUpdates.industry = sanitizeString(body.business.industry, 100);
      }
      if (body.business.company_size !== undefined) {
        bizUpdates.company_size = sanitizeString(body.business.company_size, 50);
      }
      if (body.business.avatar_color !== undefined) {
        bizUpdates.avatar_color = sanitizeString(body.business.avatar_color, 20);
      }

      if (Object.keys(bizUpdates).length > 0) {
        await supabase
          .from("business_profiles")
          .update(bizUpdates)
          .eq("id", caller.businessId);
      }
    }

    await logAuditEvent({
      actorId: caller.id,
      action: "profile.update",
      entityTable: "account_profiles",
      entityId: caller.id,
      details: { profileUpdates },
    });

    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error("[PATCH /api/profile error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
