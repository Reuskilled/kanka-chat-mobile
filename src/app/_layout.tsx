import { useEffect } from 'react';
import '@/lib/webAlert';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { C } from '@/lib/theme';
import { start, useKanka } from '@/lib/kanka';
import { listenPush, setupPush } from '@/lib/push';
import { wireVoice } from '@/lib/voice';
import { wireSpark } from '@/lib/sparkSync';
import { IncomingCall } from '@/components/VoiceUI';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsOk] = useFonts({ Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  const phase = useKanka(s => s.phase);
  const seg = useSegments();

  useEffect(() => { wireVoice(); wireSpark(); start(); return listenPush(); }, []);
  // Giriş yapılınca telefon bildirimlerini aç (ilk seferde izin sorulur)
  useEffect(() => { if (phase === 'in') { const t = setTimeout(() => setupPush(true), 1500); return () => clearTimeout(t); } }, [phase]);
  useEffect(() => { if (fontsOk && phase !== 'boot') SplashScreen.hideAsync().catch(() => {}); }, [fontsOk, phase]);

  // Oturum yoksa giriş ekranına, varsa ana ekrana
  useEffect(() => {
    if (phase === 'boot' || !fontsOk) return;
    const inAuth = seg[0] === 'giris' || seg[0] === 'kayit';
    if (phase === 'out' && !inAuth) router.replace('/giris');
    if (phase === 'in' && inAuth) router.replace('/');
  }, [phase, seg, fontsOk]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="kanal/[id]" />
        <Stack.Screen name="giris" options={{ animation: 'fade' }} />
        <Stack.Screen name="kayit" />
        <Stack.Screen name="ses" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      {phase === 'in' && <IncomingCall />}
      {(!fontsOk || phase === 'boot') && (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.accent} /></View>
      )}
    </SafeAreaProvider>
  );
}
