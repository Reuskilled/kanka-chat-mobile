import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import type { Att } from '@/lib/kanka';
import { T, IconButton } from './ui';
import { Icon } from './Icon';

const MAX = 25 * 1024 * 1024;
const extOf = (mime: string) => (mime.split('/')[1] || 'bin').replace('jpeg', 'jpg');

// Mesaj yazma alanı: metin + fotoğraf/dosya ekleme (en çok 10), gönderirken yükleme göstergesi
export function Composer({ placeholder, onSend, onTyping, bottom, secure }: {
  placeholder: string; bottom: number; secure?: boolean;
  onSend: (text: string, atts: Att[]) => Promise<boolean>; onTyping: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [atts, setAtts] = useState<Att[]>([]);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  const add = (list: Att[]) => {
    const ok = list.filter(a => !a.size || a.size <= MAX);
    if (ok.length < list.length) setWarn('25 MB\'tan büyük dosyalar gönderilemez.'); else setWarn(null);
    setAtts(a => [...a, ...ok].slice(0, 10));
  };
  const pickPhotos = async () => {
    setSheet(false);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.85 });
    if (r.canceled) return;
    add(r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName || `foto-${Date.now()}-${i}.${extOf(a.mimeType || 'image/jpeg')}`, type: a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg'), size: a.fileSize })));
  };
  const takePhoto = async () => {
    setSheet(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync(); if (!perm.granted) return setWarn('Kamera izni verilmedi.');
    const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (r.canceled) return;
    const a = r.assets[0]; add([{ uri: a.uri, name: `kamera-${Date.now()}.jpg`, type: a.mimeType || 'image/jpeg', size: a.fileSize }]);
  };
  const pickFile = async () => {
    setSheet(false);
    const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (r.canceled) return;
    add(r.assets.map(a => ({ uri: a.uri, name: a.name, type: a.mimeType || 'application/octet-stream', size: a.size })));
  };

  const go = async () => {
    const t = text.trim(); if ((!t && !atts.length) || busy) return;
    setBusy(true);
    const ok = await onSend(t, atts);
    setBusy(false);
    if (ok) { setText(''); setAtts([]); setWarn(null); }
  };
  const can = !!(text.trim() || atts.length) && !busy;

  return (
    <View>
      {!!warn && <T style={{ paddingHorizontal: 18, paddingBottom: 6, fontSize: 13, color: '#f87171', fontFamily: F.bold }}>{warn}</T>}
      {atts.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 10, paddingTop: 6 }}>
          {atts.map((a, i) => (
            <View key={a.uri + i} style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: C.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {a.type.startsWith('image/') ? <Image source={{ uri: a.uri }} style={{ width: 72, height: 72 }} contentFit="cover" /> : (
                <View style={{ alignItems: 'center', padding: 6, gap: 4 }}><Icon name="file" size={20} color={C.accent} /><T numberOfLines={2} style={{ fontSize: 10.5, textAlign: 'center', color: C.muted }}>{a.name}</T></View>
              )}
              {!busy && (
                <Pressable accessibilityRole="button" accessibilityLabel={`${a.name} kaldır`} onPress={() => setAtts(x => x.filter((_, j) => j !== i))} hitSlop={8}
                  style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                  <T style={{ fontSize: 12, fontFamily: F.black, lineHeight: 14 }}>✕</T>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: bottom }}>
        <IconButton label="Dosya ya da fotoğraf ekle" bg={C.field} onPress={() => setSheet(true)}><Icon name="plus" color={C.muted} stroke={2.4} /></IconButton>
        <View style={{ flex: 1, minHeight: 44, borderRadius: 22, backgroundColor: C.field, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 }}>
          <TextInput
            value={text}
            onChangeText={v => { setText(v); if (v) onTyping(); }}
            placeholder={placeholder}
            placeholderTextColor={C.faint}
            accessibilityLabel="Mesaj"
            multiline
            maxLength={4000}
            style={{ flex: 1, color: C.ink, fontFamily: F.regular, fontSize: 15, paddingVertical: 10, maxHeight: 140 }}
          />
          {secure && <View accessibilityLabel="Şifreli gönderilecek" style={{ paddingHorizontal: 8 }}><Icon name="lock" size={15} color={C.online} /></View>}
        </View>
        <IconButton label="Gönder" bg={can ? C.accent : C.field} onPress={go}>
          {busy ? <ActivityIndicator color={C.onAccent} /> : <Icon name="send" size={20} color={can ? C.onAccent : C.faint} stroke={2.6} />}
        </IconButton>
      </View>

      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <Pressable accessibilityLabel="Kapat" onPress={() => setSheet(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: C.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: insets.bottom + 16, gap: 8 }}>
            {[
              { t: 'Galeriden fotoğraf / video', ic: 'screen', on: pickPhotos },
              { t: 'Fotoğraf çek', ic: 'plus', on: takePhoto },
              { t: 'Dosya seç', ic: 'file', on: pickFile },
            ].map(a => (
              <Pressable key={a.t} accessibilityRole="button" onPress={a.on} style={({ pressed }) => ({ height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: pressed ? C.hover : C.card })}>
                <Icon name={a.ic} size={20} color={C.accent} /><T style={{ fontFamily: F.heavy, fontSize: 15.5 }}>{a.t}</T>
              </Pressable>
            ))}
            {secure && <T style={{ fontSize: 12.5, color: C.muted, textAlign: 'center', marginTop: 4 }}>Bu sohbette dosyalar da cihazında şifrelenip gönderilir.</T>}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
