// Dependency-free tests: node test/judge.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { judgeAsset, pairwise, adherenceScore } = require('../src/judge');
const { contrastRatio } = require('../src/color');
const { retrieveRules } = require('../src/retrieve');

const ROOT = path.join(__dirname, '..');
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand-book', 'brand.json'), 'utf8'));
const load = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8'));

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log(`  ✓ ${name}`); };

t('contrast: black on white ≈ 21', () => assert.ok(contrastRatio('#000000', '#ffffff') > 20));

t('retrieve: pulls only exercised topics', () => {
  const rules = retrieveRules(load('a1_hero_compliant.json'), brand);
  const ids = rules.map((r) => r.id);
  assert.ok(ids.includes('R1')); // palette always
  assert.ok(ids.includes('R2')); // has text pairs
});

t('compliant hero → APPROVE, no violations', () => {
  const r = judgeAsset(load('a1_hero_compliant.json'), brand);
  assert.strictEqual(r.verdict, 'APPROVE');
  assert.strictEqual(r.violations.length, 0);
});

t('off-palette + banned words + arbitrary spacing → REJECT (multiple rules)', () => {
  const r = judgeAsset(load('a3_offcolor_violation.json'), brand);
  assert.strictEqual(r.verdict, 'REJECT');
  const rules = new Set(r.violations.map((v) => v.rule));
  assert.ok(rules.has('R1')); // off-palette
  assert.ok(rules.has('R3')); // 13px off scale
  assert.ok(rules.has('R5')); // Roboto + 3 fonts
  assert.ok(rules.has('R6')); // banned words
});

t('accent colour used as text → REJECT via R1', () => {
  const r = judgeAsset(load('a4_accent_misuse.json'), brand);
  assert.strictEqual(r.verdict, 'REJECT');
  assert.ok(r.violations.some((v) => v.rule === 'R1' && /accent/.test(v.detail)));
});

t('low contrast → REJECT via R2', () => {
  const r = judgeAsset(load('a5_low_contrast.json'), brand);
  assert.strictEqual(r.verdict, 'REJECT');
  assert.ok(r.violations.some((v) => v.rule === 'R2'));
});

t('pairwise: higher-contrast asset wins', () => {
  const a1 = load('a1_hero_compliant.json');
  const a2 = load('a2_card_compliant.json');
  const p = pairwise(a1, a2, brand);
  assert.ok(['a1_hero_compliant', 'a2_card_compliant'].includes(p.winner));
  assert.ok(adherenceScore(a1, brand) > 0 && adherenceScore(a2, brand) > 0);
});

console.log(`\n${pass} passed`);
