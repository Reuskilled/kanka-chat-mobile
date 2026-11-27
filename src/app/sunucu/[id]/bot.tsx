import { useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useKanka } from '@/lib/kanka';
import { act, can } from '@/lib/admin';
import type { BotMod } from '@/lib/types';
import { Screen, Section, ToggleRow, Empty } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';
import { C } from '@/lib/theme';

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
      <T style={{ fontSize: 12.5, color: C.faint }}>Yasaklı kelimeler, kayıt odası, karşılama ve destek modülleri webdeki Sunucu ayarları › Kanka Bot’ta.</T>
    </Screen>
  );
}
