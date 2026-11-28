import { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { watchHtml } from './watchHtml';

// Tür tanımı yeni React sürümüyle uyumsuz; bileşen sorunsuz çalışıyor
const WV = WebView as unknown as React.ComponentType<any>;
export type WatchRef = { apply: (playing: boolean, time: number) => void };
type P = { videoId: string; onMsg: (m: { t: string; playing?: boolean; time?: number; code?: number }) => void };

export const WatchView = forwardRef<WatchRef, P>(function WatchView({ videoId, onMsg }, ref) {
  const wv = useRef<{ injectJavaScript: (s: string) => void } | null>(null);
  useImperativeHandle(ref, () => ({ apply: (p, t) => wv.current?.injectJavaScript(`apply(${p ? 'true' : 'false'},${Number(t) || 0});true;`) }), []);
  return (
    <WV ref={wv} source={{ html: watchHtml(videoId), baseUrl: 'https://kankahq.com' }} style={{ flex: 1, backgroundColor: '#000' }}
      allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} javaScriptEnabled originWhitelist={['*']}
      onMessage={(e: { nativeEvent: { data: string } }) => { try { onMsg(JSON.parse(e.nativeEvent.data)); } catch {} }} />
  );
});
