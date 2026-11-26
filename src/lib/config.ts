// Sunucu adresi. Geliştirirken EXPO_PUBLIC_KANKA_URL ile yerel sunucuya bağlanılabilir.
export const SERVER = (process.env.EXPO_PUBLIC_KANKA_URL || 'https://kankahq.com').replace(/\/+$/, '');

// Sunucuyla konuşma kurallarının sürümü. Sunucu ileride çok eski sürümlere "güncelle" diyebilsin diye gönderilir.
export const PROTOCOL = 1;
export const APP_VERSION = '2.0.0';

// /avatar/x.svg gibi göreli adresleri tam adrese çevir
export const abs = (u?: string | null) => (!u ? null : /^https?:\/\//.test(u) ? u : SERVER + (u.startsWith('/') ? u : '/' + u));
