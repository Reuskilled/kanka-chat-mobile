// Uygulama açıkken widget'ı güncel tutar; son hâli telefonda saklanır (uygulama kapalıyken widget onu gösterir)
import { requestWidgetUpdate } from 'react-native-android-widget';
import { getState, subscribe } from '@/lib/kanka';
import { setItem } from '@/lib/storage';
import { KankaWidget, type WidgetData } from './KankaWidget';

export const WIDGET_KEY = 'kanka-widget';
let wired = false, last = '', timer: ReturnType<typeof setTimeout> | null = null;

function snapshot(): WidgetData {
  const s = getState();
  if (s.phase !== 'in') return { me: null, online: [], onlineN: 0, voice: [], req: 0, at: Date.now() };
  const on = s.friends.filter(f => s.presence[f] && s.presence[f] !== 'offline');
  const voice: WidgetData['voice'] = [];
  for (const sv of s.servers) for (const c of sv.channels) { const n = s.voice[c.id]?.length || 0; if (n) voice.push({ name: c.name, n }); }
  voice.sort((a, b) => b.n - a.n);
  return { me: s.me, online: on.slice(0, 3).map(f => s.users[f]?.displayName || f), onlineN: on.length, voice: voice.slice(0, 3), req: s.reqIn.length, at: Date.now() };
}

function push() {
  timer = null;
  const d = snapshot(); const key = JSON.stringify({ ...d, at: 0 });
  if (key === last) return; last = key;
  setItem(WIDGET_KEY, JSON.stringify(d)).catch(() => {});
  requestWidgetUpdate({ widgetName: 'Kanka', renderWidget: () => <KankaWidget d={d} /> }).catch(() => {});
}

export function wireWidget() {
  if (wired) return; wired = true;
  subscribe(() => { if (!timer) timer = setTimeout(push, 3000); });
}
