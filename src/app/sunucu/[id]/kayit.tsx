import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ask, displayName, useReady } from '@/lib/kanka';
import { fmtAgo } from '@/lib/admin';
import { C, F } from '@/lib/theme';
import { Screen, Empty } from '@/components/AdminUI';
import { T } from '@/components/ui';
import { Avatar } from '@/components/Avatar';

type Ent = { time: number; by: string; action: string; target?: string };

export default function Kayit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ready = useReady();
  const [list, setList] = useState<Ent[] | null>(null);
  useEffect(() => { if (!ready) return; ask<Ent[]>('audit', id).then(r => setList(Array.isArray(r) ? r : [])); }, [id, ready]);
  return (
    <Screen title="Kayıt defteri" sub="Son 100 değişiklik">
      {list === null ? <Empty text="Yükleniyor…" /> : !list.length ? <Empty text="Henüz kayıt yok ya da görme yetkin yok." /> : (
        <View style={{ borderRadius: 16, backgroundColor: C.card, overflow: 'hidden' }}>
          {list.map((e, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, padding: 12, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: C.line }}>
              <Avatar name={e.by} size={34} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={{ fontSize: 14.5, lineHeight: 20 }}><T style={{ fontFamily: F.black, fontSize: 14.5 }}>{displayName(e.by)}</T> {e.action.toLocaleLowerCase('tr')}</T>
                {!!e.target && <T numberOfLines={2} style={{ fontSize: 13, color: C.ink2, marginTop: 1 }}>{e.target}</T>}
                <T style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{fmtAgo(e.time)}</T>
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
