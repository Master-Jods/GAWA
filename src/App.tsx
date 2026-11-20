"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  Fingerprint,
  Filter,
  FolderKanban,
  GraduationCap,
  Heart,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  WalletCards,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  php,
  projects as initialProjects,
  talents,
  type Project,
  type Talent,
  type TalentApplication,
  type BusinessApplication,
} from "./data";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  fetchPublicProjects,
  fetchBusinessProjects,
  fetchTalentApplications,
  fetchBusinessApplications,
  fetchTalentsDirectory,
  fetchContracts,
  fetchConversations,
  fetchMessagesData,
  fetchOverviewData,
  fetchAdminData,
  fetchSkillAssessments,
  submitSkillAssessment,
  fundContractEscrow,
  releaseContractEscrow,
  deletePortfolioItem,
  moderateListingAction,
  toggleUserStatusAction,
  resolveReportAction,
  reviewVerificationAction,
  fileReport,
  formatRelativeTime,
  getInitials,
} from "@/lib/api/projects";
import { supabase } from "@/lib/supabase/client";
import { AuthenticatorGate } from "@/lib/auth/AuthenticatorGate";
import { SignupEmailVerification } from "@/lib/auth/SignupEmailVerification";
import { SkillPassport } from "@/components/gawa/SkillPassport";
import { FitLens } from "@/components/gawa/FitLens";
import { Fieldnotes } from "@/components/gawa/Fieldnotes";
import { DeliveryTrail } from "@/components/gawa/DeliveryTrail";
import { skillOverlap } from "@/components/gawa/evidence";

type Role = "talent" | "business" | "admin";
type View = "landing" | "login" | "register" | "onboarding" | "app";

const talentNav = [
  ["Overview", LayoutDashboard],
  ["Explore Projects", Search],
  ["My Applications", FileText],
  ["Active Projects", FolderKanban],
  ["Messages", MessageSquare],
  ["My Portfolio", UserCheck],
  ["Skill Verification", ShieldCheck],
  ["Reviews", Star],
  ["Settings", Settings],
] as [string, LucideIcon][];
const businessNav = [
  ["Overview", LayoutDashboard],
  ["Post a Project", Plus],
  ["My Projects", BriefcaseBusiness],
  ["Find Talent", Search],
  ["Applications", Users],
  ["Active Projects", FolderKanban],
  ["Messages", MessageSquare],
  ["Payments", WalletCards],
  ["Analytics", BarChart3],
  ["Settings", Settings],
] as [string, LucideIcon][];
const adminNav = [
  ["Platform Overview", LayoutDashboard],
  ["User Management", Users],
  ["Skill Verifications", ShieldCheck],
  ["Project Moderation", FileCheck2],
  ["Transactions", CircleDollarSign],
  ["Reviews & Reports", Star],
  ["Platform Analytics", BarChart3],
  ["Settings", Settings],
] as [string, LucideIcon][];

function Logo({ light = false }: { light?: boolean }) {
  return (
    <button className={`logo ${light ? "logo-light" : ""}`} onClick={() => location.reload()} aria-label="GAWA home">
      <span className="logo-mark">
        <img src="/logo-mark.png" alt="GAWA mark" className="logo-mark-img" />
      </span>
      <span className={light ? "text-white" : ""}>GAWA</span>
    </button>
  );
}

function Avatar({
  initials,
  color = "#162660",
  size = "md",
  src,
}: {
  initials: string;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  src?: string | null;
}) {
  const safeColor = color || "#162660";
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{
        background: `linear-gradient(135deg, ${safeColor}, color-mix(in srgb, ${safeColor} 65%, #0F1B46))`,
      }}
    >
      {src ? <img src={src} alt={initials} /> : initials}
    </span>
  );
}

async function uploadProfileMediaFile(
  file: File,
  kind: "avatar" | "banner"
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: "Not authenticated" };

    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);

    const res = await fetch("/api/profile/media", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || "Upload failed" };
    }
    return { ok: true, url: data.url };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Upload failed" };
  }
}

async function removeProfileMediaFile(
  kind: "avatar" | "banner"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: "Not authenticated" };

    const res = await fetch(`/api/profile/media?kind=${kind}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || "Could not remove image" };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Could not remove image" };
  }
}

function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Landing({
  onNavigate,
  projects,
}: {
  onNavigate: (view: View, role?: Role) => void;
  projects?: Project[];
}) {
  const [mobile, setMobile] = useState(false);
  const [activeNav, setActiveNav] = useState<"projects" | "talent" | "how" | "why" | null>(null);
  const [sectionAnimKey, setSectionAnimKey] = useState(0);
  const [howTab, setHowTab] = useState<"talent" | "business">("talent");
  const [landingCategory, setLandingCategory] = useState<string>("All");

  const selectLandingNav = (
    tab: "projects" | "talent" | "how" | "why",
    targetId: string
  ) => {
    setActiveNav(tab);
    setSectionAnimKey((k) => k + 1);
    setMobile(false);
    if (tab === "talent") {
      setHowTab("business");
    } else if (tab === "how") {
      setHowTab("talent");
    }
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
  };

  const howSteps =
    howTab === "talent"
      ? ([
          [UserCheck, "Create your profile", "Tell your story beyond a traditional résumé."],
          [Award, "Showcase your skills", "Highlight what you can do with proof of work."],
          [
            Search,
            "Discover opportunities",
            "Get matched to projects built for your strengths.",
          ],
          [
            BriefcaseBusiness,
            "Build your portfolio",
            "Complete real work and grow your credibility.",
          ],
        ] as [LucideIcon, string, string][])
      : ([
          [Plus, "Post a clear brief", "Define your project goals, deliverables, and PHP budget."],
          [Users, "Review matched talent", "Compare verified skills, portfolios, and match scores."],
          [
            FolderKanban,
            "Track milestones",
            "Collaborate in a shared workspace with checklist progress.",
          ],
          [
            ShieldCheck,
            "Approve & release",
            "Review submitted deliverables and release escrow safely.",
          ],
        ] as [LucideIcon, string, string][]);

  const filteredLandingProjects = useMemo(() => {
    const all = projects || [];
    if (landingCategory === "All") return all.slice(0, 3);
    return all
      .filter((p) => p.category.toLowerCase().includes(landingCategory.toLowerCase()))
      .slice(0, 3);
  }, [projects, landingCategory]);

  return (
    <div className="landing">
      <nav className="topnav">
        <Logo />
        <div className={`navlinks ${mobile ? "open" : ""}`}>
          <button
            className={activeNav === "projects" ? "active" : ""}
            onClick={() => selectLandingNav("projects", "projects")}
          >
            Find Projects
          </button>
          <button
            className={activeNav === "talent" ? "active" : ""}
            onClick={() => selectLandingNav("talent", "how")}
          >
            Find Talent
          </button>
          <button
            className={activeNav === "how" ? "active" : ""}
            onClick={() => selectLandingNav("how", "how")}
          >
            How It Works
          </button>
          <button
            className={activeNav === "why" ? "active" : ""}
            onClick={() => selectLandingNav("why", "why")}
          >
            Why GAWA
          </button>
        </div>
        <div className="nav-actions">
          <button className="btn btn-ghost hide-mobile" onClick={() => onNavigate("login")}>
            Log in
          </button>
          <button className="btn btn-primary hide-mobile" onClick={() => onNavigate("register")}>
            Get started <ArrowRight size={16} />
          </button>
          <button className="icon-btn mobile-only" onClick={() => setMobile(!mobile)}>
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      <main>
        <section className="hero">
          <div className="hero-glow"></div>
          <div className="hero-copy">
            <div className="eyebrow">
              <Fingerprint size={14} /> FILIPINO TALENT. REAL POSSIBILITIES.
            </div>
            <h1 className="gawa-hero-title">
              Galing mo.<br/>Gawa mo.<br/><span>Patunay mo.</span>
            </h1>
            <p>
              Your skills are a beginning. Turn them into real projects, meaningful collaborations,
              and a story of work you can proudly call your own.
            </p>
            <div className="hero-actions">
              <button
                className="btn btn-primary btn-lg"
                onClick={() => onNavigate("register", "talent")}
              >
                Find my next project
              </button>
              <button
                className="btn btn-white btn-lg"
                onClick={() => onNavigate("register", "business")}
              >
                I’m building a team
              </button>
            </div>
            <div className="gawa-hero-promise"><span><Check size={15}/> Skills with a purpose</span><span><Check size={15}/> Work with a story</span></div>
          </div>
          <Fieldnotes onStart={() => onNavigate("register", "talent")} />
        </section>

        <section className="gawa-manifesto" aria-label="The GAWA promise">
          <div><span className="gawa-manifesto-mark" aria-hidden="true"><img src="/logo-mark.png" alt="" className="logo-mark-img" /></span><b>Potential deserves<br/>a place to begin.</b></div>
          <p>For the first brief. The first collaboration.<br/>The first piece of work that says, <em>“Ako ang gumawa.”</em></p>
          <span className="gawa-manifesto-signature">Made of skill.<br/><strong>Built through action.</strong></span>
        </section>

        <section
          className={`section how ${
            activeNav === "how" || activeNav === "talent" ? "section-tab-focus" : ""
          }`}
          id="how"
        >
          <div className="section-heading centered">
            <span>HOW IT WORKS</span>
            <h2>From potential to proven experience</h2>
            <p>GAWA makes it simple to turn what you know into work that matters.</p>
            <div className="landing-tab-pills" style={{ marginTop: 22 }}>
              <button
                type="button"
                className={howTab === "talent" ? "active" : ""}
                onClick={() => setHowTab("talent")}
              >
                <GraduationCap size={15} /> For Talents
              </button>
              <button
                type="button"
                className={howTab === "business" ? "active" : ""}
                onClick={() => setHowTab("business")}
              >
                <Building2 size={15} /> For Businesses
              </button>
            </div>
          </div>
          <div className="steps landing-tab-panel" key={`${howTab}-${sectionAnimKey}`}>
            {howSteps.map(([Icon, title, text], i) => (
              <div
                className="step"
                key={title}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className="step-number">0{i + 1}</div>
                <div className="step-icon">
                  <Icon size={23} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                {i < 3 && <ArrowRight className="step-arrow" size={18} />}
              </div>
            ))}
          </div>
        </section>

        <section
          className={`section projects-section ${
            activeNav === "projects" ? "section-tab-focus" : ""
          }`}
          id="projects"
        >
          <div className="section-heading row">
            <div>
              <span>FEATURED OPPORTUNITIES</span>
              <h2>Projects worth doing</h2>
              <p>Real briefs from real businesses, matched to your capabilities.</p>
            </div>
            <button className="btn btn-white" onClick={() => onNavigate("register", "talent")}>
              Browse all projects <ArrowRight size={16} />
            </button>
          </div>
          <div className="filter-chips" style={{ marginBottom: 22 }}>
            {["All", "Design", "Development", "Marketing", "Data"].map((cat) => (
              <button
                key={cat}
                type="button"
                className={landingCategory === cat ? "active" : ""}
                onClick={() => setLandingCategory(cat)}
              >
                {cat === "All" ? "All opportunities" : cat}
              </button>
            ))}
          </div>
          <div
            className="project-grid landing-grid landing-tab-panel"
            key={`${landingCategory}-${ activeNav === "projects" ? sectionAnimKey : 0}`}
          >
            {filteredLandingProjects.length > 0 ? (
              filteredLandingProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onClick={() => onNavigate("register", "talent")}
                  saved={false}
                  onSave={() => {}}
                />
              ))
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 24px",
                  color: "#627d98",
                  background: "white",
                  borderRadius: 16,
                  border: "1px dashed #dce7ed",
                  gridColumn: "1 / -1",
                }}
              >
                <p>
                  No project listings in this category yet. Browse all opportunities or post a project!
                </p>
              </div>
            )}
          </div>
        </section>

        <section
          className={`section split-feature ${activeNav === "why" ? "section-tab-focus" : ""}`}
          id="why"
          key={`why-${activeNav === "why" ? sectionAnimKey : 0}`}
        >
          <div className="feature-visual">
            <div className="match-orbit">
              <div>
                <span>96%</span>
                <small>SKILL MATCH</small>
              </div>
            </div>
            <div className="float-skill skill-a">
              <CheckCircle2 /> React <Badge tone="green">Verified</Badge>
            </div>
            <div className="float-skill skill-b">
              <CheckCircle2 /> UI Design <Badge tone="green">Verified</Badge>
            </div>
            <div className="float-skill skill-c">
              <Star fill="currentColor" /> 4.9 client rating
            </div>
          </div>
          <div className="feature-copy">
            <span className="section-kicker">SKILLS OVER LABELS</span>
            <h2>Be seen for what you can do, not just where you studied.</h2>
            <p>
              GAWA surfaces credible talent using verified skills, portfolio work, and successful
              project outcomes.
            </p>
            <ul>
              <li>
                <Check /> Skill-first matching that finds your fit
              </li>
              <li>
                <Check /> Real project experience for your portfolio
              </li>
              <li>
                <Check /> Transparent milestones and collaboration
              </li>
            </ul>
            <button className="text-link" onClick={() => onNavigate("register")}>
              Start building your proof <ArrowRight size={16} />
            </button>
          </div>
        </section>

        <section className="section testimonials">
          <div className="section-heading centered">
            <span>COMMUNITY STORIES</span>
            <h2>Progress that speaks for itself</h2>
          </div>
          <div className="quote-grid">
            {[
              [
                "“GAWA helped me turn classroom skills into a real client project before graduation.”",
                "Mika Reyes",
                "UI/UX Designer · DLSU",
                "MR",
                "#162660",
              ],
              [
                "“We found an excellent developer in days, and the milestone workflow kept everything clear.”",
                "Daniel Go",
                "Founder · SariSari Studio",
                "DG",
                "#805AD5",
              ],
              [
                "“My first completed project gave me the confidence and proof I needed to apply for bigger work.”",
                "Joaquin Lim",
                "Data Analyst · Ateneo",
                "JL",
                "#16A34A",
              ],
            ].map((q) => (
              <div className="quote-card" key={q[1]}>
                <div className="stars" aria-label="5 out of 5 stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={14} fill="#f59e0b" stroke="#f59e0b" />
                  ))}
                </div>
                <blockquote>{q[0]}</blockquote>
                <div className="quote-person">
                  <Avatar initials={q[3]} color={q[4]} />
                  <div>
                    <strong>{q[1]}</strong>
                    <span>{q[2]}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="fiction-note">Fictional profiles shown for prototype demonstration.</p>
        </section>

        <section className="cta">
          <div>
            <span>YOUR NEXT OPPORTUNITY STARTS HERE</span>
            <h2>Ready to turn skills into momentum?</h2>
            <p>Join a growing community creating meaningful work across the Philippines.</p>
          </div>
          <button className="btn btn-white btn-lg" onClick={() => onNavigate("register")}>
            Create your free profile <ArrowRight size={18} />
          </button>
        </section>
      </main>
      <footer>
        <div>
          <Logo light />
          <p>Galing. Aksyon. Wasto. Asenso.</p>
        </div>
        <div className="footer-links">
          <div>
            <b>Platform</b>
            <a>Find Projects</a>
            <a>Find Talent</a>
            <a>Pricing</a>
          </div>
          <div>
            <b>Company</b>
            <a>About</a>
            <a>How it Works</a>
            <a>Contact</a>
          </div>
          <div>
            <b>Support</b>
            <a>Help Center</a>
            <a>Safety</a>
            <a>Terms & Privacy</a>
          </div>
        </div>
        <small>© 2026 GAWA. Prototype experience for demonstration.</small>
      </footer>
    </div>
  );
}

function HeroVisual() {
  const [mockTab, setMockTab] = useState(0);
  return (
    <div className="hero-visual">
      <div className="dashboard-mock">
        <div className="mock-sidebar">
          <div className="mini-logo">
            <img src="/logo-mark.png" alt="GAWA" className="w-5 h-5 object-contain" />
          </div>
          {[Home, Search, BriefcaseBusiness, MessageSquare, UserCheck].map((I, i) => (
            <span
              className={i === mockTab ? "active" : ""}
              key={i}
              onClick={() => setMockTab(i)}
              style={{ cursor: "pointer", transition: "all 0.2s ease" }}
            >
              <I size={16} />
            </span>
          ))}
        </div>
        <div className="mock-main landing-tab-panel" key={mockTab}>
          <div className="mock-top">
            <div>
              <small>Good morning, Mika</small>
              <strong>
                {mockTab === 0
                  ? "Find work that fits you."
                  : mockTab === 1
                  ? "Explore verified briefs."
                  : mockTab === 2
                  ? "Track active milestones."
                  : mockTab === 3
                  ? "Direct client messages."
                  : "Your verified portfolio."}
              </strong>
            </div>
            <Avatar initials="MR" size="sm" />
          </div>
          <div className="mock-stats">
            <div>
              <small>Profile strength</small>
              <strong>82%</strong>
              <i style={{ width: "82%" }}></i>
            </div>
            <div>
              <small>Active projects</small>
              <strong>02</strong>
              <span>+1 this month</span>
            </div>
          </div>
          <div className="mock-label">
            <b>Recommended for you</b>
            <small>View all</small>
          </div>
          <div className="mock-project">
            <div className="company-icon">SS</div>
            <div>
              <small>SariSari Studio</small>
              <b>E-Commerce Website Development</b>
              <p>
                <span>React</span>
                <span>UI Design</span>
              </p>
            </div>
            <strong>₱15,000</strong>
          </div>
          <div className="mock-project">
            <div className="company-icon purple">AH</div>
            <div>
              <small>Alaga Health</small>
              <b>Mobile App UI/UX Design</b>
              <p>
                <span>Figma</span>
                <span>Prototyping</span>
              </p>
            </div>
            <strong>₱10,000</strong>
          </div>
        </div>
      </div>
      <div className="floating-card match-card">
        <span>
          <Target /> Great match
        </span>
        <strong>96%</strong>
        <small>Based on your verified skills</small>
      </div>
      <div className="floating-card verified-card">
        <ShieldCheck />
        <div>
          <strong>Skill verified</strong>
          <small>React Development</small>
        </div>
      </div>
    </div>
  );
}

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gawa-csrf": "1" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="gawa-modal-backdrop"
      style={{
        position: "fixed", inset: 0, background: "rgba(14, 25, 66, 0.52)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="panel gawa-modal-panel" style={{ maxWidth: 420, width: "100%", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Reset password</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>
        {submitted ? (
          <div key="reset-done" className="gawa-step-transition">
            <div className="gawa-alert-banner gawa-alert-info" style={{ background: "#D0E6FD", border: "1px solid #9AC6F9", borderRadius: 10, padding: "12px 16px", color: "#162660", fontSize: 14, marginBottom: 20 }}>
              If that email address is registered, we've sent instructions to reset your password. Check your inbox.
            </div>
            <button className="btn btn-primary full" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form key="reset-form" className="gawa-step-transition" onSubmit={handleSubmit}>
            <p style={{ color: "#475785", fontSize: 14, marginBottom: 20 }}>
              Enter your registered email and we'll send a secure reset link.
            </p>
            {error && (
              <div className="gawa-alert-banner gawa-alert-error" style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#b91c1c", fontSize: 13, marginBottom: 14 }}>
                {error}
              </div>
            )}
            <label>
              Email address
              <input
                required
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className={`btn btn-primary full btn-lg ${submitting ? "is-loading" : ""}`}
              style={{ marginTop: 8 }}
            >
              {submitting ? "Sending…" : "Send reset link"} <ArrowRight size={17} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Auth({
  mode,
  initialRole,
  onBack,
  onComplete,
}: {
  mode: "login" | "register";
  initialRole?: Role;
  onBack: () => void;
  onComplete: (role: Role, onboarding?: boolean) => void;
}) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [currentMode, setCurrentMode] = useState<"login" | "register">(mode);
  const [role, setRole] = useState<Role>(initialRole || "talent");
  const [step, setStep] = useState(mode === "register" ? 0 : 1);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [authError, setAuthError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [pendingSignupEmail, setPendingSignupEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCurrentMode(mode);
    setStep(mode === "register" ? 0 : 1);
  }, [mode]);

  const handleGoogleSignIn = async () => {
    setAuthError("");
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    setGoogleLoading(false);
    if (result?.error) {
      setAuthError(result.error);
    }
    // On success the browser redirects to Google, so no further action needed here
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setInfoMessage("");
    setSubmitting(true);

    try {
      if (currentMode === "login") {
        const expected = role === "business" ? "business" : "talent";
        const result = await signIn(email, password, expected);
        setSubmitting(false);
        if (result.error) {
          setAuthError(result.error);
          return;
        }
        onComplete((result as any).role || expected, false);
      } else {
        if (!displayName.trim()) {
          setAuthError("Please provide your full name");
          setSubmitting(false);
          return;
        }
        const { error, requiresEmailConfirmation, role: actualRole } = await signUp({
          email,
          password,
          displayName: displayName.trim(),
          role: role === "business" ? "business" : "talent",
          businessName: role === "business" ? businessName.trim() : undefined,
        });
        setSubmitting(false);
        if (error) {
          setAuthError(error);
          return;
        }
        if (requiresEmailConfirmation) {
          setPendingSignupEmail(email.trim());
          return;
        }
        onComplete(actualRole || role, true);
      }
    } catch (err: any) {
      setSubmitting(false);
      setAuthError(err?.message || "Authentication error occurred");
    }
  };

  if (pendingSignupEmail) {
    return <SignupEmailVerification email={pendingSignupEmail}
      onBack={() => { setPendingSignupEmail(null); setCurrentMode("login"); }} />;
  }

  return (
    <>
      {showForgotPassword && (
        <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
      )}
    <div className="auth-page">
      <div className="auth-aside">
        <Logo light />
        <div className="auth-quote">
          <div className="eyebrow dark">
            <ShieldCheck size={14} /> OPPORTUNITY STARTS WITH ACTION
          </div>
          <h2>
            Build experience.
            <br />
            Create proof.
            <br />
            Move forward.
          </h2>
          <p>Join Filipino talents and businesses creating meaningful work together.</p>
          <div className="mini-proof">
            <div className="avatar-stack">
              <Avatar initials="MR" size="sm" />
              <Avatar initials="JL" color="#16A34A" size="sm" />
              <Avatar initials="AC" color="#E0527D" size="sm" />
            </div>
            <span>
              <b>Skill-first community</b>
              <br />
              growing with GAWA
            </span>
          </div>
        </div>
        <small>Galing. Aksyon. Wasto. Asenso.</small>
      </div>
      <div className="auth-main">
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={17} /> Back to home
        </button>
        <div className="auth-card landing-tab-panel" key={`${currentMode}-${step}-${role}`}>
          {step === 0 ? (
            <>
              <span className="auth-kicker">LET'S GET STARTED</span>
              <h1>How will you use GAWA?</h1>
              <p>Choose the experience that’s right for you. You can update this later.</p>
              <button
                type="button"
                className={`role-choice ${role === "talent" ? "selected" : ""}`}
                onClick={() => setRole("talent")}
              >
                <div className="role-icon">
                  <GraduationCap />
                </div>
                <div>
                  <b>I’m looking for projects</b>
                  <span>Showcase my skills and build real experience</span>
                </div>
                <span className="radio">{role === "talent" && <Check size={14} />}</span>
              </button>
              <button
                type="button"
                className={`role-choice ${role === "business" ? "selected" : ""}`}
                onClick={() => setRole("business")}
              >
                <div className="role-icon">
                  <Building2 />
                </div>
                <div>
                  <b>I’m looking for talent</b>
                  <span>Find skilled people for my business projects</span>
                </div>
                <span className="radio">{role === "business" && <Check size={14} />}</span>
              </button>
              <button className="btn btn-primary full btn-lg" onClick={() => setStep(1)}>
                Continue <ArrowRight size={17} />
              </button>
              <p className="auth-switch">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthError("");
                    setInfoMessage("");
                    setCurrentMode("login");
                    setStep(1);
                  }}
                >
                  Log in
                </button>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <span className="auth-kicker">
                {currentMode === "login" ? "WELCOME BACK" : "CREATE YOUR ACCOUNT"}
              </span>
              <h1>{currentMode === "login" ? "Log in to GAWA" : "Start building your future"}</h1>
              <p>
                {currentMode === "login"
                  ? "Continue your projects and opportunities."
                  : "Join the skill-first project community."}
              </p>
              {currentMode === "login" && (
                <div className="role-tabs">
                  <button
                    type="button"
                    className={role === "talent" ? "active" : ""}
                    onClick={() => {
                      setRole("talent");
                      setAuthError("");
                    }}
                  >
                    Talent
                  </button>
                  <button
                    type="button"
                    className={role === "business" ? "active" : ""}
                    onClick={() => {
                      setRole("business");
                      setAuthError("");
                    }}
                  >
                    Business
                  </button>
                </div>
              )}
              {authError && (
                <div
                  className="gawa-alert-banner gawa-alert-error"
                  style={{
                    padding: "10px 14px",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    borderRadius: 10,
                    fontSize: 13,
                    marginBottom: 14,
                    border: "1px solid #fecaca",
                  }}
                >
                  {authError}
                </div>
              )}
              {infoMessage && (
                <div
                  className="gawa-alert-banner gawa-alert-info"
                  style={{
                    padding: "10px 14px",
                    background: "#D0E6FD",
                    color: "#162660",
                    borderRadius: 10,
                    fontSize: 13,
                    marginBottom: 14,
                    border: "1px solid #9AC6F9",
                  }}
                >
                  {infoMessage}
                </div>
              )}
              {currentMode === "register" && (
                <>
                  <label>
                    Full name
                    <input
                      required
                      placeholder="Juan Dela Cruz"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </label>
                  {role === "business" && (
                    <label>
                      Company / Business name
                      <input
                        placeholder="e.g. SariSari Studio"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                      />
                    </label>
                  )}
                </>
              )}
              <label>
                Email address
                <input
                  required
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                <span>
                  Password <button type="button" className="field-link" onClick={() => setShowForgotPassword(true)}>Forgot password?</button>
                </span>
                <div className="input-wrap">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}>
                    <Eye size={18} />
                  </button>
                </div>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className={`btn btn-primary full btn-lg ${submitting ? "is-loading" : ""}`}
              >
                {submitting
                  ? "Signing you in…"
                  : currentMode === "login"
                  ? "Log in"
                  : "Create account"}{" "}
                <ArrowRight size={17} />
              </button>
              <div className="divider">
                <span>or continue with</span>
              </div>
              <button
                type="button"
                className={`btn btn-white full ${googleLoading ? "is-loading" : ""}`}
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                <b className="google">G</b>{googleLoading ? " Connecting…" : " Continue with Google"}
              </button>
              <p className="auth-switch">
                {currentMode === "login" ? "New to GAWA? " : "Already registered? "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthError("");
                    setInfoMessage("");
                    if (currentMode === "login") {
                      setCurrentMode("register");
                      setStep(0);
                    } else {
                      setCurrentMode("login");
                      setStep(1);
                    }
                  }}
                >
                  {currentMode === "login" ? "Create an account" : "Log in"}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

function Onboarding({ role, onDone }: { role: Role; onDone: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [skills, setSkills] = useState(["UI/UX Design", "Figma"]);
  const [skillSearch, setSkillSearch] = useState("");
  const [nameInput, setNameInput] = useState(profile?.display_name || "");
  const [orgOrSchool, setOrgOrSchool] = useState("");
  const [courseOrSize, setCourseOrSize] = useState("");
  const [locationInput, setLocationInput] = useState(profile?.location || "");
  const [businessDesc, setBusinessDesc] = useState("");
  const [contactName, setContactName] = useState(profile?.display_name || "");
  const [contactEmail, setContactEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);

  const steps =
    role === "talent"
      ? ["About you", "Your skills", "Portfolio", "Preferences", "Complete"]
      : ["Business", "Company details", "Brand profile", "Complete"];
  const max = steps.length;

  const saveOnboarding = async () => {
    if (!user) {
      onDone();
      return;
    }
    setSaving(true);
    try {
      await supabase
        .from("account_profiles")
        .update({
          display_name: nameInput.trim() || profile?.display_name || "GAWA Member",
          location: locationInput.trim() || null,
        })
        .eq("id", user.id);

      if (role === "talent") {
        await supabase
          .from("talent_profiles")
          .update({
            school: orgOrSchool.trim() || null,
            course: courseOrSize.trim() || null,
            preferred_location: locationInput.trim() || null,
          })
          .eq("user_id", user.id);

        if (skills.length > 0) {
          const { data: catSkills } = await supabase
            .from("catalog_skills")
            .select("id, name");
          const sMap = new Map(
            (catSkills || []).map((s) => [s.name.toLowerCase(), s.id])
          );
          for (const sk of skills) {
            const sid = sMap.get(sk.toLowerCase());
            if (sid) {
              await supabase.from("talent_skills").upsert({
                talent_id: user.id,
                skill_id: sid,
                proficiency: "intermediate",
              });
            }
          }
        }
      } else if (role === "business") {
        const { data: bProf } = await supabase
          .from("business_profiles")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (bProf) {
          await supabase
            .from("business_profiles")
            .update({
              name: nameInput.trim() || profile?.display_name || "My Business",
              industry: orgOrSchool.trim() || null,
              company_size: courseOrSize.trim() || null,
              location: locationInput.trim() || null,
              description: businessDesc.trim() || null,
              contact_name: contactName.trim() || null,
              contact_email: contactEmail.trim() || null,
            })
            .eq("id", bProf.id);
        }
      }

      await supabase
        .from("account_preferences")
        .update({
          onboarding_step: max,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      await refreshProfile();
    } catch (err) {
      console.error("Onboarding save error:", err);
    } finally {
      setSaving(false);
      onDone();
    }
  };

  return (
    <div className="onboarding-page">
      <header>
        <Logo />
        <button className="btn btn-ghost" onClick={saveOnboarding}>
          Save & exit
        </button>
      </header>
      <div className="onboarding-shell">
        <aside>
          <span>PROFILE SETUP</span>
          <h2>Make a strong first impression.</h2>
          <p>
            {role === "talent"
              ? "Help businesses understand what makes you a great collaborator."
              : "Tell talents who you are and what you’re building."}
          </p>
          <div className="vertical-steps">
            {steps.map((s, i) => (
              <div
                className={`${step === i + 1 ? "active" : ""} ${step > i + 1 ? "done" : ""}`}
                key={s}
              >
                <i>{step > i + 1 ? <Check size={14} /> : i + 1}</i>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </aside>
        <main>
          <div className="progress-label">
            <span>
              Step {step} of {max}
            </span>
            <b>{Math.round((step / max) * 100)}% complete</b>
          </div>
          <div className="progress">
            <i style={{ width: `${(step / max) * 100}%` }}></i>
          </div>
          {step < max ? (
            <div key={`onboarding-step-${step}`} className="onboarding-form gawa-step-transition">
              <span className="auth-kicker">{steps[step - 1].toUpperCase()}</span>
              <h1>
                {role === "talent"
                  ? step === 1
                    ? "Tell us about yourself"
                    : step === 2
                      ? "What are you great at?"
                      : step === 3
                        ? "Show your best work"
                        : "Choose work that fits you"
                  : step === 1
                    ? "Tell us about your business"
                    : step === 2
                      ? "Help us understand your company"
                      : "Add your brand identity"}
              </h1>
              <p>This helps us personalize your GAWA experience and recommendations.</p>
              {step === 1 && (
                <div className="form-grid">
                  <label>
                    {role === "talent" ? "Full name" : "Business name"}
                    <input
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder={role === "talent" ? "Your full name" : "Your business name"}
                    />
                  </label>
                  <label>
                    {role === "talent" ? "School or university" : "Industry"}
                    <input
                      value={orgOrSchool}
                      onChange={(e) => setOrgOrSchool(e.target.value)}
                      placeholder={
                        role === "talent" ? "e.g. De La Salle University" : "e.g. Retail & E-commerce"
                      }
                    />
                  </label>
                  <label>
                    {role === "talent" ? "Course or program" : "Company size"}
                    <input
                      value={courseOrSize}
                      onChange={(e) => setCourseOrSize(e.target.value)}
                      placeholder={
                        role === "talent" ? "e.g. BS Information Technology" : "e.g. 2–10 employees"
                      }
                    />
                  </label>
                  <label>
                    Location
                    <input
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      placeholder="e.g. Makati City, Metro Manila"
                    />
                  </label>
                </div>
              )}
              {step === 2 && role === "talent" && (
                <>
                  <div className="skill-search">
                    <Search />
                    <input
                      value={skillSearch}
                      onChange={(e) => setSkillSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && skillSearch.trim()) {
                          e.preventDefault();
                          if (!skills.includes(skillSearch.trim())) {
                            setSkills([...skills, skillSearch.trim()]);
                          }
                          setSkillSearch("");
                        }
                      }}
                      placeholder="Search and add skills"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (skillSearch.trim() && !skills.includes(skillSearch.trim())) {
                          setSkills([...skills, skillSearch.trim()]);
                          setSkillSearch("");
                        }
                      }}
                    >
                      Add skill
                    </button>
                  </div>
                  <div className="skill-options">
                    {[
                      "UI/UX Design",
                      "Figma",
                      "React",
                      "Web Development",
                      "Graphic Design",
                      "Content Writing",
                    ].map((s) => (
                      <button
                        type="button"
                        className={skills.includes(s) ? "selected" : ""}
                        onClick={() =>
                          setSkills((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]))
                        }
                        key={s}
                      >
                        {skills.includes(s) && <Check size={14} />} {s}
                      </button>
                    ))}
                  </div>
                  <div className="selected-skills">
                    <b>Your selected skills</b>
                    {skills.map((s) => (
                      <div key={s}>
                        <span>{s}</span>
                        <select defaultValue="Intermediate">
                          <option>Beginner</option>
                          <option>Intermediate</option>
                          <option>Advanced</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {step === 2 && role === "business" && (
                <div className="form-grid">
                  <label className="wide">
                    Business description
                    <textarea
                      value={businessDesc}
                      onChange={(e) => setBusinessDesc(e.target.value)}
                      placeholder="Describe what your business does and what kind of work you're looking for."
                    />
                  </label>
                  <label>
                    Contact name
                    <input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Your name"
                    />
                  </label>
                  <label>
                    Business email
                    <input
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="contact@yourbusiness.com"
                    />
                  </label>
                </div>
              )}
              {step === 3 && (
                <div className="upload-zone">
                  <Upload />
                  <b>
                    {role === "talent" ? "Upload your work samples" : "Upload your business logo"}
                  </b>
                  <span>Drag and drop files or click to browse</span>
                  <button type="button" className="btn btn-white">
                    Choose files
                  </button>
                </div>
              )}
              {step === 4 && role === "talent" && (
                <div className="preference-list">
                  {[
                    "Remote projects",
                    "Onsite projects within Metro Manila",
                    "Short-term projects (1–4 weeks)",
                    "Long-term projects",
                  ].map((x, i) => (
                    <label key={x}>
                      <input type="checkbox" defaultChecked={i !== 1} />
                      <span>{x}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="form-actions">
                <button
                  className="btn btn-white"
                  disabled={step === 1}
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft size={17} /> Back
                </button>
                <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
                  Continue <ArrowRight size={17} />
                </button>
              </div>
            </div>
          ) : (
            <div key="onboarding-complete" className="completion gawa-step-transition">
              <div className="completion-icon">
                <Check />
              </div>
              <span className="auth-kicker">YOU'RE ALL SET</span>
              <h1>Your GAWA profile is ready.</h1>
              <p>We’ve personalized your workspace. Your next opportunity is waiting.</p>
              <div className="completion-list">
                <span>
                  <CheckCircle2 /> Profile details added
                </span>
                <span>
                  <CheckCircle2 /> Preferences personalized
                </span>
                <span>
                  <CheckCircle2 /> Recommendations ready
                </span>
              </div>
              <button
                className={`btn btn-primary btn-lg ${saving ? "is-loading" : ""}`}
                disabled={saving}
                onClick={saveOnboarding}
              >
                {saving ? "Saving..." : "Go to my dashboard"} <ArrowRight />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onClick,
  saved,
  onSave,
}: {
  project: Project;
  onClick: () => void;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <article className="project-card" onClick={onClick}>
      <div className="project-top">
        <Avatar initials={project.initials} color={project.color} src={project.avatarUrl} />
        <div>
          <span>{project.company}</span>
          <small>{project.posted}</small>
        </div>
        <button
          className={`save-btn ${saved ? "saved" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          aria-label="Save project"
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <h3>{project.title}</h3>
      <p>{project.description}</p>
      <div className="tags">
        {project.skills.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="project-meta">
        <span>
          <CircleDollarSign /> <b>{php(project.budget)}</b>
        </span>
        <span>
          <Clock3 /> {project.duration}
        </span>
      </div>
      <div className="match-row">
        <span>
          <Target size={13} /> {project.match}% skill match
        </span>
        <span>{project.applicants} applicants</span>
      </div>
    </article>
  );
}

function Shell({
  role,
  active,
  setActive,
  onLogout,
  children,
}: {
  role: Role;
  active: string;
  setActive: (s: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const { profile, user: authUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [headerQuery, setHeaderQuery] = useState("");

  useEffect(() => {
    if (!authUser) return;
    fetchOverviewData().then((d) => {
      if (d?.notifications) {
        setNotifications(d.notifications);
      }
    });
  }, [authUser, active]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const toggleNotifs = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next && unreadCount > 0) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await fetch("/api/overview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "mark_notifications_read" }),
        });
      }
    }
  };

  const nav = role === "talent" ? talentNav : role === "business" ? businessNav : adminNav;
  const defaultUser =
    role === "talent"
      ? ["Talent User", "Talent member", "GW"]
      : role === "business"
        ? ["Business User", "Business account", "GW"]
        : ["Admin User", "Platform admin", "GW"];

  const user = profile
    ? [
        profile.display_name,
        role === "talent"
          ? "Talent member"
          : role === "business"
          ? "Business account"
          : "Platform admin",
        getInitials(profile.display_name),
      ]
    : defaultUser;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="side-logo">
          <Logo />
          <button onClick={() => setOpen(false)} className="mobile-only icon-btn">
            <X />
          </button>
        </div>
        <div className="workspace-label">{role === "admin" ? "ADMIN CONSOLE" : "WORKSPACE"}</div>
        <div className="sidebar-tatak"><Fingerprint size={19}/><div><b>Make work. Leave proof.</b><span>Your GAWA fieldnotes</span></div></div>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={active === label ? "active" : ""}
              onClick={() => {
                setActive(label);
                setOpen(false);
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Messages" && unreadCount > 0 && <i>{unreadCount}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-help">
          <div>
            <HelpCircle size={18} />
            <b>Need a hand?</b>
          </div>
          <p>Visit the GAWA Help Center for quick answers.</p>
          <button onClick={() => setActive("Settings")}>
            Get support <ArrowRight size={14} />
          </button>
        </div>
        <div className="side-user">
          <Avatar initials={user[2]} size="sm" src={profile?.avatar_path} color={profile?.avatar_color} />
          <div>
            <b>{user[0]}</b>
            <span>{user[1]}</span>
          </div>
          <button onClick={onLogout} aria-label="Log out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <button className="mobile-menu" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div className="global-search">
            <Search />
            <input
              value={headerQuery}
              onChange={(e) => setHeaderQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setActive(
                    role === "talent"
                      ? "Explore Projects"
                      : role === "business"
                      ? "Find Talent"
                      : "User Management"
                  );
                }
              }}
              placeholder="Search projects, talents, messages…"
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="header-actions" style={{ position: "relative" }}>
            <button
              className="icon-btn relative"
              onClick={toggleNotifs}
              aria-label="Notifications"
            >
              <Bell />
              {unreadCount > 0 && <i></i>}
            </button>
            {notifOpen && (
              <div
                className="gawa-popover-enter"
                style={{
                  position: "absolute",
                  top: "calc(100% + 10px)",
                  right: 0,
                  width: 320,
                  background: "#FFFDF9",
                  borderRadius: 14,
                  boxShadow: "0 18px 40px -8px rgba(22,38,96,0.18)",
                  border: "1px solid #E2D2BC",
                  padding: 14,
                  zIndex: 50,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: 8,
                    borderBottom: "1px solid #E2D2BC",
                    marginBottom: 8,
                  }}
                >
                  <b style={{ fontSize: 13, color: "#162660" }}>Notifications</b>
                  <button
                    type="button"
                    style={{ fontSize: 12, color: "#162660", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}
                    onClick={() => setNotifOpen(false)}
                  >
                    Close
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#6876A1", textAlign: "center", padding: "16px 8px" }}>
                    No notifications yet.
                  </p>
                ) : (
                  <div style={{ maxHeight: 260, overflowY: "auto", display: "grid", gap: 8 }}>
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="gawa-item-enter"
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: n.read_at ? "#FAF5EE" : "#D0E6FD",
                          border: n.read_at ? "1px solid #E2D2BC" : "1px solid #9AC6F9",
                          fontSize: 12,
                        }}
                      >
                        <b style={{ display: "block", color: "#162660" }}>{n.title}</b>
                        <span style={{ color: "#3F4F80" }}>{n.body}</span>
                        <small style={{ display: "block", color: "#6876A1", marginTop: 4 }}>
                          {formatRelativeTime(n.created_at)}
                        </small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Avatar initials={user[2]} size="sm" src={profile?.avatar_path} color={profile?.avatar_color} />
          </div>
        </header>
        <div key={active} className="tab-transition-shell">
          {children}
        </div>
      </div>
    </div>
  );
}

function TalentApp({
  active,
  setActive,
  toast,
  projects,
  onRefreshProjects,
}: {
  active: string;
  setActive: (s: string) => void;
  toast: (s: string) => void;
  projects?: Project[];
  onRefreshProjects?: () => Promise<void>;
}) {
  const { user } = useAuth();
  const marketProjects = projects || [];
  const [saved, setSaved] = useState<(string | number)[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [applications, setApplications] = useState<TalentApplication[]>([]);
  const [applied, setApplied] = useState<(string | number)[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [overview, setOverview] = useState<any | null>(null);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<"all" | "best" | "new" | "remote" | "saved">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [focusedSkills, setFocusedSkills] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "budget" | "match">("newest");

  // Clear project detail view whenever the user navigates via sidebar
  useEffect(() => {
    setSelected(null);
  }, [active]);

  const loadTalentData = async () => {
    if (!user) return;
    const [apps, cList, ovData] = await Promise.all([
      fetchTalentApplications(),
      fetchContracts(),
      fetchOverviewData(),
    ]);
    setApplications(apps);
    setApplied(apps.map((a) => a.project_id));
    setContracts(cList);
    if (ovData) setOverview(ovData);

    const { data: savedRows } = await supabase
      .from("project_saved_listings")
      .select("project_id")
      .eq("talent_id", user.id);
    if (savedRows) {
      setSaved(savedRows.map((r) => r.project_id));
    }
  };

  useEffect(() => {
    loadTalentData();
  }, [user, active]);

  const toggleSave = async (projectId: string | number) => {
    const isAlreadySaved = saved.some((x) => String(x) === String(projectId));
    setSaved((prev) =>
      isAlreadySaved
        ? prev.filter((x) => String(x) !== String(projectId))
        : [...prev, projectId]
    );
    toast(isAlreadySaved ? "Removed from saved projects" : "Project saved");

    if (user && typeof projectId === "string") {
      if (isAlreadySaved) {
        await supabase
          .from("project_saved_listings")
          .delete()
          .eq("talent_id", user.id)
          .eq("project_id", projectId);
      } else {
        await supabase.from("project_saved_listings").upsert({
          talent_id: user.id,
          project_id: projectId,
        });
      }
    }
  };

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of marketProjects) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set);
  }, [marketProjects]);

  const filteredProjects = useMemo(() => {
    const list = marketProjects.filter((p) => {
      const matchesQuery = `${p.title} ${p.company} ${p.skills.join(" ")} ${p.category}`
        .toLowerCase()
        .includes(query.toLowerCase());
      if (!matchesQuery) return false;
      if (focusedSkills.length && !skillOverlap(p.skills, focusedSkills).matched.length) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (chip === "saved") return saved.some((x) => String(x) === String(p.id));
      if (chip === "best") return p.match >= 50;
      if (chip === "remote") return (p.workSetup || "remote").toLowerCase() === "remote";
      if (chip === "new")
        return (
          p.posted === "Just now" ||
          p.posted.endsWith("m ago") ||
          p.posted.endsWith("h ago")
        );
      return true;
    });

    if (sortBy === "budget") {
      return [...list].sort((a, b) => b.budget - a.budget);
    }
    if (sortBy === "match") {
      return [...list].sort((a, b) => b.match - a.match);
    }
    return list;
  }, [marketProjects, query, chip, categoryFilter, saved, sortBy, focusedSkills]);

  if (selected)
    return (
      <ProjectDetail
        project={selected}
        onBack={() => setSelected(null)}
        applied={applied.some((id) => String(id) === String(selected.id))}
        saved={saved.some((id) => String(id) === String(selected.id))}
        onSave={() => toggleSave(selected.id)}
        onMessageBusiness={async () => {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session && selected.ownerId) {
              await fetch("/api/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  action: "start",
                  recipient_id: selected.ownerId,
                  subject: `Inquiry: ${selected.title}`,
                  message: `Hi ${selected.company}! I'm interested in your project "${selected.title}" and would love to discuss how I can help.`,
                }),
              });
            }
          } catch {}
          setSelected(null);
          setActive("Messages");
        }}
        onApply={async (proposalText: string) => {
          const finalProposal =
            proposalText.trim() ||
            "I would love to collaborate on this project and apply my expertise.";

          if (typeof selected.id === "string") {
            try {
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (session) {
                const res = await fetch("/api/applications", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    project_id: selected.id,
                    proposal: finalProposal,
                  }),
                });
                const data = await res.json();
                if (!res.ok && res.status !== 409) {
                  toast(data.error || "Failed to submit application");
                  return;
                }
              }
            } catch (err) {
              console.error("Proposal submission error:", err);
              toast("Could not submit application");
              return;
            }
          }

          setApplied((prev) =>
            prev.some((id) => String(id) === String(selected.id))
              ? prev
              : [...prev, selected.id]
          );

          const optimisticApp: TalentApplication = {
            id: `temp-${Date.now()}`,
            project_id: String(selected.id),
            proposal: finalProposal,
            status: "submitted",
            proposed_budget: selected.budget,
            submitted_at: new Date().toISOString(),
            appliedAgo: "Just now",
            project: selected,
          };
          setApplications((prev) =>
            prev.some((a) => String(a.project_id) === String(selected.id))
              ? prev
              : [optimisticApp, ...prev]
          );

          const refreshedApps = await fetchTalentApplications();
          if (refreshedApps.length > 0) {
            setApplications(refreshedApps);
            setApplied(refreshedApps.map((a) => a.project_id));
          }
          await onRefreshProjects?.();
          toast("Application submitted successfully");
        }}
      />
    );
  if (active === "Explore Projects")
    return (
      <main className="page">
        <PageTitle
          eyebrow="PROJECT MARKETPLACE"
          title="Discover work that fits you"
          text="Explore opportunities matched to your skills, goals, and availability."
        />
        <FitLens skills={(overview?.skills || []).map((skill: { name: string }) => skill.name)}
          selected={focusedSkills} onChange={setFocusedSkills} count={filteredProjects.length}
          onAddSkills={() => setActive("My Portfolio")} />
        <div className="search-filter">
          <div>
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by project name, skill, or business…"
            />
          </div>
          <select
            className="btn btn-white"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            className="btn btn-white"
            onClick={() => {
              setChip("all");
              setCategoryFilter("all");
              setQuery("");
              setFocusedSkills([]);
            }}
          >
            <Filter size={18} /> Reset <span>{chip === "all" && categoryFilter === "all" && !query ? 0 : 1}</span>
          </button>
        </div>
        <div className="filter-chips">
          <button className={chip === "all" ? "active" : ""} onClick={() => setChip("all")}>
            All projects
          </button>
          <button className={chip === "best" ? "active" : ""} onClick={() => setChip("best")}>
            Best matches
          </button>
          <button className={chip === "new" ? "active" : ""} onClick={() => setChip("new")}>
            New today
          </button>
          <button className={chip === "remote" ? "active" : ""} onClick={() => setChip("remote")}>
            Remote
          </button>
          <button className={chip === "saved" ? "active" : ""} onClick={() => setChip("saved")}>
            Saved ({saved.length})
          </button>
        </div>
        <div className="market-layout">
          <div>
            <div className="results-head">
              <b>{filteredProjects.length} opportunities</b>
              <button
                onClick={() =>
                  setSortBy((prev) =>
                    prev === "newest" ? "budget" : prev === "budget" ? "match" : "newest"
                  )
                }
              >
                {sortBy === "newest"
                  ? "Newest first"
                  : sortBy === "budget"
                  ? "Highest budget"
                  : "Best match"}{" "}
                <ChevronDown />
              </button>
            </div>
            <div className="project-grid">
              {filteredProjects.length > 0 ? (
                filteredProjects.map((p) => (
                  <div key={p.id} className="fit-project-wrap"><ProjectCard
                    project={p}
                    onClick={() => setSelected(p)}
                    saved={saved.some((id) => String(id) === String(p.id))}
                    onSave={() => toggleSave(p.id)}
                  />
                  {focusedSkills.length > 0 && <div className="fit-proof"><b>In your focus:</b> {skillOverlap(p.skills, focusedSkills).matched.join(", ") || "None"}.<br/><span>{skillOverlap(p.skills, focusedSkills).missing.length ? `Other requirements: ${skillOverlap(p.skills, focusedSkills).missing.join(", ")}.` : "Every listed skill requirement is in your focus."}</span></div>}
                  </div>
                ))
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "48px 24px",
                    color: "#627d98",
                    background: "white",
                    borderRadius: 12,
                    border: "1px dashed #dce7ed",
                    gridColumn: "1 / -1",
                  }}
                >
                  <p>No project opportunities found.</p>
                </div>
              )}
            </div>
          </div>
          <aside className="insight-card">
            <div className="insight-icon">
              <Award size={20} />
            </div>
            <h3>Make your matches stronger</h3>
            <p>Verify your skills to unlock more high-match opportunities.</p>
            <button onClick={() => setActive("Skill Verification")}>
              Verify a skill <ArrowRight />
            </button>
          </aside>
        </div>
      </main>
    );
  if (active === "My Applications")
    return (
      <Applications
        applications={applications}
        applied={applied}
        projects={marketProjects}
        onSelectProject={(p) => setSelected(p)}
        onBrowse={() => setActive("Explore Projects")}
        onWithdraw={async (appId, projectId) => {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session && !String(appId).startsWith("local-") && !String(appId).startsWith("temp-")) {
              const res = await fetch("/api/applications", {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  application_id: appId,
                  status: "withdrawn",
                }),
              });
              if (!res.ok) {
                const err = await res.json();
                toast(err.error || "Could not withdraw application");
                return;
              }
            }
            setApplications((prev) => prev.filter((a) => a.id !== appId));
            setApplied((prev) => prev.filter((id) => String(id) !== String(projectId)));
            await onRefreshProjects?.();
            toast("Application withdrawn");
          } catch {
            toast("Failed to withdraw application");
          }
        }}
      />
    );
  if (active === "Active Projects")
    return (
      <ActiveProject
        toast={toast}
        contracts={contracts}
        onRefresh={loadTalentData}
        onNavigate={setActive}
      />
    );
  if (active === "Messages") return <Messages toast={toast} />;
  if (active === "My Portfolio")
    return (
      <Portfolio
        toast={toast}
        overview={overview}
        onRefresh={loadTalentData}
        onEditProfile={() => setActive("Settings")}
        onVerifySkill={() => setActive("Skill Verification")}
      />
    );
  if (active === "Skill Verification")
    return (
      <Verification
        toast={toast}
        onRefresh={loadTalentData}
        onOpenPassport={() => setActive("My Portfolio")}
      />
    );
  if (active === "Reviews")
    return (
      <Reviews
        role="talent"
        toast={toast}
        reviews={overview?.reviews || []}
        onRefresh={loadTalentData}
      />
    );
  if (active === "Settings") return <SettingsPage role="talent" toast={toast} />;

  const activeContractsCount = contracts.filter((c) => c.status === "active").length;
  const completedContractsCount = contracts.filter((c) => c.status === "completed").length;
  const reviewsList = overview?.reviews || [];
  const avgRating =
    reviewsList.length > 0
      ? (
          reviewsList.reduce((acc: number, r: any) => acc + Number(r.rating || 0), 0) /
          reviewsList.length
        ).toFixed(1)
      : "0.0";

  return (
    <TalentOverview
      onNavigate={setActive}
      onProject={setSelected}
      projects={marketProjects}
      applicationsCount={applications.length}
      activeContractsCount={activeContractsCount}
      completedContractsCount={completedContractsCount}
      avgRating={avgRating}
      reviewsCount={reviewsList.length}
      skills={overview?.skills || []}
      verifications={overview?.verifications || []}
      portfolioCount={(overview?.portfolio || []).length}
      notifications={overview?.notifications || []}
    />
  );
}

function TalentOverview({
  onNavigate,
  onProject,
  projects = [],
  applicationsCount = 0,
  activeContractsCount = 0,
  completedContractsCount = 0,
  avgRating = "0.0",
  reviewsCount = 0,
  skills = [],
  verifications = [],
  portfolioCount = 0,
  notifications = [],
}: {
  onNavigate: (s: string) => void;
  onProject: (p: Project) => void;
  projects?: Project[];
  applicationsCount?: number;
  activeContractsCount?: number;
  completedContractsCount?: number;
  avgRating?: string;
  reviewsCount?: number;
  skills?: any[];
  verifications?: any[];
  portfolioCount?: number;
  notifications?: any[];
}) {
  const { profile } = useAuth();
  const todayStr = new Date()
    .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    .toUpperCase();

  const verifiedBadges = verifications.filter((v: any) => v.status === "verified");
  const hasSkills = skills.length > 0 || verifiedBadges.length > 0;
  const hasPortfolio = portfolioCount > 0;
  const profileStrength = 25 + (hasSkills ? 35 : 0) + (hasPortfolio ? 40 : 0);

  return (
    <main className="page dashboard-page">
      <div className="welcome-row">
        <div>
          <span>{todayStr}</span>
          <h1>Welcome, {profile?.display_name || "Member"}.</h1>
          <p>Find open projects, verify your skills, and build a clear work record clients can trust.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn btn-white" onClick={() => onNavigate("My Portfolio")}>
            <Award size={18} /> Open Skill Passport
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate("Explore Projects")}>
            Find a project <Search size={18} />
          </button>
        </div>
      </div>
      <div className="stat-grid">
        <Stat
          icon={BriefcaseBusiness}
          tone="blue"
          value={String(applicationsCount)}
          label="Applications"
          delta="total submitted"
        />
        <Stat
          icon={FolderKanban}
          tone="purple"
          value={String(activeContractsCount)}
          label="Active projects"
          delta="in progress"
        />
        <Stat
          icon={CheckCircle2}
          tone="green"
          value={String(completedContractsCount)}
          label="Completed"
          delta="verified delivery"
        />
        <Stat
          icon={Star}
          tone="amber"
          value={avgRating}
          label="Client rating"
          delta={reviewsCount > 0 ? `${reviewsCount} review${reviewsCount === 1 ? "" : "s"}` : "no reviews yet"}
        />
      </div>
      <div className="dashboard-grid">
        <div className="dash-col-main">
          <section className="panel profile-progress">
            <div className="panel-head">
              <div>
                <b>Your Skill Passport progress</b>
                <span>Complete these three steps so clients can trust your profile faster.</span>
              </div>
              <strong>{profileStrength}%</strong>
            </div>
            <div className="progress">
              <i style={{ width: `${profileStrength}%` }}></i>
            </div>
            <div className="check-row">
              <span className="done">
                <Check /> Account created
              </span>
              <span className={hasSkills ? "done" : ""}>
                {hasSkills ? <Check /> : <span className="dot"></span>} Add or verify skills
              </span>
              <span className={hasPortfolio ? "done" : ""}>
                {hasPortfolio ? <Check /> : <span className="dot"></span>} Add a work sample
              </span>
              <button onClick={() => onNavigate("My Portfolio")}>
                Update Passport <ArrowRight />
              </button>
            </div>
          </section>

          <section className="panel recommendations">
            <div className="panel-title">
              <div>
                <b>Open projects for you</b>
                <span>Clear budgets, timelines, and required skills</span>
              </div>
              <button onClick={() => onNavigate("Explore Projects")}>
                View all <ArrowRight />
              </button>
            </div>
            <div className="compact-projects">
              {projects.length > 0 ? (
                projects.slice(0, 3).map((p) => (
                  <div className="compact-project" onClick={() => onProject(p)} key={p.id}>
                    <Avatar initials={p.initials} color={p.color} />
                    <div>
                      <span>{p.company} · {p.duration}</span>
                      <b>{p.title}</b>
                      <div className="tags">
                        {p.skills.slice(0, 3).map((s) => (
                          <i key={s}>{s}</i>
                        ))}
                      </div>
                    </div>
                    <div className="compact-end">
                      <strong>{php(p.budget)}</strong>
                      <Badge tone={p.match >= 50 ? "green" : "blue"}>{p.match}% skill match</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state-box">
                  <b>No open projects right now</b>
                  <p>Check the Explore Projects page for newly approved work.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="dash-col-side">
          <section className="panel skills-panel">
            <div className="panel-title">
              <b>Verified skill badges</b>
              <button onClick={() => onNavigate("Skill Verification")}>Verify skills</button>
            </div>
            {verifiedBadges.length > 0 ? (
              <div className="verified-badge-list">
                {verifiedBadges.slice(0, 4).map((v: any) => (
                  <div className="verified-badge-row" key={v.id}>
                    <div>
                      <ShieldCheck size={20} />
                      <span>{v.skill_name}</span>
                    </div>
                    <Badge tone="green">{v.score}% Verified</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-box">
                <b>No verified badges yet</b>
                <p>Pass a 5-question skill check to earn your first verified badge.</p>
                <button className="btn btn-primary btn-sm" onClick={() => onNavigate("Skill Verification")}>
                  Start skill check
                </button>
              </div>
            )}
          </section>

          <section className="panel activity-panel">
            <div className="panel-title">
              <b>Recent updates</b>
              <button onClick={() => onNavigate("My Applications")}>My applications</button>
            </div>
            {notifications.length > 0 ? (
              <div className="activity-feed-list">
                {notifications.slice(0, 2).map((n: any) => (
                  <div className="activity-feed-item" key={n.id}>
                    <span className={`stat-icon ${n.read_at ? "blue" : "green"}`}>
                      <Bell size={18} />
                    </span>
                    <div>
                      <b>{n.title}</b>
                      <p>{n.body}</p>
                      <small>{formatRelativeTime(n.created_at)}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-box">
                <b>No updates yet</b>
                <p>Apply to a project or take a skill check to see updates here.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Stat({
  icon: Icon,
  tone,
  value,
  label,
  delta,
}: {
  icon: LucideIcon;
  tone: string;
  value: string;
  label: string;
  delta: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>
        <Icon />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{delta}</small>
      </div>
      <MoreHorizontal />
    </div>
  );
}
function ActivityItem({
  icon: Icon,
  text,
  time,
}: {
  icon: LucideIcon;
  text: React.ReactNode;
  time: string;
}) {
  return (
    <div className="activity-item">
      <span>
        <Icon />
      </span>
      <div>
        <p>{text}</p>
        <small>{time}</small>
      </div>
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}

function ProjectDetail({
  project,
  onBack,
  onApply,
  applied,
  saved = false,
  onSave,
  onMessageBusiness,
  readOnly = false,
}: {
  project: Project;
  onBack: () => void;
  onApply?: (proposal: string) => void;
  applied?: boolean;
  saved?: boolean;
  onSave?: () => void;
  onMessageBusiness?: () => void;
  readOnly?: boolean;
}) {
  const [modal, setModal] = useState(false);
  const [proposalText, setProposalText] = useState(
    "Hi! I’m excited about this project because it closely matches my experience. I’d love to help your team create a polished, thoughtful solution."
  );

  const objectivesList =
    project.objectives && project.objectives.length > 0
      ? project.objectives
      : [
          "Create a polished, accessible experience aligned with our brand.",
          "Translate business needs into clear and practical solutions.",
          "Deliver organized source files and simple documentation.",
        ];

  const deliverablesList =
    project.deliverables && project.deliverables.length > 0
      ? project.deliverables
      : [
          "Initial direction and working draft",
          "Two rounds of structured revisions",
          "Final production-ready files and handover",
        ];

  return (
    <main className="page detail-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft /> Back to projects
      </button>
      <div className="detail-layout">
        <div>
          <section className="panel detail-hero">
            <div className="project-top">
              <Avatar initials={project.initials} color={project.color} size="lg" src={project.avatarUrl} />
              <div>
                <span>
                  {project.company} <ShieldCheck className="verified-mini" />
                </span>
                <small>Verified business · Posted {project.posted}</small>
              </div>
            </div>
            <h1>{project.title}</h1>
            <p>{project.description}</p>
            <div className="tags">
              {project.skills.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <div className="detail-stats">
              <div>
                <CircleDollarSign />
                <span>
                  Project budget<b>{php(project.budget)}</b>
                </span>
              </div>
              <div>
                <Clock3 />
                <span>
                  Expected duration<b>{project.duration}</b>
                </span>
              </div>
              <div>
                <Users />
                <span>
                  Applicants<b>{project.applicants} talents</b>
                </span>
              </div>
              <div>
                <Target />
                <span>
                  Your skill match<b className="green">{project.match}% excellent</b>
                </span>
              </div>
            </div>
          </section>
          <section className="panel rich-copy">
            <h2>About this project</h2>
            <p>{project.description}</p>
            <h3>Project objectives</h3>
            <ul>
              {objectivesList.map((obj, idx) => (
                <li key={idx}>{obj}</li>
              ))}
            </ul>
            <h3>Key deliverables</h3>
            <ul>
              {deliverablesList.map((del, idx) => (
                <li key={idx}>{del}</li>
              ))}
            </ul>
          </section>
        </div>
        <aside>
          <div className="panel apply-card">
            <div className="match-circle">
              <strong>{project.match}%</strong>
              <span>skill match</span>
            </div>
            <h3>You’re a great fit</h3>
            <p>Your skills align with the requirements for this project.</p>
            <div className="fit-list">
              {project.skills.slice(0, 3).map((sk) => (
                <span key={sk}>
                  <Check /> {sk} proficiency
                </span>
              ))}
            </div>
            {!readOnly && (
              <>
                <button
                  className="btn btn-primary full btn-lg"
                  disabled={applied}
                  onClick={() => setModal(true)}
                >
                  {applied ? (
                    <>
                      <Check /> Application submitted
                    </>
                  ) : (
                    <>
                      Apply for project <ArrowRight />
                    </>
                  )}
                </button>
                <button className="btn btn-white full" onClick={onSave}>
                  <Heart fill={saved ? "currentColor" : "none"} />{" "}
                  {saved ? "Saved project" : "Save project"}
                </button>
              </>
            )}
            <small>
              {project.deadline
                ? `Application deadline: ${project.deadline}`
                : "Open for applications"}
            </small>
          </div>
          <div className="panel business-card">
            <span>ABOUT THE BUSINESS</span>
            <div>
              <Avatar initials={project.initials} color={project.color} src={project.avatarUrl} />
              <h3>{project.company}</h3>
            </div>
            <p>
              Growing Filipino business creating thoughtful products and services for modern
              communities.
            </p>
            <div>
              <span>
                Category <b>{project.category}</b>
              </span>
              <span>
                Setup <b>{project.workSetup || "Remote"}</b>
              </span>
              <span>
                Status <b>Open</b>
              </span>
            </div>
            {!readOnly && onMessageBusiness && (
              <button
                type="button"
                className="btn btn-white full"
                style={{ marginTop: 14 }}
                onClick={onMessageBusiness}
              >
                <MessageSquare size={15} /> Message {project.company}
              </button>
            )}
          </div>
        </aside>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(false)}>
              <X />
            </button>
            <span className="auth-kicker">PROJECT APPLICATION</span>
            <h2>Tell them why you’re a great fit.</h2>
            <p>
              Apply to <b>{project.title}</b> at {project.company}.
            </p>
            <label>
              Your proposal
              <textarea
                value={proposalText}
                onChange={(e) => setProposalText(e.target.value)}
                placeholder="Share your relevant experience and how you can help..."
              />
            </label>
            <div className="modal-skills">
              <span>Skills included</span>
              <div className="tags">
                {project.skills.map((s) => (
                  <i key={s}>
                    <Check /> {s}
                  </i>
                ))}
              </div>
            </div>
            <button
              className="btn btn-primary full btn-lg"
              onClick={() => {
                onApply?.(proposalText);
                setModal(false);
              }}
            >
              Submit application <Send />
            </button>
            <small className="center">You can review your submission in My Applications.</small>
          </div>
        </div>
      )}
    </main>
  );
}

function Applications({
  applications = [],
  applied,
  projects = [],
  onSelectProject,
  onBrowse,
  onWithdraw,
}: {
  applications?: TalentApplication[];
  applied: (string | number)[];
  projects?: Project[];
  onSelectProject?: (p: Project) => void;
  onBrowse: () => void;
  onWithdraw?: (applicationId: string, projectId: string | number) => void;
}) {
  const [tab, setTab] = useState<"all" | "review" | "shortlisted" | "accepted" | "closed">("all");

  // Merge database applications with any local applied IDs
  const allItems: TalentApplication[] = useMemo(() => {
    const map = new Map<string, TalentApplication>();
    for (const app of applications) {
      map.set(String(app.project_id), app);
    }
    for (const pid of applied) {
      const key = String(pid);
      if (!map.has(key)) {
        const found = projects.find((p) => String(p.id) === key);
        if (found) {
          map.set(key, {
            id: `local-${key}`,
            project_id: key,
            proposal: "",
            status: "submitted",
            proposed_budget: found.budget,
            submitted_at: new Date().toISOString(),
            appliedAgo: "Just now",
            project: found,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [applications, applied, projects]);

  const underReviewCount = allItems.filter((a) => a.status === "submitted").length;
  const shortlistedCount = allItems.filter(
    (a) => a.status === "shortlisted" || a.status === "interview"
  ).length;
  const acceptedCount = allItems.filter((a) => a.status === "accepted").length;
  const closedCount = allItems.filter(
    (a) => a.status === "rejected" || a.status === "withdrawn"
  ).length;

  const filteredItems = allItems.filter((a) => {
    if (tab === "review") return a.status === "submitted";
    if (tab === "shortlisted") return a.status === "shortlisted" || a.status === "interview";
    if (tab === "accepted") return a.status === "accepted";
    if (tab === "closed") return a.status === "rejected" || a.status === "withdrawn";
    return true;
  });

  const getStatusBadge = (status: TalentApplication["status"]) => {
    if (status === "accepted") return <Badge tone="green">Accepted</Badge>;
    if (status === "shortlisted") return <Badge tone="purple">Shortlisted</Badge>;
    if (status === "interview") return <Badge tone="amber">In Review</Badge>;
    if (status === "rejected") return <Badge tone="red">Closed</Badge>;
    return <Badge tone="blue">Submitted</Badge>;
  };

  return (
    <main className="page">
      <PageTitle
        eyebrow="MY APPLICATIONS"
        title="Track every opportunity"
        text="Stay on top of your proposals and next steps."
      />
      <div className="tabs">
        <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
          All <span>{allItems.length}</span>
        </button>
        <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>
          Under review <span>{underReviewCount}</span>
        </button>
        <button
          className={tab === "shortlisted" ? "active" : ""}
          onClick={() => setTab("shortlisted")}
        >
          Shortlisted <span>{shortlistedCount}</span>
        </button>
        <button className={tab === "accepted" ? "active" : ""} onClick={() => setTab("accepted")}>
          Accepted <span>{acceptedCount}</span>
        </button>
        <button className={tab === "closed" ? "active" : ""} onClick={() => setTab("closed")}>
          Closed <span>{closedCount}</span>
        </button>
      </div>
      <div className="panel application-list">
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#627d98" }}>
            <p style={{ marginBottom: 16 }}>
              {allItems.length === 0
                ? "You haven't submitted any applications yet."
                : "No applications in this stage."}
            </p>
            <button className="btn btn-primary" onClick={onBrowse}>
              Browse projects
            </button>
          </div>
        ) : (
          filteredItems.map((item) => {
            const p = item.project;
            return (
              <div
                className="application-row"
                key={item.id}
                onClick={() => onSelectProject?.(p)}
                style={{ cursor: "pointer" }}
              >
                <Avatar initials={p.initials} color={p.color} />
                <div>
                  <span>{p.company}</span>
                  <b>{p.title}</b>
                  <small>
                    Applied {item.appliedAgo} · {php(item.proposed_budget)}
                  </small>
                </div>
                <div className="application-status">
                  {getStatusBadge(item.status)}
                  <span className="timeline-mini">
                    <i className="done"></i>
                    <i
                      className={
                        item.status !== "submitted" ? "done" : "active"
                      }
                    ></i>
                    <i
                      className={
                        item.status === "shortlisted" || item.status === "interview"
                          ? "active"
                          : item.status === "accepted"
                          ? "done"
                          : ""
                      }
                    ></i>
                    <i className={item.status === "accepted" ? "done" : ""}></i>
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {item.status === "submitted" && onWithdraw && (
                    <button
                      type="button"
                      className="btn btn-white"
                      style={{ padding: "6px 10px", fontSize: 12 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onWithdraw(item.id, item.project_id);
                      }}
                    >
                      Withdraw
                    </button>
                  )}
                  <button type="button" onClick={() => onSelectProject?.(p)}>
                    <ChevronRight />
                  </button>
                </div>
              </div>
            );
          })
        )}
        <div className="empty-inline">
          <Search size={18} />
          <div>
            <b>Keep your momentum going</b>
            <span>New opportunities are added by businesses regularly.</span>
          </div>
          <button className="btn btn-white" onClick={onBrowse}>
            Browse projects
          </button>
        </div>
      </div>
    </main>
  );
}

function ActiveProject({
  toast,
  contracts: externalContracts,
  onRefresh,
  onNavigate,
}: {
  toast: (s: string) => void;
  contracts?: any[];
  onRefresh?: () => Promise<void>;
  onNavigate?: (s: string) => void;
}) {
  const { role, profile } = useAuth();
  const [contracts, setContracts] = useState<any[]>(externalContracts || []);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [taskInput, setTaskInput] = useState("");
  const [focusedMilestone, setFocusedMilestone] = useState<string | null>(null);
  const [deliverableModal, setDeliverableModal] = useState(false);
  const [delivTitle, setDelivTitle] = useState("");
  const [delivNotes, setDelivNotes] = useState("");
  const [delivUrl, setDelivUrl] = useState("");

  const loadContracts = async () => {
    const list = await fetchContracts();
    setContracts(list);
    if (list.length > 0 && !selectedContractId) {
      setSelectedContractId(list[0].id);
    }
  };

  useEffect(() => {
    if (externalContracts && externalContracts.length > 0) {
      setContracts(externalContracts);
      if (!selectedContractId) {
        setSelectedContractId(externalContracts[0].id);
      }
    } else {
      loadContracts();
    }
  }, [externalContracts]);

  if (contracts.length === 0) {
    return (
      <main className="page">
        <PageTitle
          eyebrow="ACTIVE PROJECTS"
          title="Project Workspace"
          text="Track delivery milestones, collaborate with team members, and submit deliverables."
        />
        <div className="panel active-empty-card">
          <div className="active-empty-icon">
            <FolderKanban size={32} />
          </div>
          <h3>No active projects right now</h3>
          <p>
            Once a proposal is accepted and a contract is formed, delivery milestones, tasks, and
            submission review workflows will appear here automatically.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                onNavigate?.(role === "business" ? "Applications" : "Explore Projects")
              }
            >
              {role === "business" ? "Review applicants" : "Explore projects"}{" "}
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="btn btn-white"
              onClick={() =>
                onNavigate?.(role === "business" ? "Post a Project" : "My Applications")
              }
            >
              {role === "business" ? "Post a new project" : "View my applications"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const activeContract =
    contracts.find((c) => c.id === selectedContractId) || contracts[0];
  const proj = activeContract.project || {};
  const milestones = activeContract.milestones || [];
  const activeMilestone = milestones.find((m: { id: string }) => m.id === focusedMilestone);
  const focusedTasks = activeMilestone ? activeMilestone.tasks || [] : null;
  const allTasks = milestones.flatMap((m: any) => m.tasks || []);
  const deliverables = activeContract.deliverables || [];
  const doneTasksCount = allTasks.filter((t: any) => t.is_done).length;
  const progressPct =
    allTasks.length > 0
      ? Math.round((doneTasksCount / allTasks.length) * 100)
      : activeContract.status === "completed"
      ? 100
      : 0;

  const businessName = proj.business?.name || (role === "business" ? profile?.display_name : "Business Partner") || "Business";
  const talentName = activeContract.talent?.display_name || (role === "talent" ? profile?.display_name : "Assigned Talent") || "Talent";
  const agreedAmount = Number(activeContract.agreed_amount || 0);

  const callContractAction = async (payload: any) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return false;
    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ contract_id: activeContract.id, ...payload }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast(err.error || "Action failed");
      return false;
    }
    await loadContracts();
    await onRefresh?.();
    return true;
  };

  return (
    <main className="page">
      <PageTitle
        eyebrow="ACTIVE PROJECT WORKSPACE"
        title={proj.title || "Project Workspace"}
        text={`Collaborating with ${
          role === "business" ? talentName : businessName
        } · Agreed escrow budget: ${php(agreedAmount)}`}
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-white"
              onClick={() => onNavigate?.("Messages")}
            >
              <MessageSquare size={16} /> Open messages
            </button>
            {role === "talent" && activeContract.status === "active" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setDeliverableModal(true)}
              >
                <Upload size={16} /> Submit deliverable
              </button>
            )}
            {role === "business" && activeContract.status === "active" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  const ok = await callContractAction({ action: "complete_contract" });
                  if (ok) toast("Project marked as completed & escrow released!");
                }}
              >
                <CheckCircle2 size={16} /> Complete project
              </button>
            )}
          </div>
        }
      />

      {contracts.length > 1 && (
        <div className="filter-chips" style={{ marginBottom: 18 }}>
          {contracts.map((c) => (
            <button
              key={c.id}
              type="button"
              className={c.id === activeContract.id ? "active" : ""}
              onClick={() => { setSelectedContractId(c.id); setFocusedMilestone(null); }}
            >
              {c.project?.title || "Contract"} ({c.status === "completed" ? "Completed" : "Active"})
            </button>
          ))}
        </div>
      )}

      <DeliveryTrail milestones={milestones} selected={activeMilestone?.id || null}
        onSelect={setFocusedMilestone} deliverables={deliverables} />
      <div className="workspace-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <section className="panel" style={{ padding: 24 }}>
            <div className="panel-title" style={{ marginBottom: 14 }}>
              <div>
                <b>{activeMilestone ? activeMilestone.title : "Delivery Milestones & Task Checklist"}</b>
                <span>
                  {doneTasksCount} of {allTasks.length} tasks completed
                </span>
              </div>
              <Badge tone={activeContract.status === "completed" ? "green" : "blue"}>
                {activeContract.status === "completed" ? "Completed" : "In Progress"}
              </Badge>
            </div>

            <div className="workspace-progress">
              <div>
                <span>Overall delivery progress</span>
                <strong>{progressPct}%</strong>
              </div>
              <div className="progress">
                <i style={{ width: `${progressPct}%` }}></i>
              </div>
              <small>
                Check off tasks as you complete each step of the project brief.
              </small>
            </div>

            <div>
              {(focusedTasks || allTasks).length === 0 ? (
                <div
                  style={{
                    padding: "24px 16px",
                    textAlign: "center",
                    color: "#627d98",
                    background: "#f8fafc",
                    borderRadius: 11,
                    border: "1px dashed #dce7ed",
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  No checklist tasks yet. Add your first delivery task below.
                </div>
              ) : (
                (focusedTasks || allTasks).map((t: any, idx: number) => (
                  <div
                    className={`milestone ${t.is_done ? "done" : ""}`}
                    key={t.id}
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        await callContractAction({
                          action: "toggle_task",
                          task_id: t.id,
                          is_done: !t.is_done,
                        });
                      }}
                      aria-label={t.is_done ? "Mark incomplete" : "Mark complete"}
                    >
                      {t.is_done ? <Check size={15} /> : idx + 1}
                    </button>
                    <div>
                      <b
                        style={{
                          textDecoration: t.is_done ? "line-through" : "none",
                          color: t.is_done ? "#829ab1" : "#102a43",
                        }}
                      >
                        {t.title}
                      </b>
                      <span>{t.is_done ? "Completed" : "In progress"}</span>
                    </div>
                    <Badge tone={t.is_done ? "green" : "amber"}>
                      {t.is_done ? "Done" : "Pending"}
                    </Badge>
                  </div>
                ))
              )}
            </div>

            <form
              style={{ display: "flex", gap: 10, marginTop: 16 }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!taskInput.trim()) return;
                const ok = await callContractAction({
                  action: "add_task",
                  milestone_id: activeMilestone?.id,
                  title: taskInput.trim(),
                });
                if (ok) {
                  setTaskInput("");
                  toast("Task added to checklist");
                }
              }}
            >
              <input
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="Add a delivery milestone or task…"
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1px solid #d9e5eb",
                  fontSize: 13,
                  color: "#102a43",
                }}
              />
              <button type="submit" className="btn btn-white">
                <Plus size={16} /> Add task
              </button>
            </form>
          </section>

          <section className="panel" style={{ padding: 24 }}>
            <div className="panel-title" style={{ marginBottom: 14 }}>
              <div>
                <b>Submitted Deliverables & Files</b>
                <span>Work links, prototypes, and handover notes</span>
              </div>
              {role === "talent" && activeContract.status === "active" && (
                <button type="button" onClick={() => setDeliverableModal(true)}>
                  Submit work <Plus size={14} />
                </button>
              )}
            </div>

            {deliverables.length === 0 ? (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "#627d98",
                  background: "#f8fafc",
                  borderRadius: 12,
                  border: "1px dashed #dce7ed",
                  fontSize: 13,
                }}
              >
                No deliverables submitted yet.{" "}
                {role === "talent"
                  ? "Click 'Submit deliverable' to share work links or prototypes."
                  : "Submitted deliverables from your talent collaborator will appear here."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {deliverables.map((d: any) => (
                  <div
                    key={d.id}
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      border: "1px solid #dce7ed",
                      background: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <b style={{ color: "#102a43", fontSize: 14 }}>{d.title}</b>
                      <Badge tone="green">{d.status || "Submitted"}</Badge>
                    </div>
                    {d.notes && (
                      <p style={{ fontSize: 13, color: "#486581", marginBottom: 8, lineHeight: 1.5 }}>
                        {d.notes}
                      </p>
                    )}
                    {d.external_url && (
                      <a
                        href={d.external_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#162660",
                        }}
                      >
                        Open deliverable link <ArrowRight size={13} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside>
          <div className="panel project-people" style={{ padding: 20 }}>
            <b>Project Collaborators</b>
            <div>
              <Avatar
                initials={getInitials(businessName)}
                color={proj.business?.avatar_color || "#162660"}
              />
              <span>
                <b>{businessName}</b>
                <small>Client · Business Partner</small>
              </span>
            </div>
            <div>
              <Avatar
                initials={getInitials(talentName)}
                color={activeContract.talent?.avatar_color || "#16A34A"}
              />
              <span>
                <b>{talentName}</b>
                <small>Assigned Talent</small>
              </span>
            </div>
            <button
              type="button"
              className="btn btn-white full"
              style={{ marginTop: 8 }}
              onClick={() => onNavigate?.("Messages")}
            >
              <MessageSquare size={15} /> Message collaborator
            </button>
          </div>

          <div className="panel deliverable" style={{ padding: 20 }}>
            <b>Contract & Escrow Summary</b>
            <span>{php(agreedAmount)}</span>
            <small style={{ color: activeContract.status === "completed" ? "#16a34a" : "#162660" }}>
              {activeContract.status === "completed"
                ? "Escrow released · Contract completed"
                : "Protected in GAWA Escrow"}
            </small>
            {role === "talent" && activeContract.status === "active" && (
              <button
                type="button"
                className="btn btn-primary full"
                onClick={() => setDeliverableModal(true)}
              >
                <Upload size={15} /> Submit deliverable
              </button>
            )}
            {role === "business" && activeContract.status === "active" && (
              <button
                type="button"
                className="btn btn-primary full"
                onClick={async () => {
                  const ok = await callContractAction({ action: "complete_contract" });
                  if (ok) toast("Project marked as completed!");
                }}
              >
                <CheckCircle2 size={15} /> Approve & release escrow
              </button>
            )}
          </div>
        </aside>
      </div>

      {deliverableModal && (
        <div className="gawa-modal-backdrop" onClick={() => setDeliverableModal(false)}>
          <div className="gawa-modal-card" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div>
                <span className="auth-kicker">PROJECT DELIVERY</span>
                <h2 style={{ fontSize: 19, margin: "4px 0 0" }}>Submit a deliverable</h2>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setDeliverableModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              Deliverable title
              <input
                value={delivTitle}
                onChange={(e) => setDelivTitle(e.target.value)}
                placeholder="e.g. High-fidelity Figma prototype"
                style={{
                  border: "1px solid #d9e5eb",
                  borderRadius: 9,
                  padding: "10px 12px",
                  fontSize: 13,
                }}
              />
            </label>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              Notes / summary
              <textarea
                value={delivNotes}
                onChange={(e) => setDelivNotes(e.target.value)}
                placeholder="Describe what is included in this submission…"
                style={{
                  border: "1px solid #d9e5eb",
                  borderRadius: 9,
                  padding: "10px 12px",
                  fontSize: 13,
                  height: 90,
                  resize: "none",
                }}
              />
            </label>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              Link to work (optional)
              <input
                value={delivUrl}
                onChange={(e) => setDelivUrl(e.target.value)}
                placeholder="https://..."
                style={{
                  border: "1px solid #d9e5eb",
                  borderRadius: 9,
                  padding: "10px 12px",
                  fontSize: 13,
                }}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn btn-white"
                onClick={() => setDeliverableModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  if (!delivTitle.trim()) {
                    toast("Please provide a deliverable title");
                    return;
                  }
                  const ok = await callContractAction({
                    action: "submit_deliverable",
                    title: delivTitle,
                    notes: delivNotes,
                    external_url: delivUrl,
                  });
                  if (ok) {
                    setDelivTitle("");
                    setDelivNotes("");
                    setDelivUrl("");
                    setDeliverableModal(false);
                    toast("Deliverable submitted!");
                  }
                }}
              >
                Submit deliverable <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Messages({ toast }: { toast?: (s: string) => void }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [text, setText] = useState("");
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [starting, setStarting] = useState(false);

  const loadConvs = async (preferConvId?: string) => {
    const data = await fetchMessagesData();
    setConversations(data.conversations);
    setContacts(data.contacts);
    if (preferConvId) {
      setSelectedId(preferConvId);
    } else if (data.conversations.length > 0 && !selectedId) {
      setSelectedId(data.conversations[0].id);
    }
  };

  useEffect(() => {
    loadConvs();
  }, []);

  const filteredConvs = conversations.filter((c) =>
    `${c.other_name} ${c.subject} ${c.last_message}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const filteredContacts = contacts.filter((c) =>
    `${c.name} ${c.role}`.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const activeConv = conversations.find((c) => c.id === selectedId) || null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeConv) return;
    const messageBody = text.trim();
    setText("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "send",
          conversation_id: activeConv.id,
          message: messageBody,
        }),
      });
      if (!res.ok) {
        toast?.("Failed to send message");
        return;
      }
      await loadConvs(activeConv.id);
    } catch {
      toast?.("Failed to send message");
    }
  };

  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId) {
      toast?.("Please choose a collaborator to message");
      return;
    }
    if (!newMessage.trim()) {
      toast?.("Please write a message");
      return;
    }

    setStarting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "start",
          recipient_id: recipientId,
          subject: newSubject.trim() || "Project Collaboration",
          message: newMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast?.(data.error || "Failed to start conversation");
        setStarting(false);
        return;
      }

      setNewModalOpen(false);
      setRecipientId("");
      setNewSubject("");
      setNewMessage("");
      await loadConvs(data.conversation_id);
      toast?.("Message sent");
    } catch {
      toast?.("Failed to start conversation");
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="messages-page">
      <div className="conversation-list">
        <div className="messages-head">
          <h2>Messages</h2>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: "7px 11px", fontSize: 12 }}
            onClick={() => setNewModalOpen(true)}
            title="Start a new message"
          >
            <Plus size={15} /> New
          </button>
        </div>
        <div className="conversation-search">
          <Search />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations…"
          />
        </div>
        {filteredConvs.length === 0 ? (
          <div
            style={{
              padding: "36px 16px",
              textAlign: "center",
              color: "#627d98",
              fontSize: 13,
            }}
          >
            <p style={{ marginBottom: 12 }}>
              No active conversations yet. Start a direct chat with any business or talent.
            </p>
            <button
              type="button"
              className="btn btn-white"
              style={{ fontSize: 12, padding: "7px 12px" }}
              onClick={() => setNewModalOpen(true)}
            >
              <PenLine size={14} /> New message
            </button>
          </div>
        ) : (
          filteredConvs.map((c) => (
            <button
              className={`conversation ${c.id === selectedId ? "active" : ""}`}
              key={c.id}
              onClick={() => setSelectedId(c.id)}
            >
              <Avatar
                initials={getInitials(c.other_name)}
                color={c.other_color}
                src={c.other_avatar}
                size="sm"
              />
              <div>
                <b>{c.other_name}</b>
                <span>{c.subject}</span>
                <p>{c.last_message}</p>
              </div>
              <small>{formatRelativeTime(c.updated_at)}</small>
            </button>
          ))
        )}
      </div>
      <div className="chat">
        {activeConv ? (
          <>
            <header>
              <Avatar
                initials={getInitials(activeConv.other_name)}
                color={activeConv.other_color}
                src={activeConv.other_avatar}
              />
              <div>
                <b>{activeConv.other_name}</b>
                <span>
                  <i></i> {activeConv.subject}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-white"
                style={{ padding: "7px 11px", fontSize: 12 }}
                onClick={() => loadConvs(activeConv.id)}
              >
                Refresh
              </button>
            </header>
            <div className="chat-body">
              <div className="date-separator">Direct Conversation · {activeConv.subject}</div>
              {(activeConv.messages || []).map((m: any) => (
                <div className={`bubble-row ${m.mine ? "mine" : ""}`} key={m.id}>
                  {!m.mine && (
                    <Avatar
                      initials={getInitials(activeConv.other_name)}
                      color={activeConv.other_color}
                      src={activeConv.other_avatar}
                      size="sm"
                    />
                  )}
                  <div className="bubble">
                    {m.body}
                    <small>{formatRelativeTime(m.created_at)}</small>
                  </div>
                </div>
              ))}
            </div>
            <form className="composer" onSubmit={handleSend}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Message ${activeConv.other_name}…`}
              />
              <button className="send" type="submit" aria-label="Send message">
                <Send />
              </button>
            </form>
          </>
        ) : (
          <div
            style={{
              display: "grid",
              placeItems: "center",
              height: "100%",
              color: "#627d98",
              textAlign: "center",
              padding: 24,
            }}
          >
            <div style={{ maxWidth: 360 }}>
              <MessageSquare size={42} style={{ margin: "0 auto 14px", color: "#162660" }} />
              <h3 style={{ color: "#102a43", fontSize: 18, marginBottom: 8 }}>
                Your GAWA Inbox
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
                Collaborate directly with businesses and talents, ask questions about projects, or follow up on proposals.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setNewModalOpen(true)}
              >
                <Plus size={16} /> Start a conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {newModalOpen && (
        <div className="gawa-modal-backdrop" onClick={() => setNewModalOpen(false)}>
          <form
            className="gawa-modal-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleStartConversation}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <div>
                <span className="auth-kicker">DIRECT MESSAGE</span>
                <h2 style={{ fontSize: 19, margin: "4px 0 0" }}>Start a new conversation</h2>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setNewModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              1. Choose recipient ({filteredContacts.length} available)
            </label>
            <div className="conversation-search" style={{ margin: "0 0 8px" }}>
              <Search />
              <input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Filter by name or role (business / talent)…"
              />
            </div>
            <div className="contact-Directory-list">
              {filteredContacts.length === 0 ? (
                <div style={{ padding: 18, textAlign: "center", fontSize: 12, color: "#627d98" }}>
                  No matching members found.
                </div>
              ) : (
                filteredContacts.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className={`contact-option ${recipientId === c.id ? "selected" : ""}`}
                    onClick={() => setRecipientId(c.id)}
                  >
                    <Avatar
                      initials={getInitials(c.name)}
                      color={c.avatar_color}
                      src={c.avatar_path}
                      size="sm"
                    />
                    <div>
                      <b>{c.name}</b>
                      <small>{c.role} account</small>
                    </div>
                    {recipientId === c.id && <Check size={16} color="#162660" />}
                  </button>
                ))
              )}
            </div>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              2. Subject / Topic
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="e.g. Project Collaboration / Proposal Follow-up"
                style={{
                  border: "1px solid #d9e5eb",
                  borderRadius: 9,
                  padding: "10px 12px",
                  fontSize: 13,
                }}
              />
            </label>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              3. Message
              <textarea
                required
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Write your message here…"
                style={{
                  border: "1px solid #d9e5eb",
                  borderRadius: 9,
                  padding: "10px 12px",
                  fontSize: 13,
                  height: 90,
                  resize: "none",
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn btn-white"
                onClick={() => setNewModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={starting}
                className="btn btn-primary"
              >
                {starting ? "Sending…" : "Send message"} <Send size={15} />
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function Portfolio({
  toast,
  overview,
  onRefresh,
  onEditProfile,
  onVerifySkill,
}: {
  toast: (s: string) => void;
  overview?: any;
  onRefresh?: () => Promise<void>;
  onEditProfile?: () => void;
  onVerifySkill?: () => void;
}) {
  const { profile, refreshProfile } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [workTitle, setWorkTitle] = useState("");
  const [workDesc, setWorkDesc] = useState("");
  const [workUrl, setWorkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState<"avatar" | "banner" | null>(null);
  const [selectedSkillToAdd, setSelectedSkillToAdd] = useState("");
  const [selectedProficiency, setSelectedProficiency] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [savingSkill, setSavingSkill] = useState(false);

  const displayName = profile?.display_name || "My Skill Passport";
  const initials = getInitials(displayName);
  const portfolioItems = overview?.portfolio || [];
  const allVerifications = overview?.verifications || [];
  const verifiedSkills = allVerifications.filter((v: any) => v.status === "verified" && (!v.expires_at || Date.parse(v.expires_at) > Date.now()));
  const talentSkills = overview?.skills || [];
  const catalogSkills = overview?.catalogSkills || [];
  const completedContracts = overview?.completedContracts || [];
  const talentProfile = overview?.talentProfile || null;
  const reviews = overview?.reviews || [];
  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) /
          reviews.length
        ).toFixed(1)
      : "0.0";

  const availableSkillsToAdd = catalogSkills.filter(
    (cs: any) => !talentSkills.some((ts: any) => String(ts.id) === String(cs.id))
  );

  const handleMediaChange = async (file: File | undefined, kind: "avatar" | "banner") => {
    if (!file) return;
    setUploadingMedia(kind);
    const res = await uploadProfileMediaFile(file, kind);
    setUploadingMedia(null);
    if (!res.ok) {
      toast(res.error || `Failed to upload ${kind}`);
      return;
    }
    await refreshProfile();
    toast(kind === "avatar" ? "Profile picture updated!" : "Profile banner updated!");
  };

  const handleAddSkill = async () => {
    const skillName = selectedSkillToAdd || availableSkillsToAdd[0]?.name;
    if (!skillName) {
      toast("Choose a skill to add first");
      return;
    }
    setSavingSkill(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/overview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "add_talent_skill",
          skill_name: skillName,
          proficiency: selectedProficiency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Could not add skill");
        return;
      }
      setSelectedSkillToAdd("");
      await onRefresh?.();
      toast(`${skillName} added to your Skill Passport`);
    } catch {
      toast("Could not add skill");
    } finally {
      setSavingSkill(false);
    }
  };

  const handleRemoveSkill = async (skillId: string, skillName: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/overview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "remove_talent_skill",
          skill_id: skillId,
        }),
      });
      if (res.ok) {
        await onRefresh?.();
        toast(`Removed ${skillName}`);
      }
    } catch {
      toast("Could not remove skill");
    }
  };

  const handleAddWork = async () => {
    if (!workTitle.trim()) {
      toast("Please enter a project title");
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/overview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "add_portfolio_item",
          title: workTitle.trim(),
          description: workDesc.trim(),
          external_url: workUrl.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error || "Failed to add portfolio item");
        setSubmitting(false);
        return;
      }
      setWorkTitle("");
      setWorkDesc("");
      setWorkUrl("");
      setModalOpen(false);
      await onRefresh?.();
      toast("Work sample saved to your Skill Passport");
    } catch {
      toast("Failed to add portfolio item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWork = async (itemId: string) => {
    if (!confirm("Are you sure you want to remove this work sample?")) return;
    const res = await deletePortfolioItem(itemId);
    if (res.success) {
      toast("Work sample removed");
      await onRefresh?.();
    } else {
      toast(res.error || "Failed to remove work sample");
    }
  };

  return (
    <main className="page">
      <PageTitle
        eyebrow="PORTFOLIO & SKILL PASSPORT"
        title="Your Skill Passport & Proof of Work"
        text="A clear record of your verified skills, completed projects, work samples, and client feedback."
        action={
          <div className="welcome-actions">
            <button
              className="btn btn-white"
              onClick={() => (onVerifySkill ? onVerifySkill() : toast("Open Skill Verification"))}
            >
              <ShieldCheck size={18} /> Verify a skill
            </button>
            <button
              className="btn btn-primary"
              onClick={() => (onEditProfile ? onEditProfile() : toast("Navigate to Settings to edit profile"))}
            >
              <PenLine size={18} /> Edit profile
            </button>
          </div>
        }
      />

      <section className="panel portfolio-hero">
        <div
          className="portfolio-cover"
          style={
            profile?.banner_path
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(7,59,87,0.18), rgba(7,59,87,0.45)), url(${profile.banner_path})`,
                }
              : undefined
          }
        >
          <div className="banner-actions-bar">
            <label className="banner-upload-btn">
              <ImageIcon />
              <span>{uploadingMedia === "banner" ? "Uploading…" : "Change cover photo"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={(e) => handleMediaChange(e.target.files?.[0], "banner")}
              />
            </label>
          </div>
        </div>
        <div className="portfolio-profile">
          <div className="avatar-upload-wrap">
            <Avatar
              initials={initials || "ME"}
              size="lg"
              src={profile?.avatar_path}
              color={profile?.avatar_color}
            />
            <label className="avatar-edit-trigger" title="Change profile photo">
              <Camera />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={(e) => handleMediaChange(e.target.files?.[0], "avatar")}
              />
            </label>
          </div>
          <div>
            <h2>{displayName}</h2>
            <b>{talentProfile?.headline || profile?.bio || "Tell clients what kind of work you do best."}</b>
            <span>
              <GraduationCap /> {talentProfile?.school ? `${talentProfile.school}${talentProfile.course ? ` · ${talentProfile.course}` : ""}` : profile?.location || "Philippines"}
            </span>
          </div>
          <div>
            <strong>
              {avgRating} <Star fill="currentColor" />
            </strong>
            <span>{reviews.length} client review{reviews.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      </section>

      <SkillPassport name={displayName} skills={talentSkills} verifications={allVerifications}
        work={portfolioItems} completed={completedContracts} reviews={reviews}
        onVerify={onVerifySkill} onAddWork={() => setModalOpen(true)} />

      <div className="portfolio-grid">
        <section className="panel rich-copy">
          <div className="panel-title">
            <div>
              <b>Verified badges & skills</b>
              <span>Verified badges come from passed assessments; listed skills are self-declared.</span>
            </div>
            {onVerifySkill && (
              <button onClick={onVerifySkill}>
                Take assessment <ArrowRight />
              </button>
            )}
          </div>

          <h3>Verified Skill Badges</h3>
          {verifiedSkills.length > 0 ? (
            <div className="verified-badge-list" style={{ marginBottom: 20 }}>
              {verifiedSkills.map((v: any) => (
                <div className="verified-badge-row" key={v.id}>
                  <div>
                    <ShieldCheck size={18} />
                    <div>
                      <b>{v.skill_name}</b>
                      <small style={{ display: "block", color: "#597285", fontSize: 12 }}>
                        Passed on {v.submitted_at ? new Date(v.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent"}
                      </small>
                    </div>
                  </div>
                  <Badge tone="green">{v.score}% Verified</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-box" style={{ marginBottom: 20 }}>
              <b>No verified badges yet</b>
              <p>Pass a 5-question skill assessment to earn your first verified badge.</p>
              {onVerifySkill && (
                <button className="btn btn-primary" onClick={onVerifySkill}>
                  Start a skill check
                </button>
              )}
            </div>
          )}

          <h3>My Listed Skills</h3>
          {talentSkills.length > 0 ? (
            <div className="passport-skill-chips">
              {talentSkills.map((ts: any) => (
                <span key={ts.id || ts.name} className="passport-skill-chip">
                  <b>{ts.name}</b>
                  <small>{ts.proficiency}</small>
                  {ts.id && (
                    <button
                      type="button"
                      title={`Remove ${ts.name}`}
                      onClick={() => handleRemoveSkill(ts.id, ts.name)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ marginBottom: 14 }}>No self-reported skills added yet.</p>
          )}

          {availableSkillsToAdd.length > 0 && (
            <div className="add-skill-bar">
              <select
                value={selectedSkillToAdd}
                onChange={(e) => setSelectedSkillToAdd(e.target.value)}
                aria-label="Choose a skill to add"
              >
                <option value="">Choose a skill to add…</option>
                {availableSkillsToAdd.map((cs: any) => (
                  <option key={cs.id} value={cs.name}>
                    {cs.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedProficiency}
                onChange={(e) => setSelectedProficiency(e.target.value as any)}
                aria-label="Skill level"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingSkill || !selectedSkillToAdd}
                onClick={handleAddSkill}
              >
                <Plus size={16} /> {savingSkill ? "Adding..." : "Add skill"}
              </button>
            </div>
          )}

          <h3 style={{ marginTop: 24 }}>About Me</h3>
          <p>
            {profile?.bio ||
              "Write a short introduction in Settings so clients understand your experience and strengths."}
          </p>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <b>Proof of work & portfolio samples</b>
              <span>Attach real examples of projects or outputs you have created.</span>
            </div>
            <button onClick={() => setModalOpen(true)}>
              Add work sample <Plus />
            </button>
          </div>
          {portfolioItems.length === 0 ? (
            <div className="empty-state-box">
              <b>No work samples added yet</b>
              <p>Add a project title, brief description, or link to show clients what you can deliver.</p>
              <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                <Plus size={17} /> Add your first work sample
              </button>
            </div>
          ) : (
            <div className="portfolio-samples-list">
              {portfolioItems.map((item: any) => (
                <div className="portfolio-sample-card" key={item.id}>
                  <div className="portfolio-sample-head">
                    <b>{item.title}</b>
                    <button
                      onClick={() => handleDeleteWork(item.id)}
                      title="Remove work sample"
                      className="icon-danger-btn"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  {item.description && <p>{item.description}</p>}
                  {item.external_url && (
                    <a href={item.external_url} target="_blank" rel="noreferrer">
                      Open project link <ArrowRight size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="panel-title" style={{ marginTop: 28 }}>
            <div>
              <b>Completed GAWA projects</b>
              <span>Verified collaborations finished on the platform</span>
            </div>
          </div>
          {completedContracts.length > 0 ? (
            <div className="portfolio-samples-list">
              {completedContracts.map((c: any) => (
                <div className="portfolio-sample-card" key={c.id}>
                  <div className="portfolio-sample-head">
                    <b>{c.title}</b>
                    <Badge tone="green">Completed</Badge>
                  </div>
                  <p>
                    Client: {c.company} · Budget: {php(c.agreed_amount)} · {c.duration}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-box">
              <p>Completed platform projects will appear here automatically once approved by a client.</p>
            </div>
          )}

          {reviews.length > 0 && (
            <>
              <div className="panel-title" style={{ marginTop: 28 }}>
                <div>
                  <b>Client reputation & feedback</b>
                  <span>Published reviews from completed collaborations</span>
                </div>
              </div>
              <div className="portfolio-samples-list">
                {reviews.slice(0, 3).map((r: any) => (
                  <div className="portfolio-sample-card" key={r.id}>
                    <div className="portfolio-sample-head">
                      <b>{r.reviewer_name} · {r.project_title}</b>
                      <Badge tone="amber">{r.rating} / 5 Stars</Badge>
                    </div>
                    {r.feedback && <p>&ldquo;{r.feedback}&rdquo;</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <button className="modal-close" onClick={() => setModalOpen(false)}>
              <X />
            </button>
            <span className="auth-kicker">PROOF OF WORK</span>
            <h2>Add work sample</h2>
            <label>
              Project or output title
              <input
                value={workTitle}
                onChange={(e) => setWorkTitle(e.target.value)}
                placeholder="e.g. Barangay Harvest Tracker Web App"
              />
            </label>
            <label>
              What did you build or deliver?
              <textarea
                value={workDesc}
                onChange={(e) => setWorkDesc(e.target.value)}
                placeholder="Describe what the client needed, what you did, and the result…"
              />
            </label>
            <label>
              Project link (optional)
              <input
                value={workUrl}
                onChange={(e) => setWorkUrl(e.target.value)}
                placeholder="https://..."
              />
            </label>
            <button
              className="btn btn-primary full btn-lg"
              disabled={submitting}
              onClick={handleAddWork}
            >
              {submitting ? "Saving..." : "Save to Skill Passport"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Verification({
  toast,
  onRefresh,
  onOpenPassport,
}: {
  toast: (s: string) => void;
  onRefresh?: () => Promise<void>;
  onOpenPassport?: () => void;
}) {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAssessment, setActiveAssessment] = useState<any | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    title: string;
    skill: string;
    score: number;
    isVerified: boolean;
    passingScore: number;
  } | null>(null);

  const loadAssessments = async () => {
    setLoading(true);
    const list = await fetchSkillAssessments();
    setAssessments(list);
    setLoading(false);
  };

  useEffect(() => {
    loadAssessments();
  }, []);

  const startAssessment = (assessment: any) => {
    if (!assessment.questions || assessment.questions.length === 0) {
      toast("This assessment does not have active questions yet.");
      return;
    }
    setActiveAssessment(assessment);
    setQIndex(0);
    setAnswersMap({});
    setLastResult(null);
  };

  const handleSubmitAssessment = async () => {
    if (!activeAssessment) return;
    setSubmitting(true);
    try {
      const res = await submitSkillAssessment(activeAssessment.id, answersMap);
      if (!res.success) {
        toast(res.error || "Could not submit assessment");
        return;
      }
      const score = Number(res.score ?? 0);
      const isVerified = Boolean(res.isVerified);
      setLastResult({
        title: activeAssessment.title,
        skill: activeAssessment.skill?.name || activeAssessment.title,
        score,
        isVerified,
        passingScore: Number(activeAssessment.passing_score || 80),
      });
      setActiveAssessment(null);
      await Promise.all([loadAssessments(), onRefresh?.()]);
      toast(
        isVerified
          ? `Passed! Earned verified badge (${score}%)`
          : `Score: ${score}%. Reach ${activeAssessment.passing_score || 80}% to pass.`
      );
    } catch {
      toast("Could not submit assessment");
    } finally {
      setSubmitting(false);
    }
  };

  const currentQuestion = activeAssessment?.questions?.[qIndex];
  const currentOptions: string[] = Array.isArray(currentQuestion?.options)
    ? currentQuestion.options
    : [];
  const selectedAnswerForCurrent = currentQuestion ? answersMap[currentQuestion.id] : undefined;

  return (
    <main className="page">
      <PageTitle
        eyebrow="SKILL ASSESSMENT & VERIFICATION"
        title="Verify your skills and earn badges"
        text="Answer 5 practical questions per skill. Score 80% or higher to earn a verified badge on your Skill Passport."
        action={
          onOpenPassport && (
            <button className="btn btn-white" onClick={onOpenPassport}>
              <Award size={18} /> View my Skill Passport
            </button>
          )
        }
      />

      {loading ? (
        <div className="panel" style={{ padding: 48, textAlign: "center", color: "#597285" }}>
          Loading skill assessments…
        </div>
      ) : assessments.length === 0 ? (
        <div className="panel empty-state-box">
          <b>No active skill assessments available right now</b>
          <p>Please check back shortly or contact your administrator.</p>
        </div>
      ) : (
        <div className="verification-grid">
          {assessments.map((a) => {
            const sub = a.submission;
            const isVerified = sub?.status === "verified";
            const wasAttempted = Boolean(sub);
            const score = Number(sub?.score ?? 0);
            const skillName = a.skill?.name || a.title;
            const tone = isVerified ? "green" : wasAttempted ? "amber" : "blue";

            return (
              <div className="panel verification-card" key={a.id}>
                <div className={`verify-icon ${tone}`}>
                  <ShieldCheck />
                </div>
                <Badge tone={tone}>
                  {isVerified ? "Verified Badge" : wasAttempted ? "Needs Retake" : "Ready to Take"}
                </Badge>
                <h3>{skillName}</h3>
                <span>{a.title}</span>
                {a.description && <p>{a.description}</p>}
                <div className="verify-meta-line">
                  <span>{a.questions?.length || a.question_count} questions</span>
                  <span>·</span>
                  <span>{a.duration_minutes} mins</span>
                  <span>·</span>
                  <span>Pass: {Number(a.passing_score || 80)}%</span>
                </div>
                {isVerified ? (
                  <>
                    <div className="score">
                      <strong>{score}%</strong>
                      <small>Verified score</small>
                    </div>
                    <button
                      className="btn btn-white full"
                      onClick={() => startAssessment(a)}
                    >
                      Retake assessment
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary full"
                    onClick={() => startAssessment(a)}
                  >
                    {wasAttempted ? `Retake (Last score: ${score}%)` : "Start assessment"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeAssessment && currentQuestion && (
        <div className="modal-backdrop">
          <div className="modal modal-wide">
            <button className="modal-close" onClick={() => setActiveAssessment(null)}>
              <X />
            </button>
            <span className="auth-kicker">
              {(activeAssessment.skill?.name || activeAssessment.title).toUpperCase()} · QUESTION {qIndex + 1} OF{" "}
              {activeAssessment.questions.length}
            </span>
            <div className="progress" style={{ margin: "10px 0 18px" }}>
              <i
                style={{
                  width: `${Math.round(((qIndex + 1) / activeAssessment.questions.length) * 100)}%`,
                }}
              ></i>
            </div>
            <h2>{currentQuestion.prompt}</h2>
            <div className="quiz-options-list">
              {currentOptions.map((opt, idx) => {
                const isSelected = selectedAnswerForCurrent === idx;
                return (
                  <label
                    key={`${currentQuestion.id}-${idx}`}
                    className={`quiz-option-card ${isSelected ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`assess-${currentQuestion.id}`}
                      checked={isSelected}
                      onChange={() =>
                        setAnswersMap((prev) => ({ ...prev, [currentQuestion.id]: idx }))
                      }
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
            <div className="quiz-nav-actions">
              <button
                type="button"
                className="btn btn-white"
                disabled={qIndex === 0}
                onClick={() => setQIndex((prev) => Math.max(0, prev - 1))}
              >
                <ArrowLeft size={17} /> Previous
              </button>
              {qIndex + 1 < activeAssessment.questions.length ? (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={selectedAnswerForCurrent === undefined}
                  onClick={() => setQIndex((prev) => prev + 1)}
                >
                  Next question <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={submitting || selectedAnswerForCurrent === undefined}
                  onClick={handleSubmitAssessment}
                >
                  {submitting ? "Grading answers..." : "Submit assessment"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {lastResult && (
        <div className="modal-backdrop">
          <div className="modal">
            <button className="modal-close" onClick={() => setLastResult(null)}>
              <X />
            </button>
            <span className="auth-kicker">ASSESSMENT RESULT</span>
            <h2>
              {lastResult.isVerified
                ? `${lastResult.skill} Verified!`
                : `Keep practicing ${lastResult.skill}`}
            </h2>
            <p style={{ fontSize: 15, color: "#486779", lineHeight: 1.6, marginBottom: 18 }}>
              You scored <strong>{lastResult.score}%</strong> (passing score is{" "}
              {lastResult.passingScore}%).{" "}
              {lastResult.isVerified
                ? "Your verified skill badge is now displayed on your Skill Passport."
                : "You can review your knowledge and retake the assessment anytime."}
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                className="btn btn-white full"
                onClick={() => setLastResult(null)}
              >
                Close
              </button>
              {onOpenPassport && (
                <button
                  className="btn btn-primary full"
                  onClick={() => {
                    setLastResult(null);
                    onOpenPassport();
                  }}
                >
                  View Skill Passport
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function BusinessApp({
  active,
  setActive,
  toast,
  onRefreshProjects,
}: {
  active: string;
  setActive: (s: string) => void;
  toast: (s: string) => void;
  onRefreshProjects?: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [posted, setPosted] = useState<Project[]>([]);
  const [businessApps, setBusinessApps] = useState<BusinessApplication[]>([]);
  const [directoryTalents, setDirectoryTalents] = useState<Talent[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [overview, setOverview] = useState<any | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editSetup, setEditSetup] = useState<"remote" | "onsite" | "hybrid">("remote");
  const [editStatus, setEditStatus] = useState<"published" | "draft" | "closed">("published");
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditModal = (p: Project) => {
    setEditingProject(p);
    setEditTitle(p.title);
    setEditDesc(p.description);
    setEditBudget(String(p.budget));
    setEditSetup((String(p.workSetup || "remote").toLowerCase() as any) || "remote");
    setEditStatus((p.status === "draft" || p.status === "closed" ? p.status : "published") as any);
  };

  const saveListingEdits = async () => {
    if (!editingProject) return;
    setSavingEdit(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/listings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: editingProject.id,
          title: editTitle.trim(),
          description: editDesc.trim(),
          budget: Number(editBudget) || 500,
          work_setup: editSetup,
          status: editStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Could not update project");
        return;
      }
      setEditingProject(null);
      await Promise.all([loadBusinessData(), onRefreshProjects?.()]);
      toast("Project listing updated");
    } catch {
      toast("Could not update project");
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    setSelectedProject(null);
  }, [active]);

  const loadBusinessData = async () => {
    if (!user) return;
    const [bProjects, bApps, dirTalents, cList, ovData] = await Promise.all([
      fetchBusinessProjects(),
      fetchBusinessApplications(),
      fetchTalentsDirectory(),
      fetchContracts(),
      fetchOverviewData(),
    ]);
    setPosted(bProjects);
    setBusinessApps(bApps);
    setDirectoryTalents(dirTalents);
    setContracts(cList);
    if (ovData) setOverview(ovData);
  };

  useEffect(() => {
    loadBusinessData();
  }, [user, active]);

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
        readOnly
      />
    );
  }

  if (active === "Post a Project")
    return (
      <PostProject
        toast={toast}
        onPublish={async (p) => {
          setPosted((prev) => [p, ...prev.filter((x) => String(x.id) !== String(p.id))]);
          await Promise.all([loadBusinessData(), onRefreshProjects?.()]);
          toast("Project published successfully");
          setActive("My Projects");
        }}
      />
    );
  if (active === "Find Talent")
    return (
      <TalentMarket
        toast={toast}
        talentsList={directoryTalents}
        onInvite={async (talent) => {
          if (!talent.id) {
            toast(`Invitation sent to ${talent.name}`);
            return;
          }
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session) {
              await fetch("/api/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  action: "start",
                  recipient_id: talent.id,
                  subject: "Project Invitation",
                  message: `Hi ${talent.name}! We reviewed your profile on GAWA and would love to invite you to collaborate on our project.`,
                }),
              });
            }
            toast(`Invitation sent to ${talent.name}`);
          } catch {
            toast(`Invitation sent to ${talent.name}`);
          }
        }}
      />
    );
  if (active === "Applications")
    return (
      <ApplicantBoard
        toast={toast}
        applications={businessApps}
        onRefresh={loadBusinessData}
        onMessageApplicant={async (app) => {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session && app.talent_id) {
              await fetch("/api/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  action: "start",
                  recipient_id: app.talent_id,
                  subject: `Application: ${app.project_title}`,
                  message: `Hi ${app.talent.name}! Thanks for applying to "${app.project_title}". We'd love to discuss your proposal.`,
                }),
              });
            }
          } catch {}
          setActive("Messages");
        }}
      />
    );
  if (active === "Messages") return <Messages toast={toast} />;
  if (active === "Payments") return <Payments contracts={contracts} toast={toast} />;
  if (active === "Analytics")
    return (
      <Analytics
        posted={posted}
        applications={businessApps}
        contracts={contracts}
        reviews={overview?.reviews || []}
      />
    );
  if (active === "Active Projects")
    return (
      <ActiveProject
        toast={toast}
        contracts={contracts}
        onRefresh={loadBusinessData}
        onNavigate={setActive}
      />
    );
  if (active === "Settings") return <SettingsPage role="business" toast={toast} />;
  if (active === "My Projects")
    return (
      <main className="page">
        <PageTitle
          eyebrow="PROJECTS"
          title="Your project listings"
          text="Create, edit, publish, or close your project postings."
          action={
            <button className="btn btn-primary" onClick={() => setActive("Post a Project")}>
              <Plus /> Post a project
            </button>
          }
        />
        <div className="project-grid">
          {posted.length > 0 ? (
            posted.map((p) => (
              <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ProjectCard
                  project={p}
                  onClick={() => setSelectedProject(p)}
                  saved={false}
                  onSave={() => {}}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-white full"
                    onClick={() => openEditModal(p)}
                  >
                    <PenLine size={16} /> Edit listing
                  </button>
                  <button
                    type="button"
                    className="btn btn-white full"
                    onClick={async () => {
                      const {
                        data: { session },
                      } = await supabase.auth.getSession();
                      if (!session) return;
                      const nextStatus = p.status === "closed" ? "published" : "closed";
                      const res = await fetch("/api/listings", {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({ id: p.id, status: nextStatus }),
                      });
                      if (res.ok) {
                        await Promise.all([loadBusinessData(), onRefreshProjects?.()]);
                        toast(nextStatus === "closed" ? "Listing closed" : "Listing reopened");
                      } else {
                        const err = await res.json();
                        toast(err.error || "Could not update listing status");
                      }
                    }}
                  >
                    {p.status === "closed" ? "Reopen" : "Close listing"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state-box" style={{ gridColumn: "1 / -1" }}>
              <b>You haven&apos;t posted any project listings yet</b>
              <p>Create your first project brief to start receiving proposals from verified talents.</p>
              <button className="btn btn-primary" onClick={() => setActive("Post a Project")}>
                <Plus /> Post a project
              </button>
            </div>
          )}
        </div>

        {editingProject && (
          <div className="modal-backdrop">
            <div className="modal modal-wide">
              <button className="modal-close" onClick={() => setEditingProject(null)}>
                <X />
              </button>
              <span className="auth-kicker">EDIT PROJECT LISTING</span>
              <h2>Update project details</h2>
              <label>
                Project title
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </label>
              <label>
                Project description
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} />
              </label>
              <div className="form-grid">
                <label>
                  Budget (PHP)
                  <input
                    type="number"
                    value={editBudget}
                    onChange={(e) => setEditBudget(e.target.value)}
                  />
                </label>
                <label>
                  Work setup
                  <select value={editSetup} onChange={(e) => setEditSetup(e.target.value as any)}>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">Onsite</option>
                  </select>
                </label>
              </div>
              <label>
                Listing visibility
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)}>
                  <option value="published">Published (Open for applicants)</option>
                  <option value="draft">Draft (Hidden)</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <button
                className="btn btn-primary full btn-lg"
                disabled={savingEdit}
                onClick={saveListingEdits}
              >
                {savingEdit ? "Saving changes..." : "Save project changes"}
              </button>
            </div>
          </div>
        )}
      </main>
    );
  return (
    <BusinessOverview
      onNavigate={setActive}
      posted={posted}
      applications={businessApps}
      talentsList={directoryTalents}
      contracts={contracts}
    />
  );
}

function BusinessOverview({
  onNavigate,
  posted = [],
  applications = [],
  talentsList = [],
  contracts = [],
}: {
  onNavigate: (s: string) => void;
  posted?: Project[];
  applications?: BusinessApplication[];
  talentsList?: Talent[];
  contracts?: any[];
}) {
  const { profile } = useAuth();
  const activeCount = posted.filter((p) => p.status === "published" || p.status === "active").length;
  const ongoingCount =
    contracts.filter((c) => c.status === "active").length ||
    posted.filter((p) => p.status === "active").length;
  const completedCount =
    contracts.filter((c) => c.status === "completed").length ||
    posted.filter((p) => p.status === "completed").length;
  const draftCount = posted.filter((p) => p.status === "draft").length;
  const totalSpending = contracts.reduce(
    (sum, c) => sum + Number(c.agreed_amount || 0),
    0
  );

  return (
    <main className="page dashboard-page">
      <div className="welcome-row">
        <div>
          <span>BUSINESS WORKSPACE</span>
          <h1>Welcome back, {profile?.display_name || "Partner"}.</h1>
          <p>Here’s what’s happening across your projects today.</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate("Post a Project")}>
          <Plus /> Post a project
        </button>
      </div>
      <div className="stat-grid">
        <Stat
          icon={BriefcaseBusiness}
          tone="blue"
          value={String(activeCount)}
          label="Active listings"
          delta="published"
        />
        <Stat
          icon={Users}
          tone="purple"
          value={String(applications.length)}
          label="Total applicants"
          delta="across listings"
        />
        <Stat
          icon={FolderKanban}
          tone="green"
          value={String(ongoingCount)}
          label="Ongoing projects"
          delta="in execution"
        />
        <Stat
          icon={WalletCards}
          tone="amber"
          value={php(totalSpending)}
          label="Project spending"
          delta="total committed"
        />
      </div>
      <div className="business-dash-grid">
        <section className="panel applicant-panel">
          <div className="panel-title">
            <div>
              <b>Recent applications</b>
              <span>Incoming candidate proposals</span>
            </div>
            <button onClick={() => onNavigate("Applications")}>
              View all <ArrowRight />
            </button>
          </div>
          {applications.length > 0 ? (
            applications.slice(0, 4).map((app) => {
              const t = app.talent;
              return (
                <div
                  className="talent-row"
                  key={app.id}
                  onClick={() => onNavigate("Applications")}
                  style={{ cursor: "pointer" }}
                >
                  <Avatar initials={t.initials} color={t.color} />
                  <div>
                    <b>{t.name}</b>
                    <span>
                      Applied for {app.project_title} · {t.school}
                    </span>
                    <div className="tags">
                      {t.skills.slice(0, 2).map((s) => (
                        <i key={s}>{s}</i>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Badge tone="green">{t.match}% match</Badge>
                    <small>{app.appliedAgo}</small>
                  </div>
                  <button type="button">
                    <ChevronRight />
                  </button>
                </div>
              );
            })
          ) : (
            <div style={{ padding: "32px 16px", color: "#627d98", fontSize: 13, textAlign: "center" }}>
              No incoming applications yet. Candidates will appear here when they submit proposals.
            </div>
          )}
        </section>
        <section className="panel performance">
          <div className="panel-title">
            <b>Project performance</b>
            <button onClick={() => onNavigate("Analytics")}>
              View analytics <ArrowRight />
            </button>
          </div>
          {(() => {
            const total = Math.max(1, completedCount + activeCount + draftCount);
            const compDeg = Math.round((completedCount / total) * 360);
            const actDeg = compDeg + Math.round((activeCount / total) * 360);
            const pct = posted.length > 0 ? Math.round((completedCount / posted.length) * 100) : 0;
            const bg =
              completedCount + activeCount + draftCount === 0
                ? "conic-gradient(#e6eff4 0deg 360deg)"
                : `conic-gradient(#16a34a 0deg ${compDeg}deg, #162660 ${compDeg}deg ${actDeg}deg, #D0E6FD ${actDeg}deg 360deg)`;
            return (
              <div className="donut-wrap">
                <div className="donut" style={{ background: bg }}>
                  <span>
                    <b>{pct}%</b>
                    completion
                  </span>
                </div>
                <div>
                  <span>
                    <i className="green-dot"></i> Completed <b>{completedCount}</b>
                  </span>
                  <span>
                    <i className="blue-dot"></i> Active <b>{activeCount}</b>
                  </span>
                  <span>
                    <i className="gray-dot"></i> Draft <b>{draftCount}</b>
                  </span>
                </div>
              </div>
            );
          })()}
          <div className="performance-note">
            <TrendingUp />
            <span>
              <b>Active tracking</b> enabled for your business projects
            </span>
          </div>
        </section>
        <section className="panel recommended-talents">
          <div className="panel-title">
            <div>
              <b>Recommended talents</b>
              <span>Matched to your open projects</span>
            </div>
            <button onClick={() => onNavigate("Find Talent")}>
              Discover more <ArrowRight />
            </button>
          </div>
          <div className="talent-cards">
            {talentsList.length > 0 ? (
              talentsList.slice(0, 3).map((t) => (
                <div key={t.id || t.name}>
                  <Avatar initials={t.initials} color={t.color} size="lg" />
                  <h3>
                    {t.name} <ShieldCheck />
                  </h3>
                  <span>{t.role}</span>
                  <div className="tags">
                    {t.skills.slice(0, 2).map((s) => (
                      <i key={s}>{s}</i>
                    ))}
                  </div>
                  <p>
                    <Star fill="currentColor" /> {t.rating} · {t.projects} projects
                  </p>
                  <Badge tone="green">{t.match}% match</Badge>
                </div>
              ))
            ) : (
              <div style={{ padding: "32px 16px", color: "#627d98", fontSize: 13, textAlign: "center", gridColumn: "1 / -1" }}>
                No recommended talents found. Explore the talent directory to find candidates.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function PostProject({
  onPublish,
  toast,
}: {
  onPublish: (p: Project) => void;
  toast?: (s: string) => void;
}) {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Design & Creative");
  const [description, setDescription] = useState("");
  const [objectivesText, setObjectivesText] = useState(
    "Create a clear, easy-to-use experience that makes our service more accessible."
  );
  const [deliverablesText, setDeliverablesText] = useState(
    "User flows and wireframes\nHigh-fidelity UI designs\nClickable prototype and handoff"
  );
  const [skills, setSkills] = useState<string[]>(["Figma", "UI Design"]);
  const [skillInput, setSkillInput] = useState("");
  const [budget, setBudget] = useState("15000");
  const [duration, setDuration] = useState("4 weeks");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [workSetup, setWorkSetup] = useState("Remote");
  const [submitting, setSubmitting] = useState(false);

  const addSkill = (raw: string) => {
    const cleaned = raw.trim();
    if (cleaned && !skills.includes(cleaned)) {
      setSkills([...skills, cleaned]);
    }
    setSkillInput("");
  };

  const publish = async () => {
    if (!title.trim()) {
      toast?.("Please enter a project title before publishing");
      setStep(1);
      return;
    }

    setSubmitting(true);
    const finalTitle = title.trim();
    const finalDesc =
      description.trim() ||
      `Collaborate with our team on ${finalTitle} and deliver practical, high-impact results.`;
    const parsedObjectives = objectivesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedDeliverables = deliverablesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast?.("Please log in to publish a project");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: finalTitle,
          description: finalDesc,
          category_name: category,
          objectives: parsedObjectives,
          expected_deliverables: parsedDeliverables,
          budget: Number(budget) || 15000,
          duration_label: duration,
          application_deadline: deadline,
          skills,
          work_setup: workSetup.toLowerCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.project) {
        toast?.(data.error || "Failed to publish project listing");
        setSubmitting(false);
        return;
      }

      const companyName =
        data.project.business?.name || profile?.display_name || "My Business";

      onPublish({
        id: data.project.id,
        title: data.project.title,
        company: companyName,
        initials: getInitials(companyName),
        color: data.project.business?.avatar_color || "#162660",
        description: finalDesc,
        budget: Number(data.project.budget),
        duration,
        skills: skills.length > 0 ? skills : ["General"],
        applicants: 0,
        match: 100,
        category,
        posted: "Just now",
        workSetup: workSetup.toLowerCase(),
        objectives: parsedObjectives,
        deliverables: parsedDeliverables,
        deadline,
        status: "published",
      });
      setSubmitting(false);
    } catch (err) {
      console.error("Listing publish error:", err);
      toast?.("Network error while publishing project");
      setSubmitting(false);
    }
  };
  return (
    <main className="page post-page">
      <PageTitle
        eyebrow="CREATE A PROJECT"
        title="Find the right talent for your next idea"
        text="A clear brief attracts stronger applications."
      />
      <div className="creation-steps">
        {["Project basics", "Scope & skills", "Budget & timeline", "Preview"].map((s, i) => (
          <div className={step === i + 1 ? "active" : step > i + 1 ? "done" : ""} key={s}>
            <i>{step > i + 1 ? <Check /> : i + 1}</i>
            <span>{s}</span>
          </div>
        ))}
      </div>
      <div className="form-layout">
        <section className="panel creation-form">
          <span className="auth-kicker">STEP {step} OF 4</span>
          <h2>
            {step === 1
              ? "Start with the big picture"
              : step === 2
                ? "Define the work clearly"
                : step === 3
                  ? "Set expectations and budget"
                  : "Review before publishing"}
          </h2>
          {step === 1 && (
            <>
              <label>
                Project title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Mobile App UI/UX Design"
                />
                <small>Be specific and outcome-focused.</small>
              </label>
              <label>
                Project category
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option>Design & Creative</option>
                  <option>Web Development</option>
                  <option>Digital Marketing</option>
                  <option>Data & Analytics</option>
                  <option>Writing</option>
                </select>
              </label>
              <label>
                Project description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the problem, context, and what success looks like…"
                />
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <label>
                Project objectives
                <textarea
                  value={objectivesText}
                  onChange={(e) => setObjectivesText(e.target.value)}
                />
              </label>
              <label>
                Key deliverables
                <textarea
                  value={deliverablesText}
                  onChange={(e) => setDeliverablesText(e.target.value)}
                />
              </label>
              <label>
                Required skills
                <div className="skill-input-tags">
                  {skills.map((sk) => (
                    <Badge tone="blue" key={sk}>
                      {sk}{" "}
                      <X
                        style={{ cursor: "pointer" }}
                        onClick={() => setSkills(skills.filter((s) => s !== sk))}
                      />
                    </Badge>
                  ))}
                  <input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addSkill(skillInput);
                      }
                    }}
                    onBlur={() => {
                      if (skillInput.trim()) addSkill(skillInput);
                    }}
                    placeholder="Add a skill and press Enter"
                  />
                </div>
              </label>
            </>
          )}
          {step === 3 && (
            <div className="form-grid">
              <label>
                Budget in PHP
                <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </label>
              <label>
                Expected duration
                <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                  <option>4 weeks</option>
                  <option>2 weeks</option>
                  <option>6–8 weeks</option>
                </select>
              </label>
              <label>
                Application deadline
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </label>
              <label>
                Work setup
                <select value={workSetup} onChange={(e) => setWorkSetup(e.target.value)}>
                  <option>Remote</option>
                  <option>Onsite</option>
                  <option>Hybrid</option>
                </select>
              </label>
            </div>
          )}
          {step === 4 && (
            <div className="preview-card">
              <div className="project-top">
                <Avatar initials={getInitials(profile?.display_name || "MB")} />
                <div>
                  <span>{profile?.display_name || "Your Business"}</span>
                  <small>Posting now · {category}</small>
                </div>
              </div>
              <h2>{title || "Your project title"}</h2>
              <p>
                {description.trim() ||
                  "A new opportunity to collaborate with our growing team."}
              </p>
              <div className="tags">
                {skills.map((sk) => (
                  <span key={sk}>{sk}</span>
                ))}
              </div>
              <div className="project-meta">
                <span>
                  <CircleDollarSign /> {php(Number(budget))}
                </span>
                <span>
                  <Clock3 /> {duration}
                </span>
              </div>
            </div>
          )}
          <div className="form-actions">
            <button
              className="btn btn-white"
              disabled={step === 1}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft /> Back
            </button>
            <button
              className="btn btn-primary"
              disabled={submitting}
              onClick={() => {
                if (step === 1 && !title.trim()) {
                  toast?.("Please enter a project title");
                  return;
                }
                if (step === 4) {
                  publish();
                } else {
                  setStep(step + 1);
                }
              }}
            >
              {step === 4 ? (submitting ? "Publishing..." : "Publish project") : "Continue"}{" "}
              <ArrowRight />
            </button>
          </div>
        </section>
        <aside className="panel form-tip">
          <div>
            <HelpCircle size={20} />
          </div>
          <h3>Write a brief talents can act on</h3>
          <p>
            Projects with specific outcomes and realistic scope receive up to 40% more qualified
            applications.
          </p>
          <ul>
            <li>
              <Check /> Focus on the result
            </li>
            <li>
              <Check /> List clear deliverables
            </li>
            <li>
              <Check /> Be transparent about budget
            </li>
          </ul>
        </aside>
      </div>
    </main>
  );
}

function TalentMarket({
  toast,
  talentsList = [],
  onInvite,
}: {
  toast: (s: string) => void;
  talentsList?: Talent[];
  onInvite?: (t: Talent) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedTalent, setSelectedTalent] = useState<Talent | null>(null);
  const list = talentsList.filter((t) =>
    `${t.name} ${t.role} ${t.school} ${t.skills.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="page">
      <PageTitle
        eyebrow="TALENT MARKETPLACE"
        title="Find people who can move work forward"
        text="Discover verified emerging talent matched to your project needs."
      />
      <div className="search-filter">
        <div>
          <Search />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills, roles, or schools…"
          />
        </div>
        <button className="btn btn-white" onClick={() => setSearch("")}>
          <Filter /> Filters <span>{search ? 1 : 0}</span>
        </button>
      </div>
      <div className="talent-market-grid">
        {list.length > 0 ? (
          list.map((t) => (
            <article className="panel talent-profile-card" key={t.id || t.name}>
              <div
                className="talent-cover"
                style={
                  t.bannerUrl
                    ? ({
                        "--accent": t.color,
                        backgroundImage: `linear-gradient(180deg, rgba(7,59,87,0.12), rgba(7,59,87,0.35)), url(${t.bannerUrl})`,
                      } as React.CSSProperties)
                    : ({ "--accent": t.color } as React.CSSProperties)
                }
              ></div>
              <Avatar initials={t.initials} color={t.color} size="lg" src={t.avatarUrl} />
              <Badge tone="green">{t.match}% match</Badge>
              <h3>
                {t.name} <ShieldCheck />
              </h3>
              <b>{t.role}</b>
              <span>{t.school}</span>
              <div className="tags">
                {t.skills.map((s) => (
                  <i key={s}>{s}</i>
                ))}
              </div>
              <div className="talent-stats">
                <span>
                  <Star fill="currentColor" /> {t.rating}
                </span>
                <span>{t.projects} projects</span>
                <span>Available</span>
              </div>
              <div>
                <button
                  className="btn btn-white"
                  onClick={() => setSelectedTalent(t)}
                >
                  View profile
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    onInvite ? onInvite(t) : toast(`Invitation sent to ${t.name}`)
                  }
                >
                  Invite
                </button>
              </div>
            </article>
          ))
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              color: "#627d98",
              background: "white",
              borderRadius: 16,
              border: "1px dashed #dce7ed",
              gridColumn: "1 / -1",
            }}
          >
            <p>No talents found matching your search.</p>
          </div>
        )}
      </div>

      {selectedTalent && (
        <div className="modal-backdrop">
          <div className="modal">
            <button className="modal-close" onClick={() => setSelectedTalent(null)}>
              <X />
            </button>
            <span className="auth-kicker">TALENT PROFILE</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "12px 0" }}>
              <Avatar
                initials={selectedTalent.initials}
                color={selectedTalent.color}
                size="lg"
              />
              <div>
                <h2 style={{ margin: 0 }}>{selectedTalent.name}</h2>
                <span style={{ color: "#486581", fontSize: 14 }}>
                  {selectedTalent.role} · {selectedTalent.school}
                </span>
              </div>
            </div>
            <div className="tags" style={{ margin: "14px 0" }}>
              {selectedTalent.skills.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <button
              className="btn btn-primary full btn-lg"
              onClick={() => {
                onInvite
                  ? onInvite(selectedTalent)
                  : toast(`Invitation sent to ${selectedTalent.name}`);
                setSelectedTalent(null);
              }}
            >
              Send invitation <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function ApplicantBoard({
  toast,
  applications = [],
  onRefresh,
  onMessageApplicant,
}: {
  toast: (s: string) => void;
  applications?: BusinessApplication[];
  onRefresh?: () => Promise<void>;
  onMessageApplicant?: (app: BusinessApplication) => void;
}) {
  const columns = useMemo(() => {
    const groups: Record<string, BusinessApplication[]> = {
      New: [],
      Review: [],
      Shortlisted: [],
      Accepted: [],
    };
    for (const app of applications) {
      if (app.status === "submitted") groups.New.push(app);
      else if (app.status === "interview") groups.Review.push(app);
      else if (app.status === "shortlisted") groups.Shortlisted.push(app);
      else if (app.status === "accepted") groups.Accepted.push(app);
    }
    return groups;
  }, [applications]);

  const move = async (app: BusinessApplication, fromColumn: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      if (fromColumn === "Shortlisted") {
        // Hire & create contract
        const res = await fetch("/api/contracts/hire", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ application_id: app.id }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast(err.error || "Could not accept application");
          return;
        }
        toast(`${app.talent.name} hired for ${app.project_title}`);
      } else {
        const nextStatus = fromColumn === "New" ? "interview" : "shortlisted";
        const res = await fetch("/api/applications", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            application_id: app.id,
            status: nextStatus,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast(err.error || "Could not update stage");
          return;
        }
        toast(
          `${app.talent.name} moved to ${
            fromColumn === "New" ? "Under Review" : "Shortlisted"
          }`
        );
      }
      await onRefresh?.();
    } catch (err) {
      console.error("Error moving applicant:", err);
      toast("Failed to update applicant stage");
    }
  };
  return (
    <main className="page kanban-page">
      <PageTitle
        eyebrow="APPLICANT PIPELINE"
        title="Review applicants with clarity"
        text="Manage talent applications across stages."
        action={
          <button className="btn btn-white" onClick={() => onRefresh?.()}>
            <Filter /> Refresh
          </button>
        }
      />
      <div className="kanban">
        {Object.entries(columns).map(([column, items]) => (
          <div className="kanban-column" key={column}>
            <div className="kanban-head">
              <span>
                <i className={column.toLowerCase()}></i>
                {column === "Review" ? "Under Review" : column}
              </span>
              <b>{items.length}</b>
            </div>
            {items.length > 0 ? (
              items.map((app) => {
                const t = app.talent;
                return (
                  <div className="applicant-card" key={app.id}>
                    <div>
                      <Avatar initials={t.initials} color={t.color} />
                      <Badge tone="green">{t.match}%</Badge>
                    </div>
                    <h3>{t.name}</h3>
                    <span>
                      {app.project_title} · {php(app.proposed_budget)}
                    </span>
                    <div className="tags">
                      {t.skills.slice(0, 2).map((s) => (
                        <i key={s}>{s}</i>
                      ))}
                    </div>
                    <p>{app.proposal}</p>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        borderTop: "1px solid #e9eff2",
                        paddingTop: 9,
                      }}
                    >
                      {onMessageApplicant && (
                        <button
                          type="button"
                          className="btn btn-white"
                          style={{ flex: 1, padding: "6px 8px", fontSize: 11 }}
                          onClick={() => onMessageApplicant(app)}
                        >
                          <MessageSquare size={12} /> Message
                        </button>
                      )}
                      {column !== "Accepted" && (
                        <>
                          <button
                            type="button"
                            className="btn btn-white"
                            style={{ padding: "6px 10px", fontSize: 12, color: "#dc2626" }}
                            onClick={async () => {
                              const {
                                data: { session },
                              } = await supabase.auth.getSession();
                              if (!session) return;
                              const res = await fetch("/api/applications", {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify({
                                  application_id: app.id,
                                  status: "rejected",
                                }),
                              });
                              if (res.ok) {
                                toast(`Declined ${app.talent.name}'s application`);
                                await onRefresh?.();
                              } else {
                                const err = await res.json();
                                toast(err.error || "Could not reject application");
                              }
                            }}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ flex: 1, padding: "6px 10px", fontSize: 12 }}
                            onClick={() => move(app, column)}
                          >
                            {column === "New"
                              ? "Review"
                              : column === "Review"
                              ? "Shortlist"
                              : "Accept"}{" "}
                            <ArrowRight size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: "32px 12px", textAlign: "center", color: "#627d98", fontSize: 13 }}>
                No applicants in this stage.
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function Payments({
  contracts: externalContracts,
  toast,
}: {
  contracts?: any[];
  toast?: (s: string) => void;
}) {
  const [contracts, setContracts] = useState<any[]>(externalContracts || []);

  useEffect(() => {
    if (externalContracts) {
      setContracts(externalContracts);
    } else {
      fetchContracts().then(setContracts);
    }
  }, [externalContracts]);

  const activeCount = contracts.filter((c) => c.status === "active").length;
  const completedCount = contracts.filter((c) => c.status === "completed").length;

  const totalCommitted = contracts.reduce(
    (sum, c) => sum + Number(c.agreed_amount || 0),
    0
  );
  const inEscrow = contracts
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + Number(c.agreed_amount || 0), 0);
  const released = contracts
    .filter((c) => c.status === "completed")
    .reduce((sum, c) => sum + Number(c.agreed_amount || 0), 0);
  const platformFees = Math.round(totalCommitted * 0.05);

  const transactions = contracts.map((c) => [
    c.project?.title || "Project Contract",
    c.talent?.display_name || c.project?.business?.name || "Collaborator",
    new Date(c.created_at).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    php(Number(c.agreed_amount || 0)),
    c.status === "completed" ? "Completed" : "In Escrow",
  ]);

  const downloadCsv = () => {
    const rows = [
      ["Project", "Collaborator", "Date", "Amount", "Status"],
      ...transactions,
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gawa-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast?.("Transaction report downloaded");
  };

  const handleFund = async (contractId: string, amount: number) => {
    const res = await fundContractEscrow(contractId, amount);
    if (res.success) {
      toast?.("Escrow deposited successfully");
      const updated = await fetchContracts();
      setContracts(updated);
    } else {
      toast?.(res.error || "Failed to fund escrow");
    }
  };

  const handleRelease = async (contractId: string, amount: number) => {
    const res = await releaseContractEscrow(contractId, amount);
    if (res.success) {
      toast?.("Payment released to talent successfully");
      const updated = await fetchContracts();
      setContracts(updated);
    } else {
      toast?.(res.error || "Failed to release payment");
    }
  };

  return (
    <main className="page">
      <PageTitle
        eyebrow="PAYMENTS"
        title="Simple, transparent project payments"
        text="Track project budgets and verified transactions."
      />
      <div className="stat-grid">
        <Stat
          icon={WalletCards}
          tone="blue"
          value={php(totalCommitted)}
          label="Total spending"
          delta="total committed"
        />
        <Stat
          icon={Clock3}
          tone="amber"
          value={php(inEscrow)}
          label="In escrow"
          delta={`${activeCount} active project${activeCount === 1 ? "" : "s"}`}
        />
        <Stat
          icon={CheckCircle2}
          tone="green"
          value={php(released)}
          label="Released"
          delta={`${completedCount} completed`}
        />
        <Stat
          icon={CircleDollarSign}
          tone="purple"
          value={php(platformFees)}
          label="Platform fees"
          delta="5% transaction fee"
        />
      </div>
      <section className="panel data-panel" style={{ marginBottom: 24 }}>
        <div className="panel-title">
          <b>Project Escrow Accounts</b>
          <span style={{ fontSize: 13, color: "#627d98" }}>Secure milestone payments</span>
        </div>
        {contracts.length > 0 ? (
          contracts.map((c) => {
            const agreed = Number(c.agreed_amount || 0);
            const funded = Number(c.escrow?.funded_amount || 0);
            const releasedAmt = Number(c.escrow?.released_amount || 0);
            const needsFunding = funded < agreed;
            const canRelease = funded > releasedAmt;

            return (
              <div className="data-row" key={c.id} style={{ alignItems: "center" }}>
                <div>
                  <b>{c.project?.title || "Contract"}</b>
                  <span>{c.talent?.display_name || "Assigned Talent"}</span>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "#627d98" }}>Agreed: {php(agreed)}</span>
                  <div style={{ fontSize: 12, color: "#102a43" }}>
                    Funded: <strong>{php(funded)}</strong> | Released: <strong>{php(releasedAmt)}</strong>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {needsFunding && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleFund(c.id, agreed - funded)}
                    >
                      Deposit {php(agreed - funded)}
                    </button>
                  )}
                  {canRelease && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleRelease(c.id, funded - releasedAmt)}
                    >
                      Release {php(funded - releasedAmt)}
                    </button>
                  )}
                  {!needsFunding && !canRelease && (
                    <Badge tone="green">Fully Settled</Badge>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "#627d98", fontSize: 13 }}>
            No active project contracts. Escrow accounts will appear when talent proposals are accepted.
          </div>
        )}
      </section>
      <section className="panel data-panel">
        <div className="panel-title">
          <b>Transaction history</b>
          <button onClick={downloadCsv}>Download report</button>
        </div>
        {transactions.length > 0 ? (
          transactions.map((r, idx) => (
            <div className="data-row" key={idx}>
              <div>
                <b>{r[0]}</b>
                <span>{r[1]}</span>
              </div>
              <span>{r[2]}</span>
              <strong>{r[3]}</strong>
              <Badge tone={r[4] === "Completed" ? "green" : "amber"}>{r[4]}</Badge>
            </div>
          ))
        ) : (
          <div style={{ padding: "36px 16px", textAlign: "center", color: "#627d98", fontSize: 13 }}>
            No transaction records found. Escrow and release records will appear here as projects progress.
          </div>
        )}
      </section>
    </main>
  );
}

function Analytics({
  posted: externalPosted,
  applications: externalApps,
  contracts: externalContracts,
  reviews = [],
}: {
  posted?: Project[];
  applications?: BusinessApplication[];
  contracts?: any[];
  reviews?: any[];
}) {
  const [posted, setPosted] = useState<Project[]>(externalPosted || []);
  const [applications, setApplications] = useState<BusinessApplication[]>(externalApps || []);
  const [contracts, setContracts] = useState<any[]>(externalContracts || []);

  useEffect(() => {
    if (externalPosted) setPosted(externalPosted);
    else fetchPublicProjects().then(setPosted);

    if (externalApps) setApplications(externalApps);
    else fetchBusinessApplications().then(setApplications);

    if (externalContracts) setContracts(externalContracts);
    else fetchContracts().then(setContracts);
  }, [externalPosted, externalApps, externalContracts]);

  const totalProjects = posted.length;
  const completedCount =
    contracts.filter((c) => c.status === "completed").length ||
    posted.filter((p) => p.status === "completed").length;
  const activeCount = posted.filter(
    (p) => p.status === "published" || p.status === "active"
  ).length;
  const draftCount = posted.filter((p) => p.status === "draft").length;
  const completionRate =
    totalProjects > 0 ? Math.round((completedCount / totalProjects) * 100) : 0;
  const totalSpending = contracts.reduce(
    (sum, c) => sum + Number(c.agreed_amount || 0),
    0
  );
  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) /
          reviews.length
        ).toFixed(1)
      : "—";

  const totalApplicantCount =
    applications.length ||
    posted.reduce((sum, p) => sum + Number(p.applicants || 0), 0);

  const monthlyBuckets = useMemo(() => {
    const now = new Date();
    const buckets: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const count = applications.filter((a) => {
        if (!a.submitted_at) return false;
        const ad = new Date(a.submitted_at);
        return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth();
      }).length;
      buckets.push({ label, count });
    }
    return buckets;
  }, [applications]);
  const maxMonthCount = Math.max(1, ...monthlyBuckets.map((b) => b.count));

  const statusTotal = Math.max(1, completedCount + activeCount + draftCount);
  const compDeg = Math.round((completedCount / statusTotal) * 360);
  const actDeg = compDeg + Math.round((activeCount / statusTotal) * 360);
  const donutBg =
    completedCount + activeCount + draftCount === 0
      ? "conic-gradient(#e6eff4 0deg 360deg)"
      : `conic-gradient(#16a34a 0deg ${compDeg}deg, #162660 ${compDeg}deg ${actDeg}deg, #D0E6FD ${actDeg}deg 360deg)`;

  return (
    <main className="page">
      <PageTitle
        eyebrow="BUSINESS ANALYTICS"
        title="Understand what drives great outcomes"
        text="Performance insights across your projects and talent pipeline."
      />
      <div className="stat-grid">
        <Stat
          icon={BriefcaseBusiness}
          tone="blue"
          value={String(totalProjects)}
          label="Projects posted"
          delta="all time"
        />
        <Stat
          icon={CheckCircle2}
          tone="green"
          value={`${completionRate}%`}
          label="Completion rate"
          delta="verified contracts"
        />
        <Stat
          icon={WalletCards}
          tone="purple"
          value={php(totalSpending)}
          label="Total spending"
          delta="lifetime"
        />
        <Stat
          icon={Star}
          tone="amber"
          value={avgRating}
          label="Talent rating"
          delta={reviews.length > 0 ? `${reviews.length} reviews` : "no reviews yet"}
        />
      </div>
      <div className="analytics-grid">
        <section className="panel chart-panel">
          <div className="panel-title">
            <div>
              <b>Applications over time</b>
              <span>Last 6 months ({totalApplicantCount} total)</span>
            </div>
            <Badge tone="blue">Real submission dates</Badge>
          </div>
          <div className="bar-chart">
            {monthlyBuckets.map((b) => {
              const h = b.count > 0 ? Math.max(24, Math.round((b.count / maxMonthCount) * 140)) : 8;
              return (
                <div key={b.label}>
                  <i style={{ height: `${h}px`, opacity: b.count > 0 ? 1 : 0.3 }} title={`${b.label}: ${b.count} applications`}></i>
                  <span>{b.label} ({b.count})</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <b>Project status</b>
          </div>
          <div className="large-donut" style={{ background: donutBg }}>
            <span>
              <b>{totalProjects}</b>projects
            </span>
          </div>
          <div className="legend">
            <span>
              <i className="green-dot"></i>Completed <b>{completedCount}</b>
            </span>
            <span>
              <i className="blue-dot"></i>Active <b>{activeCount}</b>
            </span>
            <span>
              <i className="gray-dot"></i>Draft <b>{draftCount}</b>
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminApp({
  active,
  setActive,
  toast,
}: {
  active: string;
  setActive: (s: string) => void;
  toast: (s: string) => void;
}) {
  const [adminData, setAdminData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAdmin = async () => {
    setLoading(true);
    const data = await fetchAdminData();
    if (data) setAdminData(data);
    setLoading(false);
  };

  useEffect(() => {
    loadAdmin();
  }, [active]);

  if (active === "User Management")
    return (
      <AdminManagementView
        mode="users"
        title="User management"
        text="Review registered accounts and activate or suspend access when needed."
        data={adminData?.users || []}
        loading={loading}
        onRefresh={loadAdmin}
        toast={toast}
      />
    );
  if (active === "Skill Verifications")
    return (
      <AdminManagementView
        mode="verifications"
        title="Skill verification requests"
        text="Review assessment submissions and approve or reject verified skill badges."
        data={adminData?.verifications || []}
        loading={loading}
        onRefresh={loadAdmin}
        toast={toast}
      />
    );
  if (active === "Project Moderation")
    return (
      <AdminManagementView
        mode="projects"
        title="Project moderation"
        text="Approve, feature, or hide submitted project listings before they appear publicly."
        data={adminData?.projects || []}
        loading={loading}
        onRefresh={loadAdmin}
        toast={toast}
      />
    );
  if (active === "Transactions") return <Payments />;
  if (active === "Platform Analytics") return <Analytics />;
  if (active === "Reviews & Reports")
    return (
      <AdminManagementView
        mode="reports"
        title="Reviews and reports"
        text="Investigate reported issues and resolve or dismiss open disputes."
        data={adminData?.reports || []}
        loading={loading}
        onRefresh={loadAdmin}
        toast={toast}
      />
    );
  if (active === "Settings") return <SettingsPage role="admin" toast={toast} />;
  return <AdminOverview onNavigate={setActive} adminData={adminData} />;
}

function Reviews({
  role,
  toast,
  reviews = [],
  onRefresh,
}: {
  role: Role;
  toast: (message: string) => void;
  reviews?: any[];
  onRefresh?: () => Promise<void>;
}) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) /
          reviews.length
        ).toFixed(1)
      : "0.0";

  const submitReview = async () => {
    if (!rating) {
      toast("Please select a star rating");
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/overview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "submit_review",
          rating,
          feedback,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Could not submit review");
        setSubmitting(false);
        return;
      }
      setFeedback("");
      await onRefresh?.();
      toast("Review submitted successfully");
    } catch {
      toast("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page">
      <PageTitle
        eyebrow="REVIEWS"
        title="Feedback that builds trust"
        text="See what collaborators say and share thoughtful feedback after completed work."
      />
      <div className="portfolio-grid">
        <section className="panel rich-copy">
          <h2>Your review summary</h2>
          <div className="rating-summary">
            <strong>{avgRating}</strong>
            <div>
              <div className="stars" aria-label={`Average rating: ${avgRating} out of 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    size={14}
                    fill={reviews.length > 0 && i <= Math.round(Number(avgRating)) ? "#f59e0b" : "none"}
                    stroke={reviews.length > 0 && i <= Math.round(Number(avgRating)) ? "#f59e0b" : "#cbd5e1"}
                    strokeWidth={1.5}
                  />
                ))}
              </div>
              <small>
                {reviews.length > 0
                  ? `${reviews.length} verified review${reviews.length === 1 ? "" : "s"}`
                  : "No reviews received yet"}
              </small>
            </div>
          </div>
          {reviews.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#627d98", fontSize: 13 }}>
              No completed project reviews yet. Reviews submitted by collaborators will appear here.
            </div>
          ) : (
            reviews.map((review: any) => (
              <article className="review-item" key={review.id}>
                <Avatar
                  initials={getInitials(review.reviewer_name || "CL")}
                  size="sm"
                />
                <div>
                  <b>{review.reviewer_name}</b>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {review.project_title} · {Number(review.rating).toFixed(1)}{" "}
                    <Star size={11} fill="#f59e0b" stroke="#f59e0b" />
                  </span>
                  <p>{review.feedback}</p>
                </div>
              </article>
            ))
          )}
        </section>
        <section className="panel review-form">
          <span className="auth-kicker">COMPLETED PROJECT</span>
          <h2>Share your experience</h2>
          <p>
            {role === "talent"
              ? "Review your collaboration after project completion."
              : "Review talent after project completion."}
          </p>
          <div className="rating-picker">
            {[1, 2, 3, 4, 5].map((star) => (
              <button type="button" key={star} onClick={() => setRating(star)}>
                <Star fill={star <= rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <label>
            Written feedback
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What went well? What should future collaborators know?"
            />
          </label>
          <button
            className="btn btn-primary full"
            disabled={submitting}
            onClick={submitReview}
          >
            {submitting ? "Submitting..." : "Submit review"}
          </button>
        </section>
      </div>
    </main>
  );
}

function SettingsPage({ role, toast }: { role: Role; toast: (message: string) => void }) {
  const { profile, user, refreshProfile } = useAuth();
  const [subTab, setSubTab] = useState<"Profile" | "Notifications" | "Security" | "Billing">("Profile");
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [location, setLocation] = useState(profile?.location || "");
  const [bio, setBio] = useState(
    profile?.bio || "Building meaningful work through skill, action, and collaboration."
  );
  const [emailNotif, setEmailNotif] = useState(true);
  const [projectNotif, setProjectNotif] = useState(true);
  const [messageNotif, setMessageNotif] = useState(true);
  const [profileVisible, setProfileVisible] = useState(profile?.profile_visible ?? true);
  const [saving, setSaving] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<"avatar" | "banner" | null>(null);
  const [totpActive, setTotpActive] = useState<boolean | null>(null);

  useEffect(() => {
    if (subTab === "Security" && user) {
      supabase.auth.mfa.listFactors().then(({ data, error }) => {
        if (!error) setTotpActive(Boolean(data.totp.some(f => f.status === "verified")));
      });
    }
  }, [subTab, user]);

  const handleUploadMedia = async (file: File | undefined, kind: "avatar" | "banner") => {
    if (!file) return;
    setUploadingKind(kind);
    const res = await uploadProfileMediaFile(file, kind);
    setUploadingKind(null);
    if (!res.ok) {
      toast(res.error || `Failed to upload ${kind}`);
      return;
    }
    await refreshProfile();
    toast(kind === "avatar" ? "Profile picture updated!" : "Profile banner updated!");
  };

  const handleRemoveMedia = async (kind: "avatar" | "banner") => {
    setUploadingKind(kind);
    const res = await removeProfileMediaFile(kind);
    setUploadingKind(null);
    if (!res.ok) {
      toast(res.error || `Failed to remove ${kind}`);
      return;
    }
    await refreshProfile();
    toast(kind === "avatar" ? "Profile picture removed" : "Profile banner removed");
  };

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setLocation(profile.location || "");
      if (profile.bio) setBio(profile.bio);
      setProfileVisible(profile.profile_visible ?? true);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const cleanedName = displayName.trim() || profile?.display_name || "GAWA Member";
      await supabase
        .from("account_profiles")
        .update({
          display_name: cleanedName,
          location: location.trim() || null,
          bio: bio.trim(),
          profile_visible: profileVisible,
        })
        .eq("id", user.id);

      if (role === "business") {
        await supabase
          .from("business_profiles")
          .update({
            name: cleanedName,
            location: location.trim() || null,
            description: bio.trim(),
          })
          .eq("owner_id", user.id);
      }

      await supabase
        .from("account_preferences")
        .update({
          email_notifications: emailNotif,
          project_notifications: projectNotif,
          message_notifications: messageNotif,
        })
        .eq("user_id", user.id);

      await refreshProfile();
      toast("Settings saved");
    } catch (err) {
      console.error("Error saving settings:", err);
      toast("Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      <PageTitle
        eyebrow="SETTINGS"
        title="Account preferences"
        text="Manage your profile, notifications, security, and privacy."
      />
      <div className="settings-layout">
        <nav className="panel settings-nav">
          <button
            className={subTab === "Profile" ? "active" : ""}
            onClick={() => setSubTab("Profile")}
          >
            <UserCheck /> Profile
          </button>
          <button
            className={subTab === "Notifications" ? "active" : ""}
            onClick={() => setSubTab("Notifications")}
          >
            <Bell /> Notifications
          </button>
          <button
            className={subTab === "Security" ? "active" : ""}
            onClick={() => setSubTab("Security")}
          >
            <LockKeyhole /> Security
          </button>
          <button
            className={subTab === "Billing" ? "active" : ""}
            onClick={() => setSubTab("Billing")}
          >
            <WalletCards /> Billing
          </button>
        </nav>
        <section className="panel settings-form landing-tab-panel" key={subTab}>
          {subTab === "Profile" && (
            <>
              <div className="panel-title">
                <div>
                  <b>Profile picture, banner & information</b>
                  <span>Customize your visual identity and keep your public details accurate.</span>
                </div>
              </div>

              <div className="media-editor-card">
                <div
                  className="media-editor-banner"
                  style={
                    profile?.banner_path
                      ? {
                          backgroundImage: `linear-gradient(180deg, rgba(7,59,87,0.16), rgba(7,59,87,0.45)), url(${profile.banner_path})`,
                        }
                      : undefined
                  }
                >
                  <div className="banner-actions-bar">
                    <label className="banner-upload-btn">
                      <ImageIcon />
                      <span>
                        {uploadingKind === "banner" ? "Uploading…" : "Upload banner"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: "none" }}
                        onChange={(e) => handleUploadMedia(e.target.files?.[0], "banner")}
                      />
                    </label>
                    {profile?.banner_path && (
                      <button
                        type="button"
                        className="banner-upload-btn"
                        onClick={() => handleRemoveMedia("banner")}
                        title="Remove custom banner"
                      >
                        <Trash2 />
                      </button>
                    )}
                  </div>
                </div>
                <div className="media-editor-body">
                  <div className="media-editor-identity">
                    <div className="avatar-upload-wrap">
                      <Avatar
                        initials={getInitials(displayName || profile?.display_name || "GW")}
                        size="lg"
                        src={profile?.avatar_path}
                        color={profile?.avatar_color}
                      />
                      <label className="avatar-edit-trigger" title="Upload profile picture">
                        <Camera />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          style={{ display: "none" }}
                          onChange={(e) => handleUploadMedia(e.target.files?.[0], "avatar")}
                        />
                      </label>
                    </div>
                    <div>
                      <b>{displayName || profile?.display_name || "GAWA Member"}</b>
                      <span>
                        Upload a JPG, PNG, WebP, or GIF image (up to 10 MB).
                      </span>
                    </div>
                  </div>
                  <div className="media-editor-controls">
                    <label className="btn btn-white" style={{ cursor: "pointer", fontSize: 12 }}>
                      <Camera size={15} />{" "}
                      {uploadingKind === "avatar" ? "Uploading…" : "Change photo"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: "none" }}
                        onChange={(e) => handleUploadMedia(e.target.files?.[0], "avatar")}
                      />
                    </label>
                    {profile?.avatar_path && (
                      <button
                        type="button"
                        className="btn btn-white"
                        style={{ fontSize: 12, color: "#b91c1c" }}
                        onClick={() => handleRemoveMedia("avatar")}
                      >
                        <Trash2 size={14} /> Remove photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-grid">
                <label>
                  {role === "business" ? "Business name" : "Display name"}
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </label>
                <label>
                  Email address
                  <input value={user?.email || ""} readOnly />
                </label>
                <label className="wide">
                  Location
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Manila, Philippines"
                  />
                </label>
                <label className="wide">
                  Short bio
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </label>
              </div>
              <div className="preference-toggle">
                <div>
                  <b>Profile visibility</b>
                  <span>Allow verified GAWA members to discover your profile.</span>
                </div>
                <input
                  type="checkbox"
                  checked={profileVisible}
                  onChange={(e) => setProfileVisible(e.target.checked)}
                />
              </div>
            </>
          )}
          {subTab === "Notifications" && (
            <>
              <div className="panel-title">
                <div>
                  <b>Notification preferences</b>
                  <span>Choose which updates you receive.</span>
                </div>
              </div>
              <div className="preference-toggle">
                <div>
                  <b>Email notifications</b>
                  <span>Receive project updates and important account notices.</span>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotif}
                  onChange={(e) => setEmailNotif(e.target.checked)}
                />
              </div>
              <div className="preference-toggle">
                <div>
                  <b>Project & application alerts</b>
                  <span>Be notified when proposals or deliverables are updated.</span>
                </div>
                <input
                  type="checkbox"
                  checked={projectNotif}
                  onChange={(e) => setProjectNotif(e.target.checked)}
                />
              </div>
              <div className="preference-toggle">
                <div>
                  <b>Direct message notifications</b>
                  <span>Receive alerts when collaborators send a message.</span>
                </div>
                <input
                  type="checkbox"
                  checked={messageNotif}
                  onChange={(e) => setMessageNotif(e.target.checked)}
                />
              </div>
            </>
          )}
          {subTab === "Security" && (
            <>
              <div className="panel-title">
                <div>
                  <b>Account security</b>
                  <span>Authenticated via Supabase Auth ({user?.email}).</span>
                </div>
              </div>

              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "20px 24px",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <LockKeyhole size={18} style={{ color: "#162660" }} />
                      <b style={{ fontSize: 15 }}>Google Authenticator (2FA)</b>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#627d98" }}>
                      Protect your GAWA account with Time-Based One-Time Passwords (TOTP). Compatible with Google Authenticator, Authy, and 1Password.
                    </p>
                  </div>
                  <Badge tone={totpActive ? "green" : "amber"}>
                    {totpActive ? "Active" : "Not enabled"}
                  </Badge>
                </div>

                <div style={{ paddingTop: 8 }}>
                  <p style={{ fontSize: 13 }}>Google Authenticator is required for regular logins. Disabling it is not available under this policy.</p>
                </div>
              </div>

              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "16px 20px",
                  fontSize: 13,
                  color: "#486581",
                }}
              >
                <b>Account Protection</b>
                <p style={{ margin: "6px 0 0 0", fontSize: 13, lineHeight: 1.55 }}>
                  Your login session is protected automatically. Always sign out when using a shared computer or public device.
                </p>
              </div>
            </>
          )}
          {subTab === "Billing" && (
            <>
              <div className="panel-title">
                <div>
                  <b>Billing & settlement</b>
                  <span>Default settlement currency: PHP (₱).</span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "#486581", marginBottom: 16 }}>
                Escrow and payout accounts are automatically linked to your active project contracts.
              </p>
            </>
          )}
          <div className="form-actions">
            <span></span>
            <button
              className="btn btn-primary"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminOverview({
  onNavigate,
  adminData,
}: {
  onNavigate: (s: string) => void;
  adminData?: any;
}) {
  const m = adminData?.metrics || {};
  const usersCount = m.totalUsers ?? 0;
  const talentsCount = m.talentsCount ?? 0;
  const businessesCount = m.businessesCount ?? 0;
  const activeProjectsCount = m.activeProjectsCount ?? 0;
  const totalProjectValue = m.totalProjectValue ?? 0;
  const activities: any[] = adminData?.auditEvents || [];
  const projects: any[] = adminData?.projects || [];

  const approvedCount = projects.filter((p) => p.moderationStatus === "approved").length;
  const pendingCount = projects.filter((p) => p.moderationStatus === "pending").length;
  const hiddenOrRejectedCount = projects.filter(
    (p) => p.moderationStatus === "hidden" || p.moderationStatus === "rejected"
  ).length;
  const maxBar = Math.max(1, usersCount, talentsCount, businessesCount, activeProjectsCount, approvedCount);

  return (
    <main className="page admin-page">
      <div className="welcome-row">
        <div>
          <span>PLATFORM ADMINISTRATION</span>
          <h1>Platform overview</h1>
          <p>Review accounts, verify skills, moderate project listings, and keep the community safe.</p>
        </div>
        <Badge tone="green">
          <Activity /> Live database connected
        </Badge>
      </div>
      <div className="admin-stat-grid">
        <Stat
          icon={Users}
          tone="blue"
          value={String(usersCount)}
          label="Registered users"
          delta="total accounts"
        />
        <Stat
          icon={GraduationCap}
          tone="purple"
          value={String(talentsCount)}
          label="Talents"
          delta="active members"
        />
        <Stat
          icon={Building2}
          tone="green"
          value={String(businessesCount)}
          label="Businesses"
          delta="project owners"
        />
        <Stat
          icon={BriefcaseBusiness}
          tone="amber"
          value={String(activeProjectsCount)}
          label="Active projects"
          delta={`${php(totalProjectValue)} total budget`}
        />
      </div>
      <div className="admin-grid">
        <section className="panel chart-panel">
          <div className="panel-title">
            <div>
              <b>Community breakdown</b>
              <span>Real counts across users, projects, and moderation status</span>
            </div>
            <button onClick={() => onNavigate("Platform Analytics")}>
              View analytics <ArrowRight />
            </button>
          </div>
          <div className="admin-breakdown-bars">
            {[
              ["Registered Users", usersCount, "blue"],
              ["Talent Accounts", talentsCount, "purple"],
              ["Business Profiles", businessesCount, "green"],
              ["Approved Projects", approvedCount, "blue"],
              ["Pending Moderation", pendingCount, "amber"],
              ["Hidden / Rejected", hiddenOrRejectedCount, "red"],
            ].map(([label, val, tone]) => (
              <div className="breakdown-row" key={String(label)}>
                <div className="breakdown-label">
                  <b>{label}</b>
                  <span>{val}</span>
                </div>
                <div className="progress">
                  <i
                    className={`tone-${tone}`}
                    style={{ width: `${Math.max(4, Math.round((Number(val) / maxBar) * 100))}%` }}
                  ></i>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel trust-queue">
          <div className="panel-title">
            <b>Trust & safety queue</b>
            <button onClick={() => onNavigate("Project Moderation")}>Open queue</button>
          </div>
          {[
            [
              ShieldCheck,
              "Skill verifications",
              `${m.pendingVerifications ?? 0} pending review`,
              "blue",
            ],
            [
              FileCheck2,
              "Project moderation",
              `${m.pendingModeration ?? 0} pending approval`,
              "amber",
            ],
            [Star, "Reports & disputes", `${m.openReportsCount ?? 0} open`, "red"],
            [Users, "User accounts", `${usersCount} total users`, "purple"],
          ].map(([I, l, n, t]) => (
            <button
              key={l as string}
              onClick={() =>
                onNavigate(
                  l === "Skill verifications"
                    ? "Skill Verifications"
                    : l === "Reports & disputes"
                    ? "Reviews & Reports"
                    : l === "User accounts"
                    ? "User Management"
                    : "Project Moderation"
                )
              }
            >
              <span className={`stat-icon ${t}`}>
                <I size={18} />
              </span>
              <span>
                <b>{l as string}</b>
                <small>{n as string}</small>
              </span>
              <ChevronRight />
            </button>
          ))}
        </section>
        <section className="panel data-panel admin-activity">
          <div className="panel-title">
            <div>
              <b>Recent platform activity</b>
              <span>Latest recorded actions across the platform</span>
            </div>
            <button onClick={() => onNavigate("Project Moderation")}>Moderate projects</button>
          </div>
          {activities.length > 0 ? (
            activities.slice(0, 6).map((ev: any) => (
              <div className="data-row" key={ev.id}>
                <div>
                  <b>{String(ev.action || "event").replace(/\./g, " ")}</b>
                  <span>
                    {ev.actorName || "Member"} · {formatRelativeTime(ev.createdAt)}
                  </span>
                </div>
                <Badge tone="blue">{ev.entityTable}</Badge>
              </div>
            ))
          ) : (
            <div className="empty-state-box">
              <b>No platform activity recorded yet</b>
              <p>Actions such as new listings, applications, and approvals will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function AdminManagementView({
  mode,
  title,
  text,
  data,
  loading,
  onRefresh,
  toast,
}: {
  mode: "users" | "verifications" | "projects" | "reports";
  title: string;
  text: string;
  data: any[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  toast: (s: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = data.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  const runAction = async (id: string, fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) => {
    setBusyId(id);
    const res = await fn();
    setBusyId(null);
    if (!res.success) {
      toast(res.error || "Action failed");
      return;
    }
    toast(successMsg);
    await onRefresh();
  };

  return (
    <main className="page">
      <PageTitle
        eyebrow="ADMINISTRATION"
        title={title}
        text={text}
        action={
          <button className="btn btn-white" onClick={() => onRefresh()}>
            Refresh list
          </button>
        }
      />
      <div className="search-filter">
        <div>
          <Search />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, title, or status…"
          />
        </div>
        {search && (
          <button className="btn btn-white" onClick={() => setSearch("")}>
            Clear search
          </button>
        )}
      </div>
      <section className="panel admin-table">
        <div className="table-head admin-head-5">
          <span>{mode === "projects" ? "Project" : mode === "reports" ? "Report" : "Member"}</span>
          <span>{mode === "users" ? "Role" : mode === "projects" ? "Business" : mode === "verifications" ? "Assessment" : "Reporter"}</span>
          <span>{mode === "users" ? "Location" : mode === "projects" ? "Budget" : mode === "verifications" ? "Score" : "Details"}</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div className="empty-state-box">Loading records…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state-box">
            <b>No matching records</b>
            <p>Nothing matched your current search or there are no records in this queue yet.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const isBusy = busyId === item.id;
            if (mode === "users") {
              const isActive = item.status === "active";
              return (
                <div className="table-row admin-row-5" key={item.id}>
                  <span>
                    <Avatar initials={getInitials(item.displayName)} size="sm" />
                    <b>{item.displayName}</b>
                  </span>
                  <span style={{ textTransform: "capitalize" }}>{item.role}</span>
                  <span>{item.location || "Philippines"}</span>
                  <Badge tone={isActive ? "green" : "red"}>{item.status}</Badge>
                  <div className="table-action-btns">
                    {isActive ? (
                      <button
                        className="btn btn-white btn-sm"
                        disabled={isBusy}
                        onClick={() =>
                          runAction(
                            item.id,
                            () => toggleUserStatusAction(item.id, "suspended", "Suspended by admin"),
                            `${item.displayName} suspended`
                          )
                        }
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isBusy}
                        onClick={() =>
                          runAction(
                            item.id,
                            () => toggleUserStatusAction(item.id, "active"),
                            `${item.displayName} reactivated`
                          )
                        }
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            if (mode === "verifications") {
              const tone =
                item.status === "verified" ? "green" : item.status === "rejected" ? "red" : "amber";
              return (
                <div className="table-row admin-row-5" key={item.id}>
                  <span>
                    <Avatar initials={getInitials(item.talentName)} size="sm" />
                    <b>{item.talentName}</b>
                  </span>
                  <span>{item.skillName}</span>
                  <span>{item.score != null ? `${item.score}%` : "Submitted"}</span>
                  <Badge tone={tone}>{item.status}</Badge>
                  <div className="table-action-btns">
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={isBusy || item.status === "verified"}
                      onClick={() =>
                        runAction(
                          item.id,
                          () => reviewVerificationAction(item.id, "verified"),
                          `Verified ${item.talentName}'s ${item.skillName}`
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-white btn-sm"
                      disabled={isBusy || item.status === "rejected"}
                      onClick={() =>
                        runAction(
                          item.id,
                          () => reviewVerificationAction(item.id, "rejected", "Please retake the assessment."),
                          `Rejected submission`
                        )
                      }
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            }

            if (mode === "projects") {
              const tone =
                item.moderationStatus === "approved"
                  ? "green"
                  : item.moderationStatus === "pending"
                  ? "amber"
                  : "red";
              return (
                <div className="table-row admin-row-5" key={item.id}>
                  <span>
                    <Avatar initials={getInitials(item.title)} size="sm" />
                    <b>{item.title}</b>
                  </span>
                  <span>{item.businessName}</span>
                  <span>{php(Number(item.budget || 0))}</span>
                  <Badge tone={tone}>
                    {item.moderationStatus}
                    {item.isFeatured ? " · Featured" : ""}
                  </Badge>
                  <div className="table-action-btns">
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={isBusy}
                      onClick={() =>
                        runAction(
                          item.id,
                          () => moderateListingAction(item.id, "approved", !item.isFeatured),
                          item.moderationStatus === "approved"
                            ? item.isFeatured
                              ? "Removed featured tag"
                              : "Project featured"
                            : "Project approved"
                        )
                      }
                    >
                      {item.moderationStatus === "approved"
                        ? item.isFeatured
                          ? "Unfeature"
                          : "Feature"
                        : "Approve"}
                    </button>
                    <button
                      className="btn btn-white btn-sm"
                      disabled={isBusy}
                      onClick={() =>
                        runAction(
                          item.id,
                          () => moderateListingAction(item.id, "hidden", false),
                          "Project hidden"
                        )
                      }
                    >
                      Hide
                    </button>
                  </div>
                </div>
              );
            }

            const repTone =
              item.status === "resolved"
                ? "green"
                : item.status === "dismissed"
                ? "blue"
                : "amber";
            return (
              <div className="table-row admin-row-5" key={item.id}>
                <span>
                  <Avatar initials={getInitials(item.reason)} size="sm" />
                  <b>{item.reason}</b>
                </span>
                <span>{item.reporterName}</span>
                <span>{item.details || "No extra details"}</span>
                <Badge tone={repTone}>{item.status}</Badge>
                <div className="table-action-btns">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={isBusy || item.status === "resolved"}
                    onClick={() =>
                      runAction(
                        item.id,
                        () => resolveReportAction(item.id, "resolved", "Reviewed and resolved by admin"),
                        "Report marked resolved"
                      )
                    }
                  >
                    Resolve
                  </button>
                  <button
                    className="btn btn-white btn-sm"
                    disabled={isBusy || item.status === "dismissed"}
                    onClick={() =>
                      runAction(
                        item.id,
                        () => resolveReportAction(item.id, "dismissed", "Dismissed after review"),
                        "Report dismissed"
                      )
                    }
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}

export default function App() {
  const auth = useAuth();
  const [view, setView] = useState<View>(auth.user ? "app" : "landing");
  const [role, setRole] = useState<Role>(auth.role || "talent");
  const [initialRole, setInitialRole] = useState<Role | undefined>();
  const [active, setActive] = useState("Overview");
  const [notice, setNotice] = useState("");
  const [projectsList, setProjectsList] = useState<Project[]>(initialProjects);

  const refreshProjects = async () => {
    const data = await fetchPublicProjects();
    if (data) {
      setProjectsList(data);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, [auth.user]);

  // Handle Google OAuth callback redirect params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const authSuccess = params.get("auth_success");
    const authError = params.get("auth_error");
    const needsOnboarding = params.get("needs_onboarding") === "true";

    if (authError) {
      setNotice(`Sign-in failed: ${decodeURIComponent(authError)}`);
      window.history.replaceState({}, "", "/");
      return;
    }

    if (authSuccess === "true") {
      window.history.replaceState({}, "", "/");
      if (needsOnboarding) {
        setView("onboarding");
      }
      // Session will be picked up by onAuthStateChange in AuthContext
    }

    // Handle password reset token from query param
    const resetToken = params.get("reset_token");
    if (resetToken) {
      window.history.replaceState({}, "", "/");
      setView("reset-password" as View);
    }
  }, []);

  // Sync role from auth context when it changes
  useEffect(() => {
    if (auth.user && auth.role) {
      setRole(auth.role);
    }
  }, [auth.user, auth.role]);

  // If session restored, skip landing
  useEffect(() => {
    if (!auth.loading && auth.user && view === "landing") {
      setRole(auth.role);
      setActive(auth.role === "admin" ? "Platform Overview" : "Overview");
      setView("app");
    }
  }, [auth.loading, auth.user, auth.role]);

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 2600);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const navigate = (v: View, r?: Role) => {
    setView(v);
    setInitialRole(r);
    window.scrollTo(0, 0);
  };
  const enter = (r: Role, onboarding = false) => {
    const verifiedRole = auth.user ? auth.role : r;
    setRole(verifiedRole);
    setActive(verifiedRole === "admin" ? "Platform Overview" : "Overview");
    setView(onboarding ? "onboarding" : "app");
    refreshProjects();
  };
  const logout = async () => {
    await auth.signOut();
    setView("landing");
    setActive("Overview");
    refreshProjects();
  };

  if (auth.loading) {
    return (
      <div className="gawa-boot-loader">
        <div className="gawa-boot-card">
          <span className="logo-mark gawa-boot-mark">
            <img src="/logo-mark.png" alt="GAWA" className="logo-mark-img" />
          </span>
          <b>GAWA</b>
          <span>Preparing your workspace…</span>
        </div>
      </div>
    );
  }

  if (auth.user && !auth.mfaVerified) {
    return (
      <div key="mfa-gate" className="view-transition-wrap">
        <AuthenticatorGate onVerified={auth.refreshProfile} onCancel={logout} />
      </div>
    );
  }

  // Strictly enforce database role when authenticated
  const activeRole: Role = auth.user ? auth.role : role;

  return (
    <>
      <div key={view} className={view === "app" ? "app-view gawa-workspace-enter" : "view-transition-wrap"}>
        {view === "landing" && <Landing onNavigate={navigate} projects={projectsList} />}
        {(view === "login" || view === "register") && (
          <Auth
            mode={view}
            initialRole={initialRole}
            onBack={() => setView("landing")}
            onComplete={enter}
          />
        )}
        {view === "onboarding" && (
          <Onboarding role={activeRole} onDone={() => setView("app")} />
        )}
        {view === "app" && (
          <Shell role={activeRole} active={active} setActive={setActive} onLogout={logout}>
            {activeRole === "talent" ? (
              <TalentApp
                active={active}
                setActive={setActive}
                toast={setNotice}
                projects={projectsList}
                onRefreshProjects={refreshProjects}
              />
            ) : activeRole === "business" ? (
              <BusinessApp
                active={active}
                setActive={setActive}
                toast={setNotice}
                onRefreshProjects={refreshProjects}
              />
            ) : (
              <AdminApp active={active} setActive={setActive} toast={setNotice} />
            )}
          </Shell>
        )}
      </div>
      {notice && (
        <div className="toast">
          <CheckCircle2 />
          {notice}
        </div>
      )}
    </>
  );
}
