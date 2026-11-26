// Uçtan uca şifreli DM'ler: webdeki (public/index.html, const E2E) şemanın birebir aynısı.
// - Hesap başına bir P-256 anahtarı. Gizli anahtar sadece cihazda (SecureStore); sunucuda sadece açık anahtar ve
//   hesap şifresiyle kilitli yedek (PBKDF2-SHA256 310000 tur + AES-GCM, pkcs8) durur.
// - Sohbet başına "dönem" anahtarı (32 bayt). Her üyeye ECDH(P-256) + HKDF-SHA256 (salt = sohbet kimliği,
//   info = "kanka-wrap-v1|<dönem>") ile türetilen AES-GCM anahtarıyla sarılır.
// - Mesaj: { p: JSON(inner), fk } AES-GCM (aad = sohbet kimliği); mühür fc = HMAC-SHA256(fk, p).
// Bu dosyadaki biçimler webdekiyle aynı kalmalı; değiştirmek iki tarafın birbirini okuyamaması demektir.
import { p256 } from '@noble/curves/nist.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';
import * as ExpoCrypto from 'expo-crypto';
import { getItem, setItem } from './storage';

export type Wrap = { by: string; iv: string; ct: string };
export type Epoch = { id: string; mem: string[]; wraps: Record<string, Wrap> };
export type Conv = { cid?: string; eligible?: boolean; members: { n: string; kid?: string | null; was?: string[] }[]; keys: Record<string, { pub: string }>; eps: Epoch[]; error?: string; _t?: number };
export type Inner = { a: string; t?: string; g?: unknown; f?: unknown[]; au?: unknown; du?: number };
type Ask = <T = any>(ev: string, ...args: unknown[]) => Promise<T>;

// UTF-8 (bazı Hermes sürümlerinde TextDecoder yok: yedek uygulama)
const te = typeof TextEncoder !== 'undefined' ? new TextEncoder() : { encode: (s: string) => { const b: number[] = []; for (const ch of s) { let c = ch.codePointAt(0)!; if (c < 0x80) b.push(c); else if (c < 0x800) b.push(0xc0 | (c >> 6), 0x80 | (c & 63)); else if (c < 0x10000) b.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); else b.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); } return new Uint8Array(b); } };
const td = typeof TextDecoder !== 'undefined' ? new TextDecoder() : { decode: (a: Uint8Array) => { let s = ''; for (let i = 0; i < a.length;) { const c = a[i++]; if (c < 0x80) s += String.fromCharCode(c); else if (c < 0xe0) s += String.fromCharCode(((c & 31) << 6) | (a[i++] & 63)); else if (c < 0xf0) s += String.fromCharCode(((c & 15) << 12) | ((a[i++] & 63) << 6) | (a[i++] & 63)); else s += String.fromCodePoint(((c & 7) << 18) | ((a[i++] & 63) << 12) | ((a[i++] & 63) << 6) | (a[i++] & 63)); } return s; } };
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function b64(a: Uint8Array): string {
  let s = '', i = 0;
  for (; i + 2 < a.length; i += 3) { const n = (a[i] << 16) | (a[i + 1] << 8) | a[i + 2]; s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]; }
  if (i < a.length) { const n = (a[i] << 16) | ((a[i + 1] ?? 0) << 8); s += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < a.length ? B64[(n >> 6) & 63] : '=') + '='; }
  return s;
}
export function unb64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, ''), out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0, buf = 0, bits = 0;
  for (const ch of clean) { buf = (buf << 6) | B64.indexOf(ch); bits += 6; if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; } }
  return out.subarray(0, o);
}
export const rnd = (n: number) => ExpoCrypto.getRandomBytes(n);

// --- anahtar biçimleri (WebCrypto ile uyumlu) ---
// pkcs8 (Chrome'un ürettiği biçim: gizli skaler + açık anahtar)
const PK8_HEAD = new Uint8Array([0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20]);
export function pkcs8From(priv: Uint8Array): Uint8Array {
  const pub = p256.getPublicKey(priv, false);
  const out = new Uint8Array(PK8_HEAD.length + 32 + 5 + 65);
  out.set(PK8_HEAD, 0); out.set(priv, PK8_HEAD.length);
  out.set([0xa1, 0x44, 0x03, 0x42, 0x00], PK8_HEAD.length + 32); out.set(pub, PK8_HEAD.length + 37);
  return out;
}
export function privFromPkcs8(der: Uint8Array): Uint8Array | null {
  // ECPrivateKey içindeki "02 01 01 04 20" ardından gelen 32 bayt gizli skalerdir (Firefox/Safari biçimlerinde de aynı)
  for (let i = 0; i + 37 <= der.length; i++) if (der[i] === 0x02 && der[i + 1] === 0x01 && der[i + 2] === 0x01 && der[i + 3] === 0x04 && der[i + 4] === 0x20) return der.slice(i + 5, i + 37);
  return null;
}
const ecdh = (priv: Uint8Array, pubRaw: Uint8Array) => p256.getSharedSecret(priv, pubRaw, true).slice(1); // WebCrypto deriveBits(256) = ortak noktanın x'i

// --- hesap şifresiyle kilitli yedek ---
async function pwKey(pw: string, salt: Uint8Array, it: number) { return pbkdf2Async(sha256, te.encode(pw), salt, { c: it, dkLen: 32, asyncTick: 25 }); }
export async function sealPriv(priv: Uint8Array, pw: string) {
  const s = rnd(16), iv = rnd(12), it = 310000;
  const ct = gcm(await pwKey(pw, s, it), iv).encrypt(pkcs8From(priv));
  return { s: b64(s), iv: b64(iv), ct: b64(ct), it };
}
export async function openPriv(w: { s: string; iv: string; ct: string; it?: number }, pw: string): Promise<Uint8Array | null> {
  try { const der = gcm(await pwKey(pw, unb64(w.s), w.it || 310000), unb64(w.iv)).decrypt(unb64(w.ct)); return privFromPkcs8(der); } catch { return null; }
}

// --- sarma anahtarı ve mesaj şifreleme ---
export function kek(myPriv: Uint8Array, otherPub: string, cid: string, epId: string) {
  return hkdf(sha256, ecdh(myPriv, unb64(otherPub)), te.encode(cid), te.encode('kanka-wrap-v1|' + epId), 32);
}
export function wrapKey(raw: Uint8Array, myPriv: Uint8Array, myKid: string, targetPub: string, cid: string, epId: string): Wrap {
  const iv = rnd(12);
  return { by: myKid, iv: b64(iv), ct: b64(gcm(kek(myPriv, targetPub, cid, epId), iv).encrypt(raw)) };
}
export function unwrapKey(w: Wrap, myPriv: Uint8Array, byPub: string, cid: string, epId: string): Uint8Array | null {
  try { return gcm(kek(myPriv, byPub, cid, epId), unb64(w.iv)).decrypt(unb64(w.ct)); } catch { return null; }
}
export function sealMsg(ck: Uint8Array, cid: string, ep: string, inner: Inner) {
  const pj = JSON.stringify(inner), fk = rnd(32), iv = rnd(12);
  const ct = gcm(ck, iv, te.encode(cid)).encrypt(te.encode(JSON.stringify({ p: pj, fk: b64(fk) })));
  return { enc: { ep, iv: b64(iv), ct: b64(ct) }, fc: b64(hmac(sha256, fk, te.encode(pj))) };
}
export function openMsg(ck: Uint8Array, cid: string, enc: { iv: string; ct: string }, fc: string): { pj: string; fk: string; inner: Inner } | null {
  try {
    const o = JSON.parse(td.decode(gcm(ck, unb64(enc.iv), te.encode(cid)).decrypt(unb64(enc.ct))));
    if (typeof o.fk !== 'string' || b64(hmac(sha256, unb64(o.fk), te.encode(o.p))) !== fc) return null;
    return { pj: o.p, fk: o.fk, inner: JSON.parse(o.p) };
  } catch { return null; }
}

// ================= Durum: anahtarlar, sohbetler, dönemler =================
type Local = { kid: string | null; priv: string | null; pub: string | null; old: Record<string, string> };
const sameSet = (a: string[], b: string[]) => a.every(x => b.includes(x)) && b.every(x => a.includes(x));

export function createE2E(ask: Ask) {
  let me: string | null = null, priv: Uint8Array | null = null, kid: string | null = null, pubB: string | null = null;
  let old: Record<string, Uint8Array> = {}, ready = false, locked = false, on = true, bootP: Promise<void> = Promise.resolve();
  const convs: Record<string, Conv> = {}, convP: Record<string, Promise<Conv | null>> = {}, cks: Record<string, Uint8Array> = {}, miss: Record<string, number> = {};
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach(f => f());

  const storeKey = (n: string) => 'e2e-' + n.replace(/[^A-Za-z0-9_.-]/g, '_');
  async function persist() {
    if (!me) return;
    const o: Local = { kid, priv: priv ? b64(priv) : null, pub: pubB, old: Object.fromEntries(Object.entries(old).map(([k, v]) => [k, b64(v)])) };
    await setItem(storeKey(me), JSON.stringify(o));
  }
  async function loadLocal(n: string): Promise<Local | null> { try { const s = await getItem(storeKey(n)); return s ? JSON.parse(s) : null; } catch { return null; } }
  async function adopt(k: Uint8Array, p: string, id: string) { priv = k; pubB = p; kid = id; locked = false; ready = true; await persist(); changed(); reshare(); }
  async function fresh(pw: string | null) {
    const k = p256.utils.randomSecretKey(rnd(48)), p = b64(p256.getPublicKey(k, false));
    const r = await ask<{ ok?: boolean; kid?: string; error?: string }>('e2eSetup', { pub: p, wrapped: pw ? await sealPriv(k, pw) : null });
    if (!r.ok || !r.kid) throw new Error(r.error || 'anahtar kurulamadı');
    if (kid && priv && kid !== r.kid) old[kid] = priv;
    await adopt(k, p, r.kid);
  }

  async function boot_(name: string, pw: string | null) {
    if (me !== name) { me = name; priv = null; kid = pubB = null; old = {}; ready = locked = false; for (const o of [convs, cks, miss]) for (const k in o) delete (o as any)[k]; }
    if (ready && !pw) return;
    const mine = await ask<{ key?: { kid: string; pub: string; wrapped?: any } | null; on?: boolean; error?: string }>('e2eMine', {});
    if (mine.error) return; on = mine.on !== false; if (!on) return;
    if (!priv) {
      const loc = await loadLocal(name);
      if (loc) { old = Object.fromEntries(Object.entries(loc.old || {}).map(([k, v]) => [k, unb64(v)])); if (loc.priv && loc.kid) { priv = unb64(loc.priv); kid = loc.kid; pubB = loc.pub; } }
    }
    const srv = mine.key;
    if (srv && priv && kid === srv.kid) { ready = true; locked = false; changed(); if (pw && !srv.wrapped) ask('e2eSetup', { pub: pubB, wrapped: await sealPriv(priv, pw) }); reshare(); return; }
    if (srv && pw && srv.wrapped) { const k = await openPriv(srv.wrapped, pw); if (k) { if (kid && priv && kid !== srv.kid) old[kid] = priv; return adopt(k, srv.pub, srv.kid); } }
    if (srv && !pw) { if (kid && priv) { old[kid] = priv; priv = null; kid = null; await persist(); } locked = true; ready = false; changed(); return; }
    await fresh(pw); // hiç anahtar yok ya da yedek bu şifreyle açılmıyor (şifre sıfırlanmış): yenisi
  }
  // Giriş sırasında şifre elimizdeyken çağrılır: yedek bu cihazda açılır. Oturumla açılışta şifresiz çağrılır.
  function boot(name: string, pw: string | null = null) { bootP = bootP.then(() => boot_(name, pw)).catch(e => console.warn('e2e', e)); return bootP; }
  async function unlock(pw: string): Promise<boolean> {
    const mine = await ask<{ key?: { kid: string; pub: string; wrapped?: any } }>('e2eMine', {}), srv = mine.key;
    if (srv?.wrapped) { const k = await openPriv(srv.wrapped, pw); if (!k) return false; await adopt(k, srv.pub, srv.kid); return true; }
    await fresh(pw); return true;
  }
  async function wipe() { if (me) await setItem(storeKey(me), null); me = null; priv = null; kid = pubB = null; old = {}; ready = locked = false; }

  function conv(chId: string, force = false): Promise<Conv | null> {
    if (!force && convs[chId]) return Promise.resolve(convs[chId]);
    return convP[chId] ||= ask<Conv>('e2eConv', chId).then(v => { delete convP[chId]; if (!v || v.error) return null; v._t = Date.now(); return (convs[chId] = v); });
  }
  const cid = (ch: string) => convs[ch]?.cid || ch;
  const privFor = (k: string) => (k === kid && priv) || old[k] || null;

  async function ckGet(chId: string, epId: string): Promise<Uint8Array | null> {
    const key = chId + '|' + epId; if (cks[key]) return cks[key];
    for (let pass = 0; pass < 2; pass++) {
      if (pass && Date.now() - (miss[key] || 0) < 8000) break;
      if (pass) miss[key] = Date.now();
      const v = await conv(chId, pass === 1), ep = v?.eps.find(e => e.id === epId); if (!v || !ep) continue;
      for (const [k, w] of Object.entries(ep.wraps)) {
        const mp = privFor(k), bp = v.keys[w.by]?.pub; if (!mp || !bp) continue;
        const raw = unwrapKey(w, mp, bp, cid(chId), epId); if (raw) return (cks[key] = raw);
      }
    }
    return null;
  }
  async function fill(chId: string, ep: Epoch, raw: Uint8Array, v: Conv) { // anahtarı yenilenmiş üyeye bu dönemi yeniden paylaş
    if (!priv || !kid) return;
    const items = [];
    for (const m of v.members) if (m.kid && !ep.wraps[m.kid] && v.keys[m.kid]) items.push({ chId, ep: ep.id, kid: m.kid, ...wrapKey(raw, priv, kid, v.keys[m.kid].pub, cid(chId), ep.id) });
    if (items.length) { const r = await ask<{ n?: number }>('e2eShare', { items }); if (r.n) await conv(chId, true); }
  }
  async function epoch(chId: string): Promise<string | null> {
    if (!ready || !priv || !kid) return null;
    let v = await conv(chId, Date.now() - (convs[chId]?._t || 0) > 30000);
    if (!v?.eligible || !v.members.length || v.members.some(m => !m.kid)) return null;
    for (let tries = 0; tries < 2; tries++) {
      const last = v.eps[v.eps.length - 1], names = v.members.map(m => m.n);
      if (last && sameSet(names, last.mem) && last.wraps[kid]) { const c = await ckGet(chId, last.id); if (c) { fill(chId, last, c, v).catch(() => {}); return last.id; } }
      const raw = rnd(32), id = Array.from(rnd(12), x => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join(''), wraps: Record<string, Wrap> = {};
      for (const m of v.members) wraps[m.kid!] = wrapKey(raw, priv, kid, v.keys[m.kid!].pub, cid(chId), id);
      const r = await ask<{ ok?: boolean; conv?: Conv }>('e2eEpoch', { chId, ep: { id, wraps } });
      if (r.ok && r.conv) { r.conv._t = Date.now(); convs[chId] = r.conv; cks[chId + '|' + id] = raw; return id; }
      if (!r.conv) return null; v = convs[chId] = Object.assign(r.conv, { _t: Date.now() });
    }
    return null;
  }
  const live = (chId: string) => ready && /^(dm|g):/.test(chId) && !!convs[chId]?.eligible && convs[chId].members.every(m => m.kid);

  async function seal(chId: string, inner: Inner) {
    const ep = await epoch(chId); if (!ep) return null;
    const c = await ckGet(chId, ep); if (!c) return null;
    return sealMsg(c, cid(chId), ep, inner);
  }
  // Mesajı aç; mühür ve yazar tutmalı (biri başkası adına yazamasın)
  async function open(chId: string, m: { author: string; enc: { ep: string; iv: string; ct: string }; fc?: string }) {
    const c = await ckGet(chId, m.enc.ep); if (!c) return null;
    const d = openMsg(c, cid(chId), m.enc, m.fc || '');
    if (!d) return { bad: true as const };
    const ok = d.inner.a === m.author || !!convs[chId]?.members.find(x => x.n === m.author)?.was?.includes(d.inner.a);
    return ok ? { inner: d.inner } : { bad: true as const };
  }
  // Sohbete girerken: ilk kez yazışılıyorsa dönem anahtarını aç
  async function enter(chId: string) {
    if (!on || !/^(dm|g):/.test(chId)) return;
    await bootP; const v = await conv(chId, true); if (!v) return;
    if (ready && v.eligible && v.members.every(m => m.kid)) {
      const last = v.eps[v.eps.length - 1], names = v.members.map(m => m.n);
      if (!last || !sameSet(names, last.mem)) await epoch(chId).catch(() => null);
    }
    for (const k in miss) if (k.startsWith(chId + '|')) delete miss[k];
    changed();
  }
  // Anahtarı yenilenen arkadaşların eksik kalan dönem anahtarlarını paylaş (web de aynısını yapar)
  let reBusy = false;
  async function reshare() {
    if (!ready || reBusy || !priv || !kid) return; reBusy = true;
    try {
      const { items = [] } = await ask<{ items?: { chId: string; ep: string; kid: string }[] }>('e2eTodo', {}); if (!items.length) return;
      const out = [];
      for (const it of items) { if (!convs[it.chId]) await conv(it.chId); const c = await ckGet(it.chId, it.ep), p = convs[it.chId]?.keys[it.kid]?.pub; if (c && p) out.push({ chId: it.chId, ep: it.ep, kid: it.kid, ...wrapKey(c, priv, kid, p, cid(it.chId), it.ep) }); }
      for (let i = 0; i < out.length; i += 200) await ask('e2eShare', { items: out.slice(i, i + 200) });
    } catch (e) { console.warn('e2e paylaşım', e); } finally { reBusy = false; }
  }
  function convChanged(chId: string) { delete convs[chId]; for (const k in miss) if (k.startsWith(chId + '|')) delete miss[k]; changed(); }

  return {
    boot, unlock, wipe, conv, seal, open, enter, live, reshare, convChanged,
    ready: () => ready, locked: () => locked, on: () => on, whenBooted: () => bootP,
    subscribe: (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; },
    fingerprint: (chId: string) => convs[chId]?.members.map(m => ({ n: m.n, kid: m.kid || '' })) || [],
  };
}
