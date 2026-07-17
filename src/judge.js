// judge.js — the asset-QA gate. Two judgements, both grounded ONLY in retrieved rules:
//   • binary verdict  : does this asset comply with the brand book? (APPROVE/REJECT + reasons)
//   • pairwise compare : given two compliant assets, which adheres better? (for ranking)
//
// In production the binary verdict is an LLM judge reading the retrieved rules + a render
// of the asset; here the same contract is implemented deterministically so the harness is
// testable and reproducible. The LLM slots in behind the exact same interface.
'use strict';

const { contrastRatio } = require('./color');
const { retrieveRules } = require('./retrieve');

function judgeAsset(asset, brand) {
  const rules = retrieveRules(asset, brand);
  const topics = new Set(rules.map((r) => r.topic));
  const violations = [];

  // R1 — palette membership + accent misuse
  if (topics.has('palette')) {
    const allowed = new Set(brand.palette.allowed_hex.map((h) => h.toLowerCase()));
    for (const c of asset.colors || []) {
      if (!allowed.has(c.toLowerCase())) violations.push({ rule: 'R1', detail: `off-palette colour ${c}` });
    }
    const accentOnly = new Set(brand.palette.accent_only_hex.map((h) => h.toLowerCase()));
    const usedAsBaseText = asset.accent_used_as === 'text' || asset.accent_used_as === 'background';
    const usesAccent = (asset.colors || []).some((c) => accentOnly.has(c.toLowerCase()));
    if (usesAccent && usedAsBaseText) violations.push({ rule: 'R1', detail: `accent colour used as ${asset.accent_used_as}` });
  }

  // R2 — contrast
  if (topics.has('contrast')) {
    for (const p of asset.text_pairs || []) {
      const ratio = contrastRatio(p.fg, p.bg);
      if (ratio < brand.palette.text_min_contrast_ratio) {
        violations.push({ rule: 'R2', detail: `contrast ${ratio.toFixed(2)} < ${brand.palette.text_min_contrast_ratio} (${p.fg} on ${p.bg})` });
      }
    }
  }

  // R3 — spacing scale
  if (topics.has('spacing')) {
    const scale = new Set(brand.spacing_scale_px);
    for (const s of asset.spacing_px || []) if (!scale.has(s)) violations.push({ rule: 'R3', detail: `off-scale spacing ${s}px` });
  }

  // R4 — radius scale
  if (topics.has('radius')) {
    const scale = new Set(brand.radius_scale_px);
    for (const r of asset.radius_px || []) if (!scale.has(r)) violations.push({ rule: 'R4', detail: `off-scale radius ${r}px` });
  }

  // R5 — typography
  if (topics.has('typography')) {
    const allowed = new Set(brand.typography.allowed_fonts);
    for (const f of asset.fonts || []) if (!allowed.has(f)) violations.push({ rule: 'R5', detail: `unapproved font ${f}` });
    if ((asset.fonts || []).length > brand.typography.max_font_families_per_asset) {
      violations.push({ rule: 'R5', detail: `${asset.fonts.length} font families > ${brand.typography.max_font_families_per_asset}` });
    }
  }

  // R6 — tone
  if (topics.has('tone')) {
    const copy = (asset.copy || '').toLowerCase();
    for (const w of brand.tone.banned_words) if (copy.includes(w.toLowerCase())) violations.push({ rule: 'R6', detail: `banned phrase "${w}"` });
  }

  return {
    id: asset.id,
    verdict: violations.length === 0 ? 'APPROVE' : 'REJECT',
    violations,
    rulesConsidered: rules.map((r) => r.id),
  };
}

// Adherence score for ranking compliant assets: reward headroom above the contrast floor
// and staying well inside the palette. Deterministic stand-in for a pairwise LLM judge.
function adherenceScore(asset, brand) {
  let score = 0;
  for (const p of asset.text_pairs || []) score += Math.min(contrastRatio(p.fg, p.bg), 21);
  const allowed = new Set(brand.palette.allowed_hex.map((h) => h.toLowerCase()));
  const onPalette = (asset.colors || []).filter((c) => allowed.has(c.toLowerCase())).length;
  score += onPalette;
  return score;
}

// Pairwise: which of two assets adheres better? Returns the winner's id (or 'tie').
function pairwise(a, b, brand) {
  const sa = adherenceScore(a, brand);
  const sb = adherenceScore(b, brand);
  if (Math.abs(sa - sb) < 1e-9) return { winner: 'tie', scores: { [a.id]: sa, [b.id]: sb } };
  return { winner: sa > sb ? a.id : b.id, scores: { [a.id]: sa, [b.id]: sb } };
}

module.exports = { judgeAsset, adherenceScore, pairwise };
