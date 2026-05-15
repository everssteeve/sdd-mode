// Tests étendus i18n CLI total — vérifie que :
//   1. Tous les messages sortis par les modules migrés sont externalisés.
//   2. fr.json et en.json ont les mêmes clés (parité 100%).
//   3. La bascule AIAD_LANG=en bascule réellement les commandes migrées.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLang, t } from '../lib/i18n.js';
import { genererSbom } from '../lib/sbom.js';
import { importer } from '../lib/import.js';
import { creerProjet } from '../lib/templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FR = JSON.parse(readFileSync(join(__dirname, '..', 'lib/i18n/fr.json'), 'utf-8'));
const EN = JSON.parse(readFileSync(join(__dirname, '..', 'lib/i18n/en.json'), 'utf-8'));

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-i18n-')); }

function silencer(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origWrite = process.stdout.write.bind(process.stdout);
    console.log = () => {};
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { console.log = origLog; process.stdout.write = origWrite; }
  };
}

// ─── Parité fr / en ─────────────────────────────────────────────────────────

test('i18n — fr.json et en.json ont des clés strictement identiques', () => {
  const frKeys = Object.keys(FR).filter((k) => k !== '_meta').sort();
  const enKeys = Object.keys(EN).filter((k) => k !== '_meta').sort();
  assert.deepEqual(frKeys, enKeys, 'parité fr/en cassée');
});

test('i18n — chaque clé existe dans les deux fichiers et n\'est pas vide', () => {
  for (const k of Object.keys(FR)) {
    if (k === '_meta') continue;
    assert.equal(typeof FR[k], 'string', `fr.${k} n'est pas une chaîne`);
    assert.equal(typeof EN[k], 'string', `en.${k} n'est pas une chaîne`);
    assert.ok(FR[k].length > 0, `fr.${k} vide`);
    assert.ok(EN[k].length > 0, `en.${k} vide`);
  }
});

test('i18n — fr et en ne sont pas identiques (vraie traduction)', () => {
  let differences = 0;
  for (const k of Object.keys(FR)) {
    if (k === '_meta') continue;
    if (FR[k] !== EN[k]) differences++;
  }
  // Au moins 70 % des entrées sont traduites différemment (les autres
  // peuvent rester identiques pour les noms propres / techniques).
  const total = Object.keys(FR).length - 1;
  assert.ok(differences >= total * 0.7, `seules ${differences}/${total} clés sont vraiment traduites`);
});

test('i18n — couvre les modules migrés (sbom, hooks, import, init)', () => {
  const prefixes = ['sbom.', 'hooks.', 'import.', 'init.'];
  for (const prefix of prefixes) {
    const found = Object.keys(FR).filter((k) => k.startsWith(prefix)).length;
    assert.ok(found >= 3, `prefix ${prefix} sous-représenté (${found} clés)`);
  }
});

// ─── Bascule EN sur sbom ─────────────────────────────────────────────────────

test('sbom — header bascule en anglais avec lang=en', silencer(async () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({
      name: 'demo', version: '1.0.0', license: 'MIT',
    }));
    let captured = '';
    const origLog = console.log;
    console.log = (...args) => { captured += args.join(' ') + '\n'; };
    setLang('en');
    try {
      await genererSbom(d);
    } finally {
      console.log = origLog;
      setLang('fr');
    }
    assert.match(captured, /SBOM summary/, 'titre EN absent');
    assert.match(captured, /Main component/);
    assert.match(captured, /Compatible with: Dependency-Track/);
    assert.match(captured, /Cyber Resilience Act EU/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('sbom — erreur sans package.json bascule en anglais', async () => {
  const d = tmp();
  try {
    setLang('en');
    try {
      await assert.rejects(
        genererSbom(d),
        /No package\.json at the root of/,
      );
    } finally { setLang('fr'); }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── Bascule EN sur import ───────────────────────────────────────────────────

test('import — erreur sans .aiad/ bascule en anglais', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.kiro/specs/x'), { recursive: true });
    writeFileSync(join(d, '.kiro/specs/x/requirements.md'), '# x\n\nbody.\n');
    setLang('en');
    try {
      await assert.rejects(importer(d), /not found|No.*aiad/i);
    } finally { setLang('fr'); }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('import — erreur source inconnue interpole en anglais', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad'));
    setLang('en');
    try {
      await assert.rejects(importer(d, { from: 'wat' }), /Unknown source: "wat"/);
    } finally { setLang('fr'); }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── Bascule EN sur templates / new ──────────────────────────────────────────

test('templates — erreur template inconnu bascule en anglais', async () => {
  const d = tmp();
  try {
    setLang('en');
    try {
      await assert.rejects(
        creerProjet('xxx', join(d, 'p')),
        /Unknown template: "xxx"/,
      );
    } finally { setLang('fr'); }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('templates — erreur dossier non vide bascule en anglais', silencer(async () => {
  const d = tmp();
  try {
    const dest = join(d, 'plein');
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, 'x.txt'), 'plein');
    setLang('en');
    try {
      await assert.rejects(
        creerProjet('node-aiad', dest),
        /is not empty\. Use --force/,
      );
    } finally { setLang('fr'); }
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

test('t() — interpolation avec variables', () => {
  setLang('fr');
  try {
    const r = t('errors.unknownCommand', { command: 'foo' });
    assert.equal(r, 'Commande inconnue : "foo"');
  } finally { setLang('fr'); }
});

test('t() — bascule globale via setLang', () => {
  setLang('fr');
  const fr = t('common.aborted');
  setLang('en');
  const en = t('common.aborted');
  setLang('fr');
  assert.equal(fr, 'Opération annulée.');
  assert.equal(en, 'Operation aborted.');
});
