import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const svg = readFileSync(new URL('../../../public/brand/lumora-orbit-mark.svg', import.meta.url), 'utf8');
const brandComponent = readFileSync(new URL('./LumoraBrand.tsx', import.meta.url), 'utf8');
const documentSource = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

test('Lumora mark has eight evenly spaced nodes around the exact center', () => {
  const nodes = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="2\.2"\/>/g)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));

  assert.equal(nodes.length, 8);
  const angles = nodes
    .map(({ x, y }) => {
      assert.ok(Math.abs(Math.hypot(x - 50, y - 50) - 30) < 0.002);
      return (Math.atan2(y - 50, x - 50) + Math.PI * 2) % (Math.PI * 2);
    })
    .sort((a, b) => a - b);

  for (let index = 0; index < angles.length; index += 1) {
    const next = index === angles.length - 1 ? angles[0] + Math.PI * 2 : angles[index + 1];
    assert.ok(Math.abs(next - angles[index] - Math.PI / 4) < 0.0001);
  }
  assert.match(svg, /viewBox="0 0 100 100"/);
  assert.match(svg, /<circle cx="50" cy="50" r="4"/);
});

test('brand component and favicon share the single SVG source', () => {
  assert.match(brandComponent, /lumora-orbit-mark\.svg/);
  assert.doesNotMatch(brandComponent, /lumora-orbit-mark\.png/);
  assert.match(documentSource, /type="image\/svg\+xml" href="\/brand\/lumora-orbit-mark\.svg"/);
});
