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
`;

module.exports = function withProguard(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!cur.includes('# kanka: webrtc')) fs.writeFileSync(file, cur + RULES);
      return cfg;
    },
  ]);
};
