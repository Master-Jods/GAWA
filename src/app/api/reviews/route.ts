import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import {
  isValidUUID,
  clampNumber,
  sanitizeMultiline,
  jsonResponse,
  errorResponse,
} from "@/lib/server/security";
import { logAuditEvent } from "@/lib/server/audit";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    const supabase = createServerAdminClient();

    let query = supabase
      .from("review_project_reviews")
      .select(`
        id,
        contract_id,
        rating,
        feedback,
        created_at,
        reviewer:account_profiles!review_project_reviews_reviewer_id_fkey(
          id,
          display_name,
          avatar_path,
          avatar_color
        ),
        contract:project_contracts(
          id,
          project:project_listings(id, title)
        )
      `)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (userId && isValidUUID(userId)) {
      query = query.eq("reviewee_id", userId);
    }

    const { data: reviews, error } = await query.limit(50);

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ reviews: reviews || [] });
  } catch (err: any) {
    console.error("[GET /api/reviews error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "write");
    if (authErr || !caller) return authErr!;

    const body = await req.json();
    const { contract_id, rating, feedback } = body;

    if (!isValidUUID(contract_id)) {
      return errorResponse("Valid contract_id is required", 400);
    }

    const intRating = Math.round(clampNumber(rating, 1, 5, 0));
    if (intRating < 1 || intRating > 5) {
      return errorResponse("Rating must be an integer between 1 and 5 stars", 400);
    }

    const cleanFeedback = sanitizeMultiline(feedback, 2000);
    const supabase = createServerAdminClient();

    // 1. Fetch contract and verify it is completed and caller is participant
    const { data: contract, error: cErr } = await supabase
      .from("project_contracts")
      .select(`
        id,
        talent_id,
        status,
        project:project_listings(id, title, business:business_profiles(owner_id))
      `)
      .eq("id", contract_id)
      .single();

    if (cErr || !contract) {
      return errorResponse("Contract not found", 404);
    }

    if (contract.status !== "completed") {
      return errorResponse("Reviews can only be submitted for completed contracts", 400);
    }

    const businessOwnerId = (contract.project as any)?.business?.owner_id;
    const isTalent = contract.talent_id === caller.id;
    const isBusinessOwner = businessOwnerId === caller.id;

    if (!isTalent && !isBusinessOwner) {
      return errorResponse("Forbidden: You were not a participant in this contract", 403);
    }

    // Determine reviewee
    const revieweeId = isTalent ? businessOwnerId : contract.talent_id;
    if (!revieweeId || revieweeId === caller.id) {
      return errorResponse("Invalid review counterparty", 400);
    }

    // 2. Insert or update review (unique contract_id + reviewer_id)
    const { data: review, error: revErr } = await supabase
      .from("review_project_reviews")
      .upsert(
        {
          contract_id,
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

    if (revErr || !review) {
      return errorResponse(revErr?.message || "Failed to submit review", 500);
    }

    await logAuditEvent({
      actorId: caller.id,
      action: "review.post",
      entityTable: "review_project_reviews",
      entityId: review.id,
      details: { contract_id, revieweeId, rating: intRating },
    });

    return jsonResponse({ success: true, review }, 201);
  } catch (err: any) {
    console.error("[POST /api/reviews error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
