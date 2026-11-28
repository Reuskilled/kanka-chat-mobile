// Sunucu rozetleri: Topluluk → Yükselen (otomatik) → Yıldız (başvuru), ayrıca Doğrulanmış ve Partner
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { ask, useReady } from '@/lib/kanka';
import { C, F } from '@/lib/theme';
import { Screen, Section, Empty } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';
import { Icon } from '@/components/Icon';

type Req = { members: number; days: number; active?: number; rules?: boolean };
type AppV = { status: 'pending' | 'accepted' | 'rejected'; at: number; note?: string } | null;
type R = { error?: string; code: string; info: { members: number; days: number; active?: number; rules?: boolean }; req: Record<string, Req>; tiers: Record<string, Req>; tier: string | null; vanity: string | null; emoji: { used: number; max: number }; partner: boolean; has: Record<string, boolean>; apps: Record<string, AppV> };

const B: Record<string, [string, string, string]> = { topluluk: ['🌱', 'Topluluk', '#4cc38a'], yukselen: ['🚀', 'Yükselen', '#4aa8ff'], yildiz: ['⭐', 'Yıldız', '#f6c445'], dogrulanmis: ['✔️', 'Doğrulanmış', '#5865f2'], partner: ['🤝', 'Kanka Partner', '#d4ff00'] };
const PERKS: Record<string, string[]> = {
  topluluk: ['Keşfet’te listelenirken öne çıkar', 'Sunucu adının yanında Topluluk rozeti'],
  yukselen: ['Keşfet’te daha üstte + Yükselen rozeti', '100 özel emoji (normalde 50)', 'Yıldız başvurusuna bir adım'],
  yildiz: ['Keşfet’te en üstte, YILDIZ etiketiyle', 'Yuva’da “Haftanın yıldızı” vitrini', 'Özel davet linki: kankahq.com/isim', '200 özel emoji', 'Sahibine profilde Yıldız Sunucu rozeti'],
};
const ORDER = ['topluluk', 'yukselen', 'yildiz'];

function Bar({ v, max, label, unit }: { v: number; max: number; label: string; unit?: string }) {
  const ok = v >= max;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontSize: 13, color: ok ? C.online : C.muted }}>{ok ? '✓ ' : ''}{label}</T><T style={{ fontSize: 13, fontFamily: F.heavy }}>{Math.min(v, max)} / {max}{unit ? ' ' + unit : ''}</T></View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.field, overflow: 'hidden' }}><View style={{ height: 6, width: `${Math.min(100, Math.round((v / max) * 100))}%`, backgroundColor: ok ? C.online : C.accent }} /></View>
    </View>
  );
}

export default function Rozetler() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ready = useReady();
  const [r, setR] = useState<R | null>(null), [err, setErr] = useState('');
  const load = useCallback(() => ask<R>('srvBadgeApp', { serverId: id }).then(x => (x?.error ? setErr(x.error) : setR(x))), [id]);
  useEffect(() => { if (ready) load(); }, [ready, load]);
  if (!r) return <Screen title="Sunucu rozetleri">{err ? <Empty text={err} /> : <ActivityIndicator color={C.accent} style={{ marginTop: 30 }} />}</Screen>;
  const cur = r.tier ? ORDER.indexOf(r.tier) : -1, st = r.info;
  return (
    <Screen title="Sunucu rozetleri" sub={`Şu anki kademe: ${r.tier ? B[r.tier][1] : 'henüz yok'} · emoji ${r.emoji.used}/${r.emoji.max}`}>
      {ORDER.map((k, i) => {
        const done = i <= cur, next = i === cur + 1, q = r.tiers[k];
        return (
          <View key={k} style={{ padding: 14, borderRadius: 16, backgroundColor: C.card, gap: 10, borderWidth: next ? 1 : 0, borderColor: B[k][2], opacity: done || next ? 1 : 0.7 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T style={{ fontSize: 28 }}>{B[k][0]}</T>
              <View style={{ flex: 1 }}><T style={{ fontSize: 12, color: C.muted }}>{i + 1}. kademe · {k === 'yildiz' ? 'başvuru' : 'otomatik'}</T><T style={{ fontFamily: F.black, fontSize: 17 }}>{B[k][1]}</T></View>
              <T style={{ fontSize: 12, fontFamily: F.heavy, color: done ? C.online : next ? B[k][2] : C.faint }}>{done ? 'Kazanıldı' : next ? 'Sıradaki' : 'Kilitli'}</T>
            </View>
            {!done && <>
              <Bar v={st.members} max={q.members} label="Üye" />
              <Bar v={st.days} max={q.days} label="Sunucu yaşı" unit="gün" />
              {!!q.active && <Bar v={st.active || 0} max={q.active} label="Haftalık aktif üye" />}
              {!!q.rules && <T style={{ fontSize: 13, color: st.rules ? C.online : C.muted }}>{st.rules ? '✓ ' : ''}Kurallar (hoş geldin ekranında) {st.rules ? 'var' : 'yok'}</T>}
            </>}
            {PERKS[k].map(p => <View key={p} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Icon name={done ? 'check' : 'lock'} size={14} color={done ? C.online : C.faint} /><T style={{ flex: 1, fontSize: 13.5, color: done ? C.ink : C.muted }}>{p}</T></View>)}
            {k === 'yildiz' && !done && <Apply sid={id} type="yildiz" r={r} onDone={load} />}
          </View>
        );
      })}
      <Section title="Diğer rozetler">
        <View style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><T style={{ fontSize: 24 }}>{B.dogrulanmis[0]}</T><View style={{ flex: 1 }}><T style={{ fontFamily: F.black }}>Doğrulanmış</T><T style={{ fontSize: 12.5, color: C.muted }}>Bilinen bir yayıncının, markanın ya da topluluğun resmi sunucusu</T></View></View>
          {r.has.dogrulanmis ? <T style={{ color: C.online, fontFamily: F.heavy }}>✓ Sunucunda bu rozet var</T> : <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: C.field }}>
              <View style={{ flex: 1 }}><T style={{ fontSize: 12, color: C.muted }}>Doğrulama kodun</T><T selectable style={{ fontFamily: F.black, letterSpacing: 1 }}>{r.code}</T></View>
              <Button title="Kopyala" kind="ghost" style={{ height: 36, paddingHorizontal: 12 }} onPress={() => Clipboard.setStringAsync(r.code)} />
            </View>
            <T style={{ fontSize: 12.5, color: C.muted }}>Bu kodu resmi hesabının (YouTube, Twitch, Instagram, TikTok, X…) açıklamasına geçici olarak ekle. Ekip kontrol edince kaldırabilirsin.</T>
            <Apply sid={id} type="dogrulanmis" r={r} onDone={load} />
          </>}
        </View>
        <View style={{ padding: 14, gap: 6, borderTopWidth: 1, borderTopColor: C.line }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><T style={{ fontSize: 24 }}>{B.partner[0]}</T><View style={{ flex: 1 }}><T style={{ fontFamily: F.black }}>Kanka Partner</T><T style={{ fontSize: 12.5, color: C.muted }}>Kanka ekibi seçer, başvuru yok</T></View></View>
          {r.partner && <T style={{ color: C.online, fontFamily: F.heavy }}>✓ Sunucun Kanka Partner</T>}
        </View>
      </Section>
    </Screen>
  );
}

function Apply({ sid, type, r, onDone }: { sid: string; type: 'yildiz' | 'dogrulanmis'; r: R; onDone: () => void }) {
  const a = r.apps[type], q = r.req[type], st = r.info;
  const [link, setLink] = useState(''), [about, setAbout] = useState(''), [busy, setBusy] = useState(false);
  if (a?.status === 'pending') return <T style={{ color: '#f6c445', fontFamily: F.heavy }}>Başvurun değerlendiriliyor · {new Date(a.at).toLocaleDateString('tr', { day: 'numeric', month: 'long' })}</T>;
  const can = st.members >= q.members && st.days >= q.days && (!q.active || (st.active || 0) >= q.active) && (!q.rules || st.rules);
  const send = async () => {
    setBusy(true); const x = await ask<{ ok?: boolean; error?: string }>('srvBadgeApply', { serverId: sid, type, link: link.trim(), about: about.trim() }); setBusy(false);
    if (!x?.ok) return Alert.alert('Gönderilemedi', x?.error || 'Bağlantı yok');
    Alert.alert('Gönderildi', 'Kanka ekibi bakıp haber verecek.'); onDone();
  };
  return <View style={{ gap: 8 }}>
    {a?.status === 'rejected' && <T style={{ color: '#f87171', fontSize: 13 }}>Önceki başvuru olmadı{a.note ? ': ' + a.note : ''}. Tekrar başvurabilirsin.</T>}
    {!can ? <T style={{ fontSize: 12.5, color: C.faint }}>Şartları karşılayınca buradan başvurabilirsin.</T> : <>
      <TextInput value={link} onChangeText={v => setLink(v.slice(0, 200))} autoCapitalize="none" keyboardType="url" placeholder={type === 'dogrulanmis' ? 'Resmi hesabının bağlantısı (zorunlu)' : 'Sosyal medya ya da web sitesi (isteğe bağlı)'} placeholderTextColor={C.faint} accessibilityLabel="Bağlantı"
        style={{ minHeight: 44, borderRadius: 12, backgroundColor: C.field, color: C.ink, paddingHorizontal: 12, fontFamily: F.regular, fontSize: 15 }} />
      <TextInput value={about} onChangeText={v => setAbout(v.slice(0, 500))} multiline placeholder={type === 'dogrulanmis' ? 'Kimsin, bu sunucu kime ait?' : 'Sunucun ne hakkında, neden yıldız olmalı?'} placeholderTextColor={C.faint} accessibilityLabel="Açıklama"
        style={{ minHeight: 80, borderRadius: 12, backgroundColor: C.field, color: C.ink, padding: 12, fontFamily: F.regular, fontSize: 15, textAlignVertical: 'top' }} />
      <Button title="Başvur" busy={busy} disabled={about.trim().length < 20} onPress={send} />
    </>}
  </View>;
}
