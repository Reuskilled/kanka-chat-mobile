// Davet kodlarım: Kanka'ya arkadaş çağırmak için kişisel kodlar (beta döneminde kayıt kodla oluyor)
import { useEffect, useState } from 'react';
import { ActivityIndicator, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { myCodes, useReady, type InvCode } from '@/lib/kanka';
import { C, F } from '@/lib/theme';
import { Screen, Section, Row, Empty } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';
import { Avatar } from '@/components/Avatar';

const link = (c: string) => `https://kankahq.com/kod/${c}`;

export default function DavetKodlari() {
  const ready = useReady();
  const [r, setR] = useState<{ codes: InvCode[]; joined: number; beta: boolean } | null>(null), [err, setErr] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { if (ready) myCodes().then(x => (x?.ok ? setR({ codes: x.codes || [], joined: x.joined || 0, beta: !!x.beta }) : setErr(x?.error || 'Yüklenemedi'))); }, [ready]);
  const share = async (c: string) => { try { await Share.share({ message: `Kanka'ya gel, birlikte takılalım: ${link(c)}` }); } catch { await Clipboard.setStringAsync(link(c)); } };
  const copy = async (c: string) => { await Clipboard.setStringAsync(link(c)); setCopied(c); setTimeout(() => setCopied(x => (x === c ? null : x)), 1500); };
  const free = r?.codes.filter(c => !c.usedBy) || [], used = r?.codes.filter(c => c.usedBy) || [];
  return (
    <Screen title="Davet kodlarım" sub={r?.beta ? 'Kanka şu an davetle açık: arkadaşın bu kodlardan biriyle kayıt olabilir' : 'Arkadaşlarını Kanka’ya çağır'}>
      {!r ? (err ? <Empty text={err} /> : <ActivityIndicator color={C.accent} style={{ marginTop: 30 }} />) : <>
        {r.joined > 0 && (
          <View style={{ padding: 16, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', gap: 2 }}>
            <T style={{ fontFamily: F.black, fontSize: 32, color: C.accent }}>{r.joined}</T>
            <T style={{ color: C.muted }}>kişi senin davetinle katıldı 🎉</T>
          </View>
        )}
        <Section title="Kullanılmamış" hint="Her kod bir kişi içindir. Biri kullanınca yerine yenisi gelir.">
          {!free.length ? <Empty text="Şu an boş kodun yok." /> : free.map((c, i) => (
            <View key={c.code} style={{ padding: 14, gap: 10, borderBottomWidth: i === free.length - 1 ? 0 : 1, borderBottomColor: C.line }}>
              <T selectable style={{ fontFamily: F.black, fontSize: 18, letterSpacing: 1.5 }}>{c.code}</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Paylaş" onPress={() => share(c.code)} style={{ flex: 1, height: 40 }} />
                <Button title={copied === c.code ? 'Kopyalandı' : 'Linki kopyala'} kind="ghost" onPress={() => copy(c.code)} style={{ flex: 1, height: 40 }} />
              </View>
            </View>
          ))}
        </Section>
        {used.length > 0 && (
          <Section title="Kullanılanlar">
            {used.map((c, i) => <Row key={c.code} left={<Avatar name={c.usedBy!} size={34} />} title={c.usedBy!} sub={`${c.code} ile katıldı`} last={i === used.length - 1} />)}
          </Section>
        )}
      </>}
    </Screen>
  );
}
