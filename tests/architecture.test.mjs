import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import { auditArchitecture, inspectSource } from '../scripts/architecture.mjs';

const root = resolve('.');
const engineFile = resolve(root, 'src/game/engine/example.ts');

test('all project sources respect architecture boundaries', () => {
  assert.deepEqual(auditArchitecture(), []);
});

test('pure layer rejects platform packages, type imports, re-exports, and relative escapes', () => {
  for (const source of [
    'import React from "react";',
    'import type { StoreApi } from "zustand";',
    'export * from "expo-sqlite";',
    'import("react-native");',
    'import("node:fs");',
    'type X = import("expo").ExpoConfig;',
    'import "../../persistence/initializeDatabase";',
    'const x = require("react");',
    'import(variable);',
  ]) assert.ok(inspectSource(engineFile, source, root).length > 0, source);
});

test('pure layer permits local domain imports', () => {
  assert.deepEqual(inspectSource(engineFile, 'import type { RuleSource } from "../content/provenance";', root), []);
});

test('pure layer rejects JSX and ambient platform references', () => {
  assert.ok(inspectSource(engineFile.replace('.ts', '.tsx'), 'const x = <View />;', root).length > 0);
  assert.ok(inspectSource(engineFile, '/// <reference types="react-native" />', root).length > 0);
});

test('production modules cannot import diagnostic geometry', () => {
  assert.ok(inspectSource(resolve(root, 'src/rendering/board/scene.ts'), 'import "../../diagnostics/geometry";', root).length > 0);
});

test('presentation cannot bypass application services', () => {
  assert.ok(inspectSource(resolve(root, 'src/ui/Example.ts'), 'import "../game/engine/resolve";', root).length > 0);
});

test('pure layer rejects ambient time, randomness, platform access and aliases', () => {
  for (const source of [
    'Math.random();', 'const random = Math.random;', 'const { random: draw } = Math;',
    'const math = Math; math.random();', 'Math[method]();', 'Math["random"]();',
    'Date.now();', 'const Clock = Date;', 'new Date();', 'performance.now();',
    'crypto.getRandomValues(words);', 'setTimeout(action, 1);', 'fetch("url");',
    'globalThis["Math"]["random"]();', 'process.env.SEED;',
  ]) assert.ok(inspectSource(engineFile, source, root).length > 0, source);
});

test('pure layer permits explicitly deterministic arithmetic', () => {
  assert.deepEqual(inspectSource(engineFile, 'const result = Math.imul(5, 7); const n = Math.floor(4 / 2);', root), []);
});

test('balance construction is restricted to the central economy subsystem', () => {
  for (const source of ['const account = { balanceUnits: 100 };', 'const account = { "balanceUnits": 100 };']) {
    assert.ok(inspectSource(engineFile, source, root).length > 0);
    assert.deepEqual(inspectSource(resolve(root, 'src/game/economy/transactions.ts'), source, root), []);
  }
  assert.deepEqual(inspectSource(engineFile, 'const balance = account.balanceUnits;', root), []);
});
