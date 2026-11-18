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
        .limit(15),
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

    // Also load platform-wide metrics if admin (or summary stats)
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
        .select("id, actor_id, action, entity_table, details, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
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

    return NextResponse.json({
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
      admin: {
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
      },
    });
  } catch (err: any) {
    console.error("Error in GET /api/overview:", err);
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
    const { action } = body;
    const supabase = createServerAdminClient();

    if (action === "mark_notifications_read") {
      await supabase
        .from("notification_inbox")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", caller.id)
        .is("read_at", null);

      return NextResponse.json({ success: true });
    }

    if (action === "add_portfolio_item") {
      const { title, description, external_url } = body;
      if (!title?.trim()) {
        return NextResponse.json(
          { error: "Portfolio title is required" },
          { status: 400 }
        );
      }

      const { data: item, error } = await supabase
        .from("portfolio_items")
        .insert({
          talent_id: caller.id,
          title: title.trim(),
          description: description?.trim() || null,
          external_url: external_url?.trim() || null,
          is_public: true,
        })
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, item });
    }

    if (action === "submit_verification") {
      const { skill_name, score = 92, answers = {} } = body;
      if (!skill_name) {
        return NextResponse.json(
          { error: "skill_name is required" },
          { status: 400 }
        );
      }

      // Find skill & assessment
      const { data: skillData } = await supabase
        .from("catalog_skills")
        .select("id, name")
        .ilike("name", skill_name)
        .maybeSingle();

      if (!skillData) {
        return NextResponse.json({ error: "Skill not found" }, { status: 404 });
      }

      // Upsert into talent_skills
      await supabase.from("talent_skills").upsert({
        talent_id: caller.id,
        skill_id: skillData.id,
        proficiency: "advanced",
      });

      // Find or create assessment for this skill
      let { data: assessment } = await supabase
        .from("verification_assessments")
        .select("id")
        .eq("skill_id", skillData.id)
        .limit(1)
        .maybeSingle();

      if (!assessment) {
        const { data: createdAss } = await supabase
          .from("verification_assessments")
          .insert({
            skill_id: skillData.id,
            title: `${skillData.name} prototype assessment`,
            is_active: true,
          })
          .select("id")
          .single();
        assessment = createdAss;
      }

      if (assessment) {
        await supabase.from("verification_submissions").insert({
          assessment_id: assessment.id,
          talent_id: caller.id,
          answers,
          status: "verified",
          score: Number(score),
          submitted_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
        });
      }

      return NextResponse.json({ success: true, skill: skillData.name, score });
    }

    if (action === "submit_review") {
      const { rating, feedback, contract_id } = body;
      if (!rating || rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: "Please select a rating between 1 and 5 stars" },
          { status: 400 }
        );
      }

      // Find a contract involving the caller
      let targetContract: any = null;
      if (contract_id) {
        const { data } = await supabase
          .from("project_contracts")
          .select("id, talent_id, project:project_listings(business:business_profiles(owner_id))")
          .eq("id", contract_id)
          .maybeSingle();
        targetContract = data;
      } else {
        const { data: contracts } = await supabase
          .from("project_contracts")
          .select("id, talent_id, project:project_listings(business:business_profiles(owner_id))")
          .order("created_at", { ascending: false });

        targetContract = (contracts || []).find(
          (c: any) =>
            c.talent_id === caller.id ||
            c.project?.business?.owner_id === caller.id
        );
      }

      if (!targetContract) {
        return NextResponse.json(
          {
            error:
              "You can submit a review once you have an active or completed project contract.",
          },
          { status: 400 }
        );
      }

      const businessOwnerId = targetContract.project?.business?.owner_id;
      const revieweeId =
        targetContract.talent_id === caller.id
          ? businessOwnerId
          : targetContract.talent_id;

      if (!revieweeId || revieweeId === caller.id) {
        return NextResponse.json(
          { error: "Invalid reviewee for this contract" },
          { status: 400 }
        );
      }

      const { data: review, error: revErr } = await supabase
        .from("review_project_reviews")
        .upsert(
          {
            contract_id: targetContract.id,
            reviewer_id: caller.id,
            reviewee_id: revieweeId,
            rating: Number(rating),
            feedback: feedback?.trim() || null,
            status: "published",
          },
          { onConflict: "contract_id,reviewer_id" }
        )
        .select("*")
        .single();

      if (revErr) {
        return NextResponse.json({ error: revErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, review });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("Error in POST /api/overview:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
