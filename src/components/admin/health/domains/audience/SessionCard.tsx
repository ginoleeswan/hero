// One visitor session in the Visitors sub-tab: who (coarsely — a display name
// when signed in, else "Guest"), where they were, on what, how they got here,
// and — expanded — the ordered trail of pages they viewed. Tapping a trail step
// that is a character page opens it.
import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../../../constants/colors';
import { relTime, CC } from '../../format';
import { Chip } from '../../ui';
import { countryName, type AudienceSession } from '../../../../../lib/db/audience';

const DEVICE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  mobile: 'phone-portrait-outline',
  tablet: 'tablet-portrait-outline',
  desktop: 'desktop-outline',
};

/** "Berlin, Germany" / "Germany" / "Somewhere". Pure. */
export function sessionPlace(s: Pick<AudienceSession, 'city' | 'region' | 'country'>): string {
  const country = s.country ? countryName(s.country) : null;
  const local = s.city ?? s.region;
  if (local && country) return `${local}, ${country}`;
  return country ?? local ?? 'Somewhere';
}

/** "Chrome on Android · 390×844". Pure. */
export function sessionDevice(
  s: Pick<AudienceSession, 'browser' | 'os' | 'screenW' | 'screenH' | 'device'>,
): string {
  const ua = s.browser && s.os ? `${s.browser} on ${s.os}` : (s.browser ?? s.os ?? s.device ?? '');
  const size = s.screenW && s.screenH ? `${s.screenW}×${s.screenH}` : null;
  return [ua, size].filter(Boolean).join(' · ');
}

/** "reddit.com · social · summer-launch" or "direct". Pure. */
export function sessionArrival(s: Pick<AudienceSession, 'source' | 'medium' | 'campaign'>): string {
  return [s.source, s.medium, s.campaign].filter(Boolean).join(' · ') || 'direct';
}

function stepLabel(path: string, name: string | null) {
  if (name) return name;
  if (path === '/' || path === '') return 'Home';
  return path;
}

export function SessionCard({
  session: s,
  defaultOpen = false,
}: {
  session: AudienceSession;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const router = useRouter();
  const who = s.signedIn ? (s.displayName ?? 'Member') : 'Guest';
  const deviceIcon = DEVICE_ICON[s.device ?? ''] ?? 'globe-outline';
  const minutes = Math.max(
    0,
    Math.round((new Date(s.lastAt).getTime() - new Date(s.firstAt).getTime()) / 60000),
  );

  return (
    <View style={st.card}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={st.head}
        accessibilityLabel={`${who} from ${sessionPlace(s)}, ${s.views} pages`}
      >
        <View
          style={[
            st.iconWrap,
            { backgroundColor: (s.signedIn ? COLORS.orange : COLORS.blue) + '1a' },
          ]}
        >
          <Ionicons
            name={s.signedIn ? 'person' : 'person-outline'}
            size={15}
            color={s.signedIn ? COLORS.orange : COLORS.blue}
          />
        </View>
        <View style={st.headText}>
          <View style={st.titleRow}>
            <Text style={st.who} numberOfLines={1}>
              {who}
            </Text>
            <Text style={st.place} numberOfLines={1}>
              · {sessionPlace(s)}
            </Text>
          </View>
          <Text style={st.sub} numberOfLines={1}>
            {s.views} {s.views === 1 ? 'page' : 'pages'}
            {minutes > 0 ? ` · ${minutes} min` : ''} · via {sessionArrival(s)}
          </Text>
        </View>
        <View style={st.right}>
          <Text style={st.time}>{relTime(s.lastAt)}</Text>
          <View style={st.badges}>
            {s.returning ? (
              <Chip bg="rgba(41,60,67,0.08)" fg={COLORS.navy} text="returning" />
            ) : (
              <Chip bg="rgba(76,175,80,0.14)" fg={COLORS.green} text="new" />
            )}
            <Ionicons name={deviceIcon} size={14} color={COLORS.grey} />
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.grey} />
          </View>
        </View>
      </Pressable>

      {open ? (
        <View style={st.body}>
          <View style={st.facts}>
            <Fact icon="location-outline" text={sessionPlace(s)} />
            <Fact icon={deviceIcon} text={sessionDevice(s) || 'Unknown device'} />
            <Fact icon="navigate-outline" text={`Arrived via ${sessionArrival(s)}`} />
            {s.landing ? <Fact icon="enter-outline" text={`Landed on ${s.landing}`} /> : null}
            {s.lang || s.timezone ? (
              <Fact
                icon="language-outline"
                text={[s.lang, s.timezone].filter(Boolean).join(' · ')}
              />
            ) : null}
            <Fact
              icon="time-outline"
              text={`First seen ${relTime(s.firstAt)} · last ${relTime(s.lastAt)}`}
            />
          </View>
          {s.trail.length > 0 ? (
            <View style={st.trail}>
              <Text style={st.trailTitle}>Page trail</Text>
              {s.trail.map((t, i) => {
                const heroId =
                  t.name && t.path.startsWith('/character/') ? t.path.split('/')[2] : null;
                const row = (
                  <View style={st.step}>
                    <View style={st.stepLine}>
                      <View style={[st.dot, i === s.trail.length - 1 && st.dotLast]} />
                      {i < s.trail.length - 1 ? <View style={st.stem} /> : null}
                    </View>
                    <Text style={[st.stepText, heroId && st.stepLink]} numberOfLines={1}>
                      {stepLabel(t.path, t.name)}
                    </Text>
                    <Text style={st.stepTime}>{relTime(t.at)}</Text>
                  </View>
                );
                return heroId ? (
                  <Pressable key={i} onPress={() => router.push(`/character/${heroId}`)}>
                    {row}
                  </Pressable>
                ) : (
                  <View key={i}>{row}</View>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Fact({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={st.fact}>
      <Ionicons name={icon} size={13} color={COLORS.grey} />
      <Text style={st.factText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: CC.hairline,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, gap: 2, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, minWidth: 0 },
  who: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  place: { flexShrink: 1, fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  right: { alignItems: 'flex-end', gap: 4 },
  time: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: CC.hairline,
    paddingTop: 10,
  },
  facts: { gap: 5 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  factText: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.navy },
  trail: { gap: 0 },
  trailTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginBottom: 4,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  stepLine: { width: 12, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: 'rgba(41,60,67,0.35)' },
  dotLast: { backgroundColor: COLORS.orange },
  stem: { position: 'absolute', top: '50%', bottom: -12, width: 1, backgroundColor: CC.hairline },
  stepText: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.navy },
  stepLink: { fontFamily: 'Nunito_700Bold' },
  stepTime: { fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: COLORS.grey },
});
