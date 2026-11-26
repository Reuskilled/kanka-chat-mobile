import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { C, F, statusColor } from '@/lib/theme';
import { abs } from '@/lib/config';
import { useKanka } from '@/lib/kanka';

// Kullanıcı resmi: varsa resmi, yoksa baş harfi rengiyle. İsteğe bağlı durum noktası.
export function Avatar({ name, size = 40, status = false, ring }: { name: string; size?: number; status?: boolean; ring?: string }) {
  const u = useKanka(s => s.users[name]);
  const pres = useKanka(s => (status ? s.presence[name] : undefined));
  const url = abs(u?.avatar);
  const dot = Math.max(10, Math.round(size * 0.3));
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: u?.color || C.hover, alignItems: 'center', justifyContent: 'center', ...(ring ? { borderWidth: 2.5, borderColor: ring } : null) }}>
        {url ? (
          <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={120} accessibilityIgnoresInvertColors />
        ) : (
          <Text style={{ color: '#fff', fontFamily: F.black, fontSize: size * 0.42 }}>{(u?.displayName || name || '?').slice(0, 1).toLocaleUpperCase('tr')}</Text>
        )}
      </View>
      {status && !u?.bot && name !== 'Kanka Bot' && (
        <View style={{ position: 'absolute', right: -1, bottom: -1, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: statusColor(pres), borderWidth: Math.max(2, dot * 0.22), borderColor: C.bg }} />
      )}
    </View>
  );
}
