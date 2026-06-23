// @spec SPEC-018-3-hill-charts-sdd
// @verified-by test/dashboard-hill-charts.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculerHillCharts, blocHillCharts } from '../lib/dashboard/hill-charts.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeIntent(id, statut = 'active', titre = `Intent ${id}`) {
  return { id, statut, titre };
}

function makeSpec(id, parentIntent, statut) {
  return { id, parentIntent, statut };
}

function makeDonnees(intents, specs) {
  return { intents, specs };
}

// ─── calculerHillCharts ───────────────────────────────────────────────────────

describe('calculerHillCharts', () => {
  it('retourne un item par Intent active/in-progress', () => {
    const d = makeDonnees(
      [makeIntent('I-1', 'active'), makeIntent('I-2', 'in-progress'), makeIntent('I-3', 'done')],
      [],
    );
    const r = calculerHillCharts(d, { snapshots: [] });
    assert.equal(r.intents.length, 2, 'seulement active et in-progress');
    assert.ok(r.intents.every((i) => ['I-1', 'I-2'].includes(i.id)));
  });

  it('positionX dans [0, 100] pour chaque intent', () => {
    const d = makeDonnees(
      [makeIntent('I-1', 'active')],
      [makeSpec('S-1', 'I-1', 'done'), makeSpec('S-2', 'I-1', 'draft')],
    );
    const r = calculerHillCharts(d, { snapshots: [] });
    assert.ok(r.intents[0].positionX >= 0 && r.intents[0].positionX <= 100);
  });

  it('Intent sans SPECs → positionX=0 et jnsp=true', () => {
    const d = makeDonnees([makeIntent('I-1', 'active')], []);
    const r = calculerHillCharts(d, { snapshots: [] });
    assert.equal(r.intents[0].positionX, 0);
    assert.equal(r.intents[0].jnsp, true);
  });

  it('Intent dont toutes les SPECs sont done → positionX=100', () => {
    const d = makeDonnees(
      [makeIntent('I-1', 'active')],
      [makeSpec('S-1', 'I-1', 'done'), makeSpec('S-2', 'I-1', 'done')],
    );
    const r = calculerHillCharts(d, { snapshots: [] });
    assert.equal(r.intents[0].positionX, 100);
    assert.equal(r.intents[0].jnsp, false);
  });

  it('3 Intents couvrant les cas canoniques → positions [0, 75, 100]', () => {
    // CA-008 : (0 SPEC, 2/4 done, 4/4 done) → [0, 75, 100]
    const d = makeDonnees(
      [makeIntent('I-A', 'active'), makeIntent('I-B', 'active'), makeIntent('I-C', 'active')],
      [
        // I-A : 0 SPEC → position 0
        // I-B : 2 done + 2 draft → phase Discovery, nbDone=2/4 → 0–49
        // Non — I-B : 2 done, 2 draft → nbDiscovery=2>0 → Discovery = round(((0+2)/4)*49)=round(24.5)=25
        // Ah, le test canonical dit 75. Recalculons : 2/4 done, 2/4 draft.
        // nbDiscovery=2, nbDone=2, nbDoing=0 → nbDiscovery>0 → Discovery = round(((0+2)/4)*49) = round(24.5) = 25
        // Mais CA-008 dit 75. Cela implique que c'est 2 done, 0 draft, 2 doing.
        // I-B : 2 done, 2 in-progress (STATUTS_DOING) → nbDiscovery=0, nbDone=2, nbDoing=2 → Doing/Done = 50+round(2/4*50)=50+25=75 ✓
        makeSpec('S-B1', 'I-B', 'done'),
        makeSpec('S-B2', 'I-B', 'done'),
        makeSpec('S-B3', 'I-B', 'in-progress'),
        makeSpec('S-B4', 'I-B', 'in-progress'),
        // I-C : 4/4 done → 100
        makeSpec('S-C1', 'I-C', 'done'),
        makeSpec('S-C2', 'I-C', 'done'),
        makeSpec('S-C3', 'I-C', 'done'),
        makeSpec('S-C4', 'I-C', 'done'),
      ],
    );
    const r = calculerHillCharts(d, { snapshots: [] });
    const byId = Object.fromEntries(r.intents.map((i) => [i.id, i]));
    assert.equal(byId['I-A'].positionX, 0);
    assert.equal(byId['I-B'].positionX, 75, '50 + round(2/4 * 50) = 75');
    assert.equal(byId['I-C'].positionX, 100);
  });

  it('< 3 snapshots → historiqueDisponible=false et messageJnsp non vide', () => {
    const d = makeDonnees([makeIntent('I-1', 'active')], []);
    const snaps = [{ date: '2026-06-22', data: { specs: [] } }];
    const r = calculerHillCharts(d, { snapshots: snaps });
    assert.equal(r.historiqueDisponible, false);
    assert.ok(r.messageJnsp && r.messageJnsp.length > 0);
  });

  it('< 3 Intents actifs → historiqueDisponible=false même avec 3 snapshots', () => {
    const d = makeDonnees([makeIntent('I-1', 'active'), makeIntent('I-2', 'active')], []);
    const snaps = [
      { date: '2026-06-21', data: { specs: [] } },
      { date: '2026-06-22', data: { specs: [] } },
      { date: '2026-06-23', data: { specs: [] } },
    ];
    const r = calculerHillCharts(d, { snapshots: snaps });
    assert.equal(r.historiqueDisponible, false);
  });

  it('trajectoire disponible si ≥ 3 snapshots et ≥ 3 Intents actifs', () => {
    const d = makeDonnees(
      [makeIntent('I-1', 'active'), makeIntent('I-2', 'active'), makeIntent('I-3', 'active')],
      [],
    );
    const snaps = [
      { date: '2026-06-21', data: { specs: [] } },
      { date: '2026-06-22', data: { specs: [] } },
      { date: '2026-06-23', data: { specs: [] } },
    ];
    const r = calculerHillCharts(d, { snapshots: snaps });
    assert.equal(r.historiqueDisponible, true);
    assert.equal(r.messageJnsp, null);
    assert.equal(r.intents[0].trajectoire.length, 3);
  });

  // Cas limites supplémentaires
  it('phase Discovery : toutes les SPECs en draft → positionX=0', () => {
    const d = makeDonnees(
      [makeIntent('I-1', 'active')],
      [makeSpec('S-1', 'I-1', 'draft'), makeSpec('S-2', 'I-1', 'draft')],
    );
    const r = calculerHillCharts(d, { snapshots: [] });
    assert.equal(r.intents[0].positionX, 0);
  });

  it('phase Doing/Done : toutes en ready (aucune done) → positionX=50', () => {
    const d = makeDonnees(
      [makeIntent('I-1', 'active')],
      [makeSpec('S-1', 'I-1', 'ready'), makeSpec('S-2', 'I-1', 'ready')],
    );
    const r = calculerHillCharts(d, { snapshots: [] });
    assert.equal(r.intents[0].positionX, 50);
  });
});

// ─── blocHillCharts ───────────────────────────────────────────────────────────

describe('blocHillCharts', () => {
  it('0 Intent actif → message "Aucun Intent en cours"', () => {
    const d = { hillCharts: { intents: [], historiqueDisponible: false, messageJnsp: null } };
    const html = blocHillCharts(d);
    assert.ok(html.includes('Aucun Intent en cours'));
  });

  it('produit un <svg> avec <title> et <desc>', () => {
    const donnees = makeDonnees([makeIntent('I-1', 'active')], []);
    const d = { hillCharts: calculerHillCharts(donnees, { snapshots: [] }) };
    const html = blocHillCharts(d);
    assert.ok(html.includes('<svg'), 'contient <svg>');
    assert.ok(html.includes('<title>'), 'contient <title>');
    assert.ok(html.includes('<desc>'), 'contient <desc>');
  });

  it('chaque point de données a un aria-label', () => {
    const donnees = makeDonnees(
      [makeIntent('I-1', 'active'), makeIntent('I-2', 'active')],
      [],
    );
    const d = { hillCharts: calculerHillCharts(donnees, { snapshots: [] }) };
    const html = blocHillCharts(d);
    const matches = html.match(/aria-label="/g) || [];
    // Au moins 1 aria-label sur le svg + 1 par point
    assert.ok(matches.length >= 3, `attendu ≥ 3 aria-label, trouvé ${matches.length}`);
  });

  it('Intent JNSP → forme rect (carré), pas de <circle>', () => {
    const donnees = makeDonnees([makeIntent('I-jnsp', 'active')], []);
    const d = { hillCharts: calculerHillCharts(donnees, { snapshots: [] }) };
    const html = blocHillCharts(d);
    assert.ok(html.includes('hc-point-jnsp'), 'classe jnsp sur rect');
    assert.ok(!html.includes('<circle'), 'aucun élément <circle> pour JNSP');
  });

  it('Intent non-JNSP → forme circle', () => {
    const donnees = makeDonnees(
      [makeIntent('I-1', 'active')],
      [makeSpec('S-1', 'I-1', 'done')],
    );
    const d = { hillCharts: calculerHillCharts(donnees, { snapshots: [] }) };
    const html = blocHillCharts(d);
    assert.ok(html.includes('hc-pt-circle'));
  });

  it('contient @media prefers-reduced-motion dans le CSS', () => {
    const donnees = makeDonnees([makeIntent('I-1', 'active')], []);
    const d = { hillCharts: calculerHillCharts(donnees, { snapshots: [] }) };
    const html = blocHillCharts(d);
    assert.ok(html.includes('prefers-reduced-motion'));
  });

  it('retourne chaîne vide si hillCharts absent', () => {
    assert.equal(blocHillCharts({}), '');
    assert.equal(blocHillCharts(null), '');
  });
});
