import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    // tintColor ONLY. Any appearance customization — backgroundColor,
    // iconColor, labelStyle — swaps in a custom UITabBarAppearance and
    // suppresses the iOS 26 liquid-glass capsule, leaving bare icons floating
    // over the content. The system material handles colors and the dark
    // canvas on its own; tint is the one safe knob.
    //
    // Every icon must carry an explicit renderingMode="template": without it,
    // expo-router derives the mode per state from whether that state has an
    // icon color, and with only tintColor set the selected state resolves to
    // 'template' while normal resolves to 'original' — RNScreens then throws
    // "icon and selectedIcon must be same type" and red-screens on boot.
    <NativeTabs tintColor="#e8621a">
      <NativeTabs.Trigger name="explore">
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

      <NativeTabs.Trigger name="versus">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="sword-cross" />}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Arena</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="person" />}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
