import { useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

// Web önizlemesi: tarayıcının <video> öğesi
export function VideoView({ stream, mirror, fit = 'cover', style }: { stream: any; mirror?: boolean; fit?: 'cover' | 'contain'; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const v = ref.current; if (v && v.srcObject !== stream) { v.srcObject = stream; v.play?.().catch(() => {}); } }, [stream]);
  if (!stream) return null;
  return (
    <View style={style}>
      <video ref={ref} autoPlay playsInline muted data-kvideo="1" style={{ width: '100%', height: '100%', objectFit: fit, transform: mirror ? 'scaleX(-1)' : undefined, background: '#000' }} />
    </View>
  );
}
