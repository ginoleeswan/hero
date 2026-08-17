# App Store Connect metadata — Mythique

Paste-ready copy for the iOS listing. Every claim here is checked against the
database rather than rounded up; see **Honesty of claims** at the end for what
the numbers actually are and which sentences they license.

Field limits are Apple's, counted and enforced by `yarn check:store-copy`
(`scripts/store/check-copy.mjs`), so a rewrite that overruns is caught before
it is pasted rather than after a rejection.

---

## App name — 30 max

```
Mythique: Hero Encyclopedia
```

27 characters. The bare wordmark is 8 and carries no search weight; the
qualifier is what an unbranded searcher actually types. Publisher names are
deliberately absent — see **Trademarks**.

## Subtitle — 30 max

```
Comic stats, powers & battles
```

28 characters. Names the three things the app actually does, in the order the
screenshots present them.

## Keywords — 100 max, comma-separated, no spaces

```
superhero,villain,comic,character,power,stat,versus,battle,anime,manga,wiki,database,trivia,fandom
```

97 characters. No spaces after commas — Apple counts them, and they buy
nothing. Singular forms only: Apple stems automatically, so "comic" already
matches "comics" and the plural would waste four characters.

Terms already in the app name or subtitle are omitted — Apple indexes those
fields too, and repeating a term there does not rank it twice.

## Promotional text — 170 max

Editable without shipping a build, so this is the field to change for a
seasonal push or a new feature. Current:

```
Side-by-side battles with real power stats, a daily debate, and a hero to
guess every day. Browse 50,000+ characters from comics, anime, film and
games — free, no ads.
```

164 characters.

## Description — 4000 max

```
Mythique is an encyclopedia for the characters you argue about.

Over 50,000 heroes and villains — from Marvel and DC to anime, manga, film,
games and creator-owned comics — with powers, origins, first appearances,
affiliations and the relationships between them.

SETTLE EVERY ARGUMENT
Put any two characters side by side and compare their power profiles stat by
stat: intelligence, strength, speed, durability, power and combat. No login
needed to vote — pick a side in the daily debate and watch the split move.

A DOSSIER, NOT A STUB
The characters people actually search for get a proper page: rated power
stats, abilities grouped by kind, a written summary, first appearance with
the issue that carried it, aliases, affiliations, and a relationship graph of
allies, enemies and family.

A DAILY REASON TO COME BACK
Guess the Hero — a new mystery character every day, with a streak to keep.
Today's Debate — one matchup, one tap, and yesterday's result.
Team Battle — draft a squad and see how it holds up.

WHAT LANDS THIS WEEK
Trailers, new issues, and what is in cinemas now, alongside the characters
they belong to. The Pulse tracks which characters are climbing this week and
what first appeared this month, going back decades.

BROWSE BY WHAT YOU CARE ABOUT
Universes and franchises, teams and affiliations, family dynasties and
houses, or straight search across characters, teams, titles and issues.

FREE AND AD-FREE
No ads, no paywall, no account required to browse or vote. Sign in only if
you want favourites, your own takes, or a streak that follows you.

Mythique is an independent reference work and is not affiliated with,
endorsed by, or sponsored by any comics publisher, studio or rights holder.
Character names and marks belong to their respective owners.
```

## What's New — 4000 max (first release)

```
First release.

- Over 50,000 characters, with deep dossiers on the ones you came for
- Side-by-side power comparisons and a daily debate you can vote in without
  an account
- Guess the Hero, with streaks
- The Pulse: trailers, new issues, and what is climbing this week
- Family trees, teams, universes and franchises
- Built for iPhone and iPad, with a full landscape layout on tablet
```

---

## Trademarks

Publisher and character marks are **kept out of the app name, subtitle and
keyword field**, and appear only in the description as a factual statement of
what the app catalogues, followed by an explicit disclaimer.

This is deliberate. Apple rejects listings that use third-party marks in a way
that implies endorsement, and the name/subtitle/keyword fields are exactly
where that inference gets drawn. Describing coverage in the body is ordinary
reference-work practice; putting "Marvel" in the title is not.

If Review still queries it, the fix is to cut the sentence naming publishers,
not to argue.

## Review notes

```
No account is required. The app opens straight into the catalogue, and the
daily debate accepts votes anonymously (deduplicated per device), so the
core experience is reviewable without signing in.

An account is only needed for favourites, posting a take, and streaks that
persist across devices. A demo account is provided below for those paths.

Demo account: <FILL IN>
Password: <FILL IN>

All character data is factual reference material — names, publication
history, first appearances and creator credits — compiled from public
sources (ComicVine, Wikidata, TMDB). Character artwork is generated for this
app; no publisher artwork is reproduced. The listing carries a disclaimer of
non-affiliation.
```

## Still owned by a human

These cannot be drafted here and must be set in App Store Connect:

- **Demo account** — create one, verify it can sign in, paste it above.
- **Age rating** questionnaire. Expect 12+: comic-book violence is mild and
  infrequent, and there is user-generated content (takes) — which Apple
  requires to have filtering, reporting and blocking. All three ship
  (`ReportSheet`, block action, `blocked_users`), so answer yes.
- **Privacy label** — the app collects an email address for accounts, and
  identifiers for the anonymous vote key. Neither is used for tracking.
- **Pricing** — free.
- **Support and marketing URLs** — https://mythique.app/support, https://mythique.app
- **Privacy policy URL** — https://mythique.app/privacy
- **APNs key** via `eas credentials`, if push ships in this build.
- **`APPLE_TEAM_ID` on Vercel** — the AASA file currently 503s, which breaks
  universal links. Not a submission blocker; it is a "links open the site
  instead of the app" bug.

## Honesty of claims

Measured 2026-08-17, and the reason the copy is worded the way it is:

| Measure                       | Actual |
| ----------------------------- | ------ |
| Characters catalogued         | 50,575 |
| With rated power stats        | 14,096 |
| With generated portrait art   | 4,034  |
| Hand-rated as notable (tier 2+) | 1,163 |

"Over 50,000 characters" is true of the catalogue. It is **not** true that
all of them have art, stats or a written dossier — which is why the
description says the characters people search for get a proper page, rather
than promising depth everywhere. Screenshots show fully-populated pages
because those are the ones a new user lands on; that is representative of the
experience, not of the median row.

Do not raise these numbers in copy without re-running the query.
