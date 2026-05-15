// Tests #230 / #231 / #232 — Extensions PM cockpit du dashboard :
//   - parser de sections Intent (#230)
//   - avancement Intent ↔ Livraison (#231)
//   - page pm.html dédiée + funnel (#232)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { extraireSection, extraireSectionsIntent } from '../lib/dashboard/collect.js';
import {
  calculerAvancement, calculerFunnel, calculerPm, pagePm,
  pmTopBanner, detailIntentHtml, indexerContextePm, tagsIntent,
  computeAlignment, computeFunnel, pmPage, pmBanner,
} from '../lib/dashboard/pm.js';

// ─── #230 — parser sections Intent ──────────────────────────────────────────

const INTENT_BODY = `# INTENT-042-flux-paiement

## POURQUOI MAINTENANT
Sprint 12, le checkout chute à 62 % de conversion.

## POUR QUI
Acheteurs récurrents EU.

## OBJECTIF
Remonter conversion à >70 % en 4 semaines.

## CONTRAINTES
RGPD, pas de nouveau provider.

## CRITÈRE DE DRIFT
Si conversion < 65 % sur 7j glissants → drift confirmé.

---

## SPECs liées
- SPEC-042-1
`;

test('extraireSection — section reconnue (insensible à la casse + accents)', () => {
  assert.equal(extraireSection(INTENT_BODY, 'POURQUOI MAINTENANT'),
    'Sprint 12, le checkout chute à 62 % de conversion.');
  assert.equal(extraireSection(INTENT_BODY, 'Pourquoi maintenant'),
    'Sprint 12, le checkout chute à 62 % de conversion.');
  assert.equal(extraireSection(INTENT_BODY, 'CRITERE DE DRIFT'),
    'Si conversion < 65 % sur 7j glissants → drift confirmé.');
});

test('extraireSection — section absente → null', () => {
  assert.equal(extraireSection(INTENT_BODY, 'Hypothèse'), null);
  assert.equal(extraireSection(null, 'OBJECTIF'), null);
});

test('extraireSection — section vide → null', () => {
  const body = '## TITRE\n\n## SUIVANTE\nContenu.';
  assert.equal(extraireSection(body, 'TITRE'), null);
  assert.equal(extraireSection(body, 'SUIVANTE'), 'Contenu.');
});

test('extraireSection — strip HTML comments du template', () => {
  const body = '## OBJECTIF  <!-- ≥ 1 métrique mesurable -->\nConversion > 70 %.';
  assert.equal(extraireSection(body, 'OBJECTIF'), 'Conversion > 70 %.');
});

test('extraireSectionsIntent — 5 sections canoniques parsées', () => {
  const s = extraireSectionsIntent(INTENT_BODY);
  assert.ok(s);
  assert.ok(s.pourquoi.startsWith('Sprint 12'));
  assert.equal(s.pourQui, 'Acheteurs récurrents EU.');
  assert.ok(s.objectif.startsWith('Remonter conversion'));
  assert.ok(s.contraintes.includes('RGPD'));
  assert.ok(s.critereDrift.includes('drift confirmé'));
});

test('extraireSectionsIntent — aucune section reconnue → null', () => {
  assert.equal(extraireSectionsIntent('Texte libre sans header.'), null);
  assert.equal(extraireSectionsIntent(''), null);
  assert.equal(extraireSectionsIntent(null), null);
});

test('extraireSectionsIntent — section partielle accepté (3/5 reconnus)', () => {
  const body = `## OBJECTIF\nX\n\n## CRITÈRE DE DRIFT\nY\n`;
  const s = extraireSectionsIntent(body);
  assert.ok(s);
  assert.equal(s.pourquoi, null);
  assert.equal(s.pourQui, null);
  assert.equal(s.objectif, 'X');
  assert.equal(s.critereDrift, 'Y');
});

// ─── #231 — avancement Intent ↔ Livraison ───────────────────────────────────

const D_DEMO = {
  intents: [
    { id: 'INTENT-101', statut: 'active', titre: 'Conversion' },
    { id: 'INTENT-102', statut: 'draft', titre: 'Onboarding' },
    { id: 'INTENT-103', statut: 'active', titre: 'Rétention' },
    { id: 'INTENT-104', statut: 'done', titre: 'Login' },
  ],
  specs: [
    { id: 'SPEC-101-1', parentIntent: 'INTENT-101', statut: 'done' },
    { id: 'SPEC-101-2', parentIntent: 'INTENT-101', statut: 'in-progress' },
    { id: 'SPEC-103-1', parentIntent: 'INTENT-103', statut: 'ready' },
  ],
};

test('calculerAvancement — done/total + WIP par Intent', () => {
  const a = calculerAvancement(D_DEMO);
  const i101 = a.find((x) => x.id === 'INTENT-101');
  assert.equal(i101.total, 2);
  assert.equal(i101.done, 1);
  assert.equal(i101.enCours, 1);
  assert.equal(i101.ratio, 0.5);

  const i102 = a.find((x) => x.id === 'INTENT-102');
  assert.equal(i102.total, 0);
  assert.equal(i102.ratio, null);

  const i103 = a.find((x) => x.id === 'INTENT-103');
  assert.equal(i103.total, 1);
  assert.equal(i103.done, 0);
});

test('calculerAvancement — matching court INTENT-NNN ↔ parentIntent long', () => {
  const d = {
    intents: [{ id: 'INTENT-200', statut: 'active' }],
    specs: [{ id: 'SPEC-200-1', parentIntent: 'INTENT-200-slug-long', statut: 'done' }],
  };
  const a = calculerAvancement(d);
  assert.equal(a[0].total, 1);
  assert.equal(a[0].done, 1);
});

test('calculerFunnel — répartit en 5 étapes du cycle', () => {
  const f = calculerFunnel(D_DEMO);
  assert.equal(f.idea, 1, '1 draft');
  // INTENT-101 active+specs=1 in delivery ; INTENT-103 active+specs=1 in delivery
  assert.equal(f.inDelivery, 2);
  assert.equal(f.validated, 0, 'pas d\'active sans SPEC');
  assert.equal(f.done, 1);
});

test('calculerFunnel — active sans SPEC compte en "validated"', () => {
  const d = { intents: [{ id: 'INTENT-300', statut: 'active' }], specs: [] };
  assert.equal(calculerFunnel(d).validated, 1);
});

// ─── #231 — helpers de rendu intents.html ───────────────────────────────────

test('indexerContextePm — expose maps avancement + IDs alertes', () => {
  const d = {
    ...D_DEMO,
    pm: {
      avancement: calculerAvancement(D_DEMO),
      zombies: [{ id: 'INTENT-101' }],
      draftsAnciens: [{ id: 'INTENT-102' }],
    },
  };
  const ctx = indexerContextePm(d);
  assert.equal(ctx.avancementById.get('INTENT-101').total, 2);
  assert.ok(ctx.zombieIds.has('INTENT-101'));
  assert.ok(ctx.draftAncienIds.has('INTENT-102'));
  assert.ok(!ctx.zombieIds.has('INTENT-102'));
});

test('tagsIntent — calcule zombie / draft-vieux / sans-spec / sans-livraison', () => {
  const ctx = indexerContextePm({
    pm: {
      avancement: [
        { id: 'INTENT-A', total: 0, done: 0 },
        { id: 'INTENT-B', total: 2, done: 0 },
      ],
      zombies: [{ id: 'INTENT-A' }],
      draftsAnciens: [{ id: 'INTENT-C' }],
    },
  });
  const tA = tagsIntent({ id: 'INTENT-A', statut: 'active' }, [], ctx);
  assert.ok(tA.includes('zombie'));
  assert.ok(tA.includes('sans-spec'));
  const tB = tagsIntent({ id: 'INTENT-B', statut: 'active' }, [{ id: 'SPEC-B-1' }, { id: 'SPEC-B-2' }], ctx);
  assert.ok(!tB.includes('sans-spec'));
  assert.ok(tB.includes('sans-livraison'));
  const tC = tagsIntent({ id: 'INTENT-C', statut: 'draft' }, [], ctx);
  assert.ok(tC.includes('draft-vieux'));
});

test('detailIntentHtml — rend les sections + barre de progression', () => {
  const html = detailIntentHtml({ sections: { objectif: 'But X' } }, { ratio: 0.5, done: 1, total: 2 });
  assert.ok(html.sections.includes('pm-sections'));
  assert.ok(html.sections.includes('But X'));
  assert.ok(html.progress.includes('pm-progress'));
  assert.ok(html.progress.includes('1/2'));
});

// ─── #232 — pagePm rendu HTML ───────────────────────────────────────────────

test('pagePm — rend cockpit complet quand .pm est présent', () => {
  const d = {
    ...D_DEMO,
    pm: calculerPm(D_DEMO),
  };
  const html = pagePm(d);
  assert.ok(html.includes('Cockpit Product Manager'));
  assert.ok(html.includes('Funnel Intent'));
  assert.ok(html.includes('Alignement Intent'));
  assert.ok(html.includes('Commandes PM'));
  assert.ok(html.includes('INTENT-101'));
});

test('pagePm — état empty propre si .pm absent', () => {
  const html = pagePm({ intents: [], specs: [] });
  assert.ok(html.includes('Pas de données PM'));
});

test('pagePm — quand aucune alerte, message "équipe à jour"', () => {
  const d = { intents: [], specs: [], pm: calculerPm({ intents: [], specs: [] }) };
  const html = pagePm(d);
  assert.ok(html.includes('équipe à jour') || html.includes('Aucune action urgente'));
});

test('pmTopBanner — bannière émise quand au moins une alerte PM', () => {
  const d = { pm: { zombies: [{ id: 'X' }], draftsAnciens: [], specsNonDemontrees: [] } };
  const html = pmTopBanner(d);
  assert.ok(html.includes('1 action(s) PM'));
  assert.ok(html.includes('pm.html'));
});

test('pmTopBanner — silencieux si zéro alerte ou pm absent', () => {
  assert.equal(pmTopBanner({ pm: { zombies: [], draftsAnciens: [], specsNonDemontrees: [] } }), '');
  assert.equal(pmTopBanner({}), '');
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — computeAlignment / computeFunnel / pmPage / pmBanner', () => {
  assert.equal(typeof computeAlignment, 'function');
  assert.equal(typeof computeFunnel, 'function');
  assert.equal(typeof pmPage, 'function');
  assert.equal(typeof pmBanner, 'function');
});
