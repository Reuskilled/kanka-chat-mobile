// Kanka'nın görünümü: sitedeki renklerle aynı (koyu zemin, neon yeşil vurgu, Nunito)
export const C = {
  bg: '#09090b',
  bgDeep: '#070709',
  panel: '#0e0e11',
  card: '#16161a',
  field: '#18181c',
  hover: '#222228',
  line: 'rgba(255,255,255,0.06)',
  lineStrong: '#27272e',
  ink: '#f4f4f5',
  ink2: '#e4e4e7',
  muted: '#a1a1aa',
  faint: '#71717a',
  accent: '#d4ff00',
  accentSoft: 'rgba(212,255,0,0.14)',
  onAccent: '#09090b',
  danger: '#ef4444',
  online: '#3ddc84',
  idle: '#facc15',
  dnd: '#ef4444',
  offline: '#52525b',
} as const;

export const F = {
  regular: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  heavy: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

export const statusColor = (s?: string | null) =>
  s === 'online' ? C.online : s === 'idle' ? C.idle : s === 'dnd' ? C.dnd : C.offline;
