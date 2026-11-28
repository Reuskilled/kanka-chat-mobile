import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { useKanka, dmPeers } from '@/lib/kanka';
import type { Dm } from '@/lib/types';
import { T, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';
import { when } from '@/lib/time';

function DmRow({ d }: { d: Dm }) {
  const me = useKanka(s => s.me)!;
  const users = useKanka(s => s.users);
  const pres = useKanka(s => s.presence);
  const last = useKanka(s => s.lastMsg[d.id] || d.last || 0);
  const group = !d.with;
  const other = d.with || dmPeers(d.id).find(n => n !== me) || '';
  const u = users[other];
  const act = !group && u?.activities?.[0];
  const off = !group && (!pres[other] || pres[other] === 'offline');
  const title = group ? d.name || (d.members || []).filter(n => n !== me).join(', ') : u?.displayName || other;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title} ile sohbet`} onPress={() => router.push({ pathname: '/kanal/[id]', params: { id: d.id } })}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: pressed ? C.hover : 'transparent', opacity: off ? 0.6 : 1 })}>
      {group ? (
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#475569', alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={22} /></View>
      ) : <Avatar name={other} size={48} status />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.heavy, fontSize: 15.5 }}>{title}</T>
          <T style={{ marginLeft: 'auto', fontSize: 12, color: C.faint, fontFamily: F.bold }}>{last ? when(last) : ''}</T>
        </View>
        {act ? <T numberOfLines={1} style={{ fontSize: 12.5, color: C.online, fontFamily: F.bold }}>{act.name}{act.detail ? ' · ' + act.detail : ''}</T>
          : u?.status ? <T numberOfLines={1} style={{ fontSize: 13, color: C.muted }}>{u.status}</T>
          : group ? <T style={{ fontSize: 13, color: C.muted }}>{(d.members || []).length} kişi</T> : null}
      </View>
    </Pressable>
  );
}

export default function Mesajlar() {
  const insets = useSafeAreaInsets();
  const dms = useKanka(s => s.dms);
  const friends = useKanka(s => s.friends);
  const pres = useKanka(s => s.presence);
  const users = useKanka(s => s.users);
  const lastMsg = useKanka(s => s.lastMsg);
  const me = useKanka(s => s.me);
  const reqIn = useKanka(s => s.reqIn.length);
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const qq = q.trim().toLocaleLowerCase('tr');
    return [...dms]
      .filter(d => !qq || (d.with || d.name || '').toLocaleLowerCase('tr').includes(qq) || (users[d.with || '']?.displayName || '').toLocaleLowerCase('tr').includes(qq))
      .sort((a, b) => (lastMsg[b.id] || b.last || 0) - (lastMsg[a.id] || a.last || 0));
  }, [dms, q, lastMsg, users]);
  const onlineFriends = friends.filter(f => pres[f] && pres[f] !== 'offline').slice(0, 20);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 }}>
        <T accessibilityRole="header" style={{ flex: 1, fontFamily: F.black, fontSize: 26 }}>Mesajlar</T>
        <View>
          <IconButton label={reqIn ? `Arkadaşlar, ${reqIn} yeni istek` : 'Arkadaşlar'} bg={C.field} onPress={() => router.push('/arkadaslar' as any)}><Icon name="userAdd" size={20} /></IconButton>
          {reqIn > 0 && <View pointerEvents="none" style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 10.5, fontFamily: F.black, color: '#fff' }}>{reqIn}</T></View>}
        </View>
        <IconButton label="Yeni mesaj" bg={C.accent} onPress={() => router.push('/yeni-mesaj' as any)}><Icon name="pen" size={20} color={C.onAccent} stroke={2.4} /></IconButton>
      </View>
      <View style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
        <View style={{ height: 42, borderRadius: 12, backgroundColor: C.field, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
          <Icon name="search" size={17} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Kişi ya da sohbet ara" placeholderTextColor={C.faint} accessibilityLabel="Sohbet ara"
            style={{ flex: 1, color: C.ink, fontFamily: F.regular, fontSize: 14.5 }} />
        </View>
      </View>
      {onlineFriends.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: C.line }} contentContainerStyle={{ gap: 14, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4 }}>
          {onlineFriends.map(f => (
            <Pressable key={f} accessibilityRole="button" accessibilityLabel={`${users[f]?.displayName || f} ile sohbet`} onPress={() => me && router.push({ pathname: '/kanal/[id]', params: { id: 'dm:' + [me, f].sort().join('|') } })} style={{ width: 58, alignItems: 'center', gap: 5 }}>
              <Avatar name={f} size={56} status />
              <T numberOfLines={1} style={{ fontSize: 12, fontFamily: F.bold }}>{users[f]?.displayName || f}</T>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <FlatList
        data={list}
        keyExtractor={d => d.id}
        renderItem={({ item }) => <DmRow d={item} />}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
        ListEmptyComponent={<T style={{ color: C.muted, textAlign: 'center', padding: 32 }}>Henüz bir sohbetin yok.</T>}
      />
    </View>
  );
}
