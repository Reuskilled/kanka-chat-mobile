import { memo } from 'react';
import { Pressable, View, Linking } from 'react-native';
import { Image } from 'expo-image';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { useKanka, react } from '@/lib/kanka';
import { clock } from '@/lib/time';
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

function Body({ m, me }: { m: Msg; me: string | null }) {
  if (m.deleted) return <T style={{ fontSize: 14, color: C.faint, fontStyle: 'italic' }}>Bu mesaj silindi</T>;
  if (m.enc) return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name="lock" size={14} color={C.online} />
      <T style={{ fontSize: 14, color: C.muted, fontStyle: 'italic', flexShrink: 1 }}>Şifreli mesaj</T>
    </View>
  );
  const img = abs(m.image || m.gif);
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
      {(m.files || []).map((f, i) => (
        <Pressable key={i} accessibilityRole="link" onPress={() => { const u = abs(f.url); if (u) Linking.openURL(u); }}
          style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong, maxWidth: 280 }}>
          <Icon name="file" size={20} color={C.accent} />
          <T numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 14 }}>{f.name || 'dosya'}</T>
        </Pressable>
      ))}
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
              <T style={{ fontSize: 12.5, fontFamily: F.heavy, color: C.ink2 }}>{m.replyTo.author}</T> {m.replyTo.enc ? 'şifreli mesaj' : m.replyTo.text}
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
