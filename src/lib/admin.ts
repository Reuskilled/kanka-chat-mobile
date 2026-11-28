// Sunucu yönetimi: yetki kontrolleri ve sitedekiyle aynı yetki adları/açıklamaları
import { ask, getState } from './kanka';
import { SERVER } from './config';
import type { Server } from './types';

export const PERMS: [string, string, string][] = [
  ['administrator', 'Yönetici', 'Her yetkiye sahip olur ve odalardaki tüm kısıtlamaları aşar. Sadece çok güvendiğin kişilere ver; bu yetkiyi sadece sunucu sahibi verebilir.'],
  ['manageServer', 'Sunucuyu yönet', 'Ad, simge, afiş, filtre, yavaş mod ve hoş geldin ekranını değiştirir'],
  ['manageRoles', 'Rolleri yönet', 'Kendinden düşük rolleri oluşturur, düzenler ve üyelere verir'],
  ['manageChannels', 'Odaları yönet', 'Oda ve kategori açar, siler, düzenler, izinlerini ayarlar'],
  ['manageEmojis', 'Emojileri yönet', 'Sunucuya özel emoji ekler ve siler'],
  ['manageWebhooks', 'Webhook\'ları yönet', 'Webhook oluşturur, düzenler, siler; dış servisleri odalara bağlar'],
  ['viewAudit', 'Kayıtları görüntüle', 'Sunucuda kimin ne değiştirdiğini görür'],
  ['manageMessages', 'Mesajları yönet', 'Başkalarının mesajını siler, sabitler, salt okunur odalara yazar'],
  ['pinMessages', 'Mesaj sabitle', 'Mesaj silme yetkisi olmadan her odada mesaj sabitleyip kaldırır'],
  ['slowBypass', 'Yavaş moddan etkilenme', 'Yavaş mod açık odalarda beklemeden yazar'],
  ['mentionEveryone', '@herkes ve tüm rolleri etiketle', '@herkes kullanır, etiketlenemez rolleri de etiketler'],
  ['kick', 'Üye at', 'Üyeleri sunucudan çıkarır (geri gelebilirler)'],
  ['ban', 'Üye yasakla', 'Üyeleri kalıcı olarak yasaklar'],
  ['timeout', 'Sustur (yazı)', 'Üyeleri bir süre yazamaz ve seslere giremez yapar, uyarı verir'],
  ['voiceMute', 'Seste sustur', 'Sesli odadaki birinin mikrofonunu kapatır, o açamaz'],
  ['voiceMove', 'Seste taşı ve çıkar', 'Sesli odadakileri başka odaya taşır ya da bağlantısını keser'],
  ['manageSounds', 'Ses panelini yönet', 'Ses paneline ses ekler, herkesin eklediği sesleri düzenler ve siler'],
];

export const isOwner = (s?: Server | null) => !!s && s.owner === getState().me;
export function can(s: Server | null | undefined, perm: string) {
  if (!s) return false;
  if (isOwner(s)) return true;
  const p = s.myPerms || [];
  return p.includes('administrator') || p.includes(perm);
}
// Sunucu ayarlarında görünecek bir şey var mı (yoksa çark simgesi hiç çıkmaz)
export const canAdmin = (s?: Server | null) => !!s && (isOwner(s) || ['manageServer', 'manageRoles', 'manageChannels', 'manageEmojis', 'manageWebhooks', 'manageSounds', 'kick', 'ban', 'timeout', 'viewAudit', 'manageMessages'].some(p => can(s, p)) || s.roles?.[getState().me || ''] === 'mod');
export const isMod = (s?: Server | null) => !!s && (isOwner(s) || s.roles?.[getState().me || ''] === 'mod' || can(s, 'administrator') || can(s, 'kick') || can(s, 'ban') || can(s, 'manageMessages'));

export const inviteUrl = (s: Server) => s.vanity ? `${SERVER}/${s.vanity}` : `${SERVER}/davet/${s.invite}`;
export const useServer = (id: string) => getState().servers.find(x => x.id === id) || null;

// Cevaplı istek: hata varsa metnini döndürür
export async function act(ev: string, payload: unknown): Promise<string | null> {
  const r = await ask<{ error?: string }>(ev, payload);
  return r?.error || null;
}

export const ROLE_COLORS = ['#99aab5', '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#e91e63', '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#d4ff00', '#607d8b'];
export const fmtAgo = (t: number) => {
  const m = Math.round((Date.now() - t) / 60e3);
  return m < 1 ? 'az önce' : m < 60 ? `${m} dk önce` : m < 1440 ? `${Math.round(m / 60)} saat önce` : `${Math.round(m / 1440)} gün önce`;
};
