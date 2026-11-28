// Başlangıç rehberi: yeni üyeye 5 adım (bitince +100 XP ve Çaylak rozeti, ödülü sunucu verir)
import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';
import { router } from 'expo-router';
import { onbMarkInvite, onbSet, useKanka } from '@/lib/kanka';
import { inviteUrl } from '@/lib/admin';
import { C, F } from '@/lib/theme';
import { getItem, setItem } from '@/lib/storage';
import { T } from './ui';
import { Icon } from './Icon';

const STEPS = [
  { k: 'join', icon: 'search', t: 'Sunucuya katıl', d: 'Keşfet’ten bul ya da kendin kur' },
  { k: 'msg', icon: 'chat', t: 'İlk mesajını at', d: 'Bir odaya selam yaz' },
  { k: 'voice', icon: 'speaker', t: 'Sesli odaya gir', d: 'Arkadaşlarınla konuş' },
  { k: 'invite', icon: 'userAdd', t: 'Arkadaşını davet et', d: 'Davet linkini paylaş' },
  { k: 'profile', icon: 'pen', t: 'Profilini tamamla', d: 'Durum ya da hakkımda ekle' },
] as const;

export function OnbCard({ serverId }: { serverId?: string }) {
  const onb = useKanka(s => s.acct.onb);
  const joined = useKanka(s => s.servers.some(x => x.id !== 's1' && !x.public));
  const prof = useKanka(s => { const u = s.users[s.me || '']; return !!(u?.bio || u?.status); });
  const srv = useKanka(s => s.servers.find(x => x.id === serverId) || null);
  const [open, setOpen] = useState(true);
  useEffect(() => { getItem('kanka-onb-kapali').then(v => v === '1' && setOpen(false)); }, []);
  if (!onb || onb.done || onb.dismissed) return null;
  const st: Record<string, boolean> = { join: joined, msg: !!onb.msg, voice: !!onb.voice, invite: !!onb.invite, profile: !!onb.profile || prof };
  const n = STEPS.filter(x => st[x.k]).length, left = STEPS.length - n;
  if (!left && onb.rewarded) return (
    <Pressable onPress={() => onbSet('done')} style={{ margin: 6, marginBottom: 8, padding: 14, borderRadius: 16, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accent, gap: 2 }}>
      <T style={{ fontFamily: F.black, fontSize: 15 }}>🐣 Hepsi tamam!</T>
      <T style={{ fontSize: 13, color: C.muted }}>+100 XP ve Çaylak rozeti senin. Kapatmak için dokun.</T>
    </Pressable>
  );
  const go = async (k: string) => {
    if (k === 'join') router.push('/kesfet' as any);
    else if (k === 'profile') router.push('/profil-duzenle' as any);
    else if (k === 'invite') {
      if (!srv || srv.public) return router.push('/davet-kodlari' as any);
      try { const r = await Share.share({ message: `${srv.name} sunucusuna gel: ${inviteUrl(srv)}` }); if (r.action !== Share.dismissedAction) onbMarkInvite(srv.id); } catch {}
    } else if (k === 'msg') Alert.alert('İlk mesajın', 'Soldan bir yazı odası seç ve selam yaz 👋');
    else Alert.alert('Sesli oda', 'Listeden 🔊 simgeli bir odaya dokun, hemen bağlanırsın.');
  };
  const hide = () => Alert.alert('Rehberi gizle', 'Başlangıç rehberi gizlensin mi?', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Gizle', onPress: () => onbSet('dismissed') }]);
  const toggle = () => { setOpen(!open); setItem('kanka-onb-kapali', open ? '1' : null); };
  return (
    <View style={{ margin: 6, marginBottom: 8, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(212,255,0,0.24)', overflow: 'hidden' }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: C.accent, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontFamily: F.black, fontSize: 12 }}>{n}/{STEPS.length}</T></View>
        <View style={{ flex: 1 }}>
          <T style={{ fontFamily: F.black }}>Kanka’ya başla</T>
          <T style={{ fontSize: 12.5, color: C.muted }}>{left} adım · <T style={{ fontSize: 12.5, color: C.accent, fontFamily: F.heavy }}>🎁 +100 XP</T></T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Rehberi gizle" hitSlop={8} onPress={hide}><Icon name="close" size={18} color={C.faint} /></Pressable>
      </Pressable>
      {open && STEPS.map(x => (
        <Pressable key={x.k} accessibilityRole="button" accessibilityState={{ checked: st[x.k] }} disabled={st[x.k]} onPress={() => go(x.k)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: pressed ? C.hover : 'transparent', opacity: st[x.k] ? 0.55 : 1 })}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: st[x.k] ? C.accent : C.field, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={st[x.k] ? 'check' : x.icon} size={15} color={st[x.k] ? C.onAccent : C.muted} stroke={st[x.k] ? 3 : 2} />
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: F.heavy, fontSize: 14, textDecorationLine: st[x.k] ? 'line-through' : 'none' }}>{x.t}</T>
            {!st[x.k] && <T style={{ fontSize: 12, color: C.muted }}>{x.d}</T>}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
