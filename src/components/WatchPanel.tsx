// Birlikte izle (DM ve gruplar): biri YouTube linki açar, oynat/durdur/ileri sar herkese aynı anda uygulanır
import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useKanka, watchCtl, watchStop } from '@/lib/kanka';
import { C, F } from '@/lib/theme';
import { T } from './ui';
import { Icon } from './Icon';
import { WatchView, type WatchRef } from './WatchView';
import { watchPos } from './watchHtml';

export function WatchPanel({ chId }: { chId: string }) {
  const st = useKanka(s => s.watch[chId] || null);
  const me = useKanka(s => s.me);
  const users = useKanka(s => s.users);
  const ref = useRef<WatchRef>(null);
  // Başkası oynattı/durdurdu/ileri sardı: bizde de uygula
  useEffect(() => { if (st) ref.current?.apply(st.playing, watchPos(st)); }, [st]);
  if (!st) return null;
  return (
    <View style={{ marginHorizontal: 10, marginTop: 6, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' }}>
      <View style={{ aspectRatio: 16 / 9 }}>
        <WatchView key={st.videoId} ref={ref} videoId={st.videoId} onMsg={m => {
          if (m.t === 'ready') ref.current?.apply(st.playing, watchPos(st));
          else if (m.t === 'ctl') watchCtl(!!m.playing, m.time || 0);
        }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.card }}>
        <T style={{ fontSize: 15 }}>📺</T>
        <T numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: C.muted }}>Birlikte izliyorsunuz · <T style={{ fontSize: 12.5, fontFamily: F.heavy, color: C.ink2 }}>{st.by === me ? 'sen' : users[st.by]?.displayName || st.by}</T> {st.playing ? 'oynattı' : 'durdurdu'}</T>
        <Pressable accessibilityRole="button" accessibilityLabel="Birlikte izlemeyi bitir" hitSlop={8} onPress={watchStop}><Icon name="close" size={18} color={C.muted} /></Pressable>
      </View>
    </View>
  );
}
