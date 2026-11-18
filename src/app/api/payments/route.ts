import { NextRequest } from "next/server";
import { requireAuth, requireBusiness } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import {
  isValidUUID,
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
    const isAdmin = caller.roles.includes("admin");

    // Query transactions and escrow accounts
    let query = supabase
      .from("billing_transactions")
      .select(`
        id,
        contract_id,
        kind,
        status,
        amount,
        currency,
        processed_at,
        created_at,
        contract:project_contracts!inner(
          id,
          project_id,
          talent_id,
          agreed_amount,
          status,
          project:project_listings(id, title, business_id)
        )
      `)
      .order("created_at", { ascending: false });

    // Isolation: Only return caller's transactions unless admin
    if (!isAdmin) {
      if (caller.businessId) {
        query = query.or(
          `contract.talent_id.eq.${caller.id},contract.project.business_id.eq.${caller.businessId}`
        );
      } else {
        query = query.eq("contract.talent_id", caller.id);
      }
    }

    const { data: transactions, error } = await query.limit(100);

    if (error) {
      return errorResponse(error.message, 500);
    }

    // Escrow summaries
    const contractIds = Array.from(
      new Set((transactions || []).map((t: any) => t.contract_id))
    );

    let escrowAccounts: any[] = [];
    if (contractIds.length > 0) {
      const { data: escrows } = await supabase
        .from("billing_escrow_accounts")
        .select("*")
        .in("contract_id", contractIds);
      escrowAccounts = escrows || [];
    }

    return jsonResponse({
      transactions: transactions || [],
      escrows: escrowAccounts,
    });
  } catch (err: any) {
    console.error("[GET /api/payments error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireBusiness(req, "sensitive");
    if (authErr || !caller || !caller.businessId) return authErr!;

    const body = await req.json();
    const { action, contract_id, amount } = body;

    if (!isValidUUID(contract_id)) {
      return errorResponse("Valid contract_id is required", 400);
    }

    const validatedAction = validateEnum(
      action,
      ["fund_escrow", "release_escrow"] as const
    );
    if (!validatedAction) {
      return errorResponse("Action must be 'fund_escrow' or 'release_escrow'", 400);
    }

    const supabase = createServerAdminClient();

    // 1. Fetch contract and verify business ownership
    const { data: contract, error: cErr } = await supabase
      .from("project_contracts")
      .select(`
        id,
        project_id,
        talent_id,
        agreed_amount,
        status,
        project:project_listings(id, title, business_id)
      `)
      .eq("id", contract_id)
      .single();

    if (cErr || !contract) {
      return errorResponse("Contract not found", 404);
    }

    const proj = contract.project as any;
    if (proj?.business_id !== caller.businessId && !caller.roles.includes("admin")) {
      return errorResponse("Forbidden: You do not own this project contract", 403);
    }

    // 2. Fetch or initialize escrow account
    let { data: escrow } = await supabase
      .from("billing_escrow_accounts")
      .select("*")
      .eq("contract_id", contract_id)
      .maybeSingle();

    if (!escrow) {
      const { data: createdEscrow } = await supabase
        .from("billing_escrow_accounts")
        .insert({
          contract_id,
          funded_amount: 0,
          released_amount: 0,
          refunded_amount: 0,
        })
        .select()
        .single();
      escrow = createdEscrow;
    }

    const parsedAmount = clampNumber(
      amount || contract.agreed_amount,
      1,
      10000000,
      contract.agreed_amount
    );

    const idempotencyKey = `${validatedAction}-${contract_id}-${Date.now()}`;

    // 3. ACTION: FUND ESCROW
    if (validatedAction === "fund_escrow") {
      const { data: tx, error: txErr } = await supabase
        .from("billing_transactions")
        .insert({
          contract_id,
          kind: "funding",
          status: "succeeded",
          amount: parsedAmount,
          currency: "PHP",
          idempotency_key: idempotencyKey,
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (txErr) {
        return errorResponse(txErr.message, 500);
      }

      const newFunded = Number(escrow.funded_amount || 0) + parsedAmount;
      await supabase
        .from("billing_escrow_accounts")
        .update({ funded_amount: newFunded })
        .eq("contract_id", contract_id);

      // Notify talent
      await supabase.from("notification_inbox").insert({
        user_id: contract.talent_id,
        kind: "escrow_funded",
        title: "Escrow Funded",
        body: `Your client has funded ₱${parsedAmount.toLocaleString("en-PH")} into escrow for "${proj.title}".`,
        project_id: contract.project_id,
      });

      await logAuditEvent({
        actorId: caller.id,
        action: "escrow.fund",
        entityTable: "billing_escrow_accounts",
        entityId: contract_id,
        details: { amount: parsedAmount, transaction_id: tx.id },
      });

      return jsonResponse({
        success: true,
        message: "Escrow funded successfully",
        transaction: tx,
        escrow: { ...escrow, funded_amount: newFunded },
      });
    }

    // 4. ACTION: RELEASE ESCROW TO TALENT
    if (validatedAction === "release_escrow") {
      const availableEscrow =
        Number(escrow.funded_amount || 0) - Number(escrow.released_amount || 0);

      if (availableEscrow < parsedAmount) {
        return errorResponse(
          `Insufficient escrow funds. Available to release: ₱${availableEscrow.toLocaleString("en-PH")}`,
          400
        );
      }

      const { data: tx, error: txErr } = await supabase
        .from("billing_transactions")
        .insert({
          contract_id,
          kind: "release",
          status: "succeeded",
          amount: parsedAmount,
          currency: "PHP",
          idempotency_key: idempotencyKey,
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (txErr) {
        return errorResponse(txErr.message, 500);
      }

      const newReleased = Number(escrow.released_amount || 0) + parsedAmount;
      await supabase
        .from("billing_escrow_accounts")
        .update({ released_amount: newReleased })
        .eq("contract_id", contract_id);

      // Notify talent
      await supabase.from("notification_inbox").insert({
        user_id: contract.talent_id,
        kind: "payment_released",
        title: "Payment Released!",
        body: `₱${parsedAmount.toLocaleString("en-PH")} has been released to you for "${proj.title}".`,
        project_id: contract.project_id,
      });

      await logAuditEvent({
        actorId: caller.id,
        action: "escrow.release",
        entityTable: "billing_escrow_accounts",
        entityId: contract_id,
        details: { amount: parsedAmount, transaction_id: tx.id },
      });

      return jsonResponse({
        success: true,
        message: "Payment released to talent successfully",
        transaction: tx,
        escrow: { ...escrow, released_amount: newReleased },
      });
    }

    return errorResponse("Unknown action", 400);
  } catch (err: any) {
    console.error("[POST /api/payments error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
