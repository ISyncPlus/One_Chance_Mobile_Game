import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

const bundles = files(resolve('dist')).filter((file) => file.endsWith('.js'));
assert.ok(bundles.length >= 2, 'Expected iOS and Android JavaScript exports; use expo export --platform all --no-bytecode');
for (const file of bundles) {
  const source = readFileSync(file, 'utf8');
  for (const marker of ['RENDERING LAB', 'TOKEN HIT', 'Capturing 10 seconds', 'WORLD 960']) {
    assert.equal(source.includes(marker), false, `Development diagnostic leaked into ${file}: ${marker}`);
  }
}
console.log(`Release isolation passed for ${bundles.length} bundles.`);
