// Tests pack gouvernance LATAM — BR-LGPD / MX-LFPDPPP (#100).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS, packExiste, listerPacks, installerPack } from '../lib/governance-packs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = join(__dirname, '..', 'templates', '.aiad', 'gouvernance-packs');
const LATAM_DIR = join(PACKS_DIR, 'latam-baseline');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-latam-')); }
function silencer(fn) {
  return async (...args) => {
    const ol = console.log;
    const ow = process.stdout.write.bind(process.stdout);
    console.log = () => {}; process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { console.log = ol; process.stdout.write = ow; }
  };
}

// ─── Registration ──────────────────────────────────────────────────────────

test('PACKS — latam-baseline enregistré', () => {
  assert.ok(packExiste('latam-baseline'));
  assert.equal(PACKS['latam-baseline'].juridiction, 'Amérique latine (BR/MX)');
  assert.equal(PACKS['latam-baseline'].defaut, false);
});

test('listerPacks — latam-baseline présent', () => {
  const liste = listerPacks();
  assert.ok(liste.find((p) => p.id === 'latam-baseline'));
});

// ─── Templates ─────────────────────────────────────────────────────────────

test('templates latam — 2 agents Tier 1 livrés', () => {
  assert.ok(existsSync(LATAM_DIR));
  const fichiers = readdirSync(LATAM_DIR).filter((f) => f.endsWith('.md'));
  for (const a of ['AIAD-BR-LGPD.md', 'AIAD-MX-LFPDPPP.md']) {
    assert.ok(fichiers.includes(a), `${a} manquant`);
  }
});

test('templates latam — structure valide (MISSION/DÉCLENCHEURS/TOUJOURS/JAMAIS/Veto)', () => {
  for (const f of ['AIAD-BR-LGPD.md', 'AIAD-MX-LFPDPPP.md']) {
    const c = readFileSync(join(LATAM_DIR, f), 'utf-8');
    assert.match(c, /## MISSION/, `${f} : MISSION absente`);
    assert.match(c, /## DÉCLENCHEURS/, `${f} : DÉCLENCHEURS absent`);
    assert.match(c, /TOUJOURS/, `${f} : TOUJOURS absent`);
    assert.match(c, /JAMAIS/, `${f} : JAMAIS absent`);
    assert.match(c, /Droit de veto.*oui/i, `${f} : veto Tier 1 non déclaré`);
  }
});

test('templates latam — BR-LGPD cite ANPD + Encarregado + 10 bases légales + sensíveis', () => {
  const c = readFileSync(join(LATAM_DIR, 'AIAD-BR-LGPD.md'), 'utf-8');
  assert.match(c, /ANPD/);
  assert.match(c, /Encarregado/);
  assert.match(c, /10 bases (légales|legales)/i);
  assert.match(c, /dados (pessoais )?sensíveis/i);
  assert.match(c, /R\$ 50M|R\$ ?50/);
  assert.match(c, /RIPD|Relatório de Impacto/);
});

test('templates latam — MX-LFPDPPP cite INAI + Aviso + ARCO + sensibles écrit', () => {
  const c = readFileSync(join(LATAM_DIR, 'AIAD-MX-LFPDPPP.md'), 'utf-8');
  assert.match(c, /INAI/);
  assert.match(c, /Aviso de Privacidad/);
  assert.match(c, /ARCO/);
  assert.match(c, /20 (días|jours) ouvrés|20 días hábiles|20 jours/i);
  assert.match(c, /datos (personales )?sensibles/i);
  assert.match(c, /MXN 26|26 millones|26 millions/i);
});

test('templates latam — chaque agent référence l\'autorité de contrôle', () => {
  assert.match(readFileSync(join(LATAM_DIR, 'AIAD-BR-LGPD.md'), 'utf-8'), /gov\.br\/anpd/i);
  assert.match(readFileSync(join(LATAM_DIR, 'AIAD-MX-LFPDPPP.md'), 'utf-8'), /inai\.org\.mx|home\.inai/i);
});

// ─── Installation ──────────────────────────────────────────────────────────

test('installerPack latam-baseline — copie les 2 agents', silencer(async () => {
  const d = tmp();
  try {
    await installerPack(d, 'latam-baseline', { silencieux: true });
    const govDir = join(d, '.aiad', 'gouvernance');
    assert.ok(existsSync(govDir));
    for (const f of ['AIAD-BR-LGPD.md', 'AIAD-MX-LFPDPPP.md']) {
      assert.ok(existsSync(join(govDir, f)), `${f} non installé`);
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerPack latam-baseline --dry-run — n\'écrit rien', silencer(async () => {
  const d = tmp();
  try {
    await installerPack(d, 'latam-baseline', { silencieux: true, dryRun: true });
    const govDir = join(d, '.aiad', 'gouvernance');
    assert.ok(!existsSync(govDir) || readdirSync(govDir).length === 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));
