import { COLORS } from '../../constants/colors';

/**
 * The one mobile-web search-field recipe — a frosted navy glass pill with an
 * orange focus ring. Shared by the main /search header and the browse
 * (category/universe/franchise) control decks so search reads identical
 * everywhere it appears; page styles spread these and add only layout concerns
 * (flex, margins).
 *
 * Material notes: the navy glass (blur + translucent band colour) works both
 * floating over card grids and resting on the flat ink surface. The input is
 * 16px on purpose — anything smaller makes iOS Safari auto-zoom the page when
 * the field focuses.
 */
export const SEARCH_CHIP = {
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(41,60,67,0.6)',
    backdropFilter: 'blur(18px) saturate(140%)',
    WebkitBackdropFilter: 'blur(18px) saturate(140%)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    paddingHorizontal: 13,
    height: 46,
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
  },
  chipFocused: {
    borderColor: 'rgba(231,115,51,0.8)',
    boxShadow: '0 0 0 3px rgba(231,115,51,0.16)',
  },
  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.beige,
    outlineStyle: 'none',
    outlineWidth: 0,
  },
  /** Shared placeholder tint — pass to `placeholderTextColor`. */
  placeholder: 'rgba(245,235,220,0.4)',
} as const;
