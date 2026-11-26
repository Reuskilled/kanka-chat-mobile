import { memo } from 'react';
import { Pressable, View, Linking } from 'react-native';
import { Image } from 'expo-image';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { useKanka, react } from '@/lib/kanka';
import { clock } from '@/lib/time';
import { encFileOk, isImg, useEncFile, type EncFile } from '@/lib/encfile';
import type { Msg } from '@/lib/types';
import { T } from './ui';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

// Mesaj metni: @bahsetmeler vurgulu, linkler tıklanır
function RichText({ text, me }: { text: string; me: string | null }) {
  const parts = text.split(/(@[\p{L}\p{N}_.-]{2,20}|https?:\/\/[^\s<>"']+)/u);
  return (
    <T selectable style={{ fontSize: 15, lineHeight: 21, color: C.ink2 }}>
      {parts.map((p, i) => {
        if (/^@/.test(p)) {
          const mine = p.slice(1).toLocaleLowerCase('tr') === (me || '').toLocaleLowerCase('tr');
          return <T key={i} style={{ fontSize: 15, fontFamily: F.heavy, color: '#e5ff66', backgroundColor: mine ? 'rgba(212,255,0,0.28)' : C.accentSoft, borderRadius: 5 }}>{p}</T>;
        }
        if (/^https?:\/\//.test(p)) return <T key={i} onPress={() => Linking.openURL(p)} style={{ fontSize: 15, color: '#7dd3fc', textDecorationLine: 'underline' }}>{p}</T>;
        return p;
      })}
    </T>
  );
}

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

function Body({ m: m0, me }: { m: Msg; me: string | null }) {
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
        {!!m.text && <RichText text={m.text} me={me} />}
        {ef.map(f => isImg(f.m) ? <EncImage key={f.i} f={f} /> : <FileCard key={f.i} name={f.n || 'dosya'} note="şifreli dosya · webden açılır" />)}
        {!!x.au && <FileCard name="Ses mesajı" note="şifreli · yakında mobilde dinlenecek" icon="speaker" />}
      </View>
    );
  }
  const img = abs(m.image || (typeof m.gif === 'string' ? m.gif : (m.gif as any)?.url));
  return (
    <View>
      {m.kind === 'bot' && m.bot ? (
        <View style={{ marginTop: 2, padding: 12, borderRadius: 12, backgroundColor: C.card, borderLeftWidth: 3, borderLeftColor: m.bot.tone === 'good' ? C.online : m.bot.tone === 'warn' ? C.idle : C.accent, gap: 4 }}>
          {!!m.bot.title && <T style={{ fontFamily: F.black, fontSize: 15 }}>{m.bot.title}</T>}
          {!!m.bot.text && <T style={{ fontSize: 14, lineHeight: 20, color: C.ink2 }}>{m.bot.text.replace(/\*\*/g, '')}</T>}
        </View>
      ) : !!m.text && <RichText text={m.text} me={me} />}
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
    </View>
  );
}

const fmtSize = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
function FileCard({ name, note, onPress, icon = 'file' }: { name: string; note?: string; onPress?: () => void; icon?: string }) {
  return (
    <Pressable accessibilityRole={onPress ? 'link' : undefined} onPress={onPress} disabled={!onPress}
      style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong, maxWidth: 290 }}>
      <Icon name={icon} size={20} color={C.accent} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 14 }}>{name}</T>
        {!!note && <T numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{note}</T>}
      </View>
    </Pressable>
  );
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

export const Message = memo(function Message({ m, head, onLong }: { m: Msg; head: boolean; onLong: (m: Msg) => void }) {
  const me = useKanka(s => s.me);
  const u = useKanka(s => (m.author ? s.users[m.author] : undefined));
  const repDec = useKanka(s => (m.replyTo?.enc ? s.dec[m.replyTo.id] : undefined));
  const repText = m.replyTo?.enc ? (repDec && 'inner' in repDec ? String(repDec.inner.t || 'Dosya') : 'Şifreli mesaj') : m.replyTo?.text;
  if (!m.author && m.kind !== 'bot') return <SysRow m={m} />;
  if (m.kind === 'system' || m.kind === 'daily' || m.kind === 'call') return <SysRow m={m} />;
  const author = m.author || 'Kanka Bot';
  const name = u?.displayName || author;
  return (
    <Pressable onLongPress={() => onLong(m)} delayLongPress={300} accessibilityHint="Seçenekler için basılı tut"
      style={({ pressed }) => ({ flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: head ? 12 : 2, paddingBottom: 2, backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent' })}>
      <View style={{ width: 40 }}>{head && <Avatar name={author} size={40} />}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
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
            <T numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.black, fontSize: 15, color: m.color || u?.color || C.ink }}>{name}</T>
            <T style={{ fontSize: 11.5, color: C.faint }}>{clock(m.time)}</T>
            {!!m.edited && <T style={{ fontSize: 11, color: C.faint }}>(düzenlendi)</T>}
          </View>
        )}
        <Body m={m} me={me} />
        <Reactions m={m} me={me} />
      </View>
    </Pressable>
  );
});
