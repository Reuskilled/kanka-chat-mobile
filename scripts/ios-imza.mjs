// iOS imzalama hazırlığı (GitHub Actions macOS makinesinde çalışır). Mac'e ve Xcode arayüzüne gerek bırakmaz.
// App Store Connect API anahtarıyla: uygulama kimliğini (bundle ID) ve yetkilerini hazırlar, dağıtım sertifikasını
// (bizim özel anahtarımıza ait olanı) bulur ya da oluşturur, App Store profilini bulur ya da oluşturur ve dosyalara yazar.
// Gerekenler (GitHub sırları): ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY (.p8 içeriği), IOS_DIST_KEY (dağıtım özel anahtarı, PEM)
// Kullanım: node scripts/ios-imza.mjs <çıktı klasörü>
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BUNDLE = process.env.IOS_BUNDLE || 'com.kanka.chat';
const PROFILE_NAME = process.env.IOS_PROFILE_NAME || 'Kanka Chat App Store (CI)';
const out = process.argv[2] || 'imza';
const need = k => { const v = process.env[k]; if (!v) { console.error(`Eksik sır: ${k}`); process.exit(2); } return v; };
const KEY_ID = need('ASC_KEY_ID'), ISSUER = need('ASC_ISSUER_ID'), P8 = need('ASC_KEY').replace(/\\n/g, '\n'), DIST = need('IOS_DIST_KEY').replace(/\\n/g, '\n');
fs.mkdirSync(out, { recursive: true });

const b64u = b => Buffer.from(b).toString('base64url');
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })), p = b64u(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' }));
  const s = crypto.sign('sha256', Buffer.from(h + '.' + p), { key: P8, dsaEncoding: 'ieee-p1363' });
  return h + '.' + p + '.' + b64u(s);
}
async function api(method, url, body) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + url, { method, headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = {}; try { j = t ? JSON.parse(t) : {}; } catch {}
  if (!r.ok) { const e = (j.errors || []).map(x => `${x.title}: ${x.detail}`).join(' | ') || t.slice(0, 300); throw new Error(`${method} ${url.split('?')[0]} → ${r.status} ${e}`); }
  return j;
}

// 1) Uygulama kimliği ve yetkileri (In-App Purchase varsayılan olarak açıktır)
let bid = (await api('GET', `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE)}&filter[platform]=IOS&limit=5`)).data?.find(x => x.attributes.identifier === BUNDLE);
if (!bid) { bid = (await api('POST', '/v1/bundleIds', { data: { type: 'bundleIds', attributes: { identifier: BUNDLE, name: 'Kanka Chat', platform: 'IOS' } } })).data; console.log('Uygulama kimliği oluşturuldu:', BUNDLE); }
else console.log('Uygulama kimliği var:', BUNDLE);
const caps = (await api('GET', `/v1/bundleIds/${bid.id}/bundleIdCapabilities`)).data.map(x => x.attributes.capabilityType);
for (const c of ['PUSH_NOTIFICATIONS', 'ASSOCIATED_DOMAINS']) {
  if (caps.includes(c)) continue;
  await api('POST', '/v1/bundleIdCapabilities', { data: { type: 'bundleIdCapabilities', attributes: { capabilityType: c }, relationships: { bundleId: { data: { type: 'bundleIds', id: bid.id } } } } });
  console.log('Yetki açıldı:', c);
}

// 2) Dağıtım sertifikası: bizim özel anahtarımızın açık anahtarıyla eşleşen
const myPub = crypto.createPublicKey(DIST).export({ type: 'spki', format: 'der' }).toString('base64');
const certs = (await api('GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=200')).data || [];
let cert = certs.find(c => { try { return new crypto.X509Certificate(Buffer.from(c.attributes.certificateContent, 'base64')).publicKey.export({ type: 'spki', format: 'der' }).toString('base64') === myPub; } catch { return false; } });
if (!cert) {
  const keyFile = path.join(out, 'dist.key'); fs.writeFileSync(keyFile, DIST, { mode: 0o600 });
  const csr = execFileSync('openssl', ['req', '-new', '-key', keyFile, '-subj', '/CN=Kanka Chat CI/O=Kanka/C=TR'], { encoding: 'utf8' });
  fs.rmSync(keyFile);
  try { cert = (await api('POST', '/v1/certificates', { data: { type: 'certificates', attributes: { certificateType: 'DISTRIBUTION', csrContent: csr } } })).data; }
  catch (e) { if (/maximum|limit/i.test(e.message)) console.error('Apple dağıtım sertifikası sınırına ulaşılmış. developer.apple.com › Certificates bölümünden kullanılmayan bir "Apple Distribution" sertifikasını iptal et.'); throw e; }
  console.log('Dağıtım sertifikası oluşturuldu, bitiş:', cert.attributes.expirationDate);
} else console.log('Dağıtım sertifikası var, bitiş:', cert.attributes.expirationDate);
fs.writeFileSync(path.join(out, 'dist.cer'), Buffer.from(cert.attributes.certificateContent, 'base64'));

// 3) App Store profili: bu sertifikayı içeren, geçerli olan; yoksa yenisi
const profs = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}&include=certificates,bundleId&limit=20`);
let prof = (profs.data || []).find(p => p.attributes.profileState === 'ACTIVE' && p.relationships?.certificates?.data?.some(c => c.id === cert.id) && p.relationships?.bundleId?.data?.id === bid.id
  && Date.parse(p.attributes.expirationDate) > Date.now() + 7 * 864e5);
if (!prof) {
  for (const p of profs.data || []) { try { await api('DELETE', `/v1/profiles/${p.id}`); console.log('Eski profil silindi'); } catch {} }
  prof = (await api('POST', '/v1/profiles', { data: { type: 'profiles', attributes: { name: PROFILE_NAME, profileType: 'IOS_APP_STORE' },
    relationships: { bundleId: { data: { type: 'bundleIds', id: bid.id } }, certificates: { data: [{ type: 'certificates', id: cert.id }] } } } })).data;
  console.log('App Store profili oluşturuldu');
} else console.log('App Store profili var');
fs.writeFileSync(path.join(out, 'profil.mobileprovision'), Buffer.from(prof.attributes.profileContent, 'base64'));
fs.writeFileSync(path.join(out, 'profil.json'), JSON.stringify({ name: prof.attributes.name, uuid: prof.attributes.uuid, bundle: BUNDLE }));
console.log('Hazır:', prof.attributes.name, prof.attributes.uuid);
