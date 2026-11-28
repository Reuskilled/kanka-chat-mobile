// Arkadaşlar: çevrimiçi / tümü / istekler / ekle (öneriler)
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { dmIdWith, friendAccept, friendRemove, friendRequest, friendSuggest, friendSuggestHide, openDM, openUser, useKanka, useReady, type Suggest } from '@/lib/kanka';
import { T, IconButton, Button } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';
import { Chips } from '@/components/AdminUI';

type Tab = 'cevrimici' | 'tumu' | 'istek' | 'ekle';

function Act({ label, icon, color, onPress }: { label: string; icon: string; color?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, backgroundColor: pressed ? C.hover : C.field, alignItems: 'center', justifyContent: 'center' })}>
      <Icon name={icon} size={18} color={color || C.ink2} stroke={2.4} />
    </Pressable>
  );
}

function Person({ n, sub, children }: { n: string; sub?: string; children?: React.ReactNode }) {
  const u = useKanka(s => s.users[n]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${u?.displayName || n} profili`} onPress={() => openUser(n)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: pressed ? C.hover : 'transparent' })}>
      <Avatar name={n} size={42} status />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T numberOfLines={1} style={{ fontFamily: F.heavy, fontSize: 15 }}>{u?.displayName || n}</T>
        <T numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{sub || u?.status || '@' + n}</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>{children}</View>
    </Pressable>
  );
}

export default function Arkadaslar() {
  const insets = useSafeAreaInsets();
  const p = useLocalSearchParams<{ sekme?: string }>();
  const me = useKanka(s => s.me)!;
  const friends = useKanka(s => s.friends), reqIn = useKanka(s => s.reqIn), reqOut = useKanka(s => s.reqOut);
  const pres = useKanka(s => s.presence), users = useKanka(s => s.users);
  const [tab, setTab] = useState<Tab>((p.sekme as Tab) || (reqIn.length ? 'istek' : 'cevrimici'));
  const [add, setAdd] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [sug, setSug] = useState<Suggest[] | null>(null);
  const ready = useReady();
  useEffect(() => { if (ready && tab === 'ekle' && sug === null) friendSuggest().then(setSug); }, [ready, tab, sug]);
  const on = (n: string) => !!pres[n] && pres[n] !== 'offline';
  const dn = (n: string) => users[n]?.displayName || n;
  const list = useMemo(() => [...friends].filter(n => tab !== 'cevrimici' || on(n)).sort((a, b) => Number(on(b)) - Number(on(a)) || dn(a).localeCompare(dn(b), 'tr')), [friends, tab, pres, users]); // eslint-disable-line react-hooks/exhaustive-deps

  const chat = async (n: string) => { const r = await openDM(n); if (r.error) return Alert.alert('Açılamadı', r.error); router.push({ pathname: '/kanal/[id]', params: { id: r.id || dmIdWith(me, n) } }); };
  const remove = (n: string) => Alert.alert('Arkadaşlıktan çıkar', `${dn(n)} arkadaş listenden çıkarılsın mı?`, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Çıkar', style: 'destructive', onPress: () => friendRemove(n) }]);
  const send = async (name = add) => {
    const n = name.trim().replace(/^@/, ''); if (!n) return;
    setBusy(true); const r = await friendRequest(n); setBusy(false);
    if (r.error) setMsg({ ok: false, t: r.error });
    else { setMsg({ ok: true, t: r.accepted ? `${n} ile artık arkadaşsınız 🎉` : `${n} kişisine istek gönderildi` }); setAdd(''); setSug(s => s?.filter(x => x.name !== n) || s); }
  };

  const reqRows = [...reqIn.map(n => ({ n, in: true })), ...reqOut.map(n => ({ n, in: false }))];
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep, paddingTop: insets.top }}>
      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 }}>
        <IconButton label="Geri" onPress={() => router.back()}><Icon name="back" stroke={2.4} /></IconButton>
        <T accessibilityRole="header" style={{ flex: 1, fontFamily: F.black, fontSize: 18 }}>Arkadaşlar</T>
      </View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
        <Chips value={tab} onChange={setTab} options={[['cevrimici', 'Çevrimiçi'], ['tumu', `Tümü (${friends.length})`], ['istek', `İstekler${reqIn.length ? ` (${reqIn.length})` : ''}`], ['ekle', 'Arkadaş ekle']]} />
      </View>
      {tab === 'ekle' ? (
        <FlatList data={sug || []} keyExtractor={x => x.name} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <View style={{ padding: 14, gap: 10 }}>
              <T style={{ color: C.muted, fontSize: 13.5 }}>Kullanıcı adıyla arkadaş ekleyebilirsin.</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={add} onChangeText={t => { setAdd(t); setMsg(null); }} placeholder="Kullanıcı adı" placeholderTextColor={C.faint} accessibilityLabel="Kullanıcı adı" autoCapitalize="none" autoCorrect={false}
                  onSubmitEditing={() => send()} returnKeyType="send" style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: msg ? (msg.ok ? C.online : C.danger) : C.lineStrong, color: C.ink, paddingHorizontal: 14, fontSize: 15 }} />
                <Button title="Gönder" busy={busy} disabled={!add.trim()} onPress={() => send()} style={{ width: 96 }} />
              </View>
              {!!msg && <T style={{ fontSize: 13, color: msg.ok ? C.online : C.danger }}>{msg.t}</T>}
              {!!sug?.length && <T style={{ marginTop: 10, fontSize: 12, fontFamily: F.black, color: C.muted, letterSpacing: 0.6 }}>TANIYOR OLABİLECEKLERİN</T>}
            </View>
          }
          ListEmptyComponent={sug === null ? <ActivityIndicator color={C.accent} /> : undefined}
          renderItem={({ item }) => (
            <Person n={item.name} sub={item.sohbet ? 'Daha önce konuştunuz' : item.ortakArkadas ? `${item.ortakArkadas} ortak arkadaş` : item.sunucular[0] ? `Ortak sunucu: ${item.sunucular[0].ad}` : undefined}>
              <Act label="Arkadaş ekle" icon="userAdd" color={C.accent} onPress={() => send(item.name)} />
              <Act label="Önerme" icon="close" onPress={() => { friendSuggestHide(item.name); setSug(s => s?.filter(x => x.name !== item.name) || s); }} />
            </Person>
          )} />
      ) : tab === 'istek' ? (
        <FlatList data={reqRows} keyExtractor={x => (x.in ? 'i' : 'o') + x.n} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={<T style={{ color: C.muted, textAlign: 'center', padding: 32 }}>Bekleyen istek yok.</T>}
          renderItem={({ item }) => (
            <Person n={item.n} sub={item.in ? 'Sana arkadaşlık isteği gönderdi' : 'İstek gönderildi'}>
              {item.in && <Act label="Kabul et" icon="check" color={C.online} onPress={async () => { const e = await friendAccept(item.n); if (e) Alert.alert('Olmadı', e); }} />}
              <Act label={item.in ? 'Reddet' : 'İsteği geri çek'} icon="close" color={C.danger} onPress={() => friendRemove(item.n)} />
            </Person>
          )} />
      ) : (
        <FlatList data={list} keyExtractor={n => n} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={<View style={{ padding: 32, gap: 12, alignItems: 'center' }}><T style={{ color: C.muted, textAlign: 'center' }}>{tab === 'cevrimici' ? 'Şu an çevrimiçi arkadaşın yok.' : 'Henüz arkadaşın yok.'}</T><Button title="Arkadaş ekle" kind="ghost" onPress={() => setTab('ekle')} /></View>}
          renderItem={({ item }) => (
            <Person n={item}>
              <Act label="Mesaj gönder" icon="chat" onPress={() => chat(item)} />
              <Act label="Arkadaşlıktan çıkar" icon="trash" onPress={() => remove(item)} />
            </Person>
          )} />
      )}
    </View>
  );
}
