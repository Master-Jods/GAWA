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
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");

    // Business view: incoming applications across all projects owned by caller's business
    if (scope === "business" && caller.businessId) {
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
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Enrich with talent_profiles and talent_skills
      const talentIds = Array.from(
        new Set((apps || []).map((a: any) => a.talent_id))
      );

      let talentProfileMap = new Map<string, any>();
      let talentSkillsMap = new Map<string, string[]>();

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
            skills: skills.length > 0 ? skills : ["UI/UX Design", "Collaboration"],
          },
        };
      });

      return NextResponse.json({ applications: enriched });
    }

    // Talent view: all applications submitted by caller
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ applications: apps || [] });
  } catch (err: any) {
    console.error("Unhandled error in GET /api/applications:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { application_id, status: nextStatus } = body;

    if (!application_id || !nextStatus) {
      return NextResponse.json(
        { error: "application_id and status are required" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const proj = appRecord.project as any;

    // Talent withdrawing own pending application
    if (nextStatus === "withdrawn") {
      if (appRecord.talent_id !== caller.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (appRecord.status === "accepted" || appRecord.status === "rejected") {
        return NextResponse.json(
          { error: "Cannot withdraw a finalized application" },
          { status: 400 }
        );
      }
    } else if (["shortlisted", "interview", "rejected"].includes(nextStatus)) {
      // Business owner changing stage
      if (!caller.businessId || proj?.business_id !== caller.businessId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json(
        { error: "Invalid status transition" },
        { status: 400 }
      );
    }

    const { data: updated, error: updateErr } = await supabase
      .from("project_applications")
      .update({ status: nextStatus })
      .eq("id", application_id)
      .select("id, status, updated_at")
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { error: updateErr?.message || "Failed to update application" },
        { status: 500 }
      );
    }

    if (nextStatus !== "withdrawn") {
      await supabase.from("notification_inbox").insert({
        user_id: appRecord.talent_id,
        kind: `application_${nextStatus}`,
        title: `Application ${nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}`,
        body: `Your application for "${proj?.title || "a project"}" was moved to ${nextStatus}.`,
        project_id: appRecord.project_id,
      });
    }

    await supabase.from("admin_audit_events").insert({
      actor_id: caller.id,
      action: `application.${nextStatus}`,
      entity_table: "project_applications",
      entity_id: application_id,
      details: {
        project_id: appRecord.project_id,
        previous_status: appRecord.status,
        next_status: nextStatus,
      },
    });

    return NextResponse.json({ success: true, application: updated });
  } catch (err: any) {
    console.error("Unhandled error in PATCH /api/applications:", err);
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

    if (!caller.roles.includes("talent")) {
      return NextResponse.json(
        { error: "Forbidden: Talent role required to submit proposals" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { project_id, proposal, proposed_budget, portfolio_item_ids = [] } = body;

    if (!project_id || !proposal?.trim()) {
      return NextResponse.json(
        { error: "Project ID and proposal are required" },
        { status: 400 }
      );
    }

    const supabase = createServerAdminClient();

    // 1. Verify project is published, approved, and deadline is open
    const { data: project, error: projErr } = await supabase
      .from("project_listings")
      .select(`
        id,
        business_id,
        budget,
        status,
        application_deadline,
        business:business_profiles(owner_id),
        moderation:project_moderation(status)
      `)
      .eq("id", project_id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.status !== "published" && project.status !== "active") {
      return NextResponse.json(
        { error: "This project is not accepting applications" },
        { status: 400 }
      );
    }

    // Check not business owner
    const businessOwner = (project.business as any)?.owner_id;
    if (businessOwner === caller.id) {
      return NextResponse.json(
        { error: "You cannot apply to your own project" },
        { status: 400 }
      );
    }

    // Check one application per talent/listing
    const { data: existingApp } = await supabase
      .from("project_applications")
      .select("id, status")
      .eq("project_id", project_id)
      .eq("talent_id", caller.id)
      .maybeSingle();

    if (existingApp) {
      return NextResponse.json(
        { error: "You have already applied to this project", application: existingApp },
        { status: 409 }
      );
    }

    // 2. Insert application
    const { data: application, error: appErr } = await supabase
      .from("project_applications")
      .insert({
        project_id,
        talent_id: caller.id,
        proposal: proposal.trim(),
        proposed_budget: proposed_budget ? Number(proposed_budget) : project.budget,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .select("id, project_id, talent_id, proposal, status, proposed_budget, submitted_at")
      .single();

    if (appErr || !application) {
      console.error("Application insert error:", appErr);
      return NextResponse.json(
        { error: appErr?.message || "Failed to submit proposal" },
        { status: 500 }
      );
    }

    // 3. Attach owned portfolio items if provided
    if (Array.isArray(portfolio_item_ids) && portfolio_item_ids.length > 0) {
      const { data: ownedItems } = await supabase
        .from("portfolio_items")
        .select("id")
        .eq("talent_id", caller.id)
        .in("id", portfolio_item_ids);

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

    // 4. Notify business owner (using valid notification_inbox columns)
    if (businessOwner) {
      await supabase.from("notification_inbox").insert({
        user_id: businessOwner,
        kind: "application_received",
        title: "New Application Received",
        body: `A talent submitted a proposal for your project listing.`,
        project_id,
      });
    }

    return NextResponse.json({ success: true, application });
  } catch (err: any) {
    console.error("Unhandled error in POST /api/applications:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
