import assert from 'node:assert/strict';
import test from 'node:test';

import { fitWorld, screenToWorld, worldToScreen, zoomAt } from '../src/rendering/camera/coordinates.ts';
import { containsCircle } from '../src/input/hitTesting.ts';

function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }

test('world/screen inversion survives translations, zoom and negative coordinates', () => {
  for (const scale of [0.15, 0.5, 1, 2.75, 4]) {
    for (const offset of [-1200, 0, 387.5]) {
      const camera = { x: offset, y: -offset / 3, scale };
      for (const point of [{ x: 0, y: 0 }, { x: 720, y: 240 }, { x: -37, y: 965 }]) {
        const result = screenToWorld(worldToScreen(point, camera), camera);
        near(result.x, point.x); near(result.y, point.y);
      }
    }
  }
});

test('zoom preserves the world point under the focal point', () => {
  const camera = { x: -300, y: 80, scale: 1.3 };
  const anchor = { x: 423, y: 159 };
  const before = screenToWorld(anchor, camera);
  const after = screenToWorld(anchor, zoomAt(camera, anchor, 3.5));
  near(before.x, after.x); near(before.y, after.y);
});

test('fit stays centered and within phone and tablet viewports', () => {
  for (const [width, height] of [[568, 160], [932, 250], [1366, 850]]) {
    const camera = fitWorld(width, height, 960, 480);
    const origin = worldToScreen({ x: 0, y: 0 }, camera);
    const end = worldToScreen({ x: 960, y: 480 }, camera);
    assert.ok(origin.x >= 0 && origin.y >= 0 && end.x <= width && end.y <= height);
    near(origin.x, width - end.x); near(origin.y, height - end.y);
  }
});

test('transformed token hit testing uses current animated world position', () => {
  const camera = { x: -190, y: 73, scale: 2.7 };
  const center = { x: 503, y: 240 };
  for (const [dx, hit] of [[0, true], [27, true], [28, true], [28.1, false], [80, false]]) {
    const touch = worldToScreen({ x: center.x + dx, y: center.y }, camera);
    assert.equal(containsCircle(screenToWorld(touch, camera), center, 28), hit);
  }
});
