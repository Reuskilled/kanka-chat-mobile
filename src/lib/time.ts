const pad = (n: number) => String(n).padStart(2, '0');
const GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

// Liste için kısa zaman: bugün 21:48, dün "Dün", bu hafta "Pzt", sonrası 12.11
export function when(t: number) {
  const d = new Date(t), n = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(n) - day(d)) / 864e5);
  if (diff <= 0) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (diff === 1) return 'Dün';
  if (diff < 7) return GUN[d.getDay()];
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

export const clock = (t: number) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export function dayLabel(t: number) {
  const d = new Date(t), n = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, n)) return 'Bugün';
  const y = new Date(n); y.setDate(n.getDate() - 1); if (same(d, y)) return 'Dün';
  const tm = new Date(n); tm.setDate(n.getDate() + 1); if (same(d, tm)) return 'Yarın';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric' });
}
