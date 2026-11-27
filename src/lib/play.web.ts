// Web önizlemesi: Google Play yok. Arayüzü denemek için sahte teklif (EXPO_PUBLIC_PLAY_DEMO=1 iken); satın alma hiçbir yere gitmez.
export type Phase = { price: string; period: string; count: number; free: boolean };
export type Offer = { sku: string; token: string; rec: Phase; intro: Phase | null };
export type PlayEvent = { kind: 'bought'; token: string } | { kind: 'pending' } | { kind: 'owned' } | { kind: 'error'; msg: string };
const DEMO = process.env.EXPO_PUBLIC_PLAY_DEMO === '1';
export const STORE = { name: 'Google Play', buy: 'playBuy', restore: 'playRestore', one: 'token', many: 'tokens', hazir: 'playHazir', hesap: 'playHesap', aktif: 'play', yenile: 'playYenile', iptal: 'Google Play › Ödemeler ve abonelikler' } as const;
export async function finish(_token: string) {}
export const PLAY_OK = DEMO;
let subs: ((e: PlayEvent) => void)[] = [];
export async function loadOffer(sku: string): Promise<{ offer?: Offer; error?: string }> {
  return DEMO ? { offer: { sku, token: 'demo', rec: { price: '₺79,99', period: 'P1M', count: 1, free: false }, intro: { price: 'Ücretsiz', period: 'P1W', count: 1, free: true } } } : { error: 'Google Play yok' };
}
export async function buy(_o: Offer, account: string) { (globalThis as any).__kankaBuy = account; setTimeout(() => subs.forEach(f => f({ kind: 'bought', token: 'demo-token-' + account.slice(0, 6) })), 300); }
export async function ownedTokens(_sku: string): Promise<string[]> { return []; }
export function onPlay(fn: (e: PlayEvent) => void) { subs.push(fn); return () => { subs = subs.filter(x => x !== fn); }; }
export const manage = (_sku: string) => {};
