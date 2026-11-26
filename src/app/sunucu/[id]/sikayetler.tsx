import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ask, displayName, useReady } from '@/lib/kanka';
import { fmtAgo } from '@/lib/admin';
import { C, F } from '@/lib/theme';
import { Screen, Chips, Empty } from '@/components/AdminUI';
import { T, Button } from '@/components/ui';

type Rep = { id: string; kind: 'msg' | 'user'; target: string; reasonText?: string; note?: string; where?: string; at: number; status: string; action?: string; handledBy?: string;
  msg?: { text?: string; image?: string | null }; msgAlive?: boolean | null; priors?: number; urgent?: boolean };

export default function Sikayetler() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ready = useReady();
  const [status, setStatus] = useState<'open' | 'done'>('open');
  const [list, setList] = useState<Rep[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    ask<{ reports?: Rep[]; error?: string }>('reports', { serverId: id, status }).then(r => { if (alive) setList(r?.reports || []); });
    return () => { alive = false; };
  }, [id, status, ready]);
  const doAct = async (r: Rep, action: string, label?: string) => {
    setBusy(r.id + action);
    const x = await ask<{ error?: string; report?: Rep }>('reportAct', { id: r.id, action, label });
    setBusy(null);
    if (x?.error) return Alert.alert('Olmadı', x.error);
    setList(l => (l || []).filter(y => y.id !== r.id));
  };
  return (
    <Screen title="Şikayetler" sub="Bu sunucuda bildirilenler">
      <Chips value={status} options={[['open', 'Bekleyen'], ['done', 'Çözülen']]} onChange={v => { setList(null); setStatus(v); }} />
      {list === null ? <Empty text="Yükleniyor…" /> : !list.length ? <Empty text={status === 'open' ? 'Bekleyen şikayet yok 🎉' : 'Henüz çözülen şikayet yok.'} /> : list.map(r => (
        <View key={r.id} style={{ borderRadius: 16, backgroundColor: C.card, padding: 14, gap: 8, borderWidth: r.urgent ? 1.5 : 0, borderColor: C.danger }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T style={{ flex: 1, fontFamily: F.black, fontSize: 15 }}>{r.reasonText || 'Şikayet'}</T>
            <T style={{ fontSize: 12, color: C.faint }}>{fmtAgo(r.at)}</T>
          </View>
          <T style={{ fontSize: 13.5, color: C.ink2 }}>{r.kind === 'msg' ? 'Mesaj' : 'Kullanıcı'}: <T style={{ fontFamily: F.heavy, fontSize: 13.5 }}>{displayName(r.target)}</T>{r.where ? ` · ${r.where}` : ''}{r.priors ? ` · daha önce ${r.priors} şikayet` : ''}</T>
          {!!r.msg?.text && <View style={{ padding: 10, borderRadius: 10, backgroundColor: C.field }}><T style={{ fontSize: 14, lineHeight: 20 }}>{r.msg.text}</T>{r.msgAlive === false && <T style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>Bu mesaj artık yok</T>}</View>}
          {!!r.note && <T style={{ fontSize: 13, color: C.muted }}>Not: {r.note}</T>}
          {status === 'open' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {r.kind === 'msg' && r.msgAlive !== false && <Button kind="danger" title="Mesajı sil" style={{ flexGrow: 1, height: 42 }} busy={busy === r.id + 'delete'} onPress={() => doAct(r, 'delete')} />}
              <Button kind="ghost" title="Gereken yapıldı" style={{ flexGrow: 1, height: 42 }} busy={busy === r.id + 'resolve'} onPress={() => doAct(r, 'resolve', 'Gereken yapıldı')} />
              <Button kind="ghost" title="Sorun yok" style={{ flexGrow: 1, height: 42 }} busy={busy === r.id + 'dismiss'} onPress={() => doAct(r, 'dismiss')} />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T style={{ flex: 1, fontSize: 13, color: C.online, fontFamily: F.bold }}>{r.action || 'Çözüldü'}{r.handledBy ? ` · ${displayName(r.handledBy)}` : ''}</T>
              <Button kind="ghost" title="Yeniden aç" style={{ height: 38, paddingHorizontal: 14 }} onPress={() => doAct(r, 'reopen')} />
            </View>
          )}
        </View>
      ))}
    </Screen>
  );
}
