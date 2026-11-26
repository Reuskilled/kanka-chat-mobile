// Sunucu FCM bildirimlerinde Android ikonu olarak "ic_stat_kanka" adını gönderiyor (eski uygulamayla aynı).
// Bu eklenti bildirim ikonunu o adla Android kaynaklarına koyar; yoksa bildirimde beyaz kare çıkar.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withStatIcon(config, { icon = './assets/bildirim-ikonu.png' } = {}) {
  return withDangerousMod(config, ['android', async cfg => {
    const src = path.join(cfg.modRequest.projectRoot, icon);
    const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, path.join(dir, 'ic_stat_kanka.png'));
    return cfg;
  }]);
};
