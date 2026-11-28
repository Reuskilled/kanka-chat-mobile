import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/lib/theme';
import { getState, type Att, type Voice } from '@/lib/kanka';
import { fmtDur } from './VoiceNote';
import { T, IconButton } from './ui';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import type { AppCmd } from '@/lib/types';

const MAX = 25 * 1024 * 1024;
// Konuşma için yeterli kalite, küçük dosya (5 dakika ≈ 2,4 MB)
const REC = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 };
const REC_MAX = 300;
const extOf = (mime: string) => (mime.split('/')[1] || 'bin').replace('jpeg', 'jpg');

// Mesaj yazma alanı: metin + fotoğraf/dosya ekleme (en çok 10), gönderirken yükleme göstergesi
export function Composer({ placeholder, onSend, onVoice, onTyping, bottom, secure, cmds, onCmd, extras, initial }: {
  initial?: { text: string; atts: Att[] } | null;
  placeholder: string; bottom: number; secure?: boolean; cmds?: AppCmd[]; onCmd?: (c: AppCmd) => void; extras?: { t: string; ic: string; on: (text: string) => void; takesText?: boolean }[];
  onSend: (text: string, atts: Att[]) => Promise<boolean>; onVoice?: (v: Voice) => Promise<boolean>; onTyping: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial?.text || '');
  const [atts, setAtts] = useState<Att[]>(initial?.atts || []);
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

  // ---- Sesli mesaj: mikrofona dokun, konuş, gönder (ya da iptal) ----
  const rec = useAudioRecorder(REC);
  const rs = useAudioRecorderState(rec, 250);
  const [recOn, setRecOn] = useState(false);
  const cancelRef = useRef(false);
  const startRec = async () => {
    if (busy || recOn) return;
    if (getState().myVoice) return setWarn('Sesli sohbetteyken ses mesajı kaydedemezsin.');
    const p = await requestRecordingPermissionsAsync(); if (!p.granted) return setWarn('Mikrofon izni verilmedi.');
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await rec.prepareToRecordAsync(); rec.record(); cancelRef.current = false; setRecOn(true); setWarn(null);
    } catch { setWarn('Kayıt başlatılamadı.'); }
  };
  const stopRec = async (cancel: boolean) => {
    if (!recOn) return;
    cancelRef.current = cancel;
    const dur = (rec.getStatus().durationMillis || rs.durationMillis || 0) / 1000;
    try { await rec.stop(); } catch { /* zaten durmuş */ }
    setRecOn(false);
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    const uri = rec.uri;
    if (cancel || !uri || !onVoice) return;
    if (dur < 0.7) return setWarn('Kayıt çok kısa, basılı değil dokunup konuş.');
    setBusy(true);
    const ok = await onVoice({ uri, dur, type: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4' });
    setBusy(false);
    if (ok) setWarn(null);
  };
  const stopRef = useRef(stopRec);
  useEffect(() => { stopRef.current = stopRec; });
  useEffect(() => { if (!recOn) return; const t = setTimeout(() => stopRef.current(false), REC_MAX * 1000); return () => clearTimeout(t); }, [recOn]); // en çok 5 dakika

  const go = async () => {
    const t = text.trim(); if ((!t && !atts.length) || busy) return;
    const cm = /^\/([\p{L}\p{N}_-]+)(?::\S+)?$/u.exec(t); // tam komut adı yazıp gönderdiyse komutu aç
    const hit = cm && !atts.length ? cmds?.find(c => c.ad === cm[1].toLocaleLowerCase('tr')) : null;
    if (hit && onCmd) { setText(''); onCmd(hit); return; }
    setBusy(true);
    const ok = await onSend(t, atts);
    setBusy(false);
    if (ok) { setText(''); setAtts([]); setWarn(null); }
  };
  const can = !!(text.trim() || atts.length) && !busy;
  // "/" yazınca botların komutları listelenir
  const slash = /^\/[\p{L}\p{N}_-]*$/u.test(text) && !!cmds?.length && !!onCmd ? text.slice(1).toLocaleLowerCase('tr') : null;
  const cmdList = slash === null ? [] : cmds!.filter(c => c.ad.startsWith(slash) || c.ad.includes(slash)).slice(0, 25);
  const mic = !!onVoice && !text.trim() && !atts.length;

  return (
    <View>
      {!!warn && <T style={{ paddingHorizontal: 18, paddingBottom: 6, fontSize: 13, color: '#f87171', fontFamily: F.bold }}>{warn}</T>}
      {cmdList.length > 0 && (
        <View style={{ marginHorizontal: 10, marginBottom: 4, maxHeight: 260, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong, overflow: 'hidden' }}>
          <T style={{ fontSize: 11.5, fontFamily: F.black, color: C.muted, letterSpacing: 0.6, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }}>BOT KOMUTLARI</T>
          <ScrollView keyboardShouldPersistTaps="handled">
            {cmdList.map(c => (
              <Pressable key={c.app + c.ad} accessibilityRole="button" accessibilityLabel={`/${c.ad} komutu, ${c.bot}`} onPress={() => { setText(''); onCmd!(c); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: pressed ? C.hover : 'transparent' })}>
                <Avatar name={c.bot} size={28} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T numberOfLines={1} style={{ fontFamily: F.heavy, fontSize: 14.5 }}>/{c.ad} {c.secenekler.map(o => <T key={o.ad} style={{ fontSize: 12.5, color: C.faint }}>{o.zorunlu ? `<${o.ad}> ` : `[${o.ad}] `}</T>)}</T>
                  <T numberOfLines={1} style={{ fontSize: 12.5, color: C.muted }}>{c.aciklama || c.bot}</T>
                </View>
                <T style={{ fontSize: 11.5, color: C.faint }}>{c.bot}</T>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
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
      {recOn ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: bottom }}>
          <IconButton label="Kaydı iptal et" bg={C.field} onPress={() => stopRec(true)}><Icon name="trash" color={C.danger} /></IconButton>
          <View accessibilityLiveRegion="polite" style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: C.field, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.danger }} />
            <T style={{ fontFamily: F.heavy, fontSize: 15 }}>{fmtDur(rs.durationMillis / 1000)}</T>
            <T numberOfLines={1} style={{ flex: 1, fontSize: 13, color: C.muted }}>Kaydediliyor{secure ? ' · şifreli gidecek' : ''}</T>
          </View>
          <IconButton label="Ses mesajını gönder" bg={C.accent} onPress={() => stopRec(false)}><Icon name="send" size={20} color={C.onAccent} stroke={2.6} /></IconButton>
        </View>
      ) : (
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
        {mic && !busy ? (
          <IconButton label="Sesli mesaj kaydet" bg={C.field} onPress={startRec}><Icon name="mic" size={21} color={C.ink} /></IconButton>
        ) : (
          <IconButton label="Gönder" bg={can ? C.accent : C.field} onPress={go}>
            {busy ? <ActivityIndicator color={can ? C.onAccent : C.accent} /> : <Icon name="send" size={20} color={can ? C.onAccent : C.faint} stroke={2.6} />}
          </IconButton>
        )}
      </View>
      )}

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
            {!!extras?.length && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {extras.map(a => (
                  <Pressable key={a.t} accessibilityRole="button" onPress={() => { setSheet(false); const t0 = text; if (a.takesText) setText(''); setTimeout(() => a.on(t0), Platform.OS === 'ios' ? 400 : 0); }}
                    style={({ pressed }) => ({ width: '31.5%', paddingVertical: 12, borderRadius: 12, alignItems: 'center', gap: 6, backgroundColor: pressed ? C.hover : C.card })}>
                    <T style={{ fontSize: 20 }}>{a.ic}</T><T style={{ fontFamily: F.heavy, fontSize: 12.5 }}>{a.t}</T>
                  </Pressable>
                ))}
              </View>
            )}
            {secure && <T style={{ fontSize: 12.5, color: C.muted, textAlign: 'center', marginTop: 4 }}>Bu sohbette dosyalar da cihazında şifrelenip gönderilir.</T>}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
