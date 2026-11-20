import { NextRequest } from "next/server";
import {
  requireAuth,
  requireBusiness,
  getAuthenticatedUser,
} from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import {
  isValidUUID,
  sanitizeString,
  sanitizeMultiline,
  sanitizeStringArray,
  clampNumber,
  validateEnum,
  jsonResponse,
  errorResponse,
} from "@/lib/server/security";
import { logAuditEvent } from "@/lib/server/audit";
import { checkRateLimit } from "@/lib/server/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const rateCheck = checkRateLimit(req, "read");
    if (!rateCheck.allowed) {
      return errorResponse("Too many requests", 429, {
        retryAfter: rateCheck.retryAfter,
      });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");
    const supabase = createServerAdminClient();

    // Business Scope: only show projects owned by caller's business
    if (scope === "business") {
      const caller = await getAuthenticatedUser(req);
      if (!caller || !caller.businessId) {
        return errorResponse("Unauthorized: Business account required", 401);
      }

      const { data: listings, error } = await supabase
        .from("project_listings")
        .select(`
          id,
          title,
          description,
          objectives,
          expected_deliverables,
          budget,
          duration_label,
          application_deadline,
          work_setup,
          status,
          published_at,
          created_at,
          category:catalog_project_categories(name),
          business:business_profiles(name, avatar_color, logo_path, owner_id),
          required_skills:project_required_skills(
            skill:catalog_skills(name)
          ),
          moderation:project_moderation(featured, status),
          applications:project_applications(id, status)
        `)
        .eq("business_id", caller.businessId)
        .order("created_at", { ascending: false });

      if (error) {
        return errorResponse(error.message, 500);
      }

      return jsonResponse({ listings: listings || [] });
    }

    // Public Scope: only approved & published listings
    const { data: listings, error } = await supabase
      .from("project_listings")
      .select(`
        id,
        title,
        description,
        objectives,
        expected_deliverables,
        budget,
        duration_label,
        application_deadline,
        work_setup,
        status,
        published_at,
        created_at,
        category:catalog_project_categories(name),
        business:business_profiles(name, avatar_color, logo_path, owner_id),
        required_skills:project_required_skills(
          skill:catalog_skills(name)
        ),
        moderation:project_moderation!inner(featured, status),
        applications:project_applications(id, status)
      `)
      .eq("status", "published")
      .eq("moderation.status", "approved")
      .order("published_at", { ascending: false })
      .limit(50);

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ listings: listings || [] });
  } catch (err: any) {
    console.error("[GET /api/listings error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireBusiness(req, "write");
    if (authErr || !caller || !caller.businessId) return authErr!;

    const body = await req.json();

    // 1. Strict Input Sanitization & Validation
    const rawTitle = sanitizeString(body.title, 120);
    const rawDesc = sanitizeMultiline(body.description, 5000);
    const budget = clampNumber(body.budget, 500, 10000000, 0);

    if (!rawTitle || rawTitle.length < 3) {
      return errorResponse("Title must be between 3 and 120 characters", 400);
    }
    if (!rawDesc || rawDesc.length < 10) {
      return errorResponse("Description must be at least 10 characters", 400);
    }
    if (budget < 500) {
      return errorResponse("Minimum project budget is ₱500", 400);
    }

    const durationLabel = sanitizeString(body.duration_label, 50) || "4 weeks";
    const workSetup = validateEnum(
      body.work_setup,
      ["remote", "onsite", "hybrid"] as const,
      "remote"
    )!;

    const objectives = sanitizeStringArray(body.objectives, 10, 250);
    const expectedDeliverables = sanitizeStringArray(
      body.expected_deliverables,
      10,
      250
    );

    // 2. Deadline validation
    const todayStr = new Date().toISOString().split("T")[0];
    let deadlineStr = sanitizeString(body.application_deadline, 20);
    if (!deadlineStr || deadlineStr < todayStr) {
      const deadline = new Date();
      const deadlineDays = clampNumber(body.deadline_days, 1, 90, 30);
      deadline.setDate(deadline.getDate() + deadlineDays);
      deadlineStr = deadline.toISOString().split("T")[0];
    }

    const supabase = createServerAdminClient();

    // 3. Resolve category_id safely
    let resolvedCategoryId: string | null = null;
    if (body.category_id && isValidUUID(body.category_id)) {
      resolvedCategoryId = body.category_id;
    } else if (body.category_name) {
      const cleanCatName = sanitizeString(body.category_name, 50);
      const { data: catData } = await supabase
        .from("catalog_project_categories")
        .select("id")
        .ilike("name", `%${cleanCatName}%`)
        .limit(1)
        .maybeSingle();
      if (catData) resolvedCategoryId = catData.id;
    }

    // 4. Insert project listing
    const { data: project, error: insertError } = await supabase
      .from("project_listings")
      .insert({
        business_id: caller.businessId,
        category_id: resolvedCategoryId,
        title: rawTitle,
        description: rawDesc,
        objectives,
        expected_deliverables: expectedDeliverables,
        budget,
        duration_label: durationLabel,
        application_deadline: deadlineStr,
        work_setup: workSetup,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select(`
        id,
        title,
        description,
        budget,
        duration_label,
        work_setup,
        published_at,
        business:business_profiles(name, avatar_color),
        category:catalog_project_categories(name)
      `)
      .single();

    if (insertError || !project) {
      return errorResponse(insertError?.message || "Failed to create listing", 500);
    }

    // 5. Connect required skills
    if (Array.isArray(body.skills) && body.skills.length > 0) {
      const sanitizedSkills = sanitizeStringArray(body.skills, 10, 50);
      const { data: catalogSkills } = await supabase
        .from("catalog_skills")
        .select("id, name");

      const skillMap = new Map(
        (catalogSkills || []).map((s) => [s.name.toLowerCase(), s.id])
      );

      const skillInserts: { project_id: string; skill_id: string }[] = [];
      for (const sName of sanitizedSkills) {
        const matchedId = skillMap.get(sName.toLowerCase());
        if (matchedId) {
          skillInserts.push({ project_id: project.id, skill_id: matchedId });
        }
      }

      if (skillInserts.length > 0) {
        await supabase.from("project_required_skills").insert(skillInserts);
      }
    }

    // 6. Moderation record
    await supabase.from("project_moderation").upsert({
      project_id: project.id,
      status: "approved",
      featured: false,
    });

    // 7. Security audit event
    await logAuditEvent({
      actorId: caller.id,
      action: "listing.publish",
      entityTable: "project_listings",
      entityId: project.id,
      details: {
        title: project.title,
        budget: project.budget,
        business_id: caller.businessId,
      },
    });

    return jsonResponse({ success: true, project }, 201);
  } catch (err: any) {
    console.error("[POST /api/listings error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "write");
    if (authErr || !caller) return authErr!;

    const body = await req.json();
    const projectId = body.id || body.project_id;

    if (!isValidUUID(projectId)) {
      return errorResponse("Valid project ID is required", 400);
    }

    const supabase = createServerAdminClient();

    // Verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from("project_listings")
      .select("id, business_id, status")
      .eq("id", projectId)
      .single();

    if (fetchErr || !existing) {
      return errorResponse("Project listing not found", 404);
    }

    const isOwner = caller.businessId && existing.business_id === caller.businessId;
    const isAdmin = caller.roles.includes("admin");

    if (!isOwner && !isAdmin) {
      return errorResponse("Forbidden: You do not own this listing", 403);
    }

    const updates: Record<string, any> = {};

    if (body.title) updates.title = sanitizeString(body.title, 120);
    if (body.description) updates.description = sanitizeMultiline(body.description, 5000);
    if (body.budget !== undefined) {
      updates.budget = clampNumber(body.budget, 500, 10000000, 500);
    }
    if (body.work_setup) {
      updates.work_setup = validateEnum(
        body.work_setup,
        ["remote", "onsite", "hybrid"] as const,
        "remote"
      );
    }
    if (body.status) {
      const allowedStatus = validateEnum(
        body.status,
        ["draft", "published", "active", "completed", "closed"] as const
      );
      if (allowedStatus) updates.status = allowedStatus;
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse("No valid fields provided for update", 400);
    }

    const { data: updated, error: updateErr } = await supabase
      .from("project_listings")
      .update(updates)
      .eq("id", projectId)
      .select()
      .single();

    if (updateErr) {
      return errorResponse(updateErr.message, 500);
    }

    await logAuditEvent({
      actorId: caller.id,
      action: "listing.update",
      entityTable: "project_listings",
      entityId: projectId,
      details: updates,
    });

    return jsonResponse({ success: true, project: updated });
  } catch (err: any) {
    console.error("[PATCH /api/listings error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "sensitive");
    if (authErr || !caller) return authErr!;

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("id");

    if (!isValidUUID(projectId)) {
      return errorResponse("Valid project ID is required", 400);
    }

    const supabase = createServerAdminClient();

    const { data: existing, error: fetchErr } = await supabase
      .from("project_listings")
      .select("id, business_id, status")
      .eq("id", projectId)
      .single();

    if (fetchErr || !existing) {
      return errorResponse("Project listing not found", 404);
    }

    const isOwner = caller.businessId && existing.business_id === caller.businessId;
    const isAdmin = caller.roles.includes("admin");

    if (!isOwner && !isAdmin) {
      return errorResponse("Forbidden: You do not own this listing", 403);
    }

    // Check if active contracts exist - if so, forbid deletion
    const { count: contractCount } = await supabase
      .from("project_contracts")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "active");

    if (contractCount && contractCount > 0) {
      return errorResponse(
        "Cannot close or delete a project with active contracts in progress",
        400
      );
    }

    // Safely mark closed rather than physical cascade delete to protect historical integrity
    await supabase
      .from("project_listings")
      .update({ status: "closed" })
      .eq("id", projectId);

    await logAuditEvent({
      actorId: caller.id,
      action: "listing.close",
      entityTable: "project_listings",
      entityId: projectId,
    });

    return jsonResponse({ success: true, message: "Project closed successfully" });
  } catch (err: any) {
    console.error("[DELETE /api/listings error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
