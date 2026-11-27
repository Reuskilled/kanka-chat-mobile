// Google Play Faturalandırma (Kanka Spark aboneliği). Satın alma Google Play ekranında olur; kart bilgisi uygulamaya hiç gelmez.
// Uygulama sadece satın alma jetonunu (purchaseToken) sunucuya yollar; sunucu Google'a doğrulatıp Spark'ı açar ve satın almayı onaylar.
import { Linking, Platform } from 'react-native';
import * as IAP from 'expo-iap';

export type Phase = { price: string; period: string; count: number; free: boolean };
export type Offer = { sku: string; token: string; rec: Phase; intro: Phase | null };
export type PlayEvent = { kind: 'bought'; token: string } | { kind: 'pending' } | { kind: 'owned' } | { kind: 'error'; msg: string };

export const PLAY_OK = Platform.OS === 'android';
let conn: Promise<boolean> | null = null;
const ensure = () => (conn ||= IAP.initConnection().then(() => true, () => { conn = null; return false; }));

const toPhase = (p: { formattedPrice: string; billingPeriod: string; billingCycleCount: number; priceAmountMicros: string }): Phase =>
  ({ price: p.formattedPrice, period: p.billingPeriod, count: p.billingCycleCount || 1, free: p.priceAmountMicros === '0' });

export async function loadOffer(sku: string): Promise<{ offer?: Offer; error?: string }> {
  if (!(await ensure())) return { error: 'Google Play\'e bağlanılamadı' };
  try {
    const list = (await IAP.fetchProducts({ skus: [sku], type: 'subs' })) as any[] | null;
    const prod = list?.find(x => x.id === sku);
    const offers: any[] = prod?.subscriptionOffers || [];
    const phases = (o: any) => o?.pricingPhasesAndroid?.pricingPhaseList || [];
    // Önce temel plan (tek fazlı); deneme/indirim teklifi varsa Google uygunluğa göre gösterir (webdeki eklentiyle aynı seçim)
    const off = offers.find(o => phases(o).length === 1 && o.offerTokenAndroid) || offers.find(o => o.offerTokenAndroid);
    if (!off) return { error: 'Abonelik planı bulunamadı' };
    const ph = phases(off), rec = ph.find((x: any) => x.recurrenceMode === 1) || ph[ph.length - 1];
    return { offer: { sku, token: off.offerTokenAndroid, rec: toPhase(rec), intro: ph.length > 1 ? toPhase(ph[0]) : null } };
  } catch (e: any) { return { error: e?.message || String(e) }; }
}

export async function buy(o: Offer, account: string) {
  await IAP.requestPurchase({ type: 'subs', request: { google: { skus: [o.sku], subscriptionOffers: [{ sku: o.sku, offerToken: o.token }], obfuscatedAccountId: account } } });
}

// Bu Google hesabındaki aktif satın almalar (başka cihazda alınmış ya da onaylanmamış olanları hesaba bağlamak için)
export async function ownedTokens(sku: string): Promise<string[]> {
  if (!(await ensure())) throw new Error('Google Play\'e bağlanılamadı');
  const list = ((await IAP.getAvailablePurchases()) || []) as any[];
  return list.filter(p => p.productId === sku && p.purchaseState === 'purchased' && p.purchaseToken).map(p => p.purchaseToken);
}

let subs: ((e: PlayEvent) => void)[] = [];
let wired = false;
export function onPlay(fn: (e: PlayEvent) => void) {
  subs.push(fn);
  if (!wired && PLAY_OK) {
    wired = true;
    IAP.purchaseUpdatedListener((p: any) => {
      if (p.purchaseState === 'pending') return subs.forEach(f => f({ kind: 'pending' }));
      if (p.purchaseState === 'purchased' && p.purchaseToken) subs.forEach(f => f({ kind: 'bought', token: p.purchaseToken }));
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

export const manage = (sku: string) => Linking.openURL(`https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(sku)}&package=com.kanka.chat`);
