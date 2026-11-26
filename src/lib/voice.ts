// Sesli odalar ve aramalar. Webdekiyle aynı yapı: odadaki herkes birbirine doğrudan bağlanır (WebRTC, P2P),
// sunucu sadece bağlantı bilgilerini iletir ('signal'). Arama = "call:<sohbet>" adlı sesli oda + 'ring' bildirimi.
// Bağlantı kurma "kibar/kaba" kuralıyla (perfect negotiation): iki taraf aynı anda teklif yaparsa kimliği küçük olan geri çekilir.
import { AppState, Vibration } from 'react-native';
import { ask, fire, getState, onSocket, setVoice, socketId, findChannel, displayName, dmPeers, afterAuth } from './kanka';
import { RTCPeerConnection, mediaDevices, audioStart, audioStop, setSpeaker, bgStart, bgStop, webPlay, webStop } from './rtc';

type PC = any; // RTCPeerConnection (react-native-webrtc ya da tarayıcı)
const peers: Record<string, PC> = {};
(globalThis as any).__kankaSes = peers; // geliştirme testleri için (web önizlemesi)
const peerNames: Record<string, string> = {};
let localStream: any = null;
let speakT: ReturnType<typeof setInterval> | null = null;
let joining = false;

const st = getState;
const iceCfg = () => ({ iceServers: st().ice?.length ? st().ice : [{ urls: ['stun:stun.l.google.com:19302'] }] });

function makePeer(sid: string): PC {
  const pc: PC = new (RTCPeerConnection as any)(iceCfg());
  Object.assign(pc, { _sid: sid, _polite: (socketId() || '') < sid, _making: false, _ignore: false });
  peers[sid] = pc;
  setTimeout(syncPeers);
  localStream?.getTracks().forEach((t: any) => pc.addTrack(t, localStream));
  pc.onicecandidate = (e: any) => { if (e.candidate) fire('signal', { to: sid, data: { ice: e.candidate } }); };
  pc.onnegotiationneeded = async () => {
    try { pc._making = true; await pc.setLocalDescription(); fire('signal', { to: sid, data: { sdp: pc.localDescription } }); }
    catch (e) { console.warn('ses teklifi', e); } finally { pc._making = false; }
  };
  pc.ontrack = (e: any) => {
    if (e.track?.kind !== 'audio') return; // görüntü bu sürümde yok
    if (st().deaf) e.track.enabled = false;
    webPlay(sid, e.streams?.[0]);
  };
  pc.onconnectionstatechange = () => {
    clearTimeout(pc._rt);
    if (pc.connectionState === 'failed') pc.restartIce?.();
    else if (pc.connectionState === 'disconnected') pc._rt = setTimeout(() => pc.connectionState === 'disconnected' && pc.restartIce?.(), 3000);
  };
  return pc;
}
function closePeer(sid: string) { try { peers[sid]?.close(); } catch {} delete peers[sid]; delete peerNames[sid]; webStop(sid); syncPeers(); }
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
    const r = await ask<{ error?: string; peers?: { sid: string; name: string }[] }>('voiceJoin', ch);
    if (r?.error) { localStream.getTracks().forEach((t: any) => t.stop()); localStream = null; return { error: r.error }; }
    await audioStart(st().speaker);
    setVoice({ myVoice: ch, speaking: {} });
    applyMute();
    for (const p of r.peers || []) { peerNames[p.sid] = p.name; makePeer(p.sid); }
    speakT = setInterval(speakTick, 450);
    bgStart(voiceTitle(ch));
    return {};
  } finally { joining = false; setVoice({ vConnecting: false }); }
}

export async function leaveVoice(notify = true) {
  const ch = st().myVoice;
  if (speakT) { clearInterval(speakT); speakT = null; }
  for (const sid of Object.keys(peers)) closePeer(sid);
  localStream?.getTracks().forEach((t: any) => t.stop()); localStream = null;
  if (notify && ch) fire('voiceLeave');
  audioStop(); bgStop();
  setVoice({ myVoice: null, speaking: {}, outgoing: null, vPeers: [] });
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
export async function startCall(chatId: string) {
  const r = await joinVoice('call:' + chatId);
  if (r.error) return r;
  setVoice({ outgoing: chatId });
  fire('ring', { chId: chatId, video: false });
  setTimeout(() => { // 35 sn cevap yoksa (kimse gelmediyse) aramayı bitir
    if (st().outgoing === chatId && st().myVoice === 'call:' + chatId && !Object.keys(peers).length) { fire('ringCancel', chatId); leaveVoice(); }
  }, 35000);
  return {};
}
let ringT: ReturnType<typeof setTimeout> | null = null;
function stopRing() { Vibration.cancel(); if (ringT) clearTimeout(ringT); ringT = null; setVoice({ ringing: null }); }
export async function acceptCall() { const r = st().ringing; stopRing(); if (r) return joinVoice(r.callId); return {}; }
export function declineCall() { const r = st().ringing; if (r) fire('callDecline', r.chatId); stopRing(); }

// ---- Sunucu olayları ----
let wired = false;
export function wireVoice() {
  if (wired) return; wired = true;
  onSocket('voiceJoined', ({ sid, name }: { sid: string; name: string }) => { peerNames[sid] = name; if (st().outgoing) setVoice({ outgoing: null }); syncPeers(); });
  onSocket('voiceRekey', ({ sid, name, old }: { sid: string; name: string; old: string }) => { // karşı taraf yeniden bağlandı: bağlantıyı yeni kimliğe taşı
    if (old && peers[old]) { peers[sid] = peers[old]; peers[sid]._sid = sid; delete peers[old]; }
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
    setVoice({ myVoice: null });
    joinVoice(ch);
  });
  AppState.addEventListener('change', s => { if (s === 'active' && st().myVoice) for (const pc of Object.values(peers)) if (pc.connectionState !== 'connected') pc.restartIce?.(); });
}
