// Telefon bildirimleri: sunucu FCM üzerinden gönderir (kanka-chat server.js: nativePush / fcmSend).
// Uygulama cihaz jetonunu 'pushNative' ile kaydeder; bildirime basınca ilgili sohbet açılır.
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { ask, fire, getState } from './kanka';

// Uygulama açıkken telefon bildirimi gösterme: sunucu zaten göndermiyor, gelse de uygulama içinde görünüyor
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

let registered: string | null = null;
export async function setupPush(askUser = true): Promise<'acik' | 'kapali' | 'yok'> {
  if (Platform.OS === 'web') return 'yok';
  try {
    if (Platform.OS === 'android') {
      // Kanal adları sunucunun gönderdiğiyle aynı olmalı (mesajlar / sosyal / aramalar)
      await Notifications.setNotificationChannelAsync('mesajlar', { name: 'Mesajlar', importance: AndroidImportance.HIGH, lightColor: '#D4FF00', vibrationPattern: [0, 180, 120, 180] });
      await Notifications.setNotificationChannelAsync('sosyal', { name: 'Arkadaşlık ve bahsetmeler', importance: AndroidImportance.DEFAULT });
      await Notifications.setNotificationChannelAsync('aramalar', { name: 'Aramalar', importance: AndroidImportance.MAX, vibrationPattern: [0, 600, 400, 600] });
    }
    let st = await Notifications.getPermissionsAsync();
    if (!st.granted && st.canAskAgain && askUser) st = await Notifications.requestPermissionsAsync();
    if (!st.granted) return 'kapali';
    const t = await Notifications.getDevicePushTokenAsync();
    const token = typeof t.data === 'string' ? t.data : '';
    if (!token) return 'yok';
    if (registered !== token) {
      const r = await ask<{ error?: string }>('pushNative', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
      if (!r?.error) registered = token;
    }
    return 'acik';
  } catch (e) { console.warn('bildirim', e); return 'yok'; }
}

export async function stopPush() {
  if (!registered) return;
  fire('pushNativeOff', { token: registered }); registered = null;
}

// Bildirime basıldı: sohbeti aç (uygulama kapalıyken basıldıysa giriş bitince)
function openFrom(data: Record<string, unknown> | undefined) {
  const ch = typeof data?.ch === 'string' ? data.ch : null;
  if (!ch) return;
  const go = () => router.push({ pathname: '/kanal/[id]', params: { id: ch } });
  if (getState().phase === 'in') go(); else { const t = setInterval(() => { if (getState().phase === 'in') { clearInterval(t); setTimeout(go, 300); } }, 300); setTimeout(() => clearInterval(t), 20000); }
}
export function listenPush() {
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener(r => openFrom(r.notification.request.content.data as any));
  Notifications.getLastNotificationResponseAsync().then(r => { if (r) openFrom(r.notification.request.content.data as any); }).catch(() => {});
  // Jeton değişirse (Android bazen yeniler) yeniden kaydet
  const tsub = Notifications.addPushTokenListener(() => { registered = null; setupPush(false); });
  const asub = AppState.addEventListener('change', s => { if (s === 'active') Notifications.dismissAllNotificationsAsync().catch(() => {}); });
  return () => { sub.remove(); tsub.remove(); asub.remove(); };
}
