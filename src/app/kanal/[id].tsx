import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { C, F } from '@/lib/theme';
import { type Att, type Voice, ask, dmAppCmds, msgLink, sendKind, delMsg, pinMsg, dmPeers, e2e, findChannel, join, leave, loadOlder, react, send, takeShare, typing, unlockE2E, useKanka, openWelcome, watchStart } from '@/lib/kanka';
import type { AppCmd, Msg } from '@/lib/types';
import { dayLabel } from '@/lib/time';
import { T, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';
import { Message } from '@/components/Message';
import { Composer } from '@/components/Composer';
import { WatchPanel } from '@/components/WatchPanel';
import { startCall } from '@/lib/voice';
import { Alert } from 'react-native';
import { can, isMod } from '@/lib/admin';

import { REASONS } from '@/lib/report';
import { GroupSheet, MembersPanel, SearchPanel } from '@/components/ChannelPanels';
import { EditSheet, ForwardSheet, GifSheet, NotesSheet, PlanSheet, PollSheet, ScheduleSheet, ThreadPanel } from '@/components/ChatTools';
import { CmdSheet } from '@/components/BotParts';

const QUICK = ['👍', '❤️', '😂', '🔥', '😮', '😢'];
const EMPTY: Msg[] = [];

type Row = { k: 'm'; m: Msg; head: boolean } | { k: 'd'; id: string; label: string };

const fmtLeft = (t: number) => { const m = Math.max(1, Math.round((t - Date.now()) / 60e3)); return m < 60 ? `${m} dk kaldı` : m < 1440 ? `${Math.round(m / 60)} saat kaldı` : `${Math.round(m / 1440)} gün kaldı`; };
export default function Kanal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [shared] = useState(() => takeShare(id));
  const me = useKanka(s => s.me);
  const msgs = useKanka(s => s.msgs[id] ?? EMPTY);
  const loaded = useKanka(s => !!s.msgs[id]);
  const users = useKanka(s => s.users);
  const typers = useKanka(s => s.typing[id]);
  const servers = useKanka(s => s.servers); // kanal adı değişirse güncellensin
  const dec = useKanka(s => s.dec);
  const e2eLocked = useKanka(s => s.e2eLocked);
  const e2eBusy = useKanka(s => s.e2eBusy);
  const [reply, setReply] = useState<Msg | null>(null);
  const [menu, setMenu] = useState<Msg | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [upw, setUpw] = useState('');
  const [ubusy, setUbusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [panel, setPanel] = useState<'uyeler' | 'ara' | 'grup' | 'not' | 'gif' | 'anket' | 'plan' | 'zaman' | null>(null);
  const [edit, setEdit] = useState<Msg | null>(null), [fwd, setFwd] = useState<Msg | null>(null), [thread, setThread] = useState<string | null>(null), [schedText, setSchedText] = useState('');
  const onThread = useCallback((m: Msg) => setThread(m.id), []);
  const [cmd, setCmd] = useState<AppCmd | null>(null);
  const [dmCmds, setDmCmds] = useState<AppCmd[]>([]);

  const isDm = id.startsWith('dm:') || id.startsWith('g:');
  const f = useMemo(() => (isDm ? null : findChannel(id)), [id, isDm, servers]);
  const other = id.startsWith('dm:') ? dmPeers(id).find(n => n !== me) || '' : '';
  const title = isDm ? users[other]?.displayName || other || 'Grup sohbeti' : f?.channel.name || 'kanal';
  const secure = isDm && e2e.live(id);
  const needUnlock = isDm && e2eLocked && msgs.some(m => !!m.enc);
  // Botların / komutları: sunucuda sunucudaki botlarınki, bot DM'inde o botunki
  const otherIsBot = !!other && !!users[other]?.bot;
  useEffect(() => { if (otherIsBot) dmAppCmds(other).then(setDmCmds); }, [other, otherIsBot]);
  const cmds = isDm ? (otherIsBot ? dmCmds : []) : f?.server.appCmds || [];

  useEffect(() => {
    let alive = true;
    (async () => {
      let r = await join(id);
      if (r.error && other) { await ask('openDM', other); r = await join(id); } // ilk kez yazışılan kişi
      if (alive && r.error) setErr(r.error);
    })();
    return () => { alive = false; leave(id); };
  }, [id]);

  // "yazıyor…" göstergesi 6 saniyede kendiliğinden düşsün
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 2000); return () => clearInterval(t); }, []);
  const typingNames = Object.entries(typers || {}).filter(([n, t]) => n !== me && t && now - t < 6000).map(([n]) => users[n]?.displayName || n);

  // Ters liste: en yeni en altta. Aynı kişinin 5 dk içindeki mesajları tek başlık altında; gün ayraçları
  const rows = useMemo(() => {
    const out: Row[] = [];
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i], p = msgs[i - 1];
      const newDay = !p || new Date(p.time).toDateString() !== new Date(m.time).toDateString();
      if (newDay) out.push({ k: 'd', id: 'd' + m.id, label: dayLabel(m.time) });
      const head = newDay || !p || p.author !== m.author || m.time - p.time > 5 * 60e3 || !!m.replyTo || p.kind !== m.kind;
      out.push({ k: 'm', m, head });
    }
    return out.reverse();
  }, [msgs]);

  const onSend = async (text: string, atts: Att[]) => {
    setErr(null);
    const r = await send(text, reply?.id, atts);
    if (r.error) { setErr(r.error); return false; }
    setReply(null); return true;
  };
  const onVoice = async (v: Voice) => {
    setErr(null);
    const r = await send('', reply?.id, [], v);
    if (r.error) { setErr(r.error); return false; }
    setReply(null); return true;
  };
  const onLong = useCallback((m: Msg) => setMenu(m), []);
  // Sunucuda moderatör başkasının mesajını silebilir / sabitleyebilir (sunucu da ayrıca kontrol eder)
  const canDel = !!f && (isMod(f.server) || can(f.server, 'manageMessages'));
  const canPin = isDm || (!!f && (canDel || can(f.server, 'pinMessages')));
  const [report, setReport] = useState<Msg | null>(null);
  const askDel = (m: Msg) => Alert.alert('Mesajı sil', m.author === me ? 'Bu mesaj herkesten silinecek.' : `${users[m.author || '']?.displayName || m.author} kişisinin mesajı silinecek.`, [
    { text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => delMsg(m.id) }]);
  const sendReport = async (reason: string) => {
    const m = report; setReport(null); if (!m) return;
    const r = await ask<{ error?: string; dup?: boolean }>('report', { kind: 'msg', msgId: m.id, chId: id, reason });
    Alert.alert(r?.error ? 'Gönderilemedi' : 'Teşekkürler', r?.error || (r?.dup ? 'Bu mesajı zaten bildirmiştin.' : 'Şikayetin moderatörlere iletildi.'));
  };
  const doUnlock = async () => {
    if (!upw) return; setUbusy(true);
    const ok = await unlockE2E(upw); setUbusy(false);
    if (ok) { setUpw(''); setErr(null); } else setErr('Şifre yanlış');
  };
  const menuText = menu ? (menu.enc ? (dec[menu.id] && 'inner' in dec[menu.id] ? String((dec[menu.id] as any).inner.t || '') : '') : menu.text || '') : '';

  const watchX = isDm ? [{ t: 'Birlikte izle', ic: '📺', takesText: true, on: (t: string) => (/youtu/.test(t) || /^[\w-]{11}$/.test(t.trim()) ? watchStart(t.trim()) : Alert.alert('Birlikte izle', 'Önce mesaj kutusuna bir YouTube linki yapıştır, sonra buna dokun.')) }] : [];
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ paddingTop: insets.top, backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 }}>
          <IconButton label="Geri" onPress={() => router.back()}><Icon name="back" stroke={2.4} /></IconButton>
          {!!other && <Avatar name={other} size={34} status />}
          <View style={{ flex: 1, minWidth: 0, marginLeft: isDm ? 4 : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <T accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.black, fontSize: 17 }}>
                {isDm ? title : <><T style={{ color: C.faint, fontSize: 17, fontFamily: F.black }}># </T>{title}</>}
              </T>
              {secure && <View accessibilityLabel="Uçtan uca şifreli"><Icon name="lock" size={14} color={C.online} stroke={2.6} /></View>}
            </View>
            <T numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{isDm ? (secure ? 'Uçtan uca şifreli' : users[other]?.status || 'Özel mesaj') : f?.server.name}</T>
          </View>
          {isDm ? (<>
            <IconButton label="Sesli ara" onPress={async () => { const r = await startCall(id); if (r.error) Alert.alert('Arama başlatılamadı', r.error); else router.push('/ses'); }}><Icon name="phone" size={20} color={C.ink} /></IconButton>
            <IconButton label="Görüntülü ara" onPress={async () => { const r = await startCall(id, true); if (r.error) Alert.alert('Arama başlatılamadı', r.error); else router.push('/ses'); }}><Icon name="video" size={21} color={C.ink} /></IconButton>
          </>) : <IconButton label="Mesajlarda ara" onPress={() => setPanel('ara')}><Icon name="search" size={20} color={C.ink} /></IconButton>}
          {!isDm && <IconButton label="Üyeler" onPress={() => setPanel('uyeler')}><Icon name="users" size={21} color={C.ink} /></IconButton>}
          <IconButton label="Notlarım" onPress={() => setPanel('not')}><Icon name="pen" size={19} color={C.ink} /></IconButton>
          {id.startsWith('g:') && <IconButton label="Grup ayarları" onPress={() => setPanel('grup')}><Icon name="settings" size={20} color={C.ink} /></IconButton>}
        </View>
      </View>
      {isDm && <WatchPanel chId={id} />}

      <FlatList
        inverted
        data={rows}
        keyExtractor={r => (r.k === 'm' ? r.m.id : r.id)}
        renderItem={({ item }) => item.k === 'd' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: C.line }} /><T style={{ fontSize: 12, color: C.faint, fontFamily: F.heavy }}>{item.label}</T><View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
          </View>
        ) : <Message m={item.m} head={item.head} onLong={onLong} chId={id} onThread={onThread} />}
        onEndReached={() => loadOlder(id)}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingVertical: 8 }}
        keyboardDismissMode="interactive"
        ListFooterComponent={loaded && !msgs.length ? (
          <View style={{ padding: 32, alignItems: 'center', gap: 6 }}>
            <T style={{ fontFamily: F.black, fontSize: 18, textAlign: 'center' }}>{isDm ? `${title} ile sohbetin başlangıcı` : `#${title} kanalına hoş geldin`}</T>
            <T style={{ color: C.muted }}>İlk mesajı sen at.</T>
          </View>
        ) : undefined}
      />

      {typingNames.length > 0 && (
        <T accessibilityLiveRegion="polite" style={{ paddingHorizontal: 18, paddingBottom: 4, fontSize: 12.5, color: C.muted }}>
          <T style={{ fontSize: 12.5, fontFamily: F.heavy, color: C.muted }}>{typingNames.slice(0, 3).join(', ')}</T> yazıyor…
        </T>
      )}
      {e2eBusy && isDm && (
        <View style={{ marginHorizontal: 10, marginBottom: 6, padding: 10, borderRadius: 12, backgroundColor: C.card, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Icon name="lock" size={16} color={C.online} /><T style={{ flex: 1, fontSize: 13, color: C.muted }}>Şifreli mesajların bu cihazda açılıyor…</T>
        </View>
      )}
      {needUnlock && !e2eBusy && (
        <View style={{ marginHorizontal: 10, marginBottom: 6, padding: 12, borderRadius: 14, backgroundColor: 'rgba(61,220,132,0.08)', borderWidth: 1, borderColor: 'rgba(61,220,132,0.25)', gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="lock" size={18} color={C.online} />
            <T style={{ flex: 1, fontSize: 13, lineHeight: 18, color: C.ink2 }}><T style={{ fontSize: 13, fontFamily: F.black }}>Şifreli mesajların kilitli. </T>Bu cihazda görmek için hesap şifreni bir kez gir; şifren cihazından çıkmaz.</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={upw} onChangeText={setUpw} secureTextEntry placeholder="Hesap şifren" placeholderTextColor={C.faint} accessibilityLabel="Hesap şifren" autoComplete="current-password" onSubmitEditing={doUnlock}
              style={{ flex: 1, height: 42, borderRadius: 12, backgroundColor: C.field, color: C.ink, paddingHorizontal: 12, fontFamily: F.regular, fontSize: 15 }} />
            <Pressable accessibilityRole="button" onPress={doUnlock} disabled={ubusy} style={{ height: 42, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', opacity: ubusy ? 0.6 : 1 }}>
              <T style={{ color: C.onAccent, fontFamily: F.black }}>{ubusy ? 'Açılıyor…' : 'Kilidi aç'}</T>
            </Pressable>
          </View>
        </View>
      )}
      {!!f && (f.server.sec?.length || (f.server.welcome?.enabled && !f.server.accepted)) ? (
        <View style={{ marginHorizontal: 10, marginBottom: 6, padding: 12, borderRadius: 14, backgroundColor: C.card, gap: 6 }}>
          {f.server.sec?.length ? <>
            <T style={{ fontFamily: F.heavy, fontSize: 13.5 }}>Bu sunucuda yazmak için:</T>
            {f.server.sec.map(x => <T key={x.k} style={{ fontSize: 13, color: C.muted }}>• {x.t}{x.until ? ` (${fmtLeft(x.until)})` : ''}</T>)}
            {f.server.sec.some(x => x.k === 'email' || x.k === 'tfa') && <Pressable accessibilityRole="button" onPress={() => router.push('/guvenlik' as any)}><T style={{ fontSize: 13, color: C.accent, fontFamily: F.heavy }}>Hesap ayarlarına git</T></Pressable>}
          </> : <Pressable accessibilityRole="button" onPress={() => openWelcome(f.server.id)}>
            <T style={{ fontSize: 13.5, fontFamily: F.heavy }}>{f.server.apply === 'bekliyor' ? 'Katılım başvurun inceleniyor' : 'Yazmak için önce sunucu kurallarını kabul et'}</T>
            <T style={{ fontSize: 13, color: C.accent, fontFamily: F.heavy }}>{f.server.apply === 'bekliyor' ? 'Ayrıntılar' : 'Kuralları gör'}</T>
          </Pressable>}
        </View>
      ) : null}
      {!!err && <T accessibilityLiveRegion="polite" style={{ paddingHorizontal: 18, paddingBottom: 6, fontSize: 13, color: '#f87171', fontFamily: F.bold }}>{err}</T>}
      {reply && (
        <View style={{ marginHorizontal: 10, paddingHorizontal: 12, paddingVertical: 8, borderTopLeftRadius: 14, borderTopRightRadius: 14, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="reply" size={15} color={C.accent} />
          <T numberOfLines={1} style={{ flex: 1, fontSize: 13, color: C.muted }}><T style={{ fontSize: 13, fontFamily: F.heavy }}>{users[reply.author]?.displayName || reply.author}</T> kişisine yanıt</T>
          <IconButton label="Yanıtı iptal et" size={30} onPress={() => setReply(null)}><T style={{ color: C.muted, fontFamily: F.black }}>✕</T></IconButton>
        </View>
      )}
      <Composer initial={shared} placeholder={isDm ? `${title} kişisine yaz` : `#${title} kanalına yaz`} onSend={onSend} onVoice={onVoice} onTyping={typing} bottom={Math.max(insets.bottom, 10) + 4} secure={secure} cmds={cmds} onCmd={setCmd} extras={secure ? watchX : [
        { t: 'GIF', ic: '🎞️', on: () => setPanel('gif') },
        { t: 'Anket', ic: '📊', on: () => setPanel('anket') },
        { t: 'Plan', ic: '🗓️', on: () => setPanel('plan') },
        { t: 'Zar at', ic: '🎲', on: () => sendKind({ kind: 'dice', sides: 6 }).then(e => e && Alert.alert('Olmadı', e)) },
        { t: 'Yazı tura', ic: '🪙', on: () => sendKind({ kind: 'coin' }).then(e => e && Alert.alert('Olmadı', e)) },
        { t: 'XOX', ic: '❌', on: () => sendKind({ kind: 'xox' }).then(e => e && Alert.alert('Olmadı', e)) },
        ...watchX,
        { t: 'Zamanla', ic: '⏰', takesText: true, on: (t: string) => { setSchedText(t); setPanel('zaman'); } },
      ]} />
      <CmdSheet cmd={cmd} chId={id} onClose={() => setCmd(null)} />
      {f && <MembersPanel s={f.server} open={panel === 'uyeler'} onClose={() => setPanel(null)} />}
      <NotesSheet chId={id} open={panel === 'not'} onClose={() => setPanel(null)} />
      <GifSheet open={panel === 'gif'} onClose={() => setPanel(null)} />
      <PollSheet open={panel === 'anket'} onClose={() => setPanel(null)} />
      <PlanSheet open={panel === 'plan'} onClose={() => setPanel(null)} />
      {panel === 'zaman' && <ScheduleSheet open chId={id} initial={schedText} onClose={() => setPanel(null)} />}
      <EditSheet m={edit} onClose={() => setEdit(null)} />
      <ForwardSheet from={id} m={fwd} onClose={() => setFwd(null)} />
      <ThreadPanel chId={id} rootId={thread} onClose={() => setThread(null)} />
      {id.startsWith('g:') && <GroupSheet id={id} open={panel === 'grup'} onClose={() => setPanel(null)} />}
      {!isDm && <SearchPanel chId={id} title={title} open={panel === 'ara'} onClose={() => setPanel(null)} />}

      <Modal visible={!!menu} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
        <Pressable accessibilityLabel="Kapat" onPress={() => setMenu(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: C.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: insets.bottom + 16, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              {QUICK.map(e => (
                <Pressable key={e} accessibilityRole="button" accessibilityLabel={`${e} tepkisi ver`} onPress={() => { if (menu) react(menu.id, e); setMenu(null); }}
                  style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.field, alignItems: 'center', justifyContent: 'center' }}>
                  <T style={{ fontSize: 24 }}>{e}</T>
                </Pressable>
              ))}
            </View>
            {[
              { t: 'Yanıtla', ic: 'reply', on: () => menu && setReply(menu) },
              ...(menu && menu.author === me && (menu.kind || 'text') === 'text' && !menu.enc && !!menu.text ? [{ t: 'Düzenle', ic: 'pen', on: () => setEdit(menu) }] : []),
              ...(menu && !secure && !menu.ephemeral && menu.kind !== 'system' ? [{ t: 'Yanıt dizisi', ic: 'chat', on: () => setThread(menu.id) }] : []),
              ...(menu && !menu.enc && !menu.ephemeral && ['text', 'bot', 'plan', 'poll', 'song'].includes(menu.kind || 'text') ? [{ t: 'İlet', ic: 'send', on: () => setFwd(menu) }] : []),
              ...(menuText ? [{ t: 'Metni kopyala', ic: 'file', on: () => Clipboard.setStringAsync(menuText) }] : []),
              ...(menu && !menu.ephemeral ? [{ t: 'Bağlantıyı kopyala', ic: 'tag', on: () => Clipboard.setStringAsync(msgLink(id, menu.id)) }] : []),
              ...(menu && canPin ? [{ t: (menu as any).pinned ? 'Sabitlemeyi kaldır' : 'Sabitle', ic: 'tag', on: () => pinMsg(menu.id) }] : []),
              ...(menu && menu.author && menu.author !== me && !menu.enc ? [{ t: 'Şikayet et', ic: 'bell', on: () => setReport(menu) }] : []),
              ...(menu && (menu.author === me || canDel) ? [{ t: 'Mesajı sil', ic: 'trash', danger: true, on: () => askDel(menu) }] : []),
            ].map((a: { t: string; ic: string; on: () => void; danger?: boolean }) => (
              <Pressable key={a.t} accessibilityRole="button" onPress={() => { a.on(); setMenu(null); }} style={({ pressed }) => ({ height: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: pressed ? C.hover : C.card })}>
                <Icon name={a.ic} size={20} color={a.danger ? C.danger : C.muted} /><T style={{ fontFamily: F.heavy, fontSize: 15.5, color: a.danger ? '#f87171' : C.ink }}>{a.t}</T>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={!!report} transparent animationType="fade" onRequestClose={() => setReport(null)}>
        <Pressable accessibilityLabel="Kapat" onPress={() => setReport(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: C.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: insets.bottom + 16, gap: 8 }}>
            <T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 18, marginBottom: 4 }}>Neden şikayet ediyorsun?</T>
            {REASONS.map(([k, l]) => (
              <Pressable key={k} accessibilityRole="button" onPress={() => sendReport(k)} style={({ pressed }) => ({ height: 48, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: pressed ? C.hover : C.card })}>
                <T style={{ fontFamily: F.heavy, fontSize: 15 }}>{l}</T>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
