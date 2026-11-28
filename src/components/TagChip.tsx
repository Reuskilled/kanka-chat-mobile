// Sunucu etiketi: ismin yanında küçük renkli rozet (ör. 🦝 KNK)
import { Pressable, View } from 'react-native';
import { useKanka, type TagDef } from '@/lib/kanka';
import { F } from '@/lib/theme';
import { T } from './ui';

export function TagView({ d, big, onPress }: { d: TagDef; big?: boolean; onPress?: () => void }) {
  const c = d.c || '#d4ff00', sz = big ? 14 : 11.5;
  const icon = d.i && !d.i.startsWith('px:') ? d.i : null;
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: big ? 8 : 5, paddingVertical: big ? 3 : 1, borderRadius: 6, backgroundColor: c + '26', borderWidth: d.st === 'neon' ? 1 : 0, borderColor: c }}>
      {icon && <T style={{ fontSize: sz }}>{icon}</T>}
      <T style={{ fontSize: sz, fontFamily: F.black, color: c, letterSpacing: 0.3 }}>{d.t}</T>
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${d.ad} etiketi`} onPress={onPress}>{body}</Pressable> : body;
}

// Kullanıcının taktığı etiket (yoksa hiçbir şey)
export function UserTag({ name, big, onPress }: { name?: string | null; big?: boolean; onPress?: (sid: string) => void }) {
  const sid = useKanka(s => (name ? s.users[name]?.tg : null) || null);
  const d = useKanka(s => (sid ? s.acct.tagDefs[sid] : undefined));
  if (!sid || !d) return null;
  return <TagView d={d} big={big} onPress={onPress ? () => onPress(sid) : undefined} />;
}
