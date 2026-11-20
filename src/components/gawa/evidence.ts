export interface SkillRecord {
  id?: string;
  name: string;
  proficiency?: string;
}
export interface VerificationRecord {
  id: string;
  skill_name: string;
  status: string;
  score?: number;
  submitted_at?: string | null;
  expires_at?: string | null;
  assessment_title?: string;
}
export interface WorkRecord {
  id: string;
  title: string;
  description?: string;
  external_url?: string;
  created_at?: string;
  company?: string;
  completed_at?: string;
}
export interface ReviewRecord {
  id: string;
  reviewer_name?: string;
  project_title?: string;
  rating: number;
  feedback?: string;
  created_at?: string;
}
export interface PassportMark {
  id: string;
  category: "skills" | "work" | "feedback";
  title: string;
  state:
    | "verified"
    | "declared"
    | "pending"
    | "expired"
    | "rejected"
    | "work"
    | "completed"
    | "feedback";
  subtitle: string;
  detail: string;
  date?: string | null;
  score?: number;
  url?: string;
  facts: [string, string][];
}
export const normalizeSkill = (value: string) => value.trim().toLocaleLowerCase();
export function skillOverlap(required: string[], chosen: string[]) {
  const selected = new Set(chosen.map(normalizeSkill));
  const names = new Map<string, string>();
  required
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => {
      if (!names.has(normalizeSkill(s))) names.set(normalizeSkill(s), s);
    });
  const unique = [...names.values()];
  return {
    matched: unique.filter((s) => selected.has(normalizeSkill(s))),
    missing: unique.filter((s) => !selected.has(normalizeSkill(s))),
  };
}
export function safeWorkUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function buildPassportMarks(
  skills: SkillRecord[],
  verifications: VerificationRecord[],
  work: WorkRecord[],
  completed: WorkRecord[],
  reviews: ReviewRecord[],
  now = Date.now(),
): PassportMark[] {
  const latest = new Map<string, VerificationRecord>();
  for (const v of verifications) {
    const key = normalizeSkill(v.skill_name);
    const previous = latest.get(key);
    if (
      !previous ||
      (Date.parse(v.submitted_at || "") || 0) > (Date.parse(previous.submitted_at || "") || 0)
    )
      latest.set(key, v);
  }
  const names = new Map<string, SkillRecord>();
  skills.forEach((s) => names.set(normalizeSkill(s.name), s));
  latest.forEach((v, k) => {
    if (!names.has(k)) names.set(k, { name: v.skill_name });
  });
  const marks: PassportMark[] = [...names].map(([key, skill]) => {
    const proof = latest.get(key);
    const expires = proof?.expires_at ? Date.parse(proof.expires_at) : undefined;
    const expired =
      proof?.status === "expired" ||
      (expires !== undefined && (!Number.isFinite(expires) || expires <= now));
    const state: PassportMark["state"] = !proof
      ? "declared"
      : expired
        ? "expired"
        : proof.status === "verified"
          ? "verified"
          : proof.status === "rejected"
            ? "rejected"
            : "pending";
    const labels = {
      verified: "Assessment verified",
      declared: "Self-declared skill",
      expired: "Verification expired",
      rejected: "Assessment not passed",
      pending: "Awaiting verification",
    };
    return {
      id: `skill:${key}`,
      category: "skills",
      title: skill.name,
      state,
      subtitle: labels[state],
      detail:
        state === "verified"
          ? "This mark is backed by a verified assessment record. It represents platform skill evidence, not a professional licence."
          : state === "declared"
            ? "You have listed this skill on your profile. Add a verified assessment to give this mark a stronger foundation."
            : "This record is not a current verified credential. Check its status before sharing it as proof.",
      score: proof?.score,
      date: proof?.submitted_at,
      facts: [
        ["Source", proof?.assessment_title || "Your skill profile"],
        ["Proficiency", skill.proficiency || "Not specified"],
        ["Status", labels[state]],
        ...(proof?.expires_at
          ? [
              ["Valid until", new Date(proof.expires_at).toLocaleDateString("en-PH")] as [
                string,
                string,
              ],
            ]
          : []),
      ],
    };
  });
  work.forEach((w) =>
    marks.push({
      id: `work:${w.id}`,
      category: "work",
      title: w.title,
      state: "work",
      subtitle: "Portfolio evidence",
      detail:
        w.description ||
        "A work sample you added to your portfolio. This is not automatically linked to a particular skill or client approval.",
      date: w.created_at,
      url: safeWorkUrl(w.external_url),
      facts: [
        ["Source", "Your portfolio"],
        ["Evidence", "Self-published work sample"],
      ],
    }),
  );
  completed.forEach((w) =>
    marks.push({
      id: `completed:${w.id}`,
      category: "work",
      title: w.title,
      state: "completed",
      subtitle: "Completed collaboration",
      detail:
        "A completed contract recorded on GAWA. It does not automatically certify every skill or confirm payment settlement.",
      date: w.completed_at,
      facts: [
        ["Source", "Completed contract"],
        ["Business", w.company || "Collaborator"],
      ],
    }),
  );
  reviews.forEach((r) =>
    marks.push({
      id: `review:${r.id}`,
      category: "feedback",
      title: r.project_title || "Collaboration feedback",
      state: "feedback",
      subtitle: `${r.rating}/5 from ${r.reviewer_name || "a collaborator"}`,
      detail: r.feedback || "The collaborator left a rating without written feedback.",
      date: r.created_at,
      facts: [
        ["Source", "Published collaborator review"],
        ["Reviewer", r.reviewer_name || "Collaborator"],
        ["Rating", `${r.rating} out of 5`],
      ],
    }),
  );
  return marks;
}
