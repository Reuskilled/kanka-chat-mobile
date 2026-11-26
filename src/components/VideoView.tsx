import type { StyleProp, ViewStyle } from 'react-native';
import { RTCView } from 'react-native-webrtc';

// WebRTC görüntüsü (telefon): kamera ya da ekran yayını
export function VideoView({ stream, mirror, fit = 'cover', style }: { stream: any; mirror?: boolean; fit?: 'cover' | 'contain'; style?: StyleProp<ViewStyle> }) {
  if (!stream?.toURL) return null;
  return <RTCView streamURL={stream.toURL()} objectFit={fit} mirror={!!mirror} zOrder={0} style={style} />;
}
