# Kanka Mobil

Kanka Chat'in Android (ve sonra iOS) uygulaması. React Native + Expo (SDK 58), TypeScript, Expo Router.
Sunucu: [kanka-chat](https://github.com/Reuskilled/kanka-chat) — uygulama onunla socket.io üzerinden konuşur.

## Geliştirme

```bash
npm install
npm run typecheck
# Yerel sunucuya bağlan (kanka-chat: PORT=3313 node server.js)
EXPO_PUBLIC_KANKA_URL=http://<bilgisayarın-ip>:3313 npx expo start
```

Web önizlemesi (sadece hızlı deneme için): `EXPO_PUBLIC_KANKA_URL=http://localhost:3313 npx expo export --platform web`.

## Klasörler

- `src/app/` — ekranlar (Expo Router). `(tabs)/` alt sekmeler: Sunucular, Mesajlar, Bildirimler, Sen. `kanal/[id]` kanal ve DM sohbeti.
- `src/lib/kanka.ts` — sunucu bağlantısı, oturum (token telefonda şifreli depoda), gelen olaylar ve ortak durum.
- `src/components/` — ortak parçalar (avatar, ikonlar, mesaj satırı, butonlar).

## Derleme

`main`'e her gönderimde GitHub Actions Android APK ve AAB derler, Releases'a koyar (`.github/workflows/android.yml`).
`android/` ve `ios/` klasörleri depoda tutulmaz, derlemede `expo prebuild` ile üretilir.

Sırlar (Settings → Secrets → Actions):
- `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASS`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASS` — Google Play yükleme anahtarı. Yoksa derleme test anahtarıyla imzalanır (telefona kurulur, Play'e yüklenmez).
- `GOOGLE_SERVICES_JSON` — Firebase (telefon bildirimleri).

Paket adı `com.kanka.chat`: Play'deki mevcut uygulamanın güncellemesi olarak çıkar. Sürüm kodu 100'den başlar.

## Yol haritası

1. Çekirdek: giriş/kayıt, sunucular ve kanallar, sohbet, DM'ler, bildirimler, profil ← şu an
2. Uçtan uca şifreli DM'ler (webdekiyle birebir uyumlu), telefon bildirimleri, dosya/fotoğraf gönderme
3. Ses: sesli odalar, birebir arama, arka planda ses
4. Yönetim: sunucu ayarları, roller, moderasyon
5. Ekstralar: Spark ve Market, Arena
