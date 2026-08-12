// app/compare/pick.tsx — the native Battle Builder, structured as a DRAFT
// BOARD: a pinned tray (what you have) over a dominant catalogue (what you can
// pick). The design rules, learned from the version this replaced:
//
//   1. The CATALOGUE is the star. You spend the whole session browsing heroes,
//      so the grid starts above the fold. The old screen spent ~60% of the
//      viewport on empty question-mark placeholders (a focal card, a giant
//      anchor, five dashed slots — seven "?" boxes before one real character).
//   2. The TRAY never scrolls away. Adding a fighter must visibly change the
//      roster; the old header scrolled off with it, so taps appeared to do
//      nothing. Here both sides stay pinned while the grid scrolls beneath.
//   3. Picked heroes STAY in the grid, marked `added` (gold ring + check, tap
//      again to remove) — the old filter-them-out approach reflowed the whole
//      grid under your finger on every add.
//   4. The CTA guides instead of scolding. No dead grey button reading "Add at
//      least one fighter to each side" before you've done anything — a quiet
//      contextual hint that names the NEXT step, replaced by the Fight button
//      the moment the battle is valid.
//
// "Armed" side = where taps land. Tap a tray row to arm it; the armed row gets
// its faction tint, a "+" in its next open slot, and the dice (random fill).
import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStableTopInset } from '../../src/hooks/useStableTopInset';
import { useHeroSearchInfinite } from '../../src/lib/query/heroQueries';
import { OpponentCard } from '../../src/components/compare/OpponentCard';
import { CardSkeleton } from '../../src/components/compare/CardSkeleton';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';
import { VsBadge } from '../../src/components/compare/VsBadge';
import { PressScale } from '../../src/components/ui/PressScale';
import { useBattleBuilder } from '../../src/hooks/useBattleBuilder';
import { usePresetTeams } from '../../src/hooks/usePresetTeams';
import { FACTION_A, FACTION_B } from '../../src/components/versus/factionColors';
import { COLORS, PAPER_TEXT, STAGE_INK } from '../../src/constants/colors';
import { EYEBROW_TYPE, SEAM } from '../../src/design';
