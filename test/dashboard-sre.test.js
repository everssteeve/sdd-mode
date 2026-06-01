// Tests #203 — Page SRE/Ops (hook-stats + deploys + security/audit severity).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  calculerSre, pageSre, compterSeverites,
  computeSre, srePage,
} from '../lib/dashboard/sre.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-sre-'));
}

test('calculerSre — projet vide → hookStats indisponible, 0 rapports', () => {
  const racine = tmpProjet();
  try {
    const r = calculerSre(racine, {});
    assert.equal(r.hookStats.available, false);
    assert.equal(r.security.total, 0);
    assert.equal(r.audit.total, 0);
    assert.equal(r.deployments, null);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerSre — supplementaire.hookStats propagé', () => {
  const racine = tmpProjet();
  try {
    const donnees = { supplementaire: { hookStats: { available: true, count: 10, p50: 200, p95: 800, sante: 'sain' } } };
    const r = calculerSre(racine, donnees);
    assert.equal(r.hookStats.available, true);
    assert.equal(r.hookStats.count, 10);
    assert.equal(r.hookStats.p95, 800);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerSre — deployments depuis donnees.metrics', () => {
  const racine = tmpProjet();
  try {
    const donnees = { metrics: { deployments: { total: 5, cycleTimeMoyen: 1.5, leadTimeMoyen: 3, cfr: 0.2, deployFrequency: 'weekly' } } };
    const r = calculerSre(racine, donnees);
    assert.equal(r.deployments.total, 5);
    assert.equal(r.deployments.cfr, 0.2);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerSre — rapports security comptés avec sévérités', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'security');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'security-2026-05-13.md'), `# Security report

## Critique
- Token JWT en clair

## Moyen
- Rate limit absent sur /shorten

**Bonne pratique** — HSTS activé`);
    writeFileSync(join(dir, 'security-2026-04-30.md'), `# Security report

## Critique
- SQL injection sur /auth`);
    const r = calculerSre(racine, {});
    assert.equal(r.security.total, 2);
    assert.equal(r.severites.security.critique, 2);
    assert.equal(r.severites.security.moyen, 1);
    assert.equal(r.severites.security['bonne pratique'], 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerSre — rapports audit comptés', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'audit');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'audit-1.md'), '## Mineur\n- nit\n## Moyen\n- meh');
    const r = calculerSre(racine, {});
    assert.equal(r.audit.total, 1);
    assert.equal(r.severites.audit.mineur, 1);
    assert.equal(r.severites.audit.moyen, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerSre — derniers rapports triés desc par mtime', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'security');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'a.md'), '# old');
    // Petit délai pour différencier les mtime sur APFS
    const before = Date.now();
    while (Date.now() === before) { /* spin */ }
    writeFileSync(join(dir, 'b.md'), '# new');
    const r = calculerSre(racine, {});
    assert.equal(r.security.total, 2);
    assert.equal(r.security.derniers[0].name, 'b.md', 'le plus récent en tête');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('pageSre — sans données → empty state pour chaque section', () => {
  const html = pageSre({ sre: { hookStats: { available: false, count: 0 }, deployments: null, security: { total: 0, derniers: [] }, audit: { total: 0, derniers: [] }, severites: { security: {}, audit: {} } } });
  assert.match(html, /Aucune métrique hook capturée/);
  assert.match(html, /Aucun déploiement enregistré/);
  assert.match(html, /Aucun rapport sécurité\/audit/);
});

test('pageSre — hookStats sain rendu avec KPI + p50/p95/timeouts', () => {
  const html = pageSre({ sre: {
    hookStats: { available: true, count: 50, p50: 150, p95: 800, timeouts: 0, scopeLeaks: 0, sante: 'sain' },
    deployments: null,
    security: { total: 0, derniers: [] },
    audit: { total: 0, derniers: [] },
    severites: { security: {}, audit: {} },
  } });
  assert.match(html, /50 run\(s\)/);
  assert.match(html, /150ms/);
  assert.match(html, /800ms/);
  assert.match(html, /badge-ok">sain/);
});

test('pageSre — p95 > 1500 → warning visuel', () => {
  const html = pageSre({ sre: {
    hookStats: { available: true, count: 50, p50: 1200, p95: 2500, timeouts: 0, scopeLeaks: 0, sante: 'dégradé' },
    deployments: null,
    security: { total: 0, derniers: [] },
    audit: { total: 0, derniers: [] },
    severites: { security: {}, audit: {} },
  } });
  assert.match(html, /1500ms recommandé/);
  assert.match(html, /badge-warn/);
});

test('pageSre — scopeLeaks > 0 → alerte rendue', () => {
  const html = pageSre({ sre: {
    hookStats: { available: true, count: 10, p50: 100, p95: 200, timeouts: 0, scopeLeaks: 3, sante: 'sain' },
    deployments: null,
    security: { total: 0, derniers: [] },
    audit: { total: 0, derniers: [] },
    severites: { security: {}, audit: {} },
  } });
  assert.match(html, /3 fuite\(s\) de scope/);
});

test('pageSre — déploiements + sévérités combinés', () => {
  const html = pageSre({ sre: {
    hookStats: { available: false, count: 0 },
    deployments: { total: 12, cycleTimeMoyen: 1.5, leadTimeMoyen: 3, cfr: 0.0833, deployFrequency: 'weekly' },
    security: { total: 2, derniers: [] },
    audit: { total: 1, derniers: [] },
    severites: { security: { critique: 1, moyen: 2, 'bonne pratique': 3 }, audit: { mineur: 1 } },
  } });
  assert.match(html, />12</);
  assert.match(html, /weekly/);
  assert.match(html, /1\.5j/);
  assert.match(html, />8%</); // 0.0833 → 8%
  assert.match(html, /critique/);
  assert.match(html, /moyen/);
});

test('Alias EN canoniques', () => {
  assert.equal(computeSre, calculerSre);
  assert.equal(srePage, pageSre);
});

// ─── #204 Parsing de sévérité tolérant ──────────────────────────────────────

test('compterSeverites — section `## Risques critiques` + items', () => {
  const r = compterSeverites([{ contenu: `## Risques critiques
- **R-001** : SQL injection
- **R-002** : token leak

## Risques moyens
- **R-003** : rate limit

## Bonnes pratiques confirmées
- ✅ HSTS
- ✅ CSP
` }]);
  assert.equal(r.critique, 2, '2 items dans "Risques critiques"');
  assert.equal(r.moyen, 1);
  assert.equal(r['bonne pratique'], 2);
});

test('compterSeverites — section "Aucun." → 0', () => {
  const r = compterSeverites([{ contenu: `## Risques critiques

Aucun.

## Risques moyens
- **R-001** : truc
` }]);
  assert.equal(r.critique, 0);
  assert.equal(r.moyen, 1);
});

test('compterSeverites — frontmatter severity:', () => {
  const r = compterSeverites([{ contenu: `---
spec: SPEC-006-1
severity: critique
---

Audit minimal.` }]);
  assert.equal(r.critique, 1);
});

test('compterSeverites — variantes anglaises (Critical/Medium/Low)', () => {
  const r = compterSeverites([{ contenu: `## Critical findings
- item 1

## Medium findings
- item 2

## Low findings
- item 3
- item 4
` }]);
  assert.equal(r.critique, 1);
  assert.equal(r.moyen, 1);
  assert.equal(r.mineur, 2);
});

test('compterSeverites — fallback badge **Critique** si aucune section', () => {
  const r = compterSeverites([{ contenu: `Texte libre sans section H2.

**Critique** — token leak.

**Moyen** — rate limit.
` }]);
  assert.equal(r.critique, 1);
  assert.equal(r.moyen, 1);
});

test('compterSeverites — combine multiple rapports', () => {
  const r = compterSeverites([
    { contenu: `## Risques critiques\n- a\n- b` },
    { contenu: `## Risques critiques\n- c` },
    { contenu: `## Risques moyens\n- d\n- e\n- f` },
  ]);
  assert.equal(r.critique, 3);
  assert.equal(r.moyen, 3);
});

test('compterSeverites — section non-sévérité ignorée', () => {
  const r = compterSeverites([{ contenu: `## Méthodologie
- OWASP Top 10
- Harness Engineering

## Conformité
- ✅ AIAD-RGPD
` }]);
  assert.equal(r.critique, 0);
  assert.equal(r.moyen, 0);
  assert.equal(r['bonne pratique'], 0, 'Conformité ≠ Bonnes pratiques');
});

test('compterSeverites — format réel scenario-autonomous-run', () => {
  // Reproduit exactement le format observé dans le bench.
  const r = compterSeverites([{ contenu: `---
spec: SPEC-006-1-auth-jwt
date: 2026-05-13
status: PASS_AVEC_RECOMMANDATIONS
---

# Audit sécurité — SPEC-006-1 (Auth JWT)

## Méthodologie
OWASP Top 10 (2021) + Harness Engineering + RGPD/CRA.

## Risques critiques

Aucun.

## Risques moyens

- **R-001** : la secret JWT est lue via env. Pas de KMS.
- **R-002** : pas de mécanisme de révocation (denylist).

## Bonnes pratiques confirmées

- ✅ Fail-closed au démarrage si secret manquant
- ✅ Logs grep-tested pour absence de JWT brut
- ✅ Pas de localStorage côté UI
- ✅ Annotations @governance posées

## Conformité

| Référentiel | Statut |
|-------------|--------|
| OWASP A02 | ✅ |

## Recommandation finale

PASS avec R-001 et R-002 à porter au backlog.
` }]);
  assert.equal(r.critique, 0, 'Aucun → 0');
  assert.equal(r.moyen, 2, 'R-001 + R-002');
  assert.equal(r['bonne pratique'], 4, '4 bullets ✅ dans Bonnes pratiques');
});
