import { useState } from 'react';
import { Pressable, ScrollView, View, Linking } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, statusColor } from '@/lib/theme';
import { Sheet, Row as AdminRow } from '@/components/AdminUI';
import { abs, SERVER, APP_VERSION } from '@/lib/config';
import { fire, logout, useKanka, useSparkSatis } from '@/lib/kanka';
import { T, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';

const STATUS: Record<string, string> = { online: 'Çevrimiçi', idle: 'Boşta', dnd: 'Rahatsız etmeyin', invisible: 'Görünmez' };
const STATUS_SUB: Record<string, string> = { online: '', idle: 'Uzakta görünürsün', dnd: 'Bildirimler sessize alınır', invisible: 'Çevrimdışı görünürsün ama her şeyi kullanabilirsin' };

function Row({ icon, label, value, onPress, danger }: { icon: string; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, backgroundColor: pressed ? C.hover : 'transparent' })}>
      <Icon name={icon} size={20} color={danger ? '#f87171' : C.muted} />
      <T style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: danger ? '#f87171' : C.ink }}>{label}</T>
      {!!value && <T style={{ fontSize: 13.5, color: C.muted, fontFamily: F.bold }}>{value}</T>}
      {!danger && <Icon name="chevron" size={16} color="#52525b" stroke={2.4} />}
    </Pressable>
  );
}
const Sep = () => <View style={{ height: 1, backgroundColor: C.line, marginLeft: 46 }} />;

function Stat({ v, l, c }: { v: string; l: string; c?: string }) {
  return (
    <View style={{ flex: 1, padding: 10, borderRadius: 12, backgroundColor: C.card, alignItems: 'center' }}>
      <T style={{ fontFamily: F.black, fontSize: 19, color: c || C.ink }}>{v}</T>
      <T style={{ fontSize: 12, color: C.muted, fontFamily: F.bold }}>{l}</T>
    </View>
  );
}

export default function Profil() {
  const insets = useSafeAreaInsets();
  const me = useKanka(s => s.me)!;
  const u = useKanka(s => s.meUser);
  const pres = useKanka(s => s.presence[s.me || ''] || 'online');
  const friends = useKanka(s => s.friends.length);
  const blockedN = useKanka(s => s.blocked.length);
  const satis = useSparkSatis();
  const reqIn = useKanka(s => s.reqIn.length);
  const [stOpen, setStOpen] = useState(false);
  if (!u) return null;
  const banner = abs(u.bannerImg);
  const [c1, c2] = u.theme?.length ? u.theme : ['#4c1d95', '#9d174d'];
  const streak = typeof u.streak === 'number' ? u.streak : u.streak?.n || 0;
  const web = (p: string) => Linking.openURL(SERVER + p);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ height: 116 + insets.top }}>
        <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', inset: 0 }} />
        {banner && <Image source={{ uri: banner }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" />}
        <View style={{ position: 'absolute', right: 12, top: insets.top + 12 }}>
          <IconButton label="Ayarlar" size={40} bg="rgba(0,0,0,0.45)" onPress={() => web('/app')}><Icon name="settings" size={20} color="#fff" /></IconButton>
        </View>
      </View>
      <View style={{ paddingHorizontal: 16, marginTop: -44, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <View style={{ borderWidth: 5, borderColor: C.bg, borderRadius: 50 }}><Avatar name={me} size={88} status /></View>
        {!!u.sp && (
          <View style={{ marginBottom: 8, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: C.accentSoft, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <T style={{ color: C.accent, fontFamily: F.black, fontSize: 12 }}>⚡ SPARK</T>
          </View>
        )}
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        <View>
          <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 23 }}>{u.displayName || me}</T>
          <T style={{ color: C.muted, fontFamily: F.bold }}>@{me}{u.pronouns ? ' · ' + u.pronouns : ''}</T>
        </View>
        {!!(u.status || u.bio) && <View style={{ padding: 12, borderRadius: 12, backgroundColor: C.card }}><T style={{ color: C.ink2 }}>{u.status || u.bio}</T></View>}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat v={`Sv ${u.level ?? 1}`} l="Seviye" />
          <Stat v={String(friends)} l="Arkadaş" />
          <Stat v={`${streak} gün`} l="Seri" c="#fb923c" />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profil-duzenle' as any)} style={{ height: 46, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ color: C.onAccent, fontFamily: F.black }}>Profili düzenle</T>
        </Pressable>
      </View>
      <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 16, backgroundColor: C.panel, overflow: 'hidden' }}>
        <Row icon="clock" label="Durum" value={STATUS[pres] || 'Çevrimiçi'} onPress={() => setStOpen(true)} />
        <Sep />
        <Row icon="users" label="Arkadaşlar" value={reqIn ? `${reqIn} yeni istek` : String(friends)} onPress={() => router.push('/arkadaslar' as any)} />
        <Sep />
        <Row icon="lock" label="Hesap ve güvenlik" onPress={() => router.push('/guvenlik' as any)} />
        <Sep />
        <Row icon="bell" label="Bildirimler" onPress={() => web('/app')} />
        <Sep />
        {(satis || !!u.sp) && <Row icon="zap" label="Kanka Spark" value={u.sp ? 'Açık' : undefined} onPress={() => router.push('/spark' as any)} />}
      </View>
      <View style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 16, backgroundColor: C.panel, overflow: 'hidden' }}>
        <Row icon="users" label="Engellediklerin" value={blockedN ? String(blockedN) : undefined} onPress={() => router.push('/engellenenler' as any)} />
        <Sep />
        <Row icon="lock" label="Gizlilik politikası" onPress={() => web('/gizlilik')} />
        <Sep />
        <Row icon="file" label="Kullanım şartları" onPress={() => web('/kosullar')} />
        <Sep />
        <Row icon="chat" label="Destek ve iletişim" onPress={() => web('/destek')} />
      </View>
      <View style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 16, backgroundColor: C.panel, overflow: 'hidden' }}>
        <Row icon="logout" label="Çıkış yap" danger onPress={logout} />
        <Sep />
        <Row icon="trash" label="Hesabı sil" danger onPress={() => router.push('/hesap-sil' as any)} />
      </View>
      <T style={{ textAlign: 'center', color: C.faint, fontSize: 12, marginTop: 14 }}>Kanka Chat {APP_VERSION}</T>
      <Sheet open={stOpen} onClose={() => setStOpen(false)} title="Durumun">
        <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
          {(['online', 'idle', 'dnd', 'invisible'] as const).map((k, i) => (
            <AdminRow key={k} title={STATUS[k]} sub={STATUS_SUB[k]} last={i === 3} left={<View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: statusColor(k) }} />}
              right={pres === k ? <Icon name="check" size={18} color={C.accent} stroke={3} /> : undefined} onPress={() => { fire('setStatus', k); setStOpen(false); }} />
          ))}
        </View>
        <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
          <AdminRow title={u.status ? 'Özel durumu düzenle' : 'Özel durum ekle'} sub={u.status || 'Ne yaptığını arkadaşlarına söyle'} icon="pen" onPress={() => { setStOpen(false); router.push('/profil-duzenle' as any); }} last />
        </View>
      </Sheet>
    </ScrollView>
  );
}
