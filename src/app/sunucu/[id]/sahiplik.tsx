// Sahiplik: sunucuyu bir üyeye devret ya da sil (şifre ve açıksa iki adımlı doğrulama kodu ister)
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ask, useKanka } from '@/lib/kanka';
import { C, F } from '@/lib/theme';
import { Screen, Section, Row, Sheet, Empty } from '@/components/AdminUI';
import { T, Field, Button } from '@/components/ui';
import { Avatar } from '@/components/Avatar';

export default function Sahiplik() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const me = useKanka(st => st.me) || '', users = useKanka(st => st.users);
  const [open, setOpen] = useState<null | 'pick' | 'transfer' | 'delete'>(null), [to, setTo] = useState('');
  const [pw, setPw] = useState(''), [code, setCode] = useState(''), [name, setName] = useState(''), [needCode, setNeedCode] = useState(false);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [q, setQ] = useState('');
  if (!s || s.owner !== me || s.public) return <Screen title="Sahiplik"><Empty text="Bunu sadece sunucunun sahibi yapabilir." /></Screen>;
  const close = () => { setOpen(null); setPw(''); setCode(''); setName(''); setErr(''); setNeedCode(false); };
  const run = async (ev: string, payload: object, done: () => void) => {
    setBusy(true); setErr(''); const r = await ask<{ ok?: boolean; error?: string; needTfa?: boolean }>(ev, { serverId: s.id, password: pw, code: code.trim() || undefined, ...payload }); setBusy(false);
    if (r?.needTfa) setNeedCode(true);
    if (!r?.ok) return setErr(r?.error || 'Bağlantı yok');
    close(); done();
  };
  const members = s.members.filter(n => n !== me && !users[n]?.bot && (!q || n.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')) || (users[n]?.displayName || '').toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))));
  const auth = <>
    <Field label="Şifren" value={pw} onChangeText={v => { setPw(v); setErr(''); }} secureTextEntry autoComplete="current-password" />
    {needCode && <Field label="İki adımlı doğrulama kodu" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" />}
    {!!err && <T style={{ color: '#f87171', fontFamily: F.bold }}>{err}</T>}
  </>;
  return (
    <Screen title="Sahiplik ve silme" sub={s.name}>
      <Section hint="Devrettikten sonra sunucunun sahibi o olur, sen yönetici yetkini kaybedersin.">
        <Row icon="crown" title="Sahipliği devret" sub="Sunucuyu bir üyeye ver" onPress={() => setOpen('pick')} last />
      </Section>
      <Section hint="Silinen sunucu 7 gün çöp kutusunda kalır; bu sürede Hesap ve güvenlik › Silinen sunucular’dan geri getirebilirsin.">
        <Row icon="trash" title="Sunucuyu sil" danger onPress={() => setOpen('delete')} last />
      </Section>
      <Sheet open={open === 'pick'} onClose={close} title="Kime devredilsin?">
        <Field label="Ara" value={q} onChangeText={setQ} autoCapitalize="none" />
        <ScrollView style={{ maxHeight: 360 }}>
          <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
            {members.slice(0, 80).map((n, i, a) => <Row key={n} left={<Avatar name={n} size={34} />} title={users[n]?.displayName || n} sub={'@' + n} last={i === a.length - 1} onPress={() => { setTo(n); setOpen('transfer'); }} />)}
            {!members.length && <Empty text="Devredilecek üye yok." />}
          </View>
        </ScrollView>
      </Sheet>
      <Sheet open={open === 'transfer'} onClose={close} title="Sahipliği devret">
        <T style={{ color: C.muted }}><T style={{ fontFamily: F.black }}>{s.name}</T> sunucusunun sahibi <T style={{ fontFamily: F.black }}>{users[to]?.displayName || to}</T> olacak. Bu işlemi sadece yeni sahip geri alabilir.</T>
        {auth}
        <Button title="Devret" kind="danger" busy={busy} disabled={!pw} onPress={() => run('serverTransfer', { to }, () => { Alert.alert('Tamam', `Sunucu artık ${to} kişisinin.`); router.back(); })} />
      </Sheet>
      <Sheet open={open === 'delete'} onClose={close} title="Sunucuyu sil">
        <T style={{ color: C.muted }}>Herkes sunucudan çıkar ve sesteki bağlantılar kesilir. Onaylamak için sunucunun adını yaz: <T style={{ fontFamily: F.black, color: C.ink }}>{s.name}</T></T>
        <Field label="Sunucunun adı" value={name} onChangeText={setName} autoCapitalize="none" autoCorrect={false} />
        {auth}
        <Button title="Sunucuyu sil" kind="danger" busy={busy} disabled={!pw || name.trim() !== s.name} onPress={() => run('serverDelete', { name: name.trim() }, () => { router.dismissAll(); Alert.alert('Silindi', `${s.name} 7 gün çöp kutusunda kalacak.`); })} />
      </Sheet>
    </Screen>
  );
}
