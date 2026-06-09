// Tests `lib/memory.js` — memory native : promotion from logs + curation (§3.8).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SEUIL_PROMOTION_DEFAUT,
  MAX_LIGNES_DEFAUT,
  signatureObservation,
  collecterObservations,
  proposerPromotions,
  formatEntreeMemoire,
  promouvoir,
  curer,
  cheminStore,
  // alias EN
  proposePromotions,
  promote,
} from '../lib/memory.js';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'memory-'));
}

function fait(dir, nom, { title, category = '' } = {}) {
  const fd = join(dir, '.aiad', 'facts');
  mkdirSync(fd, { recursive: true });
  writeFileSync(join(fd, nom), `---\ntitle: ${title}\ncategory: ${category}\n---\n\n# ${title}\n`);
}

// ─── Signature ──────────────────────────────────────────────────────────────

test('signatureObservation — regroupe les paraphrases (mêmes mots porteurs), ignore les mots-outils', () => {
  const a = signatureObservation('Le token auth expiré sur le serveur');
  const b = signatureObservation('serveur : token expiré pour auth');
  assert.equal(a, b);
});

test('signatureObservation — vide / non porteur → chaîne vide', () => {
  assert.equal(signatureObservation('le la les de'), '');
  assert.equal(signatureObservation(''), '');
});

// ─── Collecte + proposition (from logs, récurrence cross-sources) ────────────

test('proposerPromotions — un cas isolé n\'est PAS promu (≠ une règle)', () => {
  const obs = [{ signature: 'bouton rose', source: 'FACT-001', kind: 'fact', extrait: 'bouton rose' }];
  const out = proposerPromotions(obs, { seuil: 3 });
  assert.equal(out.length, 0);
});

test('proposerPromotions — un pattern récurrent sur ≥ seuil sources est promu', () => {
  const obs = [
    { signature: 'token expire auth', source: 'FACT-001', kind: 'fact', extrait: 'token auth expiré' },
    { signature: 'token expire auth', source: 'FACT-009', kind: 'fact', extrait: 'auth token expire trop tôt' },
    { signature: 'token expire auth', source: 'lib/auth.js:12', kind: 'drift', extrait: 'drift sur token' },
  ];
  const out = proposePromotions(obs, { seuil: 3 });
  assert.equal(out.length, 1);
  assert.equal(out[0].occurrences, 3);
  assert.deepEqual(out[0].kinds.sort(), ['drift', 'fact']);
});

test('proposerPromotions — récurrence comptée par sources DISTINCTES', () => {
  const obs = [
    { signature: 's', source: 'FACT-001', kind: 'fact', extrait: 'x' },
    { signature: 's', source: 'FACT-001', kind: 'fact', extrait: 'x' }, // même source
  ];
  assert.equal(proposerPromotions(obs, { seuil: 2 }).length, 0);
});

test('collecterObservations — lit les facts du projet', () => {
  const dir = tmp();
  fait(dir, 'FACT-001.md', { title: 'Quota Stripe dépassé en checkout', category: 'paiement' });
  fait(dir, 'FACT-002.md', { title: 'Quota Stripe dépassé au refund', category: 'paiement' });
  const obs = collecterObservations(dir);
  assert.equal(obs.length, 2);
  assert.equal(obs[0].kind, 'fact');
  rmSync(dir, { recursive: true, force: true });
});

test('collecterObservations — intègre les drifts de la matrice', () => {
  const dir = tmp();
  const md = join(dir, '.aiad', 'metrics', 'traceability');
  mkdirSync(md, { recursive: true });
  writeFileSync(join(md, 'matrix.json'), JSON.stringify({ gaps: [{ kind: 'spec_orphan_in_code', message: 'SPEC orpheline', file: 'lib/x.js:1' }] }));
  const obs = collecterObservations(dir);
  assert.equal(obs.length, 1);
  assert.equal(obs[0].kind, 'drift');
  rmSync(dir, { recursive: true, force: true });
});

// ─── Promotion (Human Authorship) ───────────────────────────────────────────

const CAND = { signature: 's', occurrences: 3, sources: ['FACT-001', 'FACT-002', 'FACT-003'], kinds: ['fact'], exemples: ['Toujours valider le token côté serveur'] };

test('promouvoir — refuse sans auteur humain (fail-closed)', () => {
  assert.throws(() => promouvoir('', CAND, {}), /auteur humain requis/i);
  assert.throws(() => promote('', CAND, { auteur: '  ' }), /auteur/i);
});

test('promouvoir — avec auteur, crée le store et insère l\'entrée', () => {
  const r = promouvoir('', CAND, { auteur: 'Steeve' });
  assert.ok(r.contenu.includes('# MEMORY'));
  assert.ok(r.contenu.includes('Toujours valider le token'));
  assert.ok(r.contenu.includes('promu par Steeve'));
  assert.ok(r.entree.includes('3×'));
});

test('promouvoir — append à un store existant sans écraser', () => {
  const existant = '# MEMORY\n\n- **Entrée précédente**\n';
  const r = promouvoir(existant, CAND, { auteur: 'Steeve' });
  assert.ok(r.contenu.includes('Entrée précédente'));
  assert.ok(r.contenu.includes('Toujours valider le token'));
});

test('formatEntreeMemoire — utilise la leçon humaine si fournie', () => {
  const e = formatEntreeMemoire(CAND, { auteur: 'A', date: '2026-06-09', lecon: 'Règle X' });
  assert.ok(e.includes('Règle X'));
  assert.ok(e.includes('2026-06-09'));
});

// ─── Auto-curation (> 200 lignes → split par thème) ─────────────────────────

test('curer — sous le plafond → aucun éclatement', () => {
  const r = curer('# MEMORY\n\n- une entrée\n', { maxLignes: 200 });
  assert.equal(r.besoinSplit, false);
  assert.equal(r.themes.length, 0);
});

test('curer — au-delà du plafond → split par thème + index', () => {
  const lignes = ['# MEMORY', ''];
  lignes.push('## Auth', ...Array(120).fill('- détail auth'));
  lignes.push('## Paiement', ...Array(120).fill('- détail paiement'));
  const r = curer(lignes.join('\n'), { maxLignes: 200 });
  assert.equal(r.besoinSplit, true);
  assert.equal(r.themes.length, 2);
  assert.deepEqual(r.themes.map((t) => t.slug), ['auth', 'paiement']);
  assert.ok(r.index.includes('memory/auth.md'));
  assert.ok(r.index.includes('memory/paiement.md'));
});

test('curer — long mais sans thème ## → signale sans casser', () => {
  const r = curer(Array(250).fill('- ligne plate').join('\n'), { maxLignes: 200 });
  assert.equal(r.besoinSplit, true);
  assert.equal(r.themes.length, 0);
  assert.equal(r.index, null);
});

// ─── Constantes & store ─────────────────────────────────────────────────────

test('constantes exposées', () => {
  assert.equal(SEUIL_PROMOTION_DEFAUT, 3);
  assert.equal(MAX_LIGNES_DEFAUT, 200);
});

test('cheminStore — pointe vers .aiad/memory/MEMORY.md', () => {
  assert.ok(cheminStore('/p').endsWith(join('.aiad', 'memory', 'MEMORY.md')));
});
