import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ask, useKanka, useReady } from '@/lib/kanka';
import { act, fmtAgo } from '@/lib/admin';
import { C, F } from '@/lib/theme';
import { Screen, Section, Row, Sheet, Chips, Empty } from '@/components/AdminUI';
import { T, Button, Field, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';

type Wh = { id: string; name: string; avatar: string | null; channelId: string; by: string; createdAt: number; uses: number; lastAt: number | null; url: string };
type Draft = { id: string | null; name: string; channelId: string };

// Webhook'lar: dış servisler (GitHub, form, bot…) bu linke POST atarak odaya mesaj yazar
export default function Webhooklar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ready = useReady();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const [list, setList] = useState<Wh[] | null>(null), [err, setErr] = useState<string | null>(null);
  const [d, setD] = useState<Draft | null>(null), [busy, setBusy] = useState(false), [ver, setVer] = useState(0);
  const load = useCallback(() => setVer(v => v + 1), []);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    ask<{ error?: string; list?: Wh[] }>('whList', { serverId: id }).then(r => { if (!alive) return; if (r?.list) setList(r.list); else setErr(r?.error || 'Yüklenemedi'); });
    return () => { alive = false; };
  }, [id, ver, ready]);
  if (!s) return <Screen title="Webhook'lar"><Empty text="Sunucu bulunamadı." /></Screen>;
  const chans = s.channels.filter(c => c.type !== 'voice' && c.type !== 'stage');
  const chName = (cid: string) => '#' + (s.channels.find(c => c.id === cid)?.name || 'silinmiş oda');
  const cur = d?.id ? list?.find(w => w.id === d.id) : null;

  const copy = async (w: Wh) => { await Clipboard.setStringAsync(w.url); Alert.alert('Kopyalandı', 'Webhook linki panoda. Bu link şifre gibidir, sadece güvendiğin servise ver.'); };
  const save = async () => {
    if (!d) return;
    if (!d.channelId) return Alert.alert('Oda seç', 'Mesajların gideceği odayı seç.');
    setBusy(true);
    const r = d.id
      ? await ask<{ error?: string }>('whEdit', { id: d.id, name: d.name, channelId: d.channelId })
      : await ask<{ error?: string; w?: Wh }>('whCreate', { serverId: s.id, name: d.name, channelId: d.channelId });
    setBusy(false);
    if (r?.error) return Alert.alert('Kaydedilemedi', r.error);
    const created = !d.id && (r as { w?: Wh })?.w;
    setD(null); load();
    if (created) copy(created);
  };
  const reset = () => {
    if (!d?.id) return;
    const wid = d.id;
    Alert.alert('Linki yenile', 'Eski link hemen çalışmaz olur. Bağladığın servise yeni linki girmen gerekir.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Yenile', style: 'destructive', onPress: async () => { const r = await ask<{ error?: string; w?: Wh }>('whEdit', { id: wid, reset: true }); if (r?.error) return Alert.alert('Olmadı', r.error); load(); if (r?.w) copy(r.w); } },
    ]);
  };
  const remove = () => {
    if (!d?.id) return;
    const wid = d.id;
    Alert.alert('Webhook\'u sil', `"${d.name}" silinsin mi? Bu linke gelen mesajlar artık düşmez.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => { const e = await act('whDelete', { id: wid }); if (e) return Alert.alert('Silinemedi', e); setD(null); load(); } },
    ]);
  };

  return (
    <Screen title="Webhook'lar" sub={`${list?.length ?? 0}/10 · ${s.name}`}
      right={list && list.length < 10 ? <IconButton label="Webhook oluştur" onPress={() => setD({ id: null, name: 'Webhook', channelId: chans[0]?.id || '' })}><Icon name="plus" stroke={2.4} /></IconButton> : undefined}>
      <Section title="Webhook'lar" hint="Bir servis bu linke mesaj gönderince seçtiğin odaya düşer. Link şifre gibidir, paylaşma.">
        {!list ? <Empty text={err || 'Yükleniyor…'} /> : list.length ? list.map((w, i) => (
          <Row key={w.id} icon="zap" iconColor={C.accent} title={w.name} last={i === list.length - 1}
            sub={[chName(w.channelId), `${w.uses} mesaj`, w.lastAt ? `son ${fmtAgo(w.lastAt)}` : '', w.by].filter(Boolean).join(' · ')}
            onPress={() => setD({ id: w.id, name: w.name, channelId: w.channelId })}
            right={<IconButton size={36} label={`${w.name} linkini kopyala`} onPress={() => copy(w)}><Icon name="file" size={18} color={C.muted} /></IconButton>} />
        )) : <Empty text="Webhook yok. Sağ üstten oluşturabilirsin." />}
      </Section>

      <Sheet open={!!d} onClose={() => setD(null)} title={d?.id ? 'Webhook' : 'Yeni webhook'}>
        {d && <>
          <Field label="Ad" value={d.name} onChangeText={v => setD({ ...d, name: v.slice(0, 32) })} maxLength={32} />
          <View style={{ gap: 8 }}>
            <T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>Oda</T>
            {chans.length ? <Chips value={d.channelId} options={chans.map(c => [c.id, '#' + c.name] as [string, string])} onChange={v => setD({ ...d, channelId: v })} /> : <T style={{ color: C.muted }}>Yazı odası yok.</T>}
          </View>
          {cur && <View style={{ borderRadius: 14, backgroundColor: C.card, padding: 12, gap: 6 }}>
            <T style={{ fontSize: 12, fontFamily: F.black, color: C.muted }}>LİNK</T>
            <T selectable numberOfLines={2} style={{ fontSize: 12.5, color: C.faint }}>{cur.url.replace(/[^/]+$/, '••••••')}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Kopyala" kind="ghost" onPress={() => copy(cur)} style={{ flex: 1 }} />
              <Button title="Yenile" kind="ghost" onPress={reset} style={{ flex: 1 }} />
            </View>
          </View>}
          <Button title={d.id ? 'Kaydet' : 'Oluştur ve linki kopyala'} busy={busy} onPress={save} />
          {!!d.id && <Button title="Webhook'u sil" kind="danger" onPress={remove} />}
        </>}
      </Sheet>
    </Screen>
  );
}
