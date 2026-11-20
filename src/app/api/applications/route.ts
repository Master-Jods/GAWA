import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import {
  isValidUUID,
  sanitizeMultiline,
  clampNumber,
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
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");

    // Business view: applications across projects owned by caller's business
    if (scope === "business") {
      if (!caller.businessId) {
        return errorResponse("Business profile required", 403);
      }

      const { data: apps, error } = await supabase
        .from("project_applications")
        .select(`
          id,
          project_id,
          talent_id,
          proposal,
          status,
          proposed_budget,
          submitted_at,
          project:project_listings!inner(
            id,
            title,
            budget,
            business_id
          ),
          talent:account_profiles!project_applications_talent_id_fkey(
            id,
            display_name,
            avatar_color,
            location
          )
        `)
        .eq("project.business_id", caller.businessId)
        .neq("status", "withdrawn")
        .order("submitted_at", { ascending: false });

      if (error) {
        return errorResponse(error.message, 500);
      }

      const talentIds = Array.from(
        new Set((apps || []).map((a: any) => a.talent_id))
      );

      const talentProfileMap = new Map<string, any>();
      const talentSkillsMap = new Map<string, string[]>();

      if (talentIds.length > 0) {
        const [{ data: tProfiles }, { data: tSkills }] = await Promise.all([
          supabase
            .from("talent_profiles")
            .select("user_id, headline, school, course")
            .in("user_id", talentIds),
          supabase
            .from("talent_skills")
            .select("talent_id, skill:catalog_skills(name)")
            .in("talent_id", talentIds),
        ]);

        for (const tp of tProfiles || []) {
          talentProfileMap.set(tp.user_id, tp);
        }
        for (const ts of tSkills || []) {
          const list = talentSkillsMap.get(ts.talent_id) || [];
          const sName = (ts.skill as any)?.name;
          if (sName) list.push(sName);
          talentSkillsMap.set(ts.talent_id, list);
        }
      }

      const enriched = (apps || []).map((a: any) => {
        const tp = talentProfileMap.get(a.talent_id);
        const skills = talentSkillsMap.get(a.talent_id) || [];
        return {
          ...a,
          talent_details: {
            display_name: a.talent?.display_name || "Talent",
            avatar_color: a.talent?.avatar_color || "#087EAD",
            location: a.talent?.location || "",
            headline: tp?.headline || tp?.course || "Emerging Talent",
            school: tp?.school || "Verified Member",
            skills: skills.length > 0 ? skills : ["General Professional"],
          },
        };
      });

      return jsonResponse({ applications: enriched });
    }

    // Talent view: only caller's own applications
    const { data: apps, error } = await supabase
      .from("project_applications")
      .select(`
        id,
        project_id,
        talent_id,
        proposal,
        status,
        proposed_budget,
        submitted_at,
        project:project_listings(
          id,
          title,
          description,
          budget,
          duration_label,
          work_setup,
          published_at,
          created_at,
          category:catalog_project_categories(name),
          business:business_profiles(name, avatar_color),
          required_skills:project_required_skills(
            skill:catalog_skills(name)
          )
        )
      `)
      .eq("talent_id", caller.id)
      .neq("status", "withdrawn")
      .order("submitted_at", { ascending: false });

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ applications: apps || [] });
  } catch (err: any) {
    console.error("[GET /api/applications error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireRole(req, "talent", "write");
    if (authErr || !caller) return authErr!;

    const body = await req.json();
    const { project_id, portfolio_item_ids = [] } = body;

    if (!isValidUUID(project_id)) {
      return errorResponse("Valid project ID is required", 400);
    }

    const proposal = sanitizeMultiline(body.proposal, 3000);
    if (!proposal || proposal.length < 15) {
      return errorResponse("Proposal must be at least 15 characters", 400);
    }

    const supabase = createServerAdminClient();

    // 1. Verify project exists, is open, and not owned by applicant
    const { data: project, error: projErr } = await supabase
      .from("project_listings")
      .select(`
        id,
        business_id,
        budget,
        status,
        application_deadline,
        business:business_profiles(owner_id)
      `)
      .eq("id", project_id)
      .single();

    if (projErr || !project) {
      return errorResponse("Project not found", 404);
    }

    if (project.status !== "published" && project.status !== "active") {
      return errorResponse("This project is not currently accepting applications", 400);
    }

    // Check deadline
    if (project.application_deadline) {
      const todayStr = new Date().toISOString().split("T")[0];
      if (project.application_deadline < todayStr) {
        return errorResponse("The application deadline for this project has passed", 400);
      }
    }

    // Prevent business owner from applying to own project
    const businessOwner = (project.business as any)?.owner_id;
    if (businessOwner === caller.id) {
      return errorResponse("You cannot apply to your own project", 400);
    }

    // Prevent duplicate applications
    const { data: existingApp } = await supabase
      .from("project_applications")
      .select("id, status")
      .eq("project_id", project_id)
      .eq("talent_id", caller.id)
      .maybeSingle();

    if (existingApp) {
      return errorResponse("You have already applied to this project listing", 409);
    }

    const proposedBudget = body.proposed_budget
      ? clampNumber(body.proposed_budget, 100, 10000000, project.budget)
      : project.budget;

    // 2. Insert application record
    const { data: application, error: appErr } = await supabase
      .from("project_applications")
      .insert({
        project_id,
        talent_id: caller.id,
        proposal,
        proposed_budget: proposedBudget,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .select("id, project_id, talent_id, proposal, status, proposed_budget, submitted_at")
      .single();

    if (appErr || !application) {
      return errorResponse(appErr?.message || "Failed to submit proposal", 500);
    }

    // 3. Attach only caller-owned portfolio items
    if (Array.isArray(portfolio_item_ids) && portfolio_item_ids.length > 0) {
      const validUuids = portfolio_item_ids.filter((id) => isValidUUID(id));
      if (validUuids.length > 0) {
        const { data: ownedItems } = await supabase
          .from("portfolio_items")
          .select("id")
          .eq("talent_id", caller.id)
          .in("id", validUuids);

        const validIds = (ownedItems || []).map((i) => i.id);
        if (validIds.length > 0) {
          const portfolioInserts = validIds.map((pid) => ({
            application_id: application.id,
            portfolio_item_id: pid,
          }));
          await supabase
            .from("project_application_portfolio")
            .insert(portfolioInserts);
        }
      }
    }

    // 4. Notify business owner
    if (businessOwner) {
      await supabase.from("notification_inbox").insert({
        user_id: businessOwner,
        kind: "application_received",
        title: "New Application Received",
        body: `A talent submitted a proposal for your project listing.`,
        project_id,
      });
    }

    // 5. Audit log
    await logAuditEvent({
      actorId: caller.id,
      action: "application.submit",
      entityTable: "project_applications",
      entityId: application.id,
      details: {
        project_id,
        proposed_budget: proposedBudget,
      },
    });

    return jsonResponse({ success: true, application }, 201);
  } catch (err: any) {
    console.error("[POST /api/applications error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "write");
    if (authErr || !caller) return authErr!;

    const body = await req.json();
    const { application_id, status: nextStatus } = body;

    if (!isValidUUID(application_id)) {
      return errorResponse("Valid application_id is required", 400);
    }

    const validatedStatus = validateEnum(
      nextStatus,
      ["withdrawn", "shortlisted", "interview", "rejected"] as const
    );

    if (!validatedStatus) {
      return errorResponse("Invalid status transition", 400);
    }

    const supabase = createServerAdminClient();

    const { data: appRecord, error: fetchErr } = await supabase
      .from("project_applications")
      .select(`
        id,
        project_id,
        talent_id,
        status,
        project:project_listings(id, title, business_id)
      `)
      .eq("id", application_id)
      .single();

    if (fetchErr || !appRecord) {
      return errorResponse("Application not found", 404);
    }

    const proj = appRecord.project as any;

    // Authorization & State Transition Rules
    if (validatedStatus === "withdrawn") {
      // Only applicant can withdraw
      if (appRecord.talent_id !== caller.id) {
        return errorResponse("Forbidden: You cannot withdraw another user's proposal", 403);
      }
      if (appRecord.status === "accepted" || appRecord.status === "rejected") {
        return errorResponse("Cannot withdraw a finalized application", 400);
      }
    } else {
      // Business owner changing stage
      const isOwner = caller.businessId && proj?.business_id === caller.businessId;
      const isAdmin = caller.roles.includes("admin");

      if (!isOwner && !isAdmin) {
        return errorResponse("Forbidden: Business owner permission required", 403);
      }
      if (appRecord.status === "withdrawn" || appRecord.status === "accepted") {
        return errorResponse(`Cannot update an application that is already ${appRecord.status}`, 400);
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from("project_applications")
      .update({ status: validatedStatus })
      .eq("id", application_id)
      .select("id, status, updated_at")
      .single();

    if (updateErr || !updated) {
      return errorResponse(updateErr?.message || "Failed to update application", 500);
    }

    // In-app notification for talent
    if (validatedStatus !== "withdrawn") {
      await supabase.from("notification_inbox").insert({
        user_id: appRecord.talent_id,
        kind: `application_${validatedStatus}`,
        title: `Application ${validatedStatus.charAt(0).toUpperCase() + validatedStatus.slice(1)}`,
        body: `Your proposal for "${proj?.title || "Project"}" was updated to ${validatedStatus}.`,
        project_id: appRecord.project_id,
      });
    }

    // Audit log
    await logAuditEvent({
      actorId: caller.id,
      action: `application.${validatedStatus}`,
      entityTable: "project_applications",
      entityId: application_id,
      details: {
        project_id: appRecord.project_id,
        previous_status: appRecord.status,
        next_status: validatedStatus,
      },
    });

    return jsonResponse({ success: true, application: updated });
  } catch (err: any) {
    console.error("[PATCH /api/applications error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
