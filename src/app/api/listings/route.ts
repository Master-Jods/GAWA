import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerAdminClient();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");

    if (scope === "business") {
      const caller = await getAuthenticatedUser(req);
      if (!caller || !caller.businessId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ listings: listings || [] });
    }

    // Public approved & published listings
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
      .order("published_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ listings: listings || [] });
  } catch (err: any) {
    console.error("Error in GET /api/listings:", err);
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

    if (!caller.roles.includes("business") || !caller.businessId) {
      return NextResponse.json(
        { error: "Forbidden: Business profile required to post listings" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      budget,
      duration_label,
      work_setup = "remote",
      skills = [],
      category_id,
      category_name,
      objectives = [],
      expected_deliverables = [],
      application_deadline,
      deadline_days = 30,
    } = body;

    if (!title?.trim() || !description?.trim() || !budget) {
      return NextResponse.json(
        { error: "Title, description, and budget are required" },
        { status: 400 }
      );
    }

    const supabase = createServerAdminClient();

    // Resolve category_id from category_name if not directly provided
    let resolvedCategoryId = category_id || null;
    if (!resolvedCategoryId && category_name) {
      const { data: catData } = await supabase
        .from("catalog_project_categories")
        .select("id, name")
        .ilike("name", `%${String(category_name).trim()}%`)
        .limit(1)
        .maybeSingle();
      if (catData) {
        resolvedCategoryId = catData.id;
      }
    }

    // 1. Calculate non-expired application deadline
    const todayStr = new Date().toISOString().split("T")[0];
    let deadlineStr = application_deadline;
    if (!deadlineStr || deadlineStr < todayStr) {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + Number(deadline_days));
      deadlineStr = deadline.toISOString().split("T")[0];
    }

    const normalizedWorkSetup = ["remote", "onsite", "hybrid"].includes(
      String(work_setup).toLowerCase()
    )
      ? String(work_setup).toLowerCase()
      : "remote";

    // 2. Insert project listing
    const { data: project, error: insertError } = await supabase
      .from("project_listings")
      .insert({
        business_id: caller.businessId,
        category_id: resolvedCategoryId,
        title: title.trim(),
        description: description.trim(),
        objectives: Array.isArray(objectives)
          ? objectives.filter((s: string) => s?.trim())
          : [],
        expected_deliverables: Array.isArray(expected_deliverables)
          ? expected_deliverables.filter((s: string) => s?.trim())
          : [],
        budget: Number(budget),
        duration_label: duration_label || "4 weeks",
        application_deadline: deadlineStr,
        work_setup: normalizedWorkSetup,
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
      console.error("Listing insert error:", insertError);
      return NextResponse.json(
        { error: insertError?.message || "Failed to create project listing" },
        { status: 500 }
      );
    }

    // 3. Connect required skills
    if (Array.isArray(skills) && skills.length > 0) {
      const { data: catalogSkills } = await supabase
        .from("catalog_skills")
        .select("id, name");

      const skillMap = new Map(
        (catalogSkills || []).map((s) => [s.name.toLowerCase(), s.id])
      );

      const skillInserts: { project_id: string; skill_id: string }[] = [];
      for (const skillName of skills) {
        const matchedId = skillMap.get(String(skillName).toLowerCase());
        if (matchedId) {
          skillInserts.push({ project_id: project.id, skill_id: matchedId });
        }
      }

      if (skillInserts.length > 0) {
        await supabase.from("project_required_skills").insert(skillInserts);
      }
    }

    // 4. Create moderation record (marked approved for prototype visibility)
    await supabase.from("project_moderation").upsert({
      project_id: project.id,
      status: "approved",
      featured: false,
    });

    // 5. Audit event
    await supabase.from("admin_audit_events").insert({
      actor_id: caller.id,
      action: "listing.publish",
      entity_table: "project_listings",
      entity_id: project.id,
      details: {
        title: project.title,
        budget: project.budget,
      },
    });

    return NextResponse.json({ success: true, project });
  } catch (err: any) {
    console.error("Unhandled error in POST /api/listings:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
