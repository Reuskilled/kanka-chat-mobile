// Sıralama ve rozetler: Kanka HQ seviye / seri sıralaması, bir sunucunun kendi seviye sıralaması, kazandığın rozetler
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { C, F } from '@/lib/theme';
import { hideBadges, hqTops, leaderboard, myBadges, openUser, useKanka, useReady, type TopRow } from '@/lib/kanka';
import { Screen, Section, Chips } from '@/components/AdminUI';
import { T } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';

// Rozet adları ve açıklamaları (sunucudaki BADGES ile aynı)
const BADGE_FALLBACK: Record<string, [string, string, string]> = {
  erken: ['🌱', 'Erken kanka', 'İlk 100 üyeden biri'], gece: ['🦉', 'Gece kuşu', 'Gece 00:00-05:00 arası mesaj attı'], sohbet: ['💬', 'Geveze', '100+ mesaj'],
  efsane: ['👑', 'Efsane', '1000+ mesaj'], xox: ['⭕', 'XOX şampiyonu', '3 XOX oyunu kazandı'], seri7: ['🔥', 'Ateşli seri', '7 gün üst üste giriş'],
  kurucu: ['🏰', 'Kurucu', 'Bir sunucu kurdu'], sosyal: ['🦋', 'Sosyal kelebek', '5+ arkadaş'], caylak: ['🐣', 'Çaylak', 'Başlangıç rehberini bitirdi'],
  beta: ['🧪', 'Beta Tester', 'Kanka betasındaki ilk 300 kişiden biri'], ekip: ['🛡️', 'Kanka Ekibi', 'Kanka Chat moderasyon ekibinde'],
  avci: ['🐞', 'Hata Avcısı', 'Kanka HQ’da önemli bir hatayı bulup ekibe bildirdi'], dev: ['🤖', 'Bot Geliştirici', 'Kanka bot sisteminin beta geliştiricisi'],
  partner: ['🤝', 'Kanka Partner', 'Kanka’nın iş birliği yaptığı bir sunucunun sahibi'], yildiz: ['⭐', 'Yıldız Sunucu', 'Yıldız kademesine ulaşmış bir sunucunun sahibi'],
  arena: ['🏆', 'Arena Şampiyonu', 'Kanka Arena genel sıralamasında ilk 10'],
};

function Row({ r, i, k }: { r: TopRow; i: number; k: 'lvl' | 'stk' | 'srv' }) {
  const me = useKanka(s => s.me), u = useKanka(s => s.users[r.name]);
  const medal = ['🥇', '🥈', '🥉'][i];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${i + 1}. ${u?.displayName || r.name}`} onPress={() => openUser(r.name)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: r.name === me ? C.accentSoft : pressed ? C.hover : 'transparent' })}>
      <T style={{ width: 28, textAlign: 'center', fontFamily: F.black, fontSize: medal ? 18 : 14, color: C.muted }}>{medal || r.rank || i + 1}</T>
      <Avatar name={r.name} size={34} />
      <T numberOfLines={1} style={{ flex: 1, fontFamily: F.heavy }}>{u?.displayName || r.name}</T>
      <T style={{ fontFamily: F.black, color: k === 'stk' ? '#fb923c' : C.accent }}>{k === 'stk' ? `🔥 ${r.streak} gün` : `Sv ${r.level}`}</T>
    </Pressable>
  );
}

export default function Siralama() {
  const p = useLocalSearchParams<{ sunucu?: string }>();
  const ready = useReady();
  const sv = useKanka(s => (p.sunucu ? s.servers.find(x => x.id === p.sunucu) : undefined));
  const [tab, setTab] = useState<'lvl' | 'stk' | 'srv' | 'rozet'>(p.sunucu ? 'srv' : 'lvl');
  const [hq, setHq] = useState<Awaited<ReturnType<typeof hqTops>>>(null), [srv, setSrv] = useState<TopRow[] | null>(null);
  const [bd, setBd] = useState<{ all?: string[]; hidden?: string[]; meta?: Record<string, [string, string, string]> } | null>(null);
  useEffect(() => { if (!ready) return; if ((tab === 'lvl' || tab === 'stk') && !hq) hqTops().then(setHq); if (tab === 'srv' && sv && !srv) leaderboard(sv.id).then(setSrv); if (tab === 'rozet' && !bd) myBadges().then(setBd); }, [ready, tab, hq, srv, sv, bd]);
  const list = tab === 'lvl' ? hq?.lvl : tab === 'stk' ? hq?.stk : srv;
  const toggleBadge = async (k: string) => {
    if (!bd) return; const hidden = bd.hidden?.includes(k) ? bd.hidden.filter(x => x !== k) : [...(bd.hidden || []), k];
    setBd({ ...bd, hidden }); const e = await hideBadges(hidden); if (e) Alert.alert('Olmadı', e);
  };
  const meta = BADGE_FALLBACK;
  return (
    <Screen title="Sıralama ve rozetler" sub={tab === 'srv' && sv ? sv.name : 'Kanka HQ'}>
      <Chips value={tab} onChange={setTab} options={[['lvl', 'Seviye'], ['stk', 'Seri'], ...(sv ? [['srv', sv.name.slice(0, 18)] as ['srv', string]] : []), ['rozet', 'Rozetlerim']]} />
      {tab === 'rozet' ? (
        !bd ? <ActivityIndicator color={C.accent} /> : (
          <Section title={`Kazandığın rozetler — ${bd.all?.length || 0}`} hint="Göz simgesiyle profilinde görünüp görünmeyeceğini seçersin.">
            {(bd.all || []).map((k, i, l) => {
              const [e, ad, d] = meta[k] || ['🏅', k, ''], hid = bd.hidden?.includes(k);
              return (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: i === l.length - 1 ? 0 : 1, borderBottomColor: C.line, opacity: hid ? 0.5 : 1 }}>
                  <T style={{ fontSize: 26 }}>{e}</T>
                  <View style={{ flex: 1 }}><T style={{ fontFamily: F.heavy }}>{ad}</T>{!!d && <T style={{ fontSize: 12.5, color: C.muted }}>{d}</T>}</View>
                  <Pressable accessibilityRole="switch" accessibilityState={{ checked: !hid }} accessibilityLabel={`${ad} profilde görünsün`} onPress={() => toggleBadge(k)} hitSlop={8} style={{ padding: 8 }}>
                    <T style={{ fontSize: 13, fontFamily: F.heavy, color: hid ? C.muted : C.accent }}>{hid ? 'Gizli' : 'Görünür'}</T>
                  </Pressable>
                </View>
              );
            })}
            {!bd.all?.length && <T style={{ padding: 16, color: C.muted, textAlign: 'center' }}>Henüz rozetin yok. Sohbet et, seste takıl, rozetler gelir.</T>}
          </Section>
        )
      ) : !list ? <ActivityIndicator color={C.accent} /> : (
        <>
          {tab !== 'srv' && hq?.me && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: C.card, alignItems: 'center' }}><T style={{ fontFamily: F.black, fontSize: 18, color: C.accent }}>#{hq.me.lvlRank}</T><T style={{ fontSize: 12, color: C.muted }}>Seviye sıran</T></View>
              <View style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: C.card, alignItems: 'center' }}><T style={{ fontFamily: F.black, fontSize: 18, color: '#fb923c' }}>#{hq.me.stkRank}</T><T style={{ fontSize: 12, color: C.muted }}>Seri sıran</T></View>
            </View>
          )}
          <Section>{list.map((r, i) => <Row key={r.name + i} r={r} i={i} k={tab === 'stk' ? 'stk' : tab === 'srv' ? 'srv' : 'lvl'} />)}</Section>
          {!list.length && <T style={{ color: C.muted, textAlign: 'center' }}>Henüz kimse yok.</T>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}><Icon name="star" size={13} color={C.faint} /><T style={{ fontSize: 12, color: C.faint }}>Mesaj yazdıkça ve seste kaldıkça XP kazanırsın.</T></View>
        </>
      )}
    </Screen>
  );
}
