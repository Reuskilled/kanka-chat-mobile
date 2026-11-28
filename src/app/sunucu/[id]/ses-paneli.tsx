import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { createAudioPlayer } from 'expo-audio';
import { useKanka, sbAddWav } from '@/lib/kanka';
import { act, can } from '@/lib/admin';
import { abs } from '@/lib/config';
import { C, F } from '@/lib/theme';
import type { Sound } from '@/lib/types';
import { Screen, Section, Row, Sheet, Chips, ToggleRow, Empty } from '@/components/AdminUI';
import { T, Button, Field, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';

const VOLS: [number, string][] = [[0.25, '%25'], [0.5, '%50'], [0.8, '%80'], [1, '%100']];
const nearVol = (v?: number) => VOLS.reduce((a, b) => (Math.abs(b[0] - (v ?? 0.8)) < Math.abs(a[0] - (v ?? 0.8)) ? b : a))[0];
const NO_SOUNDS: Sound[] = [];

function preview(u: string, vol = 0.8) {
  const url = abs(u); if (!url) return;
  try { const p = createAudioPlayer(url); p.volume = vol; p.play(); setTimeout(() => { try { p.remove(); } catch {} }, 8000); } catch {}
}

type Draft = { id: string | null; name: string; emoji: string; vol: number; uri?: string; file?: string };

// Ses paneli: sesleri düzenle, sil, kimlerin ekleyebileceğini seç. Yeni ses WAV olarak eklenir (en çok 5 sn)
export default function SesPaneli() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const me = useKanka(st => st.me);
  const [d, setD] = useState<Draft | null>(null), [busy, setBusy] = useState(false);
  if (!s) return <Screen title="Ses paneli"><Empty text="Sunucu bulunamadı." /></Screen>;
  const sounds = s.sounds || NO_SOUNDS;
  const manage = can(s, 'manageSounds');
  const canAdd = !!me && s.members.includes(me) && (manage || (!s.public && s.sbAll !== false));

  const startAdd = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['audio/wav', 'audio/x-wav', 'audio/wave'], copyToCacheDirectory: true });
    if (r.canceled) return;
    const a = r.assets[0];
    if (!/\.wav$/i.test(a.name) && !/wav/.test(a.mimeType || '')) return Alert.alert('WAV olmalı', 'Ses paneline şimdilik sadece WAV dosyası eklenebiliyor (en çok 5 saniye). MP3 eklemek için webi kullan.');
    setD({ id: null, name: a.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 24), emoji: '🔊', vol: 0.8, uri: a.uri, file: a.name });
  };
  const save = async () => {
    if (!d) return;
    if (!d.name.trim()) return Alert.alert('Ad gerekli', 'Sese bir ad ver.');
    setBusy(true);
    const e = d.id
      ? await act('sbEdit', { serverId: s.id, id: d.id, name: d.name, emoji: d.emoji, vol: d.vol })
      : await sbAddWav(s.id, d.uri!, d.name, d.emoji);
    setBusy(false);
    if (e) return Alert.alert('Kaydedilemedi', e);
    setD(null);
  };
  const remove = () => {
    if (!d?.id) return;
    const sid = d.id;
    Alert.alert('Sesi sil', `"${d.name}" ses panelinden silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => { const e = await act('sbDel', { serverId: s.id, id: sid }); if (e) Alert.alert('Silinemedi', e); else setD(null); } },
    ]);
  };
  const setAll = async (v: boolean) => { const e = await act('sbSettings', { serverId: s.id, all: v }); if (e) Alert.alert('Olmadı', e); };

  return (
    <Screen title="Ses paneli" sub={`${sounds.length} ses · ${s.name}`} right={canAdd ? <IconButton label="Ses ekle" onPress={startAdd}><Icon name="plus" stroke={2.4} /></IconButton> : undefined}>
      {manage && !s.public && (
        <Section hint="Kapalıyken sadece ses panelini yönetme yetkisi olanlar ses ekler.">
          <ToggleRow title="Herkes ses ekleyebilir" value={s.sbAll !== false} onChange={setAll} last />
        </Section>
      )}
      <Section title="Sesler" hint="Sesli odadayken ses panelinden çalınır, odadaki herkes duyar.">
        {sounds.length ? sounds.map((x, i) => {
          const mine = x.by === me, edit = mine || manage;
          return (
            <Row key={x.id} title={`${x.emoji || '🔊'}  ${x.name}`} sub={[x.by, x.sec ? `${x.sec} sn` : '', `ses %${Math.round((x.vol ?? 0.8) * 100)}`].filter(Boolean).join(' · ')}
              last={i === sounds.length - 1} onPress={edit ? () => setD({ id: x.id, name: x.name, emoji: x.emoji || '🔊', vol: nearVol(x.vol) }) : undefined}
              right={<IconButton size={36} label={`${x.name} sesini dinle`} onPress={() => preview(x.url, x.vol)}><Icon name="speaker" size={18} color={C.muted} /></IconButton>} />
          );
        }) : <Empty text={canAdd ? 'Ses yok. Sağ üstten WAV dosyası ekleyebilirsin.' : 'Bu sunucunun ses panelinde ses yok.'} />}
      </Section>

      <Sheet open={!!d} onClose={() => setD(null)} title={d?.id ? 'Sesi düzenle' : 'Yeni ses'}>
        {d && <>
          {!!d.file && <T style={{ color: C.muted, fontSize: 13 }}>Dosya: {d.file}</T>}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ width: 86 }}><Field label="Emoji" value={d.emoji} onChangeText={v => setD({ ...d, emoji: v.slice(0, 8) })} style={{ textAlign: 'center', fontSize: 22 }} /></View>
            <View style={{ flex: 1 }}><Field label="Ad" value={d.name} onChangeText={v => setD({ ...d, name: v.slice(0, 24) })} maxLength={24} /></View>
          </View>
          {!!d.id && <View style={{ gap: 8 }}><T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>Ses seviyesi</T><Chips value={d.vol} options={VOLS} onChange={v => setD({ ...d, vol: v })} /></View>}
          <Button title={d.id ? 'Kaydet' : 'Ekle'} busy={busy} onPress={save} />
          {!!d.id && <Button title="Sesi sil" kind="danger" onPress={remove} />}
        </>}
      </Sheet>
    </Screen>
  );
}
