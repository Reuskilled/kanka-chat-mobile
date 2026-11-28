import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { useKanka, setVoice } from '@/lib/kanka';
import { leaveVoice, toggleDeaf, toggleMute, toggleSpeaker, voiceTitle, toggleCam, toggleScreen, flipCam, watchStream, getLocalVideo, getRemoteVideo, sidOf } from '@/lib/voice';
import { VideoView } from '@/components/VideoView';
import { T, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';
import { PingSheet, SoundboardSheet, StageBar, VoiceModSheet, canModVoice } from '@/components/VoicePanels';

type TileInfo = { name: string; me: boolean; sid: string | null; video: any; mirror: boolean; live: boolean; watching: boolean; sharing: boolean };

function Tile({ t, speaking, muted, deaf, onOpen, onLong }: { t: TileInfo; speaking: boolean; muted?: boolean; deaf?: boolean; onOpen: () => void; onLong?: () => void }) {
  const u = useKanka(s => s.users[t.name]);
  const name = u?.displayName || t.name;
  const big = !!t.video || t.sharing || t.live;
  return (
    <Pressable onPress={t.video ? onOpen : t.live && t.sid ? () => watchStream(t.sid!, true) : undefined} onLongPress={onLong} delayLongPress={400} disabled={!t.video && !(t.live && t.sid) && !onLong}
      accessibilityRole={t.video || t.live || onLong ? 'button' : undefined}
      accessibilityLabel={`${name}${t.me ? ' (sen)' : ''}${speaking ? ', konuşuyor' : ''}${muted ? ', mikrofonu kapalı' : ''}${t.live && !t.watching ? ', ekran paylaşıyor, izlemek için dokun' : t.video ? ', görüntüyü büyütmek için dokun' : ''}`}
      style={{ flexBasis: big ? '100%' : '47%', flexGrow: 1, height: big ? 230 : 170, borderRadius: 18, backgroundColor: C.card, borderWidth: 1.5, borderColor: speaking ? C.online : C.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {t.video ? <VideoView stream={t.video} mirror={t.mirror} fit={t.live ? 'contain' : 'cover'} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
        : <View style={{ borderRadius: 40, padding: 3, borderWidth: 3, borderColor: speaking ? C.online : 'transparent' }}><Avatar name={t.name} size={68} /></View>}
      {t.sharing && <T style={{ marginTop: 10, fontSize: 13, color: C.muted, fontFamily: F.bold }}>Ekranını paylaşıyorsun</T>}
      {t.live && !t.watching && !t.me && (
        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: C.accent }}>
          <Icon name="screen" size={16} color={C.onAccent} /><T style={{ fontFamily: F.black, fontSize: 13.5, color: C.onAccent }}>Yayını izle</T>
        </View>
      )}
      {(t.live || t.sharing) && <View style={{ position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, height: 22, borderRadius: 6, backgroundColor: C.danger, justifyContent: 'center' }}><T style={{ fontFamily: F.black, fontSize: 11, color: '#fff' }}>CANLI</T></View>}
      {t.me && t.video && !t.sharing && (
        <Pressable accessibilityRole="button" accessibilityLabel="Kamerayı çevir" onPress={flipCam} hitSlop={8}
          style={{ position: 'absolute', top: 10, right: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="flip" size={19} color="#fff" />
        </Pressable>
      )}
      <View style={{ position: 'absolute', left: 10, bottom: 10, right: 44, flexDirection: 'row' }}>
        <T numberOfLines={1} style={{ fontFamily: F.heavy, fontSize: 13, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' }}>{name}{t.me ? ' (sen)' : ''}</T>
      </View>
      {(muted || deaf) && (
        <View style={{ position: 'absolute', right: 8, bottom: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={deaf ? 'headphonesOff' : 'micOff'} size={15} color="#fff" stroke={2.6} />
        </View>
      )}
    </Pressable>
  );
}

function Ctl({ label, icon, on, danger, onPress, short }: { label: string; icon: string; on?: boolean; danger?: boolean; onPress: () => void; short?: string }) {
  const bg = danger ? C.danger : on ? C.ink : C.field, fg = danger ? '#fff' : on ? C.onAccent : C.ink;
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }} onPress={onPress}
        style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
        <Icon name={icon} size={22} color={fg} />
      </Pressable>
      <T numberOfLines={1} style={{ fontSize: 11, color: C.muted, fontFamily: F.bold }}>{short || label}</T>
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
  const myCam = useKanka(s => s.myCam), myScreen = useKanka(s => s.myScreen), camFront = useKanka(s => s.camFront);
  const vMedia = useKanka(s => s.vMedia), vWatch = useKanka(s => s.vWatch);
  useKanka(s => s.vVer); // görüntü akışı gelince/gidince yeniden çiz
  const vToast = useKanka(s => s.vToast);
  const users = useKanka(s => s.users);
  const [full, setFull] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'ping' | 'sb' | null>(null), [modOf, setModOf] = useState<string | null>(null);
  useEffect(() => { if (!vToast) return; const t = setTimeout(() => setVoice({ vToast: null }), 5000); return () => clearTimeout(t); }, [vToast]);
  const run = async (f: () => Promise<{ error?: string }>) => { const r = await f(); if (r.error) Alert.alert('Olmadı', r.error); };

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
  const modOk = !isCall && canModVoice(ch);
  const tiles: TileInfo[] = people.map(n => {
    if (n === me) { const v = myCam ? getLocalVideo() : null; return { name: n, me: true, sid: null, video: v, mirror: camFront, live: false, watching: false, sharing: myScreen }; }
    const sid = sidOf(n), m = sid ? vMedia[sid] : undefined, rv = sid ? getRemoteVideo(sid) : null;
    const watching = !!sid && vWatch === sid;
    const show = !!rv && !!m && (m.cam || (m.screen && watching));
    return { name: n, me: false, sid, video: show ? rv : null, mirror: false, live: !!m?.screen, watching, sharing: false };
  });
  const fullTile = full ? tiles.find(t => t.name === full && t.video) : null;
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
        <IconButton label="Bağlantı ve ping" onPress={() => setSheet('ping')}><Icon name="zap" size={20} color={C.online} /></IconButton>
        <IconButton label="Ses paneli" onPress={() => setSheet('sb')}><T style={{ fontSize: 20 }}>🔊</T></IconButton>
        {!isCall && <IconButton label="Arena oyunları" onPress={() => router.push({ pathname: '/arena' as any, params: { ch } })}><Icon name="game" size={22} color={C.muted} /></IconButton>}
        {!isCall && <IconButton label="Oda sohbeti" onPress={() => router.push({ pathname: '/kanal/[id]', params: { id: ch } })}><Icon name="chat" size={21} color={C.muted} /></IconButton>}
      </View>
      <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 }}>
        {tiles.map(t => {
          const f = flags?.[t.name];
          return <Tile key={t.name} t={t} onOpen={() => setFull(t.name)} onLong={!t.me && modOk ? () => setModOf(t.name) : undefined} speaking={!!speaking[t.name]} muted={t.me ? muted || deaf : f?.m} deaf={t.me ? deaf : f?.d} />;
        })}
      </ScrollView>
      {!isCall && <StageBar ch={ch} />}
      {!!vToast && (
        <Pressable onPress={() => setVoice({ vToast: null })} accessibilityLiveRegion="polite" style={{ marginHorizontal: 14, marginBottom: 10, padding: 12, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong }}>
          <T style={{ fontSize: 13.5, fontFamily: F.bold }}>{vToast}</T>
        </Pressable>
      )}
      <View style={{ paddingTop: 16, paddingBottom: insets.bottom + 22, paddingHorizontal: 12, backgroundColor: C.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Ctl label={speaker ? 'Hoparlör' : 'Ahize'} icon="speaker" on={speaker} onPress={toggleSpeaker} />
        <Ctl label={muted || deaf ? 'Mikrofon kapalı' : 'Mikrofon'} short="Mikrofon" icon={muted || deaf ? 'micOff' : 'mic'} on={!(muted || deaf)} onPress={toggleMute} />
        <Ctl label={myCam ? 'Kamerayı kapat' : 'Kamerayı aç'} short="Kamera" icon={myCam ? 'video' : 'videoOff'} on={myCam} onPress={() => run(toggleCam)} />
        {Platform.OS !== 'ios' && <Ctl label={myScreen ? 'Ekran paylaşımını durdur' : 'Ekranı paylaş'} short="Ekran" icon="screen" on={myScreen} onPress={() => run(toggleScreen)} />}
        <Ctl label={deaf ? 'Ses kapalı' : 'Ses'} icon={deaf ? 'headphonesOff' : 'headphones'} on={!deaf} onPress={toggleDeaf} />
        <Ctl label="Ayrıl" icon="hangup" danger onPress={() => { leaveVoice(); router.back(); }} />
      </View>
      <PingSheet open={sheet === 'ping'} onClose={() => setSheet(null)} />
      <SoundboardSheet ch={ch} open={sheet === 'sb'} onClose={() => setSheet(null)} />
      <VoiceModSheet ch={ch} name={modOf} onClose={() => setModOf(null)} />
      <Modal visible={!!fullTile} animationType="fade" supportedOrientations={['portrait', 'landscape']} onRequestClose={() => setFull(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {fullTile && <VideoView stream={fullTile.video} mirror={fullTile.mirror} fit="contain" style={{ flex: 1 }} />}
          <View style={{ position: 'absolute', top: insets.top + 8, left: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconButton label="Küçült" bg="rgba(0,0,0,0.55)" onPress={() => setFull(null)}><Icon name="down" color="#fff" stroke={2.4} /></IconButton>
            <T numberOfLines={1} style={{ flex: 1, fontFamily: F.heavy, fontSize: 15 }}>{fullTile ? (fullTile.me ? 'Sen' : users[fullTile.name]?.displayName || fullTile.name) : ''}</T>
            {fullTile?.live && fullTile.sid && <Pressable accessibilityRole="button" onPress={() => { watchStream(fullTile.sid!, false); setFull(null); }} style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center' }}><T style={{ fontFamily: F.heavy, fontSize: 13 }}>İzlemeyi bırak</T></Pressable>}
          </View>
        </View>
      </Modal>
    </View>
  );
}
