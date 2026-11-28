import { useMemo, useState, useEffect, useRef } from 'react';
import { Alert, Animated, PanResponder, Pressable, ScrollView, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { fire, getState, orderServers, savePrefs, setServerOrder, useKanka } from '@/lib/kanka';
import { getItem, setItem } from '@/lib/storage';
import type { Channel, Server } from '@/lib/types';
import { T } from '@/components/ui';
import { joinVoice } from '@/lib/voice';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';
import { act, can, canAdmin, inviteUrl } from '@/lib/admin';
import { Sheet, Row } from '@/components/AdminUI';
import { maybeWelcome } from '@/components/WelcomeSheet';
import { AddSheet, CatSheet, ChannelSheet, moveCat, moveIn } from '@/components/ChannelAdmin';

const STEP = 58; // simge (48) + aralık (10)
function ServerIcon({ s, active, onPress, onLongPress, onPressOut, lifted }: { s: Server; active: boolean; onPress: () => void; onLongPress: () => void; onPressOut: () => void; lifted?: boolean }) {
  const img = abs(s.iconImg);
  return (
    <View style={{ width: 72, alignItems: 'center', opacity: lifted ? 0.3 : 1 }}>
      {active && <View style={{ position: 'absolute', left: 0, top: 10, width: 4, height: 28, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: C.ink }} />}
      <Pressable accessibilityRole="button" accessibilityLabel={s.name} accessibilityHint="Taşımak ya da seçenekler için basılı tut" accessibilityState={{ selected: active }} onPress={onPress} onLongPress={onLongPress} delayLongPress={350} onPressOut={onPressOut}
        style={{ width: 48, height: 48, borderRadius: active ? 16 : 24, backgroundColor: C.field, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <SrvFace s={s} img={img} active={active} />
      </Pressable>
    </View>
  );
}
function SrvFace({ s, img, active }: { s: Server; img: string | null; active?: boolean }) {
  return img ? <Image source={{ uri: img }} style={{ width: 48, height: 48 }} contentFit="cover" /> :
    <T style={{ fontFamily: F.black, fontSize: 16, color: active ? C.accent : C.ink2 }}>{(s.icon || s.name.slice(0, 2)).slice(0, 3)}</T>;
}

function ChannelRow({ c, active, voiceUsers, onLong }: { c: Channel; active?: boolean; voiceUsers?: string[]; onLong: (c: Channel) => void }) {
  const voice = c.type === 'voice' || c.type === 'stage';
  const n = voiceUsers?.length || 0;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={(voice ? 'Sesli oda ' : 'Kanal ') + c.name}
        accessibilityHint="Seçenekler için basılı tut"
        onLongPress={() => onLong(c)}
        delayLongPress={350}
        onPress={async () => {
          if (!voice) return router.push({ pathname: '/kanal/[id]', params: { id: c.id } });
          const r = await joinVoice(c.id);
          if (r.error) Alert.alert('Sesli odaya girilemedi', r.error); else router.push('/ses');
        }}
        style={({ pressed }) => ({ height: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 10, backgroundColor: active ? C.accentSoft : pressed ? C.hover : 'transparent' })}
      >
        {voice ? <Icon name="speaker" size={17} color={n ? C.online : C.faint} /> : c.private || c.locked ? <Icon name="lock" size={16} color={C.faint} /> : <T style={{ fontSize: 19, color: C.faint, width: 16, textAlign: 'center' }}>#</T>}
        <T numberOfLines={1} style={{ flex: 1, fontFamily: n ? F.heavy : F.bold, fontSize: 15, color: n ? C.ink : C.muted }}>{c.name}</T>
        {n > 0 && <T style={{ fontSize: 12, color: C.online, fontFamily: F.heavy }}>{n} kişi</T>}
      </Pressable>
      {n > 0 && (
        <View style={{ flexDirection: 'row', gap: 4, paddingLeft: 36, paddingBottom: 6 }}>
          {voiceUsers!.slice(0, 8).map(u => <Avatar key={u} name={u} size={26} />)}
        </View>
      )}
    </View>
  );
}

export default function Sunucular() {
  const insets = useSafeAreaInsets();
  const servers = useKanka(s => s.servers);
  const voice = useKanka(s => s.voice);
  const presence = useKanka(s => s.presence);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { getItem('kanka-son-sunucu').then(v => v && setSel(v)); }, []);
  const want = useKanka(s => s.selServer); // katılınca / kurunca başka ekrandan seçilen sunucu
  const [pickedAt, setPickedAt] = useState(0);
  const order = useKanka(s => s.prefs?.order);
  const list = useMemo(() => orderServers(servers, order), [servers, order]);
  const cur = want && want.n > pickedAt ? want.id : sel;
  const server = list.find(s => s.id === cur) || list[0];
  useEffect(() => { maybeWelcome(server); }, [server]);
  const [srvMenu, setSrvMenu] = useState<Server | null>(null);
  const [chMenu, setChMenu] = useState<Channel | null>(null);
  const [catMenu, setCatMenu] = useState<{ id: string; name: string } | null>(null);
  const [editCh, setEditCh] = useState<Channel | null>(null);
  const [editCat, setEditCat] = useState<{ id: string | null; name: string } | null>(null);
  const [addIn, setAddIn] = useState<{ cat: string | null } | null>(null);
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  // ---- Sunucu sırası: basılı tut ve sürükle (bırakmadan kaydırırsan taşır, kaydırmadan bırakırsan menü açılır) ----
  const [drag, setDrag] = useState<{ id: string; from: number; to: number } | null>(null);
  const dragRef = useRef<{ id: string; from: number; to: number } | null>(null);
  const moved = useRef(false);
  const [dy] = useState(() => new Animated.Value(0));
  const listRef = useRef(list);
  useEffect(() => { listRef.current = list; }, [list]);
  // PanResponder bir kez kurulur; ref'leri sadece dokunma olaylarında okur (render sırasında değil)
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const end = (commit: boolean) => {
      const d = dragRef.current; dragRef.current = null; setDrag(null); dy.setValue(0);
      if (!d || !commit || d.to === d.from) return;
      const ids = listRef.current.map(x => x.id); const [x] = ids.splice(d.from, 1); ids.splice(d.to, 0, x);
      setServerOrder(ids);
    };
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: () => !!dragRef.current,
      onPanResponderGrant: () => { moved.current = true; },
      onPanResponderMove: (_, g) => {
        const d = dragRef.current; if (!d) return;
        dy.setValue(g.dy);
        const to = Math.max(0, Math.min(listRef.current.length - 1, d.from + Math.round(g.dy / STEP)));
        if (to !== d.to) { dragRef.current = { ...d, to }; setDrag(dragRef.current); }
      },
      onPanResponderRelease: () => end(true),
      onPanResponderTerminate: () => end(false),
      onPanResponderTerminationRequest: () => false,
    });
  });
  const cancelDrag = () => { dragRef.current = null; setDrag(null); dy.setValue(0); };
  const startDrag = (s: Server, i: number) => { moved.current = false; dragRef.current = { id: s.id, from: i, to: i }; setDrag(dragRef.current); };
  const pressOut = (s: Server) => setTimeout(() => { if (dragRef.current?.id === s.id && !moved.current) { cancelDrag(); setSrvMenu(s); } }, 120);
  const moveSrv = (s: Server, to: number) => {
    const ids = list.map(x => x.id), i = ids.indexOf(s.id); if (i < 0) return;
    to = Math.max(0, Math.min(ids.length - 1, to)); if (to === i) return;
    ids.splice(i, 1); ids.splice(to, 0, s.id); setServerOrder(ids);
  };
  const pick = (id: string) => { setSel(id); setPickedAt(want?.n ?? 0); setItem('kanka-son-sunucu', id); };

  const groups = useMemo(() => {
    if (!server) return [];
    const out: { id: string; name: string; list: Channel[] }[] = [];
    const none = server.channels.filter(c => !c.cat || !server.categories.some(k => k.id === c.cat));
    if (none.length) out.push({ id: '_', name: '', list: none });
    for (const k of server.categories) { const list = server.channels.filter(c => c.cat === k.id); if (list.length) out.push({ id: k.id, name: k.name, list }); }
    return out;
  }, [server]);
  const online = server ? server.members.filter(m => presence[m] && presence[m] !== 'offline').length : 0;
  const banner = abs(server?.banner);

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bgDeep, paddingTop: insets.top }}>
      <ScrollView accessibilityLabel="Sunucular" scrollEnabled={!drag} style={{ width: 72, flexGrow: 0 }} contentContainerStyle={{ gap: 10, paddingVertical: 14, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mesajlar" onPress={() => router.navigate('/mesajlar')} style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ color: C.onAccent, fontFamily: F.black, fontSize: 22 }}>K</T>
        </Pressable>
        <View style={{ width: 32, height: 2, borderRadius: 2, backgroundColor: C.lineStrong }} />
        <View {...pan.panHandlers} style={{ gap: 10 }}>
          {list.map((s, i) => (
            <View key={s.id}>
              {drag && drag.to === i && drag.to < drag.from && <View style={{ position: 'absolute', top: -6, left: 16, right: 16, height: 3, borderRadius: 2, backgroundColor: C.accent }} />}
              <ServerIcon s={s} active={s.id === server?.id} lifted={drag?.id === s.id} onPress={() => pick(s.id)} onLongPress={() => startDrag(s, i)} onPressOut={() => pressOut(s)} />
              {drag && drag.to === i && drag.to > drag.from && <View style={{ position: 'absolute', bottom: -6, left: 16, right: 16, height: 3, borderRadius: 2, backgroundColor: C.accent }} />}
              {drag?.id === s.id && (
                <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 12, top: 0, width: 48, height: 48, borderRadius: 16, overflow: 'hidden', backgroundColor: C.field, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: dy }, { scale: 1.08 }], borderWidth: 2, borderColor: C.accent, zIndex: 10 }}>
                  <SrvFace s={s} img={abs(s.iconImg)} />
                </Animated.View>
              )}
            </View>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Sunucu ekle" onPress={() => router.push('/sunucu-ekle' as any)} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: pressed ? C.accentSoft : C.field, alignItems: 'center', justifyContent: 'center' })}>
          <Icon name="plus" size={22} color={C.online} stroke={2.6} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Sunucu keşfet" onPress={() => router.push('/kesfet' as any)} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: pressed ? C.accentSoft : C.field, alignItems: 'center', justifyContent: 'center' })}>
          <Icon name="search" size={20} color={C.online} stroke={2.4} />
        </Pressable>
      </ScrollView>
      <View style={{ flex: 1, backgroundColor: C.panel, borderTopLeftRadius: 18, overflow: 'hidden' }}>
        {!server ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }}>
            <T style={{ fontFamily: F.black, fontSize: 18 }}>Henüz bir sunucun yok</T>
            <T style={{ color: C.muted, textAlign: 'center' }}>Bir davet linkiyle katıl ya da webden kendi sunucunu kur.</T>
          </View>
        ) : (
          <>
            <View style={{ height: 120, justifyContent: 'flex-end', padding: 16, backgroundColor: server.bannerColor || '#1c1410' }}>
              {banner && <Image source={{ uri: banner }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" />}
              <LinearGradient colors={banner ? ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.8)'] : ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.35)']} style={{ position: 'absolute', inset: 0 }} />
              <Pressable accessibilityRole="button" accessibilityLabel="Sunucu ayarları ve davet" onPress={() => router.push(`/sunucu/${server.id}` as any)} hitSlop={8}
                style={{ position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={canAdmin(server) ? 'settings' : 'userAdd'} size={20} color="#fff" />
              </Pressable>
              <T accessibilityRole="header" numberOfLines={1} style={{ fontFamily: F.black, fontSize: 19 }}>{server.name}</T>
              <T style={{ fontSize: 12.5, color: '#d4d4d8', marginTop: 2 }}>{server.members.length} üye · {online} çevrimiçi</T>
            </View>
            <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: 24 }}>
              {groups.map(g => (
                <View key={g.id}>
                  {!!g.name && (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${g.name} kategorisi`} accessibilityState={{ expanded: !closed[g.id] }} accessibilityHint="Daraltmak için dokun, seçenekler için basılı tut"
                      onPress={() => setClosed(x => ({ ...x, [g.id]: !x[g.id] }))} onLongPress={() => setCatMenu({ id: g.id, name: g.name })} delayLongPress={350}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingTop: 12, paddingBottom: 4, opacity: pressed ? 0.6 : 1 })}>
                      <View style={{ transform: [{ rotate: closed[g.id] ? '-90deg' : '0deg' }] }}><Icon name="down" size={12} color={C.muted} stroke={2.6} /></View>
                      <T style={{ flex: 1, fontSize: 11.5, fontFamily: F.black, color: C.muted, letterSpacing: 0.7 }}>{g.name.toLocaleUpperCase('tr')}</T>
                    </Pressable>
                  )}
                  {(closed[g.id] ? g.list.filter(c => voice[c.id]?.length) : g.list).map(c => <ChannelRow key={c.id} c={c} voiceUsers={voice[c.id]} onLong={setChMenu} />)}
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </View>
      {srvMenu && <ServerMenu s={srvMenu} index={list.findIndex(x => x.id === srvMenu.id)} count={list.length} onClose={() => setSrvMenu(null)} onMove={to => moveSrv(srvMenu, to)} />}
      {server && chMenu && <ChannelMenu s={server} c={chMenu} onClose={() => setChMenu(null)} onEdit={() => { const c = chMenu; setChMenu(null); setTimeout(() => setEditCh(c), 350); }} />}
      {server && catMenu && <CatMenu s={server} cat={catMenu} onClose={() => setCatMenu(null)}
        onEdit={() => { const k = catMenu; setCatMenu(null); setTimeout(() => setEditCat(k), 350); }}
        onAdd={() => { const k = catMenu; setCatMenu(null); setTimeout(() => setAddIn({ cat: k.id }), 350); }} />}
      {server && <ChannelSheet s={server} c={editCh} onClose={() => setEditCh(null)} />}
      {server && <CatSheet s={server} cat={editCat} onClose={() => setEditCat(null)} />}
      {server && <AddSheet s={server} open={!!addIn} cat={addIn?.cat ?? null} onClose={() => setAddIn(null)} />}
    </View>
  );
}

// ---- Basılı tutunca açılan menüler ----
function ServerMenu({ s, index, count, onClose, onMove }: { s: Server; index: number; count: number; onClose: () => void; onMove: (to: number) => void }) {
  const leave = () => Alert.alert(`${s.name} sunucusundan ayrıl`, 'Davetle tekrar katılabilirsin.', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Ayrıl', style: 'destructive', onPress: async () => { const e = await act('leaveServer', s.id); if (e) Alert.alert('Ayrılamadın', e); else onClose(); } },
  ]);
  return (
    <Sheet open onClose={onClose} title={s.name}>
      <T style={{ fontSize: 12.5, color: C.muted, marginTop: -6 }}>Sıra: {index + 1}/{count} · simgeyi basılı tutup sürükleyerek de taşıyabilirsin</T>
      <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
        <Row icon="up" title="Yukarı taşı" onPress={index > 0 ? () => onMove(index - 1) : undefined} />
        <Row icon="down" title="Aşağı taşı" onPress={index < count - 1 ? () => onMove(index + 1) : undefined} />
        <Row icon="star" title="En üste taşı" onPress={index > 0 ? () => { onMove(0); onClose(); } : undefined} last />
      </View>
      <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
        <Row icon={canAdmin(s) ? 'settings' : 'userAdd'} title={canAdmin(s) ? 'Sunucu ayarları' : 'Davet et ve bilgiler'} onPress={() => { onClose(); router.push(`/sunucu/${s.id}` as any); }} />
        {!!(s.invite || s.vanity) && <Row icon="userAdd" title="Davet linkini kopyala" onPress={() => { Clipboard.setStringAsync(inviteUrl(s)); onClose(); }} />}
        {!s.public && s.owner !== getMe() && <Row icon="logout" title="Sunucudan ayrıl" danger onPress={leave} last />}
      </View>
    </Sheet>
  );
}
const getMe = () => getState().me;

function ChannelMenu({ s, c, onClose, onEdit }: { s: Server; c: Channel; onClose: () => void; onEdit: () => void }) {
  const voice = c.type === 'voice' || c.type === 'stage';
  const lvl = useKanka(st => st.prefs?.ch?.[c.id]);
  const admin = can(s, 'manageChannels');
  const same = s.channels.filter(x => (x.cat || null) === (c.cat || null)), pos = same.findIndex(x => x.id === c.id);
  const setLvl = (v: 'all' | 'none' | null) => savePrefs(p => { const ch = { ...(p.ch || {}) }; if (v) ch[c.id] = v; else delete ch[c.id]; return { ...p, ch }; });
  const del = () => Alert.alert('Odayı sil', `${voice ? '' : '#'}${c.name}${voice ? '' : ' ve içindeki tüm mesajlar'} silinecek. Emin misin?`, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => { const e = await act('deleteChannel', { serverId: s.id, channelId: c.id }); if (e) Alert.alert('Silinemedi', e); else onClose(); } },
  ]);
  return (
    <Sheet open onClose={onClose} title={(voice ? '🔊 ' : '# ') + c.name}>
      {!voice && (
        <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
          <Row icon="check" title="Okundu olarak işaretle" onPress={() => { fire('read', c.id); onClose(); }} last />
        </View>
      )}
      {!voice && (
        <View style={{ gap: 6 }}>
          <T style={{ fontSize: 12, fontFamily: F.black, color: C.muted, letterSpacing: 0.6, paddingLeft: 4 }}>BİLDİRİMLER</T>
          <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
            {([[null, 'Sunucu ayarını kullan', 'Varsayılan: sadece etiketlenince'], ['all', 'Tüm mesajlar', 'Her yeni mesajda bildirim'], ['none', 'Kapalı', 'Bu odadan hiç bildirim gelmez']] as const).map(([v, t, sub], i) => (
              <Row key={t} title={t} sub={sub} onPress={() => setLvl(v)} last={i === 2} right={(lvl || null) === v ? <Icon name="check" size={18} color={C.accent} stroke={3} /> : undefined} />
            ))}
          </View>
        </View>
      )}
      {admin && (
        <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
          <Row icon="pen" title="Odayı düzenle" onPress={onEdit} />
          <Row icon="up" title="Yukarı taşı" onPress={pos > 0 ? () => moveIn(s, c, -1) : undefined} />
          <Row icon="down" title="Aşağı taşı" onPress={pos >= 0 && pos < same.length - 1 ? () => moveIn(s, c, 1) : undefined} />
          <Row icon="plus" title="Odayı çoğalt" onPress={async () => { const e = await act('chDuplicate', { serverId: s.id, channelId: c.id }); if (e) Alert.alert('Olmadı', e); else onClose(); }} />
          <Row icon="trash" title="Odayı sil" danger onPress={del} last />
        </View>
      )}
    </Sheet>
  );
}

function CatMenu({ s, cat, onClose, onEdit, onAdd }: { s: Server; cat: { id: string; name: string }; onClose: () => void; onEdit: () => void; onAdd: () => void }) {
  const admin = can(s, 'manageChannels');
  const i = s.categories.findIndex(k => k.id === cat.id);
  const del = () => Alert.alert('Kategoriyi sil', 'İçindeki odalar silinmez, kategorisiz kalır.', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => { const e = await act('catDelete', { serverId: s.id, catId: cat.id }); if (e) Alert.alert('Silinemedi', e); else onClose(); } },
  ]);
  const readAll = () => { s.channels.filter(c => c.cat === cat.id && c.type !== 'voice' && c.type !== 'stage').forEach(c => fire('read', c.id)); onClose(); };
  return (
    <Sheet open onClose={onClose} title={cat.name}>
      <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
        <Row icon="check" title="Hepsini okundu işaretle" onPress={readAll} last={!admin} />
        {admin && <Row icon="plus" title="Bu kategoriye oda ekle" onPress={onAdd} />}
        {admin && <Row icon="pen" title="Kategoriyi düzenle" onPress={onEdit} />}
        {admin && <Row icon="up" title="Yukarı taşı" onPress={i > 0 ? () => moveCat(s, cat.id, -1) : undefined} />}
        {admin && <Row icon="down" title="Aşağı taşı" onPress={i >= 0 && i < s.categories.length - 1 ? () => moveCat(s, cat.id, 1) : undefined} />}
        {admin && <Row icon="trash" title="Kategoriyi sil" danger onPress={del} last />}
      </View>
      {!admin && <T style={{ fontSize: 12.5, color: C.faint, textAlign: 'center' }}>Kategoriyi düzenlemek için “Odaları yönet” yetkin olmalı.</T>}
    </Sheet>
  );
}
