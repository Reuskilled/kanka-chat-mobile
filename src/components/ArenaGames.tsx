// Arena: sıra tabanlı oyunların telefondaki çizimi. Oyun durumu sunucuda; burada sadece görünüm ve hamle.
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { C, F } from '@/lib/theme';
import { displayName } from '@/lib/kanka';
import { T, Button } from './ui';
import { Avatar } from './Avatar';

export type Move = (mv: Record<string, unknown>) => void;
const who = (p: string, me: string) => (p === me ? 'Sen' : displayName(p));
type G = Record<string, any>;

// ---------- Ortak ----------
function Seats({ ps, me, turn, extra }: { ps: string[]; me: string; turn?: string; extra?: (p: string) => string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {ps.map(p => (
        <View key={p} accessibilityLabel={`${displayName(p)}${p === turn ? ', sıra onda' : ''}${extra ? ', ' + extra(p) : ''}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: p === turn ? C.accentSoft : C.card, borderWidth: 1.5, borderColor: p === turn ? C.accent : 'transparent' }}>
          <Avatar name={p} size={28} />
          <View>
            <T numberOfLines={1} style={{ fontFamily: F.heavy, fontSize: 13, maxWidth: 110 }}>{p === me ? 'Sen' : displayName(p)}</T>
            {!!extra && <T style={{ fontSize: 11.5, color: C.muted }}>{extra(p)}</T>}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
const TurnLine = ({ mine, who }: { mine: boolean; who?: string }) => (
  <T accessibilityLiveRegion="polite" style={{ textAlign: 'center', fontFamily: F.black, fontSize: 16, color: mine ? C.accent : C.muted }}>{mine ? 'Sıra sende' : who ? `${displayName(who)} oynuyor…` : ''}</T>
);

// ---------- Pişti ----------
const SUIT: Record<string, [string, string]> = { S: ['♠', 'maça'], H: ['♥', 'kupa'], D: ['♦', 'karo'], C: ['♣', 'sinek'] };
const RANK_TR: Record<string, string> = { A: 'as', J: 'vale', Q: 'kız', K: 'papaz' };
const cardName = (c: string) => { const r = c.slice(0, -1), s = SUIT[c.slice(-1)]; return `${s?.[1] || ''} ${RANK_TR[r] || r}`; };
export function PlayingCard({ c, w = 58, onPress, dim, back }: { c?: string | null; w?: number; onPress?: () => void; dim?: boolean; back?: boolean }) {
  const h = Math.round(w * 1.42);
  if (back || !c) return <View style={{ width: w, height: h, borderRadius: 8, backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' }}><T style={{ color: '#475569', fontFamily: F.black, fontSize: w * 0.35 }}>K</T></View>;
  const r = c.slice(0, -1), s = c.slice(-1), red = s === 'H' || s === 'D', col = red ? '#dc2626' : '#111827';
  return (
    <Pressable accessibilityRole={onPress ? 'button' : 'image'} accessibilityLabel={cardName(c)} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => ({ width: w, height: h, borderRadius: 8, backgroundColor: '#fafafa', padding: 4, opacity: dim ? 0.45 : 1, transform: [{ translateY: pressed ? -6 : 0 }], shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 })}>
      <T style={{ color: col, fontFamily: F.black, fontSize: w * 0.28, lineHeight: w * 0.32 }}>{r}</T>
      <T style={{ color: col, fontSize: w * 0.24, lineHeight: w * 0.28 }}>{SUIT[s]?.[0]}</T>
      <T style={{ position: 'absolute', right: 5, bottom: 2, color: col, fontSize: w * 0.5 }}>{SUIT[s]?.[0]}</T>
    </Pressable>
  );
}
export function Pisti({ g, ps, me, move }: { g: G; ps: string[]; me: string; move: Move }) {
  const mine = g.turn === me && !!g.hand;
  const ev = g.ev ? (g.ev.pisti ? `${who(g.ev.by, me)} PİŞTİ yaptı! +${g.ev.pisti}` : g.ev.cap ? `${who(g.ev.by, me)} masayı topladı` : '') : '';
  return (
    <View style={{ gap: 14 }}>
      <Seats ps={ps} me={me} turn={g.turn} extra={p => `${g.score?.[p] ?? 0} puan · ${g.caps?.[p] ?? 0} kart`} />
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 20, backgroundColor: '#0f3d26' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <View style={{ alignItems: 'center', gap: 4 }}><PlayingCard back w={50} /><T style={{ fontSize: 11.5, color: '#bbf7d0' }}>Deste {g.deck}</T></View>
          <View style={{ width: 90, height: 100, alignItems: 'center', justifyContent: 'center' }}>
            {g.under && <View style={{ position: 'absolute', transform: [{ rotate: '-8deg' }] }}><PlayingCard c={g.under} w={64} /></View>}
            {g.top ? <View style={{ transform: [{ rotate: '4deg' }] }}><PlayingCard c={g.top} w={64} /></View> : <T style={{ color: '#86efac', fontSize: 13 }}>Masa boş</T>}
          </View>
          <T style={{ fontSize: 12, color: '#bbf7d0', width: 50 }}>{g.tableN} kart masada</T>
        </View>
        {!!ev && <T accessibilityLiveRegion="polite" style={{ color: '#fde047', fontFamily: F.black }}>{ev}</T>}
      </View>
      <TurnLine mine={mine} who={g.turn} />
      {g.hand ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          {g.hand.map((c: string) => <PlayingCard key={c} c={c} w={72} dim={!mine} onPress={mine ? () => move({ card: c }) : undefined} />)}
        </View>
      ) : <T style={{ textAlign: 'center', color: C.muted }}>İzliyorsun</T>}
      <T style={{ fontSize: 12, color: C.faint, textAlign: 'center' }}>Aynı sayı ya da vale masayı alır. Tek kartı aynısıyla alırsan Pişti: 10 puan (vale ile 20).</T>
    </View>
  );
}

// ---------- Kanka Kart ----------
const KC: Record<string, [string, string]> = { r: ['#ef4444', 'kırmızı'], y: ['#eab308', 'sarı'], g: ['#22c55e', 'yeşil'], b: ['#3b82f6', 'mavi'] };
const kLabel = (c: string) => (c === 'w' ? '🌈' : c === 'w4' ? '+4' : ({ s: '⊘', r: '⇄', d: '+2' } as Record<string, string>)[c.slice(1)] || c.slice(1));
const kName = (c: string) => (c === 'w' ? 'renk seçme kartı' : c === 'w4' ? 'artı dört renk seçme' : `${KC[c[0]]?.[1]} ${({ s: 'atla', r: 'yön değiştir', d: 'artı iki' } as Record<string, string>)[c.slice(1)] || c.slice(1)}`);
function KartCard({ c, w = 54, onPress, dim }: { c: string; w?: number; onPress?: () => void; dim?: boolean }) {
  const wild = c[0] === 'w', bg = wild ? '#111827' : KC[c[0]]?.[0];
  return (
    <Pressable accessibilityRole={onPress ? 'button' : 'image'} accessibilityLabel={kName(c)} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => ({ width: w, height: w * 1.45, borderRadius: 10, backgroundColor: bg, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.4 : 1, transform: [{ translateY: pressed ? -6 : 0 }] })}>
      {wild && <View style={{ position: 'absolute', inset: 6, flexDirection: 'row', flexWrap: 'wrap', borderRadius: 6, overflow: 'hidden', opacity: 0.85 }}>{['r', 'y', 'g', 'b'].map(k => <View key={k} style={{ width: '50%', height: '50%', backgroundColor: KC[k][0] }} />)}</View>}
      <T style={{ color: '#fff', fontFamily: F.black, fontSize: w * 0.42, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 }}>{kLabel(c)}</T>
    </Pressable>
  );
}
export function Kart({ g, ps, me, move }: { g: G; ps: string[]; me: string; move: Move }) {
  const [pick, setPick] = useState<number | null>(null);
  const mine = g.turn === me && !!g.hand;
  const play = (i: number) => { const c = g.hand[i]; if (c[0] === 'w') setPick(i); else move({ i }); };
  const ev = g.ev ? (g.ev.left ? `${who(g.ev.left, me)} oyundan ayrıldı` : g.ev.hit ? `${who(g.ev.hit.who, me)} ${g.ev.hit.n} kart çekti` : g.ev.kanka ? `${who(g.ev.by, me)}: KANKA! (1 kart kaldı)` : g.ev.draw ? `${who(g.ev.by, me)} kart çekti${g.ev.pass ? ' ve pas geçti' : ''}` : '') : '';
  return (
    <View style={{ gap: 14 }}>
      <Seats ps={ps} me={me} turn={g.turn} extra={p => `${g.counts?.[p] ?? 0} kart`} />
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16, borderRadius: 20, backgroundColor: C.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Desteden kart çek, ${g.deck} kart kaldı`} disabled={!mine || g.drew} onPress={() => move({ draw: true })}
            style={{ width: 56, height: 80, borderRadius: 10, backgroundColor: '#111827', borderWidth: 3, borderColor: mine && !g.drew ? C.accent : '#374151', alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontFamily: F.black, color: '#fff' }}>ÇEK</T><T style={{ fontSize: 11, color: '#9ca3af' }}>{g.deck}</T>
          </Pressable>
          <KartCard c={g.top} w={64} />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <View accessibilityLabel={`Geçerli renk ${KC[g.color]?.[1]}`} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: KC[g.color]?.[0], borderWidth: 2, borderColor: '#fff' }} />
            <T style={{ fontSize: 18 }}>{g.dir === 1 ? '↻' : '↺'}</T>
          </View>
        </View>
        {!!ev && <T accessibilityLiveRegion="polite" style={{ color: '#fde047', fontFamily: F.black, textAlign: 'center' }}>{ev}</T>}
      </View>
      <TurnLine mine={mine} who={g.turn} />
      {mine && g.drew && <Button kind="ghost" title="Pas geç" onPress={() => move({ pass: true })} />}
      {pick !== null && (
        <View style={{ gap: 8 }}>
          <T style={{ textAlign: 'center', fontFamily: F.heavy }}>Bir renk seç</T>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
            {Object.entries(KC).map(([k, [col, ad]]) => <Pressable key={k} accessibilityRole="button" accessibilityLabel={ad} onPress={() => { move({ i: pick, color: k }); setPick(null); }} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: col, borderWidth: 3, borderColor: '#fff' }} />)}
          </View>
          <Button kind="ghost" title="Vazgeç" onPress={() => setPick(null)} />
        </View>
      )}
      {g.hand ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {g.hand.map((c: string, i: number) => {
            const ok = mine && !!g.playable?.[i];
            return <KartCard key={i + c} c={c} dim={mine && !ok} onPress={ok ? () => play(i) : undefined} />;
          })}
        </View>
      ) : <T style={{ textAlign: 'center', color: C.muted }}>İzliyorsun</T>}
    </View>
  );
}

// ---------- Harf Tahmin ----------
const ALPHA = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';
export function Asmaca({ g, ps, me, move }: { g: G; ps: string[]; me: string; move: Move }) {
  const [word, setWord] = useState('');
  const mine = g.turn === me && ps.includes(me);
  const ev = g.prev ? `Kelime: ${g.prev.word} · ${g.prev.why}` : g.ev ? (g.ev.left ? `${who(g.ev.left, me)} ayrıldı` : g.ev.word ? `${who(g.ev.by, me)} "${g.ev.word}" dedi${g.ev.ok ? ` · bildi! +${g.ev.pts}` : ' · yanlış'}` : g.ev.letter ? `${who(g.ev.by, me)}: ${g.ev.letter}${g.ev.n ? ` · ${g.ev.n} tane var` : ' · yok'}` : '') : '';
  return (
    <View style={{ gap: 14 }}>
      <Seats ps={ps} me={me} turn={g.turn} extra={p => `${g.scores?.[p] ?? 0} puan`} />
      <View style={{ alignItems: 'center', gap: 10, padding: 16, borderRadius: 20, backgroundColor: C.card }}>
        <T style={{ fontSize: 12.5, color: C.muted, fontFamily: F.heavy }}>Tur {g.round}/{g.rounds} · Kategori: {g.cat}</T>
        <T accessibilityLabel={`Kelime: ${[...String(g.mask)].map(ch => (ch === '_' ? 'boş' : ch === ' ' ? 'boşluk' : ch)).join(', ')}`} style={{ fontFamily: F.black, fontSize: 28, letterSpacing: 6, textAlign: 'center' }}>{g.mask}</T>
        <View accessibilityLabel={`${g.miss} / ${g.maxMiss} hata`} style={{ flexDirection: 'row', gap: 6 }}>
          {Array.from({ length: g.maxMiss }, (_, i) => <View key={i} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: i < g.miss ? C.danger : C.lineStrong }} />)}
        </View>
        {!!ev && <T accessibilityLiveRegion="polite" style={{ color: '#fde047', fontFamily: F.bold, textAlign: 'center' }}>{ev}</T>}
      </View>
      <TurnLine mine={mine} who={g.turn} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
        {[...ALPHA].map(L => {
          const used = g.got?.includes(L) ? 'ok' : g.wrong?.includes(L) ? 'no' : '';
          return (
            <Pressable key={L} accessibilityRole="button" accessibilityLabel={`${L} harfi${used === 'ok' ? ', var' : used === 'no' ? ', yok' : ''}`} disabled={!mine || !!used} onPress={() => move({ letter: L })}
              style={{ width: 40, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: used === 'ok' ? 'rgba(34,197,94,0.25)' : used === 'no' ? 'rgba(239,68,68,0.18)' : C.field, opacity: !mine && !used ? 0.5 : 1 }}>
              <T style={{ fontFamily: F.black, fontSize: 16, color: used === 'no' ? '#f87171' : C.ink }}>{L}</T>
            </Pressable>
          );
        })}
      </View>
      {mine && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput value={word} onChangeText={setWord} placeholder="Kelimeyi biliyorsan yaz" placeholderTextColor={C.faint} accessibilityLabel="Kelime tahmini" autoCapitalize="characters"
            style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: C.card, color: C.ink, paddingHorizontal: 14, fontFamily: F.bold, fontSize: 15 }} />
          <Button title="Tahmin" style={{ height: 48, paddingHorizontal: 16 }} disabled={!word.trim()} onPress={() => { move({ word }); setWord(''); }} />
        </View>
      )}
      <T style={{ fontSize: 12, color: C.faint, textAlign: 'center' }}>Doğru harf: harf başına 10 puan. Kelimeyi bilen: 20 + açılmamış her harf için 5. Yanlış kelime: -5.</T>
    </View>
  );
}
