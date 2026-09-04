# Age rating questionnaire

Written against the questionnaire App Store Connect uses since Apple's 2025
age-rating overhaul. The tiers are now 4+, 9+, 13+, 16+ and 18+; the old 12+
and 17+ survive only as regional mappings. If the questions in Connect do not
match the headings below, Apple has changed it again: re-derive from
https://developer.apple.com/help/app-store-connect/reference/age-ratings/
rather than trusting this file.

## The judgement call

The app contains no violent, sexual, or graphic content of its own. What it
holds is whatever the user writes, and the subject it invites them to write
about is abuse, addiction, war, illness, and loss.

Answer honestly rather than optimistically. Under-rating an app that centres
on trauma is a rejection risk, and a rating that reads as "for everyone" is
also wrong for the product: this is not a tool for children.

Apple rates the app's own content, so most answers are "None". Two sections
carry the weight: Mature Themes, because the app is explicitly about trauma,
and Medical or Wellness, because a reflection tool about mental health reads
as a wellness topic even though it gives no advice.

## Suggested answers

### In-App Controls

| Question | Answer | Why |
| --- | --- | --- |
| Parental controls | No | None exist, and the app is not for children |
| Age assurance | No | No age verification; the account gate is email and passphrase |

### Capabilities

| Question | Answer | Why |
| --- | --- | --- |
| User-generated content | **No** | Content is private to the user and encrypted; nothing is shared with, or visible to, any other user |
| Messaging and chat | No | No such feature |
| Social media | No | No feed, no profiles, no other users |
| Advertising | No | No ads, no ad SDK |
| Unrestricted web access | No | The app has no browser |

The user-generated content question is about content users can share with
each other, which is what pushes social apps up the scale. There is no sharing
here and no other user can ever see a person's writing. Answer "No" even
though everything in the app is, in the plain sense, written by the user.

### Mature Themes

| Question | Answer | Why |
| --- | --- | --- |
| Profanity or crude humour | None | No such content |
| Horror or fear themes | None | No such content |
| Alcohol, tobacco, or drug use or references | None | Addiction appears only as a category label the user may choose |

### Medical or Wellness

| Question | Answer | Why |
| --- | --- | --- |
| Health and wellness topics | **Yes** | Intergenerational trauma and mental health are the app's subject |
| Medical or treatment information | None | The app states it is not therapy and gives no medical guidance |

"Health and wellness topics" is a 9+ descriptor on its own. Answering "No"
because the app gives no advice would be the optimistic answer this file
warns against.

### Sexuality or Nudity

| Question | Answer | Why |
| --- | --- | --- |
| Sexual content or nudity | None | No such content |
| Mature or suggestive themes | **Infrequent** at minimum | The app is explicitly about trauma across generations |

This is the same "mature or suggestive themes" answer the old questionnaire
asked for; Apple now files it under this heading.

### Violence

| Question | Answer | Why |
| --- | --- | --- |
| Cartoon or fantasy violence | None | No such content |
| Realistic violence | None | No such content |
| Guns or other weapons | None | No such content |

### Chance-Based Activities

All "None": no gambling, simulated gambling, loot boxes, or contests.

## Expected outcome

Expect **13+**. Mature Themes and Medical or Wellness together sit above 9+,
and nothing here reaches the 16+ descriptors (frequent medical information,
frequent mature themes, unrestricted web access). If the questionnaire pushes
higher on the themes answers, take the higher rating rather than softening
the answers.

Apple also shows regional ratings derived from these answers (Australia,
Brazil, France, and others). They are computed, not chosen; nothing to fill
in.

## Related, and worth doing anyway

The app tells the user it is "not therapy and not crisis support" on the
welcome screen and in Settings, which is the right posture under guideline
1.4.1. The web footer also links a crisis line; the app does not. Adding
crisis resources in Settings would strengthen the position and costs little.
