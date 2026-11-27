import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useKanka } from '@/lib/kanka';
import type { Channel } from '@/lib/types';
import { C, F } from '@/lib/theme';
import { Screen, Row, Empty } from '@/components/AdminUI';
import { T, Button, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { AddSheet, CatSheet, ChannelSheet, moveIn, typeIcon } from '@/components/ChannelAdmin';

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

