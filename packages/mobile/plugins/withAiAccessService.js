const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

// AI Access keeps its MCP server running in the background on Android with
// react-native-background-actions' foreground service. Android 14+ needs the
// service's type declared, matching the foregroundServiceType it's started with.
const SERVICE_NAME = "com.asterinet.react.bgactions.RNBackgroundActionsTask";

module.exports = function withAiAccessService(config) {
  return withAndroidManifest(config, mod => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    const services = application.service ?? [];

    application.service = [
      ...services.filter(s => s.$["android:name"] !== SERVICE_NAME),
      {
        $: {
          "android:name": SERVICE_NAME,
          "android:foregroundServiceType": "dataSync",
          "android:exported": "false"
        }
      }
    ];

    return mod;
  });
};
