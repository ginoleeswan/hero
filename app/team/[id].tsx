// app/team/[id].tsx — native team roster browse page.
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTeamPage } from '../../src/hooks/useTeamPage';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS } from '../../src/constants/colors';
import { brandForPublisher } from '../../src/constants/publishers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = SCREEN_WIDTH >= 768 ? 4 : 3;
const GAP = 8;
const H_PAD = 16;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.35);

const headerOptions = {
  headerShown: true,
  headerTitle: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
} as const;

export default function TeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { team, members, loading, notFound } = useTeamPage(id);

  const headerHeight = insets.top + 44;
  const brand = brandForPublisher(team?.publisher);
  const eyebrow = team
    ? `${team.member_count.toLocaleString()} ${team.member_count === 1 ? 'MEMBER' : 'MEMBERS'}${team.publisher ? ` · ${team.publisher.toUpperCase()}` : ''}`
    : '';

  const listHeader = (
    <>
      <View style={[styles.stage, { paddingTop: headerHeight + 16 }]}>
        {/* Brand wash: tint the stage with the team's publisher colour so it reads
            as a branded masthead (Marvel red / DC blue), mirroring the web banner. */}
        {brand && (
          <LinearGradient
            colors={[brand.color, brand.colorDark, COLORS.navy]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.9, y: 0 }}
            end={{ x: 0.1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.stageTitle} numberOfLines={2}>
          {team?.name ?? (notFound ? 'Team not found' : '')}
        </Text>
      </View>
      <View style={styles.sheetTop} />
    </>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={headerOptions} />
      <StatusBar style="light" />
      {loading ? (
        <View style={[styles.center, { paddingTop: headerHeight + 80 }]}>
          <ActivityIndicator color={COLORS.orange} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={members}
          keyExtractor={(h) => String(h.id)}
          numColumns={NUM_COLUMNS}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.82}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/character/${item.id}`);
              }}
            >
              <HeroImage
                id={item.id}
                name={item.name}
                imageUrl={item.image_url}
                portraitUrl={item.portrait_url}
                contentFit="cover"
                contentPosition="top"
                style={StyleSheet.absoluteFill}
                recyclingKey={String(item.id)}
                transition={150}
              />
              <LinearGradient
                colors={['transparent', 'rgba(29,45,51,0.88)']}
                locations={[0.4, 1]}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.cardName} numberOfLines={2}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>
                {notFound ? 'This team doesn’t exist.' : 'No members found'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  list: { flex: 1, backgroundColor: COLORS.navy },
  listContent: { backgroundColor: COLORS.beige, flexGrow: 1 },
  stage: { backgroundColor: COLORS.navy, paddingHorizontal: H_PAD, paddingBottom: 28 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 6,
  },
  stageTitle: { fontFamily: 'Flame-Regular', fontSize: 32, color: COLORS.beige, lineHeight: 36 },
  sheetTop: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
    marginTop: -16,
    height: 30,
  },
  row: { gap: GAP, marginBottom: GAP, paddingHorizontal: H_PAD },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    padding: 6,
  },
  cardName: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.beige, lineHeight: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.grey },
});
