import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <NativeTabs
      backgroundColor="#1a1a1a"
      tintColor="#e8621a"
      iconColor={{ default: '#666', selected: '#e8621a' }}
      labelStyle={{ default: { color: '#666' }, selected: { color: '#e8621a' } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="compass-outline" />}
        />
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="person" />}
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
