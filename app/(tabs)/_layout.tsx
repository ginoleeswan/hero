import { Platform, DynamicColorIOS, type ColorValue } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { TAB_ACTIVE, TAB_ACTIVE_LIGHT } from '../../src/constants/colors';

// The selected tint, and the ONLY colour this file still sets.
//
// iOS guarantees contrast between its own material and its own label colours —
// it resolves both from the same trait collection, together. What it cannot
// reason about is a brand colour we hand it, so that is the one thing left to
// get right, and the way to get it right is to resolve it from the same signal.
//
// A fixed orange cannot work: the bar's backdrop swings from cream in light
// appearance to near-black in dark, and no orange clears 4.5:1 on both. So it
// resolves per appearance — TAB_ACTIVE_LIGHT on light bars, TAB_ACTIVE on dark.
//
// Both halves are lighter than contrast alone would choose, deliberately. The
// dark half still clears the floor at 5.53–8.75:1; the light half does not, at
// 2.40–3.04:1, and that is a chosen trade rather than an oversight. It is also
// short-lived: app.config pins `userInterfaceStyle: 'dark'`, so from the next
// native build the bar is always dark and TAB_ACTIVE is what ships.
const TINT: ColorValue =
  Platform.OS === 'ios'
    ? DynamicColorIOS({ light: TAB_ACTIVE_LIGHT, dark: TAB_ACTIVE })
    : TAB_ACTIVE;

export default function TabLayout() {
  return (
    // Every prop here is load-bearing. Read this before removing one.
    //
    // • disableTransparentOnScrollEdge — NOT colour, and the reason this file
    //   still configures the bar at all. expo-router forces the SCROLL-EDGE
    //   appearance fully transparent (blurEffect 'none', background null)
    //   unless this is set, and when iOS cannot pair a screen's scroll view
    //   with the bar (ours are custom FlatLists) UIKit applies that scroll-edge
    //   appearance PERMANENTLY — bare icons floating over content.
    //
    // • NO iconColor / labelStyle / blurEffect / backgroundColor. These used to
    //   be here and they were fighting a system that had already overruled
    //   them: the file asked for `systemChromeMaterialDark`, an explicitly dark
    //   material, and iOS 26's glass rendered the bar CREAM with dark labels on
    //   the Profile page. Customising half of a pair the system resolves as a
    //   pair is how you get an illegible bar.
    //
    //   This was tried once before and reverted because the unselected items
    //   came out near-black. That is the same failure from the other side: the
    //   colours were removed while the forced dark material stayed, so the
    //   system chose light-appearance labels for a bar we were holding dark.
    //   They have to go together, and now they have.
    //
    // • renderingMode="template" on EVERY icon. Without it expo-router derives
    //   the mode per state from whether that state has an icon colour, so one
    //   state resolves 'template' and the other 'original' — and RNScreens
    //   throws "icon and selectedIcon must be same type", red-screening on
    //   boot. All four icons must also be the same KIND (all vector); mixing
    //   an image source in trips the same invariant.
    //
    // • disableAutomaticContentInsets on the three immersive tabs, whose roots
    //   also deliberately do NOT set collapsable={false}. Pairing a screen's
    //   scroll view with the bar hands content insets to RNScreens, which
    //   insets the list below the status bar. SEARCH is the exception and
    //   keeps automatic insets — it has a real native header and
    //   Stack.SearchBar for its content to sit under.
    //   (Note: neither of these was the cause of the colour band above the
    //   spotlight — that was stale parallax state in explore.tsx. They are
    //   kept because they are correct on their own terms, not as a fix.)
    <NativeTabs tintColor={TINT} disableTransparentOnScrollEdge>
      <NativeTabs.Trigger name="explore" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="compass-outline" />}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="search" />}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="versus" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="sword-cross" />}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Arena</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="person" />}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
