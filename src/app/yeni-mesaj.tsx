// Yeni mesaj: bir arkadaş seç → DM; birden fazla seç → grup sohbeti (en çok 9 kişi + sen)
// Grup düzenleme de burada: ?grup=g:… ile açılınca seçilenler gruba eklenir
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { createGroup, groupUpdate, openDM, useKanka } from '@/lib/kanka';
import { T, IconButton, Button } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';

export default function YeniMesaj() {
  const insets = useSafeAreaInsets();
  const { grup } = useLocalSearchParams<{ grup?: string }>();
  const friends = useKanka(s => s.friends), users = useKanka(s => s.users), pres = useKanka(s => s.presence);
  const g = useKanka(s => (grup ? s.dms.find(d => d.id === grup) : undefined));
  const inGroup = useMemo(() => new Set(g?.members || []), [g]);
  const room = grup ? 10 - inGroup.size : 9;
  const [q, setQ] = useState(''), [sel, setSel] = useState<string[]>([]), [name, setName] = useState(''), [busy, setBusy] = useState(false);
  const dn = (n: string) => users[n]?.displayName || n;
  const list = useMemo(() => {
    const k = q.trim().toLocaleLowerCase('tr');
    return friends.filter(n => !inGroup.has(n)).filter(n => !k || n.toLocaleLowerCase('tr').includes(k) || dn(n).toLocaleLowerCase('tr').includes(k))
      .sort((a, b) => Number(!!pres[b] && pres[b] !== 'offline') - Number(!!pres[a] && pres[a] !== 'offline') || dn(a).localeCompare(dn(b), 'tr'));
  }, [friends, q, users, pres, inGroup]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (n: string) => setSel(s => (s.includes(n) ? s.filter(x => x !== n) : s.length >= room ? s : [...s, n]));

  const go = async () => {
    if (!sel.length) return;
    setBusy(true);
    if (grup) {
      const e = await groupUpdate(grup, { add: sel }); setBusy(false);
      if (e) return Alert.alert('Eklenemedi', e);
      return router.back();
    }
    if (sel.length === 1) {
      const r = await openDM(sel[0]); setBusy(false);
      if (r.error) return Alert.alert('Açılamadı', r.error);
      return router.replace({ pathname: '/kanal/[id]', params: { id: r.id! } });
    }
    const r = await createGroup(sel, name.trim() || undefined); setBusy(false);
    if (r.error) return Alert.alert('Grup açılamadı', r.error);
    router.replace({ pathname: '/kanal/[id]', params: { id: r.id! } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep, paddingTop: insets.top }}>
      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 }}>
        <IconButton label="Geri" onPress={() => router.back()}><Icon name="back" stroke={2.4} /></IconButton>
        <View style={{ flex: 1 }}>
          <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 18 }}>{grup ? 'Gruba ekle' : 'Yeni mesaj'}</T>
          <T style={{ fontSize: 12.5, color: C.muted }}>{grup ? `${room} kişi daha eklenebilir` : 'Bir kişi seç ya da grup için birkaç kişi'}</T>
        </View>
      </View>
      <View style={{ paddingHorizontal: 14, gap: 10, paddingBottom: 8 }}>
        <View style={{ minHeight: 46, borderRadius: 12, backgroundColor: C.field, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: 6, paddingLeft: 12 }}>
          {sel.map(n => (
            <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${dn(n)} seçimini kaldır`} onPress={() => toggle(n)} style={{ height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: C.accentSoft, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <T style={{ fontSize: 13, fontFamily: F.heavy, color: C.accent }}>{dn(n)}</T><Icon name="close" size={12} color={C.accent} stroke={3} />
            </Pressable>
          ))}
          <TextInput value={q} onChangeText={setQ} placeholder={sel.length ? '' : 'Arkadaş ara'} placeholderTextColor={C.faint} accessibilityLabel="Arkadaş ara" autoCapitalize="none" style={{ flex: 1, minWidth: 90, height: 34, color: C.ink, fontSize: 15 }} />
        </View>
        {!grup && sel.length > 1 && (
          <TextInput value={name} onChangeText={setName} placeholder="Grup adı (isteğe bağlı)" placeholderTextColor={C.faint} accessibilityLabel="Grup adı" maxLength={40}
            style={{ height: 46, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong, color: C.ink, paddingHorizontal: 14, fontSize: 15 }} />
        )}
      </View>
      <FlatList data={list} keyExtractor={n => n} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<T style={{ color: C.muted, textAlign: 'center', padding: 32 }}>{friends.length ? 'Kimse bulunamadı' : 'Mesaj atmak için önce arkadaş ekle.'}</T>}
        renderItem={({ item }) => {
          const on = sel.includes(item);
          return (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={dn(item)} onPress={() => toggle(item)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: pressed ? C.hover : 'transparent' })}>
              <Avatar name={item} size={40} status />
              <View style={{ flex: 1, minWidth: 0 }}><T numberOfLines={1} style={{ fontFamily: F.heavy }}>{dn(item)}</T><T style={{ fontSize: 12.5, color: C.muted }}>@{item}</T></View>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? C.accent : C.lineStrong, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {on && <Icon name="check" size={14} color={C.onAccent} stroke={3.2} />}
              </View>
            </Pressable>
          );
        }} />
      {sel.length > 0 && (
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: insets.bottom + 14 }}>
          <Button title={grup ? `Ekle (${sel.length})` : sel.length === 1 ? 'Mesaj gönder' : `Grup oluştur (${sel.length + 1} kişi)`} busy={busy} onPress={go} />
        </View>
      )}
    </View>
  );
}
