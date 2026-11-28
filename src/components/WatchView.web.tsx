import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { watchHtml } from './watchHtml';

export type WatchRef = { apply: (playing: boolean, time: number) => void };
type P = { videoId: string; onMsg: (m: { t: string; playing?: boolean; time?: number; code?: number }) => void };

export const WatchView = forwardRef<WatchRef, P>(function WatchView({ videoId, onMsg }, ref) {
  const fr = useRef<HTMLIFrameElement>(null);
  const cb = useRef(onMsg); cb.current = onMsg;
  useImperativeHandle(ref, () => ({ apply: (p, t) => fr.current?.contentWindow?.postMessage({ kankaApply: [p, t] }, '*') }), []);
  useEffect(() => {
    const h = (e: MessageEvent) => { if (e.source === fr.current?.contentWindow && e.data?.kankaWatch) { try { cb.current(JSON.parse(e.data.kankaWatch)); } catch {} } };
    window.addEventListener('message', h); return () => window.removeEventListener('message', h);
  }, []);
  return <iframe ref={fr} srcDoc={watchHtml(videoId)} allow="autoplay; encrypted-media" style={{ border: 0, width: '100%', height: '100%', background: '#000' }} />;
});
