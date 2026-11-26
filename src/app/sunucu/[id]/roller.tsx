import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useKanka } from '@/lib/kanka';
import { act, can, isOwner, PERMS, ROLE_COLORS } from '@/lib/admin';
import type { Role, Server } from '@/lib/types';
import { C, F } from '@/lib/theme';
import { Screen, Row, Sheet, ToggleRow, Empty, Dot } from '@/components/AdminUI';
import { T, Field, Button, IconButton } from '@/components/ui';
import { Icon } from '@/components/Icon';

export default function Roller() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const [edit, setEdit] = useState<Role | 'new' | null>(null);
  if (!s) return <Screen title="Roller"><Empty text="Sunucu bulunamadı." /></Screen>;
  const roles = s.customRoles || [];
  const count = (rid: string) => Object.values(s.memberRoles || {}).filter(l => l.includes(rid)).length;
  const move = async (r: Role, dir: -1 | 1) => { const e = await act('roleMove', { serverId: s.id, roleId: r.id, dir }); if (e) Alert.alert('Taşınamadı', e); };
  return (
    <Screen title="Roller" sub="Üstteki rol alttakinden yetkilidir" right={<IconButton label="Rol ekle" onPress={() => setEdit('new')}><Icon name="plus" stroke={2.4} /></IconButton>}>
      <View style={{ borderRadius: 16, backgroundColor: C.card, overflow: 'hidden' }}>
        {roles.length ? roles.map((r, i) => (
          <Row key={r.id} left={<Dot color={r.color} />} title={r.name} sub={`${count(r.id)} üye${r.bot ? ' · bot rolü' : ''}${r.perms?.includes('administrator') ? ' · yönetici' : ''}`}
            last={i === roles.length - 1} onPress={() => setEdit(r)}
            right={<View style={{ flexDirection: 'row' }}>
              <IconButton size={34} label={`${r.name} yukarı`} onPress={() => move(r, -1)}><View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="down" size={16} color={i === 0 ? C.faint : C.muted} /></View></IconButton>
              <IconButton size={34} label={`${r.name} aşağı`} onPress={() => move(r, 1)}><Icon name="down" size={16} color={i === roles.length - 1 ? C.faint : C.muted} /></IconButton>
            </View>} />
        )) : <Empty text="Henüz rol yok. Sağ üstten ekleyebilirsin." />}
      </View>
      <T style={{ fontSize: 12.5, color: C.faint, paddingHorizontal: 4 }}>Rol simgesi, renk geçişi ve yazı tipi gibi süslemeler webden ayarlanır; burada kaydetmek onları bozmaz.</T>
      <RoleSheet s={s} role={edit} onClose={() => setEdit(null)} />
    </Screen>
  );
}

function RoleSheet({ s, role, onClose }: { s: Server; role: Role | 'new' | null; onClose: () => void }) {
  const r = role === 'new' ? null : role;
  const [name, setName] = useState(''), [color, setColor] = useState(ROLE_COLORS[0]), [perms, setPerms] = useState<string[]>([]), [hoist, setHoist] = useState(false);
  const [busy, setBusy] = useState(false), [key, setKey] = useState<string | null>(null);
  const k = role ? r?.id || 'new' : null;
  if (k !== key) { setKey(k); setName(r?.name || ''); setColor(r?.color || ROLE_COLORS[0]); setPerms(r?.perms || []); setHoist(!!r?.hoist); }
  // Sitedeki kural: kendinde olmayan yetkiyi veremezsin, yöneticiliği sadece sahip verir
  const mayGive = (p: string) => isOwner(s) || (p === 'administrator' ? !!r?.perms?.includes('administrator') : can(s, p));
  const save = async () => {
    setBusy(true);
    const e = await act('roleSave', { serverId: s.id, role: { ...(r || {}), name: name.trim(), color, perms, hoist } });
    setBusy(false); if (e) Alert.alert('Kaydedilemedi', e); else onClose();
  };
  const del = () => r && Alert.alert('Rolü sil', `"${r.name}" rolü herkesten alınıp silinecek.`, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => { const e = await act('roleDelete', { serverId: s.id, roleId: r.id }); if (e) Alert.alert('Silinemedi', e); else onClose(); } },
  ]);
  return (
    <Sheet open={!!role} onClose={onClose} title={r ? r.name : 'Yeni rol'}>
      {r?.bot ? <T style={{ color: C.muted }}>Bu rol Kanka Bot&apos;a ait; sadece rengi değişebilir.</T> : <Field label="Rol adı" value={name} onChangeText={setName} maxLength={30} />}
      <View style={{ gap: 8 }}>
        <T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>Renk</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {ROLE_COLORS.map(c => (
            <Pressable key={c} accessibilityRole="radio" accessibilityLabel={`Renk ${c}`} accessibilityState={{ selected: c === color }} onPress={() => setColor(c)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: 3, borderColor: c === color ? C.ink : 'transparent' }} />
          ))}
        </View>
      </View>
      {!r?.bot && (
        <>
          <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
            <ToggleRow title="Üye listesinde ayrı göster" value={hoist} onChange={setHoist} last />
          </View>
          <T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted, marginTop: 4 }}>Yetkiler</T>
          <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
            {PERMS.map(([p, label, desc], i) => (
              <ToggleRow key={p} title={label} sub={desc} value={perms.includes(p)} disabled={!mayGive(p)} last={i === PERMS.length - 1}
                onChange={v => setPerms(x => (v ? [...new Set([...x, p])] : x.filter(y => y !== p)))} />
            ))}
          </View>
        </>
      )}
      <Button title={r ? 'Kaydet' : 'Rolü oluştur'} busy={busy} disabled={!name.trim()} onPress={save} />
      {r && !r.bot && <Button kind="danger" title="Rolü sil" onPress={del} />}
    </Sheet>
  );
}
