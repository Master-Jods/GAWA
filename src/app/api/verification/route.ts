import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import { isValidUUID, jsonResponse, errorResponse } from "@/lib/server/security";
import { logAuditEvent } from "@/lib/server/audit";

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "read");
    if (authErr || !caller) return authErr!;

    const supabase = createServerAdminClient();

    // 1. Fetch available skill assessments
    const { data: assessments, error } = await supabase
      .from("verification_assessments")
      .select(`
        id,
        title,
        description,
        question_count,
        duration_minutes,
        passing_score,
        skill:catalog_skills(id, name)
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return errorResponse(error.message, 500);
    }

    // 2. Fetch questions for active assessments
    // ANTI-CHEAT RULE: Never select 'correct_answer' for non-admin callers!
    const assessmentIds = (assessments || []).map((a) => a.id);
    let questionsMap = new Map<string, any[]>();

    if (assessmentIds.length > 0) {
      const { data: questions } = await supabase
        .from("verification_questions")
        .select("id, assessment_id, prompt, options, points, sort_order")
        .in("assessment_id", assessmentIds)
        .order("sort_order", { ascending: true });

      for (const q of questions || []) {
        const list = questionsMap.get(q.assessment_id) || [];
        list.push(q);
        questionsMap.set(q.assessment_id, list);
      }
    }

    // 3. Fetch caller's latest submissions (ordered newest first)
    const { data: userSubmissions } = await supabase
      .from("verification_submissions")
      .select("id, assessment_id, status, score, submitted_at, expires_at")
      .eq("talent_id", caller.id)
      .order("created_at", { ascending: false });

    const subMap = new Map<string, any>();
    for (const s of userSubmissions || []) {
      if (!subMap.has(s.assessment_id)) {
        subMap.set(s.assessment_id, s);
      }
    }

    const payload = (assessments || []).map((a) => ({
      ...a,
      questions: questionsMap.get(a.id) || [],
      submission: subMap.get(a.id) || null,
    }));

    return jsonResponse({ assessments: payload });
  } catch (err: any) {
    console.error("[GET /api/verification error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireRole(req, "talent", "sensitive");
    if (authErr || !caller) return authErr!;

    const body = await req.json();
    const { assessment_id, answers = {} } = body;

    if (!isValidUUID(assessment_id)) {
      return errorResponse("Valid assessment_id is required", 400);
    }

    const supabase = createServerAdminClient();

    // 1. Fetch assessment
    const { data: assessment, error: aErr } = await supabase
      .from("verification_assessments")
      .select("id, title, passing_score, skill_id, skill:catalog_skills(name)")
      .eq("id", assessment_id)
      .eq("is_active", true)
      .single();

    if (aErr || !assessment) {
      return errorResponse("Assessment not found or inactive", 404);
    }

    // 2. Fetch questions with correct answers (Secure Server-Side Grading)
    const { data: questions } = await supabase
      .from("verification_questions")
      .select("id, points, correct_answer")
      .eq("assessment_id", assessment_id);

    let totalPoints = 0;
    let earnedPoints = 0;

    if (!questions || questions.length === 0) {
      return errorResponse("This assessment has no active questions yet", 400);
    }

    for (const q of questions) {
      const pts = Number(q.points || 1);
      totalPoints += pts;

      const userAnswer = answers[q.id];
      const correct = q.correct_answer;

      if (
        userAnswer !== undefined &&
        JSON.stringify(userAnswer) === JSON.stringify(correct)
      ) {
        earnedPoints += pts;
      }
    }

    const finalScore = Math.round((earnedPoints / (totalPoints || 1)) * 100);
    const passingScore = Number(assessment.passing_score || 80);
    const isVerified = finalScore >= passingScore;
    const resultStatus = isVerified ? "verified" : "rejected";
    const expiresAt = isVerified
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // 3. Insert submission record
    const { data: submission, error: subErr } = await supabase
      .from("verification_submissions")
      .insert({
        assessment_id,
        talent_id: caller.id,
        answers,
        status: resultStatus,
        score: finalScore,
        submitted_at: new Date().toISOString(),
        reviewed_at: isVerified ? new Date().toISOString() : null,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (subErr || !submission) {
      return errorResponse(subErr?.message || "Failed to submit assessment", 500);
    }

    // 4. Update talent_skills (constraint allows 'beginner' | 'intermediate' | 'advanced')
    if (assessment.skill_id) {
      await supabase.from("talent_skills").upsert({
        talent_id: caller.id,
        skill_id: assessment.skill_id,
        proficiency: isVerified ? "advanced" : "intermediate",
      });
    }

    // 5. In-app notification
    await supabase.from("notification_inbox").insert({
      user_id: caller.id,
      kind: isVerified ? "verification_passed" : "verification_failed",
      title: isVerified ? "Skill Verified!" : "Assessment Result",
      body: isVerified
        ? `Congratulations! You scored ${finalScore}% and earned the verified badge for ${assessment.title}.`
        : `You scored ${finalScore}%. The passing score is ${passingScore}%. You can retake the assessment later.`,
    });

    await logAuditEvent({
      actorId: caller.id,
      action: "verification.graded",
      entityTable: "verification_submissions",
      entityId: submission.id,
      details: {
        assessment_id,
        score: finalScore,
        status: resultStatus,
      },
    });

    return jsonResponse({
      success: true,
      score: finalScore,
      status: resultStatus,
      isVerified,
      submission,
    });
  } catch (err: any) {
    console.error("[POST /api/verification error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
