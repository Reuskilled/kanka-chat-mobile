// Sesli odadayken uygulama arka plana atılsa da mikrofon ve ses kesilmesin diye Android "ön plan hizmeti" (foreground service).
// Notifee'nin hizmetini Android 14+ kuralına uygun olarak "microphone" türüyle işaretler ve gereken izinleri ekler.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withVoiceService(config) {
  return withAndroidManifest(config, cfg => {
    const m = cfg.modResults.manifest;
    m.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const perms = (m['uses-permission'] ||= []);
    for (const p of ['android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MICROPHONE', 'android.permission.WAKE_LOCK', 'android.permission.BLUETOOTH_CONNECT']) {
      if (!perms.some(x => x.$['android:name'] === p)) perms.push({ $: { 'android:name': p } });
    }
    const app = m.application[0];
    const svcs = (app.service ||= []).filter(s => s.$['android:name'] !== 'app.notifee.core.ForegroundService');
    svcs.push({ $: { 'android:name': 'app.notifee.core.ForegroundService', 'android:exported': 'false', 'android:foregroundServiceType': 'microphone', 'tools:replace': 'android:foregroundServiceType' } });
    app.service = svcs;
    return cfg;
  });
};
