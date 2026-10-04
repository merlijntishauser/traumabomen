---
version: 1
slug: "frontend-src-pages-treeworkspacepage-tsx"
primary_target: "frontend/src/pages/TreeWorkspacePage.tsx"
related_targets: []
---

# Tree workspace (canvas editor)

Scope: the tree canvas view at /trees/{id}. Mode: Operate. Delivered first as an interactive HTML mockup artifact (dark + light), not yet in code.

Audience and task: an adult mapping their own family, often alone, sometimes beside a therapist. Builds structure (persons, relationships), records events, marks patterns. Long sessions, emotionally heavy content.

User-named pains: the toolbar is crowded; the 400px tabbed inspector feels heavy and covers the tree; the editor feels like a database rather than a notebook.

Must stay untouched: the Quiet Forest world (tokens in theme.css, Playwrite/Lato, closed domain palettes, badge shape grammar, 0.15s colour motion, no glass on data surfaces), autosave on blur, all existing capabilities.

## Direction contract

THESIS: The person is a page in a family notebook, not a record in a form. Refuses the category default of a top toolbar of icon buttons plus a tabbed property inspector.

OWN-WORLD: Quiet Forest tokens unchanged. A 52px left rail on bg-secondary, grouped icons separated by hairlines. Canvas with radial accent wash, noise and contour lines. Person nodes keep 12px corners and the 3px accent top edge, handwritten names, badge shapes. Margin page: solid bg-secondary, 1px left border, shadow-lg.

STORY: The user sees their whole family first, finds every tool in one quiet rail, selects a person and reads their life as a vertical lifeline, edits any line in place, and adds what happened with one Add.

FIRST VIEWPORT: Rail left (add person, connect, auto layout, undo | patterns, journal | view switch tree/timeline/patterns/insights | settings). Slim header: tree name in the voice face, saved whisper, theme toggle. Canvas fills the rest with a synthetic three-generation family. One person selected: 360px margin page on the right with name, years, a glance line, relationship chips, and a vertical lifeline birth to death marking trauma circles, life squares, classification triangles, turning points, each a readable line. Signature move: the lifeline, where a person's events sit on their own timeline and hovering a line highlights the matching badge on the canvas node.

FORM: Notebook margin, position 1 of my ordered surface list (dealt index 1), seed key ad65475e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
