// Kullanıcı kartı: mesajdaki avatara/isme ya da üye listesine dokununca. Mesaj gönder, engelle, şikayet et.
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { ask, blockUser, dmIdWith, openUser, useKanka } from '@/lib/kanka';
import { REASONS } from '@/lib/report';
import { C, F } from '@/lib/theme';
import { Sheet, Row } from './AdminUI';
import { T, Button } from './ui';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { BotBadge } from './BotParts';

// Engelle / şikayet et düğmeleri (üye listesindeki kartta da kullanılır)
export function SafetyActions({ name, onDone }: { name: string; onDone?: () => void }) {
  const blocked = useKanka(s => s.blocked.includes(name));
  const u = useKanka(s => s.users[name]);
  const [rep, setRep] = useState(false);
  const shown = u?.displayName || name;
  const block = () => {
    if (blocked) { blockUser(name, false).then(e => e && Alert.alert('Olmadı', e)); return; }
    Alert.alert(`${shown} engellensin mi?`, 'Sana mesaj atamaz, seni arayamaz; arkadaşlığınız da kalkar. Kanallardaki mesajları senin için gizlenir. Engellediğini ona söylemeyiz.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Engelle', style: 'destructive', onPress: async () => { const e = await blockUser(name, true); if (e) Alert.alert('Olmadı', e); else onDone?.(); } },
    ]);
  };
  const send = async (reason: string) => {
    setRep(false);
    const r = await ask<{ error?: string; dup?: boolean }>('report', { kind: 'user', name, reason });
    Alert.alert(r?.error ? 'Gönderilemedi' : 'Teşekkürler', r?.error || (r?.dup ? 'Bu kişiyi zaten bildirmiştin.' : 'Şikayetin Kanka ekibine iletildi. Gerekirse engellemeyi de unutma.'));
  };
  if (rep) return (
    <View style={{ gap: 8 }}>
      <T style={{ fontFamily: F.black, fontSize: 16 }}>Neden şikayet ediyorsun?</T>
      <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
        {REASONS.map(([k, l], i) => <Row key={k} title={l} onPress={() => send(k)} last={i === REASONS.length - 1} />)}
      </View>
      <Button kind="ghost" title="Vazgeç" onPress={() => setRep(false)} />
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Button kind={blocked ? 'ghost' : 'danger'} title={blocked ? 'Engeli kaldır' : 'Engelle'} style={{ flex: 1, height: 46 }} onPress={block} />
      <Button kind="danger" title="Şikayet et" style={{ flex: 1, height: 46 }} onPress={() => setRep(true)} />
    </View>
  );
}

export function UserSheet() {
  const name = useKanka(s => s.userSheet);
  const me = useKanka(s => s.me);
  const u = useKanka(s => (name ? s.users[name] : undefined));
  const blocked = useKanka(s => !!name && s.blocked.includes(name));
  const close = () => openUser(null);
  if (!name) return null;
  const bot = u?.bot ? (typeof u.bot === 'object' ? u.bot : {}) as { dogrulandi?: boolean; sahip?: string | null } : name === 'Kanka Bot' ? { dogrulandi: true, sahip: null } : null;
  return (
    <Sheet open onClose={close}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={name} size={60} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.black, fontSize: 20 }}>{u?.displayName || name}</T>
            {bot && <BotBadge verified={!!bot.dogrulandi} />}
          </View>
          <T style={{ color: C.muted }}>@{name}{u?.pronouns ? ' · ' + u.pronouns : ''}{blocked ? ' · engelledin' : ''}</T>
        </View>
      </View>
      {!!(u?.status || u?.bio) && <View style={{ padding: 12, borderRadius: 12, backgroundColor: C.card }}><T style={{ color: C.ink2 }}>{u?.status || u?.bio}</T></View>}
      {bot && (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: C.card, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={bot.dogrulandi ? 'check' : 'zap'} size={16} color={bot.dogrulandi ? C.online : C.muted} />
            <T style={{ flex: 1, fontFamily: F.heavy }}>{name === 'Kanka Bot' ? 'Kanka\'nın resmi botu' : bot.dogrulandi ? 'Doğrulanmış bot' : 'Henüz doğrulanmamış bot'}</T>
          </View>
          {!!bot.sahip && <T style={{ fontSize: 13.5, color: C.muted }}>Geliştirici: <T style={{ fontSize: 13.5, fontFamily: F.heavy, color: C.ink2 }} onPress={() => openUser(bot.sahip!)}>@{bot.sahip}</T></T>}
          <T style={{ fontSize: 12.5, color: C.faint }}>Botların komutlarını mesaj kutusuna / yazarak görebilirsin.</T>
        </View>
      )}
      {name !== me && !blocked && <Button title="Mesaj gönder" icon={<Icon name="chat" size={18} color={C.onAccent} />} onPress={() => { close(); router.push({ pathname: '/kanal/[id]', params: { id: dmIdWith(me || '', name) } }); }} />}
      {name !== me && <SafetyActions name={name} onDone={close} />}
    </Sheet>
  );
}
