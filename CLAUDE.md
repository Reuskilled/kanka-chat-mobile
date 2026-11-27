# Kanka Chat telefon uygulaması: Claude için devir notu

Genel proje bilgisi, kullanıcıyla çalışma kuralları ve bekleyen işler **`Reuskilled/kanka-chat` reposundaki `CLAUDE.md`'de**; önce onu oku. Bu dosya sadece telefon uygulamasına özel olanları anlatır.
Son güncelleme: 27 Kasım 2026.

## Yapı
- Expo SDK 58, React Native 0.88, Expo Router, TypeScript. Ekranlar `src/app/`, ortak kod `src/lib/`, bileşenler `src/components/`.
- Sunucuyla Socket.IO; durum `src/lib/kanka.ts` (`useKanka`). Sunucu yönetimi ekranları `src/app/sunucu/[id]/` (`AdminUI.tsx` bileşenleriyle).
- Platforma özel dosyalar: `play.ts` / `play.ios.ts` / `play.web.ts`, `files.ts` / `files.web.ts`, `rtc.ts` / `rtc.web.ts`, `VideoView(.web).tsx`.
- Önemli kütüphaneler: react-native-webrtc, InCallManager, notifee (sadece Android), expo-audio, expo-file-system, expo-iap.

## Kontroller
```bash
npx tsc --noEmit
EXPO_OFFLINE=1 npx expo lint          # 7 uyarı, 0 hata normal
# Web önizlemesiyle test (yerel sunucu 3313'te açıkken):
EXPO_PUBLIC_KANKA_URL=http://localhost:3313 npx expo export --platform web --output-dir /tmp/kmweb
npx serve -s /tmp/kmweb -l 8099
```

## Derleme ve yayın (GitHub Actions)
- **Android** (`android.yml`): Her push'ta çalışır. `versionCode = 100 + run_number`, sürüm `2.0.0.<run>`. APK (arm64) ve AAB'yi `android-v<sürüm>` release'ine koyar. Sırlar tanımlı değilse test anahtarıyla imzalar; Play bunu kabul etmez.
- **Çökme testi** (`cokme.yml`): Her başarılı Android derlemesinden sonra AAB'den APK üretir, emülatörde açar, 25 saniye ayakta mı diye bakar; çökerse iş kırmızı olur. Elle de tetiklenebilir.
- **iOS** (`ios.yml`): macOS'ta Xcode 26.6. Sır yoksa imzasız simülatör derlemesi. Sırlar varsa imzalı IPA ve TestFlight. `buildNumber = 100 + run_number`.
- **Play'e yükleme şimdiye kadar elle yapıldı:** CI'ın AAB'si, kullanıcının yükleme anahtarıyla (SHA-256 `47:54:5D:AA:…:95:67`) imzalanıp kullanıcıya verildi. Play'deki son sürüm 2.0.0.20. Sırlar GitHub'a eklenince CI doğrudan doğru imzalı AAB üretir.

## Bilinen tuzaklar
- **R8 sınıf siliyor:** `plugins/with-proguard.js` keep kuralları içeriyor (webrtc, InCallManager, Room/WorkManager). WorkManager kuralı yokken 2.0.0.17 telefonda açılışta çöktü. Yeni yerel kütüphane eklersen çökme testine bak.
- **iOS bildirim verisi:** `content.data` yerine `trigger.payload` içinde gelir.
- **Web önizlemesi:** RN-web'de `Alert` çalışmıyor; `webAlert.web.ts` onu `confirm`/`alert`'e çeviriyor.
- **Henüz yapılmadı:** iOS ekran paylaşımı (broadcast extension gerekiyor). CallKit de TestFlight'ta cihaz testinden sonraya kaldı.
