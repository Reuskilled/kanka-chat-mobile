import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useKanka, uploadImage } from '@/lib/kanka';
import { act } from '@/lib/admin';
import { abs } from '@/lib/config';
import { C, F } from '@/lib/theme';
import { Screen, Section, ToggleRow, Chips, Empty } from '@/components/AdminUI';
import { T, Field, Button } from '@/components/ui';

const SLOW: [number, string][] = [[0, 'Kapalı'], [5, '5 sn'], [10, '10 sn'], [30, '30 sn'], [60, '1 dk'], [300, '5 dk']];

export default function Genel() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const [name, setName] = useState(s?.name || '');
  const [busy, setBusy] = useState<string | null>(null);
  if (!s) return <Screen title="Genel ayarlar"><Empty text="Sunucu bulunamadı." /></Screen>;
  const save = async (key: string, patch: Record<string, unknown>) => {
    setBusy(key); const e = await act('updateServer', { serverId: s.id, ...patch }); setBusy(null);
    if (e) Alert.alert('Kaydedilemedi', e);
    return !e;
  };
  const pick = async (kind: 'iconImg' | 'banner') => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: kind === 'iconImg' ? [1, 1] : [16, 7], quality: 0.85 });
    if (r.canceled) return;
    const a = r.assets[0]; setBusy(kind);
    const u = await uploadImage(a.uri, a.mimeType || 'image/jpeg');
    if (!u.url) { setBusy(null); return Alert.alert('Yüklenemedi', u.error || ''); }
    await save(kind, { [kind]: u.url });
  };
  const icon = abs(s.iconImg), banner = abs(s.banner);
  return (
    <Screen title="Genel ayarlar" sub={s.name}>
      <View style={{ height: 130, borderRadius: 18, overflow: 'hidden', backgroundColor: s.bannerColor || '#1c1410', justifyContent: 'flex-end', padding: 12 }}>
        {banner && <Image source={{ uri: banner }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Sunucu simgesini değiştir" onPress={() => pick('iconImg')}
            style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bgDeep }}>
            {icon ? <Image source={{ uri: icon }} style={{ width: 64, height: 64 }} contentFit="cover" /> : <T style={{ fontFamily: F.black, fontSize: 24 }}>{s.icon || s.name.slice(0, 1).toLocaleUpperCase('tr')}</T>}
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" onPress={() => pick('banner')} style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' }}>
            <T style={{ fontFamily: F.heavy, fontSize: 13 }}>{busy === 'banner' ? 'Yükleniyor…' : 'Afişi değiştir'}</T>
          </Pressable>
        </View>
      </View>
      {busy === 'iconImg' && <T style={{ color: C.muted, fontSize: 13 }}>Simge yükleniyor…</T>}
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {!!s.iconImg && <Button kind="ghost" title="Simgeyi kaldır" style={{ flex: 1, height: 44 }} onPress={() => save('iconImg', { iconImg: null })} />}
        {!!s.banner && <Button kind="ghost" title="Afişi kaldır" style={{ flex: 1, height: 44 }} onPress={() => save('banner', { banner: null })} />}
      </View>
      <Field label="Sunucu adı" value={name} onChangeText={setName} maxLength={40} />
      <Button title="Adı kaydet" busy={busy === 'name'} disabled={!name.trim() || name.trim() === s.name} onPress={() => save('name', { name: name.trim() })} />
      <Section title="Sohbet">
        <ToggleRow title="Küfür filtresi" sub="Hakaret ve küfürler yıldızlanır" value={!!s.filter} disabled={busy === 'filter'} onChange={v => save('filter', { filter: v })} last />
      </Section>
      <Section title="Yavaş mod (tüm sunucu)" hint="Herkes iki mesaj arasında bu kadar bekler. Odaya özel ayar Odalar'da.">
        <View style={{ padding: 12 }}><Chips value={s.slow || 0} options={SLOW} onChange={v => save('slow', { slow: v })} /></View>
      </Section>
    </Screen>
  );
}
