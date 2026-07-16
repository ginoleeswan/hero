# Monetization — options + recommendation (decision doc)

**Status:** DECIDED 2026-07-16 — Option A (supporter tier) green-lit and built;
ads revised from "never" to scale-gated (see C). Affiliate (B) still open.
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

### C. Ads (revised 2026-07-16: not "never" — scale-gated "not yet")

**The math decides this, not principle.** At today's ~11.5k pageviews/month,
realistic display RPM ($1–5) yields **$12–60/month** — four $3 Ko-fi supporters
beat the whole program, while costing trust, a privacy rewrite, and design
damage. The equation only flips at scale:

| Scale | Monthly ad revenue (realistic) |
| --- | --- |
| today (~11.5k pv/mo) | $12–60 |
| 100k pv/mo | $100–500 |
| 1M pv/mo | $1,000–5,000 |

**Steelman (what "never" got wrong):** ad-funded fan encyclopedias are the
industry norm (Fandom), ads are the only revenue that scales automatically with
the SEO strategy, and they monetize the anonymous long-tail visitor who will
never sign in or donate. **Counterweights that still win today:** "the clean,
ad-free alternative to Fandom" is Mythique's sharpest positioning wedge (Fandom
is *hated* for ad bloat); the non-commercial framing is the solo project's one
cheap IP-defense card; and programmatic creative next to the award-pass design
is self-harm.

**The tasteful playbook, if/when the gate (~250–500k pv/mo) is reached:**
1. **Sponsorship, not programmatic.** One "Sponsor" card per page max, styled
   as a native feed card with a `SPONSOR` eyebrow. Never sticky/interstitial/
   autoplay/mid-article. Hard ban on AdSense/AdMob-class networks.
2. **Direct + contextual, zero tracking** (direct-sold comic/collectible/
   streaming sponsors, or privacy-first contextual networks) — no cookies, no
   consent banner, minimal privacy-policy delta.
3. **Placement bans:** character-page top viewport, the dailies/games, the
   compare arena.
4. **Supporters see none** — makes the tier materially valuable and reframes
   the promise as "free, and sponsor-free for supporters".
5. **House-ads first:** the SponsorCard slot can ship early filled with house
   content (TikTok/Ko-fi/daily game promos) — free optionality, no promise
   broken.
6. **Honest copy migration** — update the three "ad-free" surfaces BEFORE the
   first sponsor renders, with the why.

## Recommendation (updated after decision)

**A shipped. B when traffic justifies the paperwork. C behind a hard traffic
gate (~250–500k pv/mo), and then only as the sponsorship playbook above —
programmatic never.** Until the gate, "ad-free" remains load-bearing copy and a
deliberate competitive wedge.

## Decision log

- 2026-07-16 — Owner green-lit **A** (built: `is_supporter` flag +
  `admin_set_supporter` RPC, Supporter badge, settings thank-you, donation-nudge
  suppression). Ads revised to scale-gated per analysis above. **B remains
  open** (owner to pick programs when ready).
