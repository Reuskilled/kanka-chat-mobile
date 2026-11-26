import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { useKanka } from '@/lib/kanka';
import { leaveVoice, toggleDeaf, toggleMute, toggleSpeaker, voiceTitle } from '@/lib/voice';
import { T, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';

function Tile({ name, speaking, muted, deaf, me }: { name: string; speaking: boolean; muted?: boolean; deaf?: boolean; me?: boolean }) {
  const u = useKanka(s => s.users[name]);
  return (
    <View accessibilityLabel={`${u?.displayName || name}${speaking ? ', konuşuyor' : ''}${muted ? ', mikrofonu kapalı' : ''}`}
      style={{ flexBasis: '47%', flexGrow: 1, height: 170, borderRadius: 18, backgroundColor: C.card, borderWidth: 1.5, borderColor: speaking ? C.online : C.line, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ borderRadius: 40, padding: 3, borderWidth: 3, borderColor: speaking ? C.online : 'transparent' }}><Avatar name={name} size={68} /></View>
      <View style={{ position: 'absolute', left: 10, bottom: 10, right: 44, flexDirection: 'row' }}>
        <T numberOfLines={1} style={{ fontFamily: F.heavy, fontSize: 13, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' }}>{u?.displayName || name}{me ? ' (sen)' : ''}</T>
      </View>
      {(muted || deaf) && (
        <View style={{ position: 'absolute', right: 8, bottom: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={deaf ? 'headphonesOff' : 'micOff'} size={15} color="#fff" stroke={2.6} />
        </View>
      )}
    </View>
  );
}

function Ctl({ label, icon, on, danger, onPress }: { label: string; icon: string; on?: boolean; danger?: boolean; onPress: () => void }) {
  const bg = danger ? C.danger : on ? C.ink : C.field, fg = danger ? '#fff' : on ? C.onAccent : C.ink;
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }} onPress={onPress}
        style={({ pressed }) => ({ width: 58, height: 58, borderRadius: 29, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
        <Icon name={icon} size={24} color={fg} />
      </Pressable>
      <T style={{ fontSize: 11.5, color: C.muted, fontFamily: F.bold }}>{label}</T>
    </View>
  );
}

export default function Ses() {
  const insets = useSafeAreaInsets();
  const me = useKanka(s => s.me)!;
  const ch = useKanka(s => s.myVoice);
  const voice = useKanka(s => s.voice);
  const vPeers = useKanka(s => s.vPeers);
  const flags = useKanka(s => (ch ? s.vflags[ch] : undefined));
  const speaking = useKanka(s => s.speaking);
  const muted = useKanka(s => s.muted), deaf = useKanka(s => s.deaf), speaker = useKanka(s => s.speaker);
  const outgoing = useKanka(s => s.outgoing);
  const connecting = useKanka(s => s.vConnecting);

  const people = useMemo(() => {
    const list = ch && !ch.startsWith('call:') && voice[ch] ? voice[ch] : [me, ...vPeers];
    return [...new Set([me, ...list])];
  }, [ch, voice, vPeers, me]);

  if (!ch) return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
      <T style={{ fontFamily: F.black, fontSize: 18 }}>{connecting ? 'Bağlanılıyor…' : 'Sesli odada değilsin'}</T>
      {!connecting && <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ paddingHorizontal: 20, height: 44, borderRadius: 14, backgroundColor: C.field, justifyContent: 'center' }}><T style={{ fontFamily: F.heavy }}>Geri dön</T></Pressable>}
    </View>
  );
  const isCall = ch.startsWith('call:');
  const status = outgoing && !vPeers.length ? 'Çalıyor…' : 'Bağlı';

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep, paddingTop: insets.top }}>
      <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 }}>
        <IconButton label="Küçült" onPress={() => router.back()}><Icon name="down" stroke={2.4} /></IconButton>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={isCall ? 'phone' : 'speaker'} size={16} color={C.online} />
            <T accessibilityRole="header" numberOfLines={1} style={{ fontFamily: F.black, fontSize: 17, flexShrink: 1 }}>{voiceTitle(ch)}</T>
          </View>
          <T style={{ fontSize: 12, color: C.online, fontFamily: F.bold }}>{status} · {people.length} kişi</T>
        </View>
        {!isCall && <IconButton label="Oda sohbeti" onPress={() => router.push({ pathname: '/kanal/[id]', params: { id: ch } })}><Icon name="chat" size={21} color={C.muted} /></IconButton>}
      </View>
      <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 }}>
        {people.map(n => {
          const f = flags?.[n];
          return <Tile key={n} name={n} me={n === me} speaking={!!speaking[n]} muted={n === me ? muted || deaf : f?.m} deaf={n === me ? deaf : f?.d} />;
        })}
      </ScrollView>
      <View style={{ paddingTop: 16, paddingBottom: insets.bottom + 22, paddingHorizontal: 16, backgroundColor: C.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Ctl label={speaker ? 'Hoparlör' : 'Ahize'} icon="speaker" on={speaker} onPress={toggleSpeaker} />
        <Ctl label={muted || deaf ? 'Mikrofon kapalı' : 'Mikrofon'} icon={muted || deaf ? 'micOff' : 'mic'} on={!(muted || deaf)} onPress={toggleMute} />
        <Ctl label={deaf ? 'Ses kapalı' : 'Ses'} icon={deaf ? 'headphonesOff' : 'headphones'} on={!deaf} onPress={toggleDeaf} />
        <Ctl label="Ayrıl" icon="hangup" danger onPress={() => { leaveVoice(); router.back(); }} />
      </View>
    </View>
  );
}
