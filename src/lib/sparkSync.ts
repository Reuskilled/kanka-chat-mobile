// Satın alma sonucu hangi ekranda olursa olsun sunucuya iletilir; açılışta da bekleyen/başka cihazdan alınmış abonelik hesaba bağlanır.
import { afterAuth, ask, getState } from './kanka';
import { onPlay, ownedTokens, PLAY_OK } from './play';

export const SKU = 'kanka_spark';
type Note = { text: string; tone: 'good' | 'info' | 'err' };
let listeners: ((n: Note) => void)[] = [];
export function onSparkNote(fn: (n: Note) => void) { listeners.push(fn); return () => { listeners = listeners.filter(x => x !== fn); }; }
const note = (text: string, tone: Note['tone'] = 'info') => listeners.forEach(f => f({ text, tone }));

export async function restoreSpark(loud: boolean) {
  if (!PLAY_OK || !getState().me) return;
  let tokens: string[] = [];
  try { tokens = await ownedTokens(SKU); } catch (e: any) { if (loud) note('Google Play\'e bağlanılamadı: ' + (e?.message || e), 'err'); return; }
  if (!tokens.length) { if (loud) note('Bu Google hesabında Kanka Spark aboneliği bulunamadı'); return; }
  const x = await ask<{ ok?: boolean; sonuc?: { error?: string }[]; me?: { active?: boolean } }>('playRestore', { tokens });
  const e = x?.sonuc?.find(y => y.error);
  if (loud) note(e?.error || (x?.me?.active ? 'Spark aboneliğin geri yüklendi ⚡' : 'Aktif abonelik yok'), e ? 'err' : 'good');
}

let started = false;
export function wireSpark() {
  if (started || !PLAY_OK) return; started = true;
  onPlay(async ev => {
    if (ev.kind === 'pending') return note('Ödemen onay bekliyor. Google onaylayınca Spark kendiliğinden açılır.');
    if (ev.kind === 'owned') return restoreSpark(true);
    if (ev.kind === 'error') return note('Satın alma tamamlanamadı: ' + ev.msg, 'err');
    const r = await ask<{ error?: string; pending?: boolean; active?: boolean }>('playBuy', { token: ev.token });
    if (r?.error) return note(r.error, 'err');
    if (r?.pending) return note('Ödemen onay bekliyor. Google onaylayınca Spark kendiliğinden açılır.');
    if (r?.active) note('⚡ Kanka Spark açıldı! Hoş geldin.', 'good');
  });
  afterAuth.push(() => { setTimeout(() => restoreSpark(false), 4000); });
}
