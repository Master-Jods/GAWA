"use client";
import { Focus, RotateCcw } from "lucide-react";
export function FitLens({
  skills,
  selected,
  onChange,
  count,
  onAddSkills,
}: {
  skills: string[];
  selected: string[];
  onChange: (skills: string[]) => void;
  count: number;
  onAddSkills: () => void;
}) {
  return (
    <section className="fit-lens" aria-labelledby="fit-lens-heading">
      <div className="fit-lens-intro">
        <span className="gawa-feature-icon">
          <Focus size={24} />
        </span>
        <div>
          <span className="gawa-eyebrow">GAWA FIT LENS</span>
          <h2 id="fit-lens-heading">Find work through your strengths.</h2>
          <p>
            Pick skills you want to use. See the requirements you meet, and the ones you can grow
            into.
          </p>
        </div>
      </div>
      <div className="fit-lens-controls">
        <div className="fit-lens-skills" role="group" aria-label="Focus projects by skill">
          {skills.map((skill) => (
            <button
              type="button"
              key={skill}
              aria-pressed={selected.includes(skill)}
              onClick={() =>
                onChange(
                  selected.includes(skill)
                    ? selected.filter((s) => s !== skill)
                    : [...selected, skill],
                )
              }
            >
              {skill}
            </button>
          ))}
          {!skills.length && (
            <button type="button" onClick={onAddSkills}>
              Add skills to your passport
            </button>
          )}
        </div>
        <div className="fit-lens-result" aria-live="polite">
          {selected.length ? (
            <>
              <b>{count}</b> matching opportunities{" "}
              <button type="button" aria-label="Clear focused skills" onClick={() => onChange([])}>
                <RotateCcw size={15} />
                Clear
              </button>
            </>
          ) : (
            <span>Select a skill to see where your strengths meet the brief.</span>
          )}
        </div>
      </div>
    </section>
  );
}
