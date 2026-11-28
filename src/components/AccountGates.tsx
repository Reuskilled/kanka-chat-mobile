// Hesap kapıları: sunucu bir şey isterse uygulamanın üstünde açılır, sırayla:
// 1) doğum tarihi (girilmemişse) ya da yaş kilidi, 2) 18 yaş altı veli onayı, 3) okunmamış site uyarıları, 4) 15 yaş altı geçiş bilgisi (bir kez)
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logout, setDob, useKanka, veliOnay, warnSeen } from '@/lib/kanka';
import { getItem, setItem } from '@/lib/storage';
import { C, F } from '@/lib/theme';
import { T, Button, Field } from './ui';
import { Icon } from './Icon';

function parseDob(s: string): string | null {
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s.trim()); if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3], dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < 1900) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function Full({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', inset: 0, backgroundColor: C.bg, zIndex: 50 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 26, paddingTop: insets.top + 26, paddingBottom: insets.bottom + 26, gap: 14 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}><Icon name={icon} size={32} color={C.accent} /></View>
        <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 22, textAlign: 'center' }}>{title}</T>
        {children}
      </ScrollView>
    </View>
  );
}

function DobGate() {
  const [v, setV] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const go = async () => {
    const iso = parseDob(v); if (!iso) return setErr('Doğum tarihini GG.AA.YYYY biçiminde yaz (ör. 14.05.2006).');
    setBusy(true); const r = await setDob(iso); setBusy(false);
    if (r.error && !r.locked) setErr(r.error);
  };
  return (
    <Full icon="cake" title="Doğum tarihini gir">
      <T style={{ color: C.muted, textAlign: 'center', lineHeight: 21 }}>Kanka Chat <T style={{ fontFamily: F.heavy, color: C.ink }}>15 yaş ve üzeri</T> içindir. Devam etmek için bir kereliğine doğum tarihini girmen gerekiyor.</T>
      <Field label="Doğum tarihi" value={v} onChangeText={x => { setV(x); setErr(''); }} placeholder="GG.AA.YYYY" keyboardType="numbers-and-punctuation" maxLength={10} error={!!err} returnKeyType="done" onSubmitEditing={go} />
      {!!err && <T style={{ color: '#f87171', fontSize: 13.5 }}>{err}</T>}
      <T style={{ color: C.faint, fontSize: 12.5 }}>Tam tarihin gizli kalır, kimse göremez. Profilinde sadece gün ve ay görünür, istersen kaldırabilirsin.</T>
      <Button title="Devam et" onPress={go} busy={busy} disabled={!v} />
      <Button title="Çıkış yap" kind="ghost" onPress={() => logout()} />
    </Full>
  );
}

function LockedGate({ kind, acilis }: { kind: 'locked' | 'u15'; acilis?: string | null }) {
  return (
    <Full icon="lock" title="Hesabın şu an kapalı">
      <T style={{ color: C.muted, textAlign: 'center', lineHeight: 21 }}>
        {kind === 'u15'
          ? `Yasa gereği sosyal platformlar 15 yaşından küçüklere hizmet veremiyor. Hiçbir verin silinmedi: 15 yaşına girdiğin gün${acilis ? ` (${acilis})` : ''} hesabın kendiliğinden yeniden açılır.`
          : 'Kanka Chat\'i kullanabilmek için en az 15 yaşında olmalısın.'}
      </T>
      <T style={{ color: C.faint, fontSize: 13, textAlign: 'center' }}>Doğum tarihini yanlış girdiysen kankahq1@gmail.com adresine kullanıcı adınla yaz.</T>
      <Button title="Çıkış yap" kind="ghost" onPress={() => logout()} />
    </Full>
  );
}

function Card({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 50, justifyContent: 'center', padding: 22 }}>
      <View style={{ backgroundColor: C.panel, borderRadius: 22, padding: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name={icon} size={22} color={C.accent} /><T accessibilityRole="header" style={{ flex: 1, fontFamily: F.black, fontSize: 18 }}>{title}</T></View>
        {children}
      </View>
    </View>
  );
}

function VeliGate() {
  const [ok, setOk] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  return (
    <Card icon="shield" title="Bir şey soracağız">
      <T style={{ color: C.muted, lineHeight: 21 }}>Doğum tarihine göre 18 yaşından küçüksün. Kanka’yı kullanmaya devam etmek için velinin bunu bildiğini onaylaman gerekiyor.</T>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ok }} onPress={() => setOk(!ok)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 4 }}>
        <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: ok ? C.accent : C.lineStrong, backgroundColor: ok ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{ok && <Icon name="check" size={15} color={C.onAccent} stroke={3} />}</View>
        <T style={{ flex: 1 }}>Velimin bilgisi ve izniyle kullanıyorum</T>
      </Pressable>
      {!!err && <T style={{ color: '#f87171', fontSize: 13.5 }}>{err}</T>}
      <Button title="Onayla" disabled={!ok} busy={busy} onPress={async () => { setBusy(true); const e = await veliOnay(); setBusy(false); if (e) setErr(e); }} />
    </Card>
  );
}

const trDate = (t: number) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

export function AccountGates() {
  const age = useKanka(s => s.ageGate), u15 = useKanka(s => s.u15), veli = useKanka(s => s.needVeli), warns = useKanka(s => s.warns);
  const [u15Seen, setU15Seen] = useState<boolean | null>(null);
  if (age === 'need') return <DobGate />;
  if (age === 'locked' || age === 'u15') return <LockedGate kind={age} acilis={u15?.acilis} />;
  if (veli) return <VeliGate />;
  const w = warns[0];
  if (w) return (
    <Card icon="alert" title="Kanka ekibinden uyarı">
      <T style={{ color: C.muted, fontSize: 13 }}>{trDate(w.at)}</T>
      <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 14 }}><T style={{ lineHeight: 21 }}>{w.reason}</T></View>
      <T style={{ color: C.faint, fontSize: 13, lineHeight: 19 }}>Topluluk kurallarına uymaya devam etmezsen hesabın kısıtlanabilir. Bir yanlışlık olduğunu düşünüyorsan kankahq1@gmail.com adresine yaz.</T>
      <Button title="Anladım" onPress={() => warnSeen(w.id)} />
    </Card>
  );
  // 15 yaş altı, geçiş süresinde açık hesap: bir kez bilgi ver
  if (u15?.son) {
    if (u15Seen === null) { getItem('kanka-u15-bilgi').then(v => setU15Seen(v === '1')); return null; }
    if (!u15Seen) return (
      <Card icon="info" title="Yaş sınırı 15 oldu">
        <T style={{ color: C.muted, lineHeight: 21 }}>Yeni yasa gereği sosyal platformlar 15 yaşından küçüklere hizmet veremiyor. Hesabın <T style={{ fontFamily: F.heavy, color: C.ink }}>{u15.son}</T> tarihine kadar açık kalacak, sonra kapanacak. Hiçbir verin silinmez: 15 yaşına girdiğin gün{u15.acilis ? ` (${u15.acilis})` : ''} hesabın kendiliğinden yeniden açılır.</T>
        <Button title="Anladım" onPress={() => { setItem('kanka-u15-bilgi', '1'); setU15Seen(true); }} />
      </Card>
    );
  }
  return null;
}
