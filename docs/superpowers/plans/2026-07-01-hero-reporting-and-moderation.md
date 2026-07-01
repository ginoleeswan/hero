# Hero-page Reporting & Image Moderation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in users report a character page, its AI portrait, or a gallery image; surface reports in a dedicated command-center lane; and email the admin instantly on each new report.

**Architecture:** A dedicated `public.reports` table (own-select RLS, all writes via `SECURITY DEFINER` RPCs — mirrors the existing `contributions` / `client_errors` pattern). A cross-platform `ReportSheet` opened from two entry points (the character page's contribute menu for page/AI-portrait reports; the `ImageLightbox` for gallery-image reports). A web-only `ReportsDomain` in the command center. An `AFTER INSERT` trigger fires `net.http_post` → a new `report-alert` edge function → Resend email.

**Tech Stack:** Expo/React Native (expo-router 4), Supabase (Postgres + RLS + `SECURITY DEFINER` RPCs, pg_net, pg_cron), Deno edge functions, Resend REST API, Jest.

## Global Constraints

- **Package manager:** yarn only (never npm/bun).
- **Screens never import `supabase` directly** — all DB access goes through `src/lib/db/`.
- **Migrations:** new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`; apply via `mcp__supabase__apply_migration`; **regenerate `src/types/database.generated.ts`** after (via `mcp__supabase__generate_typescript_types`) — never hand-edit it.
- **Supabase project ref:** `rpvgqfaeiowisdubgxkg` (URL base `https://rpvgqfaeiowisdubgxkg.supabase.co`).
- **TypeScript:** no `any`; `unknown` for caught errors. Functional components only. `StyleSheet.create` for all styles (no inline objects except `StyleSheet.absoluteFill`).
- **Fonts:** `Flame-Regular` (display), `FlameSans-Regular` / `Nunito_*` (UI). **Never `Flame-Bold`.**
- **Base canvas colour:** `#f5ebdc` (`COLORS.beige`).
- **Signed-in only:** every report has a non-null `user_id`; the RPC is the sole insert path (no direct client insert; no anon).
- **Testing:** unit-test pure logic only (mocked/pure); do not test screen rendering/navigation. Run `yarn test:ci`, `yarn typecheck`, `yarn lint`.
- **Platform pairs:** `app/character/[id].tsx` and `app/character/[id].web.tsx` drift — both must get the same change.
- **Reason ↔ target_type mapping (authoritative — used by client `REPORT_REASONS` AND the SQL guard):**
  - `page` → `inaccurate`, `offensive`, `duplicate`, `spam`, `other`
  - `image` → `wrong_subject`, `offensive`, `low_quality`, `other`
  - `ai_portrait` → `ai_inaccurate`, `offensive`, `low_quality`, `other`
  - The page entry point offers an `ai_inaccurate` reason that the client remaps to `target_type='ai_portrait'` with `image_url = portrait_url`.

---

## Task 1: `reports` table + RLS + RPCs migration

**Files:**
- Create: `supabase/migrations/20260701120000_reports_backbone.sql`
- Modify (regenerate): `src/types/database.generated.ts`

**Interfaces:**
- Produces (Postgres RPCs consumed by Task 2):
  - `submit_report(p_hero_id text, p_target_type text, p_image_url text, p_reason text, p_detail text) returns json` → `{ id }`
  - `admin_reports_queue(p_status text, p_reason text, p_limit int, p_offset int) returns json` → array of report rows
  - `admin_resolve_report(p_id bigint, p_decision text, p_note text) returns json` → `{ id, status }`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260701120000_reports_backbone.sql`:

```sql
-- User-facing reports (moderation). Signed-in only; the RPC is the sole insert
-- path (no direct client insert), mirroring contributions/submit_contribution.
-- Reports never mutate the hero — resolving is an acknowledgement, remediation
-- is a separate deliberate admin action.

create table if not exists public.reports (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  hero_id         text not null references public.heroes(id) on delete cascade,
  target_type     text not null,                 -- 'page' | 'image' | 'ai_portrait'
  image_url       text,                          -- reported image; null for 'page'
  reason          text not null,                 -- category code (guarded below)
  detail          text,                          -- free-text note
  status          text not null default 'open',  -- 'open' | 'resolved' | 'dismissed'
  resolved_by     uuid references auth.users(id),
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz not null default now(),
  constraint reports_target_chk check (target_type in ('page','image','ai_portrait')),
  constraint reports_status_chk check (status in ('open','resolved','dismissed'))
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_hero_idx   on public.reports (hero_id);

alter table public.reports enable row level security;

-- Own-select only (so a "you reported this" state is possible later). No insert
-- policy: inserts flow exclusively through submit_report (SECURITY DEFINER).
drop policy if exists reports_own_select on public.reports;
create policy reports_own_select on public.reports
  for select to authenticated using (user_id = auth.uid());

-- Reason must be valid FOR the target_type. One home for the allow-list, shared
-- by submit_report; keep in sync with REPORT_REASONS in src/lib/db/reports.ts.
create or replace function public._report_reason_ok(p_target text, p_reason text)
returns boolean language sql immutable as $$
  select case p_target
    when 'page'        then p_reason in ('inaccurate','offensive','duplicate','spam','other')
    when 'image'       then p_reason in ('wrong_subject','offensive','low_quality','other')
    when 'ai_portrait' then p_reason in ('ai_inaccurate','offensive','low_quality','other')
    else false end;
$$;

-- ── Submit a report (auth required; the ONLY insert path) ─────────────────────
create or replace function public.submit_report(
  p_hero_id text, p_target_type text, p_image_url text, p_reason text, p_detail text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_img text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_detail text := nullif(btrim(coalesce(p_detail, '')), '');
  v_open int;
  v_id bigint;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_target_type not in ('page','image','ai_portrait') then raise exception 'invalid target'; end if;
  if not public._report_reason_ok(p_target_type, p_reason) then raise exception 'invalid reason'; end if;
  if not exists (select 1 from public.heroes where id = p_hero_id) then raise exception 'unknown hero'; end if;
  if p_target_type = 'page' then
    v_img := null;                                   -- page reports carry no image
  elsif v_img is null then
    raise exception 'image required';                -- image/ai reports must reference one
  end if;
  if p_reason = 'other' and v_detail is null then raise exception 'detail required'; end if;
  v_detail := left(v_detail, 1000);

  select count(*) into v_open from public.reports
    where user_id = v_uid and status = 'open';
  if v_open >= 30 then raise exception 'too many open reports'; end if;

  -- One open report per (user, hero, target, image).
  if exists (
    select 1 from public.reports
    where user_id = v_uid and hero_id = p_hero_id and status = 'open'
      and target_type = p_target_type and coalesce(image_url,'') = coalesce(v_img,'')
  ) then raise exception 'already reported'; end if;

  insert into public.reports (user_id, hero_id, target_type, image_url, reason, detail)
  values (v_uid, p_hero_id, p_target_type, v_img, p_reason, v_detail)
  returning id into v_id;

  return json_build_object('id', v_id, 'status', 'open');
end;
$$;

-- ── Admin: the reports queue ──────────────────────────────────────────────────
create or replace function public.admin_reports_queue(
  p_status text default 'open', p_reason text default null, p_limit int default 100, p_offset int default 0
) returns json language sql security definer set search_path = public stable
as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select rp.id, rp.hero_id, h.name as hero_name, h.portrait_url as hero_portrait_url,
           rp.target_type, rp.image_url, rp.reason, rp.detail, rp.status,
           rp.resolution_note, rp.created_at, rp.user_id,
           up.display_name as submitter
    from public.reports rp
    join public.heroes h on h.id = rp.hero_id
    left join public.user_profiles up on up.id = rp.user_id
    where rp.status = p_status
      and (p_reason is null or rp.reason = p_reason)
      and exists (select 1 from public.user_profiles a where a.id = auth.uid() and a.is_admin)
    order by rp.created_at desc
    limit p_limit offset p_offset
  ) r;
$$;

-- ── Admin: resolve / dismiss a report (no hero/image mutation) ────────────────
create or replace function public.admin_resolve_report(p_id bigint, p_decision text, p_note text)
returns json language plpgsql security definer set search_path = public
as $$
declare v_admin uuid := auth.uid();
begin
  if not exists (select 1 from public.user_profiles where id = v_admin and is_admin) then
    raise exception 'not authorized';
  end if;
  if p_decision not in ('resolve','dismiss') then raise exception 'invalid decision'; end if;

  update public.reports
    set status = case when p_decision = 'resolve' then 'resolved' else 'dismissed' end,
        resolved_by = v_admin, resolved_at = now(),
        resolution_note = nullif(btrim(coalesce(p_note,'')), '')
    where id = p_id and status = 'open';
  if not found then raise exception 'not found or already reviewed'; end if;

  return json_build_object('id', p_id,
    'status', case when p_decision = 'resolve' then 'resolved' else 'dismissed' end);
end;
$$;

revoke all on function public.submit_report(text, text, text, text, text)        from public, anon;
revoke all on function public.admin_reports_queue(text, text, int, int)          from public, anon;
revoke all on function public.admin_resolve_report(bigint, text, text)           from public, anon;
grant execute on function public.submit_report(text, text, text, text, text)       to authenticated, service_role;
grant execute on function public.admin_reports_queue(text, text, int, int)         to authenticated, service_role;
grant execute on function public.admin_resolve_report(bigint, text, text)          to authenticated, service_role;
```

- [ ] **Step 2: Apply the migration**

Use the MCP tool `mcp__supabase__apply_migration` with name `reports_backbone` and the SQL above.
Expected: success, no error.

- [ ] **Step 3: Verify the table + guard**

Run via `mcp__supabase__execute_sql`:

```sql
select public._report_reason_ok('page','inaccurate')      as page_ok,      -- true
       public._report_reason_ok('page','ai_inaccurate')   as page_bad,     -- false
       public._report_reason_ok('ai_portrait','ai_inaccurate') as ai_ok,   -- true
       public._report_reason_ok('image','wrong_subject')  as image_ok;     -- true
select column_name from information_schema.columns
  where table_name = 'reports' order by ordinal_position;
```
Expected: `page_ok=true, page_bad=false, ai_ok=true, image_ok=true`; 12 columns listed.

- [ ] **Step 4: Regenerate types**

Run `mcp__supabase__generate_typescript_types` and overwrite `src/types/database.generated.ts` with the result.
Expected: the file now contains a `reports` row type. Then run:

Run: `yarn typecheck`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260701120000_reports_backbone.sql src/types/database.generated.ts
git commit -m "feat(reports): reports table + RLS + submit/queue/resolve RPCs"
```

---

## Task 2: `src/lib/db/reports.ts` data layer + pure-logic tests

**Files:**
- Create: `src/lib/db/reports.ts`
- Test: `__tests__/lib/reports.test.ts`

**Interfaces:**
- Consumes: the three RPCs from Task 1.
- Produces (consumed by Tasks 3–5):
  - `type ReportContext = 'page' | 'image'`
  - `type ReportTargetType = 'page' | 'image' | 'ai_portrait'`
  - `interface ReasonOption { code: string; label: string }`
  - `REPORT_REASONS: Record<ReportContext, ReasonOption[]>`
  - `resolveReportTarget(context, reasonCode, refs): { targetType: ReportTargetType; imageUrl: string | null }`
  - `submitReport(opts): Promise<{ ok: true; id: number } | { ok: false; error: string }>`
  - `interface ReportRow { ... }`
  - `fetchReportsQueue(status, reason?): Promise<ReportRow[]>`
  - `resolveReport(id, decision, note?): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/reports.test.ts`:

```ts
import { REPORT_REASONS, resolveReportTarget } from '../../src/lib/db/reports';

describe('REPORT_REASONS', () => {
  it('exposes reason sets for page and image contexts', () => {
    expect(REPORT_REASONS.page.map((r) => r.code)).toEqual(
      expect.arrayContaining(['inaccurate', 'ai_inaccurate', 'offensive', 'duplicate', 'spam', 'other']),
    );
    expect(REPORT_REASONS.image.map((r) => r.code)).toEqual(
      expect.arrayContaining(['wrong_subject', 'offensive', 'low_quality', 'other']),
    );
    // Every reason has a non-empty human label.
    for (const ctx of ['page', 'image'] as const)
      for (const r of REPORT_REASONS[ctx]) expect(r.label.length).toBeGreaterThan(0);
  });
});

describe('resolveReportTarget', () => {
  it('maps the page "ai_inaccurate" reason to the ai_portrait target with the portrait url', () => {
    expect(
      resolveReportTarget('page', 'ai_inaccurate', { portraitUrl: 'p.jpg', imageUrl: null }),
    ).toEqual({ targetType: 'ai_portrait', imageUrl: 'p.jpg' });
  });
  it('keeps ordinary page reasons on the page target with no image', () => {
    expect(resolveReportTarget('page', 'inaccurate', { portraitUrl: 'p.jpg' })).toEqual({
      targetType: 'page',
      imageUrl: null,
    });
  });
  it('maps image context to the image target carrying the shown image url', () => {
    expect(resolveReportTarget('image', 'wrong_subject', { imageUrl: 'g.jpg' })).toEqual({
      targetType: 'image',
      imageUrl: 'g.jpg',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest __tests__/lib/reports.test.ts`
Expected: FAIL — cannot find module `../../src/lib/db/reports`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/db/reports.ts`:

```ts
import { supabase } from '../supabase';

// User-facing report/moderation data layer. Signed-in only; all writes go
// through SECURITY DEFINER RPCs (submit_report is the sole insert path). Keep
// REPORT_REASONS in sync with the _report_reason_ok guard in the reports
// backbone migration.

export type ReportContext = 'page' | 'image';
export type ReportTargetType = 'page' | 'image' | 'ai_portrait';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface ReasonOption {
  code: string;
  label: string;
}

/** Reasons offered per entry-point context. The page "ai_inaccurate" reason is
 *  remapped by resolveReportTarget to the ai_portrait target. */
export const REPORT_REASONS: Record<ReportContext, ReasonOption[]> = {
  page: [
    { code: 'inaccurate', label: 'Incorrect information' },
    { code: 'ai_inaccurate', label: "The main image doesn’t look right" },
    { code: 'offensive', label: 'Offensive or inappropriate' },
    { code: 'duplicate', label: 'Duplicate character' },
    { code: 'spam', label: 'Spam' },
    { code: 'other', label: 'Something else' },
  ],
  image: [
    { code: 'wrong_subject', label: "This isn’t the right character" },
    { code: 'offensive', label: 'Offensive or inappropriate' },
    { code: 'low_quality', label: 'Low quality / broken image' },
    { code: 'other', label: 'Something else' },
  ],
};

/** Resolve the stored target_type + image_url from the sheet context and the
 *  chosen reason. Page + "ai_inaccurate" → the single AI portrait. */
export function resolveReportTarget(
  context: ReportContext,
  reasonCode: string,
  refs: { imageUrl?: string | null; portraitUrl?: string | null },
): { targetType: ReportTargetType; imageUrl: string | null } {
  if (context === 'image') return { targetType: 'image', imageUrl: refs.imageUrl ?? null };
  if (reasonCode === 'ai_inaccurate')
    return { targetType: 'ai_portrait', imageUrl: refs.portraitUrl ?? null };
  return { targetType: 'page', imageUrl: null };
}

export type SubmitResult = { ok: true; id: number } | { ok: false; error: string };

/** File a report. Signed-in only (RPC rejects anon). */
export async function submitReport(opts: {
  heroId: string;
  targetType: ReportTargetType;
  imageUrl?: string | null;
  reason: string;
  detail?: string | null;
}): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_report', {
    p_hero_id: opts.heroId,
    p_target_type: opts.targetType,
    p_image_url: opts.imageUrl ?? '',
    p_reason: opts.reason,
    p_detail: opts.detail ?? '',
  });
  if (error) return { ok: false, error: error.message };
  const d = (data ?? {}) as { id?: number };
  return { ok: true, id: d.id ?? 0 };
}

export interface ReportRow {
  id: number;
  hero_id: string;
  hero_name: string;
  hero_portrait_url: string | null;
  target_type: ReportTargetType;
  image_url: string | null;
  reason: string;
  detail: string | null;
  status: ReportStatus;
  resolution_note: string | null;
  created_at: string;
  user_id: string;
  submitter: string | null;
}

/** Admin: the reports queue for a status, optionally filtered by reason.
 *  Returns [] for non-admins (silent lock) and on error. */
export async function fetchReportsQueue(
  status: ReportStatus = 'open',
  reason?: string | null,
): Promise<ReportRow[]> {
  const { data, error } = await supabase.rpc('admin_reports_queue', {
    p_status: status,
    p_reason: reason ?? null,
    p_limit: 100,
    p_offset: 0,
  });
  if (error) {
    console.warn('[fetchReportsQueue] error:', error.message);
    return [];
  }
  return (data ?? []) as unknown as ReportRow[];
}

/** Admin: resolve or dismiss a report. */
export async function resolveReport(
  id: number,
  decision: 'resolve' | 'dismiss',
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('admin_resolve_report', {
    p_id: id,
    p_decision: decision,
    p_note: note ?? '',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn jest __tests__/lib/reports.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `yarn typecheck`
Expected: PASS.

```bash
git add src/lib/db/reports.ts __tests__/lib/reports.test.ts
git commit -m "feat(reports): reports.ts data layer + reason mapping"
```

---

## Task 3: `ReportSheet` component

**Files:**
- Create: `src/components/report/ReportSheet.tsx`

**Interfaces:**
- Consumes: `REPORT_REASONS`, `resolveReportTarget`, `submitReport`, `ReportContext` from `src/lib/db/reports.ts`.
- Produces (consumed by Task 4):
  - `interface ReportSheetProps { visible; onClose; heroId; heroName; context: ReportContext; imageUrl?; portraitUrl?; user; onRequestSignIn }`
  - `export function ReportSheet(props: ReportSheetProps)`

- [ ] **Step 1: Create the component**

Create `src/components/report/ReportSheet.tsx`. It mirrors the `ContributeSheet` bottom-sheet chrome (beige sheet, grabber, sign-in gate, warm success), but is reason-first:

```tsx
// Cross-platform report sheet — a bottom sheet that asks "what's wrong?" with a
// tap-to-pick reason list and an optional detail note, then files it via
// submit_report. Signed-in only (a queued moderation signal, never a direct
// edit). Opened from the character page's contribute menu (context='page') and
// the image lightbox (context='image').
import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';
import {
  REPORT_REASONS,
  resolveReportTarget,
  submitReport,
  type ReportContext,
} from '../../lib/db/reports';

export interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  heroId: string;
  heroName: string;
  context: ReportContext;
  /** The gallery image being reported (image context). */
  imageUrl?: string | null;
  /** The AI portrait url, attached when the page "ai_inaccurate" reason is picked. */
  portraitUrl?: string | null;
  user: { id: string } | null | undefined;
  onRequestSignIn: () => void;
}

export function ReportSheet({
  visible,
  onClose,
  heroId,
  heroName,
  context,
  imageUrl,
  portraitUrl,
  user,
  onRequestSignIn,
}: ReportSheetProps) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason(null);
      setDetail('');
      setError(null);
      setDone(false);
      setSubmitting(false);
    }
  }, [visible]);

  const reasons = REPORT_REASONS[context];
  // ai_inaccurate (page) attaches the portrait; image context shows the image.
  const thumb = context === 'image' ? imageUrl : reason === 'ai_inaccurate' ? portraitUrl : null;

  const submit = async () => {
    if (!reason) {
      setError('Pick a reason first.');
      return;
    }
    if (reason === 'other' && !detail.trim()) {
      setError('Tell us a bit more.');
      return;
    }
    const target = resolveReportTarget(context, reason, { imageUrl, portraitUrl });
    setSubmitting(true);
    setError(null);
    const res = await submitReport({
      heroId,
      targetType: target.targetType,
      imageUrl: target.imageUrl,
      reason,
      detail: detail.trim() || null,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error === 'already reported' ? "You've already reported this." : (res.error ?? 'Could not submit — please try again.'));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDone(true);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation?.()}>
          <View style={s.grabber} />

          {!user ? (
            <View style={s.body}>
              <Text style={s.kicker}>{heroName}</Text>
              <Text style={s.prompt}>Report a problem</Text>
              <Text style={s.guideline}>Sign in to report — it helps us keep pages accurate.</Text>
              <Pressable onPress={onRequestSignIn} style={[s.btn, s.btnPrimary]}>
                <Text style={s.btnPrimaryText}>Sign in to report</Text>
              </Pressable>
            </View>
          ) : done ? (
            <View style={s.body}>
              <View style={s.doneIcon}>
                <Ionicons name="checkmark" size={28} color="#fff" />
              </View>
              <Text style={s.doneTitle}>Reported</Text>
              <Text style={s.doneSub}>Thanks for flagging this.</Text>
              <Text style={s.doneMeta}>We’ll take a look shortly.</Text>
              <Pressable onPress={onClose} style={[s.btn, s.btnPrimary]}>
                <Text style={s.btnPrimaryText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.body}>
              <Text style={s.kicker}>{heroName}</Text>
              <Text style={s.prompt}>Report a problem</Text>
              <Text style={s.guideline}>What’s wrong here?</Text>

              {thumb ? (
                <Image source={{ uri: thumb }} style={s.thumb} contentFit="cover" />
              ) : null}

              <View style={s.reasons}>
                {reasons.map((r) => {
                  const on = reason === r.code;
                  return (
                    <Pressable
                      key={r.code}
                      onPress={() => setReason(r.code)}
                      style={[s.reasonRow, on && s.reasonRowOn]}
                    >
                      <Ionicons
                        name={on ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={on ? COLORS.orange : COLORS.grey}
                      />
                      <Text style={[s.reasonText, on && s.reasonTextOn]}>{r.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={detail}
                onChangeText={setDetail}
                placeholder={reason === 'other' ? 'Tell us what’s wrong' : 'Add details (optional)'}
                placeholderTextColor={COLORS.grey}
                multiline
                maxLength={1000}
                style={[s.input, s.inputMultiline]}
              />
              {!!error && <Text style={s.error}>{error}</Text>}
              <Pressable
                onPress={submit}
                disabled={submitting}
                style={[s.btn, s.btnPrimary, submitting && s.btnDisabled]}
              >
                <Text style={s.btnPrimaryText}>{submitting ? 'Sending…' : 'Submit report'}</Text>
              </Pressable>
              <Text style={s.reviewNote}>Reports are reviewed by a moderator.</Text>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,24,32,0.55)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderCurve: 'continuous',
    paddingBottom: 28,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(41,60,67,0.25)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  body: { paddingHorizontal: 22, paddingTop: 10 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 4,
  },
  prompt: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.navy, lineHeight: 30 },
  guideline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(41,60,67,0.7)',
    lineHeight: 20,
    marginTop: 6,
  },
  thumb: {
    width: 72,
    height: 96,
    borderRadius: 10,
    marginTop: 14,
    backgroundColor: COLORS.navy + '18',
  },
  reasons: { marginTop: 14, gap: 6 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
    backgroundColor: '#fff',
  },
  reasonRowOn: { borderColor: COLORS.orange, backgroundColor: '#fff7ef' },
  reasonText: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },
  reasonTextOn: { fontFamily: 'Nunito_700Bold' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.black,
    marginTop: 12,
  },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  error: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.red, marginTop: 10 },
  btn: { paddingVertical: 14, borderRadius: 26, alignItems: 'center', marginTop: 16 },
  btnPrimary: { backgroundColor: COLORS.orange },
  btnPrimaryText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.6 },
  reviewNote: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    marginTop: 12,
  },
  doneIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  doneTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 24,
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  doneSub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: COLORS.navy,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 6,
  },
  doneMeta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(41,60,67,0.7)',
    textAlign: 'center',
    lineHeight: 19,
  },
});
```

- [ ] **Step 2: Verify it typechecks + lints**

Run: `yarn typecheck && yarn lint src/components/report/ReportSheet.tsx`
Expected: PASS (no errors; `COLORS.black` exists — confirm in `src/constants/colors.ts`, else use `COLORS.navy`).

- [ ] **Step 3: Commit**

```bash
git add src/components/report/ReportSheet.tsx
git commit -m "feat(reports): ReportSheet bottom sheet (reason-first)"
```

---

## Task 4: Lightbox `onReport` + wire `ReportSheet` into both character screens

**Files:**
- Modify: `src/components/ImageLightbox.tsx`
- Modify: `app/character/[id].tsx`
- Modify: `app/character/[id].web.tsx`

**Interfaces:**
- Consumes: `ReportSheet` (Task 3), `ReportContext` (Task 2).
- Produces: `ImageLightbox` gains `onReport?: (image: { url: string; caption?: string | null }) => void`.

- [ ] **Step 1: Add `onReport` to `ImageLightbox`**

In `src/components/ImageLightbox.tsx`, extend the props type (currently `images`, `initialIndex`, `onClose`) with:

```tsx
  onReport?: (image: { url: string; caption?: string | null }) => void;
```

Add `onReport` to the destructured params: `export function ImageLightbox({ images, initialIndex, onClose, onReport }: Props)`.

Add a report button immediately **after** the existing close `TouchableOpacity` (which uses `testID="lightbox-close"`), inside the same parent `View`:

```tsx
        {onReport ? (
          <TouchableOpacity
            testID="lightbox-report"
            onPress={() => onReport(images[indexRef.current])}
            style={[styles.reportBtn, { top: insets.top + 12 }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="flag-outline" size={22} color="#fff" />
          </TouchableOpacity>
        ) : null}
```

Add to the `StyleSheet.create` block (mirror `closeBtn`, positioned to its left):

```tsx
  reportBtn: { position: 'absolute', right: 64, padding: 6 },
```
(If `closeBtn` uses a different `right`/layout, place `reportBtn` ~48px to its left so they don't overlap.)

- [ ] **Step 2: Wire native `app/character/[id].tsx`**

Add the import near the other component imports:

```tsx
import { ReportSheet } from '../../src/components/report/ReportSheet';
import type { ReportContext } from '../../src/lib/db/reports';
```

Add report state next to the existing `lightboxImages`/`editTarget` state (around line 633):

```tsx
  const [reportCtx, setReportCtx] = useState<{ context: ReportContext; imageUrl?: string | null } | null>(null);
```

Rename the contribute-menu item: change the label text `Report incorrect info` → `Report a problem`, and change its `onPress` body from `setEditTarget({ field: null, current: null, report: true })` to:

```tsx
                        setContributeMenu(false);
                        setReportCtx({ context: 'page' });
```

Pass `onReport` to the existing `ImageLightbox` render (around line 1602):

```tsx
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxImages([])}
          onReport={(img) => setReportCtx({ context: 'image', imageUrl: img.url })}
        />
```

Mount `ReportSheet` next to the existing `ContributeSheet` render (use the same `data`, `user`, `router` already in scope; `heroPortraitUrl` is already defined for the header image):

```tsx
      {data ? (
        <ReportSheet
          visible={reportCtx !== null}
          onClose={() => setReportCtx(null)}
          heroId={data.stats.id}
          heroName={data.stats.name}
          context={reportCtx?.context ?? 'page'}
          imageUrl={reportCtx?.imageUrl ?? null}
          portraitUrl={heroPortraitUrl}
          user={user}
          onRequestSignIn={() => router.push('/(auth)/login')}
        />
      ) : null}
```

Leave the old `report?: boolean` on `editTarget` and the `ContributeSheet` `report` prop in place (unused now, removed opportunistically) — do not break the existing `ContributeSheet` wiring.

- [ ] **Step 3: Wire web `app/character/[id].web.tsx` (mirror Step 2)**

Apply the identical logic in the web file: add the same imports; add the `reportCtx` state; rename the menu item (`Report incorrect info` → `Report a problem`, around line 2213) and repoint its `onPress` to `setReportCtx({ context: 'page' })`; add `onReport` to the `ImageLightbox` render; mount `ReportSheet` with the web file's in-scope names (it uses the same `data`/`user`/`router`; confirm the portrait variable name — it mirrors the native `heroPortraitUrl`). Use the web file's style object convention where JSX style casts are needed (it uses `as object` casts, e.g. `s2`).

- [ ] **Step 4: Verify**

Run: `yarn typecheck && yarn test:ci`
Expected: PASS. Then manually (per the "verify web via device screenshots" convention, the user will screenshot): open a character page → contribute menu → "Report a problem" shows the reason list; open a gallery image → the flag button files an image report.

- [ ] **Step 5: Commit**

```bash
git add src/components/ImageLightbox.tsx "app/character/[id].tsx" "app/character/[id].web.tsx"
git commit -m "feat(reports): report entry points (page menu + lightbox)"
```

---

## Task 5: `ReportsDomain` command-center lane + domain registration + open-report alert

**Files:**
- Create: `src/components/admin/health/domains/ReportsDomain.tsx`
- Modify: `src/components/admin/health/format.ts`
- Modify: `app/admin/health.web.tsx`

**Interfaces:**
- Consumes: `fetchReportsQueue`, `resolveReport`, `ReportRow`, `ReportStatus`, `REPORT_REASONS` (Task 2); `Panel` from `../Panel`; `Alert` type from `../AlertStack`.
- Produces: `export function ReportsDomain()`; `DomainKey` gains `'reports'`.

- [ ] **Step 1: Register the `reports` domain in `format.ts`**

In `src/components/admin/health/format.ts`, add `| 'reports'` to the `DomainKey` union, and add to the `DOMAINS` array (after the `community` entry):

```ts
  { key: 'reports', label: 'Reports', icon: 'flag-outline' },
```

- [ ] **Step 2: Create `ReportsDomain.tsx`**

Create `src/components/admin/health/domains/ReportsDomain.tsx`:

```tsx
// Command-center domain: the user-report moderation queue. Admins resolve or
// dismiss reports of a page, its AI portrait, or a gallery image. Image/portrait
// reports show the reported art (portrait reports show it beside the current
// portrait). Web-only, like the rest of the command center.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Panel } from '../Panel';
import { COLORS } from '../../../../constants/colors';
import {
  fetchReportsQueue,
  resolveReport,
  REPORT_REASONS,
  type ReportRow,
  type ReportStatus,
  type ReportTargetType,
} from '../../../../lib/db/reports';

const TARGET_LABEL: Record<ReportTargetType, string> = {
  page: 'Page',
  image: 'Image',
  ai_portrait: 'AI portrait',
};
const TARGET_COLOR: Record<ReportTargetType, string> = {
  page: COLORS.blue,
  image: COLORS.orange,
  ai_portrait: COLORS.red,
};
const STATUSES: ReportStatus[] = ['open', 'resolved', 'dismissed'];
// Reason code → label across both contexts (for display).
const REASON_LABEL: Record<string, string> = Object.fromEntries(
  [...REPORT_REASONS.page, ...REPORT_REASONS.image].map((r) => [r.code, r.label]),
);

export function ReportsDomain() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ReportStatus>('open');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['reportsQueue', status],
    queryFn: () => fetchReportsQueue(status),
  });
  const rows = q.data ?? [];

  const decide = async (id: number, decision: 'resolve' | 'dismiss') => {
    setErr(null);
    setBusyId(id);
    const res = await resolveReport(id, decision);
    setBusyId(null);
    if (!res.ok) {
      setErr(res.error ?? 'Action failed');
      return;
    }
    qc.invalidateQueries({ queryKey: ['reportsQueue'] });
  };

  return (
    <View style={s.wrap}>
      <Panel
        title="Reports"
        hint={q.isLoading ? 'Loading…' : `${rows.length} ${status}`}
      >
        <View style={s.filters}>
          {STATUSES.map((st) => (
            <Pressable key={st} onPress={() => setStatus(st)} style={[s.chip, status === st && s.chipOn]}>
              <Text style={[s.chipText, status === st && s.chipTextOn]}>{st}</Text>
            </Pressable>
          ))}
        </View>
        {!!err && <Text style={s.err}>{err}</Text>}
        {q.isLoading ? (
          <Text style={s.muted}>Loading…</Text>
        ) : rows.length === 0 ? (
          <Text style={s.muted}>No {status} reports.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((r) => (
              <ReportRowView key={r.id} r={r} busy={busyId === r.id} onDecide={decide} />
            ))}
          </View>
        )}
      </Panel>
    </View>
  );
}

function ReportRowView({
  r,
  busy,
  onDecide,
}: {
  r: ReportRow;
  busy: boolean;
  onDecide: (id: number, d: 'resolve' | 'dismiss') => void;
}) {
  const showReported = r.target_type !== 'page' && !!r.image_url;
  const showCompare = r.target_type === 'ai_portrait' && !!r.hero_portrait_url;
  return (
    <View style={s.row}>
      <View style={s.rowHead}>
        <Pressable onPress={() => Linking.openURL(`/character/${r.hero_id}`)}>
          <Text style={s.hero}>{r.hero_name}</Text>
        </Pressable>
        <View style={[s.badge, { backgroundColor: TARGET_COLOR[r.target_type] + '22' }]}>
          <Text style={[s.badgeText, { color: TARGET_COLOR[r.target_type] }]}>
            {TARGET_LABEL[r.target_type]}
          </Text>
        </View>
      </View>
      <Text style={s.reason}>{REASON_LABEL[r.reason] ?? r.reason}</Text>
      {!!r.detail && <Text style={s.detail}>{r.detail}</Text>}
      {(showReported || showCompare) && (
        <View style={s.thumbs}>
          {showReported && (
            <View style={s.thumbWrap}>
              <Image source={{ uri: r.image_url! }} style={s.thumb} contentFit="cover" />
              <Text style={s.thumbLabel}>Reported</Text>
            </View>
          )}
          {showCompare && (
            <View style={s.thumbWrap}>
              <Image source={{ uri: r.hero_portrait_url! }} style={s.thumb} contentFit="cover" />
              <Text style={s.thumbLabel}>Current</Text>
            </View>
          )}
        </View>
      )}
      <Text style={s.meta}>
        {r.submitter ?? 'someone'} · {new Date(r.created_at).toLocaleString()}
      </Text>
      {r.status === 'open' ? (
        <View style={s.actions}>
          <Pressable disabled={busy} onPress={() => onDecide(r.id, 'resolve')} style={[s.action, s.resolve]}>
            <Text style={s.resolveText}>Resolve</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => onDecide(r.id, 'dismiss')} style={[s.action, s.dismiss]}>
            <Text style={s.dismissText}>Dismiss</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={s.resolved}>{r.status}{r.resolution_note ? ` — ${r.resolution_note}` : ''}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: '#efe6d6' },
  chipOn: { backgroundColor: COLORS.orange },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy, textTransform: 'capitalize' },
  chipTextOn: { color: '#fff' },
  err: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.red, marginBottom: 8 },
  muted: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey },
  row: { backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 6 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.navy },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  reason: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.navy },
  detail: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: 'rgba(41,60,67,0.8)', lineHeight: 20 },
  thumbs: { flexDirection: 'row', gap: 10, marginTop: 4 },
  thumbWrap: { alignItems: 'center', gap: 3 },
  thumb: { width: 60, height: 80, borderRadius: 8, backgroundColor: COLORS.navy + '18' },
  thumbLabel: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: COLORS.grey, textTransform: 'uppercase' },
  meta: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  action: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  resolve: { backgroundColor: COLORS.green },
  resolveText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
  dismiss: { backgroundColor: '#efe6d6' },
  dismissText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  resolved: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, textTransform: 'capitalize' },
});
```

- [ ] **Step 3: Render the domain + open-report alert in `health.web.tsx`**

In `app/admin/health.web.tsx`:

1. Import it near the other domain imports:
```tsx
import { ReportsDomain } from '../../src/components/admin/health/domains/ReportsDomain';
```
2. Add a query for the open-report count (near the other `useQuery` calls, e.g. beside `errorsQ`):
```tsx
  const openReportsQ = useQuery({
    queryKey: ['reportsQueue', 'open'],
    queryFn: () => fetchReportsQueue('open'),
    enabled: !!user,
  });
```
with `import { fetchReportsQueue } from '../../src/lib/db/reports';`.
3. Add the domain render block (mirror the `errors` block near line 523):
```tsx
        {domain === 'reports' && <ReportsDomain />}
```
4. Add an alert into the `alerts` `useMemo` (around line 222) so the bell badges when reports wait — append to the array it builds:
```tsx
    if ((openReportsQ.data?.length ?? 0) > 0)
      list.push({ tone: 'red', text: `${openReportsQ.data!.length} open report${openReportsQ.data!.length === 1 ? '' : 's'}` });
```
(Match the exact local variable name the `useMemo` uses for its accumulator — read the block first; the `Alert` shape is `{ tone: 'red' | 'gold'; text: string }`. Add `openReportsQ.data` to the `useMemo` dependency array.)

- [ ] **Step 4: Verify**

Run: `yarn typecheck && yarn lint`
Expected: PASS. Manually: the command center shows a **Reports** rail item; open reports list with resolve/dismiss; the bell badges when reports are open.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/health/domains/ReportsDomain.tsx src/components/admin/health/format.ts app/admin/health.web.tsx
git commit -m "feat(reports): command-center Reports lane + open-report alert"
```

---

## Task 6: `report-alert` edge function (Resend email)

**Files:**
- Create: `supabase/functions/report-alert/index.ts`

**Interfaces:**
- Consumes: POST body `{ id: number }` (from the Task 7 trigger). Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `REPORT_ALERT_TO`, `REPORT_ALERT_FROM`.
- Produces: an HTTP endpoint at `/functions/v1/report-alert`.

- [ ] **Step 1: Create the function**

Create `supabase/functions/report-alert/index.ts`:

```ts
// report-alert: emails the admin when a new report is filed. Invoked by an
// AFTER INSERT trigger on public.reports (via pg_net) with { id }. Loads the
// report via the service role and sends one email through Resend. No-ops
// gracefully if RESEND_API_KEY is unset, so reports never depend on email.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

const REASON_LABEL: Record<string, string> = {
  inaccurate: 'Incorrect information',
  ai_inaccurate: 'AI portrait looks wrong',
  offensive: 'Offensive or inappropriate',
  duplicate: 'Duplicate character',
  spam: 'Spam',
  wrong_subject: 'Wrong character',
  low_quality: 'Low quality image',
  other: 'Something else',
};
const TARGET_LABEL: Record<string, string> = {
  page: 'Page',
  image: 'Gallery image',
  ai_portrait: 'AI portrait',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    if (!Number.isFinite(id)) return json({ error: 'bad id' }, 400);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { data: rep, error } = await sb
      .from('reports')
      .select('id, hero_id, target_type, image_url, reason, detail, created_at')
      .eq('id', id)
      .single();
    if (error || !rep) return json({ error: 'report not found' }, 404);

    const { data: hero } = await sb.from('heroes').select('name').eq('id', rep.hero_id).single();
    const heroName = hero?.name ?? rep.hero_id;

    const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    if (!apiKey) return json({ status: 'skipped', reason: 'no RESEND_API_KEY' });

    const to = Deno.env.get('REPORT_ALERT_TO') ?? 'ginoswanepoel@gmail.com';
    const from = Deno.env.get('REPORT_ALERT_FROM') ?? 'Mythique <reports@mythique.app>';
    const reasonText = REASON_LABEL[rep.reason] ?? rep.reason;
    const targetText = TARGET_LABEL[rep.target_type] ?? rep.target_type;
    const heroUrl = `https://mythique.app/character/${rep.hero_id}`;

    const html = `
      <h2>New report: ${reasonText}</h2>
      <p><strong>${heroName}</strong> — ${targetText}</p>
      ${rep.detail ? `<p>${String(rep.detail).replace(/</g, '&lt;')}</p>` : ''}
      ${rep.image_url ? `<p><a href="${rep.image_url}">Reported image</a></p>` : ''}
      <p><a href="${heroUrl}">Open the character page</a> · <a href="https://mythique.app/admin/health">Command center → Reports</a></p>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: `New report: ${reasonText} — ${heroName}`, html }),
    });
    if (!res.ok) return json({ status: 'error', http: res.status, detail: await res.text() }, 502);
    return json({ status: 'sent' });
  } catch (err) {
    return json({ status: 'error', message: err instanceof Error ? err.message : 'unknown' }, 500);
  }
});
```

- [ ] **Step 2: Deploy the function**

Use `mcp__supabase__deploy_edge_function` with name `report-alert` and the file above.
Expected: deploy success. (Email stays a graceful no-op until `RESEND_API_KEY` is set — see Step 3.)

- [ ] **Step 3: Document the required secrets (provisioning by the user)**

The function needs these edge-function secrets set in the Supabase dashboard (Project → Edge Functions → Secrets), or via CLI `supabase secrets set`:
- `RESEND_API_KEY` — from resend.com (free tier).
- `REPORT_ALERT_FROM` — a verified Resend sender (e.g. `Mythique <reports@yourdomain>`); until a domain is verified, Resend allows `onboarding@resend.dev`.
- `REPORT_ALERT_TO` — defaults to `ginoswanepoel@gmail.com` if unset.

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

- [ ] **Step 4: Smoke-test the function**

Run via `mcp__supabase__execute_sql` to grab a real report id (or 0 if none), then invoke the function with that id using the same `net.http_post` shape as Task 7 — or simply confirm deploy succeeded and defer live testing to after Task 7. With no `RESEND_API_KEY` set, expected response body: `{ "status": "skipped", "reason": "no RESEND_API_KEY" }`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/report-alert/index.ts
git commit -m "feat(reports): report-alert edge function (Resend email)"
```

---

## Task 7: Insert-trigger migration (reports → report-alert)

**Files:**
- Create: `supabase/migrations/20260701130000_reports_email_trigger.sql`

**Interfaces:**
- Consumes: the `report-alert` function (Task 6) and `net.http_post` (pg_net).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260701130000_reports_email_trigger.sql`. **Copy the `Authorization` bearer value verbatim** from `supabase/migrations/20260628202000_schedule_wiki.sql` (the project anon JWT — same value used by the existing crons) into the placeholder below:

```sql
-- Fire an admin email on each new report. pg_net queues the request inside the
-- txn, so a rolled-back report sends no email and a failed email never blocks
-- the insert. Mirrors the cron net.http_post pattern.
create extension if not exists pg_net;

create or replace function public._notify_report_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/report-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <PASTE_ANON_BEARER_FROM_schedule_wiki.sql>'
    ),
    body := jsonb_build_object('id', NEW.id),
    timeout_milliseconds := 20000
  );
  return NEW;
end;
$$;

drop trigger if exists reports_notify_insert on public.reports;
create trigger reports_notify_insert
  after insert on public.reports
  for each row execute function public._notify_report_insert();
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` with name `reports_email_trigger` and the SQL above.
Expected: success.

- [ ] **Step 3: End-to-end verify**

From the app (signed in), file a test report on any character page. Then via `mcp__supabase__execute_sql`:

```sql
select id, hero_id, target_type, reason, status, created_at
  from public.reports order by created_at desc limit 1;
select status_code, created
  from net._http_response order by created desc limit 1;
```
Expected: the report row exists; the pg_net response shows the `report-alert` call (200 `{status:sent}` once `RESEND_API_KEY` is set, or 200 `{status:skipped}` before). Confirm the email arrives once the Resend secrets from Task 6 Step 3 are configured. Clean up the test row if desired:
```sql
delete from public.reports where id = <that id>;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260701130000_reports_email_trigger.sql
git commit -m "feat(reports): email trigger on new report"
```

---

## Self-Review

**Spec coverage:**
- Data model + reason taxonomy (spec §1) → Task 1 (table, RLS, `_report_reason_ok`).
- RPCs + `reports.ts` (spec §2) → Task 1 (RPCs) + Task 2 (client layer).
- `ReportSheet` + two entry points + lightbox wiring + both platform files + retire old path (spec §3) → Task 3 + Task 4.
- `ReportsDomain` + filters + thumbnails + resolve/dismiss + alert badge (spec §4) → Task 5.
- Email pipeline: trigger + `report-alert` + Resend + secrets (spec §4) → Task 6 + Task 7.
- Testing (spec) → Task 2 (pure-logic tests); UI/DB/edge verified via typecheck/lint/manual + MCP SQL.

**Placeholder scan:** The only intentional fill-in is the anon bearer token in Task 7 Step 1, with an exact source file to copy it from (a secret, not invented content). No TBD/TODO/"handle edge cases".

**Type consistency:** `submit_report` / `admin_reports_queue` / `admin_resolve_report` signatures match between Task 1 (SQL) and Task 2 (`.rpc()` args). `ReportRow` fields (`hero_portrait_url`, `submitter`, `resolution_note`, …) match the `admin_reports_queue` `select`. `ReportTargetType` (`page`/`image`/`ai_portrait`) and reason codes are identical across `REPORT_REASONS`, `resolveReportTarget`, `_report_reason_ok`, and the edge function's `REASON_LABEL`. `onReport` signature matches between `ImageLightbox` and the character-screen wiring. `Alert` shape (`{ tone, text }`) matches the existing type in Task 5.

**Note for implementers:** Task 4 Step 3 and Task 5 Step 3 require reading the exact surrounding code (the web character file's portrait variable name; the `alerts` `useMemo` accumulator variable) before editing — both are flagged inline.
