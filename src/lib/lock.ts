// Uygulama kilidi: açıksa uygulama açılınca ve 30 sn'den uzun arka planda kalınca parmak izi / Face ID ister
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { getItem, setItem } from './storage';

const KEY = 'kanka-kilit';
const AWAY_MS = 30_000;
type S = { on: boolean; locked: boolean; ready: boolean };
let st: S = { on: false, locked: false, ready: Platform.OS === 'web' };
const subs = new Set<() => void>();
const set = (p: Partial<S>) => { st = { ...st, ...p }; subs.forEach(f => f()); };
export const useLock = <T,>(pick: (s: S) => T) => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => pick(st));

let wired = false, hiddenAt = 0;
export async function wireLock() {
  if (wired || Platform.OS === 'web') return; wired = true;
  const on = (await getItem(KEY)) === '1';
  set({ on, locked: on, ready: true });
  AppState.addEventListener('change', s => {
    if (s === 'background') hiddenAt = Date.now();
    else if (s === 'active' && st.on && hiddenAt && Date.now() - hiddenAt > AWAY_MS) set({ locked: true });
    if (s === 'active') hiddenAt = 0;
  });
}

export async function lockAvailable(): Promise<string | null> {
  if (Platform.OS === 'web') return 'Kilit sadece telefonda çalışır.';
  if (!(await LocalAuthentication.hasHardwareAsync())) return 'Bu telefonda parmak izi ya da yüz tanıma yok.';
  if (!(await LocalAuthentication.isEnrolledAsync())) return 'Önce telefon ayarlarından parmak izi ya da yüz tanıma ekle.';
  return null;
}

async function auth(msg: string) {
  // Uygulama arka plana geçerken açılan sistem penceresi zamanlayıcıyı tetiklemesin
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: msg, cancelLabel: 'Vazgeç', fallbackLabel: 'Telefon şifresini kullan', disableDeviceFallback: false });
  hiddenAt = 0;
  return r.success;
}

export async function unlock() { if (await auth('Kanka Chat kilidini aç')) set({ locked: false }); }

export async function setLockOn(on: boolean): Promise<string | null> {
  if (on) { const e = await lockAvailable(); if (e) return e; }
  if (!(await auth(on ? 'Kilidi açmak için doğrula' : 'Kilidi kapatmak için doğrula'))) return 'Doğrulanmadı';
  await setItem(KEY, on ? '1' : null); set({ on, locked: false });
  return null;
}
