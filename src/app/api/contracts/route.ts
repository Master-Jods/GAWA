import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
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
    const { caller, error: authErr } = await requireAuth(req, "read");
    if (authErr || !caller) return authErr!;

    const supabase = createServerAdminClient();
    const isAdmin = caller.roles.includes("admin");

    // Base query with relational joins
    let query = supabase
      .from("project_contracts")
      .select(`
        id,
        project_id,
        talent_id,
        application_id,
        agreed_amount,
        platform_fee_rate,
        status,
        starts_at,
        due_at,
        completed_at,
        created_at,
        project:project_listings!inner(
          id,
          title,
          description,
          budget,
          duration_label,
          business_id,
          business:business_profiles(id, owner_id, name, avatar_color)
        ),
        talent:account_profiles!project_contracts_talent_id_fkey(
          id,
          display_name,
          avatar_color
        ),
        milestones:workspace_milestones(
          id,
          title,
          description,
          due_at,
          status,
          sort_order,
          completed_at,
          tasks:workspace_tasks(
            id,
            title,
            assigned_to,
            is_done,
            sort_order
          )
        ),
        deliverables:workspace_deliverables(
          id,
          milestone_id,
          submitted_by,
          title,
          notes,
          external_url,
          status,
          reviewed_at,
          review_notes,
          created_at
        ),
        escrow:billing_escrow_accounts(
          funded_amount,
          released_amount,
          refunded_amount
        ),
        transactions:billing_transactions(
          id,
          kind,
          status,
          amount,
          processed_at,
          created_at
        )
      `)
      .order("created_at", { ascending: false });

    // Database-level isolation: never query all contracts for non-admins
    if (!isAdmin) {
      if (caller.businessId) {
        // Talent participant OR business owner
        query = query.or(
          `talent_id.eq.${caller.id},project.business_id.eq.${caller.businessId}`
        );
      } else {
        // Talent only
        query = query.eq("talent_id", caller.id);
      }
    }

    const { data: contracts, error } = await query;

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ contracts: contracts || [] });
  } catch (err: any) {
    console.error("[GET /api/contracts error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "write");
    if (authErr || !caller) return authErr!;

    const body = await req.json();
    const { action, contract_id } = body;

    if (!isValidUUID(contract_id)) {
      return errorResponse("Valid contract_id is required", 400);
    }

    const supabase = createServerAdminClient();

    // Verify caller is a verified participant in this contract
    const { data: contract, error: cErr } = await supabase
      .from("project_contracts")
      .select(`
        id,
        project_id,
        talent_id,
        agreed_amount,
        status,
        project:project_listings(id, title, business_id, business:business_profiles(owner_id))
      `)
      .eq("id", contract_id)
      .single();

    if (cErr || !contract) {
      return errorResponse("Contract not found", 404);
    }

    const proj = contract.project as any;
    const isTalent = contract.talent_id === caller.id;
    const isBusinessOwner =
      proj?.business?.owner_id === caller.id ||
      (caller.businessId && proj?.business_id === caller.businessId);
    const isAdmin = caller.roles.includes("admin");

    if (!isTalent && !isBusinessOwner && !isAdmin) {
      return errorResponse("Forbidden: You are not a participant in this contract", 403);
    }

    // 1. ADD MILESTONE
    if (action === "add_milestone") {
      const title = sanitizeString(body.title, 120);
      const description = sanitizeMultiline(body.description, 1000);

      if (!title || title.length < 3) {
        return errorResponse("Milestone title must be at least 3 characters", 400);
      }

      const { data: milestone, error } = await supabase
        .from("workspace_milestones")
        .insert({
          contract_id,
          title,
          description: description || null,
          status: "in_progress",
        })
        .select()
        .single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ success: true, milestone }, 201);
    }

    // 2. ADD TASK
    if (action === "add_task") {
      let { milestone_id } = body;
      const title = sanitizeString(body.title, 150);

      if (!title) {
        return errorResponse("Task title is required", 400);
      }

      // If milestone_id provided, verify it belongs to this contract
      if (milestone_id) {
        if (!isValidUUID(milestone_id)) {
          return errorResponse("Invalid milestone_id", 400);
        }
        const { data: validMs } = await supabase
          .from("workspace_milestones")
          .select("id")
          .eq("id", milestone_id)
          .eq("contract_id", contract_id)
          .single();

        if (!validMs) {
          return errorResponse("Milestone does not belong to this contract", 400);
        }
      } else {
        // Auto-assign or auto-create first milestone
        const { data: existingMs } = await supabase
          .from("workspace_milestones")
          .select("id")
          .eq("contract_id", contract_id)
          .order("sort_order", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (existingMs) {
          milestone_id = existingMs.id;
        } else {
          const { data: createdMs, error: msErr } = await supabase
            .from("workspace_milestones")
            .insert({
              contract_id,
              title: "Project Delivery",
              status: "in_progress",
              sort_order: 1,
            })
            .select("id")
            .single();

          if (msErr || !createdMs) {
            return errorResponse(msErr?.message || "Failed to create milestone", 500);
          }
          milestone_id = createdMs.id;
        }
      }

      const { data: task, error } = await supabase
        .from("workspace_tasks")
        .insert({
          milestone_id,
          title,
          assigned_to: caller.id,
          is_done: false,
        })
        .select()
        .single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ success: true, task }, 201);
    }

    // 3. TOGGLE TASK
    if (action === "toggle_task") {
      const { task_id, is_done } = body;
      if (!isValidUUID(task_id)) {
        return errorResponse("Valid task_id is required", 400);
      }

      // Verify task belongs to a milestone in this contract
      const { data: taskRecord } = await supabase
        .from("workspace_tasks")
        .select("id, milestone:workspace_milestones(contract_id)")
        .eq("id", task_id)
        .single();

      if (!taskRecord || (taskRecord.milestone as any)?.contract_id !== contract_id) {
        return errorResponse("Task not found in this contract", 404);
      }

      const { data: task, error } = await supabase
        .from("workspace_tasks")
        .update({ is_done: Boolean(is_done) })
        .eq("id", task_id)
        .select()
        .single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ success: true, task });
    }

    // 4. SUBMIT DELIVERABLE (Assigned Talent only)
    if (action === "submit_deliverable") {
      if (!isTalent && !isAdmin) {
        return errorResponse("Forbidden: Only assigned talent can submit deliverables", 403);
      }

      const title = sanitizeString(body.title, 150);
      const notes = sanitizeMultiline(body.notes, 2000);
      const externalUrl = sanitizeString(body.external_url, 500);

      if (!title) {
        return errorResponse("Deliverable title is required", 400);
      }

      const { data: deliverable, error } = await supabase
        .from("workspace_deliverables")
        .insert({
          contract_id,
          submitted_by: caller.id,
          title,
          notes: notes || null,
          external_url: externalUrl || null,
          status: "submitted",
        })
        .select()
        .single();

      if (error) return errorResponse(error.message, 500);

      // Notify business owner
      if (proj?.business?.owner_id) {
        await supabase.from("notification_inbox").insert({
          user_id: proj.business.owner_id,
          kind: "deliverable_submitted",
          title: "Deliverable Submitted",
          body: `A new deliverable "${title}" was submitted for "${proj.title}".`,
          project_id: contract.project_id,
        });
      }

      return jsonResponse({ success: true, deliverable }, 201);
    }

    // 5. REVIEW DELIVERABLE (Business Owner only)
    if (action === "review_deliverable") {
      if (!isBusinessOwner && !isAdmin) {
        return errorResponse("Forbidden: Only business owner can review deliverables", 403);
      }

      const { deliverable_id, status: reviewStatus, review_notes } = body;
      if (!isValidUUID(deliverable_id)) {
        return errorResponse("Valid deliverable_id is required", 400);
      }

      const validatedStatus = validateEnum(
        reviewStatus,
        ["approved", "revision_requested"] as const
      );
      if (!validatedStatus) {
        return errorResponse("Invalid review status", 400);
      }

      const cleanReviewNotes = sanitizeMultiline(review_notes, 1000);

      const { data: deliverable, error } = await supabase
        .from("workspace_deliverables")
        .update({
          status: validatedStatus,
          reviewed_by: caller.id,
          reviewed_at: new Date().toISOString(),
          review_notes: cleanReviewNotes || null,
        })
        .eq("id", deliverable_id)
        .eq("contract_id", contract_id)
        .select()
        .single();

      if (error || !deliverable) {
        return errorResponse(error?.message || "Deliverable not found", 404);
      }

      // Notify talent
      await supabase.from("notification_inbox").insert({
        user_id: contract.talent_id,
        kind: `deliverable_${validatedStatus}`,
        title: `Deliverable ${validatedStatus === "approved" ? "Approved" : "Revision Requested"}`,
        body: `Your deliverable "${deliverable.title}" was reviewed.`,
        project_id: contract.project_id,
      });

      return jsonResponse({ success: true, deliverable });
    }

    // 6. COMPLETE CONTRACT (Business Owner or Admin only)
    if (action === "complete_contract") {
      if (!isBusinessOwner && !isAdmin) {
        return errorResponse("Only the business owner can complete a contract", 403);
      }

      const now = new Date().toISOString();

      await supabase
        .from("project_contracts")
        .update({ status: "completed", completed_at: now })
        .eq("id", contract_id);

      await supabase
        .from("project_listings")
        .update({ status: "completed", completed_at: now })
        .eq("id", contract.project_id);

      await supabase
        .from("workspace_milestones")
        .update({ status: "completed", completed_at: now })
        .eq("contract_id", contract_id);

      await supabase.from("notification_inbox").insert({
        user_id: contract.talent_id,
        kind: "contract_completed",
        title: "Project Completed!",
        body: `"${proj?.title || "Your project"}" has been marked completed. Thank you for your work!`,
        project_id: contract.project_id,
      });

      await logAuditEvent({
        actorId: caller.id,
        action: "contract.complete",
        entityTable: "project_contracts",
        entityId: contract_id,
        details: { project_id: contract.project_id },
      });

      return jsonResponse({ success: true, message: "Contract completed successfully" });
    }

    return errorResponse("Unknown action", 400);
  } catch (err: any) {
    console.error("[POST /api/contracts error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
