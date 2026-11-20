import { NextRequest } from "next/server";
import { requireBusiness } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import { isValidUUID, jsonResponse, errorResponse } from "@/lib/server/security";
import { logAuditEvent } from "@/lib/server/audit";

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireBusiness(req, "sensitive");
    if (authErr || !caller || !caller.businessId) return authErr!;

    const body = await req.json();
    const { application_id, close_remaining = false } = body;

    if (!isValidUUID(application_id)) {
      return errorResponse("Valid application_id is required", 400);
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
          title,
          status
        )
      `)
      .eq("id", application_id)
      .single();

    if (appErr || !application) {
      return errorResponse("Application not found", 404);
    }

    const project = application.project as any;
    if (project.business_id !== caller.businessId) {
      return errorResponse("Forbidden: You do not own this project listing", 403);
    }

    if (application.status === "accepted" || application.status === "withdrawn") {
      return errorResponse(
        `Cannot hire proposal with status '${application.status}'`,
        400
      );
    }

    // 2. Fetch server-controlled platform fee rate
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
      return errorResponse(
        contractErr?.message || "Failed to create contract",
        500
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

    // 7. Initialize escrow account record
    await supabase.from("billing_escrow_accounts").upsert({
      contract_id: contract.id,
      funded_amount: 0,
      released_amount: 0,
      refunded_amount: 0,
    });

    // 8. In-app notification for talent
    await supabase.from("notification_inbox").insert({
      user_id: application.talent_id,
      kind: "application_accepted",
      title: "Proposal Accepted!",
      body: `Congratulations! Your proposal for "${project.title}" has been accepted. Your contract is now active.`,
      project_id: application.project_id,
    });

    // 9. Security audit event
    await logAuditEvent({
      actorId: caller.id,
      action: "contract.create",
      entityTable: "project_contracts",
      entityId: contract.id,
      details: {
        project_id: application.project_id,
        talent_id: application.talent_id,
        agreed_amount: agreedAmount,
      },
    });

    return jsonResponse({ success: true, contract }, 201);
  } catch (err: any) {
    console.error("[POST /api/contracts/hire error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
