import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import { sanitizeString, jsonResponse, errorResponse } from "@/lib/server/security";
import { checkRateLimit } from "@/lib/server/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const rateCheck = checkRateLimit(req, "read");
    if (!rateCheck.allowed) {
      return errorResponse("Too many requests", 429, { retryAfter: rateCheck.retryAfter });
    }

    const { searchParams } = new URL(req.url);
    const query = sanitizeString(searchParams.get("q"), 80).toLowerCase();
    const skillFilter = sanitizeString(searchParams.get("skill"), 50).toLowerCase();
    const schoolFilter = sanitizeString(searchParams.get("school"), 80).toLowerCase();

    const supabase = createServerAdminClient();

    // 1. Fetch talent profiles with joined public accounts
    const { data: rows, error } = await supabase
      .from("talent_profiles")
      .select(`
        user_id,
        headline,
        school,
        course,
        remote_work,
        onsite_work,
        hybrid_work,
        profile:account_profiles!talent_profiles_user_id_fkey(
          id,
          display_name,
          avatar_color,
          avatar_path,
          banner_path,
          location,
          profile_visible
        )
      `)
      .limit(100);

    if (error || !rows) {
      return errorResponse(error?.message || "Failed to load talents", 500);
    }

    // 2. Fetch talent skills and verified submissions
    const [{ data: skillsRows }, { data: reviewsRows }, { data: verifRows }] =
      await Promise.all([
        supabase
          .from("talent_skills")
          .select("talent_id, proficiency, skill:catalog_skills(name)"),
        supabase
          .from("review_project_reviews")
          .select("reviewee_id, rating")
          .eq("status", "published"),
        supabase
          .from("verification_submissions")
          .select("talent_id, status, score, assessment:verification_assessments(title)")
          .eq("status", "verified"),
      ]);

    const skillMap = new Map<string, string[]>();
    for (const sr of skillsRows || []) {
      const list = skillMap.get(sr.talent_id) || [];
      const sName = (sr.skill as any)?.name;
      if (sName) list.push(sName);
      skillMap.set(sr.talent_id, list);
    }

    const ratingsMap = new Map<string, { total: number; count: number }>();
    for (const r of reviewsRows || []) {
      const curr = ratingsMap.get(r.reviewee_id) || { total: 0, count: 0 };
      curr.total += Number(r.rating || 5);
      curr.count += 1;
      ratingsMap.set(r.reviewee_id, curr);
    }

    const verifMap = new Map<string, any[]>();
    for (const v of verifRows || []) {
      const list = verifMap.get(v.talent_id) || [];
      list.push(v);
      verifMap.set(v.talent_id, list);
    }

    // Filter public-visible profiles only
    let talents = rows
      .filter((r: any) => r.profile && r.profile.profile_visible !== false)
      .map((r: any) => {
        const name = r.profile.display_name || "GAWA Talent";
        const skills = skillMap.get(r.user_id) || [];
        const rStats = ratingsMap.get(r.user_id);
        const rating = rStats && rStats.count > 0 ? (rStats.total / rStats.count).toFixed(1) : "5.0";
        const verifiedList = verifMap.get(r.user_id) || [];

        return {
          id: r.user_id,
          name,
          role: r.headline || r.course || "Emerging Talent",
          school: r.school || r.profile.location || "Philippines",
          course: r.course || "",
          location: r.profile.location || "Philippines",
          skills: skills.length > 0 ? skills : ["UI/UX Design", "Figma"],
          verifiedSkills: verifiedList.map((v) => ({
            title: v.assessment?.title || "Verified",
            score: v.score,
          })),
          rating: Number(rating),
          reviewCount: rStats?.count || 0,
          color: r.profile.avatar_color || "#087EAD",
          avatarUrl: r.profile.avatar_path || null,
          bannerUrl: r.profile.banner_path || null,
          workSetup: r.remote_work ? "remote" : r.hybrid_work ? "hybrid" : "onsite",
        };
      });

    // Apply filters
    if (query) {
      talents = talents.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.role.toLowerCase().includes(query) ||
          t.school.toLowerCase().includes(query) ||
          t.skills.some((s) => s.toLowerCase().includes(query))
      );
    }

    if (skillFilter) {
      talents = talents.filter((t) =>
        t.skills.some((s) => s.toLowerCase().includes(skillFilter))
      );
    }

    if (schoolFilter) {
      talents = talents.filter((t) =>
        t.school.toLowerCase().includes(schoolFilter)
      );
    }

    return jsonResponse({ talents });
  } catch (err: any) {
    console.error("[GET /api/talents error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
