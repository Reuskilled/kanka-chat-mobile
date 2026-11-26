import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Oturum anahtarı telefonda şifreli depoda (Android Keystore / iOS Keychain) durur.
// Web önizlemesinde (sadece geliştirme için) localStorage kullanılır.
const web = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  if (web) { try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; } }
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}

export async function setItem(key: string, value: string | null): Promise<void> {
  if (web) { try { value == null ? globalThis.localStorage?.removeItem(key) : globalThis.localStorage?.setItem(key, value); } catch {} return; }
  try { value == null ? await SecureStore.deleteItemAsync(key) : await SecureStore.setItemAsync(key, value); } catch {}
}

// Cihaz kimliği: sunucunun "yeni cihazdan giriş" uyarısı ve cihaz listesi için. Rastgele, kişisel bilgi içermez.
export async function deviceId(): Promise<string> {
  let d = await getItem('kanka-cihaz');
  if (!d) {
    const hex = '0123456789abcdef';
    d = 'm-' + Array.from({ length: 30 }, () => hex[Math.floor(Math.random() * 16)]).join('');
    await setItem('kanka-cihaz', d);
  }
  return d;
}
