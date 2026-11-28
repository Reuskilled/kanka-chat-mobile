// Sunucu etiketi: isminin yanında bir sunucunun etiketini taşı (ör. 🦝 KNK)
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { setTag, tagInfo, useKanka, useReady, type TagInfo } from '@/lib/kanka';
import { C, F } from '@/lib/theme';
import { Screen, Section, Row, Empty } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';
import { TagView } from '@/components/TagChip';
import { Avatar } from '@/components/Avatar';

export default function Etiket() {
  const { sid } = useLocalSearchParams<{ sid?: string }>();
  const ready = useReady();
  const me = useKanka(s => s.me) || '';
  const mine = useKanka(s => s.users[s.me || '']?.tg || null);
  const defs = useKanka(s => s.acct.tagDefs), can = useKanka(s => s.acct.tagCan);
  const [info, setInfo] = useState<TagInfo | null>(null), [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (ready && sid) tagInfo(sid).then(setInfo); }, [ready, sid, mine]);
  const wear = async (id: string | null) => {
    setBusy(id || 'x'); const e = await setTag(id); setBusy(null);
    if (e) Alert.alert('Olmadı', e);
  };
  const cur = mine ? defs[mine] : null;
  return (
    <Screen title="Sunucu etiketi" sub="İsminin yanında bir sunucunun etiketini taşı">
      {!!info && sid && (
        <View style={{ padding: 16, borderRadius: 18, backgroundColor: C.card, gap: 12, alignItems: 'center' }}>
          <TagView d={info} big />
          <T style={{ fontFamily: F.black, fontSize: 18, textAlign: 'center' }}>{info.ad}</T>
          <T style={{ color: C.muted, textAlign: 'center' }}>{info.uye.toLocaleString('tr-TR')} üye · {info.takan.toLocaleString('tr-TR')} kişi bu etiketi takıyor</T>
          {info.mine ? <Button title="Etiketi çıkar" kind="ghost" busy={busy === 'x'} onPress={() => wear(null)} style={{ alignSelf: 'stretch' }} />
            : info.canUse ? <Button title="Bu etiketi tak" busy={busy === info.id} onPress={() => wear(info.id)} style={{ alignSelf: 'stretch' }} />
            : <T style={{ fontSize: 13, color: C.faint, textAlign: 'center' }}>{info.member ? 'Bu etiketi şimdilik sadece sunucunun ekibi takabiliyor.' : 'Bu etiketi takmak için sunucuya katılman gerekiyor.'}</T>}
        </View>
      )}
      <Section title="Şu an">
        {cur ? <Row left={<Avatar name={me} size={36} />} title={cur.ad} sub="İsminin yanında görünüyor" right={<TagView d={cur} />} />
          : <Row icon="tag" title="Etiket takmıyorsun" sub="Aşağıdan bir sunucu seç" />}
        {cur && <Row icon="close" title="Etiketi çıkar" danger onPress={() => wear(null)} last />}
      </Section>
      <Section title="Takabileceklerin" hint="Etiketi açık olan ve üyesi olduğun sunucular burada çıkar.">
        {!can.length ? <Empty text="Takabileceğin bir sunucu etiketi yok." /> : can.filter(id => defs[id]).map((id, i, a) => (
          <Row key={id} title={defs[id].ad} left={<TagView d={defs[id]} />} last={i === a.length - 1}
            right={id === mine ? <T style={{ color: C.accent, fontFamily: F.heavy }}>Takılı</T> : <Button title="Tak" kind="ghost" busy={busy === id} onPress={() => wear(id)} style={{ height: 36, paddingHorizontal: 14 }} />} />
        ))}
      </Section>
    </Screen>
  );
}
