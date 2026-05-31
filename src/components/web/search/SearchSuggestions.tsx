import { useRef, useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { COLORS } from '../../../constants/colors';
import { useSearch } from '../../../contexts/SearchContext';
import { SearchDropdownContent } from './SearchDropdownContent';

const DESKTOP_BP = 768;
const SEARCH_SURFACES = ['/explore', '/search'];

export function SearchSuggestions() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { searchFocused } = useSearch();
  const panelRef = useRef<View>(null);

  const isDesktop = width >= DESKTOP_BP;
  const isOpen = isDesktop && SEARCH_SURFACES.includes(pathname) && searchFocused;

  // Prevent the input from blurring when the user clicks inside the dropdown.
  // This is the standard combobox technique — mousedown preventDefault keeps
  // focus on the input so onPress can fire. No timers or state needed.
  useEffect(() => {
    if (!isOpen) return;
    const el = panelRef.current as unknown as HTMLElement | null;
    if (!el) return;
    const prevent = (e: MouseEvent) => e.preventDefault();
    el.addEventListener('mousedown', prevent);
    return () => el.removeEventListener('mousedown', prevent);
  }, [isOpen]);

  // Escape blurs the input, which sets searchFocused=false and closes the dropdown.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (document.activeElement as HTMLElement)?.blur();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <View style={styles.dropdownContainer as object} pointerEvents="box-none">
      <View ref={panelRef} style={styles.dropdown as object}>
        <SearchDropdownContent />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 150,
    alignItems: 'center',
  } as object,

  dropdown: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.10)',
    boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
    marginTop: 8,
    maxHeight: 440,
    overflow: 'hidden',
    flexDirection: 'column',
  } as object,
});
