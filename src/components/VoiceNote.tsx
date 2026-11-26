import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import Svg, { Path, Rect } from 'react-native-svg';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { encAudioUri, type EncFile } from '@/lib/encfile';
import { T } from './ui';

// Sitedeki dalga çubuklarıyla aynı hesap: aynı mesaj her yerde aynı görünür
const waveBars = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return Array.from({ length: 28 }, (_, i) => 25 + (((h >>> (i % 24)) * (i + 7)) % 75)); };
export const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let active: AudioPlayer | null = null; // aynı anda tek ses mesajı çalar
let modeSet = false;

export function VoiceNote({ id, src, enc, dur }: { id: string; src?: string | null; enc?: EncFile | null; dur: number }) {
  const player = useAudioPlayer(null, { updateInterval: 150 });
  const st = useAudioPlayerStatus(player);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [w, setW] = useState(1);
  useEffect(() => () => { if (active === player) active = null; }, [player]);

  const total = st.duration && isFinite(st.duration) && st.duration > 0 ? st.duration : dur || 1;
  const prep = async () => {
    if (ready) return true;
    setBusy(true);
    const uri = enc ? await encAudioUri(enc) : abs(src || '');
    setBusy(false);
    if (!uri) { setFailed(true); return false; }
    if (!modeSet) { modeSet = true; setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); }
    player.replace({ uri }); setReady(true); return true;
  };
  const toggle = async () => {
    if (st.playing) { player.pause(); return; }
    if (!(await prep())) return;
    if (active && active !== player) { try { active.pause(); } catch { /* kapanmış */ } }
    active = player;
    if (st.didJustFinish || (st.duration > 0 && st.currentTime >= st.duration - 0.1)) await player.seekTo(0);
    player.play();
  };
  const seek = async (x: number) => {
    if (!(await prep())) return;
    await player.seekTo(Math.max(0, Math.min(1, x / w)) * total);
    if (!st.playing) { if (active && active !== player) active.pause(); active = player; player.play(); }
  };

  const bars = waveBars(id), n = Math.round((st.currentTime / total) * bars.length);
  const shown = st.playing || st.currentTime > 0.05 ? st.currentTime : dur;
  return (
    <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingRight: 12, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong, maxWidth: 300, minWidth: 230 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={failed ? 'Ses mesajı açılamadı' : st.playing ? 'Duraklat' : 'Ses mesajını oynat'} onPress={toggle} disabled={failed}
        style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: failed ? C.field : C.accent, alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <ActivityIndicator color={C.onAccent} size="small" /> : (
          <Svg width={16} height={16} viewBox="0 0 16 16">
            {st.playing ? (<><Rect x={3} y={2} width={3.6} height={12} rx={1} fill={C.onAccent} /><Rect x={9.4} y={2} width={3.6} height={12} rx={1} fill={C.onAccent} /></>) : <Path d="M4 2.2v11.6a.8.8 0 0 0 1.2.7l9.3-5.8a.8.8 0 0 0 0-1.4L5.2 1.5A.8.8 0 0 0 4 2.2z" fill={failed ? C.faint : C.onAccent} />}
          </Svg>
        )}
      </Pressable>
      <Pressable accessibilityRole="adjustable" accessibilityLabel="Ses mesajında ilerle" onLayout={e => setW(e.nativeEvent.layout.width || 1)} onPress={e => seek(e.nativeEvent.locationX)}
        style={{ flex: 1, height: 28, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {bars.map((h, i) => <View key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 2, backgroundColor: C.ink, opacity: i < n ? 1 : 0.35 }} />)}
      </Pressable>
      <T style={{ fontSize: 11.5, fontFamily: F.bold, color: C.muted, minWidth: 32, textAlign: 'right' }}>{failed ? '—' : fmtDur(shown)}</T>
    </View>
  );
}
