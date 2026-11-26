import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useKanka } from '@/lib/kanka';
import { act } from '@/lib/admin';
import type { Channel, Server } from '@/lib/types';
import { C, F } from '@/lib/theme';
import { Screen, Section, Row, Sheet, Chips, ToggleRow, Empty } from '@/components/AdminUI';
import { T, Field, Button, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';

const SLOW: [number, string][] = [[0, 'Kapalı'], [5, '5 sn'], [10, '10 sn'], [30, '30 sn'], [60, '1 dk'], [300, '5 dk'], [900, '15 dk'], [3600, '1 saat']];
const TYPES: [string, string][] = [['text', 'Yazı'], ['voice', 'Ses'], ['forum', 'Forum'], ['stage', 'Sahne']];
const typeIcon = (t: string) => (t === 'voice' || t === 'stage' ? 'speaker' : t === 'forum' ? 'chat' : 'hash');

// Odayı aynı kategorideki komşusunun yerine taşır (sunucu tek tek kaydırır)
async function moveIn(s: Server, c: Channel, dir: -1 | 1) {
  const i = s.channels.findIndex(x => x.id === c.id);
  let j = i + dir; while (j >= 0 && j < s.channels.length && (s.channels[j].cat || null) !== (c.cat || null)) j += dir;
  if (j < 0 || j >= s.channels.length) return;
  for (let k = 0; k < Math.abs(j - i); k++) { const e = await act('channelMove', { serverId: s.id, channelId: c.id, dir }); if (e) return Alert.alert('Taşınamadı', e); }
}

export default function Odalar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const [edit, setEdit] = useState<Channel | null>(null);
  const [add, setAdd] = useState<{ cat: string | null } | null>(null);
  const [cat, setCat] = useState<{ id: string | null; name: string } | null>(null);
  const groups = useMemo(() => {
    if (!s) return [];
    const g = [{ id: null as string | null, name: 'Kategorisiz', list: s.channels.filter(c => !c.cat || !s.categories.some(k => k.id === c.cat)) }];
    for (const k of s.categories) g.push({ id: k.id, name: k.name, list: s.channels.filter(c => c.cat === k.id) });
    return g;
  }, [s]);
  if (!s) return <Screen title="Odalar"><Empty text="Sunucu bulunamadı." /></Screen>;

  return (
    <Screen title="Odalar ve kategoriler" sub={s.name} right={<IconButton label="Kategori ekle" onPress={() => setCat({ id: null, name: '' })}><Icon name="plus" stroke={2.4} /></IconButton>}>
      {groups.map(g => (g.id === null && !g.list.length ? null : (
        <View key={g.id || 'yok'} style={{ gap: 6, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 4 }}>
            <T style={{ flex: 1, fontSize: 12, fontFamily: F.black, color: C.muted, letterSpacing: 0.6 }}>{g.name.toLocaleUpperCase('tr')}</T>
            {g.id && <IconButton size={36} label={`${g.name} kategorisini düzenle`} onPress={() => setCat({ id: g.id, name: g.name })}><Icon name="pen" size={16} color={C.muted} /></IconButton>}
            <IconButton size={36} label={`${g.name} içine oda ekle`} onPress={() => setAdd({ cat: g.id })}><Icon name="plus" size={18} color={C.muted} /></IconButton>
          </View>
          <View style={{ borderRadius: 16, backgroundColor: C.card, overflow: 'hidden' }}>
            {g.list.length ? g.list.map((c, i) => (
              <Row key={c.id} icon={typeIcon(c.type)} title={c.name} sub={[c.private ? 'gizli' : '', c.topic || '', c.slow ? `yavaş mod ${c.slow} sn` : ''].filter(Boolean).join(' · ') || undefined}
                last={i === g.list.length - 1} onPress={() => setEdit(c)}
                right={<View style={{ flexDirection: 'row' }}>
                  <IconButton size={34} label={`${c.name} yukarı`} onPress={() => moveIn(s, c, -1)}><View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="down" size={16} color={i === 0 ? C.faint : C.muted} /></View></IconButton>
                  <IconButton size={34} label={`${c.name} aşağı`} onPress={() => moveIn(s, c, 1)}><Icon name="down" size={16} color={i === g.list.length - 1 ? C.faint : C.muted} /></IconButton>
                </View>} />
            )) : <T style={{ color: C.faint, padding: 14, fontSize: 13.5 }}>Bu kategoride oda yok</T>}
          </View>
        </View>
      )))}
      {!s.categories.length && <Button kind="ghost" title="Kategori oluştur" onPress={() => setCat({ id: null, name: '' })} />}
      <Button title="Yeni oda" icon={<Icon name="plus" color={C.onAccent} stroke={2.6} />} onPress={() => setAdd({ cat: null })} />
      <ChannelSheet s={s} c={edit} onClose={() => setEdit(null)} />
      <AddSheet s={s} open={!!add} cat={add?.cat ?? null} onClose={() => setAdd(null)} />
      <CatSheet s={s} cat={cat} onClose={() => setCat(null)} />
    </Screen>
  );
}

function ChannelSheet({ s, c, onClose }: { s: Server; c: Channel | null; onClose: () => void }) {
  const [name, setName] = useState(''), [topic, setTopic] = useState(''), [slow, setSlow] = useState(0), [cat, setCat] = useState<string>('');
  const [busy, setBusy] = useState(false), [key, setKey] = useState<string | null>(null);
  if (c && key !== c.id) { setKey(c.id); setName(c.name); setTopic(c.topic || ''); setSlow(c.slow || 0); setCat(c.cat || ''); }
  if (!c && key) setKey(null);
  const text = c?.type === 'text' || c?.type === 'forum';
  const save = async () => {
    if (!c) return; setBusy(true);
    const e = await act('channelSave', { serverId: s.id, channelId: c.id, name: name.trim(), ...(text ? { topic: topic.trim(), slow } : {}), cat: cat || null });
    setBusy(false); if (e) Alert.alert('Kaydedilemedi', e); else onClose();
  };
  const del = () => c && Alert.alert('Odayı sil', `#${c.name} ve içindeki tüm mesajlar silinecek. Emin misin?`, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => { const e = await act('deleteChannel', { serverId: s.id, channelId: c.id }); if (e) Alert.alert('Silinemedi', e); else onClose(); } },
  ]);
  return (
    <Sheet open={!!c} onClose={onClose} title={c ? `#${c.name}` : ''}>
      <Field label="Oda adı" value={name} onChangeText={setName} maxLength={30} autoCapitalize="none" />
      {text && <Field label="Konu (oda başlığında görünür)" value={topic} onChangeText={setTopic} maxLength={160} placeholder="Bu oda ne için?" />}
      {text && <View style={{ gap: 8 }}><T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>Yavaş mod</T><Chips value={slow} options={SLOW} onChange={setSlow} /></View>}
      {s.categories.length > 0 && <View style={{ gap: 8 }}><T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>Kategori</T><Chips value={cat} options={[['', 'Yok'], ...s.categories.map(k => [k.id, k.name] as [string, string])]} onChange={setCat} /></View>}
      <Button title="Kaydet" busy={busy} disabled={!name.trim()} onPress={save} />
      <T style={{ fontSize: 12.5, color: C.faint }}>Oda izinleri (kim görür, kim yazar) şimdilik webden ayarlanıyor.</T>
      <Button kind="danger" title="Odayı sil" onPress={del} />
    </Sheet>
  );
}

function AddSheet({ s, open, cat, onClose }: { s: Server; open: boolean; cat: string | null; onClose: () => void }) {
  const [name, setName] = useState(''), [type, setType] = useState('text'), [priv, setPriv] = useState(false), [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true); const e = await act('createChannel', { serverId: s.id, name: name.trim(), type, cat, private: priv }); setBusy(false);
    if (e) return Alert.alert('Oda açılamadı', e);
    setName(''); setPriv(false); setType('text'); onClose();
  };
  const k = cat ? s.categories.find(x => x.id === cat) : null;
  return (
    <Sheet open={open} onClose={onClose} title={k ? `${k.name} içine oda` : 'Yeni oda'}>
      <View style={{ gap: 8 }}><T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>Tür</T><Chips value={type} options={TYPES} onChange={setType} /></View>
      <Field label="Oda adı" value={name} onChangeText={setName} maxLength={30} autoCapitalize="none" placeholder={type === 'voice' ? 'Oyun Odası' : 'genel-sohbet'} />
      <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}><ToggleRow title="Gizli oda" sub="Sadece yöneticiler ve izin verdiğin roller görür" value={priv} onChange={setPriv} last /></View>
      <Button title="Odayı oluştur" busy={busy} disabled={!name.trim()} onPress={create} />
    </Sheet>
  );
}

function CatSheet({ s, cat, onClose }: { s: Server; cat: { id: string | null; name: string } | null; onClose: () => void }) {
  const [name, setName] = useState(''), [key, setKey] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const k = cat ? cat.id || 'yeni' : null;
  if (k !== key) { setKey(k); setName(cat?.name || ''); }
  const save = async () => {
    setBusy(true); const e = await act('catSave', { serverId: s.id, ...(cat?.id ? { catId: cat.id } : {}), name: name.trim() }); setBusy(false);
    if (e) Alert.alert('Kaydedilemedi', e); else onClose();
  };
  const del = () => cat?.id && Alert.alert('Kategoriyi sil', 'İçindeki odalar silinmez, kategorisiz kalır.', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => { const e = await act('catDelete', { serverId: s.id, catId: cat.id }); if (e) Alert.alert('Silinemedi', e); else onClose(); } },
  ]);
  return (
    <Sheet open={!!cat} onClose={onClose} title={cat?.id ? 'Kategoriyi düzenle' : 'Yeni kategori'}>
      <Field label="Kategori adı" value={name} onChangeText={setName} maxLength={30} />
      <Button title={cat?.id ? 'Kaydet' : 'Oluştur'} busy={busy} disabled={!name.trim()} onPress={save} />
      {!!cat?.id && <Pressable accessibilityRole="button" onPress={del} style={{ alignSelf: 'center', padding: 10 }}><T style={{ color: '#f87171', fontFamily: F.heavy }}>Kategoriyi sil</T></Pressable>}
    </Sheet>
  );
}
