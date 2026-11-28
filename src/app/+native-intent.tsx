// Uygulama bir linkle açılınca: davet linkleri sunucu önizlemesine, site linkleri ilgili ekrana gider
// kankahq.com/davet/KOD · kankahq.com/app?davet=KOD · kankahq.com/s/isim · kanka://davet/KOD
const SITE = /^https?:\/\/(?:www\.)?kankahq\.com/i;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const p = path.replace(SITE, '').replace(/^kanka:\/\//i, '/');
    if (/^\/?expo-sharing/i.test(p)) return '/expo-sharing';
    const inv = /^\/?(?:davet\/|app\?(?:.*&)?davet=)([A-Za-z0-9_-]{3,40})/i.exec(p);
    if (inv) return `/sunucu-ekle?kod=${encodeURIComponent(inv[1])}`;
    const vanity = /^\/?s\/([a-z0-9-]{2,40})\/?$/i.exec(p);
    if (vanity) return `/sunucu-ekle?kod=${encodeURIComponent('kankahq.com/' + vanity[1].toLowerCase())}`;
    if (SITE.test(path)) {
      // kankahq.com/isim özel davet linki olabilir
      const v = /^\/([a-z0-9-]{2,40})\/?$/i.exec(p);
      if (v && !['app', 'davet', 'indir', 'giris', 'kayit', 'yardim', 'blog'].includes(v[1].toLowerCase())) return `/sunucu-ekle?kod=${encodeURIComponent('kankahq.com/' + v[1].toLowerCase())}`;
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}
