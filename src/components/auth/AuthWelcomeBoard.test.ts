import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentSource = readFileSync(new URL('./AuthWelcomeBoard.tsx', import.meta.url), 'utf8');
const starFieldSource = readFileSync(new URL('./AuthStarField.tsx', import.meta.url), 'utf8');
const motionCss = readFileSync(new URL('../landing/landing-motion.css', import.meta.url), 'utf8');

test('auth board keeps every existing authentication action available', () => {
  assert.match(componentSource, /onAuthenticate\('email'\)/);
  assert.match(componentSource, /onAuthenticate\('github'\)/);
  assert.match(componentSource, /onAuthenticate\('google'\)/);
  assert.match(componentSource, /Sign In/);
  assert.match(componentSource, /Create Account/);
});

test('auth branding uses the restrained Workspace tagline', () => {
  assert.match(componentSource, /AI Knowledge Workspace/);
  assert.doesNotMatch(componentSource, /Operating System/);
});

test('auth motion is restrained and has reduced-motion coverage', () => {
  assert.match(componentSource, /<AuthStarField \/>/);
  assert.match(motionCss, /auth-board-enter 360ms/);
  assert.match(motionCss, /auth-board-float 5\.6s/);
  assert.match(motionCss, /auth-mark-rotate 18s/);
  assert.match(motionCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(starFieldSource, /prefers-reduced-motion: reduce/);
  assert.match(starFieldSource, /hover: hover.*pointer: fine/);
  assert.doesNotMatch(motionCss.match(/@keyframes auth-board-enter[\s\S]*?\n}/)?.[0] || '', /scale\(/);
});
