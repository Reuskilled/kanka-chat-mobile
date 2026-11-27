// Geliştirici botlarının mesaj parçaları: BOT etiketi, kartlar (embed), butonlar / seçim menüleri / kişi-rol-oda seçicileri,
// "sadece sen görüyorsun" alt bilgisi, botun açtığı form ve / komut formu. Webdeki (public/index.html) davranışla aynı.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { appCmd, appComp, appFormSubmit, closeAppForm, closeEph, dmPeers, findChannel, getState, uploadPlain, useKanka } from '@/lib/kanka';
import type { AppCmd, AppFormField, Comp, Embed, Msg } from '@/lib/types';
import { Sheet } from './AdminUI';
import { T, Button } from './ui';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

const tone = (c?: string | null) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c! : C.accent);
const plain = (t?: string) => (t || '').replace(/\*\*|__|~~|`/g, '');

export function BotBadge({ verified }: { verified?: boolean }) {
  return (
    <View accessibilityLabel={verified ? 'Doğrulanmış bot' : 'Bot'} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, height: 17, borderRadius: 5, backgroundColor: '#5865f2', alignSelf: 'center' }}>
      {verified && <Icon name="check" size={10} color="#fff" stroke={3.2} />}
      <T style={{ fontSize: 10, fontFamily: F.black, color: '#fff', letterSpacing: 0.3 }}>BOT</T>
    </View>
  );
}

export function EmbedCard({ e }: { e: Embed }) {
  const img = abs(e.resim), th = abs(e.kucukResim);
  return (
    <View style={{ marginTop: 6, maxWidth: 340, borderRadius: 10, backgroundColor: C.card, borderLeftWidth: 4, borderLeftColor: tone(e.renk), padding: 12, gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          {!!e.baslik && <T onPress={e.url ? () => Linking.openURL(e.url!) : undefined} style={{ fontFamily: F.black, fontSize: 15, color: e.url ? '#7dd3fc' : C.ink }}>{e.baslik}</T>}
          {!!e.aciklama && <T selectable style={{ fontSize: 14, lineHeight: 20, color: C.ink2 }}>{plain(e.aciklama)}</T>}
        </View>
        {th && <Image source={{ uri: th }} style={{ width: 64, height: 64, borderRadius: 8 }} contentFit="cover" />}
      </View>
      {!!e.alanlar?.length && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, columnGap: 12 }}>
          {e.alanlar.map((f, i) => (
            <View key={i} style={{ width: f.satir ? '45%' : '100%', gap: 1 }}>
              {!!f.ad && <T style={{ fontSize: 12.5, fontFamily: F.black, color: C.ink }}>{f.ad}</T>}
              {!!f.deger && <T selectable style={{ fontSize: 13.5, color: C.ink2 }}>{plain(f.deger)}</T>}
            </View>
          ))}
        </View>
      )}
      {img && (
        <Pressable accessibilityRole="imagebutton" accessibilityLabel="Görseli aç" onPress={() => Linking.openURL(img)}>
          <Image source={{ uri: img }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 8, backgroundColor: C.field }} contentFit="cover" />
        </Pressable>
      )}
      {!!e.altyazi && <T style={{ fontSize: 12, color: C.faint }}>{e.altyazi}</T>}
    </View>
  );
}

// ---- Kişi / rol / oda listesi (seçiciler için) ----
type Item = { v: string; label: string; sub?: string; left?: React.ReactNode };
function pickItems(kind: string, chId: string, odaTuru?: string): Item[] {
  const st = getState(), f = chId.startsWith('dm:') || chId.startsWith('g:') ? null : findChannel(chId);
  if (kind === 'kisi') {
    const g = st.dms.find(d => d.id === chId);
    const list = f ? f.server.members : g?.members?.length ? g.members : chId.startsWith('dm:') ? dmPeers(chId) : [];
    return list.map(n => ({ v: n, label: st.users[n]?.displayName || n, sub: '@' + n, left: <Avatar name={n} size={30} /> }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  }
  if (!f) return [];
  if (kind === 'rol') return (f.server.customRoles || []).filter(r => !(r as any).managed).map(r => ({ v: r.id, label: r.name, left: <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: r.color || '#99aab5' }} /> }));
  return f.server.channels.filter(c => !odaTuru || (c.type || 'text') === odaTuru).map(c => ({ v: c.id, label: c.name, left: <Icon name={c.type === 'voice' || c.type === 'stage' ? 'speaker' : 'hash'} size={16} color={C.muted} /> }));
}

// Liste seçici: arama + tek/çoklu seçim. Tek seçimde dokununca hemen döner.
export function PickSheet({ open, title, items, min = 1, max = 1, onClose, onDone }: { open: boolean; title: string; items: Item[]; min?: number; max?: number; onClose: () => void; onDone: (v: string[]) => void }) {
  const [q, setQ] = useState(''), [sel, setSel] = useState<string[]>([]);
  const k = q.trim().toLocaleLowerCase('tr').replace(/^[@#]/, '');
  const list = useMemo(() => items.filter(it => !k || it.label.toLocaleLowerCase('tr').includes(k) || (it.sub || '').toLocaleLowerCase('tr').includes(k)).slice(0, 80), [items, k]);
  const close = () => { setSel([]); setQ(''); onClose(); };
  const tap = (v: string) => {
    if (max <= 1) { setSel([]); setQ(''); onDone([v]); return; }
    setSel(s => s.includes(v) ? s.filter(x => x !== v) : s.length >= max ? s : [...s, v]);
  };
  return (
    <Sheet open={open} onClose={close} title={title}>
      {items.length > 6 && (
        <View style={{ height: 44, borderRadius: 12, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
          <Icon name="search" size={17} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Ara" placeholderTextColor={C.faint} accessibilityLabel="Ara" autoCapitalize="none" style={{ flex: 1, color: C.ink, fontSize: 15 }} />
        </View>
      )}
      <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
        {list.length ? list.map((it, i) => {
          const on = sel.includes(it.v);
          return (
            <Pressable key={it.v} accessibilityRole={max > 1 ? 'checkbox' : 'button'} accessibilityState={max > 1 ? { checked: on } : undefined} onPress={() => tap(it.v)}
              style={({ pressed }) => ({ minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: pressed ? C.hover : on ? C.accentSoft : 'transparent', borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: C.line })}>
              {it.left}
              <View style={{ flex: 1, minWidth: 0 }}>
                <T numberOfLines={1} style={{ fontFamily: F.heavy, fontSize: 15 }}>{it.label}</T>
                {!!it.sub && <T numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{it.sub}</T>}
              </View>
              {on && <Icon name="check" size={18} color={C.accent} stroke={3} />}
            </Pressable>
          );
        }) : <T style={{ padding: 16, color: C.muted, textAlign: 'center' }}>Sonuç yok</T>}
      </View>
      {max > 1 && <Button title={`Gönder${sel.length ? ` (${sel.length})` : ''}`} disabled={sel.length < min} onPress={() => { const v = sel; setSel([]); setQ(''); onDone(v); }} />}
      {max > 1 && <T style={{ fontSize: 12.5, color: C.muted, textAlign: 'center' }}>{min === max ? `${max} seçim yap` : `${min}-${max} arası seçim yap`}</T>}
    </Sheet>
  );
}

const BTN_BG: Record<string, string> = { ana: '#5865f2', ikincil: C.field, basari: '#248046', tehlike: '#da373c', link: C.field };
function CompButton({ c, busy, onPress }: { c: Comp; busy: boolean; onPress: () => void }) {
  const bg = BTN_BG[c.stil || 'ana'] || BTN_BG.ana;
  return (
    <Pressable accessibilityRole={c.stil === 'link' ? 'link' : 'button'} accessibilityState={{ disabled: !!c.kapali, busy }} disabled={c.kapali || busy} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: c.kapali ? 0.45 : pressed ? 0.8 : 1 })}>
      {busy ? <ActivityIndicator size="small" color="#fff" /> : !!c.emoji && <T style={{ fontSize: 15 }}>{c.emoji}</T>}
      {!!c.etiket && <T style={{ fontFamily: F.heavy, fontSize: 14, color: '#fff' }}>{c.etiket}</T>}
      {c.stil === 'link' && <Icon name="chevron" size={14} color="#fff" />}
    </Pressable>
  );
}

export function CompRows({ m, chId }: { m: Msg; chId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [pick, setPick] = useState<Comp | null>(null);
  if (!m.comps?.length) return null;
  const run = async (c: Comp, values?: string[]) => {
    if (!c.id) return; setBusy(c.id);
    const e = await appComp(chId, m.id, c.id, values);
    setTimeout(() => setBusy(b => (b === c.id ? null : b)), e ? 0 : 900);
    if (e) Alert.alert('Olmadı', e);
  };
  const items = pick ? (pick.tur === 'secim' ? (pick.secenekler || []).map(o => ({ v: o.deger, label: (o.emoji ? o.emoji + ' ' : '') + o.etiket, sub: o.aciklama || undefined })) : pickItems(pick.tur, chId, pick.odaTuru)) : [];
  return (
    <View style={{ marginTop: 8, gap: 8 }}>
      {m.comps.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {row.map((c, j) => c.tur === 'buton'
            ? <CompButton key={j} c={c} busy={busy === c.id} onPress={() => (c.stil === 'link' && c.url ? Linking.openURL(c.url) : run(c))} />
            : (
              <Pressable key={j} accessibilityRole="button" disabled={c.kapali} onPress={() => setPick(c)}
                style={({ pressed }) => ({ flex: 1, minWidth: 200, maxWidth: 340, height: 42, borderRadius: 8, backgroundColor: pressed ? C.hover : C.field, borderWidth: 1, borderColor: C.lineStrong, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, opacity: c.kapali ? 0.45 : 1 })}>
                {busy === c.id ? <ActivityIndicator size="small" color={C.accent} /> : null}
                <T numberOfLines={1} style={{ flex: 1, color: C.muted, fontSize: 14 }}>{c.yerTutucu || 'Seç'}</T>
                <Icon name="down" size={16} color={C.muted} />
              </Pressable>
            ))}
        </View>
      ))}
      <PickSheet open={!!pick} title={pick?.yerTutucu || 'Seç'} items={items} min={pick?.min ?? 1} max={pick?.max ?? 1}
        onClose={() => setPick(null)} onDone={v => { const c = pick; setPick(null); if (c) run(c, v); }} />
    </View>
  );
}

export function EphFooter({ m, chId }: { m: Msg; chId: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
      <Icon name="lock" size={12} color={C.faint} />
      <T style={{ fontSize: 12, color: C.faint }}>Sadece sen görüyorsun · </T>
      <T accessibilityRole="button" onPress={() => closeEph(chId, m)} style={{ fontSize: 12, color: '#7dd3fc', fontFamily: F.heavy }}>Kapat</T>
    </View>
  );
}

// ---- Form alanı (bot formu ve komut formu ortak) ----
function FieldBox({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>{label}{req ? <T style={{ color: C.danger, fontSize: 13 }}> *</T> : null}</T>
      {children}
    </View>
  );
}
const inputStyle = { minHeight: 48, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong, color: C.ink, paddingHorizontal: 14, fontFamily: F.regular, fontSize: 15 } as const;
function SelectBox({ text, placeholder, onPress }: { text?: string; placeholder: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={text || placeholder} onPress={onPress} style={{ ...inputStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <T numberOfLines={1} style={{ flex: 1, color: text ? C.ink : C.faint }}>{text || placeholder}</T>
      <Icon name="down" size={16} color={C.muted} />
    </Pressable>
  );
}

// Botun açtığı form penceresi (sunucudan 'appForm' gelince)
export function AppFormSheet() {
  const f = useKanka(s => s.appForm);
  const chId = useKanka(s => s.cur) || '';
  const [vals, setVals] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<AppFormField | null>(null);
  const [up, setUp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  if (f && f.iid !== key) { setKey(f.iid); setVals(Object.fromEntries(f.alanlar.filter(a => a.deger).map(a => [a.id, a.deger!]))); setLabels({}); }
  if (!f) return null;
  const upload = async (a: AppFormField) => {
    let file: { uri: string; name: string; type: string } | null = null;
    if (a.kabul === 'resim') {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (r.canceled) return; const x = r.assets[0]; file = { uri: x.uri, name: x.fileName || "resim.jpg", type: x.mimeType || 'image/jpeg' };
    } else {
      const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (r.canceled) return; const x = r.assets[0]; file = { uri: x.uri, name: x.name, type: x.mimeType || 'application/octet-stream' };
    }
    setUp(a.id); const r = await uploadPlain(file); setUp(null);
    if (r.error || !r.id) return Alert.alert('Yüklenemedi', r.error || 'Tekrar dene');
    setVals(v => ({ ...v, [a.id]: r.id! })); setLabels(l => ({ ...l, [a.id]: file!.name }));
  };
  const submit = async () => {
    if (up) return Alert.alert('Bekle', 'Dosya yükleniyor.');
    const miss = f.alanlar.find(a => a.zorunlu && !(vals[a.id] || '').trim());
    if (miss) return Alert.alert('Eksik', `${miss.etiket} gerekli`);
    const short = f.alanlar.find(a => (a.tur === 'kisa' || a.tur === 'uzun') && vals[a.id] && a.min && vals[a.id].length < a.min);
    if (short) return Alert.alert('Kısa', `${short.etiket} en az ${short.min} karakter olmalı`);
    setBusy(true); const e = await appFormSubmit(f.iid, vals); setBusy(false);
    if (e) Alert.alert('Gönderilemedi', e);
  };
  return (
    <Sheet open onClose={closeAppForm} title={f.baslik}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Avatar name={f.bot} size={26} /><T style={{ color: C.muted, fontFamily: F.heavy }}>{f.bot}</T><BotBadge />
      </View>
      {f.alanlar.map(a => (
        <FieldBox key={a.id} label={a.etiket} req={a.zorunlu}>
          {a.tur === 'kisa' || a.tur === 'uzun' ? (
            <TextInput value={vals[a.id] || ''} onChangeText={t => setVals(v => ({ ...v, [a.id]: t }))} placeholder={a.yerTutucu || ''} placeholderTextColor={C.faint} accessibilityLabel={a.etiket}
              maxLength={a.max || 400} multiline={a.tur === 'uzun'} style={[inputStyle, a.tur === 'uzun' && { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }]} />
          ) : a.tur === 'dosya' ? (
            <Pressable accessibilityRole="button" onPress={() => upload(a)} style={{ ...inputStyle, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {up === a.id ? <ActivityIndicator color={C.accent} /> : <Icon name={vals[a.id] ? 'check' : 'plus'} size={18} color={vals[a.id] ? C.online : C.accent} />}
              <T numberOfLines={1} style={{ flex: 1, color: vals[a.id] ? C.ink : C.muted }}>{up === a.id ? 'Yükleniyor…' : labels[a.id] || a.yerTutucu || (a.kabul === 'resim' ? 'Resim seç' : 'Dosya seç')}</T>
            </Pressable>
          ) : (
            <SelectBox text={labels[a.id]} placeholder={a.yerTutucu || { kisi: 'Üye seç', rol: 'Rol seç', oda: 'Oda seç' }[a.tur]} onPress={() => setPick(a)} />
          )}
        </FieldBox>
      ))}
      <T style={{ fontSize: 12, color: C.muted }}>Yazdıkların {f.bot} botuna ve sahibine gönderilir.</T>
      <Button title="Gönder" busy={busy} onPress={submit} />
      <PickSheet open={!!pick} title={pick?.etiket || ''} items={pick ? pickItems(pick.tur, chId) : []} onClose={() => setPick(null)}
        onDone={v => { const a = pick!; setPick(null); const it = pickItems(a.tur, chId).find(x => x.v === v[0]); setVals(s => ({ ...s, [a.id]: v[0] })); setLabels(l => ({ ...l, [a.id]: it?.label || v[0] })); }} />
    </Sheet>
  );
}

const OPT_TR: Record<string, string> = { yazi: 'yazı', sayi: 'sayı', tamsayi: 'tam sayı', kisi: 'kişi', oda: 'oda', rol: 'rol', evethayir: 'evet / hayır' };
// / komutu: seçenekleri olan komut için form, olmayan hemen çalışır
export function CmdSheet({ cmd, chId, onClose }: { cmd: AppCmd | null; chId: string; onClose: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<{ ad: string; items: Item[] } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!cmd) return null;
  const close = () => { setVals({}); setLabels({}); onClose(); };
  const run = async () => {
    const miss = cmd.secenekler.find(o => o.zorunlu && !(vals[o.ad] || '').trim());
    if (miss) return Alert.alert('Eksik', `"${miss.ad}" gerekli`);
    setBusy(true); const e = await appCmd(chId, cmd, Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== ''))); setBusy(false);
    if (e) return Alert.alert('Komut çalışmadı', e);
    close();
  };
  const choose = (ad: string, items: Item[]) => setPick({ ad, items });
  return (
    <Sheet open onClose={close} title={'/' + cmd.ad}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Avatar name={cmd.bot} size={24} /><T style={{ color: C.muted, fontFamily: F.heavy }}>{cmd.bot}</T><BotBadge />
      </View>
      {!!cmd.aciklama && <T style={{ color: C.ink2 }}>{cmd.aciklama}</T>}
      {cmd.secenekler.map(o => {
        const label = `${o.ad} · ${OPT_TR[o.tur] || 'yazı'}`;
        const list: Item[] | null = o.secimler?.length ? o.secimler.map(x => ({ v: String(x.deger), label: x.ad }))
          : o.tur === 'evethayir' ? [{ v: 'evet', label: 'Evet' }, { v: 'hayir', label: 'Hayır' }]
            : ['kisi', 'oda', 'rol'].includes(o.tur) ? pickItems(o.tur, chId) : null;
        return (
          <FieldBox key={o.ad} label={label} req={o.zorunlu}>
            {list ? <SelectBox text={labels[o.ad]} placeholder={o.aciklama || 'Seç…'} onPress={() => choose(o.ad, list)} /> : (
              <TextInput value={vals[o.ad] || ''} onChangeText={t => setVals(v => ({ ...v, [o.ad]: t }))} placeholder={o.aciklama || ''} placeholderTextColor={C.faint} accessibilityLabel={o.ad}
                keyboardType={o.tur === 'sayi' || o.tur === 'tamsayi' ? 'numeric' : 'default'} maxLength={1000} style={inputStyle} />
            )}
          </FieldBox>
        );
      })}
      <Button title="Çalıştır" busy={busy} onPress={run} />
      <PickSheet open={!!pick} title={pick?.ad || ''} items={pick?.items || []} onClose={() => setPick(null)}
        onDone={v => { const p = pick!; setPick(null); setVals(s => ({ ...s, [p.ad]: v[0] })); setLabels(l => ({ ...l, [p.ad]: p.items.find(x => x.v === v[0])?.label || v[0] })); }} />
    </Sheet>
  );
}
