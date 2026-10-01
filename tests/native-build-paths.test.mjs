import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import plugin from '../plugins/withQuotedBundleScript.cjs';

const original = '`"$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'"`';

test('native bundling invokes the script correctly from a workspace containing spaces', () => {
  const directory = mkdtempSync(join(tmpdir(), 'one chance build '));
  try {
    const packageDirectory = join(directory, 'node_modules/react-native');
    mkdirSync(join(packageDirectory, 'scripts'), { recursive: true });
    writeFileSync(join(packageDirectory, 'package.json'), '{"name":"react-native"}');
    writeFileSync(join(packageDirectory, 'scripts/react-native-xcode.sh'), '#!/bin/sh\nprintf "bundle-invoked"\n', { mode: 0o755 });
    const options = { cwd: directory, env: { ...process.env, NODE_BINARY: process.execPath }, encoding: 'utf8' };
    assert.notEqual(spawnSync('/bin/sh', ['-c', original], options).status, 0);
    const result = spawnSync('/bin/sh', ['-c', plugin.quoteBundleScript(original)], options);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'bundle-invoked');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('native quoting plugin is idempotent and fails on unknown templates', () => {
  const once = plugin.quoteBundleScript(original);
  assert.equal(plugin.quoteBundleScript(once), once);
  assert.throws(() => plugin.quoteBundleScript('different upstream template'));
});
