import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { ask, logout, useKanka } from '@/lib/kanka';
import { SERVER } from '@/lib/config';
import { C, F } from '@/lib/theme';
import { Screen } from '@/components/AdminUI';
import { T, Field, Button } from '@/components/ui';

// Google Play kuralı: hesap açılabilen uygulamada hesap silme uygulamanın içinden başlatılabilmeli
export default function HesapSil() {
  const me = useKanka(s => s.me) || '';
  const spark = useKanka(s => !!s.users[me]?.sp);
  const [pw, setPw] = useState(''), [confirm, setConfirm] = useState(''), [code, setCode] = useState(''), [tfa, setTfa] = useState(false);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null), [done, setDone] = useState(false);
  const go = async () => {
    setBusy(true); setErr(null);
    const r = await ask<{ ok?: boolean; error?: string; needTfa?: boolean }>('deleteAccount', { password: pw, confirm: confirm.trim(), code: code.trim() || undefined });
    setBusy(false);
    if (r?.needTfa) setTfa(true);
    if (!r?.ok) return setErr(r?.error || 'Silinemedi, tekrar dene');
    setDone(true);
    setTimeout(() => { logout(); router.replace('/giris'); }, 2500);
  };
  if (done) return <Screen title="Hesabı sil"><View style={{ padding: 20, gap: 10, alignItems: 'center' }}><T style={{ fontSize: 40 }}>👋</T><T style={{ fontFamily: F.black, fontSize: 19, textAlign: 'center' }}>Hesabın silindi</T><T style={{ color: C.muted, textAlign: 'center' }}>Kendine iyi bak. Giriş ekranına dönüyorsun.</T></View></Screen>;
  return (
    <Screen title="Hesabı sil" sub="Bu işlem geri alınamaz">
      <View style={{ padding: 14, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.1)', gap: 6 }}>
        <T style={{ fontFamily: F.black, fontSize: 15 }}>Silinince neler olur?</T>
        <T style={{ color: C.ink2, lineHeight: 21 }}>• Profilin, ayarların, arkadaş listen ve şifreleme anahtarların silinir.{'\n'}• Yazdığın tüm mesajlar (kanallar ve DM&apos;ler) ve yüklediğin dosyalar silinir.{'\n'}• Sahibi olduğun sunucularda sahiplik en kıdemli yöneticiye geçer; sunucuda başka kimse yoksa sunucu silinir.{'\n'}• Oturumların kapanır, kullanıcı adın serbest kalır.</T>
        {spark && <T style={{ color: '#fbbf24', fontFamily: F.bold, lineHeight: 20, marginTop: 4 }}>Spark aboneliğin varsa hesabı silmek onu iptal etmez. Önce Google Play › Ödemeler ve abonelikler bölümünden iptal et.</T>}
      </View>
      <Field label="Şifren" value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password" />
      <Field label={`Onay için kullanıcı adını yaz: ${me}`} value={confirm} onChangeText={setConfirm} autoCapitalize="none" autoCorrect={false} />
      {tfa && <Field label="İki adımlı doğrulama kodu" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={8} />}
      {!!err && <T accessibilityLiveRegion="polite" style={{ color: '#f87171', fontFamily: F.bold }}>{err}</T>}
      <Button kind="danger" title="Hesabımı kalıcı olarak sil" busy={busy} disabled={!pw || confirm.trim() !== me} onPress={go} />
      <T onPress={() => Linking.openURL(`${SERVER}/hesap-silme`)} style={{ fontSize: 12.5, color: C.muted, textAlign: 'center', textDecorationLine: 'underline' }}>Hangi verilerin silindiğinin ayrıntısı</T>
    </Screen>
  );
}
