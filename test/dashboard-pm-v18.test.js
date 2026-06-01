// Tests #471 / #472 / #473 — Boucle 18 PM cockpit freshness/standup/retro

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  bandeFraicheur, calculerBacklogFreshness, blocBacklogFreshness,
  freshnessBand, computeBacklogFreshness, backlogFreshnessSection,
} from '../lib/dashboard/backlog-freshness.js';

import { blocStandupTimer, standupTimerSection } from '../lib/dashboard/standup-timer.js';

import {
  genererRetro, blocQuarterlyRetro,
  generateQuarterlyRetro, quarterlyRetroSection,
} from '../lib/dashboard/quarterly-retro.js';

const days = (n) => n * 24 * 3600 * 1000;

// ─── #471 — Backlog freshness ───────────────────────────────────────────────

test('bandeFraicheur — 4 paliers + null inconnu', () => {
  assert.equal(bandeFraicheur(0), 'frais');
  assert.equal(bandeFraicheur(14), 'frais');
  assert.equal(bandeFraicheur(20), 'tiede');
  assert.equal(bandeFraicheur(45), 'stale');
  assert.equal(bandeFraicheur(90), 'abandonne');
  assert.equal(bandeFraicheur(null), 'inconnu');
});

test('calculerBacklogFreshness — classifie Intents + SPECs actifs par âge', () => {
  const now = Date.now();
  const d = {
    intents: [
      { id: 'A', titre: 't', statut: 'active', mtime: now - days(2) },
      { id: 'B', titre: 't', statut: 'draft', mtime: now - days(35) },
      { id: 'C', titre: 't', statut: 'active', mtime: now - days(75) },
      { id: 'D', titre: 't', statut: 'done', mtime: now - days(100) }, // exclu (done)
    ],
    specs: [
      { id: 'S1', titre: 't', statut: 'review', mtime: now - days(20) },
    ],
  };
  const r = calculerBacklogFreshness(d, { now });
  assert.equal(r.items.length, 4);
  // Tri : abandonné en tête
  assert.equal(r.items[0].id, 'C');
  assert.equal(r.items[0].bande, 'abandonne');
  assert.equal(r.totaux.abandonne, 1);
  assert.equal(r.totaux.stale, 1);
  assert.equal(r.totaux.tiede, 1);
  assert.equal(r.totaux.frais, 1);
});

test('calculerBacklogFreshness — exclut items sans mtime', () => {
  const r = calculerBacklogFreshness({
    intents: [{ id: 'A', statut: 'active' }], // pas de mtime
  });
  assert.equal(r.items.length, 0);
});

test('blocBacklogFreshness — empty si zéro item actif', () => {
  const html = blocBacklogFreshness({ backlogFreshness: { items: [], totaux: { total: 0 } } });
  assert.ok(html.includes('aucun item actif'));
});

test('blocBacklogFreshness — affiche stale+abandonné en priorité avec conseil', () => {
  const html = blocBacklogFreshness({ backlogFreshness: {
    items: [
      { type: 'Intent', id: 'A', titre: 't', file: null, statut: 'active', mtime: 0, ageJours: 80, bande: 'abandonne' },
      { type: 'Intent', id: 'B', titre: 't', file: null, statut: 'draft', mtime: 0, ageJours: 5, bande: 'frais' },
    ],
    totaux: { total: 2, abandonne: 1, stale: 0, tiede: 0, frais: 1 },
  }});
  assert.ok(html.includes('Fraîcheur du backlog'));
  assert.ok(html.includes('bande-abandonne'));
  assert.ok(html.includes('1 abandonné(s)'));
  assert.ok(html.includes('rafraîchir, ré-évaluer ou archiver'));
  // `>` est HTML-échappé en `&gt;`
  assert.ok(html.includes('Abandonné &gt; 60j'));
});

// ─── #472 — Stand-up timer ──────────────────────────────────────────────────

test('blocStandupTimer — rend cadran + boutons + presets', () => {
  const html = blocStandupTimer();
  assert.ok(html.includes('Stand-up timer'));
  assert.ok(html.includes('id="pm-standup-clock"'));
  assert.ok(html.includes('id="pm-standup-card"'));
  assert.ok(html.includes('15:00'));
  // Presets 10/15/30
  assert.ok(html.includes('data-min="10"'));
  assert.ok(html.includes('data-min="15"'));
  assert.ok(html.includes('data-min="30"'));
  // Actions
  assert.ok(html.includes('id="pm-standup-start"'));
  assert.ok(html.includes('id="pm-standup-reset"'));
  assert.ok(html.includes('id="pm-standup-notify"'));
});

test('blocStandupTimer — script avec setInterval + Notification API', () => {
  const html = blocStandupTimer();
  assert.ok(html.includes('setInterval'));
  assert.ok(html.includes('Notification'));
  assert.ok(html.includes('requestPermission'));
});

// ─── #473 — Quarterly retro ─────────────────────────────────────────────────

test('genererRetro — structure complète avec sections', () => {
  const md = genererRetro({ projet: { nom: 'X' } }, { now: Date.UTC(2026, 6, 15) }); // Q3-2026
  assert.ok(md.startsWith('# Rétrospective Q3-2026 — X'));
  assert.ok(md.includes('## Ce qui a été livré'));
  assert.ok(md.includes('## Hypothèses validées'));
  assert.ok(md.includes('## Top 3 apprentissages humains'));
  assert.ok(md.includes('## Décisions pour le prochain trimestre'));
});

test('genererRetro — Intents livrés filtrés par quarter cible', () => {
  const md = genererRetro({
    projet: { nom: 'X' },
    intents: [
      { id: 'INTENT-A', titre: 'livré Q2', statut: 'done', target: 'Q2-2026' },
      { id: 'INTENT-B', titre: 'autre Q', statut: 'done', target: 'Q3-2026' },
      { id: 'INTENT-C', titre: 'actif', statut: 'active', target: 'Q2-2026' }, // exclu (pas livré)
    ],
  }, { now: Date.UTC(2026, 4, 15) }); // Q2-2026
  assert.ok(md.includes('INTENT-A — livré Q2'));
  assert.ok(!md.includes('INTENT-B'));
  assert.ok(!md.includes('INTENT-C — actif'));
});

test('genererRetro — hypothèses validées vs invalidées séparées', () => {
  const md = genererRetro({
    projet: { nom: 'X' },
    hypotheses: { hypotheses: [
      { id: 'A', hypothese: 'Hyp validée', statut: 'validated' },
      { id: 'B', hypothese: 'Hyp ratée', statut: 'invalidated' },
      { id: 'C', hypothese: 'En cours', statut: 'untested' },
    ]},
  });
  assert.ok(md.includes('A : Hyp validée'));
  assert.ok(md.includes('## Hypothèses invalidées'));
  assert.ok(md.includes('B : Hyp ratée'));
  assert.ok(!md.includes('En cours'));
});

test('genererRetro — outcomes atteints + ratés affichés', () => {
  const md = genererRetro({
    projet: { nom: 'X' },
    outcomes: { criteres: [
      { critere: 'Latence', cible: '< 50ms', actuel: '40ms', etat: 'ok' },
      { critere: 'Conversion', cible: '> 70%', actuel: '62%', etat: 'bad' },
      { critere: 'Erreur', etat: 'warn' }, // pas ok ni bad → exclu
    ]},
  });
  assert.ok(md.includes('## Outcomes PRD'));
  assert.ok(md.includes('✓ Latence'));
  assert.ok(md.includes('✗ Conversion'));
  assert.ok(!md.includes('Erreur'));
});

test('genererRetro — cycle time inclus si dispo', () => {
  const md = genererRetro({
    projet: { nom: 'X' },
    cycleTime: { stats: { p50: 12, p95: 35, moyenne: 18, n: 5 } },
  });
  assert.ok(md.includes('Lead time médian : **12 jours**'));
  assert.ok(md.includes('p95 : 35'));
});

test('genererRetro — placeholders apprentissages humains', () => {
  const md = genererRetro({ projet: { nom: 'X' } });
  assert.ok(md.includes('[À compléter — ce qui a marché]'));
  assert.ok(md.includes('[À compléter — ce qui n\'a pas marché]'));
  assert.ok(md.includes('[À compléter — ce qu\'on va changer'));
});

test('blocQuarterlyRetro — rend <pre user-select:all>', () => {
  const html = blocQuarterlyRetro({ projet: { nom: 'X' } });
  assert.ok(html.includes('Rétrospective trimestrielle'));
  assert.ok(html.includes('class="retro-pre"'));
  assert.ok(html.includes('user-select: all'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof freshnessBand, 'function');
  assert.equal(typeof computeBacklogFreshness, 'function');
  assert.equal(typeof backlogFreshnessSection, 'function');
  assert.equal(typeof standupTimerSection, 'function');
  assert.equal(typeof generateQuarterlyRetro, 'function');
  assert.equal(typeof quarterlyRetroSection, 'function');
});
