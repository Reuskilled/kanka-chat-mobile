import { Alert, View } from 'react-native';
import { blockUser, useKanka } from '@/lib/kanka';
import { C } from '@/lib/theme';
import { Screen, Row, Empty } from '@/components/AdminUI';
import { Button } from '@/components/ui';
import { Avatar } from '@/components/Avatar';


export default function Engellenenler() {
  const list = useKanka(s => s.blocked), users = useKanka(s => s.users);
  return (
    <Screen title="Engellediklerin" sub="Sana mesaj atamaz, seni arayamazlar">
      {!list.length ? <Empty text="Kimseyi engellemedin." /> : (
        <View style={{ borderRadius: 16, backgroundColor: C.card, overflow: 'hidden' }}>
          {list.map((n, i) => (
            <Row key={n} left={<Avatar name={n} size={36} />} title={users[n]?.displayName || n} sub={`@${n}`} last={i === list.length - 1}
              right={<Button kind="ghost" title="Engeli kaldır" style={{ height: 36, paddingHorizontal: 12 }} onPress={async () => { const e = await blockUser(n, false); if (e) Alert.alert('Olmadı', e); }} />} />
          ))}
        </View>
      )}
    </Screen>
  );
}
