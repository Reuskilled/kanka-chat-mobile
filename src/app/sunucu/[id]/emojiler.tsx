import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useKanka, uploadImage } from '@/lib/kanka';
import { act, can, fmtAgo } from '@/lib/admin';
import { abs } from '@/lib/config';
import { C, F } from '@/lib/theme';
import { Screen, Section, Row, Sheet, Empty } from '@/components/AdminUI';
import { T, Button, Field, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';

const cleanName = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
const guess = (file?: string | null) => cleanName((file || '').replace(/\.[a-z0-9]+$/i, '').replace(/[\s-]+/g, '_')) || 'emoji';
const NO_EMOJIS: Record<string, string> = {};
const NO_META: Record<string, { by: string; at: number }> = {};

type Draft = { orig: string | null; name: string; uri: string | null; type: string; url: string | null };

// Sunucuya özel emojiler: ekle, yeniden adlandır, resmini değiştir, sil
export default function Emojiler() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const [d, setD] = useState<Draft | null>(null), [busy, setBusy] = useState(false);
  if (!s) return <Screen title="Emojiler"><Empty text="Sunucu bulunamadı." /></Screen>;
  const emojis = s.emojis || NO_EMOJIS, meta = s.emojiMeta || NO_META;
  const names = Object.keys(emojis).sort();
  const ok = can(s, 'manageEmojis') || can(s, 'manageServer');

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (r.canceled) return null;
    return r.assets[0];
  };
  const startAdd = async () => {
    const a = await pick(); if (!a) return;
    setD({ orig: null, name: guess(a.fileName), uri: a.uri, type: a.mimeType || 'image/png', url: null });
  };
  const changeImg = async () => {
    const a = await pick(); if (!a || !d) return;
    setD({ ...d, uri: a.uri, type: a.mimeType || 'image/png' });
  };
  const save = async () => {
    if (!d) return;
    if (d.name.length < 2) return Alert.alert('Ad kısa', 'Emoji adı en az 2 karakter olmalı (a-z, 0-9, _).');
    setBusy(true);
    let url: string | undefined;
    if (d.uri) {
      const u = await uploadImage(d.uri, d.type);
      if (!u.url) { setBusy(false); return Alert.alert('Yüklenemedi', u.error || ''); }
      url = u.url;
    }
    const e = d.orig
      ? await act('editEmoji', { serverId: s.id, name: d.orig, to: d.name, url })
      : await act('addEmoji', { serverId: s.id, name: d.name, url });
    setBusy(false);
    if (e) return Alert.alert('Kaydedilemedi', e);
    setD(null);
  };
  const remove = () => {
    if (!d?.orig) return;
    const n = d.orig;
    Alert.alert('Emojiyi sil', `:${n}: silinsin mi? Eski mesajlarda yazı olarak kalır.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => { const e = await act('removeEmoji', { serverId: s.id, name: n }); if (e) Alert.alert('Silinemedi', e); else setD(null); } },
    ]);
  };
  const preview = d?.uri || abs(d?.url);

  return (
    <Screen title="Emojiler" sub={`${names.length} emoji · ${s.name}`} right={ok ? <IconButton label="Emoji ekle" onPress={startAdd}><Icon name="plus" stroke={2.4} /></IconButton> : undefined}>
      <Section title="Sunucu emojileri" hint="Mesajlarda :ad: yazarak kullanılır. Kare, sade resimler en iyi görünür.">
        {names.length ? names.map((n, i) => (
          <Row key={n} title={`:${n}:`} sub={meta[n] ? `${meta[n].by} · ${fmtAgo(meta[n].at)}` : undefined} last={i === names.length - 1}
            left={<Image source={{ uri: abs(emojis[n]) || undefined }} style={{ width: 32, height: 32 }} contentFit="contain" accessibilityIgnoresInvertColors />}
            onPress={ok ? () => setD({ orig: n, name: n, uri: null, type: '', url: emojis[n] }) : undefined} />
        )) : <Empty text={ok ? 'Henüz emoji yok. Sağ üstten ilkini ekle.' : 'Bu sunucuda özel emoji yok.'} />}
      </Section>
      {ok && names.length > 0 && <Button title="Emoji ekle" kind="ghost" onPress={startAdd} icon={<Icon name="plus" size={18} />} />}

      <Sheet open={!!d} onClose={() => setD(null)} title={d?.orig ? `:${d.orig}:` : 'Yeni emoji'}>
        {d && <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 72, height: 72, borderRadius: 16, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
              {preview ? <Image source={{ uri: preview }} style={{ width: 56, height: 56 }} contentFit="contain" /> : null}
            </View>
            <Button title="Resmi değiştir" kind="ghost" onPress={changeImg} style={{ flex: 1 }} />
          </View>
          <Field label="Ad" value={d.name} onChangeText={v => setD({ ...d, name: cleanName(v) })} autoCapitalize="none" autoCorrect={false} maxLength={24} placeholder="kanka_selam" />
          <T style={{ fontSize: 12.5, color: C.faint }}>Sadece küçük harf, rakam ve alt çizgi.</T>
          <Button title={d.orig ? 'Kaydet' : 'Ekle'} busy={busy} onPress={save} />
          {!!d.orig && <Button title="Emojiyi sil" kind="danger" onPress={remove} />}
        </>}
      </Sheet>
      {!ok && <T style={{ color: C.faint, fontSize: 12.5, fontFamily: F.regular }}>Emoji eklemek için emoji yönetme yetkin olmalı.</T>}
    </Screen>
  );
}
