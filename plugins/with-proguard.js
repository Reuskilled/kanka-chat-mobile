// R8 (release küçültme) WebRTC ve notifee sınıflarını silmesin diye keep kuralları.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RULES = `
# kanka: webrtc + notifee
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**
-keep class com.oney.WebRTCModule.** { *; }
-keep class app.notifee.** { *; }
-dontwarn app.notifee.**
-keep class com.zxcpoiu.incallmanager.** { *; }
# kanka: Room/WorkManager (notifee arka plan görevleri). R8 tam modda Room'un yansımayla
# oluşturduğu *_Impl veritabanı sınıfları silinince uygulama açılışta çöküyordu.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl { *; }
-keep class androidx.work.** { *; }
-dontwarn androidx.work.**
-keep class * implements androidx.startup.Initializer { <init>(); }
`;

module.exports = function withProguard(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!cur.includes('# kanka: Room/WorkManager')) fs.writeFileSync(file, cur.split('\n# kanka: webrtc')[0] + RULES);
      return cfg;
    },
  ]);
};
