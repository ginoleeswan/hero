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
    // • The three immersive tabs carry disableAutomaticContentInsets. Adding
    //   collapsable={false} let iOS finally pair each screen's scroll view
    //   with the bar — which also made RNScreens force
    //   contentInsetAdjustmentBehavior to `automatic`, overriding the screens'
    //   own `never` and insetting their content below the status bar. That is
    //   the band of flat colour that appeared above the spotlight / arena
    //   stage / profile header. These screens are full-bleed by design and
    //   pad for the safe area themselves. SEARCH deliberately keeps automatic
    //   insets: it has a real native header + Stack.SearchBar to sit under.
    <NativeTabs
      tintColor="#e8621a"
      blurEffect="systemChromeMaterialDark"
      disableTransparentOnScrollEdge
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
