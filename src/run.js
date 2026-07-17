// run.js — CLI: judge every asset, then rank the approved ones by pairwise adherence.
// Run: node src/run.js
'use strict';
const fs = require('fs');
const path = require('path');
const { judgeAsset, pairwise, adherenceScore } = require('./judge');

const ROOT = path.join(__dirname, '..');
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand-book', 'brand.json'), 'utf8'));
const dir = path.join(ROOT, 'assets');
const assets = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

console.log('== Asset-QA gate ==\n');
const results = assets.map((a) => judgeAsset(a, brand));
for (const r of results) {
  const tag = r.verdict === 'APPROVE' ? '✅' : '❌';
  console.log(`${tag} ${r.verdict.padEnd(7)} ${r.id}   (rules: ${r.rulesConsidered.join(',')})`);
  for (const v of r.violations) console.log(`     • [${v.rule}] ${v.detail}`);
}

const approvedIds = new Set(results.filter((r) => r.verdict === 'APPROVE').map((r) => r.id));
const approved = assets.filter((a) => approvedIds.has(a.id));

console.log(`\n${approvedIds.size}/${assets.length} approved · ${assets.length - approvedIds.size} rejected`);

if (approved.length >= 2) {
  console.log('\n== Pairwise ranking of approved assets (best adherence first) ==');
  const ranked = [...approved].sort((a, b) => adherenceScore(b, brand) - adherenceScore(a, brand));
  ranked.forEach((a, i) => console.log(`  ${i + 1}. ${a.id}  (score ${adherenceScore(a, brand).toFixed(2)})`));
  const [a, b] = ranked;
  const p = pairwise(a, b, brand);
  console.log(`  head-to-head winner: ${p.winner}`);
}

// exit non-zero if anything was rejected — this is a gate
process.exit(approvedIds.size === assets.length ? 0 : 1);
