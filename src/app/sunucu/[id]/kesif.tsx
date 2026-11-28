// Keşfette görün: açıklama ve kategori
import { useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useKanka } from '@/lib/kanka';
import { act } from '@/lib/admin';
import { C, F } from '@/lib/theme';
import { Screen, Section, ToggleRow, Chips, Empty } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';

const CATS = ['Oyun', 'Sohbet', 'Müzik', 'Eğitim', 'Yazılım', 'Anime', 'Film ve dizi', 'Spor', 'Sanat', 'Diğer'];

export default function Kesif() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const [on, setOn] = useState(!!s?.discoverable), [desc, setDesc] = useState(s?.description || ''), [cat, setCat] = useState<string>(s?.category || '');
  const [busy, setBusy] = useState(false);
  if (!s) return <Screen title="Keşif"><Empty text="Sunucu bulunamadı." /></Screen>;
  const save = async () => {
    setBusy(true); const e = await act('discoverySave', { serverId: s.id, discoverable: on, description: desc.trim(), category: cat || null }); setBusy(false);
    if (e) Alert.alert('Kaydedilemedi', e); else router.back();
  };
  return (
    <Screen title="Keşif" sub={s.name}>
      <Section hint="Açıkken sunucun Keşfet’te listelenir ve herkes katılabilir.">
        <ToggleRow title="Keşfette göster" value={on} onChange={setOn} last />
      </Section>
      <T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>Kısa açıklama ({desc.length}/200)</T>
      <TextInput value={desc} onChangeText={v => setDesc(v.slice(0, 200))} multiline placeholder="Örn. Valorant takım arkadaşı bulma ve turnuva sunucusu" placeholderTextColor={C.faint} accessibilityLabel="Kısa açıklama"
        style={{ minHeight: 90, borderRadius: 12, backgroundColor: C.field, color: C.ink, padding: 14, fontFamily: F.regular, fontSize: 15, textAlignVertical: 'top' }} />
      <T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>Kategori</T>
      <Chips value={cat} options={[['', 'Yok'], ...CATS.map(c => [c, c] as [string, string])]} onChange={setCat} />
      <Button title="Kaydet" busy={busy} onPress={save} />
    </Screen>
  );
}
