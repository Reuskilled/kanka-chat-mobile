import { forwardRef, ReactNode } from 'react';
import { Pressable, Text, TextInput, TextInputProps, View, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { C, F } from '@/lib/theme';

export const T = ({ children, style, ...p }: React.ComponentProps<typeof Text>) => (
  <Text {...p} style={[{ color: C.ink, fontFamily: F.regular, fontSize: 15 }, style]}>{children}</Text>
);

export type InputRef = React.ComponentRef<typeof TextInput>;
export const Field = forwardRef<InputRef, TextInputProps & { label: string; error?: boolean }>(function Field({ label, error, style, ...p }, ref) {
  return (
    <View style={{ gap: 6 }}>
      <T style={{ fontSize: 13, fontFamily: F.heavy, color: C.muted }}>{label}</T>
      <TextInput
        ref={ref}
        placeholderTextColor={C.faint}
        accessibilityLabel={label}
        {...p}
        style={[{ height: 52, borderRadius: 14, backgroundColor: C.card, borderWidth: 1.5, borderColor: error ? C.danger : C.lineStrong, color: C.ink, paddingHorizontal: 16, fontFamily: F.regular, fontSize: 16 }, style]}
      />
    </View>
  );
});

export function Button({ title, onPress, busy, disabled, kind = 'primary', style, icon }: { title: string; onPress?: () => void; busy?: boolean; disabled?: boolean; kind?: 'primary' | 'ghost' | 'danger'; style?: StyleProp<ViewStyle>; icon?: ReactNode }) {
  const bg = kind === 'primary' ? C.accent : kind === 'danger' ? 'rgba(239,68,68,0.14)' : C.field;
  const fg = kind === 'primary' ? C.onAccent : kind === 'danger' ? '#f87171' : C.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [{ height: 54, borderRadius: 16, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : (<>{icon}<T style={{ color: fg, fontFamily: F.black, fontSize: 16.5 }}>{title}</T></>)}
    </Pressable>
  );
}

export function IconButton({ label, onPress, children, size = 44, bg = 'transparent' }: { label: string; onPress?: () => void; children: ReactNode; size?: number; bg?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      {children}
    </Pressable>
  );
}

export const ErrorText = ({ children }: { children?: string | null }) => (children ? <T accessibilityLiveRegion="polite" style={{ color: '#f87171', fontFamily: F.bold, fontSize: 14 }}>{children}</T> : null);
