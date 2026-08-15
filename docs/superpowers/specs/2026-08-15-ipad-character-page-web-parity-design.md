# The tablet character page adopts the web desktop design

**Date:** 2026-08-15
**Status:** designed, not yet implemented
**Domain docs to update on landing:** `docs/features/character-page.md`,
`docs/features/platform-and-motion.md`

## Why this exists

`docs/superpowers/specs/2026-08-15-tablet-adaptation-design.md` fixed the iPad's
geometry — gutters, measures, card sizes — under an explicit non-goal: **"No
redesign. This is about width, not about ideas."** That was right for Explore,
Profile and Arena, whose native and web layouts are the same composition at
different widths.

The character page is the exception. Native and web are not one design at two
widths; they are **two different designs**, and no amount of width-keying makes
one become the other. Closing that is a redesign, which is why it needs its own
spec.

## What is actually there today

Both columns measured on 2026-08-15 — web at 1440x900 on `/character/332`,
native on an iPad Pro 13" simulator.

|             | web desktop                                                                                                | native (phone, and the tablet split shipped in `651d2041`)  |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| identity    | a dark **band** across the top, ~290pt tall                                                                | overlaid on the portrait, bottom-left                       |
| portrait    | a **floating card**, rounded and shadowed, overlapping the band and hanging into the beige                 | full-bleed art                                              |
| surfaces    | **white cards** on beige                                                                                   | sections sit directly on beige, separated by hairline rules |
| power stats | horizontal bars inside a card                                                                              | six circular dials                                          |
| quick facts | an open **grid of labelled tiles** — alignment, origin, gender, race, height, weight, then full-width rows | a collapsed `Dossier` bar with a "View" toggle              |
| section nav | a vertical icon dot-rail in the left gutter (`SectionDotRail`, gated at `width >= 1320`)                   | a floating quick-nav that fades in past the hero            |
| body        | two columns: `mainCol` (flex) beside a 300pt sticky `sideCol`, `gap: 24`, capped at 1180                   | one column                                                  |

**Web's `mainCol`, in order:** Power Profile → the lede → Abilities → Relations
→ Legend → In Print. **Web's `sideCol`:** portrait card → Quick Facts → Debut.
A full-width `familyBand` sits below both.

### The experiment that proved the gap

Before writing this, the Dossier and Links sections were relocated into the art
column's empty space on a landscape iPad. It looked wrong, and the reason is
diagnostic rather than cosmetic: **every item in web's `sideCol` is a card**,
and native has no card grammar to give them. Links in particular is a
right-aligned `SectionHeader` over a rule — a device that only reads correctly
across a full-width sheet. Dropped into a 605pt column on bare beige it reads as
debris.

So the card primitive is not one item on a list of five. It is the thing the
other four depend on.

## The decision

**On tablets (>= 700pt) the character page adopts web's composition. The phone
does not move.**

The phone's immersive design — full-bleed art, identity on the scrim, a beige
sheet riding up over it — is right for a phone and is what the Apple Zoom morph
was built around. This is gated above the tablet threshold exactly as
`PageColumn` and `railCardWidth` are.

Two consequences worth stating plainly:

- The tablet layout stops being "the phone, wider". That is the point. It has
  been the phone-wider for the whole of the app's life and that is what makes it
  read as an iPhone app on an iPad.
- There will be three character-page layouts to maintain: phone native, tablet
  native, web. The tablet one is deliberately a **port of web's**, not a third
  invention, so the reference for any future question is
  `app/character/[id].web.tsx` and not judgement.

## The two open questions, with recommendations

### 1. Does the tablet portrait become web's floating card? — **Yes**

Recommended, and not only for fidelity. The floating card is what _permits_ the
two-column body: full-bleed art at 1376pt either dominates the fold (the 147%
fault this work started from) or has to become a full-height column, which is
the third structure that did not work.

It is also **better for the morph, not worse**. The Apple Zoom target becomes a
~330 x 363 card, which is far closer to the rail card's 260 x 286 than a
full-bleed 1376 x 1514 ever was. The aspect agreement `heroImageAspect`
guarantees is preserved; the scale factor drops from ~5.3x to ~1.3x.

### 2. Do the power stats become web's horizontal bars? — **No. Keep the dials.**

This is the one place the recommendation is to **not** follow web. The dials
carry the same information in less space, they are legible at a glance, and
they are the treatment the Character Dossier redesign moved toward. Web's bars
predate them.

What native should adopt is web's **card** around them — the crown-wash surface
with the accent fading to clean paper where the values live. Card yes, bars no.
Flagged explicitly so a later reviewer does not "fix" the divergence: it is
deliberate, and the better direction is for web to gain the dials.

## Scope, in dependency order

### 1. The card primitive

A `PaperCard` in `src/components/ui/`: surface, hairline border, radius from
`RADIUS_SCALE`, and an optional accent crown-wash driven by `src/lib/accent.ts`
(the same theme engine the web page uses). Nothing else in this spec works
without it, and it is the piece most likely to be reused — the Arena and Compare
pages have the same "section on bare beige" problem.

**On a phone it renders as a passthrough** — no surface, no border — so the
phone's rule-separated sections are untouched by construction, the way
`PageColumn` is a no-op below its cap.

### 2. The stage

Identity as a top band above the body rather than an overlay on the art:
publisher logo, name, alias and the taxonomy chip on the left; creators, the
alignment chip and the vitals on the right. `maxWidth: 1180`, centred, matching
web's `stageInner`.

The portrait becomes a card pinned to the band's right, overlapping its bottom
edge into the beige. `identityNode` — already hoisted in `651d2041` — is what
moves; the split-specific `identityColumn` positioning is deleted with it.

### 3. Quick Facts

The `Dossier` component's data, presented as web's open tile grid instead of a
collapsed bar. This is a presentation change only: `Dossier` already receives
every field the grid needs, including the edit affordances.

### 4. The two-column body

`mainCol` (flex, `minWidth: 0`) beside a 300pt `sideCol`, `gap: 24`, in web's
section order. **This applies to tablet portrait as well as landscape** — at
1032pt with a 32pt gutter the split is 644 + 300, and web itself runs this
layout from 700pt.

Rails inside `mainCol` still bleed to the column's edge, per the rails rule.

### 5. The dot-rail (optional, last)

`SectionDotRail` at `width >= 1320`, which is 13" landscape only. Web gates it
there because below that there is no gutter to hold it. Genuinely optional — it
replaces the floating quick-nav rather than adding to it, so shipping without it
leaves the existing nav in place.

## Non-goals

- **No phone change.** Every item above is gated above 700pt. Any phone-visible
  diff is a bug in the change, and the tests must pin it — the same guard that
  made the Explore gutter work safe.
- **Not the web page.** Web is the reference, not the target of edits. The one
  place native deliberately diverges is the stats treatment, recorded above.
- Not the biography, compare, or social-web satellite pages.
- Not the Apple Zoom transition itself, beyond keeping the target's aspect
  correct — which the floating card improves rather than risks.

## Testing

Per repo convention: pure functions and hooks unit-tested; no rendering tests
for screens.

The load-bearing assertions are the **phone invariants** — for each primitive
added, a test that its phone-width behaviour is the identity. `PaperCard`
returning a bare passthrough below 700pt is the one that matters most, because
it is the widest-reaching.

Everything else here is visual and must be verified on the simulator in **both
orientations plus a phone**, because a green suite has repeatedly failed to
catch layout and runtime faults in this codebase — the crop, the crash, the
off-screen glow, the ragged gutters, and most recently an identity block pinned
to the screen's bottom instead of the art's, which rendered beige on beige.

## History

- Tablet geometry, and the non-goal this spec exists to lift:
  `docs/superpowers/specs/2026-08-15-tablet-adaptation-design.md`
- The Explore billboard's equivalent redesign:
  `docs/superpowers/specs/2026-08-14-ipad-spotlight-deck-design.md`
- The accent theme engine the crown-wash uses:
  `docs/superpowers/specs/2026-07-02-character-dossier-redesign-design.md`
