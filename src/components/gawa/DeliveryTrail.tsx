"use client";
import { Check, Flag, FolderOpen } from "lucide-react";
interface Milestone {
  id: string;
  title: string;
  status: string;
  due_at?: string | null;
  sort_order?: number;
  tasks?: { id: string; title: string; is_done: boolean }[];
}
export function DeliveryTrail({
  milestones,
  selected,
  onSelect,
  deliverables,
}: {
  milestones: Milestone[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  deliverables: { id: string; milestone_id?: string | null; title: string; status: string }[];
}) {
  const ordered = [...milestones].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const active = ordered.find((m) => m.id === selected);
  const attached = active ? deliverables.filter((d) => d.milestone_id === active.id) : [];
  return (
    <section className="delivery-trail" aria-labelledby="delivery-trail-heading">
      <div className="delivery-trail-heading">
        <div>
          <span className="gawa-eyebrow">
            <Flag size={14} /> GAWA DELIVERY TRAIL
          </span>
          <h2 id="delivery-trail-heading">Every step, a little closer.</h2>
          <p>Choose a milestone to bring its checklist into focus.</p>
        </div>
        {selected && (
          <button className="btn btn-white" type="button" onClick={() => onSelect(null)}>
            Show all tasks
          </button>
        )}
      </div>
      {!ordered.length ? (
        <p className="delivery-no-trail">
          Your trail will take shape when this project's milestones are added.
        </p>
      ) : (
        <>
          <div className="delivery-trail-stops" role="group" aria-label="Project milestones">
            {ordered.map((m, i) => {
              const done = m.tasks?.filter((t) => t.is_done).length || 0;
              const total = m.tasks?.length || 0;
              return (
                <button
                  type="button"
                  key={m.id}
                  aria-pressed={selected === m.id}
                  className={m.status === "completed" ? "stop-complete" : ""}
                  onClick={() => onSelect(selected === m.id ? null : m.id)}
                >
                  <span className="trail-node">
                    {m.status === "completed" ? <Check size={20} /> : <Flag size={19} />}
                  </span>
                  <b>{m.title}</b>
                  <small>
                    {m.status.replaceAll("_", " ")}
                    {total ? ` · ${done}/${total} tasks` : ""}
                  </small>
                </button>
              );
            })}
          </div>
          {active && (
            <div className="delivery-trail-note" aria-live="polite">
              <FolderOpen size={18} />
              <span>
                <b>{active.title}</b>
                {active.due_at &&
                  ` · Due ${new Date(active.due_at).toLocaleDateString("en-PH")}`}.{" "}
                {attached.length
                  ? `${attached.length} linked deliverable${attached.length === 1 ? "" : "s"}: ${attached.map((d) => `${d.title} (${d.status.replaceAll("_", " ")})`).join(", ")}.`
                  : "No deliverables linked to this milestone yet."}
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
