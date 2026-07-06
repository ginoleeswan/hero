import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { COLORS } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import { monogram } from '../../RelatedHeroStrip';
import { layoutNeighborhood } from '../../../lib/graph/forceLayout';
import { subjectKind, type Neighborhood } from '../../../lib/db/heroes/neighborhood';

const KIND_COLOR: Record<string, string> = {
  enemy: COLORS.red,
  ally: COLORS.green,
  teammate: COLORS.blue,
};

// Shared social-web renderer: SVG edges (tinted by relationship kind, subject-
// incident edges stronger) with absolutely-positioned portrait nodes on top.
// Positions come from the deterministic force sim. Used by both the in-page
// preview and the full-screen explorer.
export function SocialWebGraph({
  neighborhood,
  subjectId,
  accent,
  size,
  onNodePress,
  onNodeLongPress,
}: {
  neighborhood: Neighborhood;
  subjectId: string;
  accent: string;
  size: number;
  onNodePress?: (id: string) => void;
  onNodeLongPress?: (id: string) => void;
}) {
  const { nodes, edges } = neighborhood;
  const positions = useMemo(
    () =>
      layoutNeighborhood(
        nodes.map((n) => ({ id: n.id, isSubject: n.is_subject })),
        edges,
      ),
    [nodes, edges],
  );

  const pad = 40;
  const R = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;
  const at = (id: string) => {
    const p = positions.get(id) ?? { x: 0, y: 0 };
    return { x: cx + p.x * R, y: cy + p.y * R };
  };

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {edges.map((e, i) => {
          const a = at(e.from);
          const b = at(e.to);
          const incident = e.from === subjectId || e.to === subjectId;
          return (
            <Line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={(KIND_COLOR[e.kind] ?? COLORS.grey) + (incident ? 'cc' : '55')}
              strokeWidth={incident ? 2 : 1}
            />
          );
        })}
      </Svg>
      {nodes.map((n) => {
        const p = at(n.id);
        const d = n.is_subject ? 64 : 44;
        const kind = n.is_subject ? null : subjectKind(edges, subjectId, n.id);
        const ring = n.is_subject ? accent : kind ? KIND_COLOR[kind] : COLORS.grey;
        return (
          <Pressable
            key={n.id}
            onPress={() => onNodePress?.(n.id)}
            onLongPress={() => onNodeLongPress?.(n.id)}
            style={
              [
                styles.node,
                {
                  width: d,
                  height: d,
                  borderRadius: d / 2,
                  left: p.x - d / 2,
                  top: p.y - d / 2,
                  borderColor: ring,
                  borderWidth: n.is_subject ? 3 : 2,
                },
              ] as object
            }
          >
            {n.portrait_url || n.image_md_url || n.image_url ? (
              <HeroImage
                id={n.id}
                name={n.name}
                imageUrl={n.image_url}
                portraitUrl={n.portrait_url}
                imageMdUrl={n.image_md_url}
                grid
                contentFit="cover"
                contentPosition="top"
                style={{ width: d, height: d }}
                recyclingKey={n.id}
              />
            ) : (
              <View style={styles.mono}>
                <Text style={[styles.monoText, { color: ring }] as object}>{monogram(n.name)}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  node: { position: 'absolute', overflow: 'hidden', backgroundColor: COLORS.navy } as object,
  mono: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monoText: { fontFamily: 'Flame-Regular', fontSize: 16, lineHeight: 20 } as object,
});
