import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useIncomingShare } from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Att, setPendingShare, useKanka } from '@/lib/kanka';
import { C, F } from '@/lib/theme';
import { T, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';

type Target = { id: string; label: string; sub: string; dm?: string | null; group?: boolean };

// Başka uygulamadan "Kanka'ya paylaş": sohbeti seç, paylaşılan şey yazma kutusuna düşsün
export default function Paylas() {
  if (Platform.OS === 'web') return <View style={{ flex: 1, backgroundColor: C.bgDeep, alignItems: 'center', justifyContent: 'center' }}><T style={{ color: C.muted }}>Paylaşım sadece telefonda çalışır.</T></View>;
  return <PaylasInner />;
}

function PaylasInner() {
  const insets = useSafeAreaInsets();
  const { resolvedSharedPayloads: items, isResolving, clearSharedPayloads } = useIncomingShare();
  const dms = useKanka(s => s.dms), servers = useKanka(s => s.servers), users = useKanka(s => s.users), me = useKanka(s => s.me), lastMsg = useKanka(s => s.lastMsg);
  const [q, setQ] = useState('');

  const text = items.filter(p => p.contentType === 'text' || p.contentType === 'website' || p.shareType === 'text' || p.shareType === 'url').map(p => p.value).join('\n').slice(0, 2000);
  const atts: Att[] = items.filter(p => p.contentUri && p.contentType && !['text', 'website'].includes(p.contentType))
    .slice(0, 10).map((p, i) => ({ uri: p.contentUri!, name: p.originalName || `paylasim-${i + 1}`, type: p.contentMimeType || p.mimeType || 'application/octet-stream', size: p.contentSize ?? undefined }));
  const imgs = atts.filter(a => a.type.startsWith('image/'));

  const all = useMemo<Target[]>(() => {
    const out: Target[] = [...dms].sort((a, b) => (lastMsg[b.id] || b.last || 0) - (lastMsg[a.id] || a.last || 0)).map(d => ({
      id: d.id, dm: d.with || null, group: !d.with,
      label: d.with ? users[d.with]?.displayName || d.with : d.name || (d.members || []).filter(n => n !== me).join(', '),
      sub: d.with ? 'Özel mesaj' : 'Grup',
    }));
    for (const s of servers) for (const c of s.channels) if ((c.type || 'text') === 'text') out.push({ id: c.id, label: '#' + c.name, sub: s.name });
    return out;
  }, [dms, servers, users, me, lastMsg]);
  const k = q.trim().toLocaleLowerCase('tr');
  const list = all.filter(x => !k || x.label.toLocaleLowerCase('tr').includes(k) || x.sub.toLocaleLowerCase('tr').includes(k)).slice(0, 80);

  const pick = (t: Target) => {
    setPendingShare({ chId: t.id, text, atts });
    clearSharedPayloads();
    router.replace({ pathname: '/kanal/[id]', params: { id: t.id } });
  };
  const cancel = () => { clearSharedPayloads(); router.replace('/'); };
  const nothing = !isResolving && !text && !atts.length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep, paddingTop: insets.top }}>
      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <IconButton label="Vazgeç" onPress={cancel}><Icon name="close" stroke={2.4} /></IconButton>
        <T accessibilityRole="header" style={{ flex: 1, fontFamily: F.black, fontSize: 18 }}>Kanka&apos;ya paylaş</T>
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        {isResolving ? <ActivityIndicator color={C.accent} /> : nothing ? <T style={{ color: C.muted }}>Paylaşılacak bir şey gelmedi.</T> : (
          <View style={{ borderRadius: 14, backgroundColor: C.card, padding: 12, gap: 8 }}>
            {imgs.length > 0 && <View style={{ flexDirection: 'row', gap: 6 }}>{imgs.slice(0, 4).map(a => <Image key={a.uri} source={{ uri: a.uri }} style={{ width: 64, height: 64, borderRadius: 10 }} contentFit="cover" />)}</View>}
            {atts.length > imgs.length && <T style={{ color: C.muted, fontSize: 13 }}>{atts.filter(a => !a.type.startsWith('image/')).map(a => a.name).join(', ')}</T>}
            {!!text && <T numberOfLines={4} style={{ fontSize: 14 }}>{text}</T>}
          </View>
        )}
        <TextInput value={q} onChangeText={setQ} placeholder="Sohbet ya da oda ara" placeholderTextColor={C.faint} accessibilityLabel="Ara"
          style={{ height: 46, borderRadius: 12, backgroundColor: C.field, color: C.ink, paddingHorizontal: 14, fontFamily: F.regular, fontSize: 15 }} />
      </View>
      <FlatList data={nothing ? [] : list} keyExtractor={t => t.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        renderItem={({ item: t }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`${t.label}, ${t.sub}`} onPress={() => pick(t)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: pressed ? C.hover : 'transparent' })}>
            {t.dm ? <Avatar name={t.dm} size={40} /> : (
              <View style={{ width: 40, height: 40, borderRadius: t.group ? 20 : 12, backgroundColor: C.field, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={t.group ? 'users' : 'hash'} size={18} color={C.muted} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <T numberOfLines={1} style={{ fontFamily: F.heavy }}>{t.label}</T>
              <T numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{t.sub}</T>
            </View>
            <Icon name="send" size={18} color={C.accent} />
          </Pressable>
        )} />
    </View>
  );
}
