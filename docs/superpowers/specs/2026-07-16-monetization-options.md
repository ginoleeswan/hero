# Monetization — options + recommendation (decision doc)

**Status:** awaiting owner decision. No code until a direction is picked.
**Grounding:** repo research 2026-07-16 (donation surfacing, ad-safety specs,
cost instrumentation, legal copy, outbound-link inventory).

## The two constraints everything must respect

1. **Shipped promises.** The app publicly says *"free & ad-free"* on two of its
   highest-traffic surfaces (Explore engage row, home footer) and *"No ads, no
   paywall"* on the Support screen. Breaking these is a product-trust event,
   not just a copy edit.
2. **The IP posture.** Every legal/disclaimer surface leans on *"unofficial,
   fan-made, informational and entertainment purposes"* — and the ad-safety
   spec explicitly names the app being non-monetized as "a favorable
   non-commercial factor" in the fair-use calculus. Each option below erodes
   that posture by a different amount; ads erode it most.

## Cost reality (why this isn't urgent)

The only metered paid spend is **Gemini/Imagen generation** (portraits
~$0.04/each, stats ~$0.002), soft-capped at **$150/mo** and admin-batch-gated —
per-user marginal cost is near zero. ComicVine/TMDB/Wikidata ride free quotas
(tracked as call counts in `api_usage`). So monetization is about *funding
growth* (portrait backlog: 46k) and sustainability, not survival.

## The options

### A. Supporter tier (recommended first)
Ko-fi-powered (0% fees, no store cut — the tip-jar spec already ruled out IAP),
recognition-based, no paywall:
- `user_profiles.is_supporter` flag (same additive pattern as `is_admin`),
  set manually from Ko-fi emails at current scale (an admin toggle in the
  command center); webhook automation later.
- A **Supporter badge** in the existing badges strip (first stored-flag badge),
  an optional profile flair, and a thank-you in Settings.
- Perks stay cosmetic/recognition (early-access flags are possible later) —
  **nothing paywalled**, so "no paywall" copy stays true.
- Effort: ~1 small PR. Risk to IP posture: minimal (donations already exist).

### B. Affiliate links (recommended second, needs taste)
The outbound surface is rich and currently unmonetized: every character links
IMDb; titles link TMDB + a JustWatch region page; the movie strip falls back to
a Google search. The `SUPPORT_LINKS` registry in `kofi.ts` was explicitly built
so "adding a partner is one entry."
- Candidates: Amazon Associates (comics/collectibles), streaming affiliates
  via JustWatch partner program.
- Requires: a disclosure line ("links may earn a commission"), a Privacy/Terms
  touch-up, and restraint (informational-first, never pushy).
- Effort: small-medium. Risk: mild — commercial links nudge the non-commercial
  posture, but affiliate-on-reference-content is a well-trodden fan-site norm.
- **Constraint:** honors "ad-free" (affiliate ≠ ads) but weakens "fan project,
  not monetised" copy → update the Support screen wording honestly.

### C. Ads (recommend against, now and probably ever)
Directly contradicts the shipped "free & ad-free" promise in three places,
requires a Privacy Policy rewrite (ad networks = cross-site tracking), degrades
the award-pass design language, and — most importantly — converts the app into
a commercial exploitation of third-party characters, the exact thing the
non-commercial framing protects against. The revenue at current traffic
(~hundreds of sessions/day) would be trivially small anyway.

## Recommendation

**A now, B when traffic justifies the paperwork, C never (revisit only if the
model fundamentally changes).** A is a weekend-sized PR that starts the revenue
learning loop without breaking a single promise; B layers on cleanly once
there's enough click volume for affiliate payouts to matter.

## Decision needed from the owner

1. Green-light **A** (supporter tier) as specced? → I build it.
2. Green-light **B** now, later, or never? (If now: which programs — Amazon?
   JustWatch?)
3. Confirm **C** is off the table so the "ad-free" promise can be treated as
   load-bearing in future design decisions.
