import { memo, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, View, Linking } from 'react-native';
import { Image } from 'expo-image';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { useKanka, react, openUser, displayName } from '@/lib/kanka';
import { clock } from '@/lib/time';
import { encFileOk, isImg, useEncFile, openEncFile, type EncFile } from '@/lib/encfile';
import { VoiceNote } from './VoiceNote';
import type { Msg } from '@/lib/types';
import { T } from './ui';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { BotBadge, CompRows, EmbedCard, EphFooter } from './BotParts';
import { FwdTag, MsgKind, RichText, ThreadChip, TicketActions } from './MsgExtras';

// Mesaj metni: @bahsetmeler vurgulu, linkler tıklanır
function Reactions({ m, me }: { m: Msg; me: string | null }) {
  const list = Object.entries(m.reactions || {}).filter(([, who]) => who?.length);
  if (!list.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {list.map(([e, who]) => {
        const mine = !!me && who.includes(me);
        return (
          <Pressable key={e} accessibilityRole="button" accessibilityLabel={`${e} tepkisi, ${who.length} kişi${mine ? ', sen de verdin' : ''}`} onPress={() => react(m.id, e)}
            style={{ height: 30, paddingHorizontal: 10, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: mine ? C.accentSoft : C.field, borderWidth: 1, borderColor: mine ? 'rgba(212,255,0,0.5)' : C.lineStrong }}>
            <T style={{ fontSize: 14 }}>{e.startsWith(':') ? '⭐' : e}</T>
            <T style={{ fontSize: 13, fontFamily: F.heavy }}>{who.length}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function Body({ m: m0, me, chId }: { m: Msg; me: string | null; chId?: string }) {
  const dec = useKanka(s => (m0.enc ? s.dec[m0.id] : undefined));
  const locked = useKanka(s => s.e2eLocked);
  if (m0.deleted) return <T style={{ fontSize: 14, color: C.faint, fontStyle: 'italic' }}>Bu mesaj silindi</T>;
  let m = m0;
  if (m0.enc) {
    if (!dec || !('inner' in dec)) return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="lock" size={14} color={dec && 'bad' in dec ? C.danger : C.muted} />
        <T style={{ fontSize: 14, color: C.muted, fontStyle: 'italic', flexShrink: 1 }}>{dec && 'bad' in dec ? 'Bu şifreli mesaj doğrulanamadı' : locked ? 'Şifreli mesaj · görmek için kilidi aç' : 'Şifreli mesaj · anahtar bekleniyor'}</T>
      </View>
    );
    const x = dec.inner;
    const ef = (Array.isArray(x.f) ? x.f : []).slice(0, 10).filter(encFileOk);
    m = { ...m0, text: typeof x.t === 'string' ? x.t.slice(0, 4000) : '', gif: (x.g as any)?.url || null, image: null, files: [] };
    if (ef.length || x.au) return (
      <View>
        {!!m.text && <RichText text={m.text} me={me} chId={chId} />}
        {ef.map(f => isImg(f.m) ? <EncImage key={f.i} f={f} /> : <EncFileCard key={f.i} f={f} />)}
        {!!x.au && (encFileOk(x.au) ? <VoiceNote id={m0.id} enc={x.au} dur={Math.min(Math.max(+(x.du || 0), 0), 600)} /> : <FileCard name="Ses mesajı" note="açılamadı" icon="speaker" />)}
      </View>
    );
  }
  if (m.kind === 'arena' && (m as any).arena) return <ArenaCard a={(m as any).arena} ch={(m as any).channelId} />;
  const img = abs(m.image || (typeof m.gif === 'string' ? m.gif : (m.gif as any)?.url));
  return (
    <View>
      {m.kind === 'bot' && m.bot ? (m.bot.plain ? (!!m.bot.text && <RichText text={m.bot.text} me={me} chId={chId} />) : (
        <View style={{ marginTop: 2, padding: 12, borderRadius: 12, backgroundColor: C.card, borderLeftWidth: 3, borderLeftColor: m.bot.tone === 'good' ? C.online : m.bot.tone === 'warn' ? C.idle : m.bot.tone === 'bad' || m.bot.tone === 'danger' ? C.danger : C.accent, gap: 4 }}>
          {!!m.bot.title && <T style={{ fontFamily: F.black, fontSize: 15 }}>{m.bot.title}</T>}
          {!!m.bot.text && <T selectable style={{ fontSize: 14, lineHeight: 20, color: C.ink2 }}>{m.bot.text.replace(/\*\*/g, '')}</T>}
          {!!m.bot.fields?.length && (
            <View style={{ gap: 6, marginTop: 4 }}>
              {m.bot.fields.map(([k, v], i) => <View key={i}><T style={{ fontSize: 12, fontFamily: F.black, color: C.muted }}>{k}</T><T style={{ fontSize: 14, color: C.ink2 }}>{v}</T></View>)}
            </View>
          )}
        </View>
      )) : m.loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
          <ActivityIndicator size="small" color={C.muted} /><T style={{ fontSize: 14, color: C.muted, fontStyle: 'italic' }}>düşünüyor…</T>
        </View>
      ) : !!m.text && <RichText text={m.text} me={me} chId={chId} />}
      <MsgKind m={m} me={me} />
      {!!m.audio && <VoiceNote id={m.id} src={m.audio} dur={m.duration || 0} />}
      {img && (
        <Pressable accessibilityRole="imagebutton" accessibilityLabel="Görseli aç" onPress={() => Linking.openURL(img)}>
          <Image source={{ uri: img }} style={{ marginTop: 6, width: 240, height: 170, borderRadius: 14, backgroundColor: C.card }} contentFit="cover" transition={150} />
        </Pressable>
      )}
      {(m.files || []).map((f, i) => f.kind === 'image' ? (
        <Pressable key={i} accessibilityRole="imagebutton" accessibilityLabel={`${f.name || 'Resim'} aç`} onPress={() => { const u = abs(f.url); if (u) Linking.openURL(u); }}>
          <Image source={{ uri: abs(f.url) || undefined }} style={{ marginTop: 6, width: 240, height: 180, borderRadius: 14, backgroundColor: C.card }} contentFit="cover" transition={150} />
        </Pressable>
      ) : (
        <FileCard key={i} name={f.name || 'dosya'} note={f.size ? fmtSize(f.size) : undefined} onPress={() => { const u = abs(f.url); if (u) Linking.openURL(u); }} />
      ))}
      {(m.embeds || []).map((e, i) => <EmbedCard key={'e' + i} e={e} />)}
      {!!m.comps?.length && <CompRows m={m} chId={chId || m.channelId || ''} />}
      <TicketActions m={m} chId={chId || m.channelId} />
      {m.ephemeral && <EphFooter m={m} chId={chId || m.channelId || ''} />}
    </View>
  );
}

const fmtSize = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
function FileCard({ name, note, onPress, icon = 'file', busy }: { name: string; note?: string; onPress?: () => void; icon?: string; busy?: boolean }) {
  return (
    <Pressable accessibilityRole={onPress ? 'link' : undefined} onPress={onPress} disabled={!onPress}
      style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong, maxWidth: 290 }}>
      {busy ? <ActivityIndicator size="small" color={C.accent} /> : <Icon name={icon} size={20} color={C.accent} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 14 }}>{name}</T>
        {!!note && <T numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{note}</T>}
      </View>
    </Pressable>
  );
}
// Şifreli dosya: dokununca cihazda çözülür ve telefonun uygun uygulamasıyla açılır
function EncFileCard({ f }: { f: EncFile }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (busy) return; setBusy(true);
    try { await openEncFile(f); } catch (e: any) { Alert.alert('Dosya açılamadı', e?.message || 'Bir şeyler ters gitti, tekrar dene.'); }
    setBusy(false);
  };
  return <FileCard name={f.n || 'dosya'} note={`${f.s ? fmtSize(f.s) + ' · ' : ''}şifreli · açmak için dokun`} onPress={open} busy={busy} icon="lock" />;
}
function EncImage({ f }: { f: EncFile }) {
  const { url, failed } = useEncFile(f, true);
  if (failed) return <FileCard name={f.n || 'Resim'} note="açılamadı" />;
  return (
    <View style={{ marginTop: 6, width: 240, height: 180, borderRadius: 14, backgroundColor: C.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {url ? <Image source={{ uri: url }} style={{ width: 240, height: 180 }} contentFit="cover" accessibilityLabel={f.n || 'Şifreli resim'} /> : <Icon name="lock" size={20} color={C.faint} />}
    </View>
  );
}

// Arena lobisi davet kartı (odada oyun açılınca sohbete düşer)
function ArenaCard({ a }: { a: { id: string; ad: string; emoji: string; max: number; state: string; players: string[]; winner?: string | null; draw?: boolean; gone?: boolean }; ch?: string }) {
  const st = a.gone && a.state !== 'end' ? 'Lobi kapandı' : a.state === 'lobby' ? `Oyuncu bekliyor · ${a.players.length}/${a.max}` : a.state === 'play' ? 'Oyun sürüyor' : a.state === 'end' ? (a.draw ? 'Berabere bitti' : `${a.winner} kazandı 🏆`) : 'Kapandı';
  const live = !a.gone && a.state !== 'closed';
  return (
    <Pressable accessibilityRole={live ? 'button' : undefined} accessibilityLabel={`${a.ad} lobisi, ${st}${live ? ', açmak için dokun' : ''}`} disabled={!live} onPress={() => router.push({ pathname: '/arena' as any, params: { lobi: a.id } })}
      style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: live ? 'rgba(212,255,0,0.35)' : C.lineStrong, maxWidth: 320 }}>
      <T style={{ fontSize: 30 }}>{a.emoji}</T>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={{ fontFamily: F.black, fontSize: 15 }}>{a.ad}</T>
        <T numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{st}</T>
      </View>
      {live && a.state === 'lobby' && <View style={{ paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: C.accent, justifyContent: 'center' }}><T style={{ color: C.onAccent, fontFamily: F.black, fontSize: 13 }}>Katıl</T></View>}
    </Pressable>
  );
}

// Sistem / günlük soru gibi kişiye ait olmayan satırlar
function SysRow({ m }: { m: Msg }) {
  const text = m.kind === 'daily' ? `Günün sorusu: ${m.text}` : m.kind === 'call' ? 'Sesli arama' : m.text || '';
  if (!text) return null;
  return (
    <View style={{ paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center' }}>
      <T style={{ fontSize: 13, color: C.muted, textAlign: 'center', fontFamily: F.bold }}>{text}</T>
    </View>
  );
}

export const Message = memo(function Message({ m, head, onLong, chId, onThread }: { m: Msg; head: boolean; onLong: (m: Msg) => void; chId?: string; onThread?: (m: Msg) => void }) {
  const me = useKanka(s => s.me);
  const u = useKanka(s => (m.author ? s.users[m.author] : undefined));
  const repDec = useKanka(s => (m.replyTo?.enc ? s.dec[m.replyTo.id] : undefined));
  const blocked = useKanka(s => !!m.author && s.blocked.includes(m.author));
  const [showB, setShowB] = useState(false);
  const repText = m.replyTo?.enc ? (repDec && 'inner' in repDec ? String(repDec.inner.t || 'Dosya') : 'Şifreli mesaj') : m.replyTo?.text;
  if (!m.author && m.kind !== 'bot') return <SysRow m={m} />;
  if (m.kind === 'system' || m.kind === 'daily' || m.kind === 'call') return <SysRow m={m} />;
  const author = m.author || 'Kanka Bot';
  const name = u?.displayName || author;
  const person = !!m.author && m.author !== me && m.kind !== 'bot'; // geliştirici botlarının da profili açılır (bot bilgisi)
  if (blocked && !showB) return (
    <Pressable accessibilityRole="button" accessibilityLabel="Engellediğin kişinin mesajı, göstermek için dokun" onPress={() => setShowB(true)} style={{ paddingHorizontal: 64, paddingVertical: 4 }}>
      <T style={{ fontSize: 12.5, color: C.faint, fontStyle: 'italic' }}>Engellediğin kişinin mesajı · göster</T>
    </Pressable>
  );
  return (
    <Pressable onLongPress={() => onLong(m)} delayLongPress={300} accessibilityHint="Seçenekler için basılı tut"
      style={({ pressed }) => ({ flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: head ? 12 : 2, paddingBottom: 2, backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent' })}>
      <View style={{ width: 40 }}>{head && (person ? <Pressable accessibilityRole="button" accessibilityLabel={`${name} profilini aç`} onPress={() => openUser(author)}><Avatar name={author} size={40} /></Pressable> : <Avatar name={author} size={40} />)}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {m.inter && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Avatar name={m.inter.user} size={16} />
            <T numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: C.muted }}><T style={{ fontSize: 12.5, fontFamily: F.heavy, color: C.ink2 }}>{displayName(m.inter.user)}</T> /{m.inter.cmd || ''} kullandı</T>
          </View>
        )}
        {m.replyTo && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Icon name="reply" size={13} color={C.muted} />
            <T numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: C.muted }}>
              <T style={{ fontSize: 12.5, fontFamily: F.heavy, color: C.ink2 }}>{m.replyTo.author}</T> {repText}
            </T>
          </View>
        )}
        {head && (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <T numberOfLines={1} onPress={person ? () => openUser(author) : undefined} style={{ flexShrink: 1, fontFamily: F.black, fontSize: 15, color: m.color || u?.color || C.ink }}>{name}</T>
            {(m.app || u?.bot || m.kind === 'bot') && <BotBadge verified={m.kind === 'bot' || !!m.appInfo?.dogrulandi || (typeof u?.bot === 'object' && !!u.bot.dogrulandi)} />}
            <T style={{ fontSize: 11.5, color: C.faint }}>{clock(m.time)}</T>
            {!!m.edited && <T style={{ fontSize: 11, color: C.faint }}>(düzenlendi)</T>}
          </View>
        )}
        <FwdTag m={m} />
        <Body m={m} me={me} chId={chId} />
        <ThreadChip m={m} onOpen={onThread} />
        <Reactions m={m} me={me} />
      </View>
    </Pressable>
  );
});
