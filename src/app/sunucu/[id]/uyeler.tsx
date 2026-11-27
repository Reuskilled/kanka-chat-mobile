import { useMemo, useState } from 'react';
import { Alert, FlatList, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useKanka, dmIdWith, displayName } from '@/lib/kanka';
import { act, can, isOwner, fmtAgo } from '@/lib/admin';
import type { Server } from '@/lib/types';
import { C, F } from '@/lib/theme';
import { Screen, Section, Row, Sheet, ToggleRow, Chips, Dot } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { SafetyActions } from '@/components/UserSheet';

const TIMEOUTS: [number, string][] = [[1, '1 dk'], [5, '5 dk'], [10, '10 dk'], [60, '1 saat'], [1440, '1 gün'], [10080, '1 hafta']];
const left = (t: number) => { const m = Math.max(1, Math.round((t - Date.now()) / 60e3)); return m < 60 ? `${m} dk` : m < 1440 ? `${Math.round(m / 60)} saat` : `${Math.round(m / 1440)} gün`; };

export default function Uyeler() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const users = useKanka(st => st.users), presence = useKanka(st => st.presence);
  const [q, setQ] = useState(''), [sel, setSel] = useState<string | null>(null), [tab, setTab] = useState<'uye' | 'yasak'>('uye');
  const list = useMemo(() => {
    if (!s) return [];
    const k = q.trim().toLocaleLowerCase('tr');
    const all = s.members.filter(n => !k || n.toLocaleLowerCase('tr').includes(k) || (users[n]?.displayName || '').toLocaleLowerCase('tr').includes(k));
    const on = (n: string) => (presence[n] && presence[n] !== 'offline' ? 0 : 1);
    return all.sort((a, b) => (a === s.owner ? -1 : b === s.owner ? 1 : on(a) - on(b) || displayName(a).localeCompare(displayName(b), 'tr'))).slice(0, 500);
  }, [s, q, users, presence]);
  if (!s) return null;
  const bans = Object.entries(s.bans || {});
  const roleOf = (n: string) => (s.memberRoles?.[n] || []).map(rid => s.customRoles?.find(r => r.id === rid)).filter(Boolean) as NonNullable<Server['customRoles']>;

  return (
    <Screen title="Üyeler" sub={`${s.members.length} üye`} scroll={false}>
      <View style={{ padding: 12, gap: 10 }}>
        <View style={{ height: 44, borderRadius: 14, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
          <Icon name="search" size={18} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Üye ara" placeholderTextColor={C.faint} accessibilityLabel="Üye ara" autoCapitalize="none" style={{ flex: 1, color: C.ink, fontSize: 15 }} />
        </View>
        {can(s, 'ban') && bans.length > 0 && <Chips value={tab} options={[['uye', 'Üyeler'], ['yasak', `Yasaklılar (${bans.length})`]]} onChange={setTab} />}
      </View>
      {tab === 'uye' ? (
        <FlatList data={list} keyExtractor={n => n} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
          renderItem={({ item: n, index }) => {
            const roles = roleOf(n), to = s.timeouts?.[n];
            const color = roles.find(r => r.color)?.color;
            return (
              <View style={{ backgroundColor: C.card, borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0, borderBottomLeftRadius: index === list.length - 1 ? 16 : 0, borderBottomRightRadius: index === list.length - 1 ? 16 : 0, overflow: 'hidden' }}>
                <Row left={<Avatar name={n} size={38} />} title={users[n]?.displayName || n}
                  sub={[n === s.owner ? '👑 sahip' : '', s.roles?.[n] === 'mod' ? 'moderatör' : '', roles.map(r => r.name).join(', '), to ? `🔇 ${left(to)} susturuldu` : ''].filter(Boolean).join(' · ') || `@${n}`}
                  onPress={() => setSel(n)} last={index === list.length - 1} right={color ? <Dot color={color} size={10} /> : undefined} />
              </View>
            );
          }} />
      ) : (
        <FlatList data={bans} keyExtractor={([n]) => n} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
          renderItem={({ item: [n, b] }) => (
            <View style={{ backgroundColor: C.card, borderRadius: 14, marginBottom: 8, overflow: 'hidden' }}>
              <Row left={<Avatar name={n} size={38} />} title={users[n]?.displayName || n} sub={`${b.by} yasakladı · ${fmtAgo(b.time)}${b.reason ? ' · ' + b.reason : ''}`} last
                right={<Button kind="ghost" title="Kaldır" style={{ height: 36, paddingHorizontal: 14 }} onPress={async () => { const e = await act('ban', { serverId: s.id, name: n, unban: true }); if (e) Alert.alert('Olmadı', e); }} />} />
            </View>
          )} />
      )}
      <MemberSheet s={s} name={sel} onClose={() => setSel(null)} />
    </Screen>
  );
}

function MemberSheet({ s, name, onClose }: { s: Server; name: string | null; onClose: () => void }) {
  const me = useKanka(st => st.me);
  const u = useKanka(st => (name ? st.users[name] : undefined));
  const [busy, setBusy] = useState<string | null>(null);
  if (!name) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const self = name === me, owner = name === s.owner;
  const mine = s.memberRoles?.[name] || [];
  const roles = (s.customRoles || []).filter(r => !r.bot);
  const run = async (key: string, ev: string, payload: Record<string, unknown>, ok?: () => void) => {
    setBusy(key); const e = await act(ev, { serverId: s.id, name, ...payload }); setBusy(null);
    if (e) Alert.alert('Olmadı', e); else ok?.();
  };
  const setRole = (rid: string, on: boolean) => run('r' + rid, 'memberRoles', { roles: on ? [...new Set([...mine, rid])] : mine.filter(x => x !== rid) });
  const kick = () => Alert.alert('Sunucudan at', `${u?.displayName || name} sunucudan çıkarılacak. Davetle geri gelebilir.`, [
    { text: 'Vazgeç', style: 'cancel' }, { text: 'At', style: 'destructive', onPress: () => run('kick', 'kick', {}, onClose) }]);
  const ban = () => Alert.alert('Yasakla', `${u?.displayName || name} sunucudan atılıp kalıcı olarak yasaklanacak.`, [
    { text: 'Vazgeç', style: 'cancel' }, { text: 'Yasakla', style: 'destructive', onPress: () => run('ban', 'ban', { reason: 'Mobilden yasaklandı' }, onClose) }]);
  const to = s.timeouts?.[name];
  const canAny = !self && !owner && (can(s, 'manageRoles') || can(s, 'timeout') || can(s, 'kick') || can(s, 'ban'));
  return (
    <Sheet open onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={name} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T numberOfLines={1} style={{ fontFamily: F.black, fontSize: 19 }}>{u?.displayName || name}</T>
          <T style={{ color: C.muted, fontSize: 13 }}>@{name}{owner ? ' · sunucu sahibi' : ''}</T>
        </View>
      </View>
      {!self && <Button kind="ghost" title="Mesaj gönder" icon={<Icon name="chat" size={18} />} onPress={() => { onClose(); router.push({ pathname: '/kanal/[id]', params: { id: dmIdWith(me || '', name) } }); }} />}
      {can(s, 'manageRoles') && roles.length > 0 && (!owner || isOwner(s)) && (
        <Section title="Roller">
          {roles.map((r, i) => <ToggleRow key={r.id} title={r.name} value={mine.includes(r.id)} disabled={busy === 'r' + r.id} onChange={v => setRole(r.id, v)} last={i === roles.length - 1} />)}
        </Section>
      )}
      {canAny && can(s, 'timeout') && (
        <Section title={to ? `Susturuldu · ${left(to)} kaldı` : 'Sustur'} hint="Susturulan kişi bu süre boyunca yazamaz ve sese giremez.">
          <View style={{ padding: 12, gap: 10 }}>
            <Chips value={-1} options={TIMEOUTS} onChange={m => run('to', 'timeout', { minutes: m })} />
            {!!to && <Button kind="ghost" title="Susturmayı kaldır" busy={busy === 'to'} onPress={() => run('to', 'timeout', { minutes: 0 })} />}
          </View>
        </Section>
      )}
      {canAny && !s.public && can(s, 'kick') && <Button kind="danger" title="Sunucudan at" busy={busy === 'kick'} onPress={kick} />}
      {canAny && !s.public && can(s, 'ban') && <Button kind="danger" title="Yasakla" busy={busy === 'ban'} onPress={ban} />}
      {!self && <SafetyActions name={name} onDone={onClose} />}
    </Sheet>
  );
}
