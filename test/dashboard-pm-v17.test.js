// Tests #468 / #469 / #470 — Boucle 17 PM cockpit newsletter/velocity/wip

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  genererNewsletter, blocNewsletter,
  generateNewsletter, newsletterSection,
} from '../lib/dashboard/weekly-newsletter.js';

import {
  calculerVelocityComparison, blocVelocityComparison,
  computeVelocityComparison, velocityComparisonSection,
} from '../lib/dashboard/velocity-comparison.js';

import {
  lireWipLimit, calculerWipLimit, blocWipLimit, WIP_DEFAUT,
  readWipLimit, computeWipLimit, wipLimitSection, DEFAULT_WIP,
} from '../lib/dashboard/wip-limit.js';

function tmpProjet() {
  const dir = join(tmpdir(), 'aiad-pm-v17-' + Math.random().toString(36).slice(2));
  mkdirSync(join(dir, '.aiad'), { recursive: true });
  return dir;
}

const days = (n) => n * 24 * 3600 * 1000;

// ─── #468 — Weekly newsletter ───────────────────────────────────────────────

test('genererNewsletter — structure Markdown', () => {
  const md = genererNewsletter({ projet: { nom: 'X' } });
  assert.ok(md.startsWith('# Newsletter PM — X — semaine du '));
  assert.ok(md.includes('## Livré cette semaine'));
  assert.ok(md.includes('Généré depuis le dashboard PM aiad-sdd'));
});

test('genererNewsletter — sans snapshot → message d\'indisponibilité', () => {
  const md = genererNewsletter({ projet: { nom: 'X' } });
  assert.ok(md.includes('Pas de snapshot de référence'));
});

test('genererNewsletter — livraisons depuis pmDiff', () => {
  const md = genererNewsletter({
    projet: { nom: 'X' },
    pmDiff: {
      reference: { date: '2026-05-08' },
      diff: {
        intents: { passesDone: [{ id: 'INTENT-A' }], passesArchive: [], nouveaux: [], transitions: [] },
        specs: { passesDone: [{ id: 'SPEC-B' }] },
      },
    },
  });
  assert.ok(md.includes('INTENT-A livré'));
  assert.ok(md.includes('SPEC-B'));
  assert.ok(md.includes('Comparaison avec snapshot du 2026-05-08'));
});

test('genererNewsletter — décisions + risques + priorités', () => {
  const md = genererNewsletter({
    projet: { nom: 'X' },
    decisionLog: {
      prd: { decisions: [{ decision: 'D1', raison: 'parce que' }] },
      facts: [{ id: 'FACT-1', titre: 'Critique', gravite: 'critical', statut: 'open' }],
    },
    intentDeps: { intents: [{ id: 'A', bloqueActif: true, bloquePar: [{ id: 'B', livre: false }] }] },
    confidenceTracker: { items: [{ id: 'INTENT-X', bande: 'faible', statut: 'active', pct: 30 }] },
    intents: [{ id: 'INTENT-P', titre: 'prio', statut: 'active', priority: 'P0' }],
  });
  assert.ok(md.includes('## Décisions & faits'));
  assert.ok(md.includes('D1'));
  assert.ok(md.includes('Fact critique'));
  assert.ok(md.includes('## Risques ouverts'));
  assert.ok(md.includes('## Prochaine semaine'));
  assert.ok(md.includes('INTENT-P [P0]'));
});

test('blocNewsletter — rend <pre user-select:all>', () => {
  const html = blocNewsletter({ projet: { nom: 'X' } });
  assert.ok(html.includes('Newsletter PM hebdo'));
  assert.ok(html.includes('class="news-pre"'));
  assert.ok(html.includes('user-select: all') || html.includes('user-select:all'));
});

// ─── #469 — Velocity comparison ─────────────────────────────────────────────

test('calculerVelocityComparison — semaine courante + précédente + ancienne', () => {
  const now = Date.UTC(2026, 4, 15); // ven 15/05/2026
  // Lundi courant = 11/05, lundi précédent = 04/05, ancien = 27/04
  const d = {
    intents: [
      { statut: 'done', mtime: Date.UTC(2026, 4, 13) }, // courant
      { statut: 'done', mtime: Date.UTC(2026, 4, 6) },  // précédent
      { statut: 'done', mtime: Date.UTC(2026, 4, 6) },  // précédent
      { statut: 'done', mtime: Date.UTC(2026, 3, 28) }, // ancien
      { statut: 'active', mtime: Date.UTC(2026, 4, 14) }, // pas done, ignoré
    ],
    specs: [{ statut: 'done', mtime: Date.UTC(2026, 4, 12) }],
  };
  const r = calculerVelocityComparison(d, { now });
  assert.equal(r.intents.courant, 1);
  assert.equal(r.intents.precedent, 2);
  assert.equal(r.intents.abs, -1);
  assert.equal(r.intents.sens, 'down');
  assert.equal(r.intents.rel, -50, '−50 %');
  assert.equal(r.specs.courant, 1);
  assert.equal(r.specs.precedent, 0);
  assert.deepEqual(r.historique.intents, [1, 2, 1]);
});

test('calculerVelocityComparison — flat si égalité', () => {
  const now = Date.UTC(2026, 4, 15);
  const d = {
    intents: [
      { statut: 'done', mtime: Date.UTC(2026, 4, 13) },
      { statut: 'done', mtime: Date.UTC(2026, 4, 6) },
    ],
  };
  const r = calculerVelocityComparison(d, { now });
  assert.equal(r.intents.sens, 'flat');
});

test('calculerVelocityComparison — rel null si précédent=0 et courant>0', () => {
  const now = Date.UTC(2026, 4, 15);
  const r = calculerVelocityComparison({
    intents: [{ statut: 'done', mtime: Date.UTC(2026, 4, 13) }],
  }, { now });
  assert.equal(r.intents.precedent, 0);
  assert.equal(r.intents.rel, null);
});

test('blocVelocityComparison — rend grid + sparkline + delta', () => {
  const html = blocVelocityComparison({ velocityComparison: {
    semaineCouranteDebut: '2026-05-11', semainePrecedenteDebut: '2026-05-04',
    intents: { courant: 3, precedent: 1, abs: 2, rel: 200, sens: 'up' },
    specs: { courant: 0, precedent: 0, abs: 0, rel: 0, sens: 'flat' },
    historique: { intents: [0, 1, 3], specs: [0, 0, 0] },
  }});
  assert.ok(html.includes('Vélocité — semaine vs précédente'));
  assert.ok(html.includes('2026-05-11'));
  assert.ok(html.includes('vc-card'));
  assert.ok(html.includes('sens-up'));
  assert.ok(html.includes('sens-flat'));
  assert.ok(html.includes('↗ +2'));
  assert.ok(html.includes('→ stable'));
  assert.ok(html.includes('<svg'));
});

test('blocVelocityComparison — rend même si v null skip', () => {
  assert.equal(blocVelocityComparison({}), '');
});

// ─── #470 — WIP limit ───────────────────────────────────────────────────────

test('lireWipLimit — défaut si pas de PRD', () => {
  const dir = tmpProjet();
  try {
    const r = lireWipLimit(dir);
    assert.equal(r.intents, WIP_DEFAUT.intents);
    assert.equal(r.specs, WIP_DEFAUT.specs);
    assert.equal(r.source, 'défaut');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireWipLimit — frontmatter unique number', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `---
wip_limit: 4
---
`);
    const r = lireWipLimit(dir);
    assert.equal(r.intents, 4);
    assert.equal(r.specs, 4);
    assert.ok(r.source.includes('unique'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireWipLimit — fallback team_capacity_per_quarter / 4', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `---
team_capacity_per_quarter: 12
---
`);
    const r = lireWipLimit(dir);
    assert.equal(r.intents, 5, 'plancher 5 même si 12/4=3');
    assert.equal(r.specs, 8);
    assert.ok(r.source.includes('team_capacity_per_quarter'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerWipLimit — compte status WIP + classifie état', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `---
wip_limit: 2
---
`);
    const d = {
      intents: [
        { id: 'A', statut: 'active' },
        { id: 'B', statut: 'in-progress' },
        { id: 'C', statut: 'active' }, // 3 actifs → dépasse limit 2
        { id: 'D', statut: 'draft' }, // exclu
      ],
      specs: [
        { id: 'S1', statut: 'in-progress' },
        { id: 'S2', statut: 'review' },
      ],
    };
    const r = calculerWipLimit(dir, d);
    assert.equal(r.intents.charge, 3);
    assert.equal(r.intents.limite, 2);
    assert.equal(r.intents.etat, 'critique', '3/2 = 150 % → critique > 120 %');
    assert.equal(r.specs.charge, 2);
    assert.equal(r.specs.etat, 'depasse', '2/2 = 100 %');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerWipLimit — sain si sous 80 %', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `---
wip_limit: 10
---
`);
    const d = { intents: [{ statut: 'active' }, { statut: 'active' }] };
    const r = calculerWipLimit(dir, d);
    assert.equal(r.intents.etat, 'sain');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocWipLimit — rend grid + barres + chips items', () => {
  const html = blocWipLimit({ wipLimit: {
    limit: { source: 'PRD frontmatter (unique)' },
    intents: { charge: 6, limite: 5, etat: 'depasse', items: [{ id: 'A', titre: 't', statut: 'active', file: null }] },
    specs: { charge: 3, limite: 8, etat: 'sain', items: [] },
  }});
  assert.ok(html.includes('WIP limit'));
  assert.ok(html.includes('Intents 6/5'));
  assert.ok(html.includes('SPECs 3/8'));
  assert.ok(html.includes('etat-depasse'));
  assert.ok(html.includes('etat-sain'));
  assert.ok(html.includes('WIP limit dépassée'));
});

test('blocWipLimit — message "sous limite" si tout sain', () => {
  const html = blocWipLimit({ wipLimit: {
    limit: { source: 'défaut' },
    intents: { charge: 1, limite: 5, etat: 'sain', items: [] },
    specs: { charge: 1, limite: 8, etat: 'sain', items: [] },
  }});
  assert.ok(html.includes('sous limite'));
});

test('WIP_DEFAUT — alias EN DEFAULT_WIP', () => {
  assert.equal(WIP_DEFAUT, DEFAULT_WIP);
  assert.equal(WIP_DEFAUT.intents, 5);
  assert.equal(WIP_DEFAUT.specs, 8);
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof generateNewsletter, 'function');
  assert.equal(typeof newsletterSection, 'function');
  assert.equal(typeof computeVelocityComparison, 'function');
  assert.equal(typeof velocityComparisonSection, 'function');
  assert.equal(typeof readWipLimit, 'function');
  assert.equal(typeof computeWipLimit, 'function');
  assert.equal(typeof wipLimitSection, 'function');
});
