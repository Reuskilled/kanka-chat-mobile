import { useCallback, useEffect, useState } from 'react';
import { Alert, Share, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ask, useKanka, useReady } from '@/lib/kanka';
import { act, fmtAgo, isOwner } from '@/lib/admin';
import { SERVER } from '@/lib/config';
import { C, F } from '@/lib/theme';
import { Screen, Section, Row, Sheet, Chips, ToggleRow, Empty } from '@/components/AdminUI';
import { T, Button, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';

type Inv = { code: string; by: string; at: number; exp: number | null; max: number; uses: number; temp: boolean; ok: boolean };
const EXP: [number, string][] = [[1800, '30 dk'], [3600, '1 saat'], [21600, '6 saat'], [86400, '1 gün'], [604800, '7 gün'], [0, 'Süresiz']];
const MAX: [number, string][] = [[0, 'Sınırsız'], [1, '1'], [5, '5'], [10, '10'], [25, '25'], [100, '100']];
const link = (c: string) => `${SERVER}/davet/${c}`;
const leftTxt = (t: number) => { const m = Math.round((t - Date.now()) / 60e3); return m <= 0 ? 'süresi doldu' : m < 60 ? `${m} dk kaldı` : m < 1440 ? `${Math.round(m / 60)} saat kaldı` : `${Math.round(m / 1440)} gün kaldı`; };

export default function Davetler() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ready = useReady();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const [data, setData] = useState<{ main?: { code: string; uses: number }; list: Inv[] } | null>(null);
  const [open, setOpen] = useState(false), [exp, setExp] = useState(86400), [max, setMax] = useState(0), [temp, setTemp] = useState(false), [busy, setBusy] = useState(false);
  const [ver, setVer] = useState(0);
  const load = useCallback(() => setVer(v => v + 1), []);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    ask<{ error?: string; main?: { code: string; uses: number }; list?: Inv[] }>('invList', id).then(r => { if (alive && !r?.error) setData({ main: r.main, list: r.list || [] }); });
    return () => { alive = false; };
  }, [id, ver, ready]);
  const share = async (c: string) => { try { await Share.share({ message: `${s?.name || 'Sunucu'} davet linki: ${link(c)}` }); } catch { await Clipboard.setStringAsync(link(c)); } };
  const copy = async (c: string) => { await Clipboard.setStringAsync(link(c)); Alert.alert('Kopyalandı', link(c)); };
  const create = async () => {
    setBusy(true); const r = await ask<{ error?: string; inv?: Inv }>('invCreate', { serverId: id, exp, max, temp }); setBusy(false);
    if (r?.error) return Alert.alert('Oluşturulamadı', r.error);
    setOpen(false); load(); const c = r?.inv?.code; if (c) share(c);
  };
  const revoke = (c: string) => Alert.alert('Linki iptal et', 'Bu link artık çalışmayacak.', [
    { text: 'Vazgeç', style: 'cancel' }, { text: 'İptal et', style: 'destructive', onPress: async () => { const e = await act('invRevoke', { serverId: id, code: c }); if (e) Alert.alert('Olmadı', e); load(); } }]);
  const [vOpen, setVOpen] = useState(false), [slug, setSlug] = useState('');
  const reset = () => Alert.alert('Ana linki yenile', 'Eski ana link hemen çalışmaz olur. Yeni link oluşturulsun mu?', [
    { text: 'Vazgeç', style: 'cancel' }, { text: 'Yenile', style: 'destructive', onPress: async () => { const r = await ask<{ error?: string; invite?: string }>('resetInvite', id); if (r?.error) return Alert.alert('Olmadı', r.error); load(); if (r?.invite) share(r.invite); } }]);
  const saveVanity = async () => {
    setBusy(true); const r = await ask<{ error?: string; vanity?: string | null }>('srvVanity', { serverId: id, slug }); setBusy(false);
    if (r?.error) return Alert.alert('Olmadı', r.error);
    setVOpen(false); Alert.alert('Tamam', r?.vanity ? `Artık kankahq.com/${r.vanity} ile katılınabilir.` : 'Özel link kaldırıldı.');
  };
  const live = (data?.list || []).filter(i => i.ok), old = (data?.list || []).filter(i => !i.ok);
  return (
    <Screen title="Davet linkleri" sub={s?.name} right={<IconButton label="Yeni link" onPress={() => setOpen(true)}><Icon name="plus" stroke={2.4} /></IconButton>}>
      {data?.main && (
        <Section title="Ana link" hint="Süresiz, herkesle paylaşabileceğin link.">
          <Row icon="userAdd" iconColor={C.accent} title={link(data.main.code).replace(/^https?:\/\//, '')} sub={`${data.main.uses} kişi bununla katıldı`} onPress={() => share(data.main!.code)}
            right={<IconButton size={36} label="Kopyala" onPress={() => copy(data.main!.code)}><Icon name="file" size={18} color={C.muted} /></IconButton>} last />
        </Section>
      )}
      {!!s && !s.public && (
        <Section hint="Yenilersen eski ana link artık çalışmaz (sızdıysa işe yarar).">
          <Row icon="star" title="Özel link" sub={s.vanity ? `kankahq.com/${s.vanity}` : 'kankahq.com/isim (Yıldız, Partner ya da Energy Level 3)'} onPress={isOwner(s) ? () => { setSlug(s.vanity || ''); setVOpen(true); } : undefined} />
          <Row icon="clock" title="Ana linki yenile" danger onPress={reset} last />
        </Section>
      )}
      <Section title={`Özel linkler (${live.length})`}>
        {live.length ? live.map((i, n) => (
          <Row key={i.code} title={i.code} sub={[i.exp ? leftTxt(i.exp) : 'süresiz', i.max ? `${i.uses}/${i.max} kullanım` : `${i.uses} kullanım`, i.temp ? 'geçici üyelik' : '', `${i.by} · ${fmtAgo(i.at)}`].filter(Boolean).join(' · ')}
            onPress={() => share(i.code)} last={n === live.length - 1}
            right={<IconButton size={36} label={`${i.code} linkini iptal et`} onPress={() => revoke(i.code)}><T style={{ color: '#f87171', fontFamily: F.black }}>✕</T></IconButton>} />
        )) : <Empty text="Özel link yok. Sağ üstten süreli ya da sınırlı bir link oluşturabilirsin." />}
      </Section>
      {old.length > 0 && <Section title="Biten linkler">{old.map((i, n) => <Row key={i.code} title={i.code} sub={`${i.uses} kullanım · bitti`} last={n === old.length - 1} />)}</Section>}
      <Sheet open={open} onClose={() => setOpen(false)} title="Yeni davet linki">
        <View style={{ gap: 8 }}><T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>Geçerlilik</T><Chips value={exp} options={EXP} onChange={setExp} /></View>
        <View style={{ gap: 8 }}><T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>En çok kaç kişi</T><Chips value={max} options={MAX} onChange={setMax} /></View>
        <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}><ToggleRow title="Geçici üyelik" sub="Çevrimdışı olunca sunucudan çıkar (rol verilmediyse)" value={temp} onChange={setTemp} last /></View>
        <Button title="Oluştur ve paylaş" busy={busy} onPress={create} />
      </Sheet>
      <Sheet open={vOpen} onClose={() => setVOpen(false)} title="Özel link">
        <T style={{ color: C.muted }}>3-24 karakter: küçük harf, rakam ve tire. Boş bırakırsan özel link kaldırılır.</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: C.field, paddingHorizontal: 14 }}>
          <T style={{ color: C.muted }}>kankahq.com/</T>
          <TextInput value={slug} onChangeText={v => setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24))} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Özel link" placeholder="isim" placeholderTextColor={C.faint}
            style={{ flex: 1, minHeight: 46, color: C.ink, fontFamily: F.bold, fontSize: 15 }} />
        </View>
        <Button title="Kaydet" busy={busy} onPress={saveVanity} />
      </Sheet>
    </Screen>
  );
}
