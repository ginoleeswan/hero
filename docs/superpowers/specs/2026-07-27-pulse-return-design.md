# Return — anticipation, a personal Pulse, and event push

**Date:** 2026-07-27
**Status:** Design. Nothing built.
**Depends on:** `2026-07-27-event-attribution-design.md` for notification copy.
**Sibling:** `2026-07-27-pulse-reach-design.md`. **Do reach first** — see §1.

---

## 1. The honest sequencing note

Everything in this document brings people **back**. The measured state is one user
and one vote, so there is nobody to bring back yet.

That is not a reason to skip it — it is a reason to build it _after_ reach, and to
build the **capture** half early even if the delivery half sits idle. A countdown
with a "notify me" is worth having in place before the audience arrives, because
it is the only non-annoying reason a first-time visitor would hand over a push
token.

---

## 2. Anticipation — the catalogue only reports the past

Everything shipped so far is retrospective: a trailer dropped, a comic shipped, a
convention ran, a character surged. The app now holds **59 titles with future
release dates** (`sync-tmdb-slate`, 2026-07-27) and uses none of them forward.

### 2.1 Countdowns

`titles.release_date` is populated and the Pulse already renders "In cinemas in
142 days" on the Doomsday card — the fact is there, it is just not a surface.

- A countdown chip on character pages: "Doctor Doom · Avengers: Doomsday in 142
  days", derived from `hero_media_appearances`.
- A release calendar keyed to characters, not titles. Every other site lists
  films; this one can list _your_ characters' films.

### 2.2 Notify me

The capture mechanic, and the reason this section exists before there is an
audience:

- On an upcoming title: "Tell me when the trailer drops."
- On a character: "Tell me when something happens to them."

Both are honest, specific promises the app can actually keep — `sync-title-videos`
runs daily and would fire the first; the surge and trailer lanes fire the second.
A modal asking for notifications with nothing attached is the alternative, and it
is worse.

Storage: `push_subscriptions` exists (`20260715144312`). This needs a subscription
_target_ (title id or hero id) alongside it, which is a small table rather than a
new pipeline.

---

## 3. A personal Pulse

The rail is currently identical for everyone. The pieces to personalise it exist:
`get_my_for_you` (`20260716082732`), favourites, `user_view_history`, and the taste
profile RPC.

**"Three things happened to characters you follow"** is the return loop. The
mechanic is a join, not a new signal: today's Pulse candidates ∩ the viewer's
favourites and recently-viewed.

Design notes:

- Personal events **augment** the shared rail, they do not replace it. A logged-out
  or new visitor must still get the good default — the rail is also the
  first-impression surface.
- Signed-out personalisation from `user_view_history` is worth doing; requiring an
  account to see anything tailored is the wrong trade at this stage.
- If a viewer's follows produced nothing today, say nothing. Do not pad it with
  the shared feed relabelled as personal — that is a small lie that costs trust
  the first time someone notices.

---

## 4. Event push

`send-daily-push` runs a working VAPID pipeline on a cron
(`20260715144851`). Event push is step 6 of the original live-events design and the
last unbuilt piece of it.

### 4.1 Copy

The notification body is exactly the attributed sentence:

> **Doctor Doom is surging** — the Avengers: Doomsday trailer landed today.

Without attribution it would read "Doctor Doom +938% this week", which is a
dashboard alert, not news.

### 4.2 The volume rule, stated first because it is the whole risk

The original design is blunt about this and it is worth repeating verbatim in
spirit: **cap volume hard from day one or you train people to disable
notifications and lose the channel permanently.**

Concretely:

- At most **one** push per person per day, and none unless a `trailer`, `surge`
  or `live_event` matched something they actually follow.
- A hard weekly ceiling as well as a daily one — a convention week can produce a
  qualifying event every day, and seven days running is how a channel dies.
- Never push an `issue`. A weekly shipment is not a reason to interrupt someone.
- Quiet hours, in the viewer's timezone.

### 4.3 Targeting

Match Pulse candidates against favourites first, then `notify me` subscriptions,
then recently-viewed. Every push must deep-link to the thing it is about; a push
that opens the home screen is a broken promise.

---

## 5. Non-goals

- **Digest email.** A newsletter is a different product with different
  infrastructure (deliverability, unsubscribe, templates). The email templates in
  `supabase/email-templates/` are transactional and are not a foundation for it.
- **Streaks or engagement mechanics** on the Pulse. `daily_streaks` exists for the
  daily game, where a streak is honest. Applying it to news would be manufacturing
  a reason to return rather than earning one.
- **Re-engagement pushes** ("you haven't visited in a while"). Not news, and the
  fastest route to a disabled channel.

## 6. Sequencing

1. Countdowns and "notify me" capture — small, useful immediately, and it
   accumulates targets while the audience is still arriving.
2. Personal Pulse — a join over the existing feed.
3. Event push — last, because it is the one that is expensive to get wrong.

## 7. How we would know it worked

- Notify-me conversions per upcoming title: does anyone actually ask to be told?
- Return rate within 48h of a push, against the volume cap. If more pushes produce
  fewer returns, the cap is already too loose.
- Push disable rate. This is the metric that matters most and the one that is
  hardest to recover from once it moves.
