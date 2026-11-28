// Kanka Wrapped: yıl özeti hikâye kartları (dokun: sonraki, sola dokun: önceki, basılı tut: durdur)
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ask, useKanka, useReady } from '@/lib/kanka';
import { C, F } from '@/lib/theme';
import { T, Button } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';

type Item = { av?: string; e?: string; t: string; s?: string };
type Slide = { bg: [string, string]; kicker: string; big?: string; unit?: string; sub?: string; av?: string; icon?: string; emoji?: string; row?: string[]; bars?: number[]; list?: Item[]; summary?: [string, string][]; who?: string[] };
const N = (n: number) => Number(n || 0).toLocaleString('tr-TR');
const hrs = (dk: number) => (dk >= 60 ? `${N(Math.round(dk / 60))} saat` : `${N(dk)} dakika`);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

function slidesOf(d: any, dn: (n: string) => string): Slide[] {
  const y = d.year, sl: Slide[] = [], pre = d.preview ? `${y} şimdiye kadar` : `Kanka Wrapped ${y}`;
  if (d.server) {
    const s = d.server;
    sl.push({ bg: ['#1b1036', '#c8ff00'], kicker: pre, big: s.ad, sub: `${N(s.uye)} kankanın bir yılı`, icon: s.simge || '🏠' });
    sl.push({ bg: ['#0b3d2e', '#2fd3c3'], kicker: 'Bu sunucuda bu yıl', big: N(d.msg), unit: 'mesaj', sub: `ve ${N(d.ses)} saat seste sohbet` });
    if (d.uyeler.length) sl.push({ bg: ['#3a0d2e', '#ff6b9a'], kicker: 'Sunucunun yıldızları', list: d.uyeler.map((n: string, i: number) => ({ av: n, t: dn(n), s: ['Sunucunun kalbi', 'Hep oradaydı', 'Sohbetin tuzu biberi', 'Vazgeçilmez', 'Efsane'][i] })) });
    if (d.odalar.length || d.sesOdalari.length) sl.push({ bg: ['#10233f', '#4aa8ff'], kicker: 'En canlı odalar', list: [...d.odalar.map((c: any) => ({ e: '#', t: c.ad, s: `${N(c.v)} mesaj` })), ...d.sesOdalari.map((c: any) => ({ e: '🔊', t: c.ad, s: `${N(c.v)} saat ses` }))].slice(0, 5) });
    sl.push({ bg: ['#21123d', '#b07cff'], kicker: 'En kalabalık saat', big: hh(d.peak), sub: 'Bu saatte sunucu hiç susmadı', bars: d.hours });
    if (d.emoji.length) sl.push({ bg: ['#3d2a05', '#f6c445'], kicker: 'Sunucunun emojisi', emoji: d.emoji[0].k, sub: `${N(d.emoji[0].v)} kez kullanıldı`, row: d.emoji.slice(1).map((e: any) => e.k) });
    sl.push({ bg: ['#111111', '#c8ff00'], kicker: pre, big: s.ad, summary: [[N(d.msg), 'mesaj'], [N(d.ses), 'saat ses'], [hh(d.peak), 'en canlı saat'], [d.emoji[0]?.k || '—', 'favori emoji']], who: d.uyeler.slice(0, 3) });
    return sl;
  }
  sl.push({ bg: ['#1b1036', '#c8ff00'], kicker: pre, big: d.me.gorunen, sub: 'Bu yıl Kanka’da neler yaptığına bakalım', av: d.me.ad });
  if (d.sesDk) sl.push({ bg: ['#0f2a4a', '#4aa8ff'], kicker: 'Bu yıl seste', big: d.ses >= 1 ? N(Math.round(d.ses)) : N(d.sesDk), unit: d.ses >= 1 ? 'saat' : 'dakika', sub: d.sesYuzde && d.sesYuzde <= 50 ? `Kanka’da seste en çok kalanların ilk %${d.sesYuzde}’indesin` : 'Kankalarınla bol bol konuştun' });
  if (d.kankalar.length) sl.push({ bg: ['#3a0d2e', '#ff6b9a'], kicker: 'En çok takıldığın kankalar', list: d.kankalar.map((k: any) => ({ av: k.ad, t: dn(k.ad), s: [k.dk ? `${hrs(k.dk)} seste` : '', k.msg ? `${N(k.msg)} mesaj` : ''].filter(Boolean).join(' · ') })) });
  if (d.sunucular.length || d.odalar.length) sl.push({ bg: ['#0b3d2e', '#2fd3c3'], kicker: 'En sevdiğin yerler', list: [...d.sunucular.map((s: any) => ({ e: s.simge || '🏠', t: s.ad, s: 'Sunucu' })), ...d.odalar.map((c: any) => ({ e: '🔊', t: c.ad, s: `${c.sv} · ${hrs(c.dk)}` }))].slice(0, 5) });
  if (d.muzikDk) sl.push({ bg: ['#0d3b1c', '#1ed760'], kicker: 'Bu yılın müziği', big: d.muzikDk >= 60 ? N(Math.round(d.muzikDk / 60)) : N(d.muzikDk), unit: d.muzikDk >= 60 ? 'saat müzik' : 'dakika müzik', list: d.sanatcilar.map((a: any, i: number) => ({ e: `${i + 1}`, t: a.k, s: hrs(a.v) })), sub: d.sarkilar[0] ? `Yılın şarkın: ${d.sarkilar[0].ad} · ${d.sarkilar[0].sanatci}` : '' });
  if (d.oyunDk) sl.push({ bg: ['#2a0f0f', '#ff7a59'], kicker: 'En çok oynadıkların', big: N(Math.round(d.oyunDk / 60)), unit: 'saat oyun', list: d.oyunlar.map((g: any, i: number) => ({ e: ['🥇', '🥈', '🥉', '4', '5'][i], t: g.k, s: hrs(g.v) })) });
  if (d.arena.length) { const fav = [...d.arena].sort((a: any, b: any) => b.oynadi - a.oynadi)[0]; sl.push({ bg: ['#2a1a05', '#f6c445'], kicker: 'Kanka Arena', big: N(d.arenaGalibiyet), unit: 'galibiyet', sub: `En çok oynadığın: ${fav.oyun} (${fav.oynadi} maç)`, list: d.arena.slice(0, 4).map((a: any) => ({ e: '🎮', t: a.oyun, s: `${a.oynadi} maç · ${a.kazandi} galibiyet` })) }); }
  if (d.msg) sl.push({ bg: ['#21123d', '#b07cff'], kicker: 'En aktif saatin', big: hh(d.peak), sub: d.night >= 15 ? `Mesajlarının %${d.night}’ini gece yarısından sonra attın 🦉` : `Bu yıl ${N(d.msg)} mesaj attın`, bars: d.hours });
  if (d.emoji.length) sl.push({ bg: ['#3d2a05', '#f6c445'], kicker: 'Yılın emojisi', emoji: d.emoji[0].k, sub: `${N(d.emoji[0].v)} kez kullandın`, row: d.emoji.slice(1).map((e: any) => e.k) });
  if (d.gun) sl.push({ bg: ['#3b1206', '#ff4d2e'], kicker: 'Hiç bırakmadın', big: N(d.gun), unit: 'gün aktiftin', sub: d.seri > 1 ? `En uzun serin ${d.seri} gün 🔥` : '' });
  sl.push({ bg: ['#0f0f14', '#c8ff00'], kicker: 'Bu yılki kişiliğin', emoji: d.kisilik[0], big: d.kisilik[1], sub: d.kisilik[2] });
  sl.push({ bg: ['#111111', '#c8ff00'], kicker: pre, big: d.me.gorunen, av: d.me.ad, summary: [[d.ses >= 1 ? N(Math.round(d.ses)) : N(d.sesDk), d.ses >= 1 ? 'saat seste' : 'dakika seste'], [N(d.msg), 'mesaj'], [d.sanatcilar[0]?.k || d.oyunlar[0]?.k || '—', d.sanatcilar[0] ? 'yılın sanatçısı' : 'yılın oyunu'], [`${d.kisilik[0]} ${d.kisilik[1]}`, 'kişiliğin']], who: d.kankalar.slice(0, 3).map((k: any) => k.ad) });
  return sl;
}

const DUR = 6500;
const defYear = () => { const n = new Date(Date.now() + 3 * 3600e3); return n.getUTCFullYear() - (n.getUTCMonth() === 0 ? 1 : 0); };

export default function Wrapped() {
  const { server, year } = useLocalSearchParams<{ server?: string; year?: string }>();
  const ready = useReady(), insets = useSafeAreaInsets();
  const users = useKanka(s => s.users);
  const [d, setD] = useState<any>(null), [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(0), [p, setP] = useState(0);
  const paused = useRef(false), pos = useRef({ i: 0, p: 0 });
  useEffect(() => { if (ready) ask<any>('wrapped', { server: server || undefined, year: year ? Number(year) : defYear() }).then(r => (r?.ok ? setD(r) : setErr(r?.error || 'Özet hazırlanamadı'))); }, [ready, server, year]);
  const slides = d ? slidesOf(d, n => users[n]?.displayName || n) : [];
  const n = slides.length;
  useEffect(() => {
    if (!n) return;
    const t = setInterval(() => {
      if (paused.current) return;
      const r = pos.current; r.p = Math.min(1, r.p + 100 / DUR);
      if (r.p >= 1 && r.i < n - 1) { r.i++; r.p = 0; setI(r.i); }
      setP(r.p);
    }, 100);
    return () => clearInterval(t);
  }, [n]);
  const go = (k: number) => { const x = Math.max(0, Math.min(slides.length - 1, k)); pos.current = { i: x, p: 0 }; setI(x); setP(0); };
  const share = () => {
    if (!d) return;
    const msg = d.server ? `${d.server.ad} sunucumuzun ${d.year} yılı: ${N(d.msg)} mesaj, ${N(d.ses)} saat ses. Kanka Wrapped 👉 kankahq.com`
      : `Kanka Wrapped ${d.year}: ${d.ses >= 1 ? N(Math.round(d.ses)) + ' saat' : N(d.sesDk) + ' dakika'} seste, ${N(d.msg)} mesaj. Yılın kişiliğim: ${d.kisilik[0]} ${d.kisilik[1]} 👉 kankahq.com`;
    paused.current = true; Share.share({ message: msg }).finally(() => { paused.current = false; });
  };

  if (!d) return (
    <View style={{ flex: 1, backgroundColor: '#0f0f14', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16, paddingTop: insets.top }}>
      {err ? <>
        <T style={{ fontSize: 56 }}>🎁</T>
        <T style={{ fontFamily: F.black, fontSize: 22, textAlign: 'center' }}>Kanka Wrapped</T>
        <T style={{ color: C.muted, textAlign: 'center', lineHeight: 21 }}>{err}</T>
        <Button title="Tamam" kind="ghost" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </> : <ActivityIndicator color={C.accent} />}
    </View>
  );
  const s = slides[i];
  const mx = s.bars ? Math.max(...s.bars, 1) : 1, pk = s.bars ? s.bars.indexOf(mx) : -1;
  return (
    <View style={{ flex: 1, backgroundColor: s.bg[0] }}>
      <LinearGradient colors={[s.bg[0], s.bg[0], s.bg[1] + '88']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', inset: 0 }} />
      <View style={{ position: 'absolute', top: -120, right: -120, width: 340, height: 340, borderRadius: 170, backgroundColor: s.bg[1], opacity: 0.35 }} />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {slides.map((_, k) => <View key={k} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}><View style={{ height: 3, width: `${k < i ? 100 : k === i ? p * 100 : 0}%`, backgroundColor: '#fff' }} /></View>)}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T style={{ fontFamily: F.black }}><T style={{ fontFamily: F.black, color: C.accent }}>kanka</T>hq.com</T>
          <Pressable accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={10} onPress={() => router.back()}><Icon name="close" size={24} color="#fff" /></Pressable>
        </View>
      </View>
      <Pressable style={{ flex: 1 }} accessibilityLabel="Sonraki kart" onPressIn={() => { paused.current = true; }} onPressOut={() => { paused.current = false; }}
        onPress={e => go(i + (e.nativeEvent.locationX < 120 ? -1 : 1))}>
        <View pointerEvents="none" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 26, gap: 14 }}>
          <T style={{ fontFamily: F.black, fontSize: 14, letterSpacing: 1.5, color: 'rgba(255,255,255,0.75)' }}>{s.kicker.toLocaleUpperCase('tr')}</T>
          {!!s.av && <Avatar name={s.av} size={96} />}
          {!!(s.emoji || (s.icon && !s.av)) && <T style={{ fontSize: 84, lineHeight: 100 }}>{s.emoji || s.icon}</T>}
          {!!s.big && <T adjustsFontSizeToFit numberOfLines={2} style={{ fontFamily: F.black, fontSize: 58, lineHeight: 64, color: '#fff' }}>{s.big}</T>}
          {!!s.unit && <T style={{ fontFamily: F.black, fontSize: 24, color: s.bg[1], marginTop: -8 }}>{s.unit}</T>}
          {!!s.sub && <T style={{ fontSize: 17, lineHeight: 24, color: 'rgba(255,255,255,0.88)', fontFamily: F.bold }}>{s.sub}</T>}
          {!!s.row?.length && <View style={{ flexDirection: 'row', gap: 14 }}>{s.row.map((e, k) => <T key={k} style={{ fontSize: 40 }}>{e}</T>)}</View>}
          {!!s.bars && <>
            <View style={{ height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
              {s.bars.map((v, h) => <View key={h} style={{ flex: 1, height: `${Math.max(3, (v / mx) * 100)}%`, borderRadius: 3, backgroundColor: h === pk ? s.bg[1] : 'rgba(255,255,255,0.3)' }} />)}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{['00', '06', '12', '18', '23'].map(x => <T key={x} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{x}</T>)}</View>
          </>}
          {!!s.list?.length && <View style={{ gap: 8 }}>{s.list.slice(0, 5).map((x, k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.25)' }}>
              {x.av ? <Avatar name={x.av} size={40} /> : <View style={{ width: 40, alignItems: 'center' }}><T style={{ fontSize: 24, fontFamily: F.black }}>{x.e}</T></View>}
              <View style={{ flex: 1 }}><T numberOfLines={1} style={{ fontFamily: F.black, fontSize: 16, color: '#fff' }}>{x.t}</T>{!!x.s && <T numberOfLines={1} style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{x.s}</T>}</View>
            </View>
          ))}</View>}
          {!!s.summary && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{s.summary.map(([a, b], k) => (
            <View key={k} style={{ width: '48%', padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <T adjustsFontSizeToFit numberOfLines={1} style={{ fontFamily: F.black, fontSize: 24, color: '#fff' }}>{a}</T><T style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>{b}</T>
            </View>
          ))}</View>}
          {!!s.who?.length && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{s.who.map(n => <Avatar key={n} name={n} size={30} />)}<T style={{ color: 'rgba(255,255,255,0.75)' }}>ve kankaları</T></View>}
        </View>
      </Pressable>
      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 14 }}>
        <Button title="Paylaş" onPress={share} />
      </View>
    </View>
  );
}
