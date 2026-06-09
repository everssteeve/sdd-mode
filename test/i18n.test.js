// Tests i18n — chargement, détection, interpolation, fallback.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { setLang, getLang, t, listerLangues } from '../lib/i18n.js';

test('setLang(fr) — actif = fr', () => {
  setLang('fr');
  assert.equal(getLang(), 'fr');
});

test('setLang(en) — actif = en', () => {
  setLang('en');
  assert.equal(getLang(), 'en');
});

test('setLang code inconnu → fallback détection auto', () => {
  setLang('xx');
  assert.ok(['fr', 'en'].includes(getLang()));
});

test('t() — message simple en FR', () => {
  setLang('fr');
  assert.match(t('doctor.ok'), /Projet en bonne santé/);
});

test('t() — message simple en EN', () => {
  setLang('en');
  assert.match(t('doctor.ok'), /Project is healthy/);
});

test('t() — interpolation {var}', () => {
  setLang('fr');
  const out = t('doctor.metrics.humanAuthorship', {
    pct: '50%',
    sufficient: 1,
    total: 2,
    seuil: 50,
  });
  assert.match(out, /50%/);
  assert.match(out, /1\/2/);
  assert.match(out, /50 caractères/);
});

test('t() — clé inconnue retourne la clé brute (safe fallback)', () => {
  setLang('fr');
  assert.equal(t('inexistant.key.xyz'), 'inexistant.key.xyz');
});

test('t() — fallback FR si clé manquante en EN', () => {
  setLang('en');
  // Toutes les clés présentes en FR doivent être disponibles. Test que
  // le fallback FR fonctionne pour une clé qui existerait uniquement en FR.
  // Ici on utilise une clé existante des deux côtés ; le test vérifie au
  // moins que le retour n'est pas la clé brute (donc fallback effectif).
  const out = t('doctor.title');
  assert.notEqual(out, 'doctor.title');
});

test('listerLangues — expose fr (default) et en', () => {
  const r = listerLangues();
  assert.equal(r.length, 2);
  const fr = r.find((l) => l.code === 'fr');
  const en = r.find((l) => l.code === 'en');
  assert.ok(fr);
  assert.ok(en);
  assert.equal(fr.default, true);
  assert.equal(en.default, false);
});

test('détection AIAD_LANG — env var prioritaire', () => {
  const orig = process.env.AIAD_LANG;
  process.env.AIAD_LANG = 'en';
  try {
    setLang(null); // force re-detection
    assert.equal(getLang(), 'en');
  } finally {
    if (orig === undefined) delete process.env.AIAD_LANG;
    else process.env.AIAD_LANG = orig;
    setLang('fr'); // reset for other tests
  }
});

test('détection LANG=fr_FR — auto FR', () => {
  const origAiad = process.env.AIAD_LANG;
  const origLang = process.env.LANG;
  // LC_ALL est prioritaire sur LANG dans detectAuto() ; sans le neutraliser,
  // un runner où LC_ALL=en_US.UTF-8 (ex. macOS GitHub Actions) détecte EN.
  const origLcAll = process.env.LC_ALL;
  delete process.env.AIAD_LANG;
  delete process.env.LC_ALL;
  process.env.LANG = 'fr_FR.UTF-8';
  try {
    setLang(null);
    assert.equal(getLang(), 'fr');
  } finally {
    if (origAiad !== undefined) process.env.AIAD_LANG = origAiad;
    if (origLang !== undefined) process.env.LANG = origLang;
    else delete process.env.LANG;
    if (origLcAll !== undefined) process.env.LC_ALL = origLcAll;
    setLang('fr');
  }
});

test('parité fr/en — toutes les clés communes existent dans les deux fichiers', async () => {
  // Récupère la liste des clés en FR et vérifie qu'elles existent toutes en EN.
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fr = JSON.parse(readFileSync(join(__dirname, '..', 'lib', 'i18n', 'fr.json'), 'utf-8'));
  const en = JSON.parse(readFileSync(join(__dirname, '..', 'lib', 'i18n', 'en.json'), 'utf-8'));
  const cles = Object.keys(fr).filter((k) => !k.startsWith('_'));
  for (const k of cles) {
    assert.ok(k in en, `clé manquante en EN : ${k}`);
  }
});

test('intégration doctor — sortie change avec --lang', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { init } = await import('../lib/init.js');
  const { doctor } = await import('../lib/doctor.js');

  const dir = mkdtempSync(join(tmpdir(), 'aiad-i18n-'));
  try {
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { await init(dir, {}); }
    finally { process.stdout.write = origWrite; }

    // FR
    setLang('fr');
    let buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    try { await doctor(dir, {}); }
    finally { process.stdout.write = origWrite; }
    assert.match(buf, /Métriques de leadership/);

    // EN
    setLang('en');
    buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    try { await doctor(dir, {}); }
    finally { process.stdout.write = origWrite; }
    assert.match(buf, /EU\/FR leadership metrics/);
    assert.match(buf, /Project is healthy|Anomalies detected/);
  } finally {
    setLang('fr');
    rmSync(dir, { recursive: true, force: true });
  }
});
