// Cihazdaki dosyalar (telefon): okuma, geçici kaydetme, sistemin görüntüleyicisiyle açma
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function readBytes(uri: string): Promise<Uint8Array> {
  if (/^(https?|data|blob):/.test(uri)) { const r = await fetch(uri); return new Uint8Array(await r.arrayBuffer()); }
  return new File(uri).bytes();
}

const safe = (n: string) => (n.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(-80) || 'dosya');

// Çözülen dosyalar önbellek klasörüne yazılır (sistem yer gerekince siler)
export async function saveTemp(name: string, bytes: Uint8Array, _mime?: string): Promise<string> {
  const f = new File(Paths.cache, `k${Date.now().toString(36)}-${safe(name)}`);
  f.create({ overwrite: true });
  await f.write(bytes);
  return f.uri;
}

export async function openLocal(uri: string, mime?: string, title?: string): Promise<void> {
  const f = new File(uri);
  try { await f.preview({ title, mimeType: mime }); return; } catch { /* açacak uygulama yoksa paylaş menüsü */ }
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: title });
  else throw new Error('Bu dosyayı açacak uygulama yok');
}

// Dosyayı paylaş menüsüyle dışarı ver (indir, Drive'a kaydet, gönder)
export async function shareLocal(uri: string, mime?: string, title?: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Bu telefonda paylaşma açık değil');
  await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: title });
}
