// Telefondan ekran paylaşımı (Android 14+): react-native-webrtc'nin kendi MediaProjection servisini açar ve iznini ekler
const { withMainApplication, withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withScreenShare(config) {
  config = withMainApplication(config, cfg => {
    let s = cfg.modResults.contents;
    if (!s.includes('WebRTCModuleOptions')) {
      s = s.replace(/(import android\.app\.Application\n)/, '$1import com.oney.WebRTCModule.WebRTCModuleOptions\n');
      s = s.replace(/(super\.onCreate\(\)\n)/, '$1    WebRTCModuleOptions.getInstance().enableMediaProjectionService = true\n');
    }
    cfg.modResults.contents = s;
    return cfg;
  });
  return withAndroidManifest(config, cfg => {
    AndroidConfig.Permissions.ensurePermissions(cfg.modResults, ['android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION']);
    return cfg;
  });
};
