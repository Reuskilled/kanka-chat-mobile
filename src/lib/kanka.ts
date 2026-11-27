// Kanka sunucusuyla tüm konuşma burada: bağlantı, oturum, gelen olaylar ve uygulamanın ortak durumu.
// Ekranlar durumu useKanka() ile okur; değişiklikler set() ile yayılır.
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { SERVER, PROTOCOL, APP_VERSION } from './config';
import { getItem, setItem, deviceId } from './storage';
import type { Dm, LoginResult, Msg, Server, User } from './types';
import { createE2E, rnd, b64, type Inner } from './e2e';
import { gcm } from '@noble/ciphers/aes.js';
import { readBytes } from './files';

export type Dec = { inner: Inner } | { bad: true } | { wait: true };
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
  blocked: string[];
  userSheet: string | null; // dokunulan kullanıcının kartı
  dec: Record<string, Dec>; // şifreli mesajların bu cihazda açılmış hâli
  ice: any[];
  vflags: Record<string, Record<string, { m?: boolean; d?: boolean }>>;
  myVoice: string | null;
  vPeers: string[]; // odadaki diğer kişiler (aramalar dahil)
  vConnecting: boolean;
  muted: boolean;
  deaf: boolean;
  speaker: boolean;
  speaking: Record<string, boolean>;
  ringing: { from: string; chatId: string; callId: string; video?: boolean; title: string } | null;
  outgoing: string | null; // aradığımız sohbet
  myCam: boolean; myScreen: boolean; camFront: boolean;
  vMedia: Record<string, { name: string; cam: boolean; screen: boolean }>; // odadakilerin kamera/yayın durumu (bağlantı kimliğine göre)
  vWatch: string | null; // izlediğim ekran yayını
  vVer: number; // görüntü akışları değişince ekranı tazelemek için
  vToast: string | null;
  minor: boolean;
  magaza: { play: boolean; apple: boolean }; // Spark hangi mağazada satışta (vergi/ürün hazır olunca sunucu açar)
  e2eLocked: boolean;
  e2eBusy: boolean;
  notice: string | null;
};

let state: State = {
  phase: 'boot', connected: false, me: null, meUser: null, users: {}, presence: {}, servers: [], dms: [], voice: {},
  lastMsg: {}, msgs: {}, more: {}, typing: {}, cur: null, ageGate: null, friends: [], blocked: [], userSheet: null, dec: {}, ice: [], vflags: {}, myVoice: null, vPeers: [], vConnecting: false, muted: false, deaf: false, speaker: true, speaking: {}, ringing: null, outgoing: null, myCam: false, myScreen: false, camFront: true, vMedia: {}, vWatch: null, vVer: 0, vToast: null, minor: false, magaza: { play: false, apple: false }, e2eLocked: false, e2eBusy: false, notice: null,
};
const subs = new Set<() => void>();
export const getState = () => state;
// Bağlı ve girişli miyiz: sunucudan veri isteyen ekranlar bunu bekler (soğuk açılışta erken istek boş dönmesin)
// Spark bu telefonda satılabiliyor mu (satış kapalıyken Spark/Energy girişleri hiç görünmez: mağazalar "yakında" ekranını kabul etmiyor)
export const useSparkSatis = () => useKanka(s => (Platform.OS === 'ios' ? s.magaza.apple : s.magaza.play));
export const useReady = () => useKanka(s => s.connected && s.phase === 'in');
function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach(f => f());
}
export function useKanka<T>(pick: (s: State) => T): T {
  return useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => pick(state), () => pick(state));
}

let socket: Socket | null = null;
// Başka modüllerin (ses) sunucu olaylarını dinlemesi için
const pendingHandlers: [string, (...a: any[]) => void][] = [];
export function onSocket(ev: string, fn: (...a: any[]) => void) {
  const h: [string, (...a: any[]) => void] = [ev, fn]; pendingHandlers.push(h); socket?.on(ev, fn);
  return () => { const i = pendingHandlers.indexOf(h); if (i >= 0) pendingHandlers.splice(i, 1); socket?.off(ev, fn); };
}
export const socketId = () => socket?.id || null;
// Oturum açıldıktan (ya da bağlantı geri gelip yeniden doğrulandıktan) sonra çalışacaklar
export const afterAuth: (() => void)[] = [];
export function setVoice(patch: Partial<State>) { set(patch); }
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

export const e2e = createE2E(ask);
e2e.subscribe(() => { set({ e2eLocked: e2e.locked() }); retryDec(); });

// Şifreli mesajları aç (sonuç state.dec'e yazılır). Anahtarı henüz gelmemiş olanlar "bekliyor" kalır, anahtar gelince tekrar denenir.
const decBusy = new Set<string>();
async function decrypt(chId: string, list: Msg[]) {
  const todo = list.filter(m => m.enc && !decBusy.has(m.id) && !('inner' in (state.dec[m.id] || {})) && !('bad' in (state.dec[m.id] || {})));
  if (!todo.length) return;
  todo.forEach(m => decBusy.add(m.id));
  await e2e.whenBooted();
  const out: Record<string, Dec> = {};
  for (const m of todo) {
    try { const r = await e2e.open(chId, m as any); out[m.id] = r ? r : { wait: true }; } catch { out[m.id] = { bad: true }; }
    decBusy.delete(m.id);
  }
  set(st => ({ dec: { ...st.dec, ...out } }));
}
function retryDec() { const ch = state.cur; if (ch && state.msgs[ch]) decrypt(ch, state.msgs[ch]); }
const isPriv = (ch: string) => /^(dm|g):/.test(ch);

function applyLogin(r: LoginResult) {
  const users: Record<string, User> = {};
  for (const u of r.users || []) users[u.name] = u;
  const presence: Record<string, string> = {};
  for (const [n, s] of r.online || []) presence[n] = s;
  set({
    phase: 'in', me: r.user?.name ?? null, meUser: r.user ?? null, users, presence, servers: r.servers || [], dms: r.dms || [],
    voice: r.voice || {}, ice: (r as any).ice || [], lastMsg: r.lastMsg || {}, ageGate: r.ageGate ?? null, minor: !!r.minor, magaza: (r as any).magaza || { play: false, apple: false }, friends: r.social?.friends || [], blocked: r.social?.blocked || [],
  });
  if (r.token) setItem(TOKEN, r.token);
  // Sunucu bildirim göndermeden önce "kişi şu an uygulamaya bakıyor mu" diye bakar: ön planda mıyız söyle
  fire('vis', AppState.currentState === 'active');
  // Açık bir sohbet varsa (bağlantı koptu ve geri geldi) odaya yeniden gir ve kaçırılanları al
  const cur = state.cur; if (cur) join(cur);
  for (const f of afterAuth) { try { f(); } catch (e) { console.warn(e); } }
}

function onEvents(s: Socket) {
  s.on('connect', async () => {
    set({ connected: true });
    s.emit('yeniIstemci'); // güncel istemciyiz: "sayfayı yenile" uyarıları gelmesin, durumlar fark olarak gelsin
    const t = await getItem(TOKEN);
    if (!t) return set({ phase: 'out' });
    s.emit('auth', t, (r: LoginResult) => {
      if (r?.error) { setItem(TOKEN, null); set({ phase: 'out', notice: r.banned ? r.error : null }); return; }
      applyLogin(r); bootE2E(null);
    });
  });
  s.on('disconnect', () => set({ connected: false }));
  s.on('connect_error', () => { set({ connected: false }); if (state.phase === 'boot') getItem(TOKEN).then(t => { if (!t) set({ phase: 'out' }); }); });

  s.on('e2eNeed', () => setTimeout(() => e2e.reshare(), 500 + Math.random() * 1500));
  s.on('e2eConvUpd', (chId: string) => { e2e.convChanged(chId); if (state.cur === chId) e2e.enter(chId).then(retryDec); });
  s.on('e2eMigrated', ({ channelId }: { channelId: string }) => { if (state.cur === channelId) join(channelId); });
  s.on('message', ({ channelId, msg }: { channelId: string; msg: Msg }) => {
    if (msg.enc) decrypt(channelId, [msg]);
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
    if (msg.enc) { set(st => { const dec = { ...st.dec }; delete dec[msg.id]; return { dec }; }); decrypt(channelId, [msg]); }
    set(st => {
      const list = st.msgs[channelId]; if (!list) return {};
      return { msgs: { ...st.msgs, [channelId]: list.map(m => (m.id === msg.id ? msg : m)) } };
    });
  });
  s.on('remove', ({ channelId, msgId }: { channelId: string; msgId: string }) => {
    set(st => { const list = st.msgs[channelId]; return list ? { msgs: { ...st.msgs, [channelId]: list.filter(m => m.id !== msgId) } } : {}; });
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
  s.on('social', (x: { friends?: string[]; blocked?: string[] }) => set({ friends: x?.friends || [], ...(x?.blocked ? { blocked: x.blocked } : {}) }));
  s.on('voiceState', (voice: Record<string, string[]>) => set({ voice }));
  s.on('voiceFlags', (vflags: State['vflags']) => set({ vflags: vflags || {} }));
  s.on('ice', (ice: any[]) => set({ ice: ice || [] }));
  for (const [ev, fn] of pendingHandlers) s.on(ev, fn);
  s.on('forceLogout', (msg: string) => { setItem(TOKEN, null); set({ phase: 'out', notice: String(msg || 'Oturumun kapatıldı.'), cur: null, msgs: {} }); });
}

export async function start() {
  if (socket) return;
  AppState.addEventListener('change', st => { if (state.phase === 'in') fire('vis', st === 'active'); });
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
  if (r && !r.error && !r.needTfa && r.token) { applyLogin(r); bootE2E(password); }
  return r;
}

export async function register(p: { name: string; password: string; email: string; dob: string; terms: boolean; veli?: boolean; code?: string }): Promise<LoginResult & { field?: string }> {
  const r = await ask<LoginResult & { field?: string }>('register', { ...p, src: 'mobil' });
  if (r && !r.error && r.token) { applyLogin(r); bootE2E(p.password); }
  return r;
}
// Şifreli DM anahtarı: girişte şifre elimizdeyken yedek bu cihazda açılır (ilk seferde birkaç saniye sürebilir)
function bootE2E(pw: string | null) {
  if (!state.me) return;
  if (pw) set({ e2eBusy: true });
  e2e.boot(state.me, pw).finally(() => { set({ e2eBusy: false, e2eLocked: e2e.locked() }); retryDec(); });
}
export async function unlockE2E(pw: string) { set({ e2eBusy: true }); const ok = await e2e.unlock(pw).catch(() => false); set({ e2eBusy: false, e2eLocked: e2e.locked() }); if (ok && state.cur) { await e2e.enter(state.cur); retryDec(); } return ok; }

export async function logout() {
  const t = await getItem(TOKEN);
  try { (await import('./push')).stopPush(); } catch {}
  fire('logout', t);
  await setItem(TOKEN, null);
  await e2e.wipe(); // çıkışta bu cihazdaki şifreleme anahtarı silinir (sonraki girişte şifreyle yedekten geri gelir)
  set({ phase: 'out', me: null, meUser: null, msgs: {}, dec: {}, cur: null, servers: [], dms: [] });
}

export function clearNotice() { set({ notice: null }); }

// ---- Sohbet ----
export async function join(chId: string): Promise<{ error?: string }> {
  set({ cur: chId });
  // Henüz bağlı/girişli değilsek (soğuk açılış, bildirime dokunma, kopma): giriş bitince applyLogin odaya kendisi girer
  if (!socket?.connected || state.phase !== 'in') return {};
  const r = await ask<{ error?: string; messages?: Msg[] }>('join', chId);
  if (r?.error) return r;
  set(st => ({ msgs: { ...st.msgs, [chId]: r.messages || [] }, more: { ...st.more, [chId]: (r.messages?.length || 0) >= 150 } }));
  if (isPriv(chId)) e2e.enter(chId).then(() => decrypt(chId, state.msgs[chId] || [])); 
  return {};
}
export function leave(chId: string) { if (state.cur === chId) set({ cur: null }); }

export async function loadOlder(chId: string) {
  const list = state.msgs[chId]; if (!list?.length || state.cur !== chId || state.more[chId] === false) return;
  const r = await ask<{ messages?: Msg[]; more?: boolean; error?: string }>('history', { before: list[0].id });
  const older = r?.messages || [];
  set(st => ({ msgs: { ...st.msgs, [chId]: [...older.filter(m => !(st.msgs[chId] || []).some(x => x.id === m.id)), ...(st.msgs[chId] || [])] }, more: { ...st.more, [chId]: !!r?.more } }));
  if (older.some(m => m.enc)) decrypt(chId, older);
}

// ---- Dosya yükleme ----
export type Att = { uri: string; name: string; type: string; size?: number };
async function postFile(body: Uint8Array, name: string, type: string): Promise<{ id?: string; error?: string }> {
  const t = await getItem(TOKEN); if (!t) return { error: 'Giriş yapmalısın' };
  try {
    const r = await fetch(SERVER + '/api/dosya', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(name), 'X-File-Type': type }, body: body as any });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.ok ? { id: j.id } : { error: j.error || 'Dosya yüklenemedi' };
  } catch { return { error: 'Dosya yüklenemedi, bağlantını kontrol et' }; }
}
export async function uploadPlain(a: Att) { return postFile(await readBytes(a.uri), a.name, a.type); }
// Şifreli sohbet: dosya cihazda şifrelenir, sunucuya sadece şifreli hâli gider (webdekiyle aynı biçim)
async function uploadEnc(a: Att) {
  const plain = await readBytes(a.uri), k = rnd(32), iv = rnd(12);
  const ct = gcm(k, iv).encrypt(plain);
  const r = await postFile(ct, 'sifreli.bin', 'application/octet-stream');
  return r.id ? { meta: { n: a.name.slice(0, 120), m: a.type.slice(0, 80), s: plain.length, k: b64(k), iv: b64(iv), i: r.id } } : { error: r.error };
}

export type Voice = { uri: string; type: string; dur: number };
// Şifresiz sohbette ses mesajı sitedeki gibi 'upload' ile gider (sunucu türünü doğrular, en çok 5 MB)
async function uploadVoice(v: Voice): Promise<{ url?: string; error?: string }> {
  const b = await readBytes(v.uri);
  if (b.length > 5 * 1024 * 1024) return { error: 'Kayıt çok uzun (en fazla 5 MB)' };
  const r = await ask<{ url?: string; error?: string }>('upload', { data: `data:${v.type};base64,${b64(b)}` });
  return r?.url ? { url: r.url } : { error: r?.error || 'Ses yüklenemedi' };
}

// Sunucu simgesi / afiş gibi herkese açık resimler (sitedeki gibi 'upload' ile, en çok 5 MB)
export async function uploadImage(uri: string, type: string): Promise<{ url?: string; error?: string }> {
  const b = await readBytes(uri);
  if (b.length > 5 * 1024 * 1024) return { error: 'Resim en fazla 5 MB olabilir' };
  const t = /^image\/(png|jpeg|gif|webp)$/.test(type) ? type : 'image/jpeg';
  const r = await ask<{ url?: string; error?: string }>('upload', { data: `data:${t};base64,${b64(b)}` });
  return r?.url ? { url: r.url } : { error: r?.error || 'Resim yüklenemedi' };
}

export async function send(text: string, replyTo?: string | null, atts: Att[] = [], voice?: Voice): Promise<{ error?: string }> {
  const ch = state.cur;
  const sendEnc = async () => {
    if (!ch || !state.me) return { error: 'Sohbet açık değil' };
    if (e2e.locked()) return { error: 'Şifreli mesajların kilitli. Önce kilidi aç.' };
    const f = [];
    for (const a of atts) { const u = await uploadEnc(a); if (u.error || !u.meta) return { error: u.error || 'Dosya yüklenemedi' }; f.push(u.meta); }
    let au: unknown = null;
    if (voice) { const u = await uploadEnc({ uri: voice.uri, name: 'ses', type: voice.type }); if (u.error || !u.meta) return { error: u.error || 'Ses yüklenemedi' }; au = u.meta; }
    const inner: Inner = { a: state.me, t: text, ...(f.length ? { f } : {}), ...(au ? { au, du: Math.round(voice!.dur) } : {}) };
    const s = await e2e.seal(ch, inner);
    if (!s) return { error: 'Şifreli mesaj hazırlanamadı. Karşı tarafın anahtarı bekleniyor olabilir, biraz sonra tekrar dene.' };
    const r = await ask<{ error?: string; ok?: boolean; msg?: Msg }>('message', { kind: 'text', enc: s.enc, fc: s.fc, ...(replyTo ? { replyTo } : {}) });
    if (r?.msg) set(st => ({ dec: { ...st.dec, [r.msg!.id]: { inner } } }));
    return r;
  };
  const sendPlain = async () => {
    if (voice) {
      const u = await uploadVoice(voice); if (!u.url) return { error: u.error };
      return ask<{ error?: string; ok?: boolean; msg?: Msg; e2e?: boolean }>('message', { kind: 'text', text: '', audio: u.url, duration: Math.round(voice.dur), ...(replyTo ? { replyTo } : {}) });
    }
    const files: string[] = [];
    for (const a of atts) { const u = await uploadPlain(a); if (u.error || !u.id) return { error: u.error || 'Dosya yüklenemedi' }; files.push(u.id); }
    return ask<{ error?: string; ok?: boolean; msg?: Msg; e2e?: boolean }>('message', { text, ...(files.length ? { files } : {}), ...(replyTo ? { replyTo } : {}) });
  };
  let r: { error?: string; ok?: boolean; msg?: Msg; e2e?: boolean };
  if (ch && isPriv(ch) && e2e.live(ch)) r = await sendEnc();
  else { r = await sendPlain(); if (r?.e2e && ch) { await e2e.enter(ch); r = await sendEnc(); } } // sunucu "bu sohbet şifreli" derse şifreleyip tekrar
  if (r?.msg && state.cur) {
    const ch = state.cur, msg = r.msg;
    set(st => ({ msgs: { ...st.msgs, [ch]: (st.msgs[ch] || []).some(m => m.id === msg.id) ? st.msgs[ch] : [...(st.msgs[ch] || []), msg] } }));
  }
  return r?.error ? { error: r.error } : {};
}
export const react = (msgId: string, emoji: string) => fire('react', { msgId, emoji });
export const openUser = (name: string | null) => set({ userSheet: name });
export async function blockUser(name: string, on: boolean) {
  const r = await ask<{ error?: string }>('block', { name, on });
  if (!r?.error) set(st => ({ blocked: on ? [...new Set([...st.blocked, name])] : st.blocked.filter(x => x !== name), friends: on ? st.friends.filter(x => x !== name) : st.friends }));
  return r?.error || null;
}
export const delMsg = (msgId: string) => fire('delete', msgId);
export const pinMsg = (msgId: string) => fire('pin', msgId);
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
