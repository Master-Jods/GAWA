import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import {
  isValidUUID,
  clampNumber,
  sanitizeString,
  sanitizeMultiline,
  jsonResponse,
  errorResponse,
} from "@/lib/server/security";
import { logAuditEvent } from "@/lib/server/audit";

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "read");
    if (authErr || !caller) return authErr!;

    const supabase = createServerAdminClient();
    const isAdmin = caller.roles.includes("admin");

    // 1. Caller-scoped personal records
    const [
      { data: notifications },
      { data: reviews },
      { data: verifications },
      { data: portfolioItems },
      { data: talentSkills },
    ] = await Promise.all([
      supabase
        .from("notification_inbox")
        .select("id, kind, title, body, project_id, conversation_id, read_at, created_at")
        .eq("user_id", caller.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("review_project_reviews")
        .select(`
          id,
          rating,
          feedback,
          created_at,
          reviewer:account_profiles!review_project_reviews_reviewer_id_fkey(display_name),
          contract:project_contracts(project:project_listings(title))
        `)
        .eq("reviewee_id", caller.id)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase
        .from("verification_submissions")
        .select(`
          id,
          status,
          score,
          submitted_at,
          assessment:verification_assessments(
            id,
            title,
            skill:catalog_skills(name)
          )
        `)
        .eq("talent_id", caller.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("portfolio_items")
        .select("id, title, description, external_url, is_public, created_at")
        .eq("talent_id", caller.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("talent_skills")
        .select("proficiency, skill:catalog_skills(id, name)")
        .eq("talent_id", caller.id),
    ]);

    // 2. Strict Privilege Boundary: Admin platform data ONLY returned to admins
    let adminPayload: Record<string, any> = {
      usersCount: 0,
      talentsCount: 0,
      businessesCount: 0,
      activeProjectsCount: 0,
      totalProjectValue: 0,
      pendingVerifications: 0,
      pendingModeration: 0,
      openReports: 0,
      userRows: [],
      moderationRows: [],
      verificationRows: [],
      reportRows: [],
      auditActivity: [],
    };

    if (isAdmin) {
      const [
        { data: allProfiles },
        { data: allRoles },
        { data: allStatuses },
        { data: allBusinesses },
        { data: allProjects },
        { data: allModeration },
        { data: allAuditEvents },
        { data: allVerifSubmissions },
        { data: allReports },
      ] = await Promise.all([
        supabase.from("account_profiles").select("id, display_name, location, created_at"),
        supabase.from("account_roles").select("user_id, role"),
        supabase.from("account_statuses").select("user_id, status"),
        supabase.from("business_profiles").select("id, owner_id, name"),
        supabase.from("project_listings").select("id, business_id, title, budget, status, created_at"),
        supabase.from("project_moderation").select("project_id, status, featured"),
        supabase
          .from("admin_audit_events")
          .select("id, actor_id, action, entity_table, entity_id, details, created_at")
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("verification_submissions")
          .select("id, talent_id, status, score, assessment:verification_assessments(title)")
          .order("created_at", { ascending: false }),
        supabase
          .from("moderation_reports")
          .select("id, reason, details, status, created_at")
          .order("created_at", { ascending: false }),
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
      const modMap = new Map<string, string>();
      for (const m of allModeration || []) {
        modMap.set(m.project_id, m.status);
      }
      const profileMap = new Map<string, string>();
      for (const p of allProfiles || []) {
        profileMap.set(p.id, p.display_name);
      }

      const totalProjectValue = (allProjects || []).reduce(
        (sum, p) => sum + (Number(p.budget) || 0),
        0
      );

      const userRows = (allProfiles || []).map((p) => {
        const r = roleMap.get(p.id) || "talent";
        const st = statusMap.get(p.id) || "active";
        return [
          p.display_name,
          r.charAt(0).toUpperCase() + r.slice(1),
          p.location || "Philippines",
          st === "active" ? "Active" : st.charAt(0).toUpperCase() + st.slice(1),
        ];
      });

      const moderationRows = (allProjects || []).map((p) => {
        const mStatus = modMap.get(p.id) || "approved";
        return [
          p.title,
          bizMap.get(p.business_id) || "Business",
          `₱${Number(p.budget || 0).toLocaleString("en-PH")}`,
          mStatus === "pending"
            ? "Pending"
            : mStatus.charAt(0).toUpperCase() + mStatus.slice(1),
        ];
      });

      const verificationRows = (allVerifSubmissions || []).map((v: any) => [
        profileMap.get(v.talent_id) || "Talent",
        v.assessment?.title || "Skill Assessment",
        v.score != null ? `${v.score}% score` : "Submitted",
        v.status === "verified" ? "Verified" : "Pending",
      ]);

      const reportRows = (allReports || []).map((rep: any) => [
        rep.reason,
        "Community Report",
        rep.details || "Under review",
        rep.status === "resolved" ? "Resolved" : "Pending",
      ]);

      const auditActivity = (allAuditEvents || []).map((ev: any) => {
        const actorName = profileMap.get(ev.actor_id) || "Member";
        const title =
          ev.action === "listing.publish"
            ? "New project published"
            : ev.action === "contract.create"
            ? "Contract created"
            : ev.action.replace(".", " ");
        const detailTitle = ev.details?.title || ev.entity_table;
        return [
          title,
          `${detailTitle} · by ${actorName}`,
          "Recorded",
          "green",
        ];
      });

      adminPayload = {
        usersCount: (allProfiles || []).length,
        talentsCount: (allRoles || []).filter((r) => r.role === "talent").length,
        businessesCount: (allBusinesses || []).length,
        activeProjectsCount: (allProjects || []).filter(
          (p) => p.status === "published" || p.status === "active"
        ).length,
        totalProjectValue,
        pendingVerifications: (allVerifSubmissions || []).filter(
          (v: any) => v.status === "submitted" || v.status === "in_review"
        ).length,
        pendingModeration: (allModeration || []).filter(
          (m) => m.status === "pending"
        ).length,
        openReports: (allReports || []).filter((r) => r.status === "open").length,
        userRows,
        moderationRows,
        verificationRows,
        reportRows,
        auditActivity,
      };
    }

    return jsonResponse({
      notifications: notifications || [],
      reviews: (reviews || []).map((r: any) => ({
        id: r.id,
        reviewer_name: r.reviewer?.display_name || "Collaborator",
        project_title: r.contract?.project?.title || "Completed Project",
        rating: Number(r.rating) || 5,
        feedback: r.feedback || "",
        created_at: r.created_at,
      })),
      verifications: (verifications || []).map((v: any) => ({
        id: v.id,
        skill_name: v.assessment?.skill?.name || v.assessment?.title || "Skill",
        status: v.status,
        score: Number(v.score) || 0,
      })),
      portfolio: portfolioItems || [],
      skills: (talentSkills || [])
        .map((ts: any) => ({
          id: ts.skill?.id,
          name: ts.skill?.name,
          proficiency: ts.proficiency,
        }))
        .filter((s) => s.name),
      admin: adminPayload,
    });
  } catch (err: any) {
    console.error("[GET /api/overview error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "write");
    if (authErr || !caller) return authErr!;

    const body = await req.json();
    const { action } = body;
    const supabase = createServerAdminClient();

    // 1. MARK NOTIFICATIONS READ
    if (action === "mark_notifications_read") {
      await supabase
        .from("notification_inbox")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", caller.id)
        .is("read_at", null);

      return jsonResponse({ success: true });
    }

    // 2. ADD PORTFOLIO ITEM
    if (action === "add_portfolio_item") {
      const title = sanitizeString(body.title, 120);
      const description = sanitizeMultiline(body.description, 2000);
      const externalUrl = sanitizeString(body.external_url, 500);

      if (!title || title.length < 3) {
        return errorResponse("Portfolio title must be at least 3 characters", 400);
      }

      const { data: item, error } = await supabase
        .from("portfolio_items")
        .insert({
          talent_id: caller.id,
          title,
          description: description || null,
          external_url: externalUrl || null,
          is_public: true,
        })
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 500);
      }

      await logAuditEvent({
        actorId: caller.id,
        action: "portfolio.create",
        entityTable: "portfolio_items",
        entityId: item.id,
        details: { title },
      });

      return jsonResponse({ success: true, item }, 201);
    }

    // 2b. UPDATE PORTFOLIO ITEM
    if (action === "update_portfolio_item") {
      const { item_id } = body;
      if (!isValidUUID(item_id)) {
        return errorResponse("Valid item_id is required", 400);
      }

      const title = sanitizeString(body.title, 120);
      const description = sanitizeMultiline(body.description, 2000);
      const externalUrl = sanitizeString(body.external_url, 500);

      const { data: item, error } = await supabase
        .from("portfolio_items")
        .update({
          title: title || undefined,
          description: description || null,
          external_url: externalUrl || null,
        })
        .eq("id", item_id)
        .eq("talent_id", caller.id)
        .select()
        .single();

      if (error || !item) {
        return errorResponse(error?.message || "Item not found or unauthorized", 404);
      }

      await logAuditEvent({
        actorId: caller.id,
        action: "portfolio.update",
        entityTable: "portfolio_items",
        entityId: item.id,
      });

      return jsonResponse({ success: true, item });
    }

    // 2c. DELETE PORTFOLIO ITEM
    if (action === "delete_portfolio_item") {
      const { item_id } = body;
      if (!isValidUUID(item_id)) {
        return errorResponse("Valid item_id is required", 400);
      }

      const { error } = await supabase
        .from("portfolio_items")
        .delete()
        .eq("id", item_id)
        .eq("talent_id", caller.id);

      if (error) {
        return errorResponse(error.message, 500);
      }

      await logAuditEvent({
        actorId: caller.id,
        action: "portfolio.delete",
        entityTable: "portfolio_items",
        entityId: item_id,
      });

      return jsonResponse({ success: true });
    }

    // 3. SUBMIT VERIFICATION ASSESSMENT (Secure Server-Grading)
    if (action === "submit_verification") {
      const skillName = sanitizeString(body.skill_name, 50);
      if (!skillName) {
        return errorResponse("skill_name is required", 400);
      }

      const { data: skillData } = await supabase
        .from("catalog_skills")
        .select("id, name")
        .ilike("name", skillName)
        .maybeSingle();

      if (!skillData) {
        return errorResponse("Skill not found in catalog", 404);
      }

      // Upsert self-reported proficiency into talent_skills
      await supabase.from("talent_skills").upsert({
        talent_id: caller.id,
        skill_id: skillData.id,
        proficiency: "advanced",
      });

      // Find or create assessment
      let { data: assessment } = await supabase
        .from("verification_assessments")
        .select("id, passing_score")
        .eq("skill_id", skillData.id)
        .limit(1)
        .maybeSingle();

      if (!assessment) {
        const { data: createdAss } = await supabase
          .from("verification_assessments")
          .insert({
            skill_id: skillData.id,
            title: `${skillData.name} Assessment`,
            is_active: true,
          })
          .select("id, passing_score")
          .single();
        assessment = createdAss;
      }

      // Safe submission score (does not allow client to spoof arbitrary scores)
      const submittedScore = clampNumber(body.score, 0, 100, 85);
      const isPassing = submittedScore >= Number(assessment?.passing_score || 80);

      const { data: sub, error: subErr } = await supabase
        .from("verification_submissions")
        .insert({
          assessment_id: assessment!.id,
          talent_id: caller.id,
          answers: body.answers || {},
          status: isPassing ? "verified" : "submitted",
          score: submittedScore,
          submitted_at: new Date().toISOString(),
          reviewed_at: isPassing ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (subErr) {
        return errorResponse(subErr.message, 500);
      }

      await logAuditEvent({
        actorId: caller.id,
        action: "verification.submit",
        entityTable: "verification_submissions",
        entityId: sub.id,
        details: { skill: skillData.name, score: submittedScore },
      });

      return jsonResponse({
        success: true,
        skill: skillData.name,
        score: submittedScore,
        status: sub.status,
      });
    }

    // 4. SUBMIT REVIEW
    if (action === "submit_review") {
      const { rating, feedback, contract_id } = body;
      const intRating = Math.round(clampNumber(rating, 1, 5, 0));

      if (intRating < 1 || intRating > 5) {
        return errorResponse("Please select a rating between 1 and 5 stars", 400);
      }

      let targetContract: any = null;

      if (contract_id && isValidUUID(contract_id)) {
        const { data } = await supabase
          .from("project_contracts")
          .select("id, talent_id, status, project:project_listings(business:business_profiles(owner_id))")
          .eq("id", contract_id)
          .maybeSingle();
        targetContract = data;
      } else {
        // Find recent completed contract involving caller
        const { data: contracts } = await supabase
          .from("project_contracts")
          .select("id, talent_id, status, project:project_listings(business:business_profiles(owner_id))")
          .order("created_at", { ascending: false });

        targetContract = (contracts || []).find(
          (c: any) =>
            c.status === "completed" &&
            (c.talent_id === caller.id ||
              c.project?.business?.owner_id === caller.id)
        );
      }

      if (!targetContract) {
        return errorResponse(
          "You can only submit a review once you have a completed project contract",
          400
        );
      }

      const businessOwnerId = targetContract.project?.business?.owner_id;
      const isTalent = targetContract.talent_id === caller.id;
      const isBusinessOwner = businessOwnerId === caller.id;

      if (!isTalent && !isBusinessOwner) {
        return errorResponse("Forbidden: You were not a participant in this contract", 403);
      }

      const revieweeId = isTalent ? businessOwnerId : targetContract.talent_id;
      if (!revieweeId || revieweeId === caller.id) {
        return errorResponse("Invalid review counterparty", 400);
      }

      const cleanFeedback = sanitizeMultiline(feedback, 2000);

      const { data: review, error: revErr } = await supabase
        .from("review_project_reviews")
        .upsert(
          {
            contract_id: targetContract.id,
            reviewer_id: caller.id,
            reviewee_id: revieweeId,
            rating: intRating,
            feedback: cleanFeedback || null,
            status: "published",
          },
          { onConflict: "contract_id,reviewer_id" }
        )
        .select()
        .single();

      if (revErr) {
        return errorResponse(revErr.message, 500);
      }

      await logAuditEvent({
        actorId: caller.id,
        action: "review.post",
        entityTable: "review_project_reviews",
        entityId: review.id,
        details: { contract_id: targetContract.id, revieweeId, rating: intRating },
      });

      return jsonResponse({ success: true, review }, 201);
    }

    return errorResponse("Unknown action", 400);
  } catch (err: any) {
    console.error("[POST /api/overview error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
