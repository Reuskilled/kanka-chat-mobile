// Sesli oda ekranının ek parçaları: ses paneli, sahne çubuğu, yetkili işlemleri, bağlantı (ping) penceresi
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { C, F } from '@/lib/theme';
import { displayName, findChannel, useKanka } from '@/lib/kanka';
import { can } from '@/lib/admin';
import { SB_DEFAULTS, sbPlay, stageHand, stageSpeaker, voiceMod, voiceStats, type PeerStat } from '@/lib/voice';
import { Sheet, Row } from './AdminUI';
import { T, Button } from './ui';
import { Avatar } from './Avatar';

type Snd = { id: string; name: string; emoji?: string };
function SbGrid({ list, cool, play }: { list: Snd[]; cool: boolean; play: (id: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {list.map(s => (
        <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.name} sesini çal`} onPress={() => play(s.id)} disabled={cool}
          style={({ pressed }) => ({ width: '31.5%', paddingVertical: 12, borderRadius: 12, alignItems: 'center', gap: 4, backgroundColor: pressed ? C.accentSoft : C.card, opacity: cool ? 0.6 : 1 })}>
          <T style={{ fontSize: 24 }}>{s.emoji || '🔊'}</T><T numberOfLines={1} style={{ fontSize: 12.5, fontFamily: F.heavy, paddingHorizontal: 4 }}>{s.name}</T>
        </Pressable>
      ))}
    </View>
  );
}
const StatRow = ({ k, v }: { k: string; v: string }) => <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ color: C.muted, fontSize: 14 }}>{k}</T><T style={{ fontFamily: F.heavy, fontSize: 14 }}>{v}</T></View>;

export function SoundboardSheet({ ch, open, onClose }: { ch: string; open: boolean; onClose: () => void }) {
  const f = ch.startsWith('call:') ? null : findChannel(ch);
  const own = ((f?.server as any)?.sounds || []) as { id: string; name: string; emoji?: string }[];
  const [cool, setCool] = useState(false);
  const play = async (id: string) => {
    if (cool) return; setCool(true); setTimeout(() => setCool(false), 1500);
    const e = await sbPlay(id); if (e) Alert.alert('Çalınamadı', e);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Ses paneli">
      <T style={{ fontSize: 12.5, color: C.muted, marginTop: -6 }}>Çaldığın ses odadaki herkese duyulur.</T>
      {own.length > 0 && <><T style={{ fontSize: 12, fontFamily: F.black, color: C.muted, letterSpacing: 0.6 }}>{(f?.server.name || 'SUNUCU').toLocaleUpperCase('tr')}</T><SbGrid list={own} cool={cool} play={play} /></>}
      <T style={{ fontSize: 12, fontFamily: F.black, color: C.muted, letterSpacing: 0.6 }}>HAZIR SESLER</T>
      <SbGrid list={SB_DEFAULTS} cool={cool} play={play} />
    </Sheet>
  );
}

// Sahne odası: konuşmacılar, söz isteyenler; dinleyici "söz iste" der, yetkili sahneye alır
export function StageBar({ ch }: { ch: string }) {
  const stg = useKanka(s => s.vStage), me = useKanka(s => s.me) || '';
  const [open, setOpen] = useState(false);
  if (!stg) return null;
  const f = findChannel(ch); const mod = !!f && (f.server.owner === me || can(f.server, 'manageChannels'));
  const speaker = stg.speakers.includes(me), hand = stg.hands.includes(me);
  const run = async (p: Promise<string | null>) => { const e = await p; if (e) Alert.alert('Olmadı', e); };
  return (
    <View style={{ marginHorizontal: 12, marginBottom: 8, padding: 12, borderRadius: 16, backgroundColor: C.card, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T style={{ fontSize: 18 }}>🎙️</T>
        <View style={{ flex: 1 }}>
          <T style={{ fontFamily: F.black }}>{speaker ? 'Sahnedesin' : 'Dinleyicisin'}</T>
          <T style={{ fontSize: 12.5, color: C.muted }}>{stg.speakers.length} konuşmacı{stg.hands.length ? ` · ${stg.hands.length} söz isteği` : ''}</T>
        </View>
        {speaker ? <Button title="Sahneden in" kind="ghost" style={{ height: 38, paddingHorizontal: 14 }} onPress={() => run(stageSpeaker(me, false))} />
          : <Button title={hand ? 'İsteği geri çek' : 'Söz iste ✋'} kind={hand ? 'ghost' : 'primary'} style={{ height: 38, paddingHorizontal: 14 }} onPress={() => run(stageHand(!hand))} />}
      </View>
      {mod && stg.hands.length > 0 && <Button title={`Söz isteyenler (${stg.hands.length})`} kind="ghost" style={{ height: 38 }} onPress={() => setOpen(true)} />}
      <Sheet open={open} onClose={() => setOpen(false)} title="Söz isteyenler">
        <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
          {stg.hands.map((n, i) => (
            <Row key={n} left={<Avatar name={n} size={32} />} title={displayName(n)} last={i === stg.hands.length - 1}
              right={<Pressable accessibilityRole="button" accessibilityLabel={`${displayName(n)} sahneye al`} onPress={() => run(stageSpeaker(n, true))} style={{ marginRight: 12, height: 34, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.accent, justifyContent: 'center' }}><T style={{ fontFamily: F.black, fontSize: 13, color: C.onAccent }}>Sahneye al</T></Pressable>} />
          ))}
        </View>
        {!stg.hands.length && <T style={{ color: C.muted, textAlign: 'center' }}>Şu an söz isteyen yok.</T>}
      </Sheet>
    </View>
  );
}

// Bir kişinin kutusuna basılı tutunca (yetkiliysen): sustur, sesten çıkar, başka odaya taşı, sahneden indir
export function VoiceModSheet({ ch, name, onClose }: { ch: string; name: string | null; onClose: () => void }) {
  const me = useKanka(s => s.me), stg = useKanka(s => s.vStage), flags0 = useKanka(s => s.vflags[ch]);
  const flags = (flags0 || {}) as Record<string, { m?: boolean }>;
  const [move, setMove] = useState(false);
  const f = ch.startsWith('call:') ? null : findChannel(ch);
  if (!f || !name) return null;
  const s = f.server, canMute = can(s, 'voiceMute'), canMove = can(s, 'voiceMove'), mod = s.owner === me || can(s, 'manageChannels');
  const run = async (p: Promise<string | null>) => { const e = await p; if (e) Alert.alert('Olmadı', e); else onClose(); };
  const rooms = s.channels.filter(c => (c.type === 'voice' || c.type === 'stage') && c.id !== ch);
  return (
    <Sheet open onClose={() => { setMove(false); onClose(); }} title={displayName(name)}>
      {!move ? (
        <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
          {canMute && <Row icon={flags[name]?.m ? 'mic' : 'micOff'} title={flags[name]?.m ? 'Susturmayı kaldır' : 'Seste sustur'} onPress={() => run(voiceMod(s.id, name, flags[name]?.m ? 'unmute' : 'mute'))} />}
          {canMove && rooms.length > 0 && <Row icon="speaker" title="Başka odaya taşı" onPress={() => setMove(true)} />}
          {!!stg && mod && stg.speakers.includes(name) && <Row icon="down" title="Sahneden indir" onPress={() => run(stageSpeaker(name, false))} />}
          {!!stg && mod && !stg.speakers.includes(name) && <Row icon="up" title="Sahneye al" onPress={() => run(stageSpeaker(name, true))} />}
          {canMove && <Row icon="logout" title="Sesten çıkar" danger onPress={() => run(voiceMod(s.id, name, 'disconnect'))} last />}
          {!canMute && !canMove && !mod && <Row title="Bu kişi için yetkin yok" last />}
        </View>
      ) : (
        <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
          {rooms.map((c, i) => <Row key={c.id} icon="speaker" title={c.name} last={i === rooms.length - 1} onPress={() => run(voiceMod(s.id, name, 'move', c.id))} />)}
        </View>
      )}
    </Sheet>
  );
}
export const canModVoice = (ch: string) => { const f = ch.startsWith('call:') ? null : findChannel(ch); return !!f && (can(f.server, 'voiceMute') || can(f.server, 'voiceMove') || can(f.server, 'manageChannels')); };

// Ses bağlantısı penceresi: kişi kişi ping, kayıp, titreşim; Kanka sunucusuna gecikme
export function PingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [d, setD] = useState<{ per: PeerStat[]; server: number | null } | null>(null);
  const [hist, setHist] = useState<number[]>([]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    const tick = async () => {
      const r = await voiceStats(); if (!live) return; setD(r);
      const vals = r.per.map(p => p.ms).filter((x): x is number => x != null);
      const v = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : r.server;
      if (v != null) setHist(h => [...h.slice(-39), v]);
    };
    tick(); const t = setInterval(tick, 3000);
    return () => { live = false; clearInterval(t); };
  }, [open]);
  const avg = hist.length ? Math.round(hist.reduce((a, b) => a + b, 0) / hist.length) : null, last = hist[hist.length - 1] ?? null;
  const worst = Math.max(0, ...(d?.per || []).map(p => p.loss));
  const jit = Math.max(0, ...(d?.per || []).map(p => p.jit));
  const lvl = last == null ? 'good' : last > 250 || worst > 5 || jit > 100 ? 'bad' : last > 120 || worst > 2 || jit > 40 ? 'mid' : 'good';
  const col = lvl === 'good' ? '#3fcf8e' : lvl === 'mid' ? '#f0b232' : '#ff5a5f';
  const max = Math.max(60, ...hist) * 1.15;
  return (
    <Sheet open={open} onClose={onClose} title="Ses bağlantısı">
      <T style={{ color: col, fontFamily: F.heavy, marginTop: -6 }}>{lvl === 'good' ? 'Bağlantı iyi' : lvl === 'mid' ? 'Bağlantı orta' : 'Bağlantı zayıf'}</T>
      <View style={{ height: 74, borderRadius: 10, backgroundColor: C.card, flexDirection: 'row', alignItems: 'flex-end', gap: 2, padding: 6 }}>
        {hist.length < 2 ? <View style={{ flex: 1, alignSelf: 'center', alignItems: 'center' }}>{d ? <T style={{ color: C.muted, fontSize: 12 }}>Grafik için birkaç saniye bekle…</T> : <ActivityIndicator color={C.accent} />}</View>
          : hist.map((v, i) => <View key={i} style={{ flex: 1, height: `${Math.max(4, (v / max) * 100)}%`, borderRadius: 2, backgroundColor: col, opacity: 0.4 + (0.6 * i) / hist.length }} />)}
      </View>
      <View style={{ padding: 12, borderRadius: 12, backgroundColor: C.card, gap: 6 }}>
        <StatRow k={d?.per.length ? 'Ortalama ping (kişilere)' : 'Ortalama ping'} v={avg != null ? avg + ' ms' : '…'} />
        <StatRow k="Son ping" v={last != null ? last + ' ms' : '…'} />
        <StatRow k="Kanka sunucusu" v={d?.server != null ? d.server + ' ms' : '…'} />
        {!!d?.per.length && <><StatRow k="Paket kaybı" v={'%' + worst.toFixed(1)} /><StatRow k="Titreşim (jitter)" v={jit + ' ms'} /></>}
      </View>
      {!!d?.per.length && (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: C.card, gap: 8 }}>
          <T style={{ fontSize: 12, fontFamily: F.black, color: C.muted, letterSpacing: 0.6 }}>KİŞİLER</T>
          {d.per.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T numberOfLines={1} style={{ flex: 1, fontFamily: F.heavy }}>{displayName(p.name)}{p.relay ? <T style={{ fontSize: 11.5, color: '#f0b232' }}>  sunucu üzerinden</T> : null}</T>
              <T style={{ fontFamily: F.heavy, color: p.ms == null ? C.muted : p.ms > 250 ? '#ff5a5f' : p.ms > 120 ? '#f0b232' : C.ink }}>{p.ms == null ? '…' : p.ms + ' ms'}</T>
            </View>
          ))}
        </View>
      )}
      <T style={{ fontSize: 12, color: C.muted }}>{d?.per.length ? 'Ses kişiler arasında doğrudan gider, Kanka sunucusundan geçmez; ping her kişiyle ayrı ölçülür.' : 'Odada şimdilik yalnızsın. Ping Kanka sunucusuna ölçülüyor.'}</T>
    </Sheet>
  );
}
