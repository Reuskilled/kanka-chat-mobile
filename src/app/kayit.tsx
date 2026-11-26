import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { SERVER } from '@/lib/config';
import { register } from '@/lib/kanka';
import { Button, ErrorText, Field, IconButton, T } from '@/components/ui';
import { Icon } from '@/components/Icon';

// GG.AA.YYYY -> YYYY-AA-GG (sunucunun beklediği biçim)
function parseDob(s: string): string | null {
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s.trim()); if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function ageOf(iso: string | null) {
  if (!iso) return null; const [y, mo, d] = iso.split('-').map(Number); const n = new Date();
  return n.getFullYear() - y - (n.getMonth() + 1 < mo || (n.getMonth() + 1 === mo && n.getDate() < d) ? 1 : 0);
}

function Check({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onToggle} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 4 }}>
      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: on ? C.accent : C.lineStrong, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {on && <T style={{ color: C.onAccent, fontFamily: F.black, fontSize: 15, lineHeight: 18 }}>✓</T>}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export default function Kayit() {
  const [f, setF] = useState({ name: '', email: '', password: '', dob: '', code: '' });
  const [terms, setTerms] = useState(false);
  const [veli, setVeli] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; field?: string } | null>(null);
  const up = (k: keyof typeof f) => (v: string) => setF(o => ({ ...o, [k]: v }));
  const iso = parseDob(f.dob), age = ageOf(iso);

  const go = async () => {
    if (!iso) return setErr({ text: 'Doğum tarihini GG.AA.YYYY biçiminde yaz.', field: 'dob' });
    setBusy(true); setErr(null);
    const r = await register({ name: f.name.trim(), email: f.email.trim(), password: f.password, dob: iso, terms, veli: age !== null && age < 18 ? veli : undefined, code: f.code.trim() || undefined });
    setBusy(false);
    if (r.error) setErr({ text: r.error, field: r.field });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
          <IconButton label="Geri" onPress={() => router.back()}><Icon name="back" /></IconButton>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 4, gap: 14 }} keyboardShouldPersistTaps="handled">
          <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 28 }}>Hesap aç</T>
          <T style={{ color: C.muted, marginTop: -8, marginBottom: 6 }}>Bir dakika sürer, sonra kankalarınla buluş.</T>
          <Field label="Kullanıcı adı" value={f.name} onChangeText={up('name')} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" maxLength={20} placeholder="harf, rakam, _ . -" error={err?.field === 'name'} />
          <Field label="E-posta" value={f.email} onChangeText={up('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="ornek@gmail.com" error={err?.field === 'email'} />
          <Field label="Şifre" value={f.password} onChangeText={up('password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder="En az 8 karakter" />
          <Field label="Doğum tarihi" value={f.dob} onChangeText={up('dob')} keyboardType="numbers-and-punctuation" placeholder="GG.AA.YYYY" maxLength={10} error={err?.field === 'dob'} />
          {age !== null && age < 15 && <ErrorText>Kanka'da hesap açmak için 15 yaşında ya da daha büyük olmalısın.</ErrorText>}
          <Field label="Davet kodu (varsa)" value={f.code} onChangeText={up('code')} autoCapitalize="characters" placeholder="KNK-…" error={err?.field === 'code'} />
          <Check on={terms} onToggle={() => setTerms(v => !v)}>
            <T style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>
              <T onPress={() => Linking.openURL(SERVER + '/kosullar')} style={{ color: C.accent, fontSize: 14, fontFamily: F.heavy }}>Kullanım Koşulları</T>'nı ve{' '}
              <T onPress={() => Linking.openURL(SERVER + '/gizlilik')} style={{ color: C.accent, fontSize: 14, fontFamily: F.heavy }}>Gizlilik Politikası</T>'nı okudum, kabul ediyorum.
            </T>
          </Check>
          {age !== null && age >= 15 && age < 18 && (
            <Check on={veli} onToggle={() => setVeli(v => !v)}>
              <T style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>18 yaşından küçüğüm; Kanka'yı velimin bilgisi ve izniyle kullanıyorum.</T>
            </Check>
          )}
          <ErrorText>{err?.text}</ErrorText>
          <Button title="Hesabı aç" onPress={go} busy={busy} disabled={!f.name || !f.email || !f.password || !f.dob || !terms || (age !== null && age < 15)} style={{ marginTop: 6 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
