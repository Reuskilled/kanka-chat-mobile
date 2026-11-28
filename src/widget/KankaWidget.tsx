// Ana ekran widget'ı (Android): çevrimiçi arkadaşlar, dolu sesli odalar ve kısayollar
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export type WidgetData = { me: string | null; online: string[]; onlineN: number; voice: { name: string; n: number }[]; req: number; at: number };
export const EMPTY_WIDGET: WidgetData = { me: null, online: [], onlineN: 0, voice: [], req: 0, at: 0 };

const BG = '#111113', CARD = '#1c1c20', INK = '#f4f4f5', MUTED = '#a1a1aa', ACCENT = '#D4FF00';

function Btn({ label, uri }: { label: string; uri: string }) {
  return (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri }} accessibilityLabel={label}
      style={{ flex: 1, height: 36, borderRadius: 12, backgroundColor: CARD, justifyContent: 'center', alignItems: 'center', marginHorizontal: 3 }}>
      <TextWidget text={label} style={{ fontSize: 13, color: INK, fontWeight: '700' }} />
    </FlexWidget>
  );
}

export function KankaWidget({ d }: { d: WidgetData }) {
  const line = !d.me ? 'Giriş yapmak için dokun'
    : d.onlineN ? `${d.online.slice(0, 3).join(', ')}${d.onlineN > 3 ? ` +${d.onlineN - 3}` : ''}`
    : 'Şu an çevrimiçi arkadaş yok';
  const v = d.voice[0];
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 22, padding: 12, flexDirection: 'column', justifyContent: 'space-between' }}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text="Kanka" style={{ fontSize: 17, color: ACCENT, fontWeight: '900' }} />
        <TextWidget text={d.me ? `  ${d.onlineN} çevrimiçi` : ''} style={{ fontSize: 13, color: MUTED }} />
        {d.req > 0 ? <TextWidget text={`  · ${d.req} istek`} style={{ fontSize: 13, color: ACCENT }} /> : <TextWidget text="" />}
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
        <TextWidget text={line} maxLines={1} truncate="END" style={{ fontSize: 14, color: INK }} />
        <TextWidget text={v ? `🔊 ${v.name}: ${v.n} kişi${d.voice.length > 1 ? ` · +${d.voice.length - 1} oda` : ''}` : ''} maxLines={1} truncate="END" style={{ fontSize: 12.5, color: MUTED }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
        <Btn label="Mesajlar" uri="kanka://mesajlar" />
        <Btn label="Arkadaşlar" uri="kanka://arkadaslar" />
        <Btn label="Sunucu ekle" uri="kanka://sunucu-ekle" />
      </FlexWidget>
    </FlexWidget>
  );
}
