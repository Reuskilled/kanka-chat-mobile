// Kanal üst çubuğundaki paneller: üye listesi ve mesaj arama
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { ask, openUser, useKanka } from '@/lib/kanka';
import type { Msg, Server } from '@/lib/types';
import { dayLabel, clock } from '@/lib/time';
import { T, IconButton } from './ui';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Message } from './Message';
import { BotBadge } from './BotParts';

function Panel({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
        <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <IconButton label="Kapat" onPress={onClose}><Icon name="back" stroke={2.4} /></IconButton>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T accessibilityRole="header" numberOfLines={1} style={{ fontFamily: F.black, fontSize: 17 }}>{title}</T>
            {!!sub && <T numberOfLines={1} style={{ fontSize: 12, color: C.muted }}>{sub}</T>}
          </View>
        </View>
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type MRow = { k: 'h'; id: string; label: string } | { k: 'u'; id: string; n: string; color?: string; role?: string };

// Üyeler: çevrimiçi olanlar öne çıkan rollerine göre gruplanır (webdeki gibi), çevrimdışılar en altta
export function MembersPanel({ s, open, onClose }: { s: Server; open: boolean; onClose: () => void }) {
  const users = useKanka(st => st.users), presence = useKanka(st => st.presence);
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    if (!open) return [];
    const k = q.trim().toLocaleLowerCase('tr');
    const roles = s.customRoles || [];
    const top = (n: string) => { // üyenin en üstteki rolü (listede önce gelen daha yüksek)
      const mine = s.memberRoles?.[n] || [];
      return roles.find(r => mine.includes(r.id));
    };
    const all = s.members.filter(n => !k || n.toLocaleLowerCase('tr').includes(k) || (users[n]?.displayName || '').toLocaleLowerCase('tr').includes(k));
    const on = (n: string) => !!presence[n] && presence[n] !== 'offline' && presence[n] !== 'invisible';
    const dn = (n: string) => users[n]?.displayName || n;
    const groups = new Map<string, { label: string; list: string[]; order: number }>();
    const off: string[] = [];
    for (const n of all) {
      if (!on(n)) { off.push(n); continue; }
      const h = roles.find(r => r.hoist && (s.memberRoles?.[n] || []).includes(r.id));
      const key = h ? h.id : '_on', order = h ? roles.indexOf(h) : 1e4;
      if (!groups.has(key)) groups.set(key, { label: h ? h.name : 'Çevrimiçi', list: [], order });
      groups.get(key)!.list.push(n);
    }
    const out: MRow[] = [];
    for (const [key, g] of [...groups.entries()].sort((a, b) => a[1].order - b[1].order)) {
      out.push({ k: 'h', id: 'h' + key, label: `${g.label.toLocaleUpperCase('tr')} — ${g.list.length}` });
      for (const n of g.list.sort((a, b) => dn(a).localeCompare(dn(b), 'tr'))) { const r = top(n); out.push({ k: 'u', id: n, n, color: roles.find(x => x.color && (s.memberRoles?.[n] || []).includes(x.id))?.color, role: r?.name }); }
    }
    if (off.length) {
      out.push({ k: 'h', id: 'hoff', label: `ÇEVRİMDIŞI — ${off.length}` });
      for (const n of off.sort((a, b) => dn(a).localeCompare(dn(b), 'tr')).slice(0, 400)) out.push({ k: 'u', id: n, n, role: top(n)?.name });
    }
    return out;
  }, [open, s, users, presence, q]);
  const onlineN = s.members.filter(n => presence[n] && presence[n] !== 'offline').length;
  return (
    <Panel open={open} onClose={onClose} title="Üyeler" sub={`${s.members.length} üye · ${onlineN} çevrimiçi`}>
      <View style={{ padding: 12 }}>
        <View style={{ height: 44, borderRadius: 14, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
          <Icon name="search" size={18} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Üye ara" placeholderTextColor={C.faint} accessibilityLabel="Üye ara" autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: C.ink, fontSize: 15 }} />
        </View>
      </View>
      <FlatList data={rows} keyExtractor={r => r.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 24 }}
        ListEmptyComponent={<T style={{ color: C.muted, textAlign: 'center', padding: 24 }}>Kimse bulunamadı</T>}
        renderItem={({ item }) => item.k === 'h' ? (
          <T style={{ fontSize: 11.5, fontFamily: F.black, color: C.muted, letterSpacing: 0.6, paddingHorizontal: 10, paddingTop: 14, paddingBottom: 6 }}>{item.label}</T>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={`${users[item.n]?.displayName || item.n} profilini aç`} onPress={() => { onClose(); setTimeout(() => openUser(item.n), Platform.OS === 'ios' ? 450 : 0); }}
            style={({ pressed }) => ({ height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, borderRadius: 10, backgroundColor: pressed ? C.hover : 'transparent', opacity: presence[item.n] && presence[item.n] !== 'offline' ? 1 : 0.55 })}>
            <Avatar name={item.n} size={36} status />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.heavy, fontSize: 15, color: item.color || C.ink }}>{users[item.n]?.displayName || item.n}</T>
                {item.n === s.owner && <Icon name="crown" size={14} color="#facc15" />}
                {!!users[item.n]?.bot && <BotBadge verified={typeof users[item.n]?.bot === 'object' && !!(users[item.n]!.bot as any).dogrulandi} />}
              </View>
              {!!(users[item.n]?.status || item.role) && <T numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{users[item.n]?.status || item.role}</T>}
            </View>
          </Pressable>
        )} />
    </Panel>
  );
}

// Bu kanaldaki mesajlarda ara (sunucu son 50 eşleşmeyi döndürür)
export function SearchPanel({ chId, title, open, onClose }: { chId: string; title: string; open: boolean; onClose: () => void }) {
  const [q, setQ] = useState(''), [res, setRes] = useState<Msg[] | null>(null), [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const run = async (text: string) => {
    const t = text.trim(); if (!t) { setRes(null); return; }
    const my = ++seq.current; setBusy(true);
    const r = await ask<Msg[] | { error?: string }>('search', t);
    if (my !== seq.current) return;
    setBusy(false); setRes(Array.isArray(r) ? r : []);
  };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChange = (t: string) => { setQ(t); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => run(t), 350); };
  const close = () => { setQ(''); setRes(null); onClose(); };
  return (
    <Panel open={open} onClose={close} title="Mesajlarda ara" sub={'#' + title}>
      <View style={{ padding: 12 }}>
        <View style={{ height: 46, borderRadius: 14, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
          <Icon name="search" size={18} color={C.muted} />
          <TextInput value={q} onChangeText={onChange} onSubmitEditing={() => run(q)} autoFocus placeholder="Kelime ya da kişi adı" placeholderTextColor={C.faint} accessibilityLabel="Mesajlarda ara" returnKeyType="search" autoCapitalize="none" style={{ flex: 1, color: C.ink, fontSize: 15 }} />
          {busy && <ActivityIndicator size="small" color={C.accent} />}
        </View>
      </View>
      <FlatList data={res || []} keyExtractor={m => m.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<T style={{ color: C.muted, textAlign: 'center', padding: 24 }}>{res === null ? 'Bu kanaldaki mesajlarda arar.' : busy ? '' : 'Sonuç yok'}</T>}
        renderItem={({ item, index }) => {
          const p = (res || [])[index - 1], day = !p || new Date(p.time).toDateString() !== new Date(item.time).toDateString();
          return (
            <View>
              {day && <T style={{ fontSize: 12, color: C.faint, fontFamily: F.heavy, paddingHorizontal: 16, paddingTop: 10 }}>{dayLabel(item.time)} · {clock(item.time)}</T>}
              <Message m={item} head onLong={() => {}} chId={chId} />
            </View>
          );
        }} />
    </Panel>
  );
}

