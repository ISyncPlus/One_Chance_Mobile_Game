import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'One Chance',
  slug: 'one-chance-mobile',
  version: '0.1.0',
  scheme: 'onechance',
  orientation: 'landscape',
  platforms: ['ios', 'android'],
  userInterfaceStyle: 'dark',
  ios: {
    supportsTablet: true,
    requireFullScreen: true,
    // Local development identity. Confirm the owner's namespace before distribution.
    bundleIdentifier: 'com.onechance.mobile',
    infoPlist: {
      'UISupportedInterfaceOrientations~ipad': [
        'UIInterfaceOrientationLandscapeLeft',
        'UIInterfaceOrientationLandscapeRight',
      ],
    },
  },
  android: { package: 'com.onechance.mobile' },
  plugins: ['expo-router', 'expo-sqlite', 'expo-status-bar', 'expo-font', './plugins/withQuotedBundleScript.cjs'],
  experiments: { typedRoutes: true },
};

export default config;
