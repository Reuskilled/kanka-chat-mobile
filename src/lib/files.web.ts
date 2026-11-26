// Web önizlemesi için aynı arayüz (tarayıcı nesneleriyle)
export async function readBytes(uri: string): Promise<Uint8Array> { const r = await fetch(uri); return new Uint8Array(await r.arrayBuffer()); }
export async function saveTemp(_name: string, bytes: Uint8Array, mime?: string): Promise<string> {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime || 'application/octet-stream' }));
}
export async function openLocal(uri: string, _mime?: string, title?: string): Promise<void> {
  const a = document.createElement('a'); a.href = uri; a.download = title || 'dosya'; a.click();
}
