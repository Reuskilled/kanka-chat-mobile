import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, Linking } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { SERVER } from '@/lib/config';
import { login, useKanka, clearNotice } from '@/lib/kanka';
import { Button, ErrorText, Field, T, type InputRef } from '@/components/ui';

export default function Giris() {
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [needTfa, setNeedTfa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const notice = useKanka(s => s.notice);
  const connected = useKanka(s => s.connected);
  const pwRef = useRef<InputRef>(null);

  const go = async () => {
    if (!name.trim() || !pw) return setErr('Kullanıcı adını ve şifreni yaz.');
    setBusy(true); setErr(null); clearNotice();
    const r = await login(name.trim(), pw, needTfa ? code.trim() : undefined);
    setBusy(false);
    if (r.needTfa) { setNeedTfa(true); if (r.error) setErr(r.error); return; }
    if (r.error) setErr(r.error);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'space-between' }} keyboardShouldPersistTaps="handled">
          <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
            <View style={{ alignItems: 'center', gap: 14 }}>
              <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ color: C.onAccent, fontFamily: F.black, fontSize: 38 }}>K</T>
              </View>
              <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 28 }}>Tekrar hoş geldin</T>
              <T style={{ color: C.muted, marginTop: -8 }}>Kankaların seni bekliyor.</T>
            </View>
            <View style={{ gap: 14 }}>
              <ErrorText>{notice}</ErrorText>
              <Field label="Kullanıcı adı ya da e-posta" value={name} onChangeText={setName} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()} placeholder="kullanici_adi" />
              <Field ref={pwRef} label="Şifre" value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={go} placeholder="••••••••" />
              {needTfa && (
                <Field label="İki adımlı doğrulama kodu" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={9} placeholder="6 haneli kod ya da yedek kod" autoFocus />
              )}
              <ErrorText>{err}</ErrorText>
              <Pressable accessibilityRole="link" onPress={() => Linking.openURL(SERVER + '/login')} style={{ alignSelf: 'flex-end', paddingVertical: 4 }}>
                <T style={{ color: C.accent, fontFamily: F.heavy, fontSize: 13.5 }}>Şifremi unuttum</T>
              </Pressable>
              <Button title={needTfa ? 'Doğrula ve gir' : 'Giriş yap'} onPress={go} busy={busy} />
              {!connected && <T style={{ color: C.muted, fontSize: 13, textAlign: 'center' }}>Sunucuya bağlanılıyor…</T>}
            </View>
          </View>
          <View style={{ alignItems: 'center', gap: 12, paddingTop: 24 }}>
            <T style={{ color: C.muted, fontFamily: F.bold }}>Hesabın yok mu? <Link href="/kayit" style={{ color: C.accent, fontFamily: F.black }}>Kayıt ol</Link></T>
            <T style={{ color: C.faint, fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 300 }}>
              Kanka 15 yaş ve üzeri içindir. Devam ederek{' '}
              <T onPress={() => Linking.openURL(SERVER + '/kosullar')} style={{ color: C.muted, fontSize: 12, textDecorationLine: 'underline' }}>Kullanım Koşulları</T>'nı ve{' '}
              <T onPress={() => Linking.openURL(SERVER + '/gizlilik')} style={{ color: C.muted, fontSize: 12, textDecorationLine: 'underline' }}>Gizlilik Politikası</T>'nı kabul edersin.
            </T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
