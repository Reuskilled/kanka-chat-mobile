import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ask, displayName, fire, findChannel, onSocket, useKanka, useReady } from '@/lib/kanka';
import { joinVoice } from '@/lib/voice';
import { C, F } from '@/lib/theme';
import { Screen, Section, Row, Chips, Empty } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { Pisti, Kart, Asmaca } from '@/components/ArenaGames';

// Sitedekiyle aynı oyunlar. Gerçek zamanlı olanlar (çizim + fizik) telefonda henüz oynanmıyor: lobide görünür, webden oynanır.
const GAMES: Record<string, { e: string; ad: string; d: string; n: string; mobile: boolean }> = {
  pisti: { e: '🃏', ad: 'Pişti', d: 'Klasik Pişti. Tek kartı aynısıyla al: Pişti!', n: '2 kişi', mobile: true },
  kart: { e: '🌈', ad: 'Kanka Kart', d: 'Renk ya da sayı eşle, elindeki kartları ilk bitiren kazanır.', n: '2-6 kişi', mobile: true },
  asmaca: { e: '🔤', ad: 'Harf Tahmin', d: 'Sırayla harf söyle, kelimeyi bil, puanları topla.', n: '2-8 kişi', mobile: true },
  bilardo: { e: '🎱', ad: 'Bilardo', d: '8 top. Kendi grubunu sok, en son 8 numarayı.', n: '2 kişi', mobile: false },
  dart: { e: '🎯', ad: 'Dart', d: '301\'den sıfıra ilk inen kazanır.', n: '2-4 kişi', mobile: false },
  bilek: { e: '💪', ad: 'Bilek Güreşi', d: 'Güç topla, tam zamanında bas.', n: '2 kişi', mobile: false },
  hokey: { e: '🏒', ad: 'Masa Hokeyi', d: 'Pakı rakibin kalesine sok. 7 gol alan kazanır.', n: '2 kişi', mobile: false },
};
type Sum = { id: string; game: string; host: string; players: string[]; max: number; state: string };
type Lobby = Sum & { ch: string; min: number; rt: boolean; watchers: number; g: any; ps: string[] | null; res: { rank: string[]; draw: boolean; delta: Record<string, number>; forfeit: string | null } | null; rematch: string[]; turnAt: number | null; turnSec: number | null };

function Countdown({ at, sec }: { at: number; sec: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.round(sec - (now - at) / 1000));
  return <T style={{ fontSize: 12.5, color: left < 10 ? '#f87171' : C.muted, fontFamily: F.bold }}>{left} sn</T>;
}

export default function Arena() {
  const p = useLocalSearchParams<{ lobi?: string; ch?: string }>();
  const ready = useReady();
  const me = useKanka(s => s.me)!;
  const myVoice = useKanka(s => s.myVoice);
  const ch = p.ch || (myVoice && !myVoice.startsWith('call:') ? myVoice : null);
  const [list, setList] = useState<Sum[]>([]);
  const [L, setL] = useState<Lobby | null>(null);
  const [open, setOpen] = useState<string | null>(p.lobi || null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'oda' | 'sira'>('oda');
  const [top, setTop] = useState<{ list: { name: string; r?: number; w?: number; p?: number }[]; myRank: number | null } | null>(null);
  const roomName = ch ? findChannel(ch)?.channel.name : null;

  // Odadaki lobiler (canlı)
  useEffect(() => {
    if (!ready || !ch) return;
    let a = true;
    ask<{ lobbies: Sum[] }>('arenaWatch', { ch }).then(r => { if (a) setList(r?.lobbies || []); });
    const off = onSocket('arenaCh', (x: { ch: string; lobbies: Sum[] }) => { if (x.ch === ch) setList(x.lobbies); });
    return () => { a = false; off(); fire('arenaWatch', {}); };
  }, [ready, ch]);
  // Açık lobi (canlı)
  useEffect(() => {
    if (!ready || !open) return;
    let a = true;
    ask<{ lobby?: Lobby; error?: string }>('arenaOpen', { id: open }).then(r => { if (!a) return; if (r?.lobby) setL(r.lobby); else { setMsg(r?.error || 'Lobi bulunamadı'); setOpen(null); } });
    const o1 = onSocket('arena', (v: Lobby) => { if (v.id === open) setL(v); });
    const o2 = onSocket('arenaGone', (x: { id: string; why: string }) => { if (x.id === open) { setMsg(x.why); setOpen(null); setL(null); } });
    const o3 = onSocket('arenaNote', (x: { id: string; text: string }) => { if (x.id === open) setMsg(x.text); });
    return () => { a = false; o1(); o2(); o3(); fire('arenaClose'); };
  }, [ready, open]);
  useEffect(() => { if (!ready || tab !== 'sira') return; let a = true; ask('arenaTop', {}).then(r => { if (a) setTop(r as any); }); return () => { a = false; }; }, [ready, tab]);

  const call = async (ev: string, payload: Record<string, unknown>) => {
    setMsg(null);
    const r = await ask<{ error?: string; needVoice?: string; lobby?: Lobby }>(ev, payload);
    if (r?.needVoice) { const j = await joinVoice(r.needVoice); if (j.error) return setMsg(j.error); return call(ev, payload); }
    if (r?.error) setMsg(r.error);
    return r;
  };
  const create = async (game: string) => { const r = await call('arenaCreate', { game }); if (r?.lobby) { setL(r.lobby); setOpen(r.lobby.id); } };
  const move = (mv: Record<string, unknown>) => { if (L) call('arenaMove', { id: L.id, mv }); };
  const back = () => { if (open) { setOpen(null); setL(null); } else router.back(); };

  // ---- Lobi / oyun ----
  if (open) {
    if (!L) return <Screen title="Arena"><Empty text="Yükleniyor…" /></Screen>;
    const G = GAMES[L.game], inIt = L.players.includes(me), host = L.host === me;
    const ps = L.ps || L.players;
    return (
      <Screen title={`${G?.e || '🎮'} ${G?.ad || L.game}`} sub={L.state === 'lobby' ? `Lobi · ${L.players.length}/${L.max}` : L.state === 'play' ? `Oyunda · ${L.watchers} izleyici` : 'Bitti'}
        right={<Button kind="ghost" title="Listeye dön" style={{ height: 36, paddingHorizontal: 12, marginRight: 6 }} onPress={back} />}>
        {!!msg && <T accessibilityLiveRegion="polite" style={{ color: '#fbbf24', fontFamily: F.bold, textAlign: 'center' }}>{msg}</T>}
        {L.state === 'lobby' && (
          <>
            <Section title="Oyuncular">
              {L.players.map((n, i) => <Row key={n} left={<Avatar name={n} size={34} />} title={n === me ? 'Sen' : displayName(n)} sub={n === L.host ? 'Lobiyi açan' : undefined} last={i === L.players.length - 1}
                right={host && n !== me ? <Button kind="ghost" title="Çıkar" style={{ height: 34, paddingHorizontal: 12 }} onPress={() => call('arenaKick', { id: L.id, name: n })} /> : undefined} />)}
            </Section>
            {!G?.mobile && <T style={{ color: C.muted, textAlign: 'center' }}>Bu oyun çizim ve anlık hareket istediği için şimdilik webden ve masaüstünden oynanıyor. Telefondan lobiye katılabilirsin.</T>}
            {host ? <Button title={L.players.length < L.min ? `En az ${L.min} oyuncu gerekli` : 'Oyunu başlat'} disabled={L.players.length < L.min} onPress={() => call('arenaStart', { id: L.id })} />
              : inIt ? <T style={{ textAlign: 'center', color: C.muted }}>{displayName(L.host)} başlatınca oyun açılacak</T>
                : <Button title="Lobiye katıl" disabled={L.players.length >= L.max} onPress={() => call('arenaJoin', { id: L.id })} />}
            {inIt && <Button kind="ghost" title="Lobiden ayrıl" onPress={async () => { await call('arenaLeave', { id: L.id }); back(); }} />}
          </>
        )}
        {L.state === 'play' && (
          <>
            {!!L.turnAt && !!L.turnSec && <View style={{ alignItems: 'center' }}><Countdown at={L.turnAt} sec={L.turnSec} /></View>}
            {L.game === 'pisti' ? <Pisti g={L.g} ps={ps} me={me} move={move} />
              : L.game === 'kart' ? <Kart g={L.g} ps={ps} me={me} move={move} />
                : L.game === 'asmaca' ? <Asmaca g={L.g} ps={ps} me={me} move={move} />
                  : <Empty text="Bu oyun şimdilik webden ve masaüstünden oynanıyor. Bitince sonucu burada görürsün." />}
            {inIt && <Button kind="danger" title="Oyundan çekil" onPress={async () => { await call('arenaLeave', { id: L.id }); }} />}
          </>
        )}
        {L.state === 'end' && L.res && (
          <>
            <View style={{ alignItems: 'center', gap: 6, padding: 18, borderRadius: 20, backgroundColor: C.card }}>
              <T style={{ fontSize: 40 }}>{L.res.draw ? '🤝' : '🏆'}</T>
              <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 20 }}>{L.res.draw ? 'Berabere' : `${L.res.rank[0] === me ? 'Kazandın!' : displayName(L.res.rank[0]) + ' kazandı'}`}</T>
              {!!L.res.forfeit && <T style={{ color: C.muted }}>{displayName(L.res.forfeit)} oyundan çekildi</T>}
            </View>
            <Section title="Sıralama">
              {L.res.rank.map((n, i) => {
                const d = L.res!.delta?.[n];
                return <Row key={n} left={<T style={{ fontFamily: F.black, width: 22 }}>{i + 1}.</T>} title={n === me ? 'Sen' : displayName(n)} last={i === L.res!.rank.length - 1}
                  right={d !== undefined ? <T style={{ fontFamily: F.black, color: d >= 0 ? C.online : '#f87171' }}>{d >= 0 ? '+' : ''}{d}</T> : undefined} />;
              })}
            </Section>
            {G?.mobile && <Button title={L.rematch.includes(me) ? `Rövanş bekleniyor (${L.rematch.length})` : 'Rövanş'} disabled={L.rematch.includes(me)} onPress={() => call('arenaRematch', { id: L.id })} />}
          </>
        )}
      </Screen>
    );
  }

  // ---- Oda: lobiler + yeni oyun ----
  return (
    <Screen title="Arena" sub={roomName ? `🔊 ${roomName}` : 'Sesli odada oyunlar'}>
      <Chips value={tab} options={[['oda', 'Bu oda'], ['sira', 'Sıralama']]} onChange={setTab} />
      {!!msg && <T accessibilityLiveRegion="polite" style={{ color: '#fbbf24', fontFamily: F.bold, textAlign: 'center' }}>{msg}</T>}
      {tab === 'sira' ? (
        !top ? <Empty text="Yükleniyor…" /> : (
          <Section title={top.myRank ? `Sen ${top.myRank}. sıradasın` : 'Arena sıralaması'}>
            {top.list.length ? top.list.slice(0, 30).map((x, i) => <Row key={x.name} left={<T style={{ fontFamily: F.black, width: 26, color: i < 3 ? C.accent : C.ink }}>{i + 1}.</T>} title={x.name === me ? 'Sen' : displayName(x.name)} sub={x.r ? `${x.r} puan · ${x.w ?? 0} galibiyet` : undefined} last={i === Math.min(29, top.list.length - 1)} />)
              : <Empty text="Henüz kimse oynamamış." />}
          </Section>
        )
      ) : !ch ? (
        <View style={{ gap: 10, padding: 8 }}>
          <Empty text="Arena oyunları sesli odalarda oynanır. Bir sunucunun sesli odasına gir, sonra buradan lobi aç ya da açık lobiye katıl." />
        </View>
      ) : (
        <>
          <Section title={`Açık lobiler (${list.length})`}>
            {list.length ? list.map((l, i) => {
              const G = GAMES[l.game];
              return <Row key={l.id} left={<T style={{ fontSize: 26 }}>{G?.e || '🎮'}</T>} title={G?.ad || l.game} sub={`${l.state === 'play' ? 'Oyunda' : l.state === 'end' ? 'Bitti' : 'Bekliyor'} · ${l.players.map(displayName).join(', ')} · ${l.players.length}/${l.max}`}
                onPress={() => { setMsg(null); setOpen(l.id); }} last={i === list.length - 1} />;
            }) : <Empty text="Bu odada açık lobi yok. Aşağıdan bir oyun seç." />}
          </Section>
          <Section title="Yeni oyun aç">
            {Object.entries(GAMES).map(([k, g], i, a) => (
              <Row key={k} left={<T style={{ fontSize: 26 }}>{g.e}</T>} title={g.ad} sub={g.mobile ? `${g.d} · ${g.n}` : `${g.n} · telefonda yakında (webden oynanır)`} last={i === a.length - 1}
                onPress={g.mobile ? () => create(k) : undefined} />
            ))}
          </Section>
          {myVoice !== ch && <Pressable onPress={() => joinVoice(ch)} style={{ alignSelf: 'center', padding: 8 }}><T style={{ color: C.accent, fontFamily: F.heavy }}>Oynamak için bu sesli odaya gir</T></Pressable>}
        </>
      )}
    </Screen>
  );
}
