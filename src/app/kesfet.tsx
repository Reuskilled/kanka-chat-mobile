// Sunucu keşfet: herkese açık / keşfete açılmış sunucular, arama ve kategori
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { discover, joinInvite, selectServer, useReady, type DiscoverItem } from '@/lib/kanka';
import { T, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';

function Card({ s, onJoin, busy }: { s: DiscoverItem; onJoin: () => void; busy: boolean }) {
  const img = abs(s.iconImg), banner = abs(s.banner);
  return (
    <View style={{ borderRadius: 16, backgroundColor: C.card, overflow: 'hidden' }}>
      <View style={{ height: 64, backgroundColor: s.bannerColor || C.field }}>{banner && <Image source={{ uri: banner }} style={{ flex: 1 }} contentFit="cover" />}</View>
      <View style={{ padding: 14, paddingTop: 0, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <View style={{ marginTop: -24, width: 52, height: 52, borderRadius: 16, borderWidth: 4, borderColor: C.card, backgroundColor: C.field, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {img ? <Image source={{ uri: img }} style={{ width: 52, height: 52 }} /> : <T style={{ fontFamily: F.black }}>{(s.icon || s.name.slice(0, 2)).slice(0, 3)}</T>}
          </View>
          {!!s.category && <T style={{ marginLeft: 'auto', fontSize: 12, color: C.muted, fontFamily: F.heavy }}>{s.category}</T>}
        </View>
        <T numberOfLines={1} style={{ fontFamily: F.black, fontSize: 17 }}>{s.name}</T>
        {!!s.description && <T numberOfLines={3} style={{ color: C.ink2, fontSize: 13.5 }}>{s.description}</T>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <T style={{ fontSize: 12.5, color: C.muted }}><T style={{ color: C.online, fontSize: 12.5 }}>●</T> {s.online} çevrimiçi</T>
          <T style={{ fontSize: 12.5, color: C.muted }}>{s.members} üye</T>
          <Pressable accessibilityRole="button" accessibilityLabel={s.joined ? `${s.name} sunucusuna git` : `${s.name} sunucusuna katıl`} onPress={onJoin} disabled={busy}
            style={({ pressed }) => ({ marginLeft: 'auto', height: 36, paddingHorizontal: 16, borderRadius: 10, backgroundColor: s.joined ? C.field : C.accent, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
            {busy ? <ActivityIndicator size="small" color={s.joined ? C.ink : C.onAccent} /> : <T style={{ fontFamily: F.black, fontSize: 14, color: s.joined ? C.ink : C.onAccent }}>{s.joined ? 'Git' : 'Katıl'}</T>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function Kesfet() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState(''), [cat, setCat] = useState('');
  const [list, setList] = useState<DiscoverItem[] | null>(null), [cats, setCats] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const seq = useRef(0);
  const ready = useReady();
  useEffect(() => {
    if (!ready) return;
    const my = ++seq.current;
    const t = setTimeout(async () => { const r = await discover(q.trim(), cat); if (my !== seq.current) return; setList(r.list); if (r.cats.length) setCats(r.cats); }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, cat, ready]);
  const go = async (s: DiscoverItem) => {
    if (!s.joined) {
      setBusy(s.id); const r = await joinInvite(s.invite); setBusy(null);
      if (r.error) return Alert.alert('Katılamadın', r.error);
    }
    selectServer(s.id); router.dismissTo('/');
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep, paddingTop: insets.top }}>
      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 }}>
        <IconButton label="Geri" onPress={() => router.back()}><Icon name="back" stroke={2.4} /></IconButton>
        <T accessibilityRole="header" style={{ flex: 1, fontFamily: F.black, fontSize: 18 }}>Sunucu keşfet</T>
      </View>
      <View style={{ paddingHorizontal: 14, gap: 10, paddingBottom: 8 }}>
        <View style={{ height: 44, borderRadius: 12, backgroundColor: C.field, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
          <Icon name="search" size={17} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Sunucu ara" placeholderTextColor={C.faint} accessibilityLabel="Sunucu ara" style={{ flex: 1, color: C.ink, fontSize: 15 }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {['', ...cats].map(c => (
            <Pressable key={c || 'hepsi'} accessibilityRole="radio" accessibilityState={{ selected: cat === c }} onPress={() => setCat(c)}
              style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: cat === c ? C.accent : C.field, justifyContent: 'center' }}>
              <T style={{ fontFamily: F.heavy, fontSize: 13.5, color: cat === c ? C.onAccent : C.ink2 }}>{c || 'Hepsi'}</T>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {list === null ? <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} /> : (
        <FlatList data={list} keyExtractor={s => s.id} contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={<T style={{ color: C.muted, textAlign: 'center', padding: 24 }}>Sonuç yok</T>}
          renderItem={({ item }) => <Card s={item} busy={busy === item.id} onJoin={() => go(item)} />} />
      )}
    </View>
  );
}
