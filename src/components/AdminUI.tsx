// Yönetim ekranlarının ortak parçaları: başlık, bölüm, satır, seçim çipleri, alttan açılan pencere
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { T, IconButton } from './ui';
import { Icon } from './Icon';

export function Screen({ title, sub, children, right, scroll = true }: { title: string; sub?: string; children: ReactNode; right?: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep, paddingTop: insets.top }}>
      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <IconButton label="Geri" onPress={() => router.back()}><Icon name="back" stroke={2.4} /></IconButton>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T accessibilityRole="header" numberOfLines={1} style={{ fontFamily: F.black, fontSize: 18 }}>{title}</T>
          {!!sub && <T numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{sub}</T>}
        </View>
        {right}
      </View>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 30, gap: 10 }}>{children}</ScrollView> : children}
    </View>
  );
}

export const Section = ({ title, children, hint }: { title?: string; children: ReactNode; hint?: string }) => (
  <View style={{ gap: 6, marginTop: 6 }}>
    {!!title && <T style={{ fontSize: 12, fontFamily: F.black, color: C.muted, letterSpacing: 0.6, paddingHorizontal: 4 }}>{title.toLocaleUpperCase('tr')}</T>}
    <View style={{ borderRadius: 16, backgroundColor: C.card, overflow: 'hidden' }}>{children}</View>
    {!!hint && <T style={{ fontSize: 12.5, color: C.faint, paddingHorizontal: 4 }}>{hint}</T>}
  </View>
);

export function Row({ title, sub, icon, iconColor, onPress, right, danger, last, left, label }: {
  title: string; sub?: string; icon?: string; iconColor?: string; onPress?: () => void; right?: ReactNode; danger?: boolean; last?: boolean; left?: ReactNode; label?: string;
}) {
  // Sağdaki düğmeler (iptal, yukarı/aşağı…) satırın dokunma alanının dışında: ekran okuyucu her birine ayrı odaklanabilsin
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line }}>
      <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={label || (sub ? `${title}, ${sub}` : title)} onPress={onPress} disabled={!onPress}
        style={({ pressed }) => ({ flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: right ? 4 : 14, paddingVertical: 10, backgroundColor: pressed ? C.hover : 'transparent' })}>
        {left}
        {!!icon && <Icon name={icon} size={20} color={danger ? C.danger : iconColor || C.muted} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <T numberOfLines={1} style={{ fontFamily: F.heavy, fontSize: 15, color: danger ? '#f87171' : C.ink }}>{title}</T>
          {!!sub && <T numberOfLines={2} style={{ fontSize: 12.5, color: C.muted, marginTop: 1 }}>{sub}</T>}
        </View>
        {!right && onPress ? <Icon name="chevron" size={18} color={C.faint} /> : null}
      </Pressable>
      {!!right && <View style={{ paddingRight: 10 }}>{right}</View>}
    </View>
  );
}

export function ToggleRow({ title, sub, value, onChange, disabled, last }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; last?: boolean }) {
  return (
    <Row title={title} sub={sub} last={last} onPress={disabled ? undefined : () => onChange(!value)}
      right={<Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={title} trackColor={{ true: C.accent, false: C.field }} thumbColor={value ? C.onAccent : '#d4d4d8'} />} />
  );
}

export function Chips<V extends string | number>({ value, options, onChange }: { value: V; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <Pressable key={String(v)} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(v)}
            style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: on ? C.accent : C.field }}>
            <T style={{ fontFamily: F.heavy, fontSize: 13.5, color: on ? C.onAccent : C.ink }}>{l}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

// Alttan açılan pencere (klavye açılınca yukarı kayar)
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Kapat" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
        <View style={{ maxHeight: '88%', backgroundColor: C.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: insets.bottom + 12 }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.lineStrong }} /></View>
          {!!title && <T accessibilityRole="header" numberOfLines={1} style={{ fontFamily: F.black, fontSize: 18, paddingHorizontal: 18, paddingTop: 10 }}>{title}</T>}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const Empty = ({ text }: { text: string }) => <T style={{ color: C.muted, textAlign: 'center', padding: 24 }}>{text}</T>;
export const Dot = ({ color, size = 14 }: { color?: string; size?: number }) => <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color || '#99aab5' }} />;
