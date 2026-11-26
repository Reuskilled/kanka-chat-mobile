// Sesli odalar ve aramalar. Webdekiyle aynı yapı: odadaki herkes birbirine doğrudan bağlanır (WebRTC, P2P),
// sunucu sadece bağlantı bilgilerini iletir ('signal'). Arama = "call:<sohbet>" adlı sesli oda + 'ring' bildirimi.
// Bağlantı kurma "kibar/kaba" kuralıyla (perfect negotiation): iki taraf aynı anda teklif yaparsa kimliği küçük olan geri çekilir.
import { AppState, Vibration } from 'react-native';
import { ask, fire, getState, type State, onSocket, setVoice, socketId, findChannel, displayName, dmPeers, afterAuth } from './kanka';
import { RTCPeerConnection, mediaDevices, MediaStream, audioStart, audioStop, setSpeaker, bgStart, bgStop, webPlay, webStop } from './rtc';

type PC = any; // RTCPeerConnection (react-native-webrtc ya da tarayıcı)
const peers: Record<string, PC> = {};
(globalThis as any).__kankaSes = peers; // geliştirme testleri için (web önizlemesi)
const peerNames: Record<string, string> = {};
let localStream: any = null;
let speakT: ReturnType<typeof setInterval> | null = null;
let joining = false;
// Görüntü: kamera herkese gider; ekran yayını sadece izlemek isteyenlere (webdeki gibi, gereksiz yükleme olmasın)
let videoStream: any = null;
let videoKind: 'cam' | 'screen' | null = null;
const watchers = new Set<string>();
const remoteVideo: Record<string, any> = {};
export const getRemoteVideo = (sid: string) => remoteVideo[sid] || null;
export const getLocalVideo = () => videoStream;
export const sidOf = (name: string) => Object.keys(peers).find(s => peerNames[s] === name) || null;
const bump = () => setVoice({ vVer: st().vVer + 1 });

const st = getState;
const iceCfg = () => ({ iceServers: st().ice?.length ? st().ice : [{ urls: ['stun:stun.l.google.com:19302'] }] });

function makePeer(sid: string): PC {
  const pc: PC = new (RTCPeerConnection as any)(iceCfg());
  Object.assign(pc, { _sid: sid, _polite: (socketId() || '') < sid, _making: false, _ignore: false });
  peers[sid] = pc;
  setTimeout(syncPeers);
  localStream?.getTracks().forEach((t: any) => pc.addTrack(t, localStream));
  if (videoStream) setTimeout(() => feedPeer(sid));
  pc.onicecandidate = (e: any) => { if (e.candidate) fire('signal', { to: sid, data: { ice: e.candidate } }); };
  pc.onnegotiationneeded = async () => {
    try { pc._making = true; await pc.setLocalDescription(); fire('signal', { to: sid, data: { sdp: pc.localDescription } }); }
    catch (e) { console.warn('ses teklifi', e); } finally { pc._making = false; }
  };
  pc.ontrack = (e: any) => {
    if (e.track?.kind === 'video') {
      const s0 = e.streams?.[0];
      remoteVideo[sid] = s0 && s0.getVideoTracks?.().length ? s0 : new (MediaStream as any)([e.track]);
      e.track.onunmute = bump; e.track.onended = bump; e.track.onmute = bump;
      bump(); return;
    }
    if (st().deaf) e.track.enabled = false;
    webPlay(sid + ':' + (e.streams?.[0]?.id || e.track.id), e.streams?.[0] || new (MediaStream as any)([e.track]));
  };
  pc.onconnectionstatechange = () => {
    clearTimeout(pc._rt);
    if (pc.connectionState === 'failed') pc.restartIce?.();
    else if (pc.connectionState === 'disconnected') pc._rt = setTimeout(() => pc.connectionState === 'disconnected' && pc.restartIce?.(), 3000);
  };
  return pc;
}
function closePeer(sid: string) {
  try { peers[sid]?.close(); } catch {}
  delete peers[sid]; delete peerNames[sid]; delete remoteVideo[sid]; watchers.delete(sid); webStop(sid);
  const m = { ...st().vMedia }; delete m[sid];
  setVoice({ vMedia: m, ...(st().vWatch === sid ? { vWatch: null } : {}) });
  syncPeers(); bump();
}

// ---- Kamera ve ekran paylaşımı ----
function tune(pc: PC, tries = 0) {
  const snd = pc._vsender; if (!snd?.track) return;
  try {
    const p = snd.getParameters();
    if (!p.encodings?.length) { if (tries < 10) setTimeout(() => tune(pc, tries + 1), 500); return; }
    p.encodings[0].maxBitrate = videoKind === 'screen' ? 2_500_000 : 1_200_000;
    p.encodings[0].maxFramerate = videoKind === 'screen' ? 24 : 30;
    snd.setParameters(p).catch(() => {});
  } catch {}
}
function feedPeer(sid: string) {
  const pc = peers[sid]; if (!pc) return;
  const share = !!videoStream && (videoKind === 'cam' || watchers.has(sid));
  const vt = share ? videoStream.getVideoTracks()[0] : null;
  if (pc._vsender) pc._vsender.replaceTrack(vt).catch(() => {});
  else if (vt) pc._vsender = pc.addTrack(vt, videoStream);
  if (vt) setTimeout(() => tune(pc), 300);
}
const feedAll = () => Object.keys(peers).forEach(feedPeer);
function sendMedia() {
  if (!st().myVoice) return;
  fire('media', { cam: videoKind === 'cam', screen: videoKind === 'screen', streamId: videoStream?.id || null, viewers: watchers.size, q: videoKind === 'screen' ? '720p30' : null, audio: false });
}
export function stopVideo(silent = false) {
  videoStream?.getTracks().forEach((t: any) => t.stop());
  videoStream = null; videoKind = null; watchers.clear();
  for (const pc of Object.values(peers)) pc._vsender?.replaceTrack(null).catch(() => {});
  if (!silent) sendMedia();
  setVoice({ myCam: false, myScreen: false }); bump();
}
export async function toggleCam(): Promise<{ error?: string }> {
  if (!st().myVoice) return {};
  if (videoKind === 'cam') { stopVideo(); return {}; }
  let s: any;
  try { s = await (mediaDevices as any).getUserMedia({ audio: false, video: { facingMode: 'user', width: 1280, height: 720, frameRate: 30 } }); }
  catch { return { error: 'Kameraya erişilemedi. Ayarlardan Kanka\'ya kamera izni ver.' }; }
  if (!st().myVoice) { s.getTracks().forEach((t: any) => t.stop()); return {}; }
  if (videoStream) stopVideo(true);
  videoStream = s; videoKind = 'cam';
  s.getVideoTracks()[0].onended = () => { if (videoStream === s) stopVideo(); };
  setVoice({ myCam: true, myScreen: false, camFront: true });
  feedAll(); sendMedia(); bump();
  return {};
}
export function flipCam() {
  const t = videoStream?.getVideoTracks()[0]; if (videoKind !== 'cam' || !t) return;
  const front = !st().camFront;
  try { if (typeof t._switchCamera === 'function') t._switchCamera(); else t.applyConstraints?.({ facingMode: front ? 'user' : 'environment' }); } catch {}
  setVoice({ camFront: front });
}
export async function toggleScreen(): Promise<{ error?: string }> {
  if (!st().myVoice) return {};
  if (videoKind === 'screen') { stopVideo(); return {}; }
  if (!(mediaDevices as any).getDisplayMedia) return { error: 'Bu cihaz ekran paylaşımını desteklemiyor.' };
  let s: any;
  try { s = await (mediaDevices as any).getDisplayMedia({ video: true, audio: false }); }
  catch { return { error: 'Ekran paylaşımı başlatılamadı.' }; }
  if (!st().myVoice) { s.getTracks().forEach((t: any) => t.stop()); return {}; }
  if (videoStream) stopVideo(true);
  videoStream = s; videoKind = 'screen'; watchers.clear();
  s.getVideoTracks()[0].onended = () => { if (videoStream === s) stopVideo(); };
  setVoice({ myScreen: true, myCam: false });
  feedAll(); sendMedia(); bump();
  return {};
}
// Başkasının ekran yayınını izle / bırak
export function watchStream(sid: string, on = true) {
  const cur = st().vWatch;
  if (on && cur && cur !== sid) fire('streamWatch', { to: cur, on: false });
  setVoice({ vWatch: on ? sid : cur === sid ? null : cur });
  fire('streamWatch', { to: sid, on });
}
const syncPeers = () => setVoice({ vPeers: [...new Set(Object.keys(peers).map(s => peerNames[s]).filter(Boolean))] });

// Konuşan göstergesi: bağlantı istatistiklerindeki ses seviyesi
async function speakTick() {
  const speaking: Record<string, boolean> = {};
  let mine = 0;
  for (const [sid, pc] of Object.entries(peers)) {
    try {
      const stats = await pc.getStats();
      stats.forEach((r: any) => {
        if (r.type === 'inbound-rtp' && r.kind === 'audio' && (r.audioLevel ?? 0) > 0.02) speaking[peerNames[sid] || sid] = true;
        if (r.type === 'media-source' && r.kind === 'audio') mine = Math.max(mine, r.audioLevel ?? 0);
      });
    } catch {}
  }
  const me = st().me; if (me && mine > 0.02 && !st().muted) speaking[me] = true;
  const prev = st().speaking;
  if (Object.keys(prev).join() !== Object.keys(speaking).join()) setVoice({ speaking });
}

async function getMic() {
  return (mediaDevices as any).getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
}

export function voiceTitle(ch: string | null) {
  if (!ch) return '';
  if (ch.startsWith('call:')) { const c = ch.slice(5); const other = c.startsWith('dm:') ? dmPeers(c).find(n => n !== st().me) : null; return other ? `${displayName(other)} ile arama` : 'Grup araması'; }
  return findChannel(ch)?.channel.name || 'Sesli oda';
}

export async function joinVoice(ch: string): Promise<{ error?: string }> {
  if (joining) return { error: 'Bağlanılıyor…' };
  if (st().myVoice === ch) return {};
  joining = true; setVoice({ vConnecting: true });
  try {
    if (st().myVoice) await leaveVoice(false);
    try { localStream = await getMic(); } catch { return { error: 'Mikrofona erişilemedi. Ayarlardan Kanka\'ya mikrofon izni ver.' }; }
    const r = await ask<{ error?: string; peers?: { sid: string; name: string; media?: { cam?: boolean; screen?: boolean } | null }[] }>('voiceJoin', ch);
    if (r?.error) { localStream.getTracks().forEach((t: any) => t.stop()); localStream = null; return { error: r.error }; }
    await audioStart(st().speaker);
    setVoice({ myVoice: ch, speaking: {} });
    applyMute();
    const vm: State['vMedia'] = {};
    for (const p of r.peers || []) { peerNames[p.sid] = p.name; if (p.media) vm[p.sid] = { name: p.name, cam: !!p.media.cam, screen: !!p.media.screen }; makePeer(p.sid); }
    setVoice({ vMedia: vm });
    if (ch.startsWith('call:')) { const live = Object.entries(vm).find(([, m]) => m.screen); if (live) watchStream(live[0]); }
    speakT = setInterval(speakTick, 450);
    bgStart(voiceTitle(ch));
    return {};
  } finally { joining = false; setVoice({ vConnecting: false }); }
}

export async function leaveVoice(notify = true) {
  const ch = st().myVoice;
  if (speakT) { clearInterval(speakT); speakT = null; }
  if (videoStream) stopVideo(true);
  for (const sid of Object.keys(peers)) closePeer(sid);
  localStream?.getTracks().forEach((t: any) => t.stop()); localStream = null;
  if (notify && ch) fire('voiceLeave');
  audioStop(); bgStop();
  setVoice({ myVoice: null, speaking: {}, outgoing: null, vPeers: [], vMedia: {}, vWatch: null, myCam: false, myScreen: false });
}

function applyMute() {
  const { muted, deaf } = st();
  localStream?.getAudioTracks().forEach((t: any) => { t.enabled = !muted && !deaf; });
  for (const pc of Object.values(peers)) pc.getReceivers?.().forEach((r: any) => { if (r.track?.kind === 'audio') r.track.enabled = !deaf; });
  if (st().myVoice) fire('vflags', { m: muted || deaf, d: deaf });
}
export function toggleMute() { const m = !st().muted; setVoice({ muted: m, ...(m ? {} : { deaf: false }) }); applyMute(); }
export function toggleDeaf() { const d = !st().deaf; setVoice({ deaf: d }); applyMute(); }
export function toggleSpeaker() { const s = !st().speaker; setVoice({ speaker: s }); setSpeaker(s); }

// ---- Aramalar ----
export async function startCall(chatId: string, video = false) {
  const r = await joinVoice('call:' + chatId);
  if (r.error) return r;
  setVoice({ outgoing: chatId });
  if (video) await toggleCam();
  fire('ring', { chId: chatId, video });
  setTimeout(() => { // 35 sn cevap yoksa (kimse gelmediyse) aramayı bitir
    if (st().outgoing === chatId && st().myVoice === 'call:' + chatId && !Object.keys(peers).length) { fire('ringCancel', chatId); leaveVoice(); }
  }, 35000);
  return {};
}
let ringT: ReturnType<typeof setTimeout> | null = null;
function stopRing() { Vibration.cancel(); if (ringT) clearTimeout(ringT); ringT = null; setVoice({ ringing: null }); }
export async function acceptCall(withVideo?: boolean) {
  const r = st().ringing; stopRing(); if (!r) return {};
  const j = await joinVoice(r.callId);
  if (!j.error && (withVideo ?? r.video)) await toggleCam();
  return j;
}
export function declineCall() { const r = st().ringing; if (r) fire('callDecline', r.chatId); stopRing(); }

// ---- Sunucu olayları ----
let wired = false;
export function wireVoice() {
  if (wired) return; wired = true;
  onSocket('voiceJoined', ({ sid, name }: { sid: string; name: string }) => { peerNames[sid] = name; if (st().outgoing) setVoice({ outgoing: null }); syncPeers(); sendMedia(); });
  onSocket('media', ({ sid, name, cam, screen }: { sid: string; name: string; cam?: boolean; screen?: boolean }) => {
    if (!st().myVoice) return;
    const was = st().vMedia[sid]?.screen;
    peerNames[sid] = name;
    setVoice({ vMedia: { ...st().vMedia, [sid]: { name, cam: !!cam, screen: !!screen } }, ...(!screen && st().vWatch === sid ? { vWatch: null } : {}) });
    // Aramada karşı taraf ekran paylaşınca doğrudan izle (odalarda isteyen "İzle"ye dokunur)
    if (screen && !was && st().myVoice?.startsWith('call:') && videoKind !== 'screen' && st().vWatch !== sid) watchStream(sid);
    bump();
  });
  onSocket('streamWatch', ({ from, on }: { from: string; name: string; on: boolean }) => {
    if (on && videoKind === 'screen') watchers.add(from); else watchers.delete(from);
    feedPeer(from); sendMedia();
  });
  onSocket('toast', (msg: string) => { // ör. "Bu odada kamera açma iznin yok": sunucu reddettiyse görüntüyü kapat
    if (!st().myVoice || typeof msg !== 'string') return;
    setVoice({ vToast: msg.replace(/<[^>]+>/g, '').slice(0, 200) });
    if (videoStream && /kamera|yayın|ekran/i.test(msg)) stopVideo(true);
  });
  onSocket('voiceRekey', ({ sid, name, old }: { sid: string; name: string; old: string }) => { // karşı taraf yeniden bağlandı: bağlantıyı yeni kimliğe taşı
    if (old && peers[old]) {
      peers[sid] = peers[old]; peers[sid]._sid = sid; delete peers[old];
      if (remoteVideo[old]) { remoteVideo[sid] = remoteVideo[old]; delete remoteVideo[old]; }
      const m = { ...st().vMedia }; if (m[old]) { m[sid] = m[old]; delete m[old]; setVoice({ vMedia: m }); }
      if (watchers.delete(old)) watchers.add(sid);
    }
    peerNames[sid] = name;
  });
  onSocket('signal', async ({ from, data }: { from: string; data: any }) => {
    if (!st().myVoice || !localStream) return;
    const pc = peers[from] || makePeer(from);
    try {
      if (data.sdp) {
        const collision = data.sdp.type === 'offer' && (pc._making || pc.signalingState !== 'stable');
        pc._ignore = !pc._polite && collision; if (pc._ignore) return;
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') { await pc.setLocalDescription(); fire('signal', { to: from, data: { sdp: pc.localDescription } }); }
      } else if (data.ice) {
        try { await pc.addIceCandidate(data.ice); } catch (e) { if (!pc._ignore) console.warn(e); }
      }
    } catch (e) { console.warn('ses bağlantısı', e); }
  });
  onSocket('voiceLeft', (sid: string) => { closePeer(sid); });
  onSocket('voiceKicked', () => { leaveVoice(false); });
  onSocket('voiceMoveTo', ({ ch }: { ch: string }) => { joinVoice(ch); });
  onSocket('srvMute', ({ on }: { on: boolean }) => { if (on) { setVoice({ muted: true }); applyMute(); } });
  onSocket('ring', (r: NonNullable<ReturnType<typeof st>['ringing']>) => {
    if (st().myVoice === r.callId) return;
    setVoice({ ringing: r });
    Vibration.vibrate([0, 700, 500, 700, 500], true);
    if (ringT) clearTimeout(ringT); ringT = setTimeout(stopRing, 32000);
  });
  onSocket('ringCancel', ({ chatId }: { chatId: string }) => { if (st().ringing?.chatId === chatId) stopRing(); });
  onSocket('callDecline', ({ chatId }: { chatId: string }) => { if (st().outgoing === chatId && chatId.startsWith('dm:')) leaveVoice(); });
  // Bağlantı koptu ve geri geldiyse sunucu bizi odadan çıkarmıştır: aynı odaya yeniden gir
  afterAuth.push(() => {
    const ch = st().myVoice; if (!ch || joining) return;
    for (const sid of Object.keys(peers)) closePeer(sid);
    localStream?.getTracks().forEach((t: any) => t.stop()); localStream = null;
    if (speakT) { clearInterval(speakT); speakT = null; }
    if (videoStream) stopVideo(true);
    setVoice({ myVoice: null });
    joinVoice(ch);
  });
  // Android arka planda kamerayı kapatır: karşı tarafta donmuş görüntü kalmasın diye biz de kapatırız
  AppState.addEventListener('change', s => { if (s === 'background' && videoKind === 'cam') { stopVideo(); setVoice({ vToast: 'Uygulama arka plana geçince kameran kapandı.' }); } });
  AppState.addEventListener('change', s => { if (s === 'active' && st().myVoice) for (const pc of Object.values(peers)) if (pc.connectionState !== 'connected') pc.restartIce?.(); });
}
