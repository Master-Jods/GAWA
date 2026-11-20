export type Project = {
  id: string | number;
  title: string;
  company: string;
  initials: string;
  color: string;
  avatarUrl?: string | null;
  ownerId?: string | null;
  description: string;
  budget: number;
  duration: string;
  skills: string[];
  applicants: number;
  match: number;
  category: string;
  posted: string;
  featured?: boolean;
  workSetup?: string;
  objectives?: string[];
  deliverables?: string[];
  deadline?: string;
  status?: string;
};

export type Talent = {
  id?: string;
  name: string;
  role: string;
  school: string;
  skills: string[];
  rating: number;
  projects: number;
  match: number;
  initials: string;
  color: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
};

export type TalentApplication = {
  id: string;
  project_id: string;
  proposal: string;
  status: "submitted" | "shortlisted" | "interview" | "accepted" | "rejected" | "withdrawn";
  proposed_budget: number;
  submitted_at: string;
  appliedAgo: string;
  project: Project;
};

export type BusinessApplication = {
  id: string;
  project_id: string;
  project_title: string;
  talent_id: string;
  proposal: string;
  status: "submitted" | "shortlisted" | "interview" | "accepted" | "rejected" | "withdrawn";
  proposed_budget: number;
  submitted_at: string;
  appliedAgo: string;
  talent: Talent;
};

export const projects: Project[] = [];

export const talents: Talent[] = [];

export const php = (value: number) => `₱${Number(value || 0).toLocaleString("en-PH")}`;
