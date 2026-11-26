// Telefon (Android/iOS): WebRTC react-native-webrtc'den; ses yönlendirme (hoparlör / kulaklık / Bluetooth) InCallManager ile;
// arka planda ses kesilmesin diye Android ön plan hizmeti (Notifee). Web önizlemesinde rtc.web.ts kullanılır.
import { Platform } from 'react-native';
import { RTCPeerConnection, mediaDevices, MediaStream } from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import notifee, { AndroidImportance, AndroidForegroundServiceType } from '@notifee/react-native';

export { RTCPeerConnection, mediaDevices, MediaStream };

// Ön plan hizmeti sesli odadan çıkana kadar açık kalır (görev hiç bitmeyen bir söz döndürür)
let stopFg: (() => void) | null = null;
notifee.registerForegroundService(() => new Promise<void>(res => { stopFg = res; }));

export async function audioStart(speaker: boolean) {
  try { InCallManager.start({ media: 'audio' }); InCallManager.setForceSpeakerphoneOn(speaker); InCallManager.setKeepScreenOn(false); } catch {}
}
export function audioStop() { try { InCallManager.stop(); } catch {} }
export function setSpeaker(on: boolean) { try { InCallManager.setForceSpeakerphoneOn(on); } catch {} }

export async function bgStart(title: string) {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.requestPermission();
    const channelId = await notifee.createChannel({ id: 'ses', name: 'Sesli oda', importance: AndroidImportance.LOW });
    await notifee.displayNotification({
      id: 'kanka-ses', title, body: 'Sesli odadasın · dokun, geri dön',
      android: { channelId, asForegroundService: true, ongoing: true, smallIcon: 'ic_stat_kanka', color: '#D4FF00', colorized: false,
        foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE], pressAction: { id: 'default', launchActivity: 'default' } },
    });
  } catch (e) { console.warn('arka plan sesi', e); }
}
export async function bgStop() {
  if (Platform.OS !== 'android') return;
  try { stopFg?.(); stopFg = null; await notifee.stopForegroundService(); await notifee.cancelNotification('kanka-ses'); } catch {}
}

// Telefonda uzak ses kendiliğinden çalar; bu ikisi sadece web önizlemesinde iş yapar
export function webPlay(_id: string, _stream: unknown) {}
export function webStop(_id: string) {}
