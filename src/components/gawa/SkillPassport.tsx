"use client";
import { useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  Check,
  Fingerprint,
  Layers3,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import {
  buildPassportMarks,
  type SkillRecord,
  type VerificationRecord,
  type WorkRecord,
  type ReviewRecord,
} from "./evidence";

export function SkillPassport({
  name,
  skills = [],
  verifications = [],
  work = [],
  completed = [],
  reviews = [],
  onVerify,
  onAddWork,
}: {
  name: string;
  skills?: SkillRecord[];
  verifications?: VerificationRecord[];
  work?: WorkRecord[];
  completed?: WorkRecord[];
  reviews?: ReviewRecord[];
  onVerify?: () => void;
  onAddWork?: () => void;
}) {
  const [page, setPage] = useState<"skills" | "work" | "feedback">("skills");
  const [selected, setSelected] = useState<string | null>(null);
  const [cover, setCover] = useState(false);
  const [earnedOnly, setEarnedOnly] = useState(false);
  const marks = useMemo(
    () => buildPassportMarks(skills, verifications, work, completed, reviews),
    [skills, verifications, work, completed, reviews],
  );
  const current = marks.filter(
    (m) =>
      m.category === page &&
      (!earnedOnly || ["verified", "completed", "feedback"].includes(m.state)),
  );
  const active = current.find((m) => m.id === selected) || current[0];
  const verified = marks.filter((m) => m.state === "verified").length;
  const stages = [
    { label: "Galing", caption: "Name your strengths", done: skills.length > 0 },
    { label: "Aksyon", caption: "Put work out there", done: work.length + completed.length > 0 },
    { label: "Patunay", caption: "Build your evidence", done: verified + reviews.length > 0 },
  ];
  return (
    <section className="tatak-passport" aria-labelledby="tatak-heading">
      <div className="tatak-heading">
        <div>
          <span className="gawa-eyebrow">
            <Fingerprint size={16} /> A RECORD THAT IS YOURS
          </span>
          <h2 id="tatak-heading">
            Tatak <span>GAWA.</span>
          </h2>
          <p>Your skills leave a mark. Here is the proof behind yours.</p>
        </div>
        <button
          type="button"
          className="btn btn-white"
          aria-pressed={cover}
          onClick={() => setCover((v) => !v)}
        >
          <BookOpen size={17} />
          {cover ? "Open my passport" : "View passport cover"}
        </button>
      </div>
      <div className={`passport-book ${cover ? "is-covered" : ""}`}>
        <aside className="passport-identity">
          <div className="passport-brand">
            <span className="passport-brand-mark">
              <i />
              <i />
              <i />
            </span>{" "}
            GAWA <span>SKILL PASSPORT</span>
          </div>
          <div className="passport-seal" aria-hidden="true">
            <Fingerprint />
            <span>
              Galing. Aksyon.
              <br />
              Patunay.
            </span>
          </div>
          <div className="passport-holder">
            <small>THIS STORY BELONGS TO</small>
            <h3>{name}</h3>
            <p>A growing record of what you know, what you make, and how you work.</p>
          </div>
          <div className="passport-tally">
            <div>
              <b>{verified}</b>
              <span>verified skills</span>
            </div>
            <div>
              <b>{completed.length}</b>
              <span>completed work</span>
            </div>
          </div>
          <div className="passport-footnote">
            <ShieldCheck size={16} /> Evidence over empty claims.
          </div>
        </aside>
        {cover ? (
          <div className="passport-cover-message">
            <Layers3 size={38} />
            <h3>
              More than a résumé.
              <br />A record of becoming.
            </h3>
            <p>
              Your passport grows with real skills, work and feedback. Every mark opens its source.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setCover(false)}>
              Explore my marks
            </button>
          </div>
        ) : (
          <div className="passport-pages">
            <div className="passport-tabs" role="group" aria-label="Passport sections">
              {(
                [
                  { id: "skills", label: "Skills", icon: Award },
                  { id: "work", label: "Work", icon: Layers3 },
                  { id: "feedback", label: "Feedback", icon: Star },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={page === id}
                  onClick={() => {
                    setPage(id);
                    setSelected(null);
                  }}
                >
                  <Icon size={17} />
                  {label}
                  <span>{marks.filter((m) => m.category === id).length}</span>
                </button>
              ))}
            </div>
            <div className="passport-sheet" key={`${page}-${earnedOnly}`}>
              <div className="passport-sheet-heading">
                <div>
                  <span className="gawa-eyebrow">THE EVIDENCE COLLECTION</span>
                  <h3>
                    {page === "skills"
                      ? "Small marks. Real strengths."
                      : page === "work"
                        ? "Made with your own hands."
                        : "The people behind the proof."}
                  </h3>
                </div>
                <button
                  className="passport-filter"
                  type="button"
                  aria-pressed={earnedOnly}
                  onClick={() => setEarnedOnly((v) => !v)}
                >
                  <Check size={14} />
                  {earnedOnly ? "Earned records" : "All records"}
                </button>
              </div>
              <div className="passport-stamps" aria-label={`${page} records`}>
                {current.map((mark, index) => (
                  <button
                    type="button"
                    key={mark.id}
                    className={`passport-stamp stamp-${mark.state} ${active?.id === mark.id ? "is-selected" : ""}`}
                    aria-pressed={active?.id === mark.id}
                    aria-controls="passport-evidence"
                    onClick={() => setSelected(mark.id)}
                    style={
                      { "--stamp-angle": `${((index % 3) - 1) * 2}deg` } as React.CSSProperties
                    }
                  >
                    <span className="stamp-rim">
                      <span className="stamp-origin">
                        GAWA ·{" "}
                        {mark.category === "skills"
                          ? "SKILL RECORD"
                          : mark.category === "work"
                            ? "PROOF OF WORK"
                            : "COLLABORATION"}
                      </span>
                      {mark.state === "verified" ? (
                        <ShieldCheck size={25} />
                      ) : mark.category === "feedback" ? (
                        <Star size={25} />
                      ) : (
                        <Award size={25} />
                      )}
                      <b>{mark.title}</b>
                      <small>{mark.subtitle}</small>
                      <span className="stamp-bottom">
                        {mark.state === "verified"
                          ? "VERIFIED EVIDENCE"
                          : mark.state === "declared"
                            ? "GROWING POTENTIAL"
                            : "OPEN THE RECORD"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {!current.length && (
                <div className="passport-first-mark">
                  <span className="empty-stamp">
                    <Sparkles size={28} />
                  </span>
                  <h4>
                    {earnedOnly
                      ? "Your next earned mark is ahead."
                      : "A little space for your next chapter."}
                  </h4>
                  <p>
                    {page === "skills"
                      ? "List a skill below, then take an assessment when you are ready."
                      : page === "work"
                        ? "Add a real work sample or complete a collaboration to start this page."
                        : "Published reviews from your collaborations will appear here."}
                  </p>
                  {page === "skills" && onVerify ? (
                    <button type="button" className="btn btn-primary" onClick={onVerify}>
                      Explore skill assessments
                    </button>
                  ) : page === "work" && onAddWork ? (
                    <button type="button" className="btn btn-primary" onClick={onAddWork}>
                      Add a work sample
                    </button>
                  ) : null}
                </div>
              )}
              {active && (
                <div className="passport-evidence" id="passport-evidence" aria-live="polite">
                  <span className="evidence-pin" />
                  <div className="evidence-main">
                    <span className="gawa-eyebrow">BEHIND THE MARK</span>
                    <h4>{active.title}</h4>
                    <p>{active.detail}</p>
                    <dl>
                      {active.facts.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                      {active.date && (
                        <div>
                          <dt>Recorded</dt>
                          <dd>
                            {new Date(active.date).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </dd>
                        </div>
                      )}
                    </dl>
                    {active.url && (
                      <a
                        className="btn btn-white"
                        href={active.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open work sample
                      </a>
                    )}
                    {active.category === "skills" && active.state !== "verified" && onVerify && (
                      <button type="button" className="btn btn-white" onClick={onVerify}>
                        Build this skill's proof
                      </button>
                    )}
                  </div>
                  <span className={`evidence-status status-${active.state}`}>
                    {active.state === "verified" ? (
                      <ShieldCheck size={18} />
                    ) : (
                      <BookOpen size={18} />
                    )}
                    <span>{active.subtitle}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="gawa-proof-thread" aria-label="Your evidence journey">
        {stages.map((stage) => (
          <div key={stage.label} className={stage.done ? "is-reached" : ""}>
            <span>{stage.done ? <Check size={14} /> : <span />}</span>
            <div>
              <b>{stage.label}</b>
              <small>{stage.caption}</small>
            </div>
          </div>
        ))}
        <p>A growing record, at your own pace.</p>
      </div>
    </section>
  );
}
