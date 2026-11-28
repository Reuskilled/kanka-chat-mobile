// Sunucunun hoş geldin ekranı: mesaj, önerilen odalar, kurallar, katılım soruları.
// Kuralları kabul etmeden (ya da başvuru onaylanmadan) sunucuda yazılamaz ve sese girilemez.
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { acceptRules, openWelcome, useKanka } from '@/lib/kanka';
import { C, F } from '@/lib/theme';
import type { Server } from '@/lib/types';
import { Sheet } from './AdminUI';
import { T, Button } from './ui';
import { Icon } from './Icon';

const shown = new Set<string>();
// Sunucu açıldığında bir kez kendiliğinden göster (kabul edilmemişse)
export function maybeWelcome(s: Server | undefined) {
  if (!s?.welcome?.enabled || s.accepted || shown.has(s.id)) return;
  shown.add(s.id); openWelcome(s.id);
}

export function WelcomeSheet() {
  const id = useKanka(st => st.welcomeFor);
  const s = useKanka(st => (id ? st.servers.find(x => x.id === id) || null : null));
  return <Sheet open={!!s} onClose={() => openWelcome(null)} title={s?.name}>{s && <Body key={s.id} s={s} />}</Sheet>;
}

function Body({ s }: { s: Server }) {
  const w = s.welcome || {};
  const needs = !s.accepted, pend = needs && s.apply === 'bekliyor';
  const qs = needs && !pend ? (s.gate?.questions || []).filter(Boolean) : [];
  const rules = w.rules || [];
  const [ok, setOk] = useState(!rules.length), [ans, setAns] = useState<string[]>(() => qs.map(() => '')), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const go = async (after?: () => void) => {
    if (needs && !ok) return setErr('Önce kuralları kabul et.');
    if (ans.some(a => !a.trim())) return setErr('Önce soruları cevapla.');
    setBusy(true); const r = await acceptRules(s.id, ans.map(a => a.trim())); setBusy(false);
    if (r.error) return setErr(r.error);
    if (r.pending) return; // sayfa "başvurun inceleniyor" durumuna geçer
    openWelcome(null); after?.();
  };
  const openCh = (cid: string) => { const nav = () => router.push({ pathname: '/kanal/[id]', params: { id: cid } }); if (needs && !pend) go(nav); else { openWelcome(null); nav(); } };
  return (
    <>
      <T style={{ color: C.muted, lineHeight: 21 }}>{w.message || `${s.name} sunucusuna hoş geldin!`}</T>
      {(w.channels || []).length > 0 && (
        <View style={{ gap: 6 }}>
          <T style={{ fontSize: 12, fontFamily: F.black, color: C.faint, letterSpacing: 1 }}>BURADAN BAŞLA</T>
          {(w.channels || []).map(c => { const ch = s.channels.find(x => x.id === c.id); return ch ? (
            <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`#${ch.name}`} onPress={() => openCh(ch.id)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: pressed ? C.hover : C.card })}>
              <Icon name="hash" size={18} color={C.muted} />
              <View style={{ flex: 1 }}><T style={{ fontFamily: F.heavy }}>{ch.name}</T>{!!c.desc && <T style={{ fontSize: 12.5, color: C.muted }}>{c.desc}</T>}</View>
              <Icon name="chevron" size={16} color={C.faint} />
            </Pressable>
          ) : null; })}
        </View>
      )}
      {rules.length > 0 && (
        <View style={{ gap: 6 }}>
          <T style={{ fontSize: 12, fontFamily: F.black, color: C.faint, letterSpacing: 1 }}>SUNUCU KURALLARI</T>
          {rules.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}><T style={{ width: 20, fontFamily: F.black, color: C.accent }}>{i + 1}</T><T style={{ flex: 1, lineHeight: 20 }}>{r}</T></View>
          ))}
        </View>
      )}
      {qs.length > 0 && (
        <View style={{ gap: 8 }}>
          <T style={{ fontSize: 12, fontFamily: F.black, color: C.faint, letterSpacing: 1 }}>KATILIM SORULARI</T>
          {qs.map((q, i) => (
            <View key={i} style={{ gap: 6 }}>
              <T style={{ fontFamily: F.heavy }}>{q}</T>
              <TextInput value={ans[i]} onChangeText={v => { setAns(a => a.map((x, j) => (j === i ? v.slice(0, 300) : x))); setErr(''); }} accessibilityLabel={q} placeholderTextColor={C.faint}
                style={{ minHeight: 46, borderRadius: 12, backgroundColor: C.field, color: C.ink, paddingHorizontal: 14, fontFamily: F.regular, fontSize: 15 }} />
            </View>
          ))}
        </View>
      )}
      {pend ? (
        <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, backgroundColor: C.card }}>
          <Icon name="clock" size={20} color={C.accent} />
          <View style={{ flex: 1 }}><T style={{ fontFamily: F.heavy }}>Başvurun inceleniyor</T><T style={{ color: C.muted, fontSize: 13.5 }}>Bir yetkili onaylayınca haber vereceğiz. O zamana kadar okuyabilirsin ama yazamazsın.</T></View>
        </View>
      ) : needs ? (
        <>
          {!!s.gate?.approval && <T style={{ color: C.muted, fontSize: 13, textAlign: 'center' }}>Bu sunucuya katılım yetkililerin onayıyla oluyor.</T>}
          {rules.length > 0 && (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ok }} onPress={() => { setOk(!ok); setErr(''); }} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 4 }}>
              <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: ok ? C.accent : C.lineStrong, backgroundColor: ok ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{ok && <Icon name="check" size={15} color={C.onAccent} stroke={3} />}</View>
              <T style={{ flex: 1 }}>Kuralları okudum ve kabul ediyorum</T>
            </Pressable>
          )}
          {!!err && <T style={{ color: '#f87171', fontSize: 13.5 }}>{err}</T>}
          <Button title={s.gate?.approval ? 'Başvur' : 'Kabul et ve devam et'} busy={busy} onPress={() => go()} />
        </>
      ) : <Button title="Tamam" kind="ghost" onPress={() => openWelcome(null)} />}
    </>
  );
}
