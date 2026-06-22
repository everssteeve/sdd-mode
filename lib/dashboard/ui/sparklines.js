// @spec SPEC-016-1-architecture-4-couches
// @intent INTENT-016

import { escape } from './helpers.js';

// Mini-distribution barrée (statuts SPEC/Intent par catégorie).
export function distributionBar(parts) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return '<div class="dist-bar empty"></div>';
  const segs = parts.filter((p) => p.value > 0).map((p) => `<span class="dist-seg ${p.cls}" style="width:${(p.value / total) * 100}%" title="${escape(p.label)} : ${p.value}">${p.value > total / 8 ? p.value : ''}</span>`).join('');
  const legende = parts.map((p) => `<span class="dist-leg-item"><span class="dist-leg-dot ${p.cls}"></span>${escape(p.label)} <strong>${p.value}</strong></span>`).join('');
  return `<div class="dist-bar">${segs}</div><div class="dist-leg">${legende}</div>`;
}

// Sparkline SVG (8x32) pour un tableau de valeurs numériques chronologiques.
export function sparkline(values, opts = {}) {
  const w = opts.width || 120;
  const h = opts.height || 32;
  if (!values || values.length === 0) return `<svg class="spark" width="${w}" height="${h}"></svg>`;
  if (values.length === 1) {
    return `<svg class="spark" width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="3" /></svg>`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = w / (values.length - 1);
  const points = values.map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / span) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
