// app/house/[slug].web.tsx
// A house of Westeros: the family tree as a destination rather than a band on
// somebody's character page.
//
// Two columns on desktop, and that is the whole design argument. The roster is
// the control surface for the tree and the console, so it sits *beside* them —
// the previous stacked layout put fifty-five names a full screen below the
// thing they changed, which made every click look like it had done nothing.
//
// All state lives in the URL — ?focus re-roots the tree, ?with lights the
// kinship path — so every view a reader reaches is a link they can send.
import { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { PageEndCap } from '../../src/components/web/PageEndCap';
import { FamilyCanvas } from '../../src/components/family/FamilyCanvas.web';
import { HouseBanner } from '../../src/components/family/HouseBanner';
import { RelationConsole } from '../../src/components/family/RelationConsole';
import { HouseRoster } from '../../src/components/family/HouseRoster';
import { useHouse } from '../../src/hooks/useHouse';
import { HouseSkeleton } from '../../src/components/skeletons/HouseSkeleton';

/** Below this the rail can't hold a name and a tree at once — stack instead. */
const TWO_COLUMN = 1000;
const MAX_WIDTH = 1320;

export default function HousePage() {
  const router = useRouter();
  const {
    slug,
    focus,
    with: withId,
  } = useLocalSearchParams<{
    slug: string;
    focus?: string;
    with?: string;
  }>();
  const { width, height: winHeight } = useWindowDimensions();
  const twoColumn = width >= TWO_COLUMN;
  // On a character page the chart is a band inside a longer read, so 460px is
  // right. Here the chart IS the page — letterboxing a thirteen-generation
  // lineage into a fixed strip wastes the whole lower half of the screen. It
  // stops short of the full viewport on purpose: the console has to stay on
  // screen beside it, or clicking a face down at the bottom of the chart puts
  // the answer somewhere you can't see.
  const stageHeight =
    width >= 700 ? Math.min(780, Math.max(460, Math.round(winHeight - 340))) : undefined;
  const stageRef = useRef<View | null>(null);

  // Ink canvas so iOS Safari's status zone matches the band; the beige body is
  // painted by this screen and closed onto the ink floor by PageEndCap.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

  const { house, chrome, members, relatives, focusId, kinship, pathIds, isLoading, error } =
    useHouse(slug, focus ?? null, withId ?? null);

  // Stacked, the console is above the roster you just clicked — so bring it
  // back into view, or the answer arrives off-screen and reads as nothing.
  const revealStage = useCallback(() => {
    if (twoColumn) return;
    const node = stageRef.current as unknown as HTMLElement | null;
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [twoColumn]);

  const setParams = useCallback(
    (next: { focus?: string | null; with?: string | null }) => {
      const f = next.focus === undefined ? focusId : next.focus;
      const w = next.with === undefined ? (withId ?? null) : next.with;
      const params = new URLSearchParams();
      if (f) params.set('focus', f);
      if (w) params.set('with', w);
      // setParams merges, so absent keys have to be blanked explicitly or a
      // cleared comparison survives the next re-root.
      router.setParams({ focus: f ?? '', with: w ?? '' });
      if (typeof window !== 'undefined') {
        const qs = params.toString();
        window.history.replaceState(null, '', `/house/${slug}${qs ? `?${qs}` : ''}`);
      }
    },
    [router, slug, focusId, withId],
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: chrome ? `${chrome.name} — family tree` : 'House' }} />
        <HouseSkeleton
          chrome={chrome}
          twoColumn={twoColumn}
          stageHeight={stageHeight}
          maxWidth={MAX_WIDTH}
        />
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
      <Stack.Screen options={{ title: `${house.name} — family tree` }} />

      <HouseBanner
        name={house.name}
        universe={house.universe}
        words={house.words}
        seat={house.seat}
        blurb={house.blurb}
        memberCount={members.length}
        tint={tint}
        maxWidth={MAX_WIDTH}
      />

      <View style={[styles.workspace, twoColumn && styles.workspaceWide] as object}>
        <View
          ref={stageRef}
          style={[styles.stage, twoColumn && styles.stageWide] as object}
          nativeID="house-stage"
        >
          <RelationConsole
            root={rooted}
            partner={compared}
            kinship={kinship}
            tint={tint}
            onSwap={() =>
              compared && rooted ? setParams({ focus: compared.id, with: rooted.id }) : undefined
            }
            onClear={() => setParams({ with: null })}
            onRootPartner={() =>
              compared ? setParams({ focus: compared.id, with: null }) : undefined
            }
          />

          {relatives.length > 0 && rooted ? (
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

        <View style={[styles.rail, twoColumn && (styles.railSticky as object)] as object}>
          <HouseRoster
            members={members}
            focusId={focusId}
            withId={withId ?? null}
            pathIds={pathIds}
            tint={tint}
            // The rail has its own scroll; stacked under the chart it does not.
            initialVisible={twoColumn ? undefined : 14}
            onCompare={(id) => {
              setParams({ with: id });
              revealStage();
            }}
            onRoot={(id) => {
              setParams({ focus: id, with: null });
              revealStage();
            }}
          />
        </View>
      </View>

      <PageEndCap />
    </View>
  );
}

const styles = StyleSheet.create({
  // The painted root must GROW with the document-scrolled content; flex:1 would
  // clamp it to the viewport and expose the ink canvas below the fold.
  root: { backgroundColor: COLORS.beige, minHeight: '100lvh' } as object,
  centre: {
    backgroundColor: COLORS.beige,
    minHeight: '100lvh',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 40,
  } as object,
  workspace: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 56,
    gap: 22,
  },
  workspaceWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  // No `flex: 1` in the stacked case — flex-basis 0 inside an auto-height column
  // collapses the stage to nothing.
  stage: { gap: 18, minWidth: 0, scrollMarginTop: 84 } as object,
  stageWide: { flex: 1 },
  rail: { width: '100%' },
  railSticky: {
    width: 306,
    flexGrow: 0,
    flexShrink: 0,
    position: 'sticky',
    top: 84,
    maxHeight: 'calc(100lvh - 108px)',
    overflowY: 'auto',
    paddingRight: 4,
  } as object,
  blank: {
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eadfcb',
    padding: 22,
  },
  notFound: { fontFamily: 'Flame-Regular', fontSize: 30, lineHeight: 38, color: COLORS.black },
  muted: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13.5,
    lineHeight: 21,
    color: '#8d8375',
    maxWidth: 480,
  },
});
