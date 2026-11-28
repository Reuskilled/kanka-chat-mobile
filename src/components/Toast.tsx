// Sunucudan gelen kısa bilgiler (ör. "Başvurun onaylandı"): üstte 4 saniye görünür, dokununca kapanır
import { useEffect } from 'react';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showToast, useKanka } from '@/lib/kanka';
import { C, F } from '@/lib/theme';
import { T } from './ui';

export function Toast() {
  const toast = useKanka(s => s.toast);
  const insets = useSafeAreaInsets();
  useEffect(() => { if (!toast) return; const t = setTimeout(() => showToast(null), 4500); return () => clearTimeout(t); }, [toast]);
  if (!toast) return null;
  return (
    <Pressable accessibilityRole="alert" accessibilityLiveRegion="polite" onPress={() => showToast(null)}
      style={{ position: 'absolute', top: insets.top + 8, left: 14, right: 14, zIndex: 60, padding: 14, borderRadius: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: C.lineStrong, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}>
      <T style={{ fontFamily: F.bold, fontSize: 14 }}>{toast.t}</T>
    </Pressable>
  );
}
