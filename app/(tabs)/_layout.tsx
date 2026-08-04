import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    // Every prop here is load-bearing. Read this before removing one.
    //
    // • blurEffect + disableTransparentOnScrollEdge — the pair that fixes the
    //   "bare icons floating over content" bug. expo-router forces the
    //   SCROLL-EDGE appearance fully transparent (blurEffect 'none',
    //   background null) unless disableTransparentOnScrollEdge is set, and
    //   when iOS can't pair a screen's scroll view with the bar (ours are
    //   custom FlatLists) UIKit applies that scroll-edge appearance
    //   PERMANENTLY. Setting both pins a real material for both appearances,
    //   so the bar no longer depends on pairing at all.
    //
    // • iconColor / labelStyle — legibility. These once looked like the cause
    //   of the transparency bug and were removed; that was wrong. What
    //   suppresses the system treatment is swapping in a custom appearance,
    //   and blurEffect already does that — so the appearance is custom
    //   regardless and the unselected items may as well be readable (the
    //   system default resolves near-black against this material). Selected
    //   state is deliberately omitted: expo-router falls back to tintColor.
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
    <NativeTabs
      tintColor="#e8621a"
      blurEffect="systemChromeMaterialDark"
      disableTransparentOnScrollEdge
      iconColor="rgba(245,235,220,0.72)"
      labelStyle={{ color: 'rgba(245,235,220,0.72)' }}
    >
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
