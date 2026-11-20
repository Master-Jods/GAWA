"use client";
import { useState } from 'react';
import { Check, Fingerprint, FolderOpen, Lightbulb, ScanLine, ShieldCheck } from 'lucide-react';
const stories = {
  Design: { skill: 'Interface design', brief: 'Make an everyday service easier to use.', output: 'A thoughtful prototype, with the process behind it.' },
  Development: { skill: 'Web development', brief: 'Bring a local business idea to the web.', output: 'A working experience people can actually use.' },
  Research: { skill: 'User research', brief: 'Turn the right questions into a clearer direction.', output: 'Useful findings, grounded in real observations.' },
};
export function Fieldnotes({ onStart }: { onStart: () => void }) {
  const [chapter, setChapter] = useState<'galing' | 'aksyon' | 'patunay'>('galing');
  const [strength, setStrength] = useState<keyof typeof stories>('Design');
  const story = stories[strength];
  return <div className="fieldnotes-scene">
    <div className="fieldnotes-orbit" aria-hidden="true"/>
    <div className="fieldnotes-notebook">
      <div className="fieldnotes-spine" aria-hidden="true"><span/><span/><span/></div>
      <header className="fieldnotes-masthead"><div><Fingerprint size={25}/><b>GAWA<span>FIELDNOTES</span></b></div><span>Ideas become evidence.</span></header>
      <div className="fieldnotes-chapters" role="group" aria-label="Explore the GAWA journey">{(['galing','aksyon','patunay'] as const).map(c=><button type="button" key={c} aria-pressed={chapter===c} onClick={()=>setChapter(c)}>{c==='galing'?<Lightbulb size={16}/>:c==='aksyon'?<FolderOpen size={16}/>:<ShieldCheck size={16}/>}<span>{c}</span></button>)}</div>
      <div className="fieldnotes-paper" key={`${chapter}-${strength}`}>
        <span className="fieldnotes-margin" aria-hidden="true"/>
        <span className="gawa-eyebrow">{chapter==='galing'?'IT STARTS WITH WHAT YOU KNOW':chapter==='aksyon'?'GIVE YOUR STRENGTH A PURPOSE':'LET THE WORK TELL YOUR STORY'}</span>
        <h2>{chapter==='galing'?<>A little galing.<br/>A world of possibilities.</>:chapter==='aksyon'?<>Find a brief.<br/>Make it your own.</>:<>Leave more than<br/>a good impression.</>}</h2>
        <p>{chapter==='galing'?'Pick a strength and follow its next chapter.':chapter==='aksyon'?'Work with a business on something that matters.':'Build a passport of skills, work, and collaboration.'}</p>
        <div className="fieldnotes-strengths" role="group" aria-label="Choose an illustrative strength">{(Object.keys(stories) as (keyof typeof stories)[]).map(s=><button type="button" key={s} aria-pressed={strength===s} onClick={()=>setStrength(s)}>{s}</button>)}</div>
        <div className="fieldnotes-evidence"><span className="fieldnotes-label">{chapter==='galing'?'YOUR STARTING POINT':chapter==='aksyon'?'AN EXAMPLE PROJECT BRIEF':'YOUR POSSIBLE PROOF OF WORK'}</span><b>{chapter==='galing'?story.skill:chapter==='aksyon'?story.brief:story.output}</b><span>{chapter==='galing'?'A strength worth putting into action.':chapter==='aksyon'?'A real project turns knowledge into experience.':'Your passport connects the work to its story.'}</span></div>
        <div className="fieldnotes-bottom"><small>Illustrative journey · your own story comes next</small><button type="button" onClick={()=>chapter==='galing'?setChapter('aksyon'):chapter==='aksyon'?setChapter('patunay'):onStart()}>{chapter==='galing'?'Find its purpose':chapter==='aksyon'?'See the next chapter':'Start my story'}<Check size={14}/></button></div>
      </div>
      <footer className="fieldnotes-footer"><span>GALING · AKSYON · PATUNAY</span><ScanLine size={22}/></footer>
    </div>
    <div className="fieldnotes-tatak" aria-hidden="true"><Fingerprint size={23}/><span>TATAK<br/><b>GAWA</b></span></div>
  </div>;
}
