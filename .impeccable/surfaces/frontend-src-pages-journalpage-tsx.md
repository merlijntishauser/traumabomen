---
version: 1
slug: "frontend-src-pages-journalpage-tsx"
primary_target: "frontend/src/pages/JournalPage.tsx"
related_targets: []
---

# Journal page

Scope: /trees/{id}/journal. Mode: Operate (writing). The workspace's journal side panel is a separate surface and keeps the compact form.

Audience and task: someone reflecting on their family, often in a heavy moment. Mostly writing; sometimes rereading what they wrote before.

User decisions: writing first with the past close; the lined-paper and ghost-word decoration goes.

## Direction contract

THESIS: A writing desk, not a feed of cards. Refuses the category default of a "New entry" button over a list of cards.

OWN-WORLD: Quiet Forest tokens; canvas wash with contour lines. The page is a solid surface sheet with a large shadow. The question is in the voice face at 1.6rem, weight 200. Writing is 15px Lato at 1.8 line height, 68ch wide, borderless. The margin is quiet: dates in the voice face, excerpts in secondary text.

STORY: The visitor meets one open question, writes, saves, and sees the entry join the margin. Later they pick an earlier entry to reread and edit.

FIRST VIEWPORT: Header. Left column: the open question with Answer this question and Another question, a quiet Write/Preview toggle, the writing surface, link people, Save. Right margin (260 to 340px, sticky): Earlier entries with a count; each item shows its date, a three-line excerpt and up to three chips; the open one is raised. Signature move: an answered question is kept in the entry as a quote, so rereading shows the question apart from the answer.

FORM: Writing desk with a margin, dealt index 1 of my ordered surface list, seed key 1085b5cf.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
