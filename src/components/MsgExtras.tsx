// Mesaj türleri: anket, plan, zar / yazı-tura / XOX, şarkı; iletildi etiketi, yanıt dizisi düğmesi; zengin metin (kalın, italik, spoiler, sunucu emojisi)
import { useState } from 'react';
import { Alert, Linking, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { displayName, emojiMap, findChannel, openUser, planToggle, ticketClaim, ticketClose, ticketOpen, useKanka, vote, xoxMove } from '@/lib/kanka';
import { Sheet } from './AdminUI';
import type { Msg } from '@/lib/types';
import { T } from './ui';
import { Icon } from './Icon';
import { Avatar } from './Avatar';

// ---- Zengin metin ----
type Tok = { t: 'txt' | 'b' | 'i' | 's' | 'sp' | 'code' | 'men' | 'url' | 'emo'; v: string; u?: string };
const RE = /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|\|\|[^|\n]+\|\||`[^`\n]+`|(?<![\w*])\*[^*\n]+\*(?!\w)|(?<![\w_])_[^_\n]+_(?!\w)|@[\p{L}\p{N}_.-]{2,20}|https?:\/\/[^\s<>"']+|:[a-z0-9_]{2,24}:)/u;
function toks(text: string, em: Record<string, string>): Tok[] {
  const out: Tok[] = [];
  for (const p of text.split(new RegExp(RE.source, 'gu'))) {
    if (!p) continue;
    if (/^\*\*.+\*\*$/.test(p)) out.push({ t: 'b', v: p.slice(2, -2) });
    else if (/^~~.+~~$/.test(p)) out.push({ t: 's', v: p.slice(2, -2) });
    else if (/^\|\|.+\|\|$/.test(p)) out.push({ t: 'sp', v: p.slice(2, -2) });
    else if (/^`.+`$/.test(p)) out.push({ t: 'code', v: p.slice(1, -1) });
    else if (/^\*.+\*$/.test(p) || /^_.+_$/.test(p)) out.push({ t: 'i', v: p.slice(1, -1) });
    else if (/^@/.test(p)) out.push({ t: 'men', v: p });
    else if (/^https?:\/\//.test(p)) out.push({ t: 'url', v: p });
    else if (/^:[a-z0-9_]+:$/.test(p) && em[p.slice(1, -1)]) out.push({ t: 'emo', v: p, u: em[p.slice(1, -1)] });
    else out.push({ t: 'txt', v: p });
  }
  return out;
}
function Spoiler({ v }: { v: string }) {
  const [open, setOpen] = useState(false);
  return <T onPress={() => setOpen(true)} accessibilityLabel={open ? v : 'Spoiler, görmek için dokun'} style={{ fontSize: 15, backgroundColor: open ? C.field : '#3f3f46', color: open ? C.ink2 : 'transparent', borderRadius: 4 }}>{v}</T>;
}
export function RichText({ text, me, chId }: { text: string; me: string | null; chId?: string }) {
  const em = emojiMap(chId);
  const parts = toks(text, em);
  const onlyEmo = parts.every(p => p.t === 'emo' || (p.t === 'txt' && !p.v.trim())) && parts.some(p => p.t === 'emo');
  const sz = onlyEmo ? 40 : 21;
  return (
    <T selectable style={{ fontSize: 15, lineHeight: onlyEmo ? 46 : 21, color: C.ink2 }}>
      {parts.map((p, i) => {
        switch (p.t) {
          case 'b': return <T key={i} style={{ fontSize: 15, fontFamily: F.black, color: C.ink }}>{p.v}</T>;
          case 'i': return <T key={i} style={{ fontSize: 15, fontStyle: 'italic', color: C.ink2 }}>{p.v}</T>;
          case 's': return <T key={i} style={{ fontSize: 15, textDecorationLine: 'line-through', color: C.muted }}>{p.v}</T>;
          case 'code': return <T key={i} style={{ fontSize: 14, fontFamily: 'monospace', backgroundColor: C.field, color: C.ink }}>{p.v}</T>;
          case 'sp': return <Spoiler key={i} v={p.v} />;
          case 'men': {
            const n = p.v.slice(1), mine = n.toLocaleLowerCase('tr') === (me || '').toLocaleLowerCase('tr') || /^(everyone|herkes)$/i.test(n);
            return <T key={i} onPress={() => openUser(n)} style={{ fontSize: 15, fontFamily: F.heavy, color: '#e5ff66', backgroundColor: mine ? 'rgba(212,255,0,0.28)' : C.accentSoft, borderRadius: 5 }}>{p.v}</T>;
          }
          case 'url': return <T key={i} onPress={() => Linking.openURL(p.v)} style={{ fontSize: 15, color: '#7dd3fc', textDecorationLine: 'underline' }}>{p.v}</T>;
          case 'emo': return <Image key={i} source={{ uri: abs(p.u) || undefined }} accessibilityLabel={p.v} style={{ width: sz, height: sz, marginBottom: onlyEmo ? 0 : -4 }} contentFit="contain" />;
          default: return p.v;
        }
      })}
    </T>
  );
}

// ---- Anket ----
function Poll({ m, me }: { m: Msg; me: string | null }) {
  const p = m.poll!; const total = p.options.reduce((a, o) => a + o.votes.length, 0);
  return (
    <View style={{ marginTop: 6, padding: 12, borderRadius: 14, backgroundColor: C.card, gap: 8, maxWidth: 340 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="chat" size={15} color={C.accent} /><T style={{ fontSize: 12, fontFamily: F.black, color: C.muted, letterSpacing: 0.5 }}>ANKET</T></View>
      <T style={{ fontFamily: F.black, fontSize: 15.5 }}>{p.question}</T>
      {p.options.map((o, i) => {
        const mine = !!me && o.votes.includes(me), pct = total ? Math.round((o.votes.length / total) * 100) : 0;
        return (
          <Pressable key={i} accessibilityRole="radio" accessibilityState={{ selected: mine }} accessibilityLabel={`${o.text}, ${o.votes.length} oy`} onPress={() => vote(m.id, i)}
            style={{ height: 42, borderRadius: 10, backgroundColor: C.field, overflow: 'hidden', justifyContent: 'center', borderWidth: 1.5, borderColor: mine ? C.accent : 'transparent' }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: mine ? 'rgba(212,255,0,0.22)' : 'rgba(255,255,255,0.07)' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 }}>
              <T numberOfLines={1} style={{ flex: 1, fontFamily: F.heavy, fontSize: 14 }}>{o.text}</T>
              <T style={{ fontSize: 13, color: C.muted, fontFamily: F.heavy }}>{pct}%</T>
            </View>
          </Pressable>
        );
      })}
      <T style={{ fontSize: 12, color: C.faint }}>{total} oy · oy vermek ya da geri almak için dokun</T>
    </View>
  );
}
function Plan({ m, me }: { m: Msg; me: string | null }) {
  const p = m.plan!, going = !!me && p.going.includes(me);
  return (
    <View style={{ marginTop: 6, padding: 12, borderRadius: 14, backgroundColor: C.card, gap: 8, maxWidth: 340 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="clock" size={15} color={C.accent} /><T style={{ fontSize: 12, fontFamily: F.black, color: C.muted, letterSpacing: 0.5 }}>PLAN</T></View>
      <T style={{ fontFamily: F.black, fontSize: 15.5 }}>{p.title}</T>
      {!!p.when && <T style={{ color: C.ink2 }}>🗓️ {p.when}</T>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {p.going.slice(0, 8).map(n => <Avatar key={n} name={n} size={24} />)}
        <T style={{ fontSize: 12.5, color: C.muted, marginLeft: 4 }}>{p.going.length} kişi geliyor</T>
      </View>
      <Pressable accessibilityRole="button" onPress={() => planToggle(m.id)} style={{ height: 38, borderRadius: 10, backgroundColor: going ? C.field : C.accent, alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ fontFamily: F.black, color: going ? C.ink : C.onAccent }}>{going ? 'Gelmiyorum' : 'Ben de varım'}</T>
      </Pressable>
    </View>
  );
}
function Game({ m, me }: { m: Msg; me: string | null }) {
  const g = m.game!;
  if (m.kind === 'dice') return <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: C.card, alignSelf: 'flex-start' }}><T style={{ fontSize: 28 }}>🎲</T><T style={{ fontFamily: F.black, fontSize: 18 }}>{g.result}</T><T style={{ color: C.muted, fontSize: 12.5 }}>/ {g.sides}</T></View>;
  if (m.kind === 'coin') return <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: C.card, alignSelf: 'flex-start' }}><T style={{ fontSize: 28 }}>🪙</T><T style={{ fontFamily: F.black, fontSize: 18 }}>{g.result}</T></View>;
  const b = (g.board || '.........').split('');
  const myTurn = !g.winner && ((g.turn === 'x' && g.x === me) || (g.turn === 'o' && (g.o === me || (!g.o && g.x !== me))));
  const st = g.winner ? (g.winner === 'draw' ? 'Berabere' : `${displayName(g.winner === 'x' ? g.x : g.o)} kazandı 🎉`) : myTurn ? 'Sıra sende' : `Sıra: ${g.turn === 'x' ? displayName(g.x) : g.o ? displayName(g.o) : 'rakip bekleniyor'}`;
  return (
    <View style={{ marginTop: 6, padding: 12, borderRadius: 14, backgroundColor: C.card, gap: 8, alignSelf: 'flex-start' }}>
      <T style={{ fontSize: 12.5, color: C.muted, fontFamily: F.heavy }}>XOX · {displayName(g.x)} vs {g.o ? displayName(g.o) : '?'}</T>
      <View style={{ width: 162, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {b.map((c, i) => (
          <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Kare ${i + 1}${c !== '.' ? ', ' + c.toUpperCase() : ''}`} disabled={!myTurn || c !== '.'} onPress={() => xoxMove(m.id, i)}
            style={{ width: 50, height: 50, borderRadius: 10, backgroundColor: C.bg, borderWidth: 1.5, borderColor: myTurn && c === '.' ? 'rgba(212,255,0,0.35)' : C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontFamily: F.black, fontSize: 24, color: c === 'x' ? C.accent : '#7dd3fc' }}>{c === '.' ? '' : c.toUpperCase()}</T>
          </Pressable>
        ))}
      </View>
      <T style={{ fontSize: 13, fontFamily: F.heavy, color: myTurn ? C.accent : C.ink2 }}>{st}</T>
    </View>
  );
}
function Song({ m }: { m: Msg }) {
  const s = m.song!;
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(s.url)} style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: C.card, maxWidth: 320 }}>
      <T style={{ fontSize: 24 }}>🎵</T>
      <View style={{ flex: 1, minWidth: 0 }}><T numberOfLines={2} style={{ fontFamily: F.heavy }}>{s.title}</T><T style={{ fontSize: 12, color: C.muted }}>Şarkı önerisi · aç</T></View>
    </Pressable>
  );
}

export function MsgKind({ m, me }: { m: Msg; me: string | null }) {
  if (m.kind === 'poll' && m.poll) return <Poll m={m} me={me} />;
  if (m.kind === 'plan' && m.plan) return <Plan m={m} me={me} />;
  if ((m.kind === 'dice' || m.kind === 'coin' || m.kind === 'xox') && m.game) return <Game m={m} me={me} />;
  if (m.kind === 'song' && m.song) return <Song m={m} />;
  return null;
}
export function FwdTag({ m }: { m: Msg }) {
  if (!m.fwd && !m.xfrom) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
      <Icon name="reply" size={12} color={C.faint} />
      <T style={{ fontSize: 12, color: C.faint, fontStyle: 'italic' }}>{m.fwd ? `İletildi${m.fwd.author ? ' · ' + displayName(m.fwd.author) : ''}` : `${m.xfrom!.server} › #${m.xfrom!.channel}`}</T>
    </View>
  );
}
export function ThreadChip({ m, onOpen }: { m: Msg; onOpen?: (m: Msg) => void }) {
  const n = m.thread?.length || 0; if (!n || !onOpen) return null;
  const last = m.thread![n - 1];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${n} yanıt, yanıt dizisini aç`} onPress={() => onOpen(m)} style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: C.card, alignSelf: 'flex-start' }}>
      <Avatar name={last.author} size={18} />
      <T style={{ fontSize: 13, fontFamily: F.heavy, color: '#7dd3fc' }}>{n} yanıt</T>
      <T numberOfLines={1} style={{ fontSize: 12.5, color: C.muted, maxWidth: 160 }}>{last.text}</T>
    </Pressable>
  );
}

function TkBtn({ t: label, on, danger, busy }: { t: string; on: () => void; danger?: boolean; busy?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={on} disabled={busy} style={({ pressed }) => ({ height: 38, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center', backgroundColor: danger ? 'rgba(239,90,90,0.14)' : C.accent, opacity: pressed || busy ? 0.75 : 1 })}>
      <T style={{ fontFamily: F.black, fontSize: 14, color: danger ? '#ef5a5a' : C.onAccent }}>{label}</T>
    </Pressable>
  );
}
// ---- Destek talebi (Kanka Bot'un destek paneli ve talep odası mesajları) ----
export function TicketActions({ m, chId }: { m: Msg; chId?: string }) {
  const me = useKanka(s => s.me);
  const [ask, setAsk] = useState(false), [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
  if (!chId || (!m.ticketPanel && !m.ticket)) return null;
  const f = findChannel(chId); if (!f) return null;
  const sv = f.server as any, t = m.ticket || {}, staff = !!sv.myTicketStaff;
  if (!m.ticketPanel && t.closed) return null;
  const open = async (r: string) => {
    setBusy(true); const x = await ticketOpen(sv.id, r); setBusy(false); setAsk(false); setReason('');
    if (x.error) return Alert.alert('Talep açılamadı', x.error);
    if (x.channelId) router.push({ pathname: '/kanal/[id]', params: { id: x.channelId } });
  };
  const run = async (p: Promise<string | null>) => { const e = await p; if (e) Alert.alert('Olmadı', e); };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {m.ticketPanel ? <TkBtn busy={busy} t="🎟️ Talep aç" on={() => (sv.bot?.ticket?.askReason ? setAsk(true) : open(''))} /> : <>
        {!t.claimedBy && staff && <TkBtn busy={busy} t="Üstlen" on={() => run(ticketClaim(chId))} />}
        {(staff || t.by === me) && <TkBtn busy={busy} t="Talebi kapat" danger on={() => Alert.alert('Talebi kapat', 'Bu destek talebi kapatılsın mı?', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Kapat', style: 'destructive', onPress: () => run(ticketClose(chId)) }])} />}
      </>}
      <Sheet open={ask} onClose={() => setAsk(false)} title="Destek talebi">
        <T style={{ color: C.muted, fontSize: 13.5, marginTop: -6 }}>Konunu kısaca yaz. Yetkililer seninle bu odada ilgilenecek.</T>
        <TextInput value={reason} onChangeText={setReason} maxLength={120} placeholder="Örn: Rolüm görünmüyor" placeholderTextColor={C.faint} accessibilityLabel="Konu" autoFocus
          style={{ height: 48, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong, color: C.ink, paddingHorizontal: 14, fontSize: 15 }} />
        <TkBtn busy={busy} t="Talep aç" on={() => (reason.trim().length < 2 ? Alert.alert('Konu', 'Konunu yaz.') : open(reason.trim()))} />
      </Sheet>
    </View>
  );
}
