// retrieve.js — the "RAG" step: pull the brand-book rules relevant to a given asset.
// A real deployment embeds each rule and does vector similarity; here we retrieve by
// the topics an asset actually exercises, which is deterministic and easy to audit.
// The judge only reasons over retrieved rules — same contract as an LLM-judge-over-RAG.
'use strict';

function topicsForAsset(asset) {
  const t = new Set(['palette', 'tone']); // every asset is judged on palette + tone
  if (asset.text_pairs && asset.text_pairs.length) t.add('contrast');
  if (asset.spacing_px && asset.spacing_px.length) t.add('spacing');
  if (asset.radius_px && asset.radius_px.length) t.add('radius');
  if (asset.fonts && asset.fonts.length) t.add('typography');
  return t;
}

// Retrieve the rule objects whose topic the asset exercises (the "context" for the judge).
function retrieveRules(asset, brand) {
  const topics = topicsForAsset(asset);
  return brand.rules.filter((r) => topics.has(r.topic));
}

module.exports = { retrieveRules, topicsForAsset };
