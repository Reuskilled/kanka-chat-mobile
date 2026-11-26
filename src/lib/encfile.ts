// Şifreli DM'deki dosyalar: sunucudan şifreli hâli indirilir, bu cihazda çözülür (anahtarı mesajın içinde gelir).
// Resimler ekranda gösterilmek üzere data: adresine çevrilir; sonuç bellekte tutulur.
import { useEffect, useState } from 'react';
import { gcm } from '@noble/ciphers/aes.js';
import { SERVER } from './config';
import { b64, unb64 } from './e2e';

export type EncFile = { n?: string; m?: string; s?: number; k: string; iv: string; i: string };
export const encFileOk = (f: any): f is EncFile => !!f && /^[a-f0-9]{24}$/.test(f.i || '') && typeof f.k === 'string' && typeof f.iv === 'string';
export const isImg = (m?: string) => /^image\/(png|jpeg|gif|webp)$/.test(m || '');

const cache = new Map<string, string>(), pending = new Map<string, Promise<string | null>>();
async function load(f: EncFile): Promise<string | null> {
  try {
    const r = await fetch(`${SERVER}/dosya/${f.i}`); if (!r.ok) return null;
    const pt = gcm(unb64(f.k), unb64(f.iv)).decrypt(new Uint8Array(await r.arrayBuffer()));
    const url = `data:${isImg(f.m) ? f.m : 'application/octet-stream'};base64,${b64(pt)}`;
    cache.set(f.i, url); return url;
  } catch { return null; }
}
export function useEncFile(f: EncFile | null, want: boolean): { url: string | null; failed: boolean } {
  const [url, setUrl] = useState<string | null>(f ? cache.get(f.i) || null : null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!f || !want || url) return;
    let alive = true;
    const p = pending.get(f.i) || load(f); pending.set(f.i, p);
    p.then(u => { pending.delete(f.i); if (!alive) return; if (u) setUrl(u); else setFailed(true); });
    return () => { alive = false; };
  }, [f?.i, want]); // eslint-disable-line react-hooks/exhaustive-deps
  return { url, failed };
}
