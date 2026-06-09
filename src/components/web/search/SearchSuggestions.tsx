import { useRef, useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useSearch } from '../../../contexts/SearchContext';
import { SearchDropdownContent } from './SearchDropdownContent';

const DESKTOP_BP = 768;

export function SearchSuggestions() {
  const { width } = useWindowDimensions();
  const { searchFocused } = useSearch();
  const panelRef = useRef<View>(null);

  const isDesktop = width >= DESKTOP_BP;
  const isOpen = isDesktop && searchFocused;

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
    right: 0,
    zIndex: 150,
    alignItems: 'flex-end',
  } as object,

  dropdown: {
    width: 460,
    maxWidth: '90vw',
    backgroundColor: 'rgba(11,24,32,0.93)',
    backdropFilter: 'blur(28px) saturate(160%)',
    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 20px 56px rgba(0,0,0,0.5)',
    marginTop: 16,
    maxHeight: 460,
    overflow: 'hidden',
    flexDirection: 'column',
  } as object,
});
