// app/house/[slug].tsx
// Native house page. Thin view over useHouse, same as the web one — expo-router
// resolves by platform extension and both files must exist or it throws.
//
// One column, so names are chosen in a sheet over the console rather than from
// a list a screen below it.
import { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/colors';
import { FamilyCanvas } from '../../src/components/family/FamilyCanvas';
import { HouseBanner } from '../../src/components/family/HouseBanner';
import { RelationConsole } from '../../src/components/family/RelationConsole';
import { HousePicker, type PickerMode } from '../../src/components/family/HousePicker';
import { HouseGenerations } from '../../src/components/family/HouseGenerations';
import { StageSwitch, type StageView } from '../../src/components/family/StageSwitch';
import { useHouse } from '../../src/hooks/useHouse';
import { HouseSkeleton } from '../../src/components/skeletons/HouseSkeleton';
import { OverscrollBleed } from '../../src/components/ui/OverscrollBleed';
import { FloatingBackButton } from '../../src/components/ui/FloatingBackButton';
import { FadeOutSkeleton } from '../../src/components/ui/FadeOutSkeleton';
import { useSkeletonTransition } from '../../src/hooks/useSkeletonTransition';

// No header at all — the back affordance is a FloatingBackButton instead.
//
// This screen used to run a transparent header carrying nothing but a chevron,
// which on iOS 26 is exactly the shape that earns a `UIScrollEdgeEffect`: a
// light blur band under the header items, painted across the status bar over
// the navy banner. The scroll-edge audit in docs/features/platform-and-motion.md
// had this screen down as "unaffected — beige top", which was wrong: the ROOT
// is beige but the top SURFACE is the navy HouseBanner, so the scrim was very
// visible. Same fix as biography/[id]: no header, so there is no effect.
const headerOptions = { headerShown: false } as const;

export default function HousePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    slug,
    focus,
    with: withId,
    view,
  } = useLocalSearchParams<{
    slug: string;
    focus?: string;
    with?: string;
    view?: string;
  }>();
  const stageView: StageView = view === 'house' ? 'house' : 'line';
  const {
    house,
    chrome,
    members,
    dynasty,
    generations,
    relatives,
    focusId,
    kinship,
    pathIds,
    isLoading,
    error,
    retry,
  } = useHouse(slug, focus ?? null, withId ?? null);

  const { height: winHeight } = useWindowDimensions();
  // The chart is the page here, not a band inside one — give it most of the
  // screen rather than the 360px a character page allots it.
  const stageHeight = Math.max(380, Math.round(winHeight * 0.62));

  // pre → bare beige root (a cached house never blinks a skeleton); skeleton →
  // placeholders; crossfade → the chart renders and the skeleton dissolves off it.
  const phase = useSkeletonTransition(isLoading);

  const [picking, setPicking] = useState<PickerMode | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const [bodyY, setBodyY] = useState(0);
  const revealStage = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, bodyY - 8), animated: true });
  }, [bodyY]);

  const setParams = useCallback(
    (next: { focus?: string | null; with?: string | null; view?: StageView }) => {
      const f = next.focus === undefined ? focusId : next.focus;
      const w = next.with === undefined ? (withId ?? null) : next.with;
      const v = next.view ?? stageView;
      router.setParams({ focus: f ?? '', with: w ?? '', view: v === 'line' ? '' : v });
    },
    [router, focusId, withId, stageView],
  );

  if (isLoading) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ ...headerOptions, title: chrome?.name ?? 'House' }} />
        {phase === 'skeleton' ? <HouseSkeleton chrome={chrome} stageHeight={stageHeight} /> : null}
        <FloatingBackButton />
      </View>
    );
  }
  // A failed fetch is not a missing house. The headline used to say "No such
  // house" for both, with the raw Error.message underneath as the only tell —
  // which is neither user-facing copy nor something you can act on.
  if (error) {
    return (
      <View style={styles.centre}>
        <Stack.Screen options={headerOptions} />
        <FloatingBackButton />
        <Text style={styles.notFound}>Couldn’t load this house</Text>
        <Text style={styles.muted}>Check your connection and try again.</Text>
        <Pressable
          onPress={retry}
          accessibilityRole="button"
          style={({ pressed }: { pressed: boolean }) => [
            styles.retry,
            pressed && styles.retryPressed,
          ]}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (!house) {
    return (
      <View style={styles.centre}>
        <Stack.Screen options={headerOptions} />
        <FloatingBackButton />
        <Text style={styles.notFound}>No such house</Text>
        <Text style={styles.muted}>Nothing in the catalogue answers to that name.</Text>
      </View>
    );
  }

  const tint = house.sigil_tint ?? COLORS.orange;
  const rooted = members.find((m) => m.id === focusId) ?? null;
  const compared = members.find((m) => m.id === withId) ?? null;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ ...headerOptions, title: house.name }} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Rubber-banding at the top shows navy, not the beige root. */}
        <OverscrollBleed color={COLORS.navy} />
        <HouseBanner
          name={house.name}
          universe={house.universe}
          words={house.words}
          seat={house.seat}
          blurb={house.blurb}
          memberCount={members.length}
          crowned={dynasty.crowned}
          span={dynasty.span}
          tint={tint}
        />

        <View style={styles.body} onLayout={(e) => setBodyY(e.nativeEvent.layout.y)}>
          <RelationConsole
            root={rooted}
            partner={compared}
            kinship={kinship}
            tint={tint}
            onCompare={(id) => setParams({ with: id })}
            onPickRoot={() => setPicking('root')}
            onPickPartner={() => setPicking('with')}
            onSwap={() =>
              compared && rooted ? setParams({ focus: compared.id, with: rooted.id }) : undefined
            }
            onClear={() => setParams({ with: null })}
            onRootPartner={() =>
              compared ? setParams({ focus: compared.id, with: null }) : undefined
            }
          />

          <StageSwitch value={stageView} onChange={(next) => setParams({ view: next })} />

          {stageView === 'house' ? (
            <HouseGenerations
              generations={generations}
              focusId={focusId}
              pathIds={pathIds}
              tint={tint}
              onSelect={(id) => setParams({ focus: id, with: null, view: 'line' })}
            />
          ) : relatives.length > 0 && rooted ? (
            <FamilyCanvas
              label={`The line of ${rooted.name}`}
              stageHeight={stageHeight}
              onSelectMember={(id) => setParams({ with: id })}
              heroName={rooted.name}
              heroImage={rooted.portrait_url ?? rooted.image_md_url ?? rooted.image_url}
              heroAvatar={rooted.avatar_url}
              heroId={rooted.id}
              members={relatives}
            />
          ) : (
            <View style={styles.blank}>
              <Text style={styles.muted}>
                {rooted?.name ?? 'This member'} has no recorded kin inside the house. Root the tree
                on someone else to see the line.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* The page sits settled underneath; only this layer animates. */}
      {phase === 'crossfade' ? (
        <FadeOutSkeleton>
          <HouseSkeleton chrome={chrome} stageHeight={stageHeight} />
        </FadeOutSkeleton>
      ) : null}

      {/* Above the scroll view, so it stays put over the banner and the paper. */}
      <FloatingBackButton />

      <HousePicker
        mode={picking}
        members={members}
        excludeId={picking === 'root' ? (withId ?? null) : focusId}
        onClose={() => setPicking(null)}
        onPick={(id) => {
          setParams(picking === 'root' ? { focus: id, with: null } : { with: id });
          setPicking(null);
          revealStage();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  centre: {
    flex: 1,
    backgroundColor: COLORS.beige,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 40,
  },
  body: { padding: 16, gap: 18 },
  blank: {
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eadfcb',
    padding: 18,
  },
  notFound: { fontFamily: 'Flame-Regular', fontSize: 27, lineHeight: 34, color: COLORS.black },
  retry: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: COLORS.orange,
  },
  retryPressed: { opacity: 0.75 },
  retryText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#fff' },
  muted: { fontFamily: 'FlameSans-Regular', fontSize: 13.5, lineHeight: 21, color: '#8d8375' },
});
