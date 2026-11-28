import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ask, useKanka } from '@/lib/kanka';
import { act, can } from '@/lib/admin';
import type { BotMod, Server } from '@/lib/types';
import { Screen, Section, ToggleRow, Empty, Row, Sheet, Chips } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';
import { C, F } from '@/lib/theme';

// Kanka Bot korumaları: sunucuyu yönetme yetkisi olan açıp kapatır. Yönetim ekibi hiçbir kuraldan etkilenmez (sunucu tarafında).
const KURALLAR: [keyof BotMod, string, string][] = [
  ['spam', 'Spam koruması', 'Aynı mesajı tekrar tekrar ya da çok hızlı yazan üye 5 dakika susturulur'],
  ['antinuke', 'Anti-nuke', 'Bir yetkili 1 dakikada 3\'ten fazla ban, atma, oda ya da rol silerse durdurulur'],
  ['invites', 'Davet linki engeli', 'Başka sunucuların davet linkleri paylaşılamaz'],
  ['links', 'Tüm linkleri engelle', 'Hiçbir link paylaşılamaz'],
  ['mentions', 'Toplu etiket engeli', 'Bir mesajda 5\'ten fazla kişi etiketlenemez'],
  ['caps', 'Büyük harf engeli', 'TAMAMI BÜYÜK HARF mesajlar engellenir'],
];

export default function KankaBot() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!s) return <Screen title="Kanka Bot"><Empty text="Sunucu bulunamadı." /></Screen>;
  if (!can(s, 'manageServer')) return <Screen title="Kanka Bot"><Empty text="Kanka Bot ayarları için sunucuyu yönetme yetkin olmalı." /></Screen>;
  const b = s.bot || {}, m = b.mod || {};
  const run = async (key: string, ev: string, payload: unknown) => {
    setBusy(key); const e = await act(ev, payload); setBusy(null);
    if (e) Alert.alert('Kaydedilemedi', e);
  };
  const w = b.welcome || {}, ar = b.autorole || {}, tk = b.ticket || {};
  const save = (module: string, cfg: object) => run(module + Object.keys(cfg)[0], 'botSave', { serverId: s.id, module, cfg });
  const applyAll = async () => { const r = await ask<{ ok?: boolean; error?: string; n?: number }>('autoRoleAll', { serverId: s.id }); Alert.alert(r?.ok ? 'Tamam' : 'Olmadı', r?.ok ? `${r.n || 0} üyeye rol verildi.` : r?.error || 'Bağlantı yok'); };
  const sendPanel = async () => { const e = await act('ticketPanel', { serverId: s.id, chId: tk.panelCh }); Alert.alert(e ? 'Olmadı' : 'Gönderildi', e || 'Panel mesajı odaya gönderildi.'); };
  const set = (k: keyof BotMod, v: boolean) => run(k, 'botSave', { serverId: s.id, module: 'mod', cfg: { [k]: v } });
  if (!b.added) return (
    <Screen title="Kanka Bot" sub={s.name}>
      <T style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>Kanka Bot sunucunu korur: spam koruması, anti-nuke, davet linki ve toplu etiket engeli. Yönetim ekibine hiçbir zaman dokunmaz.</T>
      {s.public ? <Empty text="Bu sunucuya bot eklenemez." /> :
        <Button title="Kanka Bot'u ekle" busy={busy === 'add'} onPress={() => run('add', 'botAdd', { serverId: s.id, mod: true })} />}
    </Screen>
  );
  return (
    <Screen title="Kanka Bot" sub={s.name}>
      <Section>
        <ToggleRow title="Otomatik moderasyon" sub={m.on ? 'Açık: aşağıdaki kurallar çalışıyor' : 'Kapalı: hiçbir kural çalışmıyor'} value={!!m.on} disabled={!!busy} onChange={v => set('on', v)} last />
      </Section>
      {!!m.on && (
        <Section title="Kurallar" hint="Sahip ve yönetim ekibi (yönetici, moderatör; atma, yasaklama, susturma, mesaj/oda/rol yönetme yetkisi olanlar) bu kurallardan etkilenmez.">
          {KURALLAR.map(([k, t, sub], i) => <ToggleRow key={k} title={t} sub={sub} value={!!m[k]} disabled={!!busy} onChange={v => set(k, v)} last={i === KURALLAR.length - 1} />)}
        </Section>
      )}
      {!!m.on && <>
        <Section title="Yasaklı kelimeler" hint="Virgülle ayır. Bu kelimeleri içeren mesajlar silinir ve üye uyarılır.">
          <Txt value={m.words || ''} max={500} placeholder="örn. kelime1, kelime2" onSave={v => save('mod', { words: v })} />
        </Section>
        <Section title="Kayıt odası" hint="Botun yaptığı işlemler (silinen mesaj, susturma) bu odaya yazılır.">
          <ChPick s={s} value={m.logCh || null} onChange={v => save('mod', { logCh: v })} none="Kayıt tutma" />
        </Section>
      </>}

      <Section title="Karşılama">
        <ToggleRow title="Yeni gelenleri karşıla" sub="Seçtiğin odada kartla karşılar, kaçıncı üye olduğunu söyler" value={!!w.on} disabled={!!busy} onChange={v => save('welcome', { on: v })} last={!w.on} />
        {!!w.on && <>
          <ChPick s={s} value={w.ch || null} onChange={v => save('welcome', { ch: v })} none="Otomatik seç" />
          <Txt value={w.text || ''} max={400} placeholder="{üye} aramıza katıldı!" onSave={v => save('welcome', { text: v })} />
          <RolePick s={s} value={w.role || null} onChange={v => save('welcome', { role: v })} label="Katılınca verilecek rol" />
          <ToggleRow title="Ayrılanları da yaz" value={!!w.bye} disabled={!!busy} onChange={v => save('welcome', { bye: v })} last />
        </>}
      </Section>
      {!!w.on && <T style={{ fontSize: 12.5, color: C.faint, marginTop: -2 }}>{'{üye}, {sunucu} ve {sayı} yazabilirsin.'}</T>}

      <Section title="Oto-rol" hint="Sadece yetkisi olmayan roller verilebilir.">
        <ToggleRow title="Otomatik rol ver" value={!!ar.on} disabled={!!busy} onChange={v => save('autorole', { on: v })} last={!ar.on} />
        {!!ar.on && <>
          <View style={{ padding: 12, gap: 8 }}><T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>Ne zaman?</T>
            <Chips value={ar.when || 'join'} options={[['join', 'Katılınca'], ['rules', 'Kuralları kabul edince'], ['delay', 'Biraz sonra']]} onChange={v => save('autorole', { when: v })} />
            {ar.when === 'delay' && <Chips value={ar.delayMin || 10} options={[[5, '5 dk'], [10, '10 dk'], [30, '30 dk'], [60, '1 saat'], [1440, '1 gün']]} onChange={v => save('autorole', { delayMin: v })} />}
          </View>
          {(s.customRoles || []).filter(r => !r.bot).map(r => {
            const on = (ar.roles || []).includes(r.id);
            return <ToggleRow key={r.id} title={r.name} sub={r.perms?.length ? 'Yetkisi olan rol verilemez' : undefined} value={on} disabled={!!busy || (!on && !!r.perms?.length)}
              onChange={v => save('autorole', { roles: v ? [...(ar.roles || []), r.id] : (ar.roles || []).filter(x => x !== r.id) })} />;
          })}
          {!(s.customRoles || []).some(r => !r.bot) && <Empty text="Önce Roller’den bir rol oluştur." />}
          <Row icon="users" title="Mevcut üyelere de uygula" onPress={applyAll} last />
        </>}
      </Section>

      <Section title="Destek talepleri" hint="Üyeler panel mesajındaki butona basınca sadece kendisinin ve yetkililerin gördüğü özel bir oda açılır.">
        <ToggleRow title="Destek modülü" value={!!tk.on} disabled={!!busy} onChange={v => save('ticket', { on: v })} last={!tk.on} />
        {!!tk.on && <>
          <RolePick s={s} value={tk.role || null} onChange={v => save('ticket', { role: v })} label="Talepleri görecek rol" />
          <ToggleRow title="Talep açarken sebep sor" value={tk.askReason !== false} disabled={!!busy} onChange={v => save('ticket', { askReason: v })} />
          <Txt value={tk.panelText || ''} max={400} placeholder="Panel mesajı" onSave={v => save('ticket', { panelText: v })} />
          <ChPick s={s} value={tk.panelCh || null} onChange={v => save('ticket', { panelCh: v })} none="Panel odası seç" />
          <Row icon="send" title="Paneli gönder" sub={tk.panelCh ? 'Seçili odaya “Talep aç” butonlu mesaj atar' : 'Önce bir oda seç'} onPress={tk.panelCh ? sendPanel : undefined} last />
        </>}
      </Section>
    </Screen>
  );
}

// Kaydet butonlu metin kutusu
function Txt({ value, onSave, max, placeholder }: { value: string; onSave: (v: string) => void; max: number; placeholder?: string }) {
  const [v, setV] = useState(value), dirty = v !== value;
  return (
    <View style={{ padding: 12, gap: 8 }}>
      <TextInput value={v} onChangeText={x => setV(x.slice(0, max))} multiline placeholder={placeholder} placeholderTextColor={C.faint} accessibilityLabel={placeholder}
        style={{ minHeight: 60, borderRadius: 12, backgroundColor: C.field, color: C.ink, padding: 12, fontFamily: F.regular, fontSize: 15, textAlignVertical: 'top' }} />
      {dirty && <Button title="Kaydet" onPress={() => onSave(v.trim())} style={{ height: 40 }} />}
    </View>
  );
}
function ChPick({ s, value, onChange, none }: { s: Server; value: string | null; onChange: (v: string | null) => void; none: string }) {
  const [open, setOpen] = useState(false);
  const txt = s.channels.filter(c => (c.type || 'text') === 'text');
  const cur = txt.find(c => c.id === value);
  return <>
    <Row icon="hash" title={cur ? '#' + cur.name : none} sub="Oda" onPress={() => setOpen(true)} />
    <Sheet open={open} onClose={() => setOpen(false)} title="Oda seç">
      <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
        <Row title={none} onPress={() => { onChange(null); setOpen(false); }} />
        {txt.map((c, i) => <Row key={c.id} icon="hash" title={c.name} right={c.id === value ? <T style={{ color: C.accent, fontFamily: F.black }}>✓</T> : undefined} last={i === txt.length - 1} onPress={() => { onChange(c.id); setOpen(false); }} />)}
      </View>
    </Sheet>
  </>;
}
function RolePick({ s, value, onChange, label }: { s: Server; value: string | null; onChange: (v: string | null) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const roles = (s.customRoles || []).filter(r => !r.bot);
  const cur = roles.find(r => r.id === value);
  return <>
    <Row icon="tag" title={cur ? cur.name : 'Yok'} sub={label} onPress={() => setOpen(true)} />
    <Sheet open={open} onClose={() => setOpen(false)} title={label}>
      <View style={{ borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
        <Row title="Yok" onPress={() => { onChange(null); setOpen(false); }} />
        {roles.map((r, i) => <Row key={r.id} icon="tag" iconColor={r.color} title={r.name} right={r.id === value ? <T style={{ color: C.accent, fontFamily: F.black }}>✓</T> : undefined} last={i === roles.length - 1} onPress={() => { onChange(r.id); setOpen(false); }} />)}
      </View>
    </Sheet>
  </>;
}
