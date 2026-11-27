// App Store (StoreKit 2) ile Kanka Spark aboneliği. Satın alma Apple'ın ekranında olur; kart bilgisi uygulamaya hiç gelmez.
// Uygulama Apple'ın imzaladığı işlemi (JWS) sunucuya yollar; sunucu doğrulayınca işlem burada "bitirilir" (finishTransaction).
import { Linking } from 'react-native';
import * as IAP from 'expo-iap';

export type Phase = { price: string; period: string; count: number; free: boolean };
export type Offer = { sku: string; token: string; rec: Phase; intro: Phase | null };
export type PlayEvent = { kind: 'bought'; token: string } | { kind: 'pending' } | { kind: 'owned' } | { kind: 'error'; msg: string };

export const PLAY_OK = true;
export const STORE = { name: 'App Store', buy: 'appleBuy', restore: 'appleRestore', one: 'jws', many: 'jwss', hazir: 'appleHazir', hesap: 'appleHesap', aktif: 'apple', yenile: 'appleYenile', iptal: 'Ayarlar › adın › Abonelikler' } as const;
let conn: Promise<boolean> | null = null;
const ensure = () => (conn ||= IAP.initConnection().then(() => true, () => { conn = null; return false; }));
const UNIT: Record<string, string> = { day: 'D', week: 'W', month: 'M', year: 'Y' };
const per = (unit?: string | null, n?: string | null) => (unit && UNIT[unit] ? `P${parseInt(n || '1') || 1}${UNIT[unit]}` : 'P1M');

export async function loadOffer(sku: string): Promise<{ offer?: Offer; error?: string }> {
  if (!(await ensure())) return { error: 'App Store\'a bağlanılamadı' };
  try {
    const list = (await IAP.fetchProducts({ skus: [sku], type: 'subs' })) as any[] | null;
    const p = list?.find(x => x.id === sku);
    if (!p) return { error: 'Abonelik bulunamadı' };
    const rec: Phase = { price: p.displayPrice, period: per(p.subscriptionPeriodUnitIOS, p.subscriptionPeriodNumberIOS), count: 1, free: false };
    const mode = p.introductoryPricePaymentModeIOS;
    const intro: Phase | null = mode && mode !== 'empty' && p.introductoryPriceSubscriptionPeriodIOS
      ? { price: mode === 'free-trial' ? 'Ücretsiz' : p.introductoryPriceIOS || '', period: per(p.introductoryPriceSubscriptionPeriodIOS, '1'), count: parseInt(p.introductoryPriceNumberOfPeriodsIOS || '1') || 1, free: mode === 'free-trial' }
      : null;
    return { offer: { sku, token: '', rec, intro } };
  } catch (e: any) { return { error: e?.message || String(e) }; }
}

export async function buy(o: Offer, account: string) {
  await IAP.requestPurchase({ type: 'subs', request: { apple: { sku: o.sku, appAccountToken: account } } });
}

// Bu Apple hesabındaki geçerli abonelik işlemleri (imzalı JWS)
export async function ownedTokens(sku: string): Promise<string[]> {
  if (!(await ensure())) throw new Error('App Store\'a bağlanılamadı');
  const list = ((await IAP.getAvailablePurchases()) || []) as any[];
  return list.filter(p => p.productId === sku && p.purchaseToken).map(p => p.purchaseToken);
}

const waiting = new Map<string, any>(); // sunucu doğrulayınca bitirilecek işlemler
export async function finish(token: string) {
  const p = waiting.get(token); if (!p) return;
  waiting.delete(token);
  try { await IAP.finishTransaction({ purchase: p, isConsumable: false }); } catch { /* bir sonraki açılışta tekrar gelir, zararsız */ }
}

let subs: ((e: PlayEvent) => void)[] = [];
let wired = false;
export function onPlay(fn: (e: PlayEvent) => void) {
  subs.push(fn);
  if (!wired) {
    wired = true;
    IAP.purchaseUpdatedListener((p: any) => {
      if (p.purchaseState === 'pending') return subs.forEach(f => f({ kind: 'pending' })); // aile onayı (Satın Almak İçin Sor)
      if (p.purchaseToken) { waiting.set(p.purchaseToken, p); subs.forEach(f => f({ kind: 'bought', token: p.purchaseToken })); }
    });
    IAP.purchaseErrorListener((e: any) => {
      const code = String(e?.code || '');
      if (/cancel/i.test(code)) return;
      if (/already-owned|alreadyowned/i.test(code)) return subs.forEach(f => f({ kind: 'owned' }));
      subs.forEach(f => f({ kind: 'error', msg: e?.message || 'Satın alma tamamlanamadı' }));
    });
  }
  return () => { subs = subs.filter(x => x !== fn); };
}

export const manage = (_sku: string) => { IAP.deepLinkToSubscriptions({}).catch(() => Linking.openURL('https://apps.apple.com/account/subscriptions')); };
