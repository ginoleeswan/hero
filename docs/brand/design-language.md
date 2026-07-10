# Mythique — "Two Worlds" design language

One idea carries the brand: **the mask holds two worlds.** Through the left
eye, the heroes' world (dawn gold); through the right, the villains' (dusk
teal). Every brand piece is a page from the codex that catalogues both.

## The five motifs

| Motif | What it is | Use for |
| --- | --- | --- |
| **Eye-Worlds** | The logo mask rendered colossal; its eye holes are windows into the dawn/dusk worlds (busts standing inside them) | Identity moments: hooks, avatars, banners, launch |
| **The Seam** | Gold hairline arc where the ink field meets cream paper | Structural layouts: anything with body copy or footers |
| **Folio marks** | Small-caps FlameSans labels — `VOL. I`, `№ 001`, `SPECIMEN 07,412`, `BULLETIN` | Every piece; the codex voice |
| **Specimen plates** | Squircle (26% radius), gold/orange/teal border, silhouette bust seated flush on the bottom edge | Any "character we can't show" |
| **Duality diagonal** | Frame split corner-to-corner, paper vs ink, gold seam, coin on the seam | Versus / two-party content |
| **Monument numerals** | Colossal gold Flame numeral on a gold ground line with tiny full-body silhouettes for scale | Stats, milestones, rankings |

## Tokens

- **INK** `#0b1a24` (ground) · **NAVY** `#06121a` (depth edge) · **PAPER** `#f5ebdc` (the app canvas) · **GOLD** `#e0a83e` (rules, frames, seams — structure, never body text)
- **DAWN** world: radial `#f6c268 → #b97a24` · **DUSK** world: radial `#4fa3c4 → #14495e`
- Accents: orange `#e8823a` (side A), teal `#37a3c4` (side B)
- Muted: `#93a8b6` on ink, `#8a7a63` on paper
- Grain overlay 4–5%, `mix-blend-mode: overlay`, 340px tile — on everything

## Type

- Display: **Flame-Regular** only (never Flame-Bold), sentence case, ends with a period ("Every hero."), line-height 1.02–1.08
- Folios/eyebrows: **FlameSans**, ALL CAPS, tracking `.24em–.34em`, gold on ink / paper-mut on paper
- Wordmark PNG as masthead (34–44px at 1080), never re-set the name in type

## Rules

- 84px margins at 1080; one dominant element per frame; asymmetric unless the motif is symmetric (mask, monument)
- The logo works: as the frame (Eye-Worlds), as the seam coin (duality), as the masthead crest — never a dead footer stamp
- Franchise-safe: generated silhouettes (`assets/silhouettes/`) + mascot are the only figures
- No starfields, no centered icon-eyebrow-headline poster grammar, no pure black

Generator: `scripts/social/brand-pack.mjs`. Motif helpers live there — reels
(`scripts/social/ads/render-reel.mjs`) share the same tokens via `lib.mjs` COLORS.
