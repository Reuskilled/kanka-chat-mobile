// Profili düzenle: avatar, afiş resmi, görünen ad, zamirler, hakkımda, özel durum
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { setCustomStatus, updateProfile, uploadImage, useKanka } from '@/lib/kanka';
import { Screen, Section, Chips } from '@/components/AdminUI';
import { T, Field, Button } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';

const UNTIL: [string, string][] = [['0', 'Silme'], ['30', '30 dk'], ['240', '4 saat'], ['1440', 'Bugün'], ['10080', '1 hafta']];

export default function ProfilDuzenle() {
  const me = useKanka(s => s.me)!;
  const u = useKanka(s => s.meUser);
  const [dn, setDn] = useState(u?.displayName || ''), [pr, setPr] = useState(u?.pronouns || ''), [bio, setBio] = useState(u?.bio || '');
  const [st, setSt] = useState(u?.status || ''), [until, setUntil] = useState('0');
  const [busy, setBusy] = useState(false), [up, setUp] = useState<'avatar' | 'banner' | null>(null);
  if (!u) return null;
  const [c1, c2] = u.theme?.length ? u.theme : ['#4c1d95', '#9d174d'];
  const banner = abs(u.bannerImg);

  const pick = async (kind: 'avatar' | 'banner') => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: kind === 'avatar' ? [1, 1] : [3, 1] });
    if (r.canceled) return;
    const a = r.assets[0]; setUp(kind);
    const res = await uploadImage(a.uri, a.mimeType || 'image/jpeg');
    if (res.error || !res.url) { setUp(null); return Alert.alert('Yüklenemedi', res.error || 'Tekrar dene'); }
    const e = await updateProfile(kind === 'avatar' ? { avatar: res.url } : { bannerImg: res.url }); setUp(null);
    if (e) Alert.alert('Kaydedilemedi', e);
  };
  const removeBanner = async () => { const e = await updateProfile({ bannerImg: null }); if (e) Alert.alert('Olmadı', e); };

  const save = async () => {
    setBusy(true);
    const e = await updateProfile({ displayName: dn.trim(), pronouns: pr.trim(), bio: bio.trim() });
    const e2 = !e && (st.trim() !== (u.status || '') || until !== '0') ? await setCustomStatus(st.trim(), until !== '0' && st.trim() ? Date.now() + +until * 60e3 : null) : null;
    setBusy(false);
    if (e || e2) return Alert.alert('Kaydedilemedi', (e || e2)!);
    router.back();
  };

  return (
    <Screen title="Profili düzenle">
      <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: C.card }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Afiş resmini değiştir" onPress={() => pick('banner')} style={{ height: 110 }}>
          <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', inset: 0 }} />
          {banner && <Image source={{ uri: banner }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" />}
          <View style={{ position: 'absolute', right: 10, top: 10, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {up === 'banner' ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="pen" size={14} color="#fff" />}
            <T style={{ color: '#fff', fontSize: 12.5, fontFamily: F.heavy }}>Afiş</T>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 14, paddingBottom: 14, marginTop: -40 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Profil resmini değiştir" onPress={() => pick('avatar')} style={{ borderWidth: 5, borderColor: C.card, borderRadius: 50 }}>
            <Avatar name={me} size={84} />
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.card }}>
              {up === 'avatar' ? <ActivityIndicator size="small" color={C.onAccent} /> : <Icon name="pen" size={13} color={C.onAccent} stroke={2.6} />}
            </View>
          </Pressable>
          {!!banner && <Pressable accessibilityRole="button" onPress={removeBanner} style={{ marginLeft: 'auto', marginBottom: 6 }}><T style={{ fontSize: 13, color: C.muted, fontFamily: F.heavy }}>Afişi kaldır</T></Pressable>}
        </View>
      </View>
      <Field label="Görünen ad" value={dn} onChangeText={setDn} placeholder={me} maxLength={32} />
      <Field label="Zamirler" value={pr} onChangeText={setPr} placeholder="ör. o/onun" maxLength={40} />
      <View style={{ gap: 6 }}>
        <T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>Hakkımda</T>
        <TextInput value={bio} onChangeText={setBio} multiline maxLength={190} placeholder="Kendinden biraz bahset" placeholderTextColor={C.faint} accessibilityLabel="Hakkımda"
          style={{ minHeight: 100, borderRadius: 14, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.lineStrong, color: C.ink, padding: 14, fontSize: 15, textAlignVertical: 'top' }} />
        <T style={{ fontSize: 12, color: C.faint, textAlign: 'right' }}>{bio.length}/190</T>
      </View>
      <Section title="Özel durum" hint="Profilinde ve üye listesinde görünür.">
        <View style={{ padding: 12, gap: 10 }}>
          <TextInput value={st} onChangeText={setSt} maxLength={60} placeholder="Ne yapıyorsun? 🎮" placeholderTextColor={C.faint} accessibilityLabel="Özel durum"
            style={{ height: 46, borderRadius: 12, backgroundColor: C.field, color: C.ink, paddingHorizontal: 12, fontSize: 15 }} />
          {!!st.trim() && <><T style={{ fontSize: 12.5, color: C.muted, fontFamily: F.heavy }}>Şu kadar sonra sil</T><Chips value={until} options={UNTIL} onChange={setUntil} /></>}
        </View>
      </Section>
      <Button title="Kaydet" busy={busy} onPress={save} />
    </Screen>
  );
}
