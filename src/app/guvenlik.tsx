// Hesap ve güvenlik: e-posta, şifre, kullanıcı adı, iki adımlı doğrulama, açık oturumlar
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { C, F } from '@/lib/theme';
import { changeName, changePassword, sessKill, sessList, setEmail, tfaDisable, tfaEnable, tfaNewBackup, tfaSetup, tfaStatus, useKanka, useReady, type Sess } from '@/lib/kanka';
import { Screen, Section, Row, Sheet } from '@/components/AdminUI';
import { T, Field, Button } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { when } from '@/lib/time';

type Open = null | 'email' | 'pw' | 'name' | 'tfa' | 'tfaOff' | 'backup';

function Codes({ list }: { list: string[] }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderRadius: 12, backgroundColor: C.field }}>
        {list.map(c => <T key={c} selectable style={{ width: '47%', fontFamily: F.black, letterSpacing: 1 }}>{c}</T>)}
      </View>
      <Button title="Kodları kopyala" kind="ghost" onPress={() => Clipboard.setStringAsync(list.join('\n'))} />
      <T style={{ fontSize: 12.5, color: C.muted }}>Bunları güvenli bir yere kaydet. Telefonunu kaybedersen bu kodlarla giriş yapabilirsin; her kod bir kez çalışır.</T>
    </View>
  );
}

export default function Guvenlik() {
  const me = useKanka(s => s.me)!;
  const email = useKanka(s => s.myEmail);
  const [open, setOpen] = useState<Open>(null);
  const [a, setA] = useState(''), [b, setB] = useState(''), [c, setC] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [tfa, setTfa] = useState<{ on?: boolean; backupLeft?: number }>({});
  const [setup, setSetup] = useState<{ secret?: string; uri?: string } | null>(null);
  const [backup, setBackup] = useState<string[] | null>(null);
  const [sess, setSess] = useState<Sess[] | null>(null);
  const [needCode, setNeedCode] = useState(false);

  const ready = useReady();
  const load = useCallback(() => { tfaStatus().then(setTfa); sessList().then(setSess); }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);
  const show = (o: Open) => { setA(''); setB(''); setC(''); setErr(''); setSetup(null); setBackup(null); setNeedCode(false); setOpen(o); };
  const close = () => setOpen(null);
  const run = async (fn: () => Promise<string | null | undefined>) => { setBusy(true); setErr(''); const e = await fn(); setBusy(false); if (e) setErr(e); };

  const kill = (s: Sess) => Alert.alert('Oturumu kapat', `${s.cihaz} cihazındaki oturum kapatılsın mı?`, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Kapat', style: 'destructive', onPress: async () => { const r = await sessKill({ id: s.id }); if (r.error) Alert.alert('Olmadı', r.error); load(); } },
  ]);
  const killAll = () => Alert.alert('Diğer cihazlardan çık', 'Bu telefon hariç her yerde oturumun kapanacak.', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Hepsinden çık', style: 'destructive', onPress: async () => { const r = await sessKill({ all: true }); if (r.error) Alert.alert('Olmadı', r.error); else Alert.alert('Tamam', `${r.n || 0} oturum kapatıldı.`); load(); } },
  ]);

  return (
    <Screen title="Hesap ve güvenlik">
      <Section title="Hesap">
        <Row icon="users" title="Kullanıcı adı" sub={'@' + me} onPress={() => show('name')} />
        <Row icon="chat" title="E-posta" sub={email || 'Eklenmemiş'} onPress={() => show('email')} />
        <Row icon="lock" title="Şifreyi değiştir" onPress={() => show('pw')} last />
      </Section>
      <Section title="İki adımlı doğrulama" hint="Açıkken girişte şifrenin yanında doğrulama uygulamasındaki 6 haneli kod da istenir.">
        {tfa.on ? <>
          <Row icon="check" iconColor={C.online} title="Açık" sub={`${tfa.backupLeft ?? 0} yedek kod kaldı`} />
          <Row icon="file" title="Yeni yedek kodlar" onPress={() => show('backup')} />
          <Row icon="trash" title="Kapat" danger onPress={() => show('tfaOff')} last />
        </> : <Row icon="lock" title="İki adımlı doğrulamayı aç" sub="Google Authenticator, Authy vb." onPress={() => show('tfa')} last />}
      </Section>
      <Section title="Açık oturumlar">
        {(sess || []).map((s, i, l) => (
          <Row key={s.id} icon={s.k === 'phone' || /android|iphone|telefon/i.test(s.cihaz) ? 'phone' : 'screen'} title={s.cihaz + (s.bu ? ' (bu cihaz)' : '')}
            sub={`${s.aktif ? 'Şu an çevrimiçi' : 'Son görülme ' + when(s.seen)}${s.ip ? ' · ' + s.ip : ''}`} last={i === l.length - 1}
            right={!s.bu ? <Pressable accessibilityRole="button" accessibilityLabel={`${s.cihaz} oturumunu kapat`} onPress={() => kill(s)} hitSlop={8} style={{ padding: 12 }}><Icon name="logout" size={18} color={C.danger} /></Pressable> : undefined} />
        ))}
        {!sess?.length && <T style={{ padding: 14, color: C.muted }}>{sess === null ? 'Yükleniyor…' : 'Oturum bilgisi alınamadı'}</T>}
      </Section>
      {(sess?.length || 0) > 1 && <Button title="Diğer tüm cihazlardan çık" kind="danger" onPress={killAll} />}

      <Sheet open={open === 'name'} onClose={close} title="Kullanıcı adını değiştir">
        <T style={{ color: C.muted, fontSize: 13.5 }}>Haftada bir değiştirebilirsin. Eski adın bir süre başkası tarafından alınamaz.</T>
        <Field label="Yeni kullanıcı adı" value={a} onChangeText={setA} autoCapitalize="none" autoCorrect={false} maxLength={20} />
        <Field label="Şifren" value={b} onChangeText={setB} secureTextEntry />
        {!!err && <T style={{ color: C.danger }}>{err}</T>}
        <Button title="Değiştir" busy={busy} disabled={!a.trim() || !b} onPress={() => run(async () => { const r = await changeName(a.trim(), b); if (r.error) return r.error; close(); Alert.alert('Tamam', `Artık @${r.name || a.trim()} olarak görünüyorsun. Uygulama birkaç saniye içinde yeniden bağlanacak.`); return null; })} />
      </Sheet>

      <Sheet open={open === 'email'} onClose={close} title="E-postayı değiştir">
        <Field label="Yeni e-posta" value={a} onChangeText={setA} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Field label="Şifren" value={b} onChangeText={setB} secureTextEntry />
        {needCode && <Field label="Doğrulama kodu" value={c} onChangeText={setC} keyboardType="number-pad" maxLength={9} />}
        {!!err && <T style={{ color: C.danger }}>{err}</T>}
        <Button title="Kaydet" busy={busy} disabled={!a.trim() || !b} onPress={() => run(async () => { const r = await setEmail(a.trim(), b, c || undefined); if (r.needTfa) { setNeedCode(true); return r.error || 'İki adımlı doğrulama kodunu yaz'; } if (r.error) return r.error; close(); return null; })} />
      </Sheet>

      <Sheet open={open === 'pw'} onClose={close} title="Şifreyi değiştir">
        <Field label="Mevcut şifre" value={a} onChangeText={setA} secureTextEntry />
        <Field label="Yeni şifre" value={b} onChangeText={setB} secureTextEntry />
        <Field label="Yeni şifre (tekrar)" value={c} onChangeText={setC} secureTextEntry />
        <T style={{ fontSize: 12.5, color: C.muted }}>Değiştirince diğer cihazlardaki oturumların kapanır.</T>
        {!!err && <T style={{ color: C.danger }}>{err}</T>}
        <Button title="Değiştir" busy={busy} disabled={!a || !b} onPress={() => run(async () => { if (b !== c) return 'Yeni şifreler aynı değil'; const e = await changePassword(a, b); if (e) return e; close(); Alert.alert('Tamam', 'Şifren değişti.'); load(); return null; })} />
      </Sheet>

      <Sheet open={open === 'tfa'} onClose={close} title="İki adımlı doğrulama">
        {backup ? <Codes list={backup} /> : !setup ? <>
          <T style={{ color: C.muted, fontSize: 13.5 }}>Başlamak için şifreni yaz.</T>
          <Field label="Şifren" value={a} onChangeText={setA} secureTextEntry />
          {!!err && <T style={{ color: C.danger }}>{err}</T>}
          <Button title="Devam" busy={busy} disabled={!a} onPress={() => run(async () => { const r = await tfaSetup(a); if (r.error) return r.error; setSetup(r); return null; })} />
        </> : <>
          <T style={{ color: C.ink2 }}>1. Doğrulama uygulamanı aç ve bu hesabı ekle:</T>
          <Button title="Doğrulama uygulamasında aç" kind="ghost" onPress={() => setup.uri && Linking.openURL(setup.uri).catch(() => Alert.alert('Uygulama bulunamadı', 'Aşağıdaki anahtarı uygulamaya elle gir.'))} />
          <Pressable accessibilityRole="button" accessibilityLabel="Anahtarı kopyala" onPress={() => setup.secret && Clipboard.setStringAsync(setup.secret.replace(/\s/g, ''))} style={{ padding: 12, borderRadius: 12, backgroundColor: C.field, gap: 4 }}>
            <T style={{ fontSize: 12, color: C.muted, fontFamily: F.heavy }}>ANAHTAR (dokun, kopyala)</T>
            <T selectable style={{ fontFamily: F.black, letterSpacing: 1 }}>{setup.secret}</T>
          </Pressable>
          <T style={{ color: C.ink2 }}>2. Uygulamadaki 6 haneli kodu yaz:</T>
          <Field label="Kod" value={b} onChangeText={setB} keyboardType="number-pad" maxLength={6} />
          {!!err && <T style={{ color: C.danger }}>{err}</T>}
          <Button title="Aç" busy={busy} disabled={b.length < 6} onPress={() => run(async () => { const r = await tfaEnable(b); if (r.error) return r.error; setBackup(r.backup || []); load(); return null; })} />
        </>}
      </Sheet>

      <Sheet open={open === 'tfaOff'} onClose={close} title="İki adımlı doğrulamayı kapat">
        <Field label="Şifren" value={a} onChangeText={setA} secureTextEntry />
        <Field label="Doğrulama ya da yedek kod" value={b} onChangeText={setB} autoCapitalize="characters" maxLength={9} />
        {!!err && <T style={{ color: C.danger }}>{err}</T>}
        <Button title="Kapat" kind="danger" busy={busy} disabled={!a || !b} onPress={() => run(async () => { const e = await tfaDisable(a, b); if (e) return e; close(); load(); return null; })} />
      </Sheet>

      <Sheet open={open === 'backup'} onClose={close} title="Yeni yedek kodlar">
        {backup ? <Codes list={backup} /> : <>
          <T style={{ color: C.muted, fontSize: 13.5 }}>Eski yedek kodların geçersiz olur.</T>
          <Field label="Doğrulama kodu" value={a} onChangeText={setA} keyboardType="number-pad" maxLength={9} />
          {!!err && <T style={{ color: C.danger }}>{err}</T>}
          <Button title="Oluştur" busy={busy} disabled={!a} onPress={() => run(async () => { const r = await tfaNewBackup(a); if (r.error) return r.error; setBackup(r.backup || []); load(); return null; })} />
        </>}
      </Sheet>
    </Screen>
  );
}
