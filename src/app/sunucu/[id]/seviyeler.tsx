import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ask, useKanka, useReady } from '@/lib/kanka';
import { act } from '@/lib/admin';
import { C, F } from '@/lib/theme';
import type { Server } from '@/lib/types';
import { Screen, Section, Row, Sheet, Chips, ToggleRow, Empty, Dot } from '@/components/AdminUI';
import { T, Button, Field, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';

type Cfg = { on: boolean; announce: 'same' | 'channel' | 'off'; channel: string | null; rewards: { level: number; role: string }[]; stack: boolean };
const ANN: [Cfg['announce'], string][] = [['same', 'Yazdığı odada'], ['channel', 'Belirli bir odada'], ['off', 'Duyurma']];

// Seviye sistemi: açık/kapalı, seviye atlama duyurusu ve seviyeye göre otomatik rol
export default function Seviyeler() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ready = useReady();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const [cfg, setCfg] = useState<Cfg | null>(null), [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    ask<{ error?: string; cfg?: Cfg }>('levelsGet', { serverId: id }).then(r => { if (!alive) return; if (r?.cfg) setCfg(r.cfg); else setErr(r?.error || 'Yüklenemedi'); });
    return () => { alive = false; };
  }, [id, ready]);
  if (!s) return <Screen title="Seviyeler"><Empty text="Sunucu bulunamadı." /></Screen>;
  if (s.public) return <Screen title="Seviyeler"><Empty text="Herkese açık sunucuda seviye ayarı yok." /></Screen>;
  if (!cfg) return <Screen title="Seviyeler" sub={s.name}><Empty text={err || 'Yükleniyor…'} /></Screen>;
  return <Form s={s} init={cfg} />;
}

function Form({ s, init }: { s: Server; init: Cfg }) {
  const [c, setC] = useState<Cfg>(init), [busy, setBusy] = useState(false);
  const [add, setAdd] = useState<{ level: string; role: string } | null>(null);
  const set = (p: Partial<Cfg>) => setC(o => ({ ...o, ...p }));
  const texts = s.channels.filter(x => x.type === 'text');
  const roles = (s.customRoles || []).filter(r => !r.bot);
  const safe = roles.filter(r => !(r.perms || []).length);
  const roleOf = (rid: string) => roles.find(r => r.id === rid);
  const save = async () => {
    if (c.announce === 'channel' && !c.channel) return Alert.alert('Oda seç', 'Duyuruların gideceği odayı seç.');
    setBusy(true); const e = await act('levelsSave', { serverId: s.id, cfg: c }); setBusy(false);
    if (e) return Alert.alert('Kaydedilemedi', e);
    router.back();
  };
  const addReward = () => {
    if (!add) return;
    const lv = parseInt(add.level, 10);
    if (!(lv >= 2 && lv <= 100)) return Alert.alert('Seviye', 'Seviye 2 ile 100 arasında olmalı.');
    if (!add.role) return Alert.alert('Rol seç', 'Bu seviyede verilecek rolü seç.');
    if (c.rewards.length >= 15) return Alert.alert('En fazla 15 ödül');
    set({ rewards: [...c.rewards.filter(r => r.level !== lv), { level: lv, role: add.role }].sort((a, b) => a.level - b.level) });
    setAdd(null);
  };
  return (
    <Screen title="Seviyeler" sub={s.name}>
      <Section hint="Üyeler yazdıkça ve seste vakit geçirdikçe XP kazanır.">
        <ToggleRow title="Seviye sistemi açık" value={c.on} onChange={v => set({ on: v })} last />
      </Section>

      {c.on && <>
        <Section title="Seviye atlama duyurusu">
          <View style={{ padding: 14, gap: 12 }}>
            <Chips value={c.announce} options={ANN} onChange={v => set({ announce: v })} />
            {c.announce === 'channel' && (texts.length
              ? <Chips value={c.channel || ''} options={texts.map(t => [t.id, '#' + t.name] as [string, string])} onChange={v => set({ channel: v })} />
              : <T style={{ color: C.muted }}>Yazı odası yok.</T>)}
          </View>
        </Section>

        <Section title={`Rol ödülleri (${c.rewards.length}/15)`} hint="Ödül roller yetkisiz olmalı; seviye kasan biri yönetici olmasın diye.">
          {c.rewards.map((r, i) => {
            const role = roleOf(r.role);
            return (
              <Row key={r.level + r.role} title={`Seviye ${r.level}`} sub={role ? role.name : 'silinmiş rol'} left={<Dot color={role?.color} />}
                right={<IconButton size={36} label={`Seviye ${r.level} ödülünü sil`} onPress={() => set({ rewards: c.rewards.filter((_, j) => j !== i) })}><Icon name="trash" size={18} color="#f87171" /></IconButton>} />
            );
          })}
          {c.rewards.length < 15 && <Row icon="plus" iconColor={C.accent} title="Ödül ekle" sub={safe.length ? undefined : 'Önce Roller\'den yetkisiz bir rol oluştur'} onPress={safe.length ? () => setAdd({ level: '10', role: '' }) : undefined} last />}
        </Section>
        {c.rewards.length > 1 && (
          <Section>
            <ToggleRow title="Önceki ödülleri koru" sub="Kapalıysa yeni ödül rolü gelince eskisi alınır" value={c.stack} onChange={v => set({ stack: v })} last />
          </Section>
        )}
      </>}

      <Button title="Kaydet" busy={busy} onPress={save} style={{ marginTop: 8 }} />

      <Sheet open={!!add} onClose={() => setAdd(null)} title="Rol ödülü">
        {add && <>
          <Field label="Seviye (2-100)" value={add.level} onChangeText={v => setAdd({ ...add, level: v.replace(/\D/g, '').slice(0, 3) })} keyboardType="number-pad" />
          <View style={{ gap: 8 }}>
            <T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>Verilecek rol</T>
            <Chips value={add.role} options={safe.map(r => [r.id, r.name] as [string, string])} onChange={v => setAdd({ ...add, role: v })} />
          </View>
          <Button title="Ekle" onPress={addReward} />
        </>}
      </Sheet>
    </Screen>
  );
}
