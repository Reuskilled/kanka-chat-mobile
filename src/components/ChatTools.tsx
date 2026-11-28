// Sohbet araçları: GIF, anket, plan, zamanlanmış mesaj, mesaj düzenle, ilet, yanıt dizisi, notlarım
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { editMsg, findChannel, forwardMsg, gifs, noteGet, noteSet, schedule, scheduledList, sendKind, threadReply, unschedule, useKanka, type Gif, type Scheduled } from '@/lib/kanka';
import type { Msg } from '@/lib/types';
import { Sheet, Chips } from './AdminUI';
import { T, Field, Button, IconButton } from './ui';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { RichText } from './MsgExtras';
import { when, clock, dayLabel } from '@/lib/time';

const input = { minHeight: 48, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong, color: C.ink, paddingHorizontal: 14, fontSize: 15 } as const;

// ---- GIF ----
export function GifSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState(''), [items, setItems] = useState<Gif[] | null>(null), [err, setErr] = useState('');
  const seq = useRef(0);
  useEffect(() => {
    if (!open) return;
    const my = ++seq.current;
    const t = setTimeout(async () => { const r = await gifs(q.trim()); if (my !== seq.current) return; setItems(r.items); setErr(r.error || ''); }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, open]);
  const pick = async (g: Gif) => { onClose(); const e = await sendKind({ kind: 'text', text: '', gif: g }); if (e) Alert.alert('Gönderilemedi', e); };
  return (
    <Sheet open={open} onClose={onClose} title="GIF">
      <TextInput value={q} onChangeText={setQ} placeholder="GIF ara" placeholderTextColor={C.faint} accessibilityLabel="GIF ara" style={input} />
      {!!err && <T style={{ color: C.danger }}>{err}</T>}
      {items === null ? <ActivityIndicator color={C.accent} /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {items.map(g => (
            <Pressable key={g.url} accessibilityRole="imagebutton" accessibilityLabel={g.title || 'GIF'} onPress={() => pick(g)} style={{ width: '48.5%', aspectRatio: g.w && g.h ? Math.max(0.6, Math.min(1.8, g.w / g.h)) : 1.3, borderRadius: 10, overflow: 'hidden', backgroundColor: C.field }}>
              <Image source={{ uri: g.prev || g.url }} style={{ flex: 1 }} contentFit="cover" autoplay />
            </Pressable>
          ))}
        </View>
      )}
    </Sheet>
  );
}

// ---- Anket ----
export function PollSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState(''), [opts, setOpts] = useState(['', '']), [busy, setBusy] = useState(false);
  const go = async () => {
    const options = opts.map(o => o.trim()).filter(Boolean);
    if (!q.trim() || options.length < 2) return Alert.alert('Eksik', 'Soru ve en az 2 seçenek yaz.');
    setBusy(true); const e = await sendKind({ kind: 'poll', question: q.trim(), options }); setBusy(false);
    if (e) return Alert.alert('Gönderilemedi', e);
    setQ(''); setOpts(['', '']); onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Anket oluştur">
      <Field label="Soru" value={q} onChangeText={setQ} maxLength={200} placeholder="Cuma akşamı ne yapalım?" />
      {opts.map((o, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput value={o} onChangeText={t => setOpts(x => x.map((y, j) => (j === i ? t : y)))} placeholder={`Seçenek ${i + 1}`} placeholderTextColor={C.faint} accessibilityLabel={`Seçenek ${i + 1}`} maxLength={80} style={[input, { flex: 1 }]} />
          {opts.length > 2 && <IconButton label={`Seçenek ${i + 1} sil`} onPress={() => setOpts(x => x.filter((_, j) => j !== i))}><Icon name="close" size={18} color={C.muted} /></IconButton>}
        </View>
      ))}
      {opts.length < 8 && <Button title="Seçenek ekle" kind="ghost" onPress={() => setOpts(x => [...x, ''])} />}
      <Button title="Anketi gönder" busy={busy} onPress={go} />
    </Sheet>
  );
}

// ---- Plan ----
export function PlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [t, setT] = useState(''), [w, setW] = useState(''), [busy, setBusy] = useState(false);
  const go = async () => {
    if (!t.trim()) return Alert.alert('Eksik', 'Plana bir başlık ver.');
    setBusy(true); const e = await sendKind({ kind: 'plan', title: t.trim(), when: w.trim() }); setBusy(false);
    if (e) return Alert.alert('Gönderilemedi', e);
    setT(''); setW(''); onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Plan yap">
      <Field label="Ne yapıyoruz?" value={t} onChangeText={setT} maxLength={120} placeholder="Sinema, maç, oyun gecesi…" />
      <Field label="Ne zaman? (isteğe bağlı)" value={w} onChangeText={setW} maxLength={80} placeholder="Cumartesi 21:00" />
      <Button title="Planı paylaş" busy={busy} onPress={go} />
    </Sheet>
  );
}

// ---- Zamanlanmış mesaj ----
const tomorrow9 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.getTime(); };
const tonight = () => { const d = new Date(); d.setHours(20, 0, 0, 0); if (d.getTime() < Date.now() + 120e3) d.setDate(d.getDate() + 1); return d.getTime(); };
export function ScheduleSheet({ open, onClose, chId, initial }: { open: boolean; onClose: () => void; chId: string; initial?: string }) {
  const [text, setText] = useState(initial || ''), [when2, setWhen] = useState('60'), [mins, setMins] = useState(''), [busy, setBusy] = useState(false);
  const [list, setList] = useState<Scheduled[] | null>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => { if (open) scheduledList().then(setList); }, [open]);
  const at = (base = now) => when2 === 'aksam' ? tonight() : when2 === 'yarin' ? tomorrow9() : when2 === 'ozel' ? base + Math.max(1, +mins || 0) * 60e3 : base + +when2 * 60e3;
  const go = async () => {
    if (!text.trim()) return Alert.alert('Boş', 'Gönderilecek mesajı yaz.');
    setBusy(true); const e = await schedule(text.trim(), at(Date.now())); setBusy(false);
    if (e) return Alert.alert('Zamanlanamadı', e);
    setText(''); scheduledList().then(setList);
  };
  const here = (list || []).filter(x => x.chId === chId);
  return (
    <Sheet open={open} onClose={onClose} title="Zamanlanmış mesaj">
      <TextInput value={text} onChangeText={setText} multiline maxLength={4000} placeholder="Mesajın" placeholderTextColor={C.faint} accessibilityLabel="Zamanlanacak mesaj" style={[input, { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }]} />
      <Chips value={when2} onChange={setWhen} options={[['60', '1 saat sonra'], ['aksam', 'Bu akşam 20:00'], ['yarin', 'Yarın 09:00'], ['ozel', 'Özel']]} />
      {when2 === 'ozel' && <Field label="Kaç dakika sonra?" value={mins} onChangeText={setMins} keyboardType="number-pad" maxLength={5} />}
      <T style={{ fontSize: 12.5, color: C.muted }}>Gönderilme: {dayLabel(at())} {clock(at())}</T>
      <Button title="Zamanla" busy={busy} onPress={go} />
      {here.length > 0 && <>
        <T style={{ fontSize: 12, fontFamily: F.black, color: C.muted, letterSpacing: 0.6, marginTop: 6 }}>BU SOHBETTE BEKLEYENLER</T>
        <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
          {here.map((x, i) => (
            <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: i === here.length - 1 ? 0 : 1, borderBottomColor: C.line }}>
              <View style={{ flex: 1, minWidth: 0 }}><T numberOfLines={2}>{x.text}</T><T style={{ fontSize: 12, color: C.muted }}>{dayLabel(x.at)} {clock(x.at)}</T></View>
              <IconButton label="İptal et" onPress={async () => setList(await unschedule(x.id))}><Icon name="trash" size={18} color={C.danger} /></IconButton>
            </View>
          ))}
        </View>
      </>}
    </Sheet>
  );
}

// ---- Düzenle ----
export function EditSheet({ m, onClose }: { m: Msg | null; onClose: () => void }) {
  const [t, setT] = useState(''), [key, setKey] = useState('');
  if (m && m.id !== key) { setKey(m.id); setT(m.text || ''); }
  return (
    <Sheet open={!!m} onClose={onClose} title="Mesajı düzenle">
      <TextInput value={t} onChangeText={setT} multiline autoFocus maxLength={4000} accessibilityLabel="Mesaj" style={[input, { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }]} />
      <Button title="Kaydet" disabled={!t.trim() || t === m?.text} onPress={() => { if (m) editMsg(m.id, t.trim()); onClose(); }} />
    </Sheet>
  );
}

// ---- İlet ----
type Target = { id: string; label: string; sub?: string; left: React.ReactNode };
export function ForwardSheet({ from, m, onClose }: { from: string; m: Msg | null; onClose: () => void }) {
  const dms = useKanka(s => s.dms), servers = useKanka(s => s.servers), users = useKanka(s => s.users), me = useKanka(s => s.me);
  const [q, setQ] = useState(''), [sent, setSent] = useState<string[]>([]);
  const all = useMemo<Target[]>(() => {
    const out: Target[] = [];
    for (const d of dms) {
      const other = d.with || ''; const name = d.with ? users[other]?.displayName || other : d.name || (d.members || []).filter(n => n !== me).join(', ');
      out.push({ id: d.id, label: name, sub: d.with ? 'Özel mesaj' : 'Grup', left: d.with ? <Avatar name={other} size={32} /> : <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.field, alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={16} /></View> });
    }
    for (const s of servers) for (const c of s.channels) if ((c.type || 'text') === 'text') out.push({ id: c.id, label: '#' + c.name, sub: s.name, left: <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.field, alignItems: 'center', justifyContent: 'center' }}><Icon name="hash" size={16} color={C.muted} /></View> });
    return out.filter(x => x.id !== from);
  }, [dms, servers, users, me, from]);
  const k = q.trim().toLocaleLowerCase('tr');
  const list = all.filter(x => !k || x.label.toLocaleLowerCase('tr').includes(k) || (x.sub || '').toLocaleLowerCase('tr').includes(k)).slice(0, 60);
  const go = async (t: Target) => { if (!m) return; const e = await forwardMsg(from, m.id, t.id); if (e) Alert.alert('İletilemedi', e); else setSent(s => [...s, t.id]); };
  return (
    <Sheet open={!!m} onClose={() => { setSent([]); setQ(''); onClose(); }} title="İlet">
      <TextInput value={q} onChangeText={setQ} placeholder="Sohbet ya da oda ara" placeholderTextColor={C.faint} accessibilityLabel="Ara" style={input} />
      <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
        {list.map((t, i) => (
          <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: C.line }}>
            {t.left}
            <View style={{ flex: 1, minWidth: 0 }}><T numberOfLines={1} style={{ fontFamily: F.heavy }}>{t.label}</T>{!!t.sub && <T numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{t.sub}</T>}</View>
            <Pressable accessibilityRole="button" accessibilityLabel={`${t.label} sohbetine ilet`} disabled={sent.includes(t.id)} onPress={() => go(t)}
              style={{ height: 34, paddingHorizontal: 14, borderRadius: 10, backgroundColor: sent.includes(t.id) ? C.field : C.accent, justifyContent: 'center' }}>
              <T style={{ fontFamily: F.black, fontSize: 13.5, color: sent.includes(t.id) ? C.muted : C.onAccent }}>{sent.includes(t.id) ? 'Gönderildi' : 'Gönder'}</T>
            </Pressable>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

// ---- Yanıt dizisi ----
export function ThreadPanel({ chId, rootId, onClose }: { chId: string; rootId: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const root = useKanka(s => (rootId ? s.msgs[chId]?.find(x => x.id === rootId) : undefined));
  const me = useKanka(s => s.me), users = useKanka(s => s.users);
  const [t, setT] = useState(''), [busy, setBusy] = useState(false);
  const go = async () => { if (!root || !t.trim()) return; setBusy(true); const e = await threadReply(root.id, t.trim()); setBusy(false); if (e) Alert.alert('Gönderilemedi', e); else setT(''); };
  const f = findChannel(chId);
  return (
    <Modal visible={!!rootId} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
        <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <IconButton label="Kapat" onPress={onClose}><Icon name="back" stroke={2.4} /></IconButton>
          <View style={{ flex: 1 }}><T accessibilityRole="header" style={{ fontFamily: F.black, fontSize: 17 }}>Yanıt dizisi</T>{!!f && <T style={{ fontSize: 12, color: C.muted }}>#{f.channel.name}</T>}</View>
        </View>
        <FlatList data={root?.thread || []} keyExtractor={x => x.id} contentContainerStyle={{ padding: 14, gap: 12 }}
          ListHeaderComponent={root ? (
            <View style={{ padding: 12, borderRadius: 14, backgroundColor: C.card, gap: 4, marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Avatar name={root.author} size={24} /><T style={{ fontFamily: F.heavy }}>{users[root.author]?.displayName || root.author}</T><T style={{ fontSize: 12, color: C.faint }}>{when(root.time)}</T></View>
              {!!root.text && <RichText text={root.text} me={me} chId={chId} />}
              <T style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{root.thread?.length || 0} yanıt</T>
            </View>
          ) : undefined}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Avatar name={item.author} size={32} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}><T style={{ fontFamily: F.heavy }}>{users[item.author]?.displayName || item.author}</T><T style={{ fontSize: 11.5, color: C.faint }}>{clock(item.time)}</T></View>
                <RichText text={item.text} me={me} chId={chId} />
              </View>
            </View>
          )} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderTopColor: C.line }}>
          <TextInput value={t} onChangeText={setT} multiline maxLength={4000} placeholder="Diziye yanıt yaz" placeholderTextColor={C.faint} accessibilityLabel="Diziye yanıt" style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, backgroundColor: C.field, color: C.ink, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 }} />
          <IconButton label="Gönder" bg={t.trim() ? C.accent : C.field} onPress={go}>{busy ? <ActivityIndicator color={C.onAccent} /> : <Icon name="send" size={20} color={t.trim() ? C.onAccent : C.faint} stroke={2.6} />}</IconButton>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---- Notlarım (sadece sen görürsün; bu sohbete özel) ----
export function NotesSheet({ chId, open, onClose }: { chId: string; open: boolean; onClose: () => void }) {
  const [t, setT] = useState<string | null>(null), [at, setAt] = useState<number | null>(null), [st, setSt] = useState('');
  const dirty = useRef(false);
  useEffect(() => { if (open) { dirty.current = false; noteGet(chId).then(r => { setT(r.text || ''); setAt(r.at || null); }); } }, [open, chId]);
  const close = async () => {
    if (dirty.current && t !== null) { const r = await noteSet(chId, t); if (r.error) Alert.alert('Kaydedilemedi', r.error); }
    setT(null); setSt(''); onClose();
  };
  const save = async () => { if (t === null) return; setSt('Kaydediliyor…'); const r = await noteSet(chId, t); dirty.current = false; setSt(r.error || 'Kaydedildi'); if (r.at) setAt(r.at); };
  return (
    <Sheet open={open} onClose={close} title="Notlarım">
      <T style={{ fontSize: 12.5, color: C.muted, marginTop: -6 }}>Bu sohbete özel notların. Sadece sen görürsün, webde de aynı not açılır.</T>
      {t === null ? <ActivityIndicator color={C.accent} /> : (
        <TextInput value={t} onChangeText={v => { setT(v); dirty.current = true; setSt(''); }} multiline maxLength={8000} placeholder="Yapılacaklar, linkler, hatırlatmalar…" placeholderTextColor={C.faint} accessibilityLabel="Not"
          style={[input, { minHeight: 180, paddingTop: 12, textAlignVertical: 'top' }]} />
      )}
      <T style={{ fontSize: 12, color: C.faint }}>{st || (at ? `Son kayıt ${when(at)} ${clock(at)}` : '')}</T>
      <Button title="Kaydet" onPress={save} disabled={t === null} />
    </Sheet>
  );
}
