// app/house/[slug].tsx
// Native house page. Thin view over useHouse, same as the web one — expo-router
// resolves by platform extension and both files must exist or it throws.
//
// One column, so names are chosen in a sheet over the console rather than from
// a list a screen below it.
import { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
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
  } = useHouse(slug, focus ?? null, withId ?? null);

  const { height: winHeight } = useWindowDimensions();
  // The chart is the page here, not a band inside one — give it most of the
  // screen rather than the 360px a character page allots it.
  const stageHeight = Math.max(380, Math.round(winHeight * 0.62));

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
      <>
        <Stack.Screen options={{ title: chrome?.name ?? 'House' }} />
        <HouseSkeleton chrome={chrome} stageHeight={stageHeight} />
      </>
    );
  }
  if (error || !house) {
    return (
      <View style={styles.centre}>
        <Text style={styles.notFound}>No such house</Text>
        <Text style={styles.muted}>
          {error ? error.message : 'Nothing in the catalogue answers to that name.'}
        </Text>
      </View>
    );
  }

  const tint = house.sigil_tint ?? COLORS.orange;
  const rooted = members.find((m) => m.id === focusId) ?? null;
  const compared = members.find((m) => m.id === withId) ?? null;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: house.name }} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
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
  muted: { fontFamily: 'FlameSans-Regular', fontSize: 13.5, lineHeight: 21, color: '#8d8375' },
});
