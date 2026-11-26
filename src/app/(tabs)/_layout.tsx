import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoiceBar } from '@/components/VoiceUI';
import { C, F } from '@/lib/theme';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';
import { useKanka } from '@/lib/kanka';

export default function TabsLayout() {
  const me = useKanka(s => s.me);
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarStyle: { backgroundColor: C.bgDeep, borderTopColor: C.line, height: 72, paddingTop: 8 },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontFamily: F.heavy, fontSize: 11.5 },
        tabBarBadgeStyle: { backgroundColor: C.danger, fontFamily: F.black, fontSize: 10 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Sunucular', tabBarIcon: ({ color }) => <Icon name="home" color={color} size={24} /> }} />
      <Tabs.Screen name="mesajlar" options={{ title: 'Mesajlar', tabBarIcon: ({ color }) => <Icon name="chat" color={color} size={24} /> }} />
      <Tabs.Screen name="bildirimler" options={{ title: 'Bildirimler', tabBarIcon: ({ color }) => <Icon name="bell" color={color} size={24} /> }} />
      <Tabs.Screen name="profil" options={{ title: 'Sen', tabBarIcon: ({ focused }) => (me ? <Avatar name={me} size={26} ring={focused ? C.accent : undefined} /> : <Icon name="users" />) }} />
    </Tabs>
    <VoiceBar bottom={72 + insets.bottom + 8} />
    </View>
  );
}
