import { Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { useKanka } from '@/lib/kanka';
import { acceptCall, declineCall, leaveVoice, toggleMute, voiceTitle } from '@/lib/voice';
import { T } from './ui';
import { Icon } from './Icon';
import { Avatar } from './Avatar';

// Sesli odadayken alt sekmelerin üstünde duran şerit: odaya dön, mikrofon, ayrıl
export function VoiceBar({ bottom }: { bottom: number }) {
  const ch = useKanka(s => s.myVoice);
  const muted = useKanka(s => s.muted || s.deaf);
  const n = useKanka(s => (s.myVoice && !s.myVoice.startsWith('call:') ? s.voice[s.myVoice]?.length : s.vPeers.length + 1) || 1);
  if (!ch) return null;
  return (
    <View style={{ position: 'absolute', left: 10, right: 10, bottom, height: 56, borderRadius: 16, backgroundColor: '#13261b', borderWidth: 1, borderColor: 'rgba(61,220,132,0.35)', flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 6, gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Sesli odaya dön" onPress={() => router.push('/ses')} style={{ flex: 1, minWidth: 0 }}>
        <T numberOfLines={1} style={{ fontFamily: F.black, fontSize: 14.5, color: C.online }}>{voiceTitle(ch)}</T>
        <T style={{ fontSize: 12, color: C.muted, fontFamily: F.bold }}>Bağlı · {n} kişi · dokun, odaya dön</T>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'} onPress={toggleMute} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: muted ? 'rgba(239,68,68,0.2)' : 'transparent' }}>
        <Icon name={muted ? 'micOff' : 'mic'} size={21} color={muted ? '#f87171' : C.ink} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Ayrıl" onPress={() => leaveVoice()} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.danger }}>
        <Icon name="hangup" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

// Gelen arama ekranı (uygulama açıkken)
export function IncomingCall() {
  const insets = useSafeAreaInsets();
  const r = useKanka(s => s.ringing);
  const users = useKanka(s => s.users);
  if (!r) return null;
  const group = r.chatId.startsWith('g:');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={declineCall}>
      <View accessibilityRole="alert" style={{ flex: 1, backgroundColor: 'rgba(7,7,9,0.96)', alignItems: 'center', justifyContent: 'space-between', paddingTop: insets.top + 80, paddingBottom: insets.bottom + 60 }}>
        <View style={{ alignItems: 'center', gap: 16 }}>
          {group ? <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#475569', alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={44} /></View> : <Avatar name={r.from} size={110} />}
          <T style={{ fontFamily: F.black, fontSize: 26, textAlign: 'center' }}>{group ? r.title : users[r.from]?.displayName || r.from}</T>
          <T style={{ color: C.muted, fontSize: 16 }}>{r.video ? 'Görüntülü arıyor…' : 'Sesli arıyor…'}{group ? ` · ${r.from}` : ''}</T>
        </View>
        <View style={{ flexDirection: 'row', gap: 70 }}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Reddet" onPress={declineCall} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}><Icon name="hangup" size={30} color="#fff" /></Pressable>
            <T style={{ color: C.muted, fontFamily: F.bold }}>Reddet</T>
          </View>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={r.video ? 'Görüntülü kabul et' : 'Kabul et'} onPress={async () => { const x = await acceptCall(); if (!x.error) router.push('/ses'); }} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.online, alignItems: 'center', justifyContent: 'center' }}><Icon name={r.video ? 'video' : 'phone'} size={28} color="#07130c" /></Pressable>
            <T style={{ color: C.muted, fontFamily: F.bold }}>Kabul et</T>
          </View>
        </View>
        {r.video && (
          <Pressable accessibilityRole="button" onPress={async () => { const x = await acceptCall(false); if (!x.error) router.push('/ses'); }} style={{ position: 'absolute', bottom: insets.bottom + 18, paddingHorizontal: 16, height: 36, justifyContent: 'center' }}>
            <T style={{ color: C.ink2, fontFamily: F.heavy, fontSize: 14 }}>Kamerasız katıl</T>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}
