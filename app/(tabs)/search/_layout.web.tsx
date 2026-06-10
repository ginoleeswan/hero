// app/(tabs)/search/_layout.web.tsx — web override.
//
// The native layout keeps a Stack (iOS search-bar chrome). On web every other
// screen (explore, profile, character, category…) is a plain leaf of the parent
// navigator — none mount their own nested Stack. Search did, and that extra
// navigator was the one screen on which the floating header detached and scrolled
// with the page (then stayed broken everywhere after). `Slot` renders the search
// screen straight through, with no nested navigator and no default header, so
// Search now behaves exactly like the other web pages.
import { Slot } from 'expo-router';

export default function SearchLayoutWeb() {
  return <Slot />;
}
