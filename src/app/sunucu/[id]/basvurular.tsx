// Katılım başvuruları: onaylı katılım açıkken yeni gelenler burada bekler
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ask, useKanka, useReady } from '@/lib/kanka';
import { act, fmtAgo } from '@/lib/admin';
import { C, F } from '@/lib/theme';
import { Screen, Sheet, Empty } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';
import { Avatar } from '@/components/Avatar';

type App = { name: string; at: number; q?: string[]; a?: string[]; via?: string | null; createdAt?: number | null; email?: boolean; tfa?: boolean };
const age = (t?: number | null) => { if (!t) return 'bilinmiyor'; const d = Math.floor((Date.now() - t) / 864e5); return d < 1 ? 'bugün açılmış hesap' : `${d} günlük hesap`; };

export default function Basvurular() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ready = useReady();
  const users = useKanka(s => s.users);
  const apply = useKanka(s => s.servers.find(x => x.id === id)?.gate?.approval);
  const [list, setList] = useState<App[] | null>(null), [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null), [no, setNo] = useState<string | null>(null), [note, setNote] = useState('');
  const load = useCallback(() => { ask<{ error?: string; list?: App[] }>('joinApps', id).then(r => (r?.error ? setErr(r.error) : setList(r?.list || []))); }, [id]);
  useEffect(() => { if (ready) load(); }, [ready, load]);
  const decide = async (name: string, ok: boolean, n?: string) => {
    setBusy(name); const e = await act('joinDecide', { serverId: id, name, ok, note: n }); setBusy(null);
    if (e) Alert.alert('Olmadı', e); setNo(null); setNote(''); load();
  };
  return (
    <Screen title="Başvurular" sub="Onaylanan kişi yazmaya başlar, reddedilen sunucudan çıkarılır">
      {!apply && <T style={{ fontSize: 13, color: C.muted }}>Onaylı katılım kapalı. Açmak için Katılım güvenliği sayfasına bak.</T>}
      {!list ? (err ? <Empty text={err} /> : <ActivityIndicator color={C.accent} style={{ marginTop: 30 }} />) : !list.length ? <Empty text="Bekleyen başvuru yok. Biri başvurunca burada görünür." /> : list.map(a => (
        <View key={a.name} style={{ padding: 14, borderRadius: 16, backgroundColor: C.card, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Avatar name={a.name} size={40} />
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: F.black }}>{users[a.name]?.displayName || a.name}</T>
              <T style={{ fontSize: 12.5, color: C.muted }}>@{a.name} · {age(a.createdAt)}{a.email ? ' · e-posta var' : ''}{a.tfa ? ' · 2FA açık' : ''} · {fmtAgo(a.at)}</T>
            </View>
          </View>
          {(a.q || []).map((q, i) => (
            <View key={i} style={{ gap: 2 }}><T style={{ fontSize: 12.5, color: C.muted, fontFamily: F.heavy }}>{q}</T><T>{a.a?.[i] || '—'}</T></View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Onayla" busy={busy === a.name} onPress={() => decide(a.name, true)} style={{ flex: 1, height: 42 }} />
            <Button title="Reddet" kind="danger" onPress={() => setNo(a.name)} style={{ flex: 1, height: 42 }} />
          </View>
        </View>
      ))}
      <Sheet open={!!no} onClose={() => setNo(null)} title="Başvuruyu reddet">
        <T style={{ color: C.muted }}>Sebep yazarsan kişiye gösterilir (isteğe bağlı).</T>
        <TextInput value={note} onChangeText={v => setNote(v.slice(0, 200))} placeholder="Örn. Şu an yeni üye almıyoruz" placeholderTextColor={C.faint} accessibilityLabel="Reddetme sebebi"
          style={{ minHeight: 46, borderRadius: 12, backgroundColor: C.field, color: C.ink, paddingHorizontal: 14, fontFamily: F.regular, fontSize: 15 }} />
        <Button title="Reddet ve çıkar" kind="danger" busy={!!no && busy === no} onPress={() => no && decide(no, false, note.trim())} />
      </Sheet>
    </Screen>
  );
}
