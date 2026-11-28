// Kanka sunucusuyla tüm konuşma burada: bağlantı, oturum, gelen olaylar ve uygulamanın ortak durumu.
// Ekranlar durumu useKanka() ile okur; değişiklikler set() ile yayılır.
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { SERVER, PROTOCOL, APP_VERSION } from './config';
import { getItem, setItem, deviceId } from './storage';
import type { SiteWarn, AppCmd, AppForm, Dm, LoginResult, Msg, Prefs, Server, User } from './types';
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
  u15: LoginResult['u15'];
  needVeli: boolean;
  warns: SiteWarn[];
  welcomeFor: string | null;
  friends: string[];
  reqIn: string[]; // bana gelen arkadaşlık istekleri
  reqOut: string[]; // benim gönderdiklerim
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
  vStage: { speakers: string[]; hands: string[] } | null; // sahne odasında konuşmacılar ve söz isteyenler
  minor: boolean;
  magaza: { play: boolean; apple: boolean }; // Spark hangi mağazada satışta (vergi/ürün hazır olunca sunucu açar)
  e2eLocked: boolean;
  e2eBusy: boolean;
  notice: string | null;
  prefs: Prefs | null; // hesap tercihleri (sunucu sırası, oda bildirimleri…)
  appForm: AppForm | null; // botun açtığı form
  selServer: { id: string; n: number } | null;
  myEmail: string | null; // ana ekranda açılacak sunucu (katılınca / kurunca)
};

let state: State = {
  phase: 'boot', connected: false, me: null, meUser: null, users: {}, presence: {}, servers: [], dms: [], voice: {},
  lastMsg: {}, msgs: {}, more: {}, typing: {}, cur: null, ageGate: null, u15: null, needVeli: false, warns: [], welcomeFor: null, friends: [], reqIn: [], reqOut: [], blocked: [], userSheet: null, dec: {}, ice: [], vflags: {}, myVoice: null, vPeers: [], vConnecting: false, muted: false, deaf: false, speaker: true, speaking: {}, ringing: null, outgoing: null, myCam: false, myScreen: false, camFront: true, vMedia: {}, vWatch: null, vVer: 0, vToast: null, vStage: null, minor: false, magaza: { play: false, apple: false }, e2eLocked: false, e2eBusy: false, notice: null, prefs: null, appForm: null, selServer: null, myEmail: null,
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
// Ekran dışı dinleyiciler (ana ekran widget'ı gibi)
export function subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; }
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
    voice: r.voice || {}, ice: (r as any).ice || [], lastMsg: r.lastMsg || {}, ageGate: r.ageGate ?? null, u15: r.u15 ?? null, needVeli: !!r.needVeli, warns: r.warns || [], minor: !!r.minor, magaza: (r as any).magaza || { play: false, apple: false }, friends: r.social?.friends || [], reqIn: r.social?.reqIn || [], reqOut: r.social?.reqOut || [], blocked: r.social?.blocked || [], prefs: r.prefs || state.prefs, myEmail: (r as any).myEmail ?? state.myEmail,
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
  s.on('social', (x: { friends?: string[]; reqIn?: string[]; reqOut?: string[]; blocked?: string[] }) => set({ friends: x?.friends || [], reqIn: x?.reqIn || [], reqOut: x?.reqOut || [], ...(x?.blocked ? { blocked: x.blocked } : {}) }));
  s.on('voiceState', (voice: Record<string, string[]>) => set({ voice }));
  s.on('voiceFlags', (vflags: State['vflags']) => set({ vflags: vflags || {} }));
  s.on('ice', (ice: any[]) => set({ ice: ice || [] }));
  s.on('prefs', (p: Prefs) => p && set({ prefs: p }));
  s.on('appForm', (f: AppForm) => f?.iid && set({ appForm: f }));
  s.on('siteWarn', (w: SiteWarn) => w?.id && set(st => ({ warns: [...st.warns.filter(x => x.id !== w.id), w] })));
  s.on('ageGate', () => { reauth(); }); // yetkili yaş kilidini kaldırdı: güncel durumu al
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

// ---- Hesap kapıları: doğum tarihi, veli onayı, site uyarıları, sunucu kuralları ----
// Oturumu yeniden doğrula ve tüm durumu sunucudan tekrar al (doğum tarihi girildikten sonra kilit kalkar)
export async function reauth() {
  const t = await getItem(TOKEN); if (!t || !socket?.connected) return;
  socket.emit('auth', t, (r: LoginResult) => { if (r && !r.error) applyLogin(r); });
}
export async function setDob(iso: string): Promise<{ error?: string; locked?: boolean }> {
  const r = await ask<{ ok?: boolean; error?: string; locked?: boolean }>('setDob', iso);
  if (r?.ok) { set({ ageGate: null }); reauth(); return {}; }
  if (r?.locked) set({ ageGate: 'locked' });
  return { error: r?.error || 'Bağlantı yok', locked: r?.locked };
}
export async function veliOnay() { const r = await ask<{ ok?: boolean; error?: string }>('veliOnay', {}); if (r?.ok) set({ needVeli: false }); return r?.error || null; }
export function warnSeen(id: string) { fire('warnSeen', id); set(st => ({ warns: st.warns.filter(w => w.id !== id) })); }
export const openWelcome = (serverId: string | null) => set({ welcomeFor: serverId });
export async function acceptRules(serverId: string, answers: string[]): Promise<{ error?: string; pending?: boolean }> {
  const r = await ask<{ ok?: boolean; error?: string; pending?: boolean }>('acceptRules', { serverId, answers });
  if (r?.ok) set(st => ({ servers: st.servers.map(s => (s.id === serverId ? (r.pending ? { ...s, apply: 'bekliyor' } : { ...s, accepted: true }) : s)) }));
  return r?.ok ? { pending: r.pending } : { error: r?.error || 'Bağlantı yok' };
}

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

// Ses paneline ses: sunucu sadece WAV kabul ediyor (en çok 5 sn)
export async function sbAddWav(serverId: string, uri: string, name: string, emoji: string): Promise<string | null> {
  const b = await readBytes(uri);
  if (b.length > 520 * 1024) return 'Ses dosyası çok büyük (en fazla 520 KB, 5 saniye)';
  const r = await ask<{ error?: string }>('sbAdd', { serverId, data: `data:audio/wav;base64,${b64(b)}`, name, emoji });
  return r?.error || (r ? null : 'Bağlantı yok');
}

// Başka uygulamadan "Kanka'ya paylaş": seçilen sohbet açılınca yazma kutusuna düşer
type PendingShare = { chId: string; text: string; atts: Att[] };
let pendingShare: PendingShare | null = null;
export const setPendingShare = (p: PendingShare | null) => { pendingShare = p; };
export function takeShare(chId: string): { text: string; atts: Att[] } | null {
  if (!pendingShare || pendingShare.chId !== chId) return null;
  const p = pendingShare; pendingShare = null; return { text: p.text, atts: p.atts };
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
  const nr = (r as { needRules?: string })?.needRules; if (nr) openWelcome(nr);
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

// ---- Hesap tercihleri ----
// Sunucu 'prefs'i bütün olarak kaydeder (eksik alan silinir): önce güncelini al, değiştir, hepsini geri gönder
export async function savePrefs(change: (p: Prefs) => Prefs): Promise<string | null> {
  const cur = await ask<Prefs & { error?: string }>('prefs', null);
  if (cur && (cur as any).error) return (cur as any).error;
  const next = change({ ...(cur || state.prefs || {}) });
  set({ prefs: next }); // ekranda hemen görünsün
  const r = await ask<Prefs & { error?: string }>('prefs', next);
  if (r && !(r as any).error) set({ prefs: r });
  return (r as any)?.error || null;
}
// Sunucu listesi sırası (webdekiyle aynı: hesapta saklanır, listede olmayanlar sona)
export function orderServers(list: Server[], order?: string[]) {
  const o = order || [], pos = (id: string) => { const i = o.indexOf(id); return i < 0 ? 1e6 : i; };
  return list.map((s, i) => [s, i] as const).sort((a, b) => pos(a[0].id) - pos(b[0].id) || a[1] - b[1]).map(x => x[0]);
}
export const setServerOrder = (ids: string[]) => savePrefs(p => ({ ...p, order: ids }));

// ---- Geliştirici botları ----
export async function appComp(chId: string, msgId: string, cid: string, values?: string[]) {
  const r = await ask<{ error?: string }>('appComp', { chId, msgId, cid, values });
  return r?.error || null;
}
export async function appCmd(chId: string, c: AppCmd, opts: Record<string, unknown>) {
  const r = await ask<{ error?: string }>('appCmd', { chId, app: c.app, name: c.ad, opts });
  return r?.error || null;
}
export async function appFormSubmit(iid: string, values: Record<string, string>) {
  const r = await ask<{ error?: string }>('appFormSubmit', { iid, values });
  if (!r?.error) set({ appForm: null });
  return r?.error || null;
}
export const closeAppForm = () => set({ appForm: null });
export async function dmAppCmds(bot: string): Promise<AppCmd[]> {
  const r = await ask<{ komutlar?: AppCmd[] }>('appDmCmds', bot);
  return r?.komutlar || [];
}
// "Sadece sen görüyorsun" mesajını kapat (kalıcı olanı sunucudan da sil)
export function closeEph(chId: string, m: Msg) {
  if (m.kalici) fire('ozelKapat', m.id);
  set(st => { const list = st.msgs[chId]; return list ? { msgs: { ...st.msgs, [chId]: list.filter(x => x.id !== m.id) } } : {}; });
}
export const isBot = (u?: User | null) => !!u?.bot;
export const botVerified = (u?: User | null) => !!u?.bot && typeof u.bot === 'object' && !!u.bot.dogrulandi;

// ---- Arkadaşlık ----
type R = { ok?: boolean; error?: string; accepted?: boolean };
export async function friendRequest(name: string) { const r = await ask<R>('friendRequest', name.trim().replace(/^@/, '')); return r || {}; }
export async function friendAccept(name: string) { const r = await ask<R>('friendAccept', name); return r?.error || null; }
export async function friendRemove(name: string) { const r = await ask<R>('friendRemove', name); return r?.error || null; }
export type Suggest = { name: string; sunucular: { id: string; ad: string }[]; sunucuSayisi: number; ortakArkadas: number; sohbet?: boolean };
export async function friendSuggest(): Promise<Suggest[]> {
  const r = await ask<{ sohbet?: { name: string }[]; oneriler?: Suggest[] }>('friendSuggest', {});
  return [...(r?.sohbet || []).map(x => ({ name: x.name, sunucular: [], sunucuSayisi: 0, ortakArkadas: 0, sohbet: true })), ...(r?.oneriler || [])];
}
export const friendSuggestHide = (name: string) => ask('friendSuggestHide', name);
export type Mutuals = { servers: { id: string; name: string; icon?: string; iconImg?: string | null }[]; friends: string[] };
export async function mutuals(name: string): Promise<Mutuals> { const r = await ask<Mutuals>('mutuals', name); return { servers: r?.servers || [], friends: r?.friends || [] }; }
export function friendState(name: string): 'me' | 'friend' | 'in' | 'out' | 'none' {
  if (name === state.me) return 'me';
  if (state.friends.includes(name)) return 'friend';
  if (state.reqIn.includes(name)) return 'in';
  if (state.reqOut.includes(name)) return 'out';
  return 'none';
}

// ---- Sunucuya katılma / kurma / keşfet ----
export type InvitePeek = { id: string; name: string; icon?: string; iconImg?: string | null; banner?: string | null; bannerColor?: string | null; description?: string; invite: string; members: number; online: number; joined: boolean };
// Davet kodu: "abc123", "kankahq.com/davet/abc123", "https://kankahq.com/app?davet=abc123" ya da özel link "kankahq.com/isim"
export function inviteCode(text: string): string | null {
  const t = text.trim(); if (!t) return null;
  const m = /(?:davet|invite|d)[=/]([A-Za-z0-9_-]{3,40})/i.exec(t); if (m) return m[1];
  const v = /kankahq\.com\/([a-z0-9-]{2,40})\/?$/i.exec(t); if (v && !['app', 'davet', 'indir'].includes(v[1].toLowerCase())) return 's:' + v[1].toLowerCase();
  return /^[A-Za-z0-9_-]{3,40}$/.test(t) ? t : null;
}
export async function invitePeek(code: string): Promise<InvitePeek | null> { const r = await ask<Record<string, InvitePeek | null>>('invitePeek', [code]); return r?.[code] || null; }
export async function joinInvite(code: string): Promise<{ server?: Server; error?: string }> {
  const r = await ask<Server & { error?: string }>('joinInvite', code.startsWith('s:') ? code.slice(2) : code);
  if (!r || r.error) return { error: r?.error || 'Katılamadın' };
  set(st => ({ servers: st.servers.some(x => x.id === r.id) ? st.servers.map(x => (x.id === r.id ? r : x)) : [...st.servers, r] }));
  return { server: r };
}
export async function createServer(o: { name: string; template?: string; discord?: string }): Promise<{ server?: Server; error?: string }> {
  const r = await ask<Server & { error?: string }>('createServer', o);
  if (!r || r.error) return { error: r?.error || 'Sunucu kurulamadı' };
  set(st => ({ servers: st.servers.some(x => x.id === r.id) ? st.servers : [...st.servers, r] }));
  return { server: r };
}
export type DiscoverItem = InvitePeek & { category?: string; badges?: { id: string; ad?: string }[] };
export async function discover(q = '', cat = ''): Promise<{ list: DiscoverItem[]; cats: string[] }> { const r = await ask<{ list?: DiscoverItem[]; cats?: string[] }>('discover', { q, cat }); return { list: r?.list || [], cats: r?.cats || [] }; }

// ---- Grup DM ----
export async function createGroup(members: string[], name?: string): Promise<{ id?: string; error?: string }> { const r = await ask<{ id?: string; error?: string }>('createGroup', { members, name }); return r || { error: 'Grup açılamadı' }; }
export async function groupUpdate(id: string, p: { name?: string; add?: string[]; leave?: boolean }) { const r = await ask<R>('groupUpdate', { id, ...p }); return r?.error || null; }
export async function openDM(other: string): Promise<{ id?: string; error?: string }> { const r = await ask<{ id?: string; error?: string }>('openDM', other); return r || { error: 'Açılamadı' }; }

// ---- Profil ve hesap ----
export async function updateProfile(p: Partial<{ avatar: string | null; bio: string; displayName: string; pronouns: string; bannerImg: string | null; color: string; theme: string[] }>) { const r = await ask<R>('updateProfile', p); return r?.error || null; }
export async function setCustomStatus(text: string, until?: number | null) { const r = await ask<R>('setCustomStatus', { text, until }); return r?.error || null; }
export async function changePassword(old: string, next: string) {
  const r = await ask<R & { token?: string }>('changePassword', { old, next });
  if (r?.token) await setItem(TOKEN, r.token); // diğer cihazlar kapanır, bu cihaz yeni oturumla devam eder
  return r?.error || null;
}
export async function changeName(name: string, password: string) { const r = await ask<R & { field?: string; name?: string; token?: string }>('changeName', { name, password }); if (r?.token) await setItem(TOKEN, r.token); return r || {}; }
export async function setEmail(email: string, password: string, code?: string) { const r = (await ask<R & { needTfa?: boolean; email?: string }>('setEmail', { email, password, code })) || {}; if (r.ok && r.email) set({ myEmail: r.email }); return r; }
export type Sess = { id: string; cihaz: string; k: string; ip: string; at: number; seen: number; aktif: boolean; bu: boolean; n: number };
export async function sessList(): Promise<Sess[]> { const r = await ask<{ list?: Sess[] }>('sessList'); return r?.list || []; }
export async function sessKill(p: { id?: string; all?: boolean }) { const r = await ask<R & { n?: number }>('sessKill', p); return r || {}; }
export async function tfaStatus() { return (await ask<{ on?: boolean; backupLeft?: number }>('tfaStatus')) || {}; }
export async function tfaSetup(password: string) { return (await ask<R & { secret?: string; uri?: string }>('tfaSetup', { password })) || {}; }
export async function tfaEnable(code: string) { return (await ask<R & { backup?: string[] }>('tfaEnable', { code })) || {}; }
export async function tfaDisable(password: string, code: string) { const r = await ask<R>('tfaDisable', { password, code }); return r?.error || null; }
export async function tfaNewBackup(code: string) { return (await ask<R & { backup?: string[] }>('tfaNewBackup', { code })) || {}; }
export const selectServer = (id: string) => set({ selServer: { id, n: Date.now() } });

// ---- Mesajlaşma (2. paket) ----
// Not: düzenleme / oylama / plan / xox sunucuda "şu an açık oda" (cur) üzerinden çalışır; bu ekranlar zaten o odadayken kullanılır
export const editMsg = (msgId: string, text: string) => fire('edit', { msgId, text });
export const vote = (msgId: string, index: number) => fire('vote', { msgId, index });
export const planToggle = (msgId: string) => fire('planToggle', msgId);
export const xoxMove = (msgId: string, i: number) => fire('xoxMove', { msgId, i });
export async function sendKind(p: Record<string, unknown>) { const r = await ask<{ error?: string }>('message', p); return r?.error || null; }
export async function forwardMsg(from: string, msgId: string, to: string) { const r = await ask<{ error?: string }>('forward', { from, msgId, to }); return r?.error || null; }
export async function threadReply(msgId: string, text: string) { const r = await ask<{ error?: string }>('threadReply', { msgId, text }); return r?.error || null; }
export type Scheduled = { id: string; chId: string; text: string; at: number };
export async function schedule(text: string, at: number) { const r = await ask<{ error?: string }>('schedule', { text, at }); return r?.error || null; }
export async function scheduledList(): Promise<Scheduled[]> { const r = await ask<Scheduled[]>('scheduledList'); return Array.isArray(r) ? r : []; }
export async function unschedule(id: string): Promise<Scheduled[]> { const r = await ask<Scheduled[]>('unschedule', id); return Array.isArray(r) ? r : []; }
export type Gif = { url: string; prev: string; w?: number; h?: number; title?: string };
export async function gifs(q: string, page = 1): Promise<{ items: Gif[]; error?: string }> { const r = await ask<{ items?: Gif[]; error?: string }>('gifs', { q, page }); return { items: r?.items || [], error: r?.error }; }
export async function noteGet(key: string) { return (await ask<{ text?: string; at?: number | null }>('noteGet', { key })) || {}; }
export async function noteSet(key: string, text: string) { const r = await ask<{ error?: string; at?: number }>('noteSet', { key, text }); return r || {}; }
// Mesaj bağlantısı (webdeki gibi): kankahq.com/kanal/<sunucu ya da @me>/<oda>/<mesaj>
export function msgLink(chId: string, msgId: string) {
  const f = chId.startsWith('dm:') || chId.startsWith('g:') ? null : findChannel(chId);
  return `${SERVER}/kanal/${encodeURIComponent(f ? f.server.id : '@me')}/${encodeURIComponent(chId)}/${encodeURIComponent(msgId)}`;
}
// Metindeki :isim: sunucu emojileri: önce o odanın sunucusu, sonra üye olunan diğer sunucular
export function emojiMap(chId?: string): Record<string, string> {
  const out: Record<string, string> = {};
  const own = chId ? findChannel(chId)?.server : null;
  for (const s of [...state.servers.filter(x => x !== own), ...(own ? [own] : [])]) for (const [k, v] of Object.entries((s as any).emojis || {})) out[k] = v as string;
  return out;
}

// ---- Topluluk (4. paket) ----
export async function ticketOpen(serverId: string, reason: string) { return (await ask<{ error?: string; channelId?: string }>('ticketOpen', { serverId, reason })) || {}; }
export async function ticketClaim(channelId: string) { const r = await ask<{ error?: string }>('ticketClaim', { channelId }); return r?.error || null; }
export async function ticketClose(channelId: string) { const r = await ask<{ error?: string }>('ticketClose', { channelId }); return r?.error || null; }
export type TopRow = { name: string; xp: number; level: number; streak: number; rank?: number };
export async function hqTops() { return (await ask<{ lvl: TopRow[]; stk: TopRow[]; me: TopRow & { lvlRank: number; stkRank: number } } | null>('hqTops')) || null; }
export async function leaderboard(serverId: string): Promise<TopRow[]> { const r = await ask<TopRow[]>('leaderboard', serverId); return Array.isArray(r) ? r : []; }
export async function myBadges() { return (await ask<{ all?: string[]; hidden?: string[]; meta?: Record<string, [string, string, string]> }>('myBadges', {})) || {}; }
export async function hideBadges(hidden: string[]) { const r = await ask<{ error?: string }>('hideBadges', { hidden }); return r?.error || null; }
