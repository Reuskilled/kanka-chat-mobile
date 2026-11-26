import Svg, { Path, Circle, Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';
import { C } from '@/lib/theme';

// Çizgi ikonlar (sitedeki ikon diliyle aynı: yuvarlak uçlu, 2.2 kalınlık)
const P: Record<string, (c: string) => React.ReactNode> = {
  home: () => <Path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  chat: () => <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" />,
  bell: () => <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" />,
  search: () => (<><Circle cx={11} cy={11} r={7} /><Path d="m20 20-3.5-3.5" /></>),
  back: () => <Path d="m15 18-6-6 6-6" />,
  chevron: () => <Path d="m9 6 6 6-6 6" />,
  down: () => <Path d="m6 9 6 6 6-6" />,
  plus: () => <Path d="M12 5v14M5 12h14" />,
  send: () => <Path d="M5 12h14M13 6l6 6-6 6" />,
  smile: () => (<><Circle cx={12} cy={12} r={9} /><Path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></>),
  users: () => (<><Circle cx={9} cy={8} r={4} /><Path d="M2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 0 1 0 8M22 21c0-3-1.5-5-4-5.7" /></>),
  userAdd: () => (<><Circle cx={9} cy={8} r={4} /><Path d="M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6" /></>),
  lock: () => (<><Rect x={5} y={11} width={14} height={10} rx={2} /><Path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  speaker: () => <Path d="M11 5 6 9H3v6h3l5 4V5zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />,
  reply: () => <Path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 5 5v6" />,
  pen: () => <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  settings: () => (<><Circle cx={12} cy={12} r={3} /><Path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>),
  clock: () => (<><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3 2" /></>),
  screen: () => (<><Rect x={3} y={4} width={18} height={12} rx={2} /><Path d="M8 20h8" /></>),
  tag: () => <Path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" />,
  logout: () => <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  file: () => (<><Path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><Path d="M14 3v6h6" /></>),
  hash: () => <Path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18" />,
  mic: () => (<><Rect x={9} y={3} width={6} height={11} rx={3} /><Path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>),
  micOff: () => <Path d="M3 3l18 18M9 9v3a3 3 0 0 0 5 2M15 10V5a3 3 0 0 0-6-1M19 11a7 7 0 0 1-1 3.5M5 11a7 7 0 0 0 11 5.7M12 19v3" />,
  headphones: () => <Path d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z" />,
  headphonesOff: () => <Path d="M3 3l18 18M3 18v-6a9 9 0 0 1 3-6.7M9 3.5A9 9 0 0 1 21 12v4M3 19a2 2 0 0 0 2 2h1v-6H3zM18 15h3v4" />,
  phone: () => <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />,
  hangup: () => <Path d="M21 15.5c-2.5-2-5.5-3-9-3s-6.5 1-9 3l2 3 3.5-1.5v-3a12 12 0 0 1 7 0v3l3.5 1.5z" />,
};

export function Icon({ name, size = 22, color: col = C.ink, stroke = 2.2 }: { name: keyof typeof P | string; size?: number; color?: ColorValue; stroke?: number }) {
  const draw = P[name]; if (!draw) return null;
  const color = String(col ?? C.ink);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {draw(color)}
    </Svg>
  );
}
