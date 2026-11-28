// Bildirim ayarları: hepsini aç/kapat, her sunucu için seviye (tüm mesajlar / etiketler / hiçbiri) ve susturma
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { savePrefs, useKanka } from '@/lib/kanka';
import type { Prefs, Server } from '@/lib/types';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { Image } from 'expo-image';
import { Screen, Section, Row, Sheet, ToggleRow, Chips } from '@/components/AdminUI';
import { T } from '@/components/ui';

type Lvl = 'all' | 'mentions' | 'none';
const LVL: [Lvl, string][] = [['all', 'Tüm mesajlar'], ['mentions', 'Sadece etiketler'], ['none', 'Hiçbiri']];
const MUTE: [number, string][] = [[0, 'Kapalı'], [1, '1 saat'], [8, '8 saat'], [24, '24 saat'], [-1, 'Ben açana kadar']];

const isMuted = (p: Prefs | null, id: string) => !!p?.muted?.includes(id);
const until = (p: Prefs | null, id: string) => p?.muteUntil?.[id] || 0;
function muteText(p: Prefs | null, id: string) {
  if (!isMuted(p, id)) return null;
  const u = until(p, id); if (!u) return 'Susturuldu';
  const h = Math.max(1, Math.round((u - Date.now()) / 3600e3));
  return `${h} saat susturuldu`;
}

export default function BildirimAyarlari() {
  const { sid } = useLocalSearchParams<{ sid?: string }>();
  const prefs = useKanka(s => s.prefs), servers = useKanka(s => s.servers);
  const [open, setOpen] = useState<string | null>(sid || null);
  const save = async (f: (p: Prefs) => Prefs) => { const e = await savePrefs(f); if (e) Alert.alert('Kaydedilemedi', e); };
  const on = prefs?.notif !== false;
  const list = servers;
  const cur = open ? servers.find(s => s.id === open) : null;
  return (
    <Screen title="Bildirimler">
      <Section hint="Kapatırsan telefonuna hiçbir mesaj bildirimi gelmez (aramalar yine çalar).">
        <ToggleRow title="Mesaj bildirimleri" value={on} onChange={v => save(p => ({ ...p, notif: v }))} last />
      </Section>
      <Section title="Sunucular" hint="Varsayılan: sadece seni etiketleyen ya da yanıtlayan mesajlar.">
        {list.map((s, i) => (
          <Row key={s.id} left={<SrvIcon s={s} />} title={s.name} sub={muteText(prefs, s.id) || LVL.find(l => l[0] === (prefs?.srv?.[s.id]?.lvl || 'mentions'))?.[1]}
            onPress={() => setOpen(s.id)} last={i === list.length - 1} />
        ))}
      </Section>
      <Sheet open={!!cur} onClose={() => setOpen(null)} title={cur?.name}>
        {cur && <SrvSettings s={cur} prefs={prefs} save={save} />}
      </Sheet>
    </Screen>
  );
}

function SrvIcon({ s }: { s: Server }) {
  const img = abs((s as any).iconImg);
  return img ? <Image source={{ uri: img }} style={{ width: 36, height: 36, borderRadius: 12 }} />
    : <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.field, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 16 }}>{(s as any).icon || s.name[0]}</T></View>;
}

function SrvSettings({ s, prefs, save }: { s: Server; prefs: Prefs | null; save: (f: (p: Prefs) => Prefs) => void }) {
  const lvl = (prefs?.srv?.[s.id]?.lvl as Lvl) || 'mentions';
  const m = isMuted(prefs, s.id), u = until(prefs, s.id);
  const muteVal = !m ? 0 : !u ? -1 : MUTE.reduce((best, [h]) => (h > 0 && Math.abs(u - Date.now() - h * 3600e3) < Math.abs(u - Date.now() - best * 3600e3) ? h : best), 1);
  const setLvl = (v: Lvl) => save(p => { const srv = { ...(p.srv || {}) }; const o = { ...(srv[s.id] || {}) }; if (v === 'mentions') delete o.lvl; else o.lvl = v; if (Object.keys(o).length) srv[s.id] = o; else delete srv[s.id]; return { ...p, srv }; });
  const setMute = (h: number) => save(p => {
    const muted = (p.muted || []).filter(x => x !== s.id), mu = { ...(p.muteUntil || {}) }; delete mu[s.id];
    if (h !== 0) { muted.push(s.id); if (h > 0) mu[s.id] = Date.now() + h * 3600e3; }
    return { ...p, muted, muteUntil: mu };
  });
  return (
    <>
      <T style={{ fontFamily: F.heavy }}>Ne zaman bildirim gelsin?</T>
      <Chips value={lvl} options={LVL} onChange={setLvl} />
      <T style={{ fontFamily: F.heavy, marginTop: 6 }}>Sustur</T>
      <Chips value={muteVal} options={MUTE} onChange={setMute} />
      <T style={{ fontSize: 12.5, color: C.muted }}>Susturulan sunucudan hiçbir bildirim gelmez. Tek tek odaların ayarı için odayı basılı tut.</T>
    </>
  );
}
