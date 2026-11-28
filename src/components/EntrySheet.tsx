// Giriş sesi: sesli odaya girince odadakilere kısa bir ses çalınır
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { setEntrySound, useKanka } from '@/lib/kanka';
import { SB_DEFAULTS } from '@/lib/voice';
import { C, F } from '@/lib/theme';
import { Sheet } from './AdminUI';
import { T, Button } from './ui';

type Snd = { id: string; name: string; emoji?: string };

export function EntrySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const entry = useKanka(s => s.acct.entry);
  const servers = useKanka(s => s.servers);
  const me = useKanka(s => s.me) || '';
  const [busy, setBusy] = useState(false);
  const pick = async (v: { s: string | null; id: string } | null) => {
    setBusy(true); const e = await setEntrySound(v); setBusy(false);
    if (e) Alert.alert('Olmadı', e); else onClose();
  };
  const own = servers.filter(s => s.members?.includes(me) && ((s as any).sounds || []).length);
  const grid = (list: Snd[], sid: string | null) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {list.map(x => {
        const sel = entry?.id === x.id && (entry?.s || null) === sid;
        return (
          <Pressable key={x.id} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: sel }} accessibilityLabel={x.name} onPress={() => pick({ s: sid, id: x.id })}
            style={({ pressed }) => ({ width: '31%', paddingVertical: 10, borderRadius: 14, alignItems: 'center', gap: 2, backgroundColor: sel ? C.accentSoft : pressed ? C.hover : C.card, borderWidth: sel ? 1.5 : 0, borderColor: C.accent })}>
            <T style={{ fontSize: 22 }}>{x.emoji || '🔊'}</T>
            <T numberOfLines={1} style={{ fontSize: 12.5, fontFamily: F.heavy, color: sel ? C.accent : C.ink }}>{x.name}</T>
          </Pressable>
        );
      })}
    </View>
  );
  return (
    <Sheet open={open} onClose={onClose} title="Giriş sesi">
      <T style={{ fontSize: 13, color: C.muted, marginTop: -6 }}>Sesli odaya girince odadakilere bu ses çalınır (ses paneli açık olan odalarda).</T>
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
        <T style={{ fontSize: 12, fontFamily: F.black, color: C.muted, letterSpacing: 0.6 }}>HAZIR SESLER</T>
        {grid(SB_DEFAULTS, null)}
        {own.map(s => (
          <View key={s.id} style={{ gap: 8 }}>
            <T style={{ fontSize: 12, fontFamily: F.black, color: C.muted, letterSpacing: 0.6 }}>{s.name.toLocaleUpperCase('tr')}</T>
            {grid((s as any).sounds, s.id)}
          </View>
        ))}
      </ScrollView>
      {!!entry && <Button title="Giriş sesimi kaldır" kind="ghost" busy={busy} onPress={() => pick(null)} />}
    </Sheet>
  );
}
