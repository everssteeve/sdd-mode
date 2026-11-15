// Tests de la mesure d'usage locale du dashboard (SPEC-037-2).
//
// @spec SPEC-037-2-mesure-usage-dashboard

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enregistrerVue, lireUsage, phraseUsage, SEUIL_INUTILISE_JOURS, SCHEMA_USAGE } from '../lib/dashboard/usage.js';
import { serveDashboard } from '../lib/dashboard/server.js';
import { listerAlertes } from '../lib/dashboard/views/overview.js';

function projet() {
  const d = mkdtempSync(join(tmpdir(), 'aiad-usage-'));
  mkdirSync(join(d, '.aiad'), { recursive: true });
  return d;
}
const fichierMois = (d, mois) => join(d, '.aiad', 'metrics', 'dashboard-usage', `${mois}.json`);

describe('dashboard — mesure d\'usage', () => {
  test('CA-001 — une page consultée est comptée par jour et par onglet', () => {
    const d = projet();
    try {
      const date = '2026-11-15T09:00:00Z';
      assert.equal(enregistrerVue(d, '/pe.html', { date, env: {} }), true);
      assert.equal(enregistrerVue(d, '/specs.html?x=1', { date, env: {} }), true);
      assert.equal(enregistrerVue(d, 'index.html', { date, env: {} }), true);
      assert.equal(enregistrerVue(d, '/spec-001-1-x.html', { date: '2026-12-01T00:00:00Z', env: {} }), true);
      const nov = JSON.parse(readFileSync(fichierMois(d, '2026-11'), 'utf-8'));
      assert.equal(nov.schema, SCHEMA_USAGE);
      assert.deepEqual(nov.jours['2026-11-15'], { vues: 3, onglets: { pe: 2, global: 1 } });
      assert.deepEqual(JSON.parse(readFileSync(fichierMois(d, '2026-12'), 'utf-8')).jours['2026-12-01'], { vues: 1, onglets: { pe: 1 } });
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-002 — aucune donnée personnelle : jour, compteurs, onglet — rien d\'autre', () => {
    const d = projet();
    try {
      enregistrerVue(d, '/qa.html', { date: '2026-11-15T23:59:59Z', env: {} });
      const brut = readFileSync(fichierMois(d, '2026-11'), 'utf-8');
      const donnees = JSON.parse(brut);
      assert.deepEqual(Object.keys(donnees), ['schema', 'jours']);
      assert.deepEqual(Object.keys(donnees.jours['2026-11-15']), ['vues', 'onglets']);
      assert.doesNotMatch(brut, /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|user|agent|T\d\d:/i, 'ni IP, ni navigateur, ni heure');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-003 — non compté : assets, 404, chemins suspects, projet sans .aiad, désactivation', () => {
    const d = projet();
    const vide = mkdtempSync(join(tmpdir(), 'aiad-usage-'));
    try {
      for (const f of ['/assets/style.css', '/data.json', '/404.html', '/../secret.html', '/a/b.html', '', undefined]) {
        assert.equal(enregistrerVue(d, f, { env: {} }), false, `non compté : ${f}`);
      }
      assert.equal(enregistrerVue(d, '/pe.html', { env: { AIAD_DASHBOARD_USAGE: '0' } }), false);
      assert.equal(enregistrerVue(vide, '/pe.html', { env: {} }), false);
      assert.equal(existsSync(join(d, '.aiad', 'metrics')), false, 'rien écrit');
      assert.equal(readdirSync(vide).length, 0);
    } finally { rmSync(d, { recursive: true, force: true }); rmSync(vide, { recursive: true, force: true }); }
  });

  test('CA-004 — lireUsage : fenêtre glissante, dernière consultation, seuil d\'inutilisation', () => {
    const d = projet();
    try {
      assert.deepEqual(lireUsage(d).mesure, false);
      for (const date of ['2026-10-01', '2026-11-01', '2026-11-01', '2026-11-10']) enregistrerVue(d, '/tl.html', { date: `${date}T10:00:00Z`, env: {} });
      const u = lireUsage(d, { aujourdhui: '2026-11-15T08:00:00Z' });
      assert.equal(u.mesure, true);
      assert.equal(u.vues, 3, 'le 1er octobre est hors fenêtre de 30 j');
      assert.equal(u.joursActifs, 2);
      assert.equal(u.derniereVue, '2026-11-10');
      assert.equal(u.joursDepuis, 5);
      assert.deepEqual(u.parOnglet, { tl: 3 });
      assert.equal(u.inutilise, false);
      const tard = lireUsage(d, { aujourdhui: '2026-11-25T08:00:00Z' });
      assert.equal(tard.joursDepuis, SEUIL_INUTILISE_JOURS + 1);
      assert.equal(tard.inutilise, true);
      assert.equal(lireUsage(d, { aujourdhui: '2026-11-24T08:00:00Z' }).inutilise, false, 'au seuil exact : pas encore un drift');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-005 — fichier de mesure illisible : toléré, puis réécrit', () => {
    const d = projet();
    try {
      mkdirSync(join(d, '.aiad', 'metrics', 'dashboard-usage'), { recursive: true });
      writeFileSync(fichierMois(d, '2026-11'), '{oops');
      assert.equal(lireUsage(d).mesure, false);
      assert.equal(enregistrerVue(d, '/pm.html', { date: '2026-11-15T00:00:00Z', env: {} }), true);
      assert.equal(lireUsage(d, { aujourdhui: '2026-11-15T12:00:00Z' }).vues, 1);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-006 — alerte de drift seulement sur mesure ; non mesuré ≠ non utilisé', () => {
    const base = { specs: [], facts: [], intents: [], gouvernance: [], matrice: { gaps: { specsValideesNonImplementees: [] } }, metrics: { agregats: { drift: { driftsDetectes: 0, driftsResolus: 0 } } } };
    const titres = (usage) => listerAlertes({ ...base, usage }).map((a) => a.titre);
    assert.deepEqual(titres({ mesure: false }), []);
    assert.deepEqual(titres(undefined), []);
    assert.deepEqual(titres({ mesure: true, inutilise: false, joursDepuis: 3 }), []);
    assert.deepEqual(titres({ mesure: true, inutilise: true, joursDepuis: 20, derniereVue: '2026-10-26' }), ['Dashboard non consulté depuis 20 jours']);
  });

  test('CA-007 — phraseUsage', () => {
    assert.match(phraseUsage({ mesure: false }), /non mesuré/);
    assert.match(phraseUsage(null), /non mesuré/);
    assert.match(phraseUsage({ mesure: true, vues: 4, fenetre: 30, joursActifs: 2, joursDepuis: 0 }), /4 page\(s\).*aujourd'hui/);
    assert.match(phraseUsage({ mesure: true, vues: 4, fenetre: 30, joursActifs: 2, joursDepuis: 6 }), /il y a 6 j/);
  });

  test('CA-008 — le serveur local compte les pages servies, et seulement si usageDir est fourni', async () => {
    const d = projet();
    const out = join(d, 'dashboard');
    mkdirSync(join(out, 'assets'), { recursive: true });
    writeFileSync(join(out, 'index.html'), '<p>ok</p>');
    writeFileSync(join(out, 'pe.html'), '<p>pe</p>');
    writeFileSync(join(out, 'assets', 'style.css'), 'body{}');
    const sans = await serveDashboard(out, { port: 0, quiet: true });
    const avec = await serveDashboard(out, { port: 0, quiet: true, usageDir: d });
    try {
      await fetch(`${sans.url}pe.html`);
      assert.equal(lireUsage(d).mesure, false, 'sans usageDir : rien');
      for (const p of ['', 'pe.html', 'assets/style.css', 'absente.html']) await fetch(`${avec.url}${p}`);
      const u = lireUsage(d);
      assert.equal(u.vues, 2, 'index + pe ; ni l\'asset ni la page absente');
      assert.deepEqual(u.parOnglet, { global: 1, pe: 1 });
    } finally {
      sans.server.close(); avec.server.close();
      rmSync(d, { recursive: true, force: true });
    }
  });
});
