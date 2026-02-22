# Guided Reflection Prompts

## Problem

The journal provides a place to write, but users may not know where to start. Reflection prompts offer gentle starting points, surfaced contextually throughout the app rather than only inside the journal.

## Design

Three prompt surfaces, all controlled by a single settings toggle. Prompts are static translated strings with optional template variables. No database, no user state.

### Settings

`showReflectionPrompts` boolean in `CanvasSettings` (default: true, persisted to localStorage). When off, all three surfaces are hidden.

### Surface 1: Journal Entry Form

"Need inspiration?" collapsible section when creating a new entry. Shows 3 random prompts from the journal pool. Clicking one inserts the text into the textarea.

### Surface 2: Contextual Prompts

Small muted text block in PersonDetailPanel and PatternView when relevant data is present. Clicking opens the journal with the prompt pre-filled and the relevant entity pre-linked.

**PersonDetailPanel**: one prompt shown below the person header, selected based on what data the person has (trauma events, turning points, classifications, relationships). Template variables substitute the person's name.

**PatternView**: one prompt shown on expanded pattern detail cards.

### Surface 3: Canvas Nudge Banner

A small dismissible bar above the footer on the canvas view. Shows one randomly selected prompt per session from the journal pool. "Write about this" button opens the journal panel with the prompt pre-filled. Dismissing hides it for the session (React state, not persisted).

Styled like the existing mental health support banner: muted background, small text, unobtrusive.

## Prompt Content

### Journal Prompts (10)

1. "Who in your family tree do you most identify with, and why?"
2. "What event had the most ripple effects across generations?"
3. "Are there strengths or resilience patterns, not just trauma?"
4. "What patterns do you notice repeating?"
5. "What would you like future generations to know about your family?"
6. "What was never spoken about, but everyone knew?"
7. "Which relationship in your tree surprises you the most?"
8. "If you could ask one ancestor a question, who and what would it be?"
9. "What did your family teach you about handling difficult emotions?"
10. "Where do you see yourself in this tree?"

### Person Context Prompts (8)

Shown based on what data the person has. Template variable: `{{name}}`.

1. "What strengths did {{name}} carry despite these experiences?" (has trauma events)
2. "How did {{name}}'s turning point affect the next generation?" (has turning points)
3. "How has {{name}}'s diagnosis shaped the family's understanding?" (has classifications)
4. "What role did {{name}} play in holding the family together?" (has many relationships)
5. "What do you wish {{name}} had known about themselves?"
6. "What did {{name}} pass on that you're grateful for?"
7. "How might {{name}}'s story have been different with more support?" (has trauma events)
8. "What would you say to {{name}} if you could?"

### Pattern Context Prompts (6)

1. "What does this pattern mean to you?"
2. "Where did this pattern begin, and who first broke it?"
3. "How does recognizing this pattern change how you see your family?"
4. "Is this pattern still active in your generation?"
5. "What would it take to transform this pattern?"
6. "Who in the family was most affected by this pattern?"

### Canvas Nudge

Draws from the journal pool (10 prompts), randomly selected per session.

## Files

### Frontend (create)
- `frontend/src/lib/reflectionPrompts.ts` (prompt arrays and selection logic)
- `frontend/src/components/journal/ReflectionPrompts.tsx` (collapsible prompt picker for journal form)
- `frontend/src/components/tree/ReflectionNudge.tsx` (canvas nudge banner)

### Frontend (modify)
- `frontend/src/hooks/useCanvasSettings.ts` (add `showReflectionPrompts`)
- `frontend/src/components/tree/CanvasSettingsContent.tsx` (add toggle)
- `frontend/src/components/tree/PersonDetailPanel.tsx` (contextual prompt below header)
- `frontend/src/components/PatternView.tsx` (contextual prompt on detail cards)
- `frontend/src/pages/TreeWorkspacePage.tsx` (nudge banner)
- `frontend/public/locales/en/translation.json` (all 24 prompts + UI keys)
- `frontend/public/locales/nl/translation.json` (Dutch translations)
