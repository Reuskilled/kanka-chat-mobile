// Uygulama kilitliyken her şeyin üstünde duran ekran
import { useEffect } from 'react';
import { View } from 'react-native';
import { useLock, unlock } from '@/lib/lock';
import { C, F } from '@/lib/theme';
import { T, Button } from './ui';
import { Icon } from './Icon';

export function LockScreen() {
  const locked = useLock(s => s.locked);
  useEffect(() => { if (locked) unlock(); }, [locked]);
  if (!locked) return null;
  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', inset: 0, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 30 }}>
      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={34} color={C.accent} /></View>
      <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 22 }}>Kanka Chat kilitli</T>
      <T style={{ color: C.muted, textAlign: 'center' }}>Devam etmek için parmak izi, yüz tanıma ya da telefon şifreni kullan.</T>
      <Button title="Kilidi aç" onPress={unlock} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}
