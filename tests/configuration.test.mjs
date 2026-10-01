import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import config from '../app.config.ts';

const require = createRequire(import.meta.url);
const { IOSConfig, AndroidConfig } = require('expo/config-plugins');

test('native iPhone and iPad orientation generation stays landscape-only', () => {
  let plist = { ...config.ios.infoPlist };
  plist = IOSConfig.Orientation.setOrientation(config, plist);
  plist = IOSConfig.RequiresFullScreen.setRequiresFullScreen(config, plist);
  assert.equal(plist.UIRequiresFullScreen, true);
  const expected = ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'];
  assert.deepEqual(plist.UISupportedInterfaceOrientations, expected);
  assert.deepEqual(plist['UISupportedInterfaceOrientations~ipad'], expected);
});

test('Android main activity receives the landscape lock', () => {
  const manifest = { manifest: { application: [{ $: {}, activity: [{ $: { 'android:name': '.MainActivity' } }] }] } };
  const result = AndroidConfig.Orientation.setAndroidOrientation(config, manifest);
  assert.equal(result.manifest.application[0].activity[0].$['android:screenOrientation'], 'landscape');
});
