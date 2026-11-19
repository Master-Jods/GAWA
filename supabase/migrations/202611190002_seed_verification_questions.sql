-- Activate the 6 core skill assessments and seed 5 practical questions per assessment
-- Idempotent: only inserts questions when an assessment has none yet.

update public.verification_assessments va
set
  title = case cs.name
    when 'Figma' then 'Figma Interface Design Assessment'
    when 'UI Design' then 'UI Design Foundations Assessment'
    when 'React' then 'React Development Assessment'
    when 'User Research' then 'User Research Essentials Assessment'
    when 'Data Analytics' then 'Data Analytics Fundamentals Assessment'
    when 'Content Strategy' then 'Content Strategy & Copywriting Assessment'
    else va.title
  end,
  description = case cs.name
    when 'Figma' then 'Demonstrate practical knowledge of components, auto layout, styles, and handoff.'
    when 'UI Design' then 'Verify your grasp of hierarchy, contrast, spacing, and accessible interface states.'
    when 'React' then 'Show proficiency in components, hooks, state updates, and rendering patterns.'
    when 'User Research' then 'Assess interview planning, usability testing, and turning insights into action.'
    when 'Data Analytics' then 'Test your ability to interpret metrics, clean data, and communicate findings.'
    when 'Content Strategy' then 'Evaluate audience clarity, structured messaging, and measurable content planning.'
    else va.description
  end,
  question_count = 5,
  duration_minutes = 10,
  passing_score = 80,
  is_active = true,
  updated_at = now()
from public.catalog_skills cs
where va.skill_id = cs.id
  and cs.name in ('Figma', 'UI Design', 'React', 'User Research', 'Data Analytics', 'Content Strategy');

with seeded_questions(skill_name, sort_order, prompt, options, correct_answer) as (
  values
    -- Figma
    ('Figma', 1, 'Why should you use Auto Layout frames instead of fixed groups for buttons and cards?',
      '["They automatically resize and adapt spacing when text or content changes", "They export directly as SQL tables", "They disable responsive constraints", "They prevent components from having variants"]'::jsonb, '0'::jsonb),
    ('Figma', 2, 'What is the main benefit of combining related UI states (default, hover, disabled) into a Component Set?',
      '["It locks all colors so they cannot be themed", "It keeps every state organized as switchable variants under one reusable component", "It converts vector shapes into raster PNGs", "It hides layers from developer inspect mode"]'::jsonb, '1'::jsonb),
    ('Figma', 3, 'Which feature lets you update a brand primary color across dozens of screens from one place?',
      '["Flattening every frame into an image", "Color Styles or Color Variables", "Detaching all instances", "Grouping layers manually"]'::jsonb, '1'::jsonb),
    ('Figma', 4, 'When preparing screens for developer handoff, what should you name and organize clearly?',
      '["Only the cover page", "Frames, reusable components, spacing tokens, and interactive states", "Hidden scratch layers only", "Temporary sticky notes"]'::jsonb, '1'::jsonb),
    ('Figma', 5, 'How do Constraints help a layout inside a resizing frame?',
      '["They control how child elements pin or stretch when the parent frame changes size", "They compress image file sizes on upload", "They add drop shadows automatically", "They prevent keyboard navigation"]'::jsonb, '0'::jsonb),

    -- UI Design
    ('UI Design', 1, 'What improves readability most for users who are new to digital apps?',
      '["Tiny gray text on a bright background", "Clear typography hierarchy, generous readable font sizes, and high text contrast", "Putting ten actions in a single tiny icon menu", "Using decorative script fonts for body paragraphs"]'::jsonb, '1'::jsonb),
    ('UI Design', 2, 'Why should status badges pair color with a text label or icon?',
      '["Color alone is hard to interpret for color-blind users and in bright outdoor light", "It makes buttons smaller", "Browsers cannot render green backgrounds", "Icons remove the need for labels"]'::jsonb, '0'::jsonb),
    ('UI Design', 3, 'What is the clearest way to distinguish the main action on a screen from secondary options?',
      '["Give every button the exact same bright outline", "Use one filled primary button for the main action and lighter bordered or text buttons for secondary actions", "Hide the main action inside a dropdown", "Use all-caps red text for every button"]'::jsonb, '1'::jsonb),
    ('UI Design', 4, 'What makes an empty state helpful instead of confusing?',
      '["Leaving a completely blank white box", "Explaining clearly why nothing appears yet and offering a direct next action button", "Showing a raw database error code", "Removing the page heading"]'::jsonb, '1'::jsonb),
    ('UI Design', 5, 'Consistent spacing (such as an 8px or 4px scale) primarily improves:',
      '["Visual rhythm, scannability, and predictable alignment across screens", "Server database latency", "Password encryption strength", "Network upload bandwidth"]'::jsonb, '0'::jsonb),

    -- React
    ('React', 1, 'Why should list items rendered with .map() include a stable, unique key prop?',
      '["To encrypt props sent to children", "So React can accurately track which items changed, were added, or were removed", "To automatically style the list as a grid", "Keys are only required for HTML tables"]'::jsonb, '1'::jsonb),
    ('React', 2, 'When updating React state that depends on the previous state value, which pattern is safest?',
      '["Mutating the state array directly with .push()", "Passing an updater function such as setCount(prev => prev + 1)", "Storing state in document.title", "Calling setState inside render"]'::jsonb, '1'::jsonb),
    ('React', 3, 'What is the purpose of the dependency array in useEffect?',
      '["It lists which values trigger the effect to re-run when they change", "It defines CSS breakpoints", "It validates TypeScript interfaces at compile time", "It caches API passwords"]'::jsonb, '0'::jsonb),
    ('React', 4, 'How should you keep a reusable component clean and easy to maintain?',
      '["Copy-paste the entire component for every minor variation", "Pass clear props for behavior and content rather than duplicating component logic", "Keep all 5,000 lines inside one deeply nested JSX return", "Avoid TypeScript types on props"]'::jsonb, '1'::jsonb),
    ('React', 5, 'What is the recommended way to show loading and error states when fetching API data?',
      '["Render explicit loading indicators and clear recovery messages instead of silent blank screens", "Suppress all catch blocks and ignore failures", "Reload the entire browser tab on every error", "Hardcode fake sample items as real results"]'::jsonb, '0'::jsonb),

    -- User Research
    ('User Research', 1, 'During a usability test with a non-technical participant, what is the best way to observe issues?',
      '["Explain every button before they touch it", "Give them a realistic task and watch quietly where they hesitate or get confused", "Ask only leading yes/no questions", "Tell them they clicked the wrong place immediately"]'::jsonb, '1'::jsonb),
    ('User Research', 2, 'Which interview question yields the most reliable insight about real user behavior?',
      '["Would you use this app every day if it were free?", "Walk me through the last time you tried to complete this task and what was hardest.", "Do you agree our blue button looks modern?", "How many features do you want?"]'::jsonb, '1'::jsonb),
    ('User Research', 3, 'What should happen after synthesizing interview notes into themes?',
      '["Link each insight to concrete product improvements and prioritize by user impact", "Delete raw findings so teammates only see averages", "Keep research separate from design and engineering", "Only report positive quotes"]'::jsonb, '0'::jsonb),
    ('User Research', 4, 'Why is recruiting participants who match your actual target users essential?',
      '["Their mental models, vocabulary, and constraints reflect real usage conditions", "It makes survey forms shorter to print", "It eliminates the need for prototypes", "Friends and teammates always represent first-time users"]'::jsonb, '0'::jsonb),
    ('User Research', 5, 'When summarizing research for stakeholders, what builds the strongest trust?',
      '["Separating direct observations from assumptions and stating sample size clearly", "Exaggerating percentages without sample counts", "Skipping edge cases", "Using technical jargon instead of plain language"]'::jsonb, '0'::jsonb),

    -- Data Analytics
    ('Data Analytics', 1, 'Before calculating averages or conversion rates from raw records, what should you check first?',
      '["Whether the chart colors match the logo", "Duplicate rows, missing values, test records, and date ranges", "How fast your monitor refreshes", "Whether every number ends in zero"]'::jsonb, '1'::jsonb),
    ('Data Analytics', 2, 'Why can an average (mean) be misleading when analyzing project budgets or turnaround times?',
      '["A few unusually large or small outliers can pull the average away from the typical value", "Means cannot be calculated on numbers", "Medians are always larger than means", "Averages ignore negative numbers"]'::jsonb, '0'::jsonb),
    ('Data Analytics', 3, 'What is the key difference between a vanity metric and an actionable metric?',
      '["Actionable metrics tie directly to real decisions and outcomes, while vanity metrics only look impressive on the surface", "Vanity metrics require SQL", "Actionable metrics never change over time", "There is no difference"]'::jsonb, '0'::jsonb),
    ('Data Analytics', 4, 'When presenting dashboard metrics to business owners, which practice is best?',
      '["Show clear labels, real time windows, and plain-language takeaways next to each chart", "Show raw table UUIDs without context", "Interpolate missing months with guessed numbers", "Hide zero values by inventing growth curves"]'::jsonb, '0'::jsonb),
    ('Data Analytics', 5, 'If 20 out of 80 submitted applications lead to hired contracts, what is the conversion rate?',
      '["15%", "20%", "25%", "40%"]'::jsonb, '2'::jsonb),

    -- Content Strategy
    ('Content Strategy', 1, 'What makes microcopy on buttons and forms effective for first-time users?',
      '["Clear action verbs that tell the user exactly what happens next (e.g., Save Profile, Submit Proposal)", "Vague clever slogans that hide what clicking does", "Long paragraphs inside buttons", "Technical database terms"]'::jsonb, '0'::jsonb),
    ('Content Strategy', 2, 'When writing a project brief for collaborators, what information reduces back-and-forth most?',
      '["Clear goals, expected deliverables, timeline, and budget in plain language", "Only a two-word title", "Internal company acronyms with no explanation", "Skipping deliverable details until the end"]'::jsonb, '0'::jsonb),
    ('Content Strategy', 3, 'What is the main purpose of defining a consistent tone of voice?',
      '["So every screen, email, and help message feels trustworthy, clear, and recognizable", "To force every page to use the same headline", "To replace visual design", "To make sentences longer"]'::jsonb, '0'::jsonb),
    ('Content Strategy', 4, 'How should you structure instructional content for busy or non-technical readers?',
      '["Front-load the key takeaway, use short bullet steps, and avoid unnecessary jargon", "Put the main point in the final paragraph", "Write dense walls of text without headings", "Mix multiple languages randomly"]'::jsonb, '0'::jsonb),
    ('Content Strategy', 5, 'How do you measure whether an onboarding guide or help article is actually working?',
      '["Check completion rates, reduced support questions, and user feedback", "Count only the number of words written", "Check the font file size", "Assume it works if nobody emails"]'::jsonb, '0'::jsonb)
)
insert into public.verification_questions (assessment_id, prompt, options, correct_answer, points, sort_order)
select
  va.id,
  sq.prompt,
  sq.options,
  sq.correct_answer,
  1,
  sq.sort_order
from seeded_questions sq
join public.catalog_skills cs on cs.name = sq.skill_name
join public.verification_assessments va on va.skill_id = cs.id
where not exists (
  select 1 from public.verification_questions vq where vq.assessment_id = va.id
);
