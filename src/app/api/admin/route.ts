import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import {
  isValidUUID,
  sanitizeString,
  sanitizeMultiline,
  validateEnum,
  jsonResponse,
  errorResponse,
} from "@/lib/server/security";
import { logAuditEvent } from "@/lib/server/audit";

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAdmin(req, "read");
    if (authErr || !caller) return authErr!;

    const supabase = createServerAdminClient();

    const [
      { data: allProfiles },
      { data: allRoles },
      { data: allStatuses },
      { data: allBusinesses },
      { data: allProjects },
      { data: allModeration },
      { data: allAuditEvents },
      { data: allReports },
      { data: allVerifications },
    ] = await Promise.all([
      supabase
        .from("account_profiles")
        .select("id, display_name, location, avatar_color, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("account_roles").select("user_id, role"),
      supabase.from("account_statuses").select("user_id, status, reason"),
      supabase.from("business_profiles").select("id, owner_id, name"),
      supabase
        .from("project_listings")
        .select("id, business_id, title, budget, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("project_moderation").select("project_id, status, featured"),
      supabase
        .from("admin_audit_events")
        .select("id, actor_id, action, entity_table, entity_id, details, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("moderation_reports")
        .select(`
          id,
          reporter_id,
          reported_user_id,
          project_id,
          reason,
          details,
          status,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("verification_submissions")
        .select(`
          id,
          talent_id,
          status,
          score,
          submitted_at,
          assessment:verification_assessments(title)
        `)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const roleMap = new Map<string, string>();
    for (const r of allRoles || []) {
      if (r.role === "admin" || !roleMap.has(r.user_id)) {
        roleMap.set(r.user_id, r.role);
      }
    }

    const statusMap = new Map<string, string>();
    for (const s of allStatuses || []) {
      statusMap.set(s.user_id, s.status);
    }

    const bizMap = new Map<string, string>();
    for (const b of allBusinesses || []) {
      bizMap.set(b.id, b.name);
    }

    const modMap = new Map<string, any>();
    for (const m of allModeration || []) {
      modMap.set(m.project_id, m);
    }

    const profileMap = new Map<string, string>();
    for (const p of allProfiles || []) {
      profileMap.set(p.id, p.display_name);
    }

    const users = (allProfiles || []).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      role: roleMap.get(p.id) || "talent",
      status: statusMap.get(p.id) || "active",
      location: p.location || "Philippines",
      createdAt: p.created_at,
    }));

    const projectsWithMod = (allProjects || []).map((p) => {
      const mod = modMap.get(p.id);
      return {
        id: p.id,
        title: p.title,
        businessName: bizMap.get(p.business_id) || "Business",
        budget: p.budget,
        status: p.status,
        moderationStatus: mod?.status || "pending",
        isFeatured: mod?.featured || false,
        createdAt: p.created_at,
      };
    });

    return jsonResponse({
      metrics: {
        totalUsers: (allProfiles || []).length,
        talentsCount: (allRoles || []).filter((r) => r.role === "talent").length,
        businessesCount: (allBusinesses || []).length,
        activeProjectsCount: (allProjects || []).filter(
          (p) => p.status === "published" || p.status === "active"
        ).length,
        openReportsCount: (allReports || []).filter((r) => r.status === "open").length,
        pendingVerifications: (allVerifications || []).filter(
          (v: any) => v.status === "submitted" || v.status === "in_review"
        ).length,
      },
      users,
      projects: projectsWithMod,
      reports: allReports || [],
      auditEvents: allAuditEvents || [],
      verifications: allVerifications || [],
    });
  } catch (err: any) {
    console.error("[GET /api/admin error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAdmin(req, "sensitive");
    if (authErr || !caller) return authErr!;

    const body = await req.json();
    const { action } = body;
    const supabase = createServerAdminClient();

    // 1. MODERATE PROJECT LISTING
    if (action === "moderate_listing") {
      const { project_id, status: modStatus, featured } = body;

      if (!isValidUUID(project_id)) {
        return errorResponse("Valid project_id is required", 400);
      }

      const validStatus = validateEnum(
        modStatus,
        ["pending", "approved", "rejected", "hidden"] as const
      );
      if (!validStatus) {
        return errorResponse("Invalid moderation status", 400);
      }

      await supabase.from("project_moderation").upsert({
        project_id,
        status: validStatus,
        featured: Boolean(featured),
        reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(),
      });

      await logAuditEvent({
        actorId: caller.id,
        action: `admin.moderate_listing.${validStatus}`,
        entityTable: "project_moderation",
        entityId: project_id,
        details: { status: validStatus, featured: Boolean(featured) },
      });

      return jsonResponse({ success: true, status: validStatus });
    }

    // 2. TOGGLE USER ACCOUNT STATUS
    if (action === "toggle_user_status") {
      const { user_id, status: userStatus, reason } = body;

      if (!isValidUUID(user_id)) {
        return errorResponse("Valid user_id is required", 400);
      }

      if (user_id === caller.id) {
        return errorResponse("Admins cannot suspend their own account", 400);
      }

      const validStatus = validateEnum(
        userStatus,
        ["active", "suspended", "closed"] as const
      );
      if (!validStatus) {
        return errorResponse("Invalid status value", 400);
      }

      const cleanReason = sanitizeString(reason, 255);

      await supabase
        .from("account_statuses")
        .update({
          status: validStatus,
          reason: cleanReason || null,
        })
        .eq("user_id", user_id);

      await logAuditEvent({
        actorId: caller.id,
        action: `admin.user_status.${validStatus}`,
        entityTable: "account_statuses",
        entityId: user_id,
        details: { status: validStatus, reason: cleanReason },
      });

      return jsonResponse({ success: true, status: validStatus });
    }

    // 3. RESOLVE MODERATION REPORT
    if (action === "resolve_report") {
      const { report_id, status: repStatus, resolution } = body;

      if (!isValidUUID(report_id)) {
        return errorResponse("Valid report_id is required", 400);
      }

      const validStatus = validateEnum(
        repStatus,
        ["investigating", "resolved", "dismissed"] as const
      );
      if (!validStatus) {
        return errorResponse("Invalid report status", 400);
      }

      const cleanResolution = sanitizeMultiline(resolution, 1000);

      await supabase
        .from("moderation_reports")
        .update({
          status: validStatus,
          assigned_admin_id: caller.id,
          resolution: cleanResolution || null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", report_id);

      await logAuditEvent({
        actorId: caller.id,
        action: `admin.report.${validStatus}`,
        entityTable: "moderation_reports",
        entityId: report_id,
        details: { status: validStatus, resolution: cleanResolution },
      });

      return jsonResponse({ success: true, status: validStatus });
    }

    return errorResponse("Unknown action", 400);
  } catch (err: any) {
    console.error("[POST /api/admin error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
