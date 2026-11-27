// iOS: derleme makinesinde (CI) sadece uygulama hedefini elle imzalama ayarlarıyla imzala (Pod hedeflerine dokunmaz).
// Ortam değişkenleri yoksa (yerel prebuild, web) hiçbir şey yapmaz.
const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withIosSigning(config) {
  return withXcodeProject(config, cfg => {
    const team = process.env.IOS_TEAM_ID, profile = process.env.IOS_PROFILE_NAME;
    if (!team || !profile) return cfg;
    const proj = cfg.modResults, name = cfg.modRequest.projectName;
    const targets = proj.pbxNativeTargetSection();
    for (const key of Object.keys(targets)) {
      const t = targets[key];
      if (typeof t !== 'object' || String(t.name).replace(/"/g, '') !== name) continue;
      const list = proj.pbxXCConfigurationList()[t.buildConfigurationList];
      for (const ref of list.buildConfigurations) {
        const bc = proj.pbxXCBuildConfigurationSection()[ref.value];
        const s = bc.buildSettings;
        s.DEVELOPMENT_TEAM = team;
        s.CODE_SIGN_STYLE = 'Manual';
        s.CODE_SIGN_IDENTITY = '"Apple Distribution"';
        s['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'] = '"Apple Distribution"';
        s.PROVISIONING_PROFILE_SPECIFIER = `"${profile}"`;
      }
    }
    return cfg;
  });
};
