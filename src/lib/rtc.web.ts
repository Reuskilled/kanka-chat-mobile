// Web önizlemesi (sadece geliştirme/test): tarayıcının kendi WebRTC'si; ses yönlendirme ve arka plan hizmeti yok.
export const RTCPeerConnection = (globalThis as any).RTCPeerConnection;
export const mediaDevices = (globalThis as any).navigator?.mediaDevices;
export const MediaStream = (globalThis as any).MediaStream;

// Tarayıcıda uzak sesin çalması için <audio> öğesi gerekir
const els = new Map<string, HTMLAudioElement>();
export function webPlay(id: string, stream: any) {
  let a = els.get(id);
  if (!a) { a = document.createElement('audio'); a.autoplay = true; document.body.appendChild(a); els.set(id, a); }
  a.srcObject = stream;
}
export function webStop(id: string) { for (const [k, a] of els) if (k === id || k.startsWith(id + ':')) { a.remove(); els.delete(k); } }

export async function audioStart(_speaker: boolean) {}
export function audioStop() {}
export function setSpeaker(_on: boolean) {}
export async function bgStart(_title: string) {}
export async function bgStop() {}
