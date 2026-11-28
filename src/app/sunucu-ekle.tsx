// Sunucu ekle: davet linkiyle katıl ya da yeni sunucu kur (şablonlu)
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { createServer, invitePeek, inviteCode, joinInvite, selectServer, type InvitePeek } from '@/lib/kanka';
import { Screen, Section, Chips } from '@/components/AdminUI';
import { T, Field, Button } from '@/components/ui';
import { Icon } from '@/components/Icon';

const TPL: [string, string, string, string][] = [
  ['bos', 'Sıfırdan başla', 'Bir yazılı, bir sesli oda. Gerisini sen kurarsın.', 'plus'],
  ['arkadas', 'Arkadaş grubu', 'Mimler, fotoğraflar, planlar, müzik ve film gecesi odası.', 'users'],
  ['oyun', 'Oyun ekibi', 'Duyurular, klipler, takım arıyorum, maç odaları, Kaptan ve Takım rolleri.', 'game'],
  ['robrun', 'Rob Run ailesi', 'Patron, Sağ Kol, Tetikçi rolleri; soygun planı ve Sığınak odaları.', 'crown'],
  ['okul', 'Okul / sınıf', 'Ödevler, sınav takvimi, soru-cevap, etüt odası, Öğretmen rolü.', 'file'],
  ['topluluk', 'Topluluk', 'Kurallar, kendini tanıt, öneriler, mod odası ve hoş geldin ekranı.', 'star'],
];

export function ServerPreview({ p }: { p: InvitePeek }) {
  const img = abs(p.iconImg), banner = abs(p.banner);
  return (
    <View style={{ borderRadius: 16, backgroundColor: C.card, overflow: 'hidden' }}>
      <View style={{ height: 70, backgroundColor: p.bannerColor || C.field }}>{banner && <Image source={{ uri: banner }} style={{ flex: 1 }} contentFit="cover" />}</View>
      <View style={{ padding: 14, paddingTop: 0, gap: 6 }}>
        <View style={{ marginTop: -28, width: 56, height: 56, borderRadius: 18, borderWidth: 4, borderColor: C.card, backgroundColor: C.field, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {img ? <Image source={{ uri: img }} style={{ width: 56, height: 56 }} /> : <T style={{ fontFamily: F.black, fontSize: 18 }}>{(p.icon || p.name.slice(0, 2)).slice(0, 3)}</T>}
        </View>
        <T style={{ fontFamily: F.black, fontSize: 19 }}>{p.name}</T>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <T style={{ fontSize: 13, color: C.muted }}><T style={{ color: C.online, fontSize: 13 }}>●</T> {p.online} çevrimiçi</T>
          <T style={{ fontSize: 13, color: C.muted }}>● {p.members} üye</T>
        </View>
        {!!p.description && <T style={{ color: C.ink2, fontSize: 14 }}>{p.description}</T>}
      </View>
    </View>
  );
}

export default function SunucuEkle() {
  const params = useLocalSearchParams<{ kod?: string; sekme?: string }>();
  const [tab, setTab] = useState<'katil' | 'kur'>(params.sekme === 'kur' ? 'kur' : 'katil');
  const [link, setLink] = useState(params.kod || '');
  const [peek, setPeek] = useState<InvitePeek | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [tpl, setTpl] = useState('bos');
  const seq = useRef(0);

  useEffect(() => {
    const code = inviteCode(link);
    if (!code) return;
    const my = ++seq.current;
    const t = setTimeout(async () => { const p = await invitePeek(code); if (my === seq.current) setPeek(p); }, 350);
    return () => clearTimeout(t);
  }, [link]);

  const open = (id: string) => { selectServer(id); router.dismissTo('/'); };
  const shown = inviteCode(link) ? peek : undefined;
  const join = async () => {
    const code = inviteCode(link); if (!code) return Alert.alert('Davet', 'Geçerli bir davet linki ya da kodu yaz.');
    if (shown?.joined) return open(shown.id);
    setBusy(true); const r = await joinInvite(code); setBusy(false);
    if (r.error) return Alert.alert('Katılamadın', r.error);
    open(r.server!.id);
  };
  const create = async () => {
    if (!name.trim()) return Alert.alert('Sunucu adı', 'Sunucuna bir ad ver.');
    setBusy(true); const r = await createServer({ name: name.trim(), template: tpl }); setBusy(false);
    if (r.error) return Alert.alert('Kurulamadı', r.error);
    open(r.server!.id);
  };

  return (
    <Screen title="Sunucu ekle">
      <Chips value={tab} options={[['katil', 'Davetle katıl'], ['kur', 'Sunucu kur']]} onChange={setTab} />
      {tab === 'katil' ? (
        <>
          <Field label="Davet linki ya da kodu" value={link} onChangeText={setLink} placeholder="kankahq.com/davet/abc123" autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={join} />
          {shown ? <ServerPreview p={shown} /> : shown === null ? <T style={{ color: C.danger, paddingHorizontal: 4 }}>Bu davet geçersiz ya da süresi dolmuş.</T> : null}
          <Button title={shown?.joined ? 'Sunucuya git' : 'Katıl'} busy={busy} disabled={!inviteCode(link) || shown === null} onPress={join} />
          <Section title="Ya da">
            <Pressable accessibilityRole="button" onPress={() => router.push('/kesfet' as any)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: pressed ? C.hover : 'transparent' })}>
              <Icon name="search" size={20} color={C.accent} />
              <View style={{ flex: 1 }}><T style={{ fontFamily: F.heavy }}>Sunucu keşfet</T><T style={{ fontSize: 13, color: C.muted }}>Herkese açık topluluklara göz at</T></View>
              <Icon name="chevron" size={16} color={C.muted} />
            </Pressable>
          </Section>
        </>
      ) : (
        <>
          <Field label="Sunucu adı" value={name} onChangeText={setName} placeholder="Örn. Gece Kuşları" maxLength={40} />
          <Section title="Şablon">
            {TPL.map(([id, t, d, ic], i) => (
              <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: tpl === id }} onPress={() => setTpl(id)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: tpl === id ? C.accentSoft : pressed ? C.hover : 'transparent', borderBottomWidth: i === TPL.length - 1 ? 0 : 1, borderBottomColor: C.line })}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.field, alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={19} color={tpl === id ? C.accent : C.ink2} /></View>
                <View style={{ flex: 1, minWidth: 0 }}><T style={{ fontFamily: F.heavy }}>{t}</T><T style={{ fontSize: 12.5, color: C.muted }}>{d}</T></View>
                {tpl === id && <Icon name="check" size={18} color={C.accent} stroke={3} />}
              </Pressable>
            ))}
          </Section>
          <Button title="Sunucuyu kur" busy={busy} onPress={create} />
          <T style={{ fontSize: 12.5, color: C.faint, textAlign: 'center' }}>Sunucu kurarak Topluluk Kuralları’nı kabul etmiş olursun.</T>
        </>
      )}
    </Screen>
  );
}
