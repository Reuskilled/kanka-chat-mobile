// Kanka sunucusuyla tüm konuşma burada: bağlantı, oturum, gelen olaylar ve uygulamanın ortak durumu.
// Ekranlar durumu useKanka() ile okur; değişiklikler set() ile yayılır.
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { SERVER, PROTOCOL, APP_VERSION } from './config';
import { getItem, setItem, deviceId } from './storage';
import type { Dm, LoginResult, Msg, Server, User } from './types';

export type State = {
  phase: 'boot' | 'out' | 'in';
  connected: boolean;
  me: string | null;
  meUser: User | null;
  users: Record<string, User>;
  presence: Record<string, string>;
  servers: Server[];
  dms: Dm[];
  voice: Record<string, string[]>;
  lastMsg: Record<string, number>;
  msgs: Record<string, Msg[]>;
  more: Record<string, boolean>; // daha eski mesaj var mı
  typing: Record<string, Record<string, number>>; // kanal -> kişi -> zaman
  cur: string | null;
  ageGate: LoginResult['ageGate'];
  friends: string[];
  notice: string | null;
};

let state: State = {
  phase: 'boot', connected: false, me: null, meUser: null, users: {}, presence: {}, servers: [], dms: [], voice: {},
  lastMsg: {}, msgs: {}, more: {}, typing: {}, cur: null, ageGate: null, friends: [], notice: null,
};
const subs = new Set<() => void>();
export const getState = () => state;
function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach(f => f());
}
export function useKanka<T>(pick: (s: State) => T): T {
  return useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => pick(state), () => pick(state));
}

let socket: Socket | null = null;
const TOKEN = 'kanka-token';

// Bekleyen cevaplı istek: sunucu cevap vermezse 15 sn sonra hata döner
export function ask<T = any>(ev: string, ...args: unknown[]): Promise<T> {
  return new Promise(resolve => {
    if (!socket?.connected) return resolve({ error: 'Bağlantı yok, tekrar deneniyor…' } as T);
    const t = setTimeout(() => resolve({ error: 'Sunucu cevap vermedi' } as T), 15000);
    socket.emit(ev, ...args, (r: T) => { clearTimeout(t); resolve(r); });
  });
}
export const fire = (ev: string, ...args: unknown[]) => { socket?.emit(ev, ...args); };

function applyLogin(r: LoginResult) {
  const users: Record<string, User> = {};
  for (const u of r.users || []) users[u.name] = u;
  const presence: Record<string, string> = {};
  for (const [n, s] of r.online || []) presence[n] = s;
  set({
    phase: 'in', me: r.user?.name ?? null, meUser: r.user ?? null, users, presence, servers: r.servers || [], dms: r.dms || [],
    voice: r.voice || {}, lastMsg: r.lastMsg || {}, ageGate: r.ageGate ?? null, friends: r.social?.friends || [],
  });
  if (r.token) setItem(TOKEN, r.token);
  // Açık bir sohbet varsa (bağlantı koptu ve geri geldi) odaya yeniden gir ve kaçırılanları al
  const cur = state.cur; if (cur) join(cur);
}

function onEvents(s: Socket) {
  s.on('connect', async () => {
    set({ connected: true });
    s.emit('yeniIstemci'); // güncel istemciyiz: "sayfayı yenile" uyarıları gelmesin, durumlar fark olarak gelsin
    const t = await getItem(TOKEN);
    if (!t) return set({ phase: 'out' });
    s.emit('auth', t, (r: LoginResult) => {
      if (r?.error) { setItem(TOKEN, null); set({ phase: 'out', notice: r.banned ? r.error : null }); return; }
      applyLogin(r);
    });
  });
  s.on('disconnect', () => set({ connected: false }));
  s.on('connect_error', () => { set({ connected: false }); if (state.phase === 'boot') getItem(TOKEN).then(t => { if (!t) set({ phase: 'out' }); }); });

  s.on('message', ({ channelId, msg }: { channelId: string; msg: Msg }) => {
    set(st => {
      const list = st.msgs[channelId];
      const lastMsg = { ...st.lastMsg, [channelId]: msg.time };
      const typing = st.typing[channelId] ? { ...st.typing, [channelId]: { ...st.typing[channelId], [msg.author]: 0 } } : st.typing;
      if (!list) return { lastMsg, typing };
      if (list.some(m => m.id === msg.id)) return { lastMsg };
      return { msgs: { ...st.msgs, [channelId]: [...list, msg] }, lastMsg, typing };
    });
  });
  s.on('update', ({ channelId, msg }: { channelId: string; msg: Msg }) => {
    set(st => {
      const list = st.msgs[channelId]; if (!list) return {};
      return { msgs: { ...st.msgs, [channelId]: list.map(m => (m.id === msg.id ? msg : m)) } };
    });
  });
  s.on('typing', ({ channelId, name }: { channelId: string; name: string }) => {
    set(st => ({ typing: { ...st.typing, [channelId]: { ...(st.typing[channelId] || {}), [name]: Date.now() } } }));
  });
  s.on('servers', (servers: Server[]) => set({ servers }));
  s.on('dms', (dms: Dm[]) => set({ dms }));
  s.on('users', (list: User[]) => { const users: Record<string, User> = {}; for (const u of list) users[u.name] = u; set(st => ({ users, meUser: st.me ? users[st.me] ?? st.meUser : st.meUser })); });
  s.on('usersPatch', ({ upd = [], del = [] }: { upd?: User[]; del?: string[] }) => set(st => {
    const users = { ...st.users }; for (const u of upd) users[u.name] = u; for (const n of del) delete users[n];
    return { users, meUser: st.me ? users[st.me] ?? st.meUser : st.meUser };
  }));
  s.on('presence', (list: [string, string][]) => { const p: Record<string, string> = {}; for (const [n, v] of list) p[n] = v; set({ presence: p }); });
  s.on('presenceDiff', ({ set: add = [], del = [] }: { set?: [string, string][]; del?: string[] }) => set(st => {
    const p = { ...st.presence }; for (const [n, v] of add) p[n] = v; for (const n of del) delete p[n]; return { presence: p };
  }));
  s.on('social', (x: { friends?: string[] }) => set({ friends: x?.friends || [] }));
  s.on('voiceState', (voice: Record<string, string[]>) => set({ voice }));
  s.on('forceLogout', (msg: string) => { setItem(TOKEN, null); set({ phase: 'out', notice: String(msg || 'Oturumun kapatıldı.'), cur: null, msgs: {} }); });
}

export async function start() {
  if (socket) return;
  const d = await deviceId();
  socket = io(SERVER, {
    transports: ['websocket'],
    auth: { d, app: 'mobil', v: APP_VERSION, p: PROTOCOL },
    // React Native'de WebSocket başlıkları buradan gider; sunucu cihaz adını (Ayarlar > Cihazlar) bundan çıkarır
    extraHeaders: { 'user-agent': `KankaApp/${APP_VERSION} (${Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : 'Web'})` },
    reconnectionDelay: 800,
    reconnectionDelayMax: 6000,
  });
  onEvents(socket);
}

export async function login(name: string, password: string, code?: string): Promise<LoginResult> {
  const r = await ask<LoginResult>('login', { name, password, code });
  if (r && !r.error && !r.needTfa && r.token) applyLogin(r);
  return r;
}

export async function register(p: { name: string; password: string; email: string; dob: string; terms: boolean; veli?: boolean; code?: string }): Promise<LoginResult & { field?: string }> {
  const r = await ask<LoginResult & { field?: string }>('register', { ...p, src: 'mobil' });
  if (r && !r.error && r.token) applyLogin(r);
  return r;
}

export async function logout() {
  const t = await getItem(TOKEN);
  fire('logout', t);
  await setItem(TOKEN, null);
  set({ phase: 'out', me: null, meUser: null, msgs: {}, cur: null, servers: [], dms: [] });
}

export function clearNotice() { set({ notice: null }); }

// ---- Sohbet ----
export async function join(chId: string): Promise<{ error?: string }> {
  set({ cur: chId });
  const r = await ask<{ error?: string; messages?: Msg[] }>('join', chId);
  if (r?.error) return r;
  set(st => ({ msgs: { ...st.msgs, [chId]: r.messages || [] }, more: { ...st.more, [chId]: (r.messages?.length || 0) >= 150 } }));
  return {};
}
export function leave(chId: string) { if (state.cur === chId) set({ cur: null }); }

export async function loadOlder(chId: string) {
  const list = state.msgs[chId]; if (!list?.length || state.cur !== chId || state.more[chId] === false) return;
  const r = await ask<{ messages?: Msg[]; more?: boolean; error?: string }>('history', { before: list[0].id });
  const older = r?.messages || [];
  set(st => ({ msgs: { ...st.msgs, [chId]: [...older.filter(m => !(st.msgs[chId] || []).some(x => x.id === m.id)), ...(st.msgs[chId] || [])] }, more: { ...st.more, [chId]: !!r?.more } }));
}

export async function send(text: string, replyTo?: string | null): Promise<{ error?: string }> {
  const r = await ask<{ error?: string; ok?: boolean; msg?: Msg }>('message', { text, ...(replyTo ? { replyTo } : {}) });
  if (r?.msg && state.cur) {
    const ch = state.cur, msg = r.msg;
    set(st => ({ msgs: { ...st.msgs, [ch]: (st.msgs[ch] || []).some(m => m.id === msg.id) ? st.msgs[ch] : [...(st.msgs[ch] || []), msg] } }));
  }
  return r?.error ? { error: r.error } : {};
}
export const react = (msgId: string, emoji: string) => fire('react', { msgId, emoji });
let lastTyping = 0;
export function typing() { const n = Date.now(); if (n - lastTyping > 3000) { lastTyping = n; fire('typing'); } }

// ---- Yardımcılar ----
export const dmIdWith = (a: string, b: string) => 'dm:' + [a, b].sort().join('|');
export const displayName = (n?: string | null) => (n ? state.users[n]?.displayName || n : '');
export function findChannel(chId: string): { server: Server; channel: Server['channels'][number] } | null {
  for (const s of state.servers) { const c = s.channels.find(x => x.id === chId); if (c) return { server: s, channel: c }; }
  return null;
}
export const dmPeers = (chId: string) => chId.replace(/^dm:/, '').split('|');
