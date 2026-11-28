// Mevcut sunucuya Discord şablonu uygula: eksik odalar, kategoriler ve roller eklenir; 24 saat içinde geri alınabilir
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ask, useKanka } from '@/lib/kanka';
import { C, F } from '@/lib/theme';
import { Screen, Section, Row, Empty } from '@/components/AdminUI';
import { T, Field, Button } from '@/components/ui';

type G = { roles: { name: string }[]; categories: { name: string }[]; channels: { name: string; type?: string }[] };
type Prev = { error?: string; name?: string; add?: G; update?: G; keep?: G };
const n = (g?: G) => (g ? g.roles.length + g.categories.length + g.channels.length : 0);

export default function Sablon() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const [link, setLink] = useState(''), [p, setP] = useState<Prev | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (link.trim().length < 4) return;
    const t = setTimeout(async () => setP((await ask<Prev>('tplPreview', { serverId: id, link: link.trim() })) || { error: 'Şablon okunamadı' }), 500);
    return () => clearTimeout(t);
  }, [link, id]);
  if (!s) return <Screen title="Şablon uygula"><Empty text="Sunucu bulunamadı." /></Screen>;
  const undo = (s as any).tplUndo as { t: number; channels: number; categories: number; roles?: number } | null;
  const apply = async () => {
    setBusy(true); const r = await ask<{ ok?: boolean; error?: string }>('tplApply', { serverId: id, link: link.trim() }); setBusy(false);
    if (!r?.ok) return Alert.alert('Uygulanamadı', r?.error || 'Bağlantı yok');
    Alert.alert('Uygulandı', '24 saat içinde buradan geri alabilirsin.'); router.back();
  };
  const doUndo = () => Alert.alert('Şablonu geri al', 'Şablonla eklenen odalar, kategoriler ve roller silinir; değişen ayarlar eski haline döner.', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Geri al', style: 'destructive', onPress: async () => { const r = await ask<{ ok?: boolean; error?: string }>('tplUndo', { serverId: id }); Alert.alert(r?.ok ? 'Tamam' : 'Olmadı', r?.ok ? 'Şablon geri alındı.' : r?.error || 'Bağlantı yok'); } },
  ]);
  const list = (title: string, g?: G) => n(g) ? (
    <Section title={`${title} (${n(g)})`}>
      <T style={{ padding: 12, fontSize: 13.5, color: C.ink2, lineHeight: 20 }}>{[...g!.categories.map(k => '📁 ' + k.name), ...g!.channels.map(c => (c.type === 'voice' ? '🔊 ' : '# ') + c.name), ...g!.roles.map(r => '🏷️ ' + r.name)].join('   ')}</T>
    </Section>
  ) : null;
  return (
    <Screen title="Şablon uygula" sub={s.name}>
      {!!undo && <Section hint="Son uygulanan şablon 24 saat içinde geri alınabilir."><Row icon="clock" title="Son şablonu geri al" sub={`${undo.channels} oda, ${undo.categories} kategori eklenmişti`} danger onPress={doUndo} last /></Section>}
      <T style={{ color: C.muted, fontSize: 13.5, lineHeight: 19 }}>Discord şablon linkini yapıştır. Sunucunda olmayan odalar, kategoriler ve roller eklenir; aynı adlı olanların ayarları güncellenir. Hiçbir şey silinmez.</T>
      <Field label="Discord şablon linki" value={link} onChangeText={setLink} placeholder="discord.new/abc123" autoCapitalize="none" autoCorrect={false} />
      {p?.error ? <T style={{ color: C.danger }}>{p.error}</T> : p?.add ? <>
        <T style={{ fontFamily: F.black, fontSize: 16 }}>{p.name}</T>
        {list('Eklenecek', p.add)}
        {list('Güncellenecek', p.update)}
        {!n(p.add) && !n(p.update) && <Empty text="Bu şablondaki her şey sunucunda zaten var." />}
        <View><Button title="Şablonu uygula" busy={busy} disabled={!n(p.add) && !n(p.update)} onPress={apply} /></View>
      </> : null}
    </Screen>
  );
}
