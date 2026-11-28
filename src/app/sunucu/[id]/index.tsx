import { Alert, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useKanka, useSparkSatis } from '@/lib/kanka';
import { can, canAdmin, isMod, isOwner, inviteUrl, act } from '@/lib/admin';
import { Screen, Section, Row, Empty } from '@/components/AdminUI';
import { T } from '@/components/ui';
import { C } from '@/lib/theme';

// Sunucu menüsü: herkes davet paylaşır, üyeleri görür, ayrılır; yetkisi olan ayarlara girer
export default function SunucuMenu() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const satis = useSparkSatis();
  const benSpark = useKanka(st => !!st.users[st.me || '']?.sp);
  if (!s) return <Screen title="Sunucu"><Empty text="Bu sunucu artık listende değil." /></Screen>;
  const go = (p: string) => router.push(`/sunucu/${s.id}/${p}` as any);
  const share = async () => { const url = inviteUrl(s); try { await Share.share({ message: `${s.name} sunucusuna gel: ${url}` }); } catch { await Clipboard.setStringAsync(url); Alert.alert('Kopyalandı', url); } };
  const leave = () => Alert.alert('Sunucudan ayrıl', `${s.name} sunucusundan ayrılmak istiyor musun?`, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Ayrıl', style: 'destructive', onPress: async () => { const e = await act('leaveServer', s.id); if (e) Alert.alert('Ayrılamadın', e); else router.dismissAll(); } },
  ]);
  const admin = canAdmin(s);
  const extras = ([
    can(s, 'manageServer') && ['karsilama', 'smile', 'Hoş geldin ekranı', s.welcome?.enabled ? 'Açık' : 'Yeni gelenlere mesaj, kurallar, odalar'],
    can(s, 'manageServer') && !s.public && ['seviyeler', 'star', 'Seviyeler', 'Duyuru ve seviye rol ödülleri'],
    (can(s, 'manageEmojis') || can(s, 'manageServer')) && ['emojiler', 'smile', 'Emojiler', `${Object.keys(s.emojis || {}).length} özel emoji`],
    ['ses-paneli', 'speaker', 'Ses paneli', `${(s.sounds || []).length} ses`],
    (can(s, 'manageWebhooks') || can(s, 'manageServer')) && !s.public && ['webhooklar', 'zap', "Webhook'lar", 'Dış servisleri odalara bağla'],
  ].filter(Boolean)) as [string, string, string, string][];
  return (
    <Screen title={s.name} sub={`${s.members.length} üye${isOwner(s) ? ' · sahibisin' : ''}`}>
      {!s.public && (
        <Section>
          <Row icon="userAdd" iconColor={C.accent} title="Arkadaşlarını davet et" sub={inviteUrl(s).replace(/^https?:\/\//, '')} onPress={share} last />
        </Section>
      )}
      {(satis || benSpark || !!s.energy?.total) && <Section>
        <Row icon="zap" iconColor={C.accent} title="Energy" sub={`Level ${s.energy?.level ?? 0} · toplam ${s.energy?.total ?? 0} Energy`} onPress={() => go('energy')} />
        <Row icon="star" title="Seviye sıralaması" sub="Bu sunucuda en çok XP kazananlar" onPress={() => router.push({ pathname: '/siralama' as any, params: { sunucu: s.id } })} last />
      </Section>}
      <Section title="Sunucu">
        {can(s, 'manageServer') && <Row icon="settings" title="Genel ayarlar" sub="Ad, simge, küfür filtresi, yavaş mod" onPress={() => go('genel')} />}
        {can(s, 'manageChannels') && <Row icon="hash" title="Odalar ve kategoriler" sub={`${s.channels.length} oda`} onPress={() => go('odalar')} />}
        {can(s, 'manageRoles') && <Row icon="tag" title="Roller" sub={`${(s.customRoles || []).length} rol`} onPress={() => go('roller')} />}
        <Row icon="users" title="Üyeler" sub={isMod(s) ? 'Rol ver, sustur, at, yasakla' : 'Sunucudaki herkes'} onPress={() => go('uyeler')} last={!can(s, 'manageServer')} />
        {can(s, 'manageServer') && !s.public && <Row icon="userAdd" title="Davet linkleri" sub="Süreli ya da sınırlı link oluştur" onPress={() => go('davetler')} />}
        {can(s, 'manageServer') && <Row icon="lock" title="Kanka Bot" sub={s.bot?.mod?.on ? `Koruma açık${s.bot.mod.spam ? ' · spam koruması açık' : ''}` : s.bot?.added ? 'Koruma kapalı' : 'Spam koruması, anti-nuke, filtreler'} onPress={() => go('bot')} last />}
      </Section>
      {(extras.length > 0) && <Section title="Topluluk">{extras.map((x, i) => <Row key={x[0]} icon={x[1]} title={x[2]} sub={x[3]} onPress={() => go(x[0])} last={i === extras.length - 1} />)}</Section>}
      {admin && (
        <Section title="Moderasyon">
          {isMod(s) && <Row icon="bell" title="Şikayetler" sub="Üyelerin bildirdiği mesajlar" onPress={() => go('sikayetler')} />}
          {(can(s, 'viewAudit') || isMod(s)) && <Row icon="clock" title="Kayıt defteri" sub="Kim neyi değiştirdi" onPress={() => go('kayit')} last />}
        </Section>
      )}
      <Section>
        <Row icon="bell" title="Bildirimler" sub="Tüm mesajlar, sadece etiketler ya da sustur" onPress={() => router.push({ pathname: '/bildirim-ayarlari', params: { sid: s.id } })} last={!!s.public} />
        {!s.public && <Row icon="sparkle" title="Sunucunun yılı" sub="Kanka Wrapped: bu yıl burada neler oldu" onPress={() => router.push({ pathname: '/wrapped', params: { server: s.id } })} last />}
      </Section>
      {!s.public && !isOwner(s) && <Section><Row icon="logout" title="Sunucudan ayrıl" danger onPress={leave} last /></Section>}
      {isOwner(s) && <View style={{ paddingHorizontal: 4 }}><T style={{ fontSize: 12.5, color: C.faint }}>Sahipliği devretmek ve sunucuyu silmek şifre onayı gerektirdiği için webden yapılır.</T></View>}
    </Screen>
  );
}
