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

    // Fetch contracts where user is either the talent or the business owner of the project
    const { data: allContracts, error } = await supabase
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
        project:project_listings(
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

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const isAdmin = caller.roles.includes("admin");
    const filtered = (allContracts || []).filter((c: any) => {
      if (isAdmin) return true;
      if (c.talent_id === caller.id) return true;
      const bOwner = c.project?.business?.owner_id;
      const bId = c.project?.business_id;
      return bOwner === caller.id || (caller.businessId && bId === caller.businessId);
    });

    return NextResponse.json({ contracts: filtered });
  } catch (err: any) {
    console.error("Error in GET /api/contracts:", err);
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
    const { action, contract_id } = body;

    if (!action || !contract_id) {
      return NextResponse.json(
        { error: "action and contract_id are required" },
        { status: 400 }
      );
    }

    const supabase = createServerAdminClient();

    // Verify caller is participant in contract
    const { data: contract, error: cErr } = await supabase
      .from("project_contracts")
      .select(`
        id,
        project_id,
        talent_id,
        agreed_amount,
        platform_fee_rate,
        status,
        project:project_listings(id, title, business_id, business:business_profiles(owner_id))
      `)
      .eq("id", contract_id)
      .single();

    if (cErr || !contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const proj = contract.project as any;
    const isTalent = contract.talent_id === caller.id;
    const isBusinessOwner =
      proj?.business?.owner_id === caller.id ||
      (caller.businessId && proj?.business_id === caller.businessId);

    if (!isTalent && !isBusinessOwner && !caller.roles.includes("admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "add_milestone") {
      const { title, description } = body;
      if (!title?.trim()) {
        return NextResponse.json({ error: "Milestone title required" }, { status: 400 });
      }
      const { data: milestone, error } = await supabase
        .from("workspace_milestones")
        .insert({
          contract_id,
          title: title.trim(),
          description: description?.trim() || null,
          status: "in_progress",
        })
        .select("*")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, milestone });
    }

    if (action === "add_task") {
      let { milestone_id, title } = body;
      if (!title?.trim()) {
        return NextResponse.json({ error: "Task title required" }, { status: 400 });
      }

      // If no milestone exists yet for this contract, auto-create default milestone
      if (!milestone_id) {
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
            return NextResponse.json(
              { error: msErr?.message || "Failed to create milestone" },
              { status: 500 }
            );
          }
          milestone_id = createdMs.id;
        }
      }

      const { data: task, error } = await supabase
        .from("workspace_tasks")
        .insert({
          milestone_id,
          title: title.trim(),
          assigned_to: caller.id,
          is_done: false,
        })
        .select("*")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, task });
    }

    if (action === "toggle_task") {
      const { task_id, is_done } = body;
      const { data: task, error } = await supabase
        .from("workspace_tasks")
        .update({ is_done: Boolean(is_done) })
        .eq("id", task_id)
        .select("*")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, task });
    }

    if (action === "submit_deliverable") {
      const { title, notes, external_url } = body;
      if (!title?.trim()) {
        return NextResponse.json(
          { error: "Deliverable title is required" },
          { status: 400 }
        );
      }
      const { data: deliverable, error } = await supabase
        .from("workspace_deliverables")
        .insert({
          contract_id,
          submitted_by: caller.id,
          title: title.trim(),
          notes: notes?.trim() || null,
          external_url: external_url?.trim() || null,
          status: "submitted",
        })
        .select("*")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (proj?.business?.owner_id) {
        await supabase.from("notification_inbox").insert({
          user_id: proj.business.owner_id,
          kind: "deliverable_submitted",
          title: "Deliverable Submitted",
          body: `A new deliverable "${title.trim()}" was submitted for "${proj.title}".`,
          project_id: contract.project_id,
        });
      }

      return NextResponse.json({ success: true, deliverable });
    }

    if (action === "complete_contract") {
      if (!isBusinessOwner && !caller.roles.includes("admin")) {
        return NextResponse.json(
          { error: "Only the business owner can mark a contract completed" },
          { status: 403 }
        );
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
        body: `"${proj?.title || "Your project"}" has been marked completed.`,
        project_id: contract.project_id,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("Error in POST /api/contracts:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
