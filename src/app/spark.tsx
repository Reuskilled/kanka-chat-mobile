import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ask, onSocket, useKanka, useReady } from '@/lib/kanka';
import { SERVER } from '@/lib/config';
import { buy, loadOffer, manage, PLAY_OK, type Offer } from '@/lib/play';
import { SKU, onSparkNote, restoreSpark } from '@/lib/sparkSync';
import { C, F } from '@/lib/theme';
import { Screen, Section, Row, Empty } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';
import { Icon } from '@/components/Icon';

type Placed = { sid: string; n: number; name: string; level: number; total: number };
type Me = { active: boolean; until?: number; play?: boolean; playYenile?: boolean | null; energy?: number; free?: number; placed?: Placed[]; months?: number; nextBonusIn?: number;
  perMonth?: number; bonusEvery?: number; perks?: string[][]; playHazir?: boolean; playHesap?: string; error?: string };
const DONEM: Record<string, string> = { P1W: 'hafta', P1M: 'ay', P3M: '3 ay', P6M: '6 ay', P1Y: 'yıl' };
const donem = (p: string) => DONEM[p] || p;
const tarih = (t?: number) => (t ? new Date(t).toLocaleDateString('tr-TR') : '');
const KOSUL = `${SERVER}/kosullar#spark-on-bilgi`;

function Check({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => onChange(!on)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 6 }}>
      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: on ? C.accent : C.lineStrong, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {on && <T style={{ color: C.onAccent, fontFamily: F.black, fontSize: 14, lineHeight: 16 }}>✓</T>}
      </View>
      <T style={{ flex: 1, fontSize: 14, lineHeight: 20, color: C.ink2 }}>{children}</T>
    </Pressable>
  );
}

export default function Spark() {
  const ready = useReady();
  const minor = useKanka(s => s.minor);
  const servers = useKanka(s => s.servers);
  const [m, setM] = useState<Me | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null), [offErr, setOffErr] = useState('');
  const [veli, setVeli] = useState(false), [cayma, setCayma] = useState(false);
  const [busy, setBusy] = useState<string | null>(null), [note, setNote] = useState<{ text: string; tone: string } | null>(null);
  const [wait, setWait] = useState<{ bekliyor: boolean; sayi: number } | null>(null);
  const [ver, setVer] = useState(0);
  const reload = useCallback(() => setVer(v => v + 1), []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    ask<Me>('sparkMe', {}).then(async r => {
      if (!alive) return; setM(r);
      if (!r?.active && r?.playHazir && PLAY_OK) { const o = await loadOffer(SKU); if (alive) { setOffer(o.offer || null); setOffErr(o.error || ''); } }
      if (!r?.playHazir || !PLAY_OK) ask<{ bekliyor: boolean; sayi: number }>('sparkInfo', {}).then(w => { if (alive && w && !(w as any).error) setWait(w); });
    });
    return () => { alive = false; };
  }, [ready, ver]);
  useEffect(() => onSparkNote(n => { setNote(n); reload(); }), [reload]);
  useEffect(() => onSocket('spark', reload), [reload]);

  const canBuy = cayma && (!minor || veli);
  const subscribe = async () => {
    if (!offer || !m?.playHesap || !canBuy) return;
    setBusy('buy');
    // Onay, Google Play açılmadan önce tarihiyle sunucuya kaydedilir (cayma hakkı istisnasının ispatı)
    const r = await ask<{ ok?: boolean; error?: string }>('sparkOnay', { fiyat: offer.rec.price, donem: offer.rec.period, veli: minor ? true : undefined });
    if (!r?.ok) { setBusy(null); return setNote({ text: r?.error || 'Onay kaydedilemedi, tekrar dene', tone: 'err' }); }
    try { await buy(offer, m.playHesap); } catch (e: any) { setNote({ text: 'Google Play açılamadı: ' + (e?.message || e), tone: 'err' }); }
    setBusy(null);
  };
  const energy = async (sid: string, pull: boolean) => {
    setBusy(sid + pull);
    const r = await ask<{ error?: string; levelUp?: boolean; server?: { level: number } }>('energyMove', { serverId: sid, n: 1, pull });
    setBusy(null);
    setNote(r?.error ? { text: r.error, tone: 'err' } : { text: pull ? '1 Energy geri çekildi' : r?.levelUp ? `⚡ Sunucu Energy Level ${r.server?.level}'e çıktı!` : '⚡ 1 Energy gönderildi', tone: r?.error ? 'err' : 'good' });
    reload();
  };
  const toggleWait = async () => {
    const r = await ask<{ bekliyor: boolean; sayi: number; error?: string }>('sparkWait', { on: !wait?.bekliyor });
    if (r?.error) return setNote({ text: r.error, tone: 'err' });
    setWait(r); if (r.bekliyor) setNote({ text: 'Spark çıkınca ilk sen duyacaksın ✨', tone: 'good' });
  };

  if (!m) return <Screen title="Kanka Spark"><Empty text="Yükleniyor…" /></Screen>;
  if (m.error) return <Screen title="Kanka Spark"><Empty text={m.error} /></Screen>;
  const rec = offer?.rec, intro = offer?.intro;
  const sendable = servers.filter(s => !s.public);
  const perks: [string, string, string][] = [
    ['crown', 'Spark rozeti', 'Profilinde ve üye listesinde, ne zamandan beri destekçi olduğunu gösteren rozet.'],
    ['palette', 'Profil renk teması', 'Profil kartını iki renkli kendi temanla boya.'],
    ['sparkle', 'Profil açılış efekti', 'Biri profilini açınca patlama, portal, konfeti, neon gibi 8 efektten biri oynar.'],
    ['zap', `Her ay ${m.perMonth ?? 2} Energy`, `Sevdiğin sunuculara gönder, istediğin zaman geri çek. Her ${m.bonusEvery ?? 3} kesintisiz ayda +1 bonus Energy.`],
    ['star', 'Sunuculara seviye kazandır', (m.perks || []).slice(1).map((p, i) => `Level ${i + 1}: ${p.join(', ')}`).join(' · ')],
  ];

  return (
    <Screen title="Kanka Spark">
      {!!note && (
        <Pressable onPress={() => setNote(null)} accessibilityLiveRegion="polite" style={{ padding: 12, borderRadius: 14, backgroundColor: note.tone === 'err' ? 'rgba(239,68,68,0.14)' : note.tone === 'good' ? C.accentSoft : C.card }}>
          <T style={{ fontFamily: F.bold, fontSize: 14, color: note.tone === 'err' ? '#f87171' : C.ink }}>{note.text}</T>
        </Pressable>
      )}
      <View style={{ borderRadius: 22, overflow: 'hidden' }}>
        <LinearGradient colors={['#2a3300', '#0f1200']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T style={{ color: C.accent, fontFamily: F.black, fontSize: 13, letterSpacing: 2 }}>⚡ SPARK</T>
            {m.active && <View style={{ paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: C.accent, justifyContent: 'center' }}><T style={{ color: C.onAccent, fontFamily: F.black, fontSize: 11 }}>AÇIK</T></View>}
          </View>
          {m.active ? (
            <>
              <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 22 }}>Spark&apos;ın açık</T>
              <T style={{ color: C.ink2, lineHeight: 21 }}>{m.play ? (m.playYenile === false ? `Aboneliğin iptal edildi; ${tarih(m.until)} tarihine kadar açık kalır.` : `Google Play üzerinden otomatik yenilenir. Sonraki yenileme: ${tarih(m.until)}`) : `${tarih(m.until)} tarihine kadar açık.`}</T>
              <T style={{ color: C.ink2 }}>Boşta <T style={{ fontFamily: F.black }}>{m.free}</T> Energy&apos;n var · toplam {m.energy}{m.nextBonusIn ? ` · ${m.nextBonusIn} ay sonra bonus` : ''}</T>
              {m.play && <Button kind="ghost" title="Aboneliği yönet / iptal et" onPress={() => manage(SKU)} />}
            </>
          ) : !PLAY_OK ? (
            <>
              <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 22 }}>Kanka Spark</T>
              <T style={{ color: C.ink2, lineHeight: 21 }}>Spark aboneliği şimdilik Android uygulamasından alınabiliyor. iPhone için hazırlanıyor.</T>
            </>
          ) : !m.playHazir ? (
            <>
              <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 22 }}>Çok yakında</T>
              <T style={{ color: C.ink2, lineHeight: 21 }}>Abonelik birazdan bu ekrandan açılacak. Açılınca haber verelim mi?</T>
              <Button title={wait?.bekliyor ? 'Listedesin ✓' : 'Çıkınca haber ver'} kind={wait?.bekliyor ? 'ghost' : 'primary'} onPress={toggleWait} />
              {!!wait?.sayi && <T style={{ fontSize: 12.5, color: C.muted }}>{wait.sayi} kişi bekliyor</T>}
            </>
          ) : !offer ? (
            <>
              <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 22 }}>Kanka Spark</T>
              {offErr ? <T style={{ color: C.ink2, lineHeight: 21 }}>Abonelik bilgisi Google Play&apos;den alınamadı ({offErr}). İnternetini ve Google Play oturumunu kontrol edip tekrar dene.</T> : <ActivityIndicator color={C.accent} />}
              {!!offErr && <Button kind="ghost" title="Tekrar dene" onPress={reload} />}
            </>
          ) : (
            <>
              <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 22 }}>Kanka Spark</T>
              <T><T style={{ fontFamily: F.black, fontSize: 28, color: C.accent }}>{rec!.price}</T><T style={{ color: C.muted, fontSize: 16 }}> / {donem(rec!.period)}</T></T>
              {intro && <T style={{ color: C.ink2, fontSize: 13.5, lineHeight: 19 }}>{intro.free ? `İlk ${donem(intro.period)}${intro.count > 1 ? ` × ${intro.count}` : ''} ücretsiz` : `İlk ${intro.count > 1 ? intro.count + ' ' : ''}${donem(intro.period)} ${intro.price}`}, sonra {rec!.price} / {donem(rec!.period)}. Uygunluğu Google Play belirler.</T>}
            </>
          )}
        </LinearGradient>
      </View>

      {!m.active && offer && (
        <View style={{ gap: 6 }}>
          <View style={{ padding: 12, borderRadius: 14, backgroundColor: C.card, gap: 4 }}>
            <T style={{ fontFamily: F.black, fontSize: 13.5 }}>Ön bilgilendirme</T>
            <T style={{ fontSize: 12.5, lineHeight: 18, color: C.muted }}>Hizmet: Kanka Spark dijital abonelik · Fiyat: {offer.rec.price} / {donem(offer.rec.period)} (vergiler dahil, Google Play&apos;in gösterdiği tutar) · Ödeme Google Play üzerinden alınır · Hizmet ödeme onaylanınca anında açılır · İptal etmediğin sürece otomatik yenilenir.</T>
            <T onPress={() => Linking.openURL(KOSUL)} style={{ fontSize: 12.5, color: '#7dd3fc', textDecorationLine: 'underline' }}>Ön bilgilendirme metninin tamamı</T>
          </View>
          {minor && <Check on={veli} onChange={setVeli}>18 yaşından küçüğüm, bu satın alma için <T style={{ fontFamily: F.black }}>velimin izni var</T>.</Check>}
          <Check on={cayma} onChange={setCayma}>Ön bilgilendirme koşullarını okudum. Hizmetin <T style={{ fontFamily: F.black }}>hemen başlamasını onaylıyorum</T> ve bu nedenle <T style={{ fontFamily: F.black }}>cayma hakkımı kaybedeceğimi</T> biliyorum.</Check>
          <Button title="Abone ol" icon={<Icon name="zap" size={18} color={C.onAccent} />} busy={busy === 'buy'} disabled={!canBuy} onPress={subscribe} />
          <T style={{ fontSize: 12, lineHeight: 17, color: C.faint }}>Ödeme Google Play hesabından alınır. Abonelik, iptal etmediğin sürece her {donem(offer.rec.period)} aynı ücretle otomatik yenilenir. İstediğin zaman Google Play › Ödemeler ve abonelikler bölümünden iptal edebilirsin; iptal edersen dönem sonuna kadar Spark açık kalır. Kanka hesabını silmek aboneliği iptal etmez.</T>
        </View>
      )}

      {(m.active || !!m.energy) && (
        <Section title="Energy cüzdanı" hint={m.free ? 'Boştaki Energy\'ni bir sunucuya gönder; istediğin zaman geri çekebilirsin.' : undefined}>
          {(m.placed || []).length ? (m.placed || []).map((p, i) => (
            <Row key={p.sid} icon="zap" iconColor={C.accent} title={p.name} sub={`Senin ${p.n} Energy'n · Toplam ${p.total} · Level ${p.level}`} last={i === (m.placed || []).length - 1 && !m.free}
              right={<Button kind="ghost" title="Geri çek" busy={busy === p.sid + 'true'} style={{ height: 36, paddingHorizontal: 12 }} onPress={() => energy(p.sid, true)} />} />
          )) : <T style={{ padding: 14, color: C.muted, fontSize: 13.5 }}>Henüz bir sunucuya Energy göndermedin.</T>}
          {!!m.free && sendable.map((s, i) => (
            <Row key={s.id} title={s.name} sub="Bu sunucuya 1 Energy gönder" last={i === sendable.length - 1}
              right={<Button title="Gönder" busy={busy === s.id + 'false'} style={{ height: 36, paddingHorizontal: 14 }} onPress={() => energy(s.id, false)} />} />
          ))}
        </Section>
      )}

      <Section title="Spark'ta neler var">
        {perks.map(([ic, b, t], i) => <Row key={b} icon={ic} iconColor={C.accent} title={b} sub={t} last={i === perks.length - 1} />)}
      </Section>
      <T style={{ fontSize: 12.5, color: C.muted, paddingHorizontal: 4 }}>Sohbet, sesli odalar, aramalar ve botlar Spark olmadan da tamamen ücretsiz.</T>
      {PLAY_OK && <Button kind="ghost" title="Satın alımları geri yükle" onPress={() => { setNote({ text: 'Google Play\'e soruluyor…', tone: 'info' }); restoreSpark(true); }} />}
      <Pressable onPress={() => Linking.openURL(`${SERVER}/kosullar`)} accessibilityRole="link" style={{ alignSelf: 'center', padding: 8 }}><T style={{ color: C.faint, fontSize: 12.5 }}>Kullanım Şartları ve Gizlilik webde: kankahq.com/kosullar</T></Pressable>
    </Screen>
  );
}
