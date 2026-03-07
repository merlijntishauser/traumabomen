# Screenshot Tour

Visual walkthrough of Traumabomen. Each screenshot is captured automatically
during the demo script run. Filenames are numbered to match the demo flow.

---

## 01-landing.png
**Login page with hero image.** The two-column layout shows a theme-aware
photograph on the left with a gradient overlay, and the login form on the right.
The handwritten-style heading font sets the personal tone.

## 02-register-form.png
**Registration form in progress.** Email and password fields are partially
filled, showing the clean form layout. The encryption passphrase fields below
signal that this app treats privacy seriously.

## 03-password-strength.png
**Password strength meter.** The colored bar below the password field shows
real-time feedback. The meter fills and changes color as password complexity
increases (weak, fair, strong).

## 04-tree-list-empty.png
**Empty tree list with welcome card.** After first login, the user sees a
welcome message and the option to create their first tree or load a demo.
The atmospheric background gradient and branch decoration are visible.

## 05-demo-tree-canvas.png
**Demo tree canvas, initial view.** The Whitfield family tree renders with
Dagre auto-layout. Person nodes show names, years, and colored badges.
Relationship edges connect the family members.

## 06-canvas-overview.png
**Canvas after panning and zooming.** A closer view of the family structure
showing the different relationship line styles: solid for biological, dashed
for step or adoptive connections.

## 07-person-detail.png
**Person detail panel for Dorothy Whitfield.** The slide-out panel on the right
shows Dorothy's personal information, including birth and death years. Tab
navigation for Person, Relations, Events, and DSM-5 sections is visible.

## 08-add-person.png
**Adding a new person.** The detail panel shows the creation form with "Emma
Whitfield" typed into the name field and 2010 as the birth year.

## 09-relationship.png
**Relationship prompt.** After saving a new person, the multi-step relationship
prompt asks whether to connect Emma to an existing family member. The prompt
shows available persons and relationship types.

## 10-timeline.png
**Timeline view.** The D3-powered horizontal timeline shows generational rows
with life bars for each person. Trauma events appear as circles, life events as
squares, and classification periods as colored strips.

## 11-patterns.png
**Patterns view.** The dedicated patterns page displays pattern cards with
linked entities spanning generations. Color-coded connections show recurring
themes across the family.

## 12-journal.png
**Journal view.** The personal reflection space shows the journal entry list
with the option to create new entries. Entries can be linked to turning points
in family members' lives.

## 13-insights.png
**Insights page.** Aggregated statistics and detected patterns are displayed in
categorized cards: generational trends, temporal clusters, summary data, and
resilience indicators.

## 14-theme-light.png
**Light theme on the canvas.** Warm linen and sage tones replace the dark
midnight-forest palette. The same family tree data is displayed with adjusted
colors for readability in bright environments.

## 15-theme-watercolor.png
**Watercolor theme (if enabled).** Soft teal-blue accents on warm cream and
parchment tones. This theme is gated behind a feature flag and may show a
different theme if the flag is not active.

## 16-unlock.png
**Unlock screen after re-login.** The passphrase entry screen with the layered
CSS background simulating a moonlit canopy (dark theme) or morning mist (light
theme). A single input field and unlock button.

## 17-trees-persisted.png
**Tree list showing persisted data.** After re-authenticating and unlocking,
the previously created demo tree appears in the list, confirming that data
was encrypted, stored, and successfully decrypted.
