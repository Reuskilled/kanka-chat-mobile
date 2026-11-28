// Katılım güvenliği: hesap şartları (seviye), katılım soruları ve onaylı katılım
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useKanka } from '@/lib/kanka';
import { act } from '@/lib/admin';
import { C, F } from '@/lib/theme';
import { Screen, Section, ToggleRow, Empty } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';
import { Icon } from '@/components/Icon';

const LV: [string, string][] = [['Yok', 'Herkes yazabilir.'], ['Düşük', 'Hesabına e-posta eklemiş olmalı.'], ['Orta', 'E-posta + hesap en az 1 günlük olmalı.'], ['Yüksek', 'E-posta + hesap en az 7 günlük + sunucuda 10 dakika beklemiş olmalı.'], ['En yüksek', 'Yüksek seviye + iki adımlı doğrulama açık olmalı.']];

export default function Katilim() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useKanka(st => st.servers.find(x => x.id === id) || null);
  const [lv, setLv] = useState(s?.secLevel || 0);
  const [qs, setQs] = useState<string[]>(() => [...(s?.gate?.questions || [])]);
  const [appr, setAppr] = useState(!!s?.gate?.approval), [busy, setBusy] = useState(false);
  if (!s) return <Screen title="Katılım güvenliği"><Empty text="Sunucu bulunamadı." /></Screen>;
  const save = async () => {
    setBusy(true); const e = await act('secSave', { serverId: s.id, level: lv, questions: qs.map(q => q.trim()).filter(Boolean), approval: appr }); setBusy(false);
    if (e) Alert.alert('Kaydedilemedi', e); else router.back();
  };
  return (
    <Screen title="Katılım güvenliği" sub={s.name}>
      <T style={{ color: C.muted, fontSize: 13.5, lineHeight: 19 }}>Yeni gelenler önce hesap şartlarından, sonra sunucu kapısından (kurallar, sorular, onay) geçer. Rolü olan üyeler ve yetkililer hesap şartlarından muaftır.</T>
      <Section title="Hesap şartları" hint="Şartları sağlamayan kişi sunucuya girer, okuyabilir ama yazamaz ve sese giremez.">
        {LV.map(([t, d], i) => (
          <Pressable key={i} accessibilityRole="radio" accessibilityState={{ checked: lv === i }} onPress={() => setLv(i)}
            style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, backgroundColor: pressed ? C.hover : 'transparent', borderBottomWidth: i === LV.length - 1 ? 0 : 1, borderBottomColor: C.line })}>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: lv === i ? C.accent : C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>{lv === i && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent }} />}</View>
            <View style={{ flex: 1 }}><T style={{ fontFamily: F.heavy }}>{t}</T><T style={{ fontSize: 12.5, color: C.muted }}>{d}</T></View>
          </Pressable>
        ))}
      </Section>
      <Section title={`Katılım soruları (${qs.length}/3)`} hint="Sorular hoş geldin ekranında, kuralların altında sorulur. Cevaplar Başvurular sayfasında görünür.">
        {qs.map((q, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <TextInput value={q} onChangeText={v => setQs(a => a.map((x, j) => (j === i ? v.slice(0, 150) : x)))} placeholder="Örn. Bizi nereden buldun?" placeholderTextColor={C.faint} accessibilityLabel={`${i + 1}. soru`}
              style={{ flex: 1, minHeight: 42, borderRadius: 10, backgroundColor: C.field, color: C.ink, paddingHorizontal: 12, fontFamily: F.regular, fontSize: 15 }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Soruyu sil" hitSlop={8} onPress={() => setQs(a => a.filter((_, j) => j !== i))}><Icon name="close" size={18} color={C.muted} /></Pressable>
          </View>
        ))}
        {qs.length < 3 && (
          <Pressable accessibilityRole="button" onPress={() => setQs(a => [...a, ''])} style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, backgroundColor: pressed ? C.hover : 'transparent' })}>
            <Icon name="plus" size={18} color={C.accent} /><T style={{ fontFamily: F.heavy, color: C.accent }}>Soru ekle</T>
          </Pressable>
        )}
      </Section>
      <Section hint="Yeni gelen, bir yetkili onaylayana kadar yazamaz. Başvurular sayfasından onaylar ya da reddedersin.">
        <ToggleRow title="Onaylı katılım" value={appr} onChange={setAppr} last />
      </Section>
      {(qs.some(q => q.trim()) || appr) && !s.welcome?.enabled && <T style={{ fontSize: 12.5, color: C.faint }}>Kaydedince hoş geldin ekranı da açılır (sorular ve onay orada gösterilir).</T>}
      <Button title="Kaydet" busy={busy} onPress={save} />
    </Screen>
  );
}
