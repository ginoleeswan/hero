import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    // The transparent-tab-bar saga, so nobody relitigates it:
    // • expo-router forces the SCROLL-EDGE appearance fully transparent
    //   (blurEffect 'none', background null) unless
    //   disableTransparentOnScrollEdge is set — and when iOS can't pair the
    //   screen's scroll view with the bar (ours are custom FlatLists), UIKit
    //   applies the scroll-edge appearance PERMANENTLY. That was the
    //   "icons floating naked over content" bug.
    // • blurEffect gives the bar a real dark material on every device;
    //   solid backgroundColor / iconColor / labelStyle stay banned — they
    //   also suppress the iOS 26 glass treatment where it exists.
    // • Every icon carries renderingMode="template": without it expo-router
    //   derives the mode per state from whether that state has an icon
    //   color, and with tintColor alone the selected state goes 'template'
    //   while normal goes 'original' — RNScreens throws "icon and
    //   selectedIcon must be same type" and red-screens on boot.
    // • The three immersive tabs carry disableAutomaticContentInsets, and
    //   their roots deliberately do NOT set collapsable={false}. Pairing a
    //   screen's scroll view with the bar hands content insets to RNScreens,
    //   which insets the list below the status bar and exposes a band of the
    //   root's colour above these full-bleed screens. The bar does not need
    //   the pairing — both its appearances are pinned above. SEARCH is the
    //   exception and keeps automatic insets: it has a real native header and
    //   Stack.SearchBar for its content to sit under.
    // iconColor/labelStyle are safe HERE, though they were removed earlier as
    // part of fixing the bar: what actually suppresses the system treatment is
    // swapping in a custom appearance, and blurEffect already does that. Given
    // the appearance is custom regardless, the unselected items may as well be
    // legible — the system default resolves near-black against this material.
    // Selected state is left to tintColor (expo-router falls back to it).
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
