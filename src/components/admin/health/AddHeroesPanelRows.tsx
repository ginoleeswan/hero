import { View, Pressable } from 'react-native';
import { Text } from '../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { HeroThumb } from './atoms';
import { CharacterPreview } from './CharacterPreview';
import type { CvCharacter, CvCharacterDetail } from '../../../lib/db/cvIngest';
import { styles } from './AddHeroesPanel.styles';

// The result sub-line: appearances + publisher when we have a popularity count
// (name + popular feeds both carry it now), otherwise publisher or the deck.
function charSub(c: CvCharacter): string {
  if (c.appearances != null) {
    return `${c.appearances.toLocaleString()} appearances${c.publisher ? ` · ${c.publisher}` : ''}`;
  }
  return c.publisher ?? c.deck ?? '—';
}

// One character result: checkbox (multi-select) + tappable body (expand preview).
// The checkbox and the body are separate hit targets so ticking doesn't expand.
export function CharacterRow({
  c,
  selected,
  inCat,
  dup,
  expanded,
  detail,
  detailLoading,
  busy,
  onToggleSelect,
  onToggleExpand,
  onAdd,
}: {
  c: CvCharacter;
  selected: boolean;
  inCat: boolean;
  dup: boolean;
  expanded: boolean;
  detail: CvCharacterDetail | null | undefined;
  detailLoading: boolean;
  busy: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onAdd: () => void;
}) {
  return (
    <View style={[styles.charWrap, expanded && styles.charWrapOpen]}>
      <View style={styles.row}>
        <Pressable onPress={onToggleSelect} disabled={inCat} hitSlop={8}>
          <Checkbox checked={selected} disabled={inCat} />
        </Pressable>
        <Pressable onPress={onToggleExpand} style={styles.rowBody}>
          <HeroThumb uri={c.image} width={32} height={42} radius={6} />
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {charSub(c)}
            </Text>
          </View>
          <StatusBadge inCat={inCat} dup={dup} />
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.grey} />
        </Pressable>
      </View>
      {expanded ? (
        <CharacterPreview
          detail={detail}
          loading={detailLoading}
          fallbackImage={c.image}
          inCat={inCat}
          busy={busy}
          onAdd={onAdd}
        />
      ) : null}
    </View>
  );
}

// A roster member (team / series / creator / film / publisher / power). Members
// arrive as just id + name, so the collapsed row is compact — tapping the body
// expands the same preview (its detail is fetched lazily from the id).
export function MemberRow({
  m,
  selected,
  inCat,
  dup,
  expanded,
  detail,
  detailLoading,
  busy,
  onToggleSelect,
  onToggleExpand,
  onAdd,
}: {
  m: { id: string; name: string };
  selected: boolean;
  inCat: boolean;
  dup: boolean;
  expanded: boolean;
  detail: CvCharacterDetail | null | undefined;
  detailLoading: boolean;
  busy: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onAdd: () => void;
}) {
  return (
    <View style={[styles.charWrap, expanded && styles.charWrapOpen]}>
      <View style={styles.memberRow}>
        <Pressable onPress={onToggleSelect} disabled={inCat} hitSlop={8}>
          <Checkbox checked={selected} disabled={inCat} />
        </Pressable>
        <Pressable onPress={onToggleExpand} style={styles.memberBody}>
          <Text style={styles.memberName} numberOfLines={1}>
            {m.name}
          </Text>
          <StatusBadge inCat={inCat} dup={dup} />
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.grey} />
        </Pressable>
      </View>
      {expanded ? (
        <CharacterPreview
          detail={detail}
          loading={detailLoading}
          fallbackImage={null}
          inCat={inCat}
          busy={busy}
          onAdd={onAdd}
        />
      ) : null}
    </View>
  );
}

function Checkbox({ checked, disabled }: { checked: boolean; disabled: boolean }) {
  return (
    <View style={[styles.cb, checked && styles.cbOn, disabled && styles.cbDisabled]}>
      {checked && !disabled ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
    </View>
  );
}

function StatusBadge({ inCat, dup }: { inCat: boolean; dup: boolean }) {
  if (inCat)
    return (
      <View style={styles.badge}>
        <Ionicons name="checkmark" size={12} color={COLORS.green} />
        <Text style={[styles.badgeText, { color: COLORS.green }]}>in catalogue</Text>
      </View>
    );
  if (dup)
    return (
      <View style={styles.badge}>
        <Ionicons name="warning" size={12} color={COLORS.yellow} />
        <Text style={[styles.badgeText, { color: COLORS.yellow }]}>possible dup</Text>
      </View>
    );
  return null;
}
