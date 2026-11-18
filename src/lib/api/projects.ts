import { supabase } from "@/lib/supabase/client";
import {
  projects as fallbackProjects,
  type Project,
  type Talent,
  type TalentApplication,
  type BusinessApplication,
} from "@/data";

export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export function getInitials(name: string): string {
  if (!name) return "GW";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function mapRawListingToProject(
  item: any,
  applicantsCount = 0,
  skillMatch = 85
): Project {
  const skills = (item.required_skills || [])
    .map((rs: any) => rs.skill?.name || rs.name)
    .filter(Boolean);

  const businessName = item.business?.name || "Business";
  const isFeatured = item.moderation?.featured || false;

  const derivedApplicants = Array.isArray(item.applications)
    ? item.applications.filter((a: any) => a.status !== "withdrawn").length
    : applicantsCount;

  return {
    id: item.id,
    title: item.title,
    company: businessName,
    initials: getInitials(businessName),
    color: item.business?.avatar_color || "#087EAD",
    avatarUrl: item.business?.logo_path || null,
    ownerId: item.business?.owner_id || null,
    description: item.description,
    budget: Number(item.budget) || 0,
    duration: item.duration_label || "Flexible",
    skills: skills.length > 0 ? skills : ["General"],
    applicants: derivedApplicants,
    match: skillMatch > 0 ? skillMatch : 85,
    category: item.category?.name || "General",
    posted: formatRelativeTime(item.published_at || item.created_at),
    featured: isFeatured,
    workSetup: item.work_setup || "remote",
    objectives: Array.isArray(item.objectives) ? item.objectives : [],
    deliverables: Array.isArray(item.expected_deliverables)
      ? item.expected_deliverables
      : [],
    deadline: item.application_deadline || undefined,
    status: item.status || "published",
  };
}

export async function fetchPublicProjects(): Promise<Project[]> {
  try {
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
        business:business_profiles(owner_id, name, logo_path, avatar_color),
        required_skills:project_required_skills(
          skill:catalog_skills(name)
        ),
        moderation:project_moderation(featured, status)
      `)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error || !listings) {
      return fallbackProjects;
    }

    const projects: Project[] = await Promise.all(
      listings.map(async (item: any) => {
        let applicantsCount = 0;
        let skillMatch = 85;

        try {
          const { data: count } = await supabase.rpc("project_applicant_count", {
            pid: item.id,
          });
          if (typeof count === "number") applicantsCount = count;

          const { data: match } = await supabase.rpc("project_skill_match", {
            pid: item.id,
          });
          if (typeof match === "number" && match > 0) skillMatch = match;
        } catch {
          // RPC may fail if unauthenticated
        }

        return mapRawListingToProject(item, applicantsCount, skillMatch);
      })
    );

    return projects;
  } catch (err) {
    console.error("Error fetching projects from Supabase:", err);
    return fallbackProjects;
  }
}

export async function fetchBusinessProjects(): Promise<Project[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return [];

    const res = await fetch("/api/listings?scope=business", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.listings || []).map((item: any) =>
      mapRawListingToProject(item)
    );
  } catch (err) {
    console.error("Error fetching business projects:", err);
    return [];
  }
}

export async function fetchTalentApplications(): Promise<TalentApplication[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return [];

    const res = await fetch("/api/applications", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.applications || [])
      .filter((a: any) => a.project)
      .map((a: any) => ({
        id: a.id,
        project_id: a.project_id,
        proposal: a.proposal,
        status: a.status,
        proposed_budget: Number(a.proposed_budget) || Number(a.project?.budget) || 0,
        submitted_at: a.submitted_at,
        appliedAgo: formatRelativeTime(a.submitted_at),
        project: mapRawListingToProject(a.project),
      }));
  } catch (err) {
    console.error("Error fetching talent applications:", err);
    return [];
  }
}

export async function fetchBusinessApplications(): Promise<BusinessApplication[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return [];

    const res = await fetch("/api/applications?scope=business", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.applications || []).map((a: any) => {
      const td = a.talent_details || {};
      const name = td.display_name || "Talent";
      return {
        id: a.id,
        project_id: a.project_id,
        project_title: a.project?.title || "Project",
        talent_id: a.talent_id,
        proposal: a.proposal,
        status: a.status,
        proposed_budget: Number(a.proposed_budget) || 0,
        submitted_at: a.submitted_at,
        appliedAgo: formatRelativeTime(a.submitted_at),
        talent: {
          id: a.talent_id,
          name,
          role: td.headline || "Emerging Talent",
          school: td.school || "Verified Member",
          skills: td.skills || ["UI/UX Design"],
          rating: 5.0,
          projects: 1,
          match: 90,
          initials: getInitials(name),
          color: td.avatar_color || "#087EAD",
        },
      };
    });
  } catch (err) {
    console.error("Error fetching business applications:", err);
    return [];
  }
}

export async function fetchTalentsDirectory(): Promise<Talent[]> {
  try {
    const { data: rows, error } = await supabase
      .from("talent_profiles")
      .select(`
        user_id,
        headline,
        school,
        course,
        profile:account_profiles!talent_profiles_user_id_fkey(
          id,
          display_name,
          avatar_color,
          avatar_path,
          banner_path,
          location,
          profile_visible
        )
      `);

    if (error || !rows) return [];

    const { data: skillsRows } = await supabase
      .from("talent_skills")
      .select("talent_id, skill:catalog_skills(name)");

    const skillMap = new Map<string, string[]>();
    for (const sr of skillsRows || []) {
      const list = skillMap.get(sr.talent_id) || [];
      const sName = (sr.skill as any)?.name;
      if (sName) list.push(sName);
      skillMap.set(sr.talent_id, list);
    }

    return rows
      .filter((r: any) => r.profile && r.profile.profile_visible !== false)
      .map((r: any) => {
        const name = r.profile.display_name || "GAWA Talent";
        const skills = skillMap.get(r.user_id) || [];
        return {
          id: r.user_id,
          name,
          role: r.headline || r.course || "Emerging Talent",
          school: r.school || r.profile.location || "Philippines",
          skills: skills.length > 0 ? skills : ["UI/UX Design", "Figma"],
          rating: 5.0,
          projects: 0,
          match: 92,
          initials: getInitials(name),
          color: r.profile.avatar_color || "#087EAD",
          avatarUrl: r.profile.avatar_path || null,
          bannerUrl: r.profile.banner_path || null,
        };
      });
  } catch (err) {
    console.error("Error fetching talents directory:", err);
    return [];
  }
}

export async function fetchContracts(): Promise<any[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return [];
    const res = await fetch("/api/contracts", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.contracts || [];
  } catch {
    return [];
  }
}

export async function fetchConversations(): Promise<any[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return [];
    const res = await fetch("/api/messages", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.conversations || [];
  } catch {
    return [];
  }
}

export async function fetchMessagesData(): Promise<{
  conversations: any[];
  contacts: any[];
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { conversations: [], contacts: [] };
    const res = await fetch("/api/messages", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return { conversations: [], contacts: [] };
    const data = await res.json();
    return {
      conversations: data.conversations || [],
      contacts: data.contacts || [],
    };
  } catch {
    return { conversations: [], contacts: [] };
  }
}

export async function fetchOverviewData(): Promise<any | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await fetch("/api/overview", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}


export async function fetchPaymentsData(): Promise<{
  transactions: any[];
  escrows: any[];
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { transactions: [], escrows: [] };
    const res = await fetch("/api/payments", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return { transactions: [], escrows: [] };
    const data = await res.json();
    return {
      transactions: data.transactions || [],
      escrows: data.escrows || [],
    };
  } catch {
    return { transactions: [], escrows: [] };
  }
}

export async function fundContractEscrow(
  contractId: string,
  amount?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { success: false, error: "Not authenticated" };

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "fund_escrow",
        contract_id: contractId,
        amount,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function releaseContractEscrow(
  contractId: string,
  amount?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { success: false, error: "Not authenticated" };

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "release_escrow",
        contract_id: contractId,
        amount,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deletePortfolioItem(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { success: false, error: "Not authenticated" };

    const res = await fetch("/api/overview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "delete_portfolio_item",
        item_id: itemId,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchSkillAssessments(): Promise<any[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return [];
    const res = await fetch("/api/verification", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.assessments || [];
  } catch {
    return [];
  }
}

export async function submitSkillAssessment(
  assessmentId: string,
  answers: Record<string, any>
): Promise<{ success: boolean; isVerified?: boolean; score?: number; error?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { success: false, error: "Not authenticated" };

    const res = await fetch("/api/verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        assessment_id: assessmentId,
        answers,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return {
      success: true,
      isVerified: data.isVerified,
      score: data.score,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fileReport(
  target: {
    reported_user_id?: string;
    project_id?: string;
    review_id?: string;
    message_id?: string;
  },
  reason: string,
  details?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { success: false, error: "Not authenticated" };

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        ...target,
        reason,
        details,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}


export async function fetchAdminData(): Promise<any | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await fetch("/api/admin", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function moderateListingAction(
  projectId: string,
  status: "approved" | "rejected" | "hidden" | "pending",
  featured = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { success: false, error: "Not authenticated" };
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "moderate_listing",
        project_id: projectId,
        status,
        featured,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleUserStatusAction(
  userId: string,
  status: "active" | "suspended" | "closed",
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { success: false, error: "Not authenticated" };
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "toggle_user_status",
        user_id: userId,
        status,
        reason,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resolveReportAction(
  reportId: string,
  status: "resolved" | "dismissed" | "investigating",
  resolution?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { success: false, error: "Not authenticated" };
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "resolve_report",
        report_id: reportId,
        status,
        resolution,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
