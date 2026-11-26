import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { ask, fire, useKanka } from '@/lib/kanka';
import { when } from '@/lib/time';
import { T } from '@/components/ui';
import { Avatar } from '@/components/Avatar';

type Entry = { id: string; t: string; from: string; text: string; ch?: string | null; sid?: string | null; mid?: string | null; at: number; seen?: boolean };

export default function Bildirimler() {
  const insets = useSafeAreaInsets();
  const users = useKanka(s => s.users);
  const [list, setList] = useState<Entry[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const r = await ask<{ list?: Entry[] }>('inbox', null);
    setBusy(false);
    setList((r?.list || []).sort((a, b) => b.at - a.at));
    fire('inboxSeen');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 26, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 }}>Bildirimler</T>
      <FlatList
        data={list || []}
        keyExtractor={e => e.id}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.accent} colors={[C.accent]} />}
        renderItem={({ item: e }) => (
          <Pressable accessibilityRole="button" onPress={() => e.ch && router.push({ pathname: '/kanal/[id]', params: { id: e.ch } })}
            style={({ pressed }) => ({ flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: pressed ? C.hover : e.seen ? 'transparent' : 'rgba(212,255,0,0.05)' })}>
            <Avatar name={e.from} size={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={{ fontSize: 14.5, lineHeight: 20 }} numberOfLines={3}>
                <T style={{ fontSize: 14.5, fontFamily: F.black }}>{users[e.from]?.displayName || e.from}</T> {e.text}
              </T>
              <T style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{when(e.at)}</T>
            </View>
            {!e.seen && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent, marginTop: 6 }} />}
          </Pressable>
        )}
        ListEmptyComponent={list ? <T style={{ color: C.muted, textAlign: 'center', padding: 32 }}>Yeni bildirimin yok.</T> : undefined}
      />
    </View>
  );
}
