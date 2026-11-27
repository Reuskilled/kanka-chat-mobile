import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ask, displayName, useKanka, useReady } from '@/lib/kanka';
import { C, F } from '@/lib/theme';
import { Screen, Section, Row, Empty } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';
import { Avatar } from '@/components/Avatar';

type EV = { total: number; level: number; next: number | null; levels: number[]; perks: string[][]; mine: number; free: number; spark: boolean; by: { name: string; n: number }[]; error?: string };

export default function Energy() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ready = useReady();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const [v, setV] = useState<EV | null>(null), [ver, setVer] = useState(0), [busy, setBusy] = useState<string | null>(null), [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!ready) return; let a = true; ask<EV>('energyInfo', { serverId: id }).then(r => { if (a) setV(r); }); return () => { a = false; }; }, [id, ready, ver]);
  const move = async (pull: boolean) => {
    setBusy(pull ? 'pull' : 'send');
    const r = await ask<{ error?: string; levelUp?: boolean; server?: { level: number } }>('energyMove', { serverId: id, n: 1, pull });
    setBusy(null); setMsg(r?.error || (pull ? '1 Energy geri çekildi' : r?.levelUp ? `⚡ Sunucu Energy Level ${r.server?.level}'e çıktı!` : '⚡ 1 Energy gönderildi')); setVer(x => x + 1);
  };
  if (!v) return <Screen title="Energy"><Empty text="Yükleniyor…" /></Screen>;
  if (v.error) return <Screen title="Energy"><Empty text={v.error} /></Screen>;
  const pct = v.next ? Math.min(1, (v.total - (v.levels[v.level] || 0)) / (v.next - (v.levels[v.level] || 0))) : 1;
  return (
    <Screen title="Energy" sub={s?.name}>
      <View style={{ padding: 18, borderRadius: 20, backgroundColor: C.card, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <T style={{ fontFamily: F.black, fontSize: 30, color: C.accent }}>Level {v.level}</T>
          <T style={{ color: C.muted }}>· toplam {v.total} Energy</T>
        </View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }} style={{ height: 10, borderRadius: 5, backgroundColor: C.field, overflow: 'hidden' }}>
          <View style={{ width: `${pct * 100}%`, height: 10, backgroundColor: C.accent }} />
        </View>
        <T style={{ fontSize: 13, color: C.muted }}>{v.next ? `Level ${v.level + 1} için ${v.next - v.total} Energy daha` : 'En yüksek seviyedesiniz 🎉'}</T>
        {s?.public ? <T style={{ fontSize: 13, color: C.muted }}>Herkese açık topluluk sunucularına Energy gönderilmez.</T> : v.spark ? (
          <View style={{ gap: 8 }}>
            <T style={{ fontSize: 13.5, color: C.ink2 }}>Senin katkın: <T style={{ fontFamily: F.black }}>{v.mine}</T> · boşta {v.free}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="1 Energy gönder" style={{ flex: 1, height: 46 }} disabled={!v.free} busy={busy === 'send'} onPress={() => move(false)} />
              {v.mine > 0 && <Button kind="ghost" title="Geri çek" style={{ flex: 1, height: 46 }} busy={busy === 'pull'} onPress={() => move(true)} />}
            </View>
          </View>
        ) : <Button kind="ghost" title="Kanka Spark ile Energy gönder" onPress={() => router.push('/spark' as any)} />}
        {!!msg && <T accessibilityLiveRegion="polite" style={{ fontSize: 13.5, fontFamily: F.bold }}>{msg}</T>}
      </View>
      {v.perks.slice(1).map((p, i) => (
        <Section key={i} title={`Level ${i + 1} · ${v.levels[i + 1]} Energy${v.level >= i + 1 ? ' · açık' : ''}`}>
          {p.map((x, j) => <Row key={j} icon={v.level >= i + 1 ? 'check' : 'lock'} iconColor={v.level >= i + 1 ? C.online : C.faint} title={x} last={j === p.length - 1} />)}
        </Section>
      ))}
      {v.by.length > 0 && (
        <Section title="Destekleyenler">
          {v.by.map((b, i) => <Row key={b.name} left={<Avatar name={b.name} size={32} />} title={displayName(b.name)} sub={`${b.n} Energy`} last={i === v.by.length - 1} />)}
        </Section>
      )}
    </Screen>
  );
}
