import { useMemo, useState, useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { useKanka } from '@/lib/kanka';
import { getItem, setItem } from '@/lib/storage';
import type { Channel, Server } from '@/lib/types';
import { T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';

function ServerIcon({ s, active, onPress }: { s: Server; active: boolean; onPress: () => void }) {
  const img = abs(s.iconImg);
  return (
    <View style={{ width: 72, alignItems: 'center' }}>
      {active && <View style={{ position: 'absolute', left: 0, top: 10, width: 4, height: 28, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: C.ink }} />}
      <Pressable accessibilityRole="button" accessibilityLabel={s.name} accessibilityState={{ selected: active }} onPress={onPress}
        style={{ width: 48, height: 48, borderRadius: active ? 16 : 24, backgroundColor: C.field, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {img ? <Image source={{ uri: img }} style={{ width: 48, height: 48 }} contentFit="cover" /> :
          <T style={{ fontFamily: F.black, fontSize: 16, color: active ? C.accent : C.ink2 }}>{(s.icon || s.name.slice(0, 2)).slice(0, 3)}</T>}
      </Pressable>
    </View>
  );
}

function ChannelRow({ c, active, voiceUsers }: { c: Channel; active?: boolean; voiceUsers?: string[] }) {
  const voice = c.type === 'voice' || c.type === 'stage';
  const n = voiceUsers?.length || 0;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={(voice ? 'Sesli oda ' : 'Kanal ') + c.name}
        onPress={() => (voice ? null : router.push({ pathname: '/kanal/[id]', params: { id: c.id } }))}
        style={({ pressed }) => ({ height: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 10, backgroundColor: active ? C.accentSoft : pressed ? C.hover : 'transparent' })}
      >
        {voice ? <Icon name="speaker" size={17} color={n ? C.online : C.faint} /> : c.private || c.locked ? <Icon name="lock" size={16} color={C.faint} /> : <T style={{ fontSize: 19, color: C.faint, width: 16, textAlign: 'center' }}>#</T>}
        <T numberOfLines={1} style={{ flex: 1, fontFamily: n ? F.heavy : F.bold, fontSize: 15, color: n ? C.ink : C.muted }}>{c.name}</T>
        {n > 0 && <T style={{ fontSize: 12, color: C.online, fontFamily: F.heavy }}>{n} kişi</T>}
      </Pressable>
      {n > 0 && (
        <View style={{ flexDirection: 'row', gap: 4, paddingLeft: 36, paddingBottom: 6 }}>
          {voiceUsers!.slice(0, 8).map(u => <Avatar key={u} name={u} size={26} />)}
        </View>
      )}
    </View>
  );
}

export default function Sunucular() {
  const insets = useSafeAreaInsets();
  const servers = useKanka(s => s.servers);
  const voice = useKanka(s => s.voice);
  const presence = useKanka(s => s.presence);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { getItem('kanka-son-sunucu').then(v => v && setSel(v)); }, []);
  const server = servers.find(s => s.id === sel) || servers[0];
  const pick = (id: string) => { setSel(id); setItem('kanka-son-sunucu', id); };

  const groups = useMemo(() => {
    if (!server) return [];
    const out: { id: string; name: string; list: Channel[] }[] = [];
    const none = server.channels.filter(c => !c.cat || !server.categories.some(k => k.id === c.cat));
    if (none.length) out.push({ id: '_', name: '', list: none });
    for (const k of server.categories) { const list = server.channels.filter(c => c.cat === k.id); if (list.length) out.push({ id: k.id, name: k.name, list }); }
    return out;
  }, [server]);
  const online = server ? server.members.filter(m => presence[m] && presence[m] !== 'offline').length : 0;
  const banner = abs(server?.banner);

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bgDeep, paddingTop: insets.top }}>
      <ScrollView accessibilityLabel="Sunucular" style={{ width: 72, flexGrow: 0 }} contentContainerStyle={{ gap: 10, paddingVertical: 14, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mesajlar" onPress={() => router.navigate('/mesajlar')} style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ color: C.onAccent, fontFamily: F.black, fontSize: 22 }}>K</T>
        </Pressable>
        <View style={{ width: 32, height: 2, borderRadius: 2, backgroundColor: C.lineStrong }} />
        {servers.map(s => <ServerIcon key={s.id} s={s} active={s.id === server?.id} onPress={() => pick(s.id)} />)}
      </ScrollView>
      <View style={{ flex: 1, backgroundColor: C.panel, borderTopLeftRadius: 18, overflow: 'hidden' }}>
        {!server ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }}>
            <T style={{ fontFamily: F.black, fontSize: 18 }}>Henüz bir sunucun yok</T>
            <T style={{ color: C.muted, textAlign: 'center' }}>Bir davet linkiyle katıl ya da webden kendi sunucunu kur.</T>
          </View>
        ) : (
          <>
            <View style={{ height: 120, justifyContent: 'flex-end', padding: 16, backgroundColor: server.bannerColor || '#1c1410' }}>
              {banner && <Image source={{ uri: banner }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" />}
              <LinearGradient colors={banner ? ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.8)'] : ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.35)']} style={{ position: 'absolute', inset: 0 }} />
              <T accessibilityRole="header" numberOfLines={1} style={{ fontFamily: F.black, fontSize: 19 }}>{server.name}</T>
              <T style={{ fontSize: 12.5, color: '#d4d4d8', marginTop: 2 }}>{server.members.length} üye · {online} çevrimiçi</T>
            </View>
            <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: 24 }}>
              {groups.map(g => (
                <View key={g.id}>
                  {!!g.name && <T style={{ fontSize: 11.5, fontFamily: F.black, color: C.muted, letterSpacing: 0.7, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 4 }}>{g.name.toLocaleUpperCase('tr')}</T>}
                  {g.list.map(c => <ChannelRow key={c.id} c={c} voiceUsers={voice[c.id]} />)}
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}
