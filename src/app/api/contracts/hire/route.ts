import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!caller.roles.includes("business") || !caller.businessId) {
      return NextResponse.json(
        { error: "Forbidden: Business role required to hire talent" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { application_id, close_remaining = false } = body;

    if (!application_id) {
      return NextResponse.json(
        { error: "application_id is required" },
        { status: 400 }
      );
    }

    const supabase = createServerAdminClient();

    // 1. Fetch application and verify business ownership
    const { data: application, error: appErr } = await supabase
      .from("project_applications")
      .select(`
        id,
        project_id,
        talent_id,
        status,
        proposed_budget,
        project:project_listings!project_applications_project_id_fkey(
          id,
          business_id,
          budget,
          title
        )
      `)
      .eq("id", application_id)
      .single();

    if (appErr || !application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const project = application.project as any;
    if (project.business_id !== caller.businessId) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this project listing" },
        { status: 403 }
      );
    }

    if (application.status === "accepted" || application.status === "withdrawn") {
      return NextResponse.json(
        { error: `Cannot hire application with status '${application.status}'` },
        { status: 400 }
      );
    }

    // 2. Fetch platform fee rate
    const { data: feeSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_fee_rate")
      .single();

    const feeRate = feeSetting ? Number(feeSetting.value) : 0.05;
    const agreedAmount = Number(application.proposed_budget || project.budget);

    // 3. Create contract
    const { data: contract, error: contractErr } = await supabase
      .from("project_contracts")
      .insert({
        project_id: application.project_id,
        talent_id: application.talent_id,
        application_id: application.id,
        agreed_amount: agreedAmount,
        platform_fee_rate: feeRate,
        status: "active",
        starts_at: new Date().toISOString(),
      })
      .select("id, status, agreed_amount")
      .single();

    if (contractErr || !contract) {
      console.error("Contract creation error:", contractErr);
      return NextResponse.json(
        { error: contractErr?.message || "Failed to create contract" },
        { status: 500 }
      );
    }

    // 4. Update application status to accepted
    await supabase
      .from("project_applications")
      .update({ status: "accepted" })
      .eq("id", application.id);

    // 5. Update project listing status to active
    await supabase
      .from("project_listings")
      .update({ status: "active" })
      .eq("id", application.project_id);

    // 6. Optionally close remaining applications
    if (close_remaining) {
      await supabase
        .from("project_applications")
        .update({ status: "rejected" })
        .eq("project_id", application.project_id)
        .neq("id", application.id)
        .in("status", ["submitted", "shortlisted", "interview"]);
    }

    // Initialize escrow account for contract
    await supabase.from("billing_escrow_accounts").upsert({
      contract_id: contract.id,
      funded_amount: 0,
      released_amount: 0,
      refunded_amount: 0,
    });

    // 7. Notify talent
    await supabase.from("notification_inbox").insert({
      user_id: application.talent_id,
      kind: "application_accepted",
      title: "Proposal Accepted!",
      body: `Congratulations! Your proposal for "${project.title}" has been accepted. Your contract is now active.`,
      project_id: application.project_id,
    });

    // 8. Audit event
    await supabase.from("admin_audit_events").insert({
      actor_id: caller.id,
      action: "contract.create",
      entity_table: "project_contracts",
      entity_id: contract.id,
      details: {
        project_id: application.project_id,
        talent_id: application.talent_id,
        agreed_amount: agreedAmount,
      },
    });

    return NextResponse.json({ success: true, contract });
  } catch (err: any) {
    console.error("Unhandled error in POST /api/contracts/hire:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
