// Telefon bildirimleri: sunucu Android'e FCM, iPhone'a doğrudan APNs ile gönderir (kanka-chat server.js: nativePush).
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
      // iPhone: geliştirme derlemesi APNs deneme ortamına, TestFlight/App Store derlemesi yayın ortamına kayıtlıdır
      const r = await ask<{ error?: string }>('pushNative', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android', ...(Platform.OS === 'ios' ? { sandbox: __DEV__ } : {}) });
      if (!r?.error) registered = token;
    }
    return 'acik';
  } catch (e) { console.warn('bildirim', e); return 'yok'; }
}

export async function stopPush() {
  if (!registered) return;
  fire('pushNativeOff', { token: registered }); registered = null;
}

// iPhone'da sunucunun ek verisi bildirimin tam yükünde (trigger.payload) durur; Android'de content.data'da
function dataOf(r: Notifications.NotificationResponse): Record<string, unknown> | undefined {
  const req = r.notification.request;
  const d = req.content.data as Record<string, unknown> | null;
  if (d && Object.keys(d).length) return d;
  return ((req.trigger as any)?.payload as Record<string, unknown>) || undefined;
}
// Bildirime basıldı: sohbeti aç; arama bildirimiyse doğrudan aramaya katıl (uygulama kapalıyken basıldıysa giriş bitince)
function openFrom(data: Record<string, unknown> | undefined) {
  const ch = typeof data?.ch === 'string' ? data.ch : null;
  if (!ch) return;
  const call = data?.call === '1' || data?.call === true;
  const go = async () => {
    router.push({ pathname: '/kanal/[id]', params: { id: ch } });
    if (!call || getState().myVoice) return;
    const { joinCallFromPush } = await import('./voice');
    joinCallFromPush(ch);
  };
  if (getState().phase === 'in') go(); else { const t = setInterval(() => { if (getState().phase === 'in') { clearInterval(t); setTimeout(go, 300); } }, 300); setTimeout(() => clearInterval(t), 20000); }
}
export function listenPush() {
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener(r => openFrom(dataOf(r)));
  Notifications.getLastNotificationResponseAsync().then(r => { if (r) openFrom(dataOf(r)); }).catch(() => {});
  // Jeton değişirse (Android bazen yeniler) yeniden kaydet
  const tsub = Notifications.addPushTokenListener(() => { registered = null; setupPush(false); });
  const asub = AppState.addEventListener('change', s => { if (s === 'active') Notifications.dismissAllNotificationsAsync().catch(() => {}); });
  return () => { sub.remove(); tsub.remove(); asub.remove(); };
}
