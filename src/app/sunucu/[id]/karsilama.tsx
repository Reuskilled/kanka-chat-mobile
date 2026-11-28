import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useKanka } from '@/lib/kanka';
import { act } from '@/lib/admin';
import { C, F } from '@/lib/theme';
import type { Server, Welcome } from '@/lib/types';
import { Screen, Section, Row, ToggleRow, Empty } from '@/components/AdminUI';
import { T, Button, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';

const inputStyle = { minHeight: 48, borderRadius: 14, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.lineStrong, color: C.ink, paddingHorizontal: 14, paddingVertical: 10, fontFamily: F.regular, fontSize: 15 } as const;

// Hoş geldin ekranı: yeni gelene gösterilen mesaj, kurallar ve önerilen odalar
export default function Karsilama() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  if (!s) return <Screen title="Hoş geldin ekranı"><Empty text="Sunucu bulunamadı." /></Screen>;
  return <Form s={s} />;
}

function Form({ s }: { s: Server }) {
  const [w, setW] = useState<Required<Welcome>>(() => ({ enabled: !!s.welcome?.enabled, message: s.welcome?.message || '', rules: [...(s.welcome?.rules || [])], channels: [...(s.welcome?.channels || [])] }));
  const [busy, setBusy] = useState(false);
  const texts = s.channels.filter(c => c.type === 'text');
  const set = (p: Partial<Welcome>) => setW(o => ({ ...o, ...p }));
  const chosen = new Set(w.channels.map(c => c.id));
  const toggleCh = (cid: string) => chosen.has(cid) ? set({ channels: w.channels.filter(c => c.id !== cid) })
    : w.channels.length >= 5 ? Alert.alert('En fazla 5 oda', 'Önce birini çıkar.') : set({ channels: [...w.channels, { id: cid, desc: '' }] });
  const save = async () => {
    setBusy(true);
    const e = await act('welcomeSave', { serverId: s.id, enabled: w.enabled, message: w.message, rules: w.rules.map(r => r.trim()).filter(Boolean), channels: w.channels });
    setBusy(false);
    if (e) return Alert.alert('Kaydedilemedi', e);
    router.back();
  };
  return (
    <Screen title="Hoş geldin ekranı" sub={s.name}>
      <Section hint="Sunucuya yeni katılan biri ilk girişte bu ekranı görür.">
        <ToggleRow title="Hoş geldin ekranı açık" value={w.enabled} onChange={v => set({ enabled: v })} last />
      </Section>

      <Section title="Mesaj">
        <TextInput value={w.message} onChangeText={v => set({ message: v.slice(0, 500) })} multiline placeholder="Hoş geldin! Burası…" placeholderTextColor={C.faint}
          accessibilityLabel="Hoş geldin mesajı" style={[inputStyle, { minHeight: 100, textAlignVertical: 'top', borderWidth: 0 }]} />
      </Section>
      <T style={{ fontSize: 12, color: C.faint, textAlign: 'right' }}>{w.message.length}/500</T>

      <Section title={`Kurallar (${w.rules.length}/10)`}>
        {w.rules.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <T style={{ width: 22, textAlign: 'center', fontFamily: F.black, color: C.accent }}>{i + 1}</T>
            <TextInput value={r} onChangeText={v => set({ rules: w.rules.map((x, j) => (j === i ? v.slice(0, 200) : x)) })} placeholder="Kural" placeholderTextColor={C.faint}
              multiline accessibilityLabel={`${i + 1}. kural`} style={[inputStyle, { flex: 1, minHeight: 42, borderWidth: 0, backgroundColor: C.field }]} />
            <IconButton size={36} label={`${i + 1}. kuralı sil`} onPress={() => set({ rules: w.rules.filter((_, j) => j !== i) })}><Icon name="trash" size={18} color="#f87171" /></IconButton>
          </View>
        ))}
        {w.rules.length < 10 && <Row icon="plus" iconColor={C.accent} title="Kural ekle" onPress={() => set({ rules: [...w.rules, ''] })} last />}
      </Section>

      <Section title={`Önerilen odalar (${w.channels.length}/5)`} hint="Seçtiğin odalar hoş geldin ekranında kısa açıklamasıyla gösterilir.">
        {texts.length ? texts.map((c, i) => {
          const sel = w.channels.find(x => x.id === c.id);
          return (
            <View key={c.id} style={{ borderBottomWidth: i === texts.length - 1 ? 0 : 1, borderBottomColor: C.line }}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!sel }} accessibilityLabel={`#${c.name}`} onPress={() => toggleCh(c.id)}
                style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }}>
                <Icon name="hash" size={18} color={C.muted} />
                <T style={{ flex: 1, fontFamily: F.heavy }}>{c.name}</T>
                <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: sel ? C.accent : C.lineStrong, backgroundColor: sel ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {sel && <Icon name="check" size={15} color={C.onAccent} stroke={3} />}
                </View>
              </Pressable>
              {sel && <TextInput value={sel.desc || ''} onChangeText={v => set({ channels: w.channels.map(x => (x.id === c.id ? { ...x, desc: v.slice(0, 60) } : x)) })}
                placeholder="Kısa açıklama (ör. Kendini tanıt)" placeholderTextColor={C.faint} accessibilityLabel={`#${c.name} açıklaması`}
                style={[inputStyle, { marginHorizontal: 14, marginBottom: 10, minHeight: 42, borderWidth: 0, backgroundColor: C.field }]} />}
            </View>
          );
        }) : <Empty text="Yazı odası yok." />}
      </Section>

      <Button title="Kaydet" busy={busy} onPress={save} style={{ marginTop: 8 }} />
    </Screen>
  );
}
