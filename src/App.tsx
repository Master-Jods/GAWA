import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  FolderKanban,
  GraduationCap,
  Heart,
  HelpCircle,
  Home,
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
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  WalletCards,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { php, projects as initialProjects, talents, type Project } from "./data";

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
    <button className="logo" onClick={() => location.reload()} aria-label="GAWA home">
      <span className="logo-mark">
        <span></span>
        <span></span>
        <span></span>
      </span>
      <span className={light ? "text-white" : ""}>GAWA</span>
    </button>
  );
}

function Avatar({
  initials,
  color = "#087EAD",
  size = "md",
}: {
  initials: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{
        background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #073B57))`,
      }}
    >
      {initials}
    </span>
  );
}

function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Landing({ onNavigate }: { onNavigate: (view: View, role?: Role) => void }) {
  const [mobile, setMobile] = useState(false);
  return (
    <div className="landing">
      <nav className="topnav">
        <Logo />
        <div className={`navlinks ${mobile ? "open" : ""}`}>
          <button
            onClick={() =>
              document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Find Projects
          </button>
          <button onClick={() => onNavigate("register", "business")}>Find Talent</button>
          <button
            onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
          >
            How It Works
          </button>
          <button
            onClick={() => document.getElementById("why")?.scrollIntoView({ behavior: "smooth" })}
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
              <Sparkles size={15} /> Built for Filipino talent, powered by skills
            </div>
            <h1>
              Your skills deserve
              <br />
              <span>real opportunities.</span>
            </h1>
            <p>
              Connect with real-world projects, showcase what you can do, and turn your skills into
              meaningful experience.
            </p>
            <div className="hero-actions">
              <button
                className="btn btn-primary btn-lg"
                onClick={() => onNavigate("register", "talent")}
              >
                Explore projects <ArrowRight size={18} />
              </button>
              <button
                className="btn btn-white btn-lg"
                onClick={() => onNavigate("register", "business")}
              >
                Find talent
              </button>
            </div>
            <div className="trust-row">
              <div className="avatar-stack">
                <Avatar initials="MR" size="sm" />
                <Avatar initials="PS" color="#805AD5" size="sm" />
                <Avatar initials="AC" color="#E0527D" size="sm" />
              </div>
              <div>
                <strong>2,400+ emerging talents</strong>
                <span>Ready to bring ideas to life</span>
              </div>
            </div>
          </div>
          <HeroVisual />
        </section>

        <section className="logo-strip">
          <span>Trusted by growing Filipino businesses</span>
          <div>
            <b>HABI</b>
            <b>Alaga</b>
            <b>Kape Norte</b>
            <b>lakbay lokal</b>
            <b>BayanBox</b>
          </div>
        </section>

        <section className="section how" id="how">
          <div className="section-heading centered">
            <span>HOW IT WORKS</span>
            <h2>From potential to proven experience</h2>
            <p>GAWA makes it simple to turn what you know into work that matters.</p>
          </div>
          <div className="steps">
            {[
              [UserCheck, "Create your profile", "Tell your story beyond a traditional résumé."],
              [Sparkles, "Showcase your skills", "Highlight what you can do with proof of work."],
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
            ].map(([Icon, title, text], i) => (
              <div className="step" key={title as string}>
                <div className="step-number">0{i + 1}</div>
                <div className="step-icon">
                  <Icon size={23} />
                </div>
                <h3>{title as string}</h3>
                <p>{text as string}</p>
                {i < 3 && <ArrowRight className="step-arrow" size={18} />}
              </div>
            ))}
          </div>
        </section>

        <section className="section projects-section" id="projects">
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
          <div className="project-grid landing-grid">
            {initialProjects.slice(0, 3).map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => onNavigate("register", "talent")}
                saved={false}
                onSave={() => {}}
              />
            ))}
          </div>
        </section>

        <section className="section split-feature" id="why">
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
                "#087EAD",
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
                <div className="stars">★★★★★</div>
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
  return (
    <div className="hero-visual">
      <div className="dashboard-mock">
        <div className="mock-sidebar">
          <div className="mini-logo">G</div>
          {[Home, Search, BriefcaseBusiness, MessageSquare, UserCheck].map((I, i) => (
            <span className={i === 0 ? "active" : ""} key={i}>
              <I size={16} />
            </span>
          ))}
        </div>
        <div className="mock-main">
          <div className="mock-top">
            <div>
              <small>Good morning, Mika</small>
              <strong>Find work that fits you.</strong>
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
  const [role, setRole] = useState<Role>(initialRole || "talent");
  const [step, setStep] = useState(mode === "register" ? 0 : 1);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="auth-page">
      <div className="auth-aside">
        <Logo light />
        <div className="auth-quote">
          <div className="eyebrow dark">
            <Sparkles size={15} /> OPPORTUNITY STARTS WITH ACTION
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
              <b>2,400+ talents</b>
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
        <div className="auth-card">
          {step === 0 ? (
            <>
              <span className="auth-kicker">LET'S GET STARTED</span>
              <h1>How will you use GAWA?</h1>
              <p>Choose the experience that’s right for you. You can update this later.</p>
              <button
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
                Already have an account? <button onClick={() => setStep(1)}>Log in</button>
              </p>
            </>
          ) : (
            <>
              <span className="auth-kicker">
                {mode === "login" ? "WELCOME BACK" : "CREATE YOUR ACCOUNT"}
              </span>
              <h1>{mode === "login" ? "Log in to GAWA" : "Start building your future"}</h1>
              <p>
                {mode === "login"
                  ? "Continue your projects and opportunities."
                  : "Join the skill-first project community."}
              </p>
              {mode === "login" && (
                <div className="role-tabs">
                  <button
                    className={role === "talent" ? "active" : ""}
                    onClick={() => setRole("talent")}
                  >
                    Talent
                  </button>
                  <button
                    className={role === "business" ? "active" : ""}
                    onClick={() => setRole("business")}
                  >
                    Business
                  </button>
                  <button
                    className={role === "admin" ? "active" : ""}
                    onClick={() => setRole("admin")}
                  >
                    Admin
                  </button>
                </div>
              )}
              {mode === "register" && (
                <label>
                  Full name
                  <input placeholder="Juan Dela Cruz" />
                </label>
              )}
              <label>
                Email address
                <input
                  type="email"
                  defaultValue={role === "admin" ? "admin@gawa.ph" : ""}
                  placeholder="you@example.com"
                />
              </label>
              <label>
                <span>
                  Password <button className="field-link">Forgot password?</button>
                </span>
                <div className="input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    defaultValue="prototype123"
                    placeholder="At least 8 characters"
                  />
                  <button onClick={() => setShowPassword(!showPassword)}>
                    <Eye size={18} />
                  </button>
                </div>
              </label>
              <button
                className="btn btn-primary full btn-lg"
                onClick={() => onComplete(role, mode === "register")}
              >
                {mode === "login" ? "Log in" : "Create account"} <ArrowRight size={17} />
              </button>
              <div className="divider">
                <span>or continue with</span>
              </div>
              <button className="btn btn-white full">
                <b className="google">G</b> Google
              </button>
              <p className="auth-switch">
                {mode === "login" ? "New to GAWA? " : "Already registered? "}
                <button onClick={() => setStep(mode === "login" ? 0 : 1)}>
                  {mode === "login" ? "Create an account" : "Log in"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Onboarding({ role, onDone }: { role: Role; onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [skills, setSkills] = useState(["UI/UX Design", "Figma"]);
  const steps =
    role === "talent"
      ? ["About you", "Your skills", "Portfolio", "Preferences", "Complete"]
      : ["Business", "Company details", "Brand profile", "Complete"];
  const max = steps.length;
  return (
    <div className="onboarding-page">
      <header>
        <Logo />
        <button className="btn btn-ghost" onClick={onDone}>
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
            <div className="onboarding-form">
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
                    <input defaultValue={role === "talent" ? "Mika Reyes" : "SariSari Studio"} />
                  </label>
                  <label>
                    {role === "talent" ? "School or university" : "Industry"}
                    <input
                      defaultValue={
                        role === "talent" ? "De La Salle University" : "Retail & E-commerce"
                      }
                    />
                  </label>
                  <label>
                    {role === "talent" ? "Course or program" : "Company size"}
                    <input
                      defaultValue={
                        role === "talent" ? "BS Information Technology" : "2–10 employees"
                      }
                    />
                  </label>
                  <label>
                    Location
                    <input defaultValue="Makati City, Metro Manila" />
                  </label>
                </div>
              )}
              {step === 2 && role === "talent" && (
                <>
                  <div className="skill-search">
                    <Search />
                    <input placeholder="Search and add skills" />
                    <button>Add skill</button>
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
                    <textarea defaultValue="We make thoughtfully designed local goods for modern Filipino homes." />
                  </label>
                  <label>
                    Contact name
                    <input defaultValue="Daniel Go" />
                  </label>
                  <label>
                    Business email
                    <input defaultValue="hello@sarisari.ph" />
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
                  <button className="btn btn-white">Choose files</button>
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
            <div className="completion">
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
              <button className="btn btn-primary btn-lg" onClick={onDone}>
                Go to my dashboard <ArrowRight />
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
        <Avatar initials={project.initials} color={project.color} />
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
          <Sparkles /> {project.match}% skill match
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
  const [open, setOpen] = useState(false);
  const nav = role === "talent" ? talentNav : role === "business" ? businessNav : adminNav;
  const user =
    role === "talent"
      ? ["Mika Reyes", "UI/UX Designer", "MR"]
      : role === "business"
        ? ["SariSari Studio", "Business account", "SS"]
        : ["Alex Rivera", "Platform admin", "AR"];
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
              {label === "Messages" && <i>3</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-help">
          <div>
            <HelpCircle size={18} />
            <b>Need a hand?</b>
          </div>
          <p>Visit the GAWA Help Center for quick answers.</p>
          <button>
            Get support <ArrowRight size={14} />
          </button>
        </div>
        <div className="side-user">
          <Avatar initials={user[2]} size="sm" />
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
            <input placeholder="Search projects, talents, messages…" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="header-actions">
            <button className="icon-btn relative">
              <Bell />
              <i></i>
            </button>
            <Avatar initials={user[2]} size="sm" />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function TalentApp({
  active,
  setActive,
  toast,
}: {
  active: string;
  setActive: (s: string) => void;
  toast: (s: string) => void;
}) {
  const [saved, setSaved] = useState<number[]>([2]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [applied, setApplied] = useState<number[]>([5]);
  const [query, setQuery] = useState("");
  if (selected)
    return (
      <ProjectDetail
        project={selected}
        onBack={() => setSelected(null)}
        applied={applied.includes(selected.id)}
        onApply={() => {
          setApplied([...applied, selected.id]);
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
        <div className="search-filter">
          <div>
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by project, skill, or business…"
            />
          </div>
          <button className="btn btn-white">
            <Filter size={17} /> Filters <span>2</span>
          </button>
        </div>
        <div className="filter-chips">
          <button className="active">All projects</button>
          <button>Best matches</button>
          <button>New today</button>
          <button>Remote</button>
          <button>Saved ({saved.length})</button>
        </div>
        <div className="market-layout">
          <div>
            <div className="results-head">
              <b>
                {
                  initialProjects.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
                    .length
                }{" "}
                opportunities
              </b>
              <button>
                Newest first <ChevronDown />
              </button>
            </div>
            <div className="project-grid">
              {initialProjects
                .filter((p) => `${p.title} ${p.skills}`.toLowerCase().includes(query.toLowerCase()))
                .map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onClick={() => setSelected(p)}
                    saved={saved.includes(p.id)}
                    onSave={() => {
                      setSaved((v) =>
                        v.includes(p.id) ? v.filter((x) => x !== p.id) : [...v, p.id],
                      );
                      toast(saved.includes(p.id) ? "Removed from saved projects" : "Project saved");
                    }}
                  />
                ))}
            </div>
          </div>
          <aside className="insight-card">
            <div className="insight-icon">
              <Sparkles />
            </div>
            <h3>Make your matches stronger</h3>
            <p>Verify your Figma skill to unlock more high-match opportunities.</p>
            <div>
              <span>Profile match strength</span>
              <b>82%</b>
            </div>
            <div className="progress">
              <i style={{ width: "82%" }}></i>
            </div>
            <button onClick={() => setActive("Skill Verification")}>
              Verify a skill <ArrowRight />
            </button>
          </aside>
        </div>
      </main>
    );
  if (active === "My Applications")
    return <Applications applied={applied} onBrowse={() => setActive("Explore Projects")} />;
  if (active === "Active Projects") return <ActiveProject toast={toast} />;
  if (active === "Messages") return <Messages />;
  if (active === "My Portfolio") return <Portfolio toast={toast} />;
  if (active === "Skill Verification") return <Verification toast={toast} />;
  if (active === "Reviews") return <Reviews role="talent" toast={toast} />;
  if (active === "Settings") return <SettingsPage role="talent" toast={toast} />;
  return <TalentOverview onNavigate={setActive} onProject={setSelected} />;
}

function TalentOverview({
  onNavigate,
  onProject,
}: {
  onNavigate: (s: string) => void;
  onProject: (p: Project) => void;
}) {
  return (
    <main className="page dashboard-page">
      <div className="welcome-row">
        <div>
          <span>MONDAY, MAY 12</span>
          <h1>Good morning, Mika.</h1>
          <p>Three new opportunities match your verified skills today.</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate("Explore Projects")}>
          Find a project <Search size={17} />
        </button>
      </div>
      <div className="stat-grid">
        <Stat
          icon={BriefcaseBusiness}
          tone="blue"
          value="12"
          label="Applications"
          delta="+3 this week"
        />
        <Stat
          icon={FolderKanban}
          tone="purple"
          value="02"
          label="Active projects"
          delta="1 due soon"
        />
        <Stat
          icon={CheckCircle2}
          tone="green"
          value="08"
          label="Completed"
          delta="100% success rate"
        />
        <Stat icon={Star} tone="amber" value="4.9" label="Client rating" delta="from 8 reviews" />
      </div>
      <div className="dashboard-grid">
        <section className="panel profile-progress">
          <div className="panel-head">
            <div>
              <b>Complete your profile</b>
              <span>Strong profiles get 2× more project invites.</span>
            </div>
            <strong>82%</strong>
          </div>
          <div className="progress">
            <i style={{ width: "82%" }}></i>
          </div>
          <div className="check-row">
            <span className="done">
              <Check /> Basic profile
            </span>
            <span className="done">
              <Check /> Skills added
            </span>
            <span>
              <span className="dot"></span> Add 2 portfolio items
            </span>
            <button onClick={() => onNavigate("My Portfolio")}>
              Continue <ArrowRight />
            </button>
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-title">
            <b>Recent activity</b>
            <button>View all</button>
          </div>
          <ActivityItem
            icon={Eye}
            text={
              <>
                <b>Kape Norte Co.</b> viewed your profile
              </>
            }
            time="18 min ago"
          />
          <ActivityItem
            icon={MessageSquare}
            text={
              <>
                New message from <b>Daniel</b>
              </>
            }
            time="2h ago"
          />
          <ActivityItem
            icon={CheckCircle2}
            text={
              <>
                Application moved to <b>Shortlisted</b>
              </>
            }
            time="Yesterday"
          />
        </section>
        <section className="panel recommendations">
          <div className="panel-title">
            <div>
              <b>Recommended for you</b>
              <span>Based on your skills and preferences</span>
            </div>
            <button onClick={() => onNavigate("Explore Projects")}>
              View all <ArrowRight />
            </button>
          </div>
          <div className="compact-projects">
            {initialProjects.slice(0, 3).map((p) => (
              <div className="compact-project" onClick={() => onProject(p)} key={p.id}>
                <Avatar initials={p.initials} color={p.color} />
                <div>
                  <span>{p.company}</span>
                  <b>{p.title}</b>
                  <div className="tags">
                    {p.skills.slice(0, 2).map((s) => (
                      <i key={s}>{s}</i>
                    ))}
                  </div>
                </div>
                <div className="compact-end">
                  <strong>{php(p.budget)}</strong>
                  <Badge tone="green">{p.match}% match</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel skills-panel">
          <div className="panel-title">
            <b>Your verified skills</b>
            <button onClick={() => onNavigate("Skill Verification")}>Manage</button>
          </div>
          <div className="verified-skill">
            <span>
              <ShieldCheck /> Figma
            </span>
            <Badge tone="green">Verified</Badge>
          </div>
          <div className="verified-skill">
            <span>
              <ShieldCheck /> UI Design
            </span>
            <Badge tone="green">Verified</Badge>
          </div>
          <div className="verified-skill muted">
            <span>
              <Clock3 /> React
            </span>
            <Badge tone="amber">In review</Badge>
          </div>
          <div className="rating-box">
            <Star fill="currentColor" />
            <div>
              <b>Top 8%</b>
              <span>among design talents</span>
            </div>
          </div>
        </section>
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
}: {
  project: Project;
  onBack: () => void;
  onApply: () => void;
  applied: boolean;
}) {
  const [modal, setModal] = useState(false);
  return (
    <main className="page detail-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft /> Back to projects
      </button>
      <div className="detail-layout">
        <div>
          <section className="panel detail-hero">
            <div className="project-top">
              <Avatar initials={project.initials} color={project.color} size="lg" />
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
            <p>
              We’re looking for a motivated emerging professional to help us bring this project to
              life. You’ll work closely with our small team, with clear feedback and practical
              support throughout.
            </p>
            <h3>Project objectives</h3>
            <ul>
              <li>Create a polished, accessible experience aligned with our brand.</li>
              <li>Translate business needs into clear and practical solutions.</li>
              <li>Deliver organized source files and simple documentation.</li>
            </ul>
            <h3>Key deliverables</h3>
            <ul>
              <li>Initial direction and working draft</li>
              <li>Two rounds of structured revisions</li>
              <li>Final production-ready files and handover</li>
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
            <p>Your verified skills align strongly with this project.</p>
            <div className="fit-list">
              <span>
                <Check /> Figma proficiency
              </span>
              <span>
                <Check /> Portfolio quality
              </span>
              <span>
                <Check /> Availability match
              </span>
            </div>
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
            <button className="btn btn-white full">
              <Heart /> Save project
            </button>
            <small>Applications close in 6 days</small>
          </div>
          <div className="panel business-card">
            <span>ABOUT THE BUSINESS</span>
            <div>
              <Avatar initials={project.initials} color={project.color} />
              <h3>{project.company}</h3>
            </div>
            <p>
              Growing Filipino business creating thoughtful products and services for modern
              communities.
            </p>
            <div>
              <span>
                Projects posted <b>8</b>
              </span>
              <span>
                Hire rate <b>88%</b>
              </span>
              <span>
                Rating <b>4.9 ★</b>
              </span>
            </div>
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
              <textarea defaultValue="Hi! I’m excited about this project because it closely matches my UI/UX and Figma experience. I’d love to help your team create a polished, thoughtful solution." />
            </label>
            <label>
              Relevant portfolio work
              <select>
                <option>Alaga Mobile App Case Study</option>
                <option>Local Commerce Website Redesign</option>
              </select>
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
                onApply();
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

function Applications({ applied, onBrowse }: { applied: number[]; onBrowse: () => void }) {
  const items = [
    initialProjects[4],
    ...applied
      .filter((x) => x !== 5)
      .map((id) => initialProjects.find((p) => p.id === id)!)
      .filter(Boolean),
  ];
  return (
    <main className="page">
      <PageTitle
        eyebrow="MY APPLICATIONS"
        title="Track every opportunity"
        text="Stay on top of your proposals and next steps."
      />
      <div className="tabs">
        <button className="active">
          All <span>{items.length + 2}</span>
        </button>
        <button>
          Under review <span>2</span>
        </button>
        <button>
          Shortlisted <span>1</span>
        </button>
        <button>Accepted</button>
        <button>Closed</button>
      </div>
      <div className="panel application-list">
        {items.map((p, i) => (
          <div className="application-row" key={p.id}>
            <Avatar initials={p.initials} color={p.color} />
            <div>
              <span>{p.company}</span>
              <b>{p.title}</b>
              <small>Applied {i ? "Just now" : "May 8, 2026"}</small>
            </div>
            <div className="application-status">
              <Badge tone={i ? "blue" : "amber"}>{i ? "Submitted" : "Shortlisted"}</Badge>
              <span className="timeline-mini">
                <i className="done"></i>
                <i className="done"></i>
                <i className={!i ? "active" : ""}></i>
                <i></i>
              </span>
            </div>
            <button>
              <ChevronRight />
            </button>
          </div>
        ))}
        <div className="empty-inline">
          <Sparkles />
          <div>
            <b>Keep your momentum going</b>
            <span>New opportunities are added every day.</span>
          </div>
          <button className="btn btn-white" onClick={onBrowse}>
            Browse projects
          </button>
        </div>
      </div>
    </main>
  );
}

function ActiveProject({ toast }: { toast: (s: string) => void }) {
  const [done, setDone] = useState([true, true, false, false]);
  const progress = Math.round((done.filter(Boolean).length / done.length) * 100);
  return (
    <main className="page">
      <PageTitle
        eyebrow="ACTIVE PROJECT"
        title="Alaga Health Mobile App"
        text="UI/UX Design · Due June 4, 2026"
        action={<Badge tone="green">On track</Badge>}
      />
      <div className="workspace-grid">
        <section className="panel">
          <div className="workspace-progress">
            <div>
              <span>Overall progress</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress">
              <i style={{ width: `${progress}%` }}></i>
            </div>
            <small>
              {done.filter(Boolean).length} of {done.length} milestones complete
            </small>
          </div>
          <div className="panel-title">
            <b>Milestones & tasks</b>
            <button>
              <Plus /> Add task
            </button>
          </div>
          {[
            "Research & user flows",
            "Low-fidelity wireframes",
            "High-fidelity UI design",
            "Interactive prototype & handoff",
          ].map((m, i) => (
            <label className={`milestone ${done[i] ? "done" : ""}`} key={m}>
              <button onClick={() => setDone((v) => v.map((x, j) => (j === i ? !x : x)))}>
                {done[i] ? <Check /> : i + 1}
              </button>
              <div>
                <b>{m}</b>
                <span>{i < 2 ? "Completed" : i === 2 ? "Due May 24" : "Due June 4"}</span>
              </div>
              {i === 2 && <Badge tone="blue">In progress</Badge>}
            </label>
          ))}
        </section>
        <aside>
          <div className="panel project-people">
            <b>Project team</b>
            <div>
              <Avatar initials="MR" />
              <span>
                <b>Mika Reyes</b>
                <small>Designer · You</small>
              </span>
            </div>
            <div>
              <Avatar initials="DL" color="#805AD5" />
              <span>
                <b>Dr. Dana Lim</b>
                <small>Project owner</small>
              </span>
            </div>
            <button className="btn btn-white full">
              <MessageSquare /> Open project chat
            </button>
          </div>
          <div className="panel deliverable">
            <b>Next deliverable</b>
            <span>High-fidelity UI design</span>
            <small>Due in 7 days</small>
            <button
              className="btn btn-primary full"
              onClick={() => toast("Deliverable submitted for review")}
            >
              <Upload /> Submit deliverable
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Messages() {
  const [msgs, setMsgs] = useState([
    "Hi Mika! The wireframes look great. We left a few notes in Figma.",
    "Thank you! I’ll review those today and send the next revision by tomorrow afternoon.",
  ]);
  const [text, setText] = useState("");
  return (
    <main className="messages-page">
      <div className="conversation-list">
        <div className="messages-head">
          <h2>Messages</h2>
          <button>
            <PenLine />
          </button>
        </div>
        <div className="conversation-search">
          <Search />
          <input placeholder="Search conversations" />
        </div>
        {[
          [
            "DL",
            "Dana Lim",
            "Alaga Health",
            "Thanks, Mika! Looking forward…",
            "10:42 AM",
            "#805AD5",
          ],
          [
            "DG",
            "Daniel Go",
            "SariSari Studio",
            "Can you share the latest link?",
            "Yesterday",
            "#087EAD",
          ],
          [
            "JM",
            "Joana Mercado",
            "Kape Norte Co.",
            "Your application stood out.",
            "Mon",
            "#E0527D",
          ],
        ].map((c, i) => (
          <button className={`conversation ${i === 0 ? "active" : ""}`} key={c[0]}>
            <Avatar initials={c[0]} color={c[5]} size="sm" />
            <div>
              <b>{c[1]}</b>
              <span>{c[2]}</span>
              <p>{c[3]}</p>
            </div>
            <small>
              {c[4]}
              {i === 0 && <i>2</i>}
            </small>
          </button>
        ))}
      </div>
      <div className="chat">
        <header>
          <Avatar initials="DL" color="#805AD5" />
          <div>
            <b>Dana Lim</b>
            <span>
              <i></i> Online · Alaga Health
            </span>
          </div>
          <button>
            <MoreHorizontal />
          </button>
        </header>
        <div className="project-context">
          <FolderKanban />
          <div>
            <span>PROJECT</span>
            <b>Alaga Health Mobile App</b>
          </div>
          <Badge tone="green">On track</Badge>
          <ChevronRight />
        </div>
        <div className="chat-body">
          <div className="date-separator">TODAY</div>
          {msgs.map((m, i) => (
            <div className={`bubble-row ${i % 2 ? "mine" : ""}`} key={i}>
              {!i && <Avatar initials="DL" color="#805AD5" size="sm" />}
              <div className="bubble">
                {m}
                <small>{i ? "10:40 AM" : "10:32 AM"}</small>
              </div>
            </div>
          ))}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (text) {
              setMsgs([...msgs, text]);
              setText("");
            }
          }}
        >
          <button type="button">
            <Paperclip />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
          />
          <button className="send" type="submit">
            <Send />
          </button>
        </form>
      </div>
    </main>
  );
}

function Portfolio({ toast }: { toast: (s: string) => void }) {
  return (
    <main className="page">
      <PageTitle
        eyebrow="MY PORTFOLIO"
        title="Your work, your story"
        text="A professional profile that grows with every project."
        action={
          <button className="btn btn-primary" onClick={() => toast("Portfolio editing enabled")}>
            <PenLine /> Edit profile
          </button>
        }
      />
      <section className="panel portfolio-hero">
        <div className="portfolio-cover"></div>
        <div className="portfolio-profile">
          <Avatar initials="MR" size="lg" />
          <div>
            <h2>
              Mika Reyes <ShieldCheck />
            </h2>
            <b>UI/UX Designer crafting clear, human digital products.</b>
            <span>
              <GraduationCap /> De La Salle University · Makati City
            </span>
          </div>
          <div>
            <strong>
              4.9 <Star fill="currentColor" />
            </strong>
            <span>8 client reviews</span>
          </div>
        </div>
      </section>
      <div className="portfolio-grid">
        <section className="panel rich-copy">
          <h2>About me</h2>
          <p>
            I’m an aspiring product designer who cares about making technology feel useful,
            inclusive, and distinctly human. I enjoy turning complex problems into simple
            experiences.
          </p>
          <h3>Verified skills</h3>
          <div className="skill-cloud">
            <Badge tone="green">
              <ShieldCheck /> Figma
            </Badge>
            <Badge tone="green">
              <ShieldCheck /> UI Design
            </Badge>
            <Badge tone="blue">User Research</Badge>
            <Badge tone="blue">Prototyping</Badge>
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <b>Portfolio highlights</b>
            <button>
              Add work <Plus />
            </button>
          </div>
          <div className="portfolio-gallery">
            <div className="work-card work-one">
              <span>ALAGA HEALTH</span>
              <b>Making community care easier to access</b>
            </div>
            <div className="work-card work-two">
              <span>LOCAL COMMERCE</span>
              <b>A simpler way to shop local</b>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Verification({ toast }: { toast: (s: string) => void }) {
  return (
    <main className="page">
      <PageTitle
        eyebrow="SKILL VERIFICATION"
        title="Turn your skills into trusted signals"
        text="Complete short prototype assessments to demonstrate practical knowledge."
      />
      <div className="prototype-note">
        <ShieldCheck />
        <div>
          <b>Prototype demonstration only</b>
          <span>These sample assessments do not issue actual professional certifications.</span>
        </div>
      </div>
      <div className="verification-grid">
        {[
          ["Figma", "Interface Design", "Verified", "green", 96],
          ["UI Design", "Design Foundations", "Verified", "green", 91],
          ["React", "Web Development", "In review", "amber", 82],
          ["User Research", "Product Design", "Available", "blue", 0],
          ["Data Analytics", "Data", "Available", "blue", 0],
          ["Content Strategy", "Marketing", "Available", "blue", 0],
        ].map((v) => (
          <div className="panel verification-card" key={v[0] as string}>
            <div className={`verify-icon ${v[3]}`}>
              <ShieldCheck />
            </div>
            <Badge tone={v[3] as string}>{v[2] as string}</Badge>
            <h3>{v[0] as string}</h3>
            <span>{v[1] as string}</span>
            {v[4] ? (
              <>
                <div className="score">
                  <strong>{v[4] as number}%</strong>
                  <small>Assessment score</small>
                </div>
                <button className="btn btn-white full">View results</button>
              </>
            ) : (
              <>
                <p>12 questions · Approx. 15 minutes</p>
                <button
                  className="btn btn-primary full"
                  onClick={() => toast(`${v[0]} prototype assessment started`)}
                >
                  Start assessment
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function BusinessApp({
  active,
  setActive,
  toast,
}: {
  active: string;
  setActive: (s: string) => void;
  toast: (s: string) => void;
}) {
  const [posted, setPosted] = useState<Project[]>([]);
  if (active === "Post a Project")
    return (
      <PostProject
        onPublish={(p) => {
          setPosted([...posted, p]);
          toast("Project published successfully");
          setActive("My Projects");
        }}
      />
    );
  if (active === "Find Talent") return <TalentMarket toast={toast} />;
  if (active === "Applications") return <ApplicantBoard toast={toast} />;
  if (active === "Messages") return <Messages />;
  if (active === "Payments") return <Payments />;
  if (active === "Analytics") return <Analytics />;
  if (active === "Active Projects") return <ActiveProject toast={toast} />;
  if (active === "Settings") return <SettingsPage role="business" toast={toast} />;
  if (active === "My Projects")
    return (
      <main className="page">
        <PageTitle
          eyebrow="PROJECTS"
          title="Your project listings"
          text="Manage opportunities and track performance."
          action={
            <button className="btn btn-primary" onClick={() => setActive("Post a Project")}>
              <Plus /> Post a project
            </button>
          }
        />
        <div className="project-grid">
          {[...posted, ...initialProjects.slice(0, 3)].map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => {}}
              saved={false}
              onSave={() => {}}
            />
          ))}
        </div>
      </main>
    );
  return <BusinessOverview onNavigate={setActive} />;
}

function BusinessOverview({ onNavigate }: { onNavigate: (s: string) => void }) {
  return (
    <main className="page dashboard-page">
      <div className="welcome-row">
        <div>
          <span>BUSINESS WORKSPACE</span>
          <h1>Welcome back, Daniel.</h1>
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
          value="05"
          label="Active listings"
          delta="+1 this month"
        />
        <Stat
          icon={Users}
          tone="purple"
          value="48"
          label="Total applicants"
          delta="+12 this week"
        />
        <Stat
          icon={FolderKanban}
          tone="green"
          value="03"
          label="Ongoing projects"
          delta="All on track"
        />
        <Stat
          icon={WalletCards}
          tone="amber"
          value="₱86K"
          label="Project spending"
          delta="this quarter"
        />
      </div>
      <div className="business-dash-grid">
        <section className="panel applicant-panel">
          <div className="panel-title">
            <div>
              <b>Recent applications</b>
              <span>12 new applications this week</span>
            </div>
            <button onClick={() => onNavigate("Applications")}>
              View all <ArrowRight />
            </button>
          </div>
          {talents.slice(0, 4).map((t, i) => (
            <div className="talent-row" key={t.name}>
              <Avatar initials={t.initials} color={t.color} />
              <div>
                <b>{t.name}</b>
                <span>
                  {t.role} · {t.school}
                </span>
                <div className="tags">
                  {t.skills.slice(0, 2).map((s) => (
                    <i key={s}>{s}</i>
                  ))}
                </div>
              </div>
              <div>
                <Badge tone="green">{t.match}% match</Badge>
                <small>{i + 1}h ago</small>
              </div>
              <button>
                <ChevronRight />
              </button>
            </div>
          ))}
        </section>
        <section className="panel performance">
          <div className="panel-title">
            <b>Project performance</b>
            <button>
              This year <ChevronDown />
            </button>
          </div>
          <div className="donut-wrap">
            <div className="donut">
              <span>
                <b>87%</b>completion
              </span>
            </div>
            <div>
              <span>
                <i className="green-dot"></i> Completed <b>14</b>
              </span>
              <span>
                <i className="blue-dot"></i> Active <b>3</b>
              </span>
              <span>
                <i className="gray-dot"></i> Draft <b>2</b>
              </span>
            </div>
          </div>
          <div className="performance-note">
            <TrendingUp />
            <span>
              <b>12% higher</b> completion rate than last quarter
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
            {talents.slice(0, 3).map((t) => (
              <div key={t.name}>
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
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function PostProject({ onPublish }: { onPublish: (p: Project) => void }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("15000");
  const publish = () =>
    onPublish({
      id: Date.now(),
      title: title || "New Business Project",
      company: "SariSari Studio",
      initials: "SS",
      color: "#087EAD",
      description: "A new opportunity to collaborate with our growing team.",
      budget: Number(budget),
      duration: "4 weeks",
      skills: ["Figma", "UI Design"],
      applicants: 0,
      match: 93,
      category: "Design",
      posted: "Just now",
    });
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
                <select>
                  <option>Design & Creative</option>
                  <option>Web Development</option>
                  <option>Digital Marketing</option>
                  <option>Data & Analytics</option>
                </select>
              </label>
              <label>
                Project description
                <textarea placeholder="Describe the problem, context, and what success looks like…" />
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <label>
                Project objectives
                <textarea defaultValue="Create a clear, easy-to-use mobile experience that makes our service more accessible." />
              </label>
              <label>
                Key deliverables
                <textarea
                  defaultValue={
                    "User flows and wireframes\nHigh-fidelity UI designs\nClickable prototype and handoff"
                  }
                />
              </label>
              <label>
                Required skills
                <div className="skill-input-tags">
                  <Badge tone="blue">
                    Figma <X />
                  </Badge>
                  <Badge tone="blue">
                    UI Design <X />
                  </Badge>
                  <input placeholder="Add a skill" />
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
                <select>
                  <option>4 weeks</option>
                  <option>2 weeks</option>
                  <option>6–8 weeks</option>
                </select>
              </label>
              <label>
                Application deadline
                <input type="date" defaultValue="2026-06-15" />
              </label>
              <label>
                Work setup
                <select>
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
                <Avatar initials="SS" />
                <div>
                  <span>SariSari Studio</span>
                  <small>Posting now</small>
                </div>
              </div>
              <h2>{title || "Your project title"}</h2>
              <p>A new opportunity to collaborate with our growing team.</p>
              <div className="tags">
                <span>Figma</span>
                <span>UI Design</span>
              </div>
              <div className="project-meta">
                <span>
                  <CircleDollarSign /> {php(Number(budget))}
                </span>
                <span>
                  <Clock3 /> 4 weeks
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
              onClick={() => (step === 4 ? publish() : setStep(step + 1))}
            >
              {step === 4 ? "Publish project" : "Continue"} <ArrowRight />
            </button>
          </div>
        </section>
        <aside className="panel form-tip">
          <div>
            <Sparkles />
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

function TalentMarket({ toast }: { toast: (s: string) => void }) {
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
          <input placeholder="Search skills, roles, or schools…" />
        </div>
        <button className="btn btn-white">
          <Filter /> Filters <span>3</span>
        </button>
      </div>
      <div className="talent-market-grid">
        {talents.map((t) => (
          <article className="panel talent-profile-card" key={t.name}>
            <div
              className="talent-cover"
              style={{ "--accent": t.color } as React.CSSProperties}
            ></div>
            <Avatar initials={t.initials} color={t.color} size="lg" />
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
              <button className="btn btn-white">View profile</button>
              <button
                className="btn btn-primary"
                onClick={() => toast(`Invitation sent to ${t.name}`)}
              >
                Invite
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

function ApplicantBoard({ toast }: { toast: (s: string) => void }) {
  const [board, setBoard] = useState<Record<string, typeof talents>>({
    New: talents.slice(0, 3),
    Review: talents.slice(3, 5),
    Shortlisted: talents.slice(5, 7),
    Accepted: talents.slice(7, 8),
  });
  const move = (from: string, index: number) => {
    const t = board[from][index];
    const to = from === "New" ? "Review" : from === "Review" ? "Shortlisted" : "Accepted";
    setBoard({
      ...board,
      [from]: board[from].filter((_, i) => i !== index),
      [to]: [...board[to], t],
    });
    toast(`${t.name} moved to ${to}`);
  };
  return (
    <main className="page kanban-page">
      <PageTitle
        eyebrow="APPLICANT PIPELINE"
        title="Review applicants with clarity"
        text="E-Commerce Website Development"
        action={
          <button className="btn btn-white">
            <Filter /> Filter
          </button>
        }
      />
      <div className="kanban">
        {Object.entries(board).map(([column, people]) => (
          <div className="kanban-column" key={column}>
            <div className="kanban-head">
              <span>
                <i className={column.toLowerCase()}></i>
                {column === "Review" ? "Under Review" : column}
              </span>
              <b>{people.length}</b>
            </div>
            {people.map((t, i) => (
              <div className="applicant-card" key={t.name}>
                <div>
                  <Avatar initials={t.initials} color={t.color} />
                  <Badge tone="green">{t.match}%</Badge>
                </div>
                <h3>{t.name}</h3>
                <span>{t.role}</span>
                <div className="tags">
                  {t.skills.slice(0, 2).map((s) => (
                    <i key={s}>{s}</i>
                  ))}
                </div>
                <p>
                  <Star fill="currentColor" /> {t.rating} · {t.projects} projects
                </p>
                {column !== "Accepted" && (
                  <button onClick={() => move(column, i)}>
                    {column === "New" ? "Review" : column === "Review" ? "Shortlist" : "Accept"}{" "}
                    <ArrowRight />
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

function Payments() {
  return (
    <main className="page">
      <PageTitle
        eyebrow="PAYMENTS"
        title="Simple, transparent project payments"
        text="Track project budgets and simulated transactions."
      />
      <div className="prototype-note">
        <LockKeyhole />
        <div>
          <b>Simulated payments only</b>
          <span>No real transactions are processed in this prototype.</span>
        </div>
      </div>
      <div className="stat-grid">
        <Stat
          icon={WalletCards}
          tone="blue"
          value="₱86K"
          label="Total spending"
          delta="this quarter"
        />
        <Stat icon={Clock3} tone="amber" value="₱15K" label="In escrow" delta="1 active project" />
        <Stat icon={CheckCircle2} tone="green" value="₱62K" label="Released" delta="8 payments" />
        <Stat
          icon={CircleDollarSign}
          tone="purple"
          value="₱4.3K"
          label="Platform fees"
          delta="5% transaction fee"
        />
      </div>
      <section className="panel data-panel">
        <div className="panel-title">
          <b>Transaction history</b>
          <button>Download report</button>
        </div>
        {[
          ["Alaga Health Mobile App", "Mika Reyes", "May 8, 2026", "₱10,000", "In escrow"],
          ["E-Commerce Storefront", "Paolo Santos", "Apr 26, 2026", "₱15,000", "Completed"],
          ["Social Branding Kit", "Alyssa Cruz", "Apr 12, 2026", "₱5,000", "Completed"],
        ].map((r) => (
          <div className="data-row" key={r[0]}>
            <div>
              <b>{r[0]}</b>
              <span>{r[1]}</span>
            </div>
            <span>{r[2]}</span>
            <strong>{r[3]}</strong>
            <Badge tone={r[4] === "Completed" ? "green" : "amber"}>{r[4]}</Badge>
          </div>
        ))}
      </section>
    </main>
  );
}

function Analytics() {
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
          value="19"
          label="Projects posted"
          delta="+5 this quarter"
        />
        <Stat
          icon={CheckCircle2}
          tone="green"
          value="87%"
          label="Completion rate"
          delta="+12% vs last quarter"
        />
        <Stat
          icon={WalletCards}
          tone="purple"
          value="₱214K"
          label="Total spending"
          delta="lifetime"
        />
        <Stat icon={Star} tone="amber" value="4.8" label="Talent rating" delta="average given" />
      </div>
      <div className="analytics-grid">
        <section className="panel chart-panel">
          <div className="panel-title">
            <div>
              <b>Applications over time</b>
              <span>Last 6 months</span>
            </div>
            <button>
              6 months <ChevronDown />
            </button>
          </div>
          <div className="bar-chart">
            {[38, 52, 46, 68, 62, 88, 74, 96, 80, 110, 98, 126].map((n, i) => (
              <div key={i}>
                <i style={{ height: `${n}px` }}></i>
                <span>{i % 2 === 0 ? ["Dec", "Jan", "Feb", "Mar", "Apr", "May"][i / 2] : ""}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <b>Project status</b>
          </div>
          <div className="large-donut">
            <span>
              <b>19</b>projects
            </span>
          </div>
          <div className="legend">
            <span>
              <i className="green-dot"></i>Completed <b>14</b>
            </span>
            <span>
              <i className="blue-dot"></i>Active <b>3</b>
            </span>
            <span>
              <i className="gray-dot"></i>Draft <b>2</b>
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminApp({ active, setActive }: { active: string; setActive: (s: string) => void }) {
  if (active === "User Management")
    return (
      <AdminTable
        title="User management"
        text="Review and manage platform accounts."
        rows={talents.slice(0, 8).map((t) => [t.name, t.role, t.school, "Verified"])}
      />
    );
  if (active === "Skill Verifications")
    return (
      <AdminTable
        title="Skill verification requests"
        text="Review prototype assessment submissions."
        rows={talents
          .slice(0, 6)
          .map((t, i) => [
            t.name,
            t.skills[0],
            `May ${12 - i}, 2026`,
            i < 2 ? "Pending" : "Verified",
          ])}
      />
    );
  if (active === "Project Moderation")
    return (
      <AdminTable
        title="Project moderation"
        text="Ensure listings meet GAWA community standards."
        rows={initialProjects
          .slice(0, 7)
          .map((p) => [p.title, p.company, php(p.budget), "Published"])}
      />
    );
  if (active === "Transactions") return <Payments />;
  if (active === "Platform Analytics") return <Analytics />;
  if (active === "Reviews & Reports")
    return (
      <AdminTable
        title="Reviews and reports"
        text="Review community feedback and resolve reported activity."
        rows={talents
          .slice(0, 6)
          .map((t, i) => [
            `${t.name} review`,
            i % 2 ? "Business review" : "Talent review",
            `Reported May ${12 - i}, 2026`,
            i < 2 ? "Pending" : "Verified",
          ])}
      />
    );
  if (active === "Settings") return <SettingsPage role="admin" toast={() => {}} />;
  return <AdminOverview onNavigate={setActive} />;
}

function Reviews({ role, toast }: { role: Role; toast: (message: string) => void }) {
  const [rating, setRating] = useState(0);
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
            <strong>4.9</strong>
            <div>
              <span className="stars">★★★★★</span>
              <small>Based on 8 completed projects</small>
            </div>
          </div>
          {[
            [
              "Daniel Go",
              "SariSari Studio",
              "Mika brought clarity to every stage and delivered thoughtful work ahead of schedule.",
            ],
            [
              "Joana Mercado",
              "Kape Norte Co.",
              "Excellent communication and a strong eye for practical details.",
            ],
          ].map((review) => (
            <article className="review-item" key={review[0]}>
              <Avatar
                initials={review[0]
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
                size="sm"
              />
              <div>
                <b>{review[0]}</b>
                <span>{review[1]} · 5.0 ★</span>
                <p>{review[2]}</p>
              </div>
            </article>
          ))}
        </section>
        <section className="panel review-form">
          <span className="auth-kicker">COMPLETED PROJECT</span>
          <h2>Share your experience</h2>
          <p>
            {role === "talent"
              ? "Review your collaboration with Alaga Health."
              : "Review your collaboration with Mika Reyes."}
          </p>
          <div className="rating-picker">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setRating(star)}>
                <Star fill={star <= rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <label>
            Written feedback
            <textarea placeholder="What went well? What should future collaborators know?" />
          </label>
          <button
            className="btn btn-primary full"
            onClick={() => toast("Review submitted successfully")}
          >
            Submit review
          </button>
        </section>
      </div>
    </main>
  );
}

function SettingsPage({ role, toast }: { role: Role; toast: (message: string) => void }) {
  return (
    <main className="page">
      <PageTitle
        eyebrow="SETTINGS"
        title="Account preferences"
        text="Manage your profile, notifications, security, and privacy."
      />
      <div className="settings-layout">
        <nav className="panel settings-nav">
          <button className="active">
            <UserCheck /> Profile
          </button>
          <button>
            <Bell /> Notifications
          </button>
          <button>
            <LockKeyhole /> Security
          </button>
          <button>
            <WalletCards /> Billing
          </button>
        </nav>
        <section className="panel settings-form">
          <div className="panel-title">
            <div>
              <b>Profile information</b>
              <span>Keep your public details accurate and up to date.</span>
            </div>
          </div>
          <div className="form-grid">
            <label>
              {role === "business" ? "Business name" : "Display name"}
              <input
                defaultValue={
                  role === "business"
                    ? "SariSari Studio"
                    : role === "admin"
                      ? "Alex Rivera"
                      : "Mika Reyes"
                }
              />
            </label>
            <label>
              Email address
              <input
                defaultValue={
                  role === "business"
                    ? "hello@sarisari.ph"
                    : role === "admin"
                      ? "admin@gawa.ph"
                      : "mika.reyes@example.com"
                }
              />
            </label>
            <label className="wide">
              Short bio
              <textarea defaultValue="Building meaningful work through skill, action, and collaboration." />
            </label>
          </div>
          <div className="preference-toggle">
            <div>
              <b>Email notifications</b>
              <span>Receive project updates and important account notices.</span>
            </div>
            <input type="checkbox" defaultChecked />
          </div>
          <div className="preference-toggle">
            <div>
              <b>Profile visibility</b>
              <span>Allow verified GAWA members to discover your profile.</span>
            </div>
            <input type="checkbox" defaultChecked />
          </div>
          <div className="form-actions">
            <span></span>
            <button className="btn btn-primary" onClick={() => toast("Settings saved")}>
              Save changes
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminOverview({ onNavigate }: { onNavigate: (s: string) => void }) {
  return (
    <main className="page admin-page">
      <div className="welcome-row">
        <div>
          <span>PLATFORM ADMINISTRATION</span>
          <h1>Platform overview</h1>
          <p>Monitor the health, growth, and trust of the GAWA community.</p>
        </div>
        <Badge tone="green">
          <Activity /> All systems operational
        </Badge>
      </div>
      <div className="admin-stat-grid">
        <Stat
          icon={Users}
          tone="blue"
          value="3,248"
          label="Registered users"
          delta="+8.4% this month"
        />
        <Stat
          icon={GraduationCap}
          tone="purple"
          value="2,419"
          label="Active talents"
          delta="+126 this month"
        />
        <Stat icon={Building2} tone="green" value="629" label="Businesses" delta="+42 this month" />
        <Stat
          icon={BriefcaseBusiness}
          tone="amber"
          value="184"
          label="Active projects"
          delta="₱1.8M total value"
        />
      </div>
      <div className="admin-grid">
        <section className="panel chart-panel">
          <div className="panel-title">
            <div>
              <b>Platform growth</b>
              <span>Talent and business registrations</span>
            </div>
            <button>
              Last 12 months <ChevronDown />
            </button>
          </div>
          <div className="line-chart">
            <svg viewBox="0 0 600 210" preserveAspectRatio="none">
              <defs>
                <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#22B8E6" stopOpacity=".28" />
                  <stop offset="1" stopColor="#22B8E6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 180 C50 170 60 145 110 150 S180 120 220 125 S290 78 340 98 S410 65 450 70 S520 30 600 28 L600 210 L0 210Z"
                fill="url(#area)"
              />
              <path
                d="M0 180 C50 170 60 145 110 150 S180 120 220 125 S290 78 340 98 S410 65 450 70 S520 30 600 28"
                fill="none"
                stroke="#087EAD"
                strokeWidth="4"
              />
            </svg>
            <div>
              <span>Jun</span>
              <span>Aug</span>
              <span>Oct</span>
              <span>Dec</span>
              <span>Feb</span>
              <span>Apr</span>
            </div>
          </div>
        </section>
        <section className="panel trust-queue">
          <div className="panel-title">
            <b>Trust & safety queue</b>
            <button>View all</button>
          </div>
          {[
            [ShieldCheck, "Skill verifications", "18 pending", "blue"],
            [FileCheck2, "Project reviews", "7 pending", "amber"],
            [Star, "Reports & disputes", "3 open", "red"],
            [UserCheck, "Business checks", "9 pending", "purple"],
          ].map(([I, l, n, t]) => (
            <button
              key={l as string}
              onClick={() =>
                onNavigate(
                  l === "Skill verifications" ? "Skill Verifications" : "Project Moderation",
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
              <span>Latest notable events</span>
            </div>
            <button>View audit log</button>
          </div>
          {[
            ["New business verified", "Habi Home · 8 minutes ago", "Verified", "green"],
            ["Project completed", "Mobile App UI/UX · 22 minutes ago", "₱10,000", "blue"],
            ["Skill assessment flagged", "React · Mika Reyes · 1 hour ago", "Review", "amber"],
            [
              "New project published",
              "Sales Dashboard Development · 2 hours ago",
              "Published",
              "green",
            ],
          ].map((r) => (
            <div className="data-row" key={r[0]}>
              <div>
                <b>{r[0]}</b>
                <span>{r[1]}</span>
              </div>
              <Badge tone={r[3]}>{r[2]}</Badge>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function AdminTable({ title, text, rows }: { title: string; text: string; rows: string[][] }) {
  return (
    <main className="page">
      <PageTitle
        eyebrow="ADMINISTRATION"
        title={title}
        text={text}
        action={
          <button className="btn btn-white">
            <Filter /> Filters
          </button>
        }
      />
      <div className="search-filter">
        <div>
          <Search />
          <input placeholder="Search records…" />
        </div>
        <button className="btn btn-white">Export</button>
      </div>
      <section className="panel admin-table">
        <div className="table-head">
          <span>Name / Record</span>
          <span>Category</span>
          <span>Detail</span>
          <span>Status</span>
          <span></span>
        </div>
        {rows.map((r, i) => (
          <div className="table-row" key={i}>
            <span>
              <Avatar
                initials={r[0]
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")}
                size="sm"
              />
              <b>{r[0]}</b>
            </span>
            <span>{r[1]}</span>
            <span>{r[2]}</span>
            <Badge tone={r[3] === "Pending" ? "amber" : "green"}>{r[3]}</Badge>
            <button>
              <MoreHorizontal />
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [role, setRole] = useState<Role>("talent");
  const [initialRole, setInitialRole] = useState<Role | undefined>();
  const [active, setActive] = useState("Overview");
  const [notice, setNotice] = useState("");
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
    setRole(r);
    setActive(r === "admin" ? "Platform Overview" : "Overview");
    setView(onboarding ? "onboarding" : "app");
  };
  const logout = () => {
    setView("landing");
    setActive("Overview");
  };
  return (
    <>
      {view === "landing" && <Landing onNavigate={navigate} />}
      {(view === "login" || view === "register") && (
        <Auth
          mode={view}
          initialRole={initialRole}
          onBack={() => setView("landing")}
          onComplete={enter}
        />
      )}
      {view === "onboarding" && <Onboarding role={role} onDone={() => setView("app")} />}
      {view === "app" && (
        <Shell role={role} active={active} setActive={setActive} onLogout={logout}>
          {role === "talent" ? (
            <TalentApp active={active} setActive={setActive} toast={setNotice} />
          ) : role === "business" ? (
            <BusinessApp active={active} setActive={setActive} toast={setNotice} />
          ) : (
            <AdminApp active={active} setActive={setActive} />
          )}
        </Shell>
      )}
      {notice && (
        <div className="toast">
          <CheckCircle2 />
          {notice}
        </div>
      )}
    </>
  );
}
