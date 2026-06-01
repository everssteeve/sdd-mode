// Tests #218 — Score global santé projet (composite Exec Sponsors).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  calculerSanteGlobale, blocSanteGlobale,
  computeHealthScore, healthScoreSection,
} from '../lib/dashboard/sante-globale.js';

function donneesBase(opts = {}) {
  return {
    maturite: opts.maturite ?? { score: 5, total: 5 },
    gouvernance: opts.gouvernance ?? [
      { id: 'AIAD-AI-ACT', present: true },
      { id: 'AIAD-RGPD', present: true },
      { id: 'AIAD-RGAA', present: true },
      { id: 'AIAD-RGESN', present: true },
      { id: 'AIAD-CRA', present: true },
    ],
    dpo: opts.dpo ?? { coverage: { ratio: 1.0 } },
    edgeCases: opts.edgeCases ?? { totalSpecs: 1, ratio: 1.0 },
    violations: opts.violations ?? { total: 0 },
    specs: opts.specs ?? [{ id: 'SPEC-1', statut: 'done' }],
  };
}

test('calculerSanteGlobale — projet parfait → 100/100 excellent', () => {
  const r = calculerSanteGlobale(donneesBase());
  assert.equal(r.score, 100);
  assert.equal(r.niveau, 'excellent');
  assert.equal(r.composantesDisponibles, 5);
});

test('calculerSanteGlobale — projet à 0 partout → 0/100 critique', () => {
  const r = calculerSanteGlobale(donneesBase({
    maturite: { score: 0, total: 5 },
    gouvernance: [{ id: 'AIAD-AI-ACT', present: false }, { id: 'AIAD-RGPD', present: false }],
    dpo: { coverage: { ratio: 0 } },
    edgeCases: { totalSpecs: 1, ratio: 0 },
    violations: { total: 100 },
    specs: [{ id: 'SPEC-1', statut: 'ready' }],
  }));
  assert.equal(r.score, 0);
  assert.equal(r.niveau, 'critique');
});

test('calculerSanteGlobale — niveau "sain" entre 70 et 85', () => {
  // Maturité 4/5 + gov 4/5 + dpo 0.75 + edge 0.7 + viol 0.8
  // = (4/5×20 + 4/5×20 + 0.75×20 + 0.7×20 + 0.8×20) = 16+16+15+14+16 = 77
  const r = calculerSanteGlobale(donneesBase({
    maturite: { score: 4, total: 5 },
    gouvernance: [
      { id: 'A', present: true }, { id: 'B', present: true },
      { id: 'C', present: true }, { id: 'D', present: true }, { id: 'E', present: false },
    ],
    dpo: { coverage: { ratio: 0.75 } },
    edgeCases: { totalSpecs: 10, ratio: 0.7 },
    violations: { total: 1 }, // sur 5 SPECs actives → 1-0.2 = 0.8
    specs: Array.from({ length: 5 }, (_, i) => ({ id: `SPEC-${i}`, statut: 'ready' })),
  }));
  assert.ok(r.score >= 70 && r.score < 85, `score ${r.score} dans [70, 85)`);
  assert.equal(r.niveau, 'sain');
});

test('calculerSanteGlobale — composante null exclue de la moyenne', () => {
  // edge cases null → 4 composantes × 20 = 80 max
  const r = calculerSanteGlobale(donneesBase({
    edgeCases: { totalSpecs: 0 }, // → null
  }));
  assert.equal(r.composantesDisponibles, 4);
  assert.equal(r.maxBrut, 80);
  // Avec 4 composantes parfaites → 80/80 → 100/100
  assert.equal(r.score, 100);
});

test('calculerSanteGlobale — aucune composante mesurable → score=null', () => {
  const r = calculerSanteGlobale({});
  assert.equal(r.score, null);
  assert.equal(r.niveau, 'inconnu');
  assert.equal(r.composantesDisponibles, 0);
});

test('calculerSanteGlobale — violations inverse (moins = mieux)', () => {
  // 0 violations → ratio 1.0 → 20 pts
  // 5 violations sur 5 SPECs actives → ratio 0 → 0 pts
  const r0 = calculerSanteGlobale(donneesBase({
    violations: { total: 0 },
    specs: [{ id: '1', statut: 'ready' }],
  }));
  const r5 = calculerSanteGlobale(donneesBase({
    violations: { total: 5 },
    specs: [{ id: '1', statut: 'ready' }],
  }));
  const vio0 = r0.breakdown.find((b) => b.id === 'violations').points;
  const vio5 = r5.breakdown.find((b) => b.id === 'violations').points;
  assert.equal(vio0, 20);
  assert.equal(vio5, 0);
});

test('calculerSanteGlobale — DPO ratio null + pas de SPECs RGPD → score neutre 1', () => {
  const r = calculerSanteGlobale(donneesBase({
    dpo: { coverage: { ratio: null } },
  }));
  const dpo = r.breakdown.find((b) => b.id === 'dpo');
  assert.equal(dpo.disponible, true);
  assert.equal(dpo.ratio, 1, 'pas de SPEC RGPD → neutre');
});

test('blocSanteGlobale — sans données → chaîne vide', () => {
  assert.equal(blocSanteGlobale({}), '');
  assert.equal(blocSanteGlobale({ santeGlobale: { composantesDisponibles: 0 } }), '');
});

test('blocSanteGlobale — score excellent → badge vert', () => {
  const html = blocSanteGlobale({ santeGlobale: {
    score: 92, total: 100, niveau: 'excellent', composantesDisponibles: 5,
    scoreBrut: 92, maxBrut: 100,
    breakdown: [
      { id: 'maturite', label: 'Maturité', max: 20, ratio: 1, points: 20, disponible: true },
      { id: 'governance', label: 'Tier 1', max: 20, ratio: 1, points: 20, disponible: true },
      { id: 'dpo', label: 'RGPD', max: 20, ratio: 0.6, points: 12, disponible: true },
      { id: 'edgeCases', label: 'Edge', max: 20, ratio: 1, points: 20, disponible: true },
      { id: 'violations', label: 'Conformité', max: 20, ratio: 1, points: 20, disponible: true },
    ],
  } });
  assert.match(html, /Santé projet/);
  assert.match(html, /Excellent.*92\/100/);
  assert.match(html, /badge-ok/);
  assert.match(html, /Maturité/);
});

test('blocSanteGlobale — score critique → badge rouge', () => {
  const html = blocSanteGlobale({ santeGlobale: {
    score: 32, total: 100, niveau: 'critique', composantesDisponibles: 5,
    scoreBrut: 32, maxBrut: 100,
    breakdown: [{ id: 'm', label: 'M', max: 20, ratio: 0.3, points: 6, disponible: true }],
  } });
  assert.match(html, /Critique.*32\/100/);
  assert.match(html, /badge-bad/);
});

test('blocSanteGlobale — composante non mesurable → "—"', () => {
  const html = blocSanteGlobale({ santeGlobale: {
    score: 60, total: 100, niveau: 'attention', composantesDisponibles: 3,
    scoreBrut: 36, maxBrut: 60,
    breakdown: [
      { id: 'maturite', label: 'Maturité', max: 20, ratio: 0.6, points: 12, disponible: true },
      { id: 'governance', label: 'Tier 1', max: 20, ratio: 0.6, points: 12, disponible: true },
      { id: 'dpo', label: 'RGPD', max: 20, ratio: null, points: 0, disponible: false },
      { id: 'edgeCases', label: 'Edge', max: 20, ratio: 0.6, points: 12, disponible: true },
      { id: 'violations', label: 'Conformité', max: 20, ratio: null, points: 0, disponible: false },
    ],
  } });
  assert.match(html, /non mesurable/);
});

test('Alias EN canoniques', () => {
  assert.equal(computeHealthScore, calculerSanteGlobale);
  assert.equal(healthScoreSection, blocSanteGlobale);
});
