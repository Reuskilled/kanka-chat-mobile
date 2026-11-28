// Market / Görünüm: avatar çerçevesi, profil efekti, isim afişi seç (webdeki Market'le aynı öğeler ve açılma kuralları)
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { C, F } from '@/lib/theme';
import { abs } from '@/lib/config';
import { updateProfile, useKanka } from '@/lib/kanka';
import { Screen, Chips } from '@/components/AdminUI';
import { T } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';

// lvl: açılma seviyesi · -1: Kurucu rozetli · -2: yakında (şimdilik kapalı)
const FRAMES: { id: string; ad: string; lvl: number; img?: string; renk?: string }[] = [
  { id: 'none', ad: 'Yok', lvl: 0 },
  { id: 'halka', ad: 'Halka', lvl: 2, renk: '#d4ff00' }, { id: 'gokkusagi', ad: 'Gökkuşağı', lvl: 5, renk: '#ff6fae' }, { id: 'ates', ad: 'Ateş', lvl: 10, renk: '#ff6b2b' },
  { id: 'neon', ad: 'Neon', lvl: 15, renk: '#38bdf8' }, { id: 'altin', ad: 'Altın', lvl: 25, renk: '#f6c445' }, { id: 'kurucu', ad: 'Kurucu', lvl: -1, renk: '#a78bfa' },
  { id: 'gecekedi', ad: 'Gece Kedisi', lvl: -2, img: '/effects/cat_frame_midnight.webp' }, { id: 'kitsune', ad: 'Siber Tilki', lvl: -2, img: '/effects/kitsune_frame.webp' },
  { id: 'sakuramoon', ad: 'Ay & Sakura', lvl: -2, img: '/effects/sakura_frame.webp' }, { id: 'minikhayalet', ad: 'Minik Hayalet', lvl: -2, img: '/effects/ghost_frame.webp' },
  { id: 'kankaasit', ad: 'Kanka Asit', lvl: -2, img: '/effects/acid_frame.webp' }, { id: 'ikizkoi', ad: 'İkiz Koi', lvl: -2, img: '/effects/koi_frame.webp' },
  { id: 'altinas', ad: 'Altın As', lvl: -2, img: '/effects/gold_ace_frame.webp' }, { id: 'kozmik', ad: 'Kozmik Yörünge', lvl: -2, img: '/effects/cosmic_frame.webp' },
  { id: 'korcelik', ad: 'Kor & Çelik', lvl: -2, img: '/effects/ember_frame.webp' },
];
const EFFECTS: [string, string, string, string][] = [
  ['none', 'Yok', '⊘', '#71717a'], ['glitch', 'Siber Glitch', '▓', '#d4ff00'], ['matrix', 'Asit Akış', '⋮', '#d4ff00'], ['starry', 'Yıldızlı', '✦', '#93c5fd'],
  ['embers', 'Kor Alev', '🔥', '#ff6b2b'], ['lightning', 'Şimşek', '⚡', '#38bdf8'], ['snow', 'Kar Yağışı', '❄', '#e2e8f0'], ['rain', 'Yağmur', '⛆', '#60a5fa'],
  ['sakura', 'Sakura', '✿', '#f472b6'], ['sparkles', 'Prizma', '✧', '#fde047'],
];
const BANNERS: { id: string; ad: string; renk?: string; img?: string; soon?: boolean }[] = [
  { id: 'none', ad: 'Yok' },
  { id: 'cyberlime', ad: 'Asit Siber', renk: '#d4ff00' }, { id: 'embers', ad: 'Kor Alev', renk: '#ff6b2b' }, { id: 'magma', ad: 'Magma', renk: '#ff9447' },
  { id: 'frostbite', ad: 'Buz Kristali', renk: '#7dd3fc' }, { id: 'deepsea', ad: 'Derin Deniz', renk: '#2563eb' }, { id: 'thunder', ad: 'Fırtına', renk: '#facc15' },
  { id: 'nebula', ad: 'Nebula', renk: '#a855f7' }, { id: 'eclipse', ad: 'Tutulma', renk: '#f97316' }, { id: 'prism', ad: 'Prizma', renk: '#22d3ee' },
  { id: 'sakura', ad: 'Sakura', renk: '#f472b6' }, { id: 'goldsilk', ad: 'Altın İpek', renk: '#f6c445' },
  { id: 'gecekedi', ad: 'Gece Kedisi', img: '/effects/cat_nameplate_poster.webp', soon: true }, { id: 'kitsune', ad: 'Siber Tilki', img: '/effects/kitsune_nameplate_poster.webp', soon: true },
  { id: 'sakuramoon', ad: 'Ay & Sakura', img: '/effects/sakura_nameplate_poster.webp', soon: true }, { id: 'minikhayalet', ad: 'Minik Hayalet', img: '/effects/ghost_nameplate_poster.webp', soon: true },
  { id: 'kankaasit', ad: 'Kanka Asit', img: '/effects/acid_nameplate_poster.webp', soon: true }, { id: 'ikizkoi', ad: 'İkiz Koi', img: '/effects/koi_nameplate_poster.webp', soon: true },
  { id: 'altinas', ad: 'Altın As', img: '/effects/gold_ace_nameplate_poster.webp', soon: true }, { id: 'kozmik', ad: 'Kozmik Yörünge', img: '/effects/cosmic_nameplate_poster.webp', soon: true },
  { id: 'korcelik', ad: 'Kor & Çelik', img: '/effects/ember_nameplate_poster.webp', soon: true },
];

function Card({ on, locked, note, onPress, children, title }: { on: boolean; locked: boolean; note?: string; onPress: () => void; children: React.ReactNode; title: string }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: on, disabled: locked }} accessibilityLabel={`${title}${locked ? ', kilitli' : ''}${note ? ', ' + note : ''}`} onPress={onPress}
      style={({ pressed }) => ({ width: '31.5%', borderRadius: 14, padding: 8, gap: 6, alignItems: 'center', backgroundColor: on ? C.accentSoft : pressed ? C.hover : C.card, borderWidth: 1.5, borderColor: on ? C.accent : 'transparent', opacity: locked ? 0.55 : 1 })}>
      <View style={{ width: '100%', height: 74, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
      <T numberOfLines={1} style={{ fontSize: 12.5, fontFamily: F.heavy }}>{title}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 16 }}>
        {locked && <Icon name="lock" size={11} color={C.muted} />}
        {!!note && <T style={{ fontSize: 11, color: on ? C.accent : C.muted, fontFamily: F.heavy }}>{note}</T>}
      </View>
    </Pressable>
  );
}

export default function Gorunum() {
  const me = useKanka(s => s.me)!;
  const u = useKanka(s => s.meUser) as any;
  const [tab, setTab] = useState<'cerceve' | 'efekt' | 'afis'>('cerceve');
  if (!u) return null;
  const lvl = u.level || 1, pisago = me.toLowerCase() === 'pisago';
  const set = async (p: Record<string, string>, ok: boolean, why: string) => {
    if (!ok) return Alert.alert('Kilitli', why);
    const e = await updateProfile(p as any); if (e) Alert.alert('Olmadı', e);
  };
  return (
    <Screen title="Market" sub="Profil görünümün · her yerde aynı görünür">
      <View style={{ alignItems: 'center', paddingVertical: 8 }}><Avatar name={me} size={84} /><T style={{ marginTop: 8, fontFamily: F.black, fontSize: 17 }}>{u.displayName || me}</T><T style={{ fontSize: 12.5, color: C.muted }}>Seviye {lvl}</T></View>
      <Chips value={tab} onChange={setTab} options={[['cerceve', 'Avatar çerçevesi'], ['efekt', 'Profil efekti'], ['afis', 'İsim afişi']]} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tab === 'cerceve' && FRAMES.map(f => {
          const open = f.id === 'none' || (f.lvl === -2 ? pisago : f.lvl === -1 ? !!u.kurucu : lvl >= f.lvl);
          const on = (u.frame || 'none') === f.id;
          const note = on ? 'Kullanılıyor' : f.lvl === -2 ? (pisago ? '' : 'Yakında') : f.lvl === -1 ? 'Kurucu' : f.lvl > 0 && !open ? `Sv ${f.lvl}` : '';
          return (
            <Card key={f.id} title={f.ad} on={on} locked={!open} note={note} onPress={() => set({ frame: f.id }, open, f.lvl === -2 ? 'Bu çerçeve yakında Market\'e gelecek.' : f.lvl === -1 ? 'Kurucu rozeti olanlara özel.' : `Seviye ${f.lvl} olunca açılır. Şu an seviye ${lvl}.`)}>
              <View style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
                <Avatar name={me} size={f.img ? 44 : 48} />
                {f.img ? <Image source={{ uri: abs(f.img) || undefined }} style={{ position: 'absolute', width: 66, height: 66 }} contentFit="contain" />
                  : f.renk ? <View style={{ position: 'absolute', width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: f.renk }} /> : null}
              </View>
            </Card>
          );
        })}
        {tab === 'efekt' && EFFECTS.map(([id, ad, ic, col]) => {
          const on = (u.effect || 'none') === id;
          return (
            <Card key={id} title={ad} on={on} locked={false} note={on ? 'Kullanılıyor' : ''} onPress={() => set({ effect: id }, true, '')}>
              <View style={{ width: '100%', height: 70, borderRadius: 10, backgroundColor: '#0d0d10', alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 26, color: col }}>{ic}</T></View>
            </Card>
          );
        })}
        {tab === 'afis' && BANNERS.map(b => {
          const open = !b.soon || pisago, on = (u.nameBanner || 'none') === b.id;
          return (
            <Card key={b.id} title={b.ad} on={on} locked={!open} note={on ? 'Kullanılıyor' : b.soon && !pisago ? 'Yakında' : ''} onPress={() => set({ nameBanner: b.id }, open, 'Bu isim afişi yakında Market\'e gelecek.')}>
              <View style={{ width: '100%', height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: b.renk ? b.renk + '33' : C.field, borderWidth: b.renk ? 1 : 0, borderColor: (b.renk || '#000') + '88', justifyContent: 'center', paddingHorizontal: 6 }}>
                {b.img ? <Image source={{ uri: abs(b.img) || undefined }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" /> : null}
                <T numberOfLines={1} style={{ fontSize: 11.5, fontFamily: F.black, color: '#fff' }}>{u.displayName || me}</T>
              </View>
            </Card>
          );
        })}
      </View>
      <T style={{ fontSize: 12, color: C.faint, textAlign: 'center' }}>Hareketli önizlemeler webde görünür; seçtiğin görünüm hesabına kaydedilir.</T>
    </Screen>
  );
}
