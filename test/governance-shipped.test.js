// @intent INTENT-034
// @spec SPEC-034-1b-update-ecrase-signale
//
// Tests SPEC-034-1b — `update` écrase les agents de gouvernance mais signale :
// manifeste `.aiad-shipped.json`, sauvegarde `.bak-<date>` des agents modifiés
// localement, message de fin de bloc, `update --check` sans écriture.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { init } from '../lib/init.js';
import { update } from '../lib/update.js';
import { listShippedAgents, MANIFEST_NAME } from '../lib/governance-shipped.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOUV_SRC = join(__dirname, '..', 'templates', '.aiad', 'gouvernance');
const DATE = '2026-09-26';

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const tmp = () => mkdtempSync(join(tmpdir(), 'aiad-gouv-shipped-'));
const gouv = (dir, ...p) => join(dir, '.aiad', 'gouvernance', ...p);
const template = (f) => readFileSync(join(GOUV_SRC, f), 'utf-8');

// Capture console.* (même approche que test/update.test.js) et renvoie la sortie.
async function capturer(fn) {
  const lignes = [];
  const orig = { log: console.log, error: console.error, warn: console.warn };
  console.log = (...a) => lignes.push(a.join(' '));
  console.error = () => {};
  console.warn = () => {};
  try { await fn(); } finally { Object.assign(console, orig); }
  // Retire les séquences ANSI pour des assertions stables.
  return lignes.join('\n').replace(/\x1b\[[0-9;]*m/g, '');
}

function empreintesDossier(dir) {
  const out = {};
  for (const f of readdirSync(dir).sort()) out[f] = sha(readFileSync(join(dir, f)));
  return out;
}

test('CA-001 — init écrit .aiad-shipped.json avec une empreinte par agent installé', async () => {
  const dir = tmp();
  try {
    await capturer(() => init(dir, {}));
    const manifeste = JSON.parse(readFileSync(gouv(dir, MANIFEST_NAME), 'utf-8'));
    const agents = listShippedAgents();
    assert.ok(agents.length >= 5, 'agents livrés attendus');
    assert.deepEqual(Object.keys(manifeste).sort(), agents);
    for (const f of agents) {
      assert.ok(existsSync(gouv(dir, f)), `${f} installé`);
      assert.equal(manifeste[f], sha(readFileSync(join(GOUV_SRC, f))), `empreinte livrée de ${f}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CA-002 / CA-004 — agent modifié : sauvegarde exacte, écrasement, message sur stdout', async () => {
  const dir = tmp();
  try {
    await capturer(() => init(dir, {}));
    const local = template('AIAD-RGPD.md') + '\n<!-- adaptation locale -->\n';
    writeFileSync(gouv(dir, 'AIAD-RGPD.md'), local, 'utf-8');

    const sortie = await capturer(() => update(dir, { date: DATE }));

    const bak = gouv(dir, `AIAD-RGPD.md.bak-${DATE}`);
    assert.ok(existsSync(bak), 'sauvegarde créée');
    assert.equal(readFileSync(bak, 'utf-8'), local, 'contenu local exact');
    assert.equal(readFileSync(gouv(dir, 'AIAD-RGPD.md'), 'utf-8'), template('AIAD-RGPD.md'), 'agent remplacé par le gabarit');

    assert.ok(sortie.includes('⚠ 1 agent(s) modifié(s) localement — sauvegardé(s) avant mise à jour :'), sortie);
    assert.ok(sortie.includes(`      AIAD-RGPD.md → .aiad/gouvernance/AIAD-RGPD.md.bak-${DATE}`), sortie);
    assert.ok(sortie.includes('    Reportez vos adaptations dans les agents mis à jour.'), sortie);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CA-003 — agent non modifié : remplacé sans sauvegarde ni message', async () => {
  const dir = tmp();
  try {
    await capturer(() => init(dir, {}));
    const sortie = await capturer(() => update(dir, { date: DATE }));
    const baks = readdirSync(gouv(dir)).filter((f) => f.includes('.bak-'));
    assert.deepEqual(baks, []);
    assert.ok(!sortie.includes('modifié(s) localement'), 'aucun message attendu');
    for (const f of listShippedAgents()) {
      assert.equal(readFileSync(gouv(dir, f), 'utf-8'), template(f));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CA-003 — manifeste présent : l’empreinte enregistrée fait foi (pas le nouveau gabarit)', async () => {
  const dir = tmp();
  try {
    await capturer(() => init(dir, {}));
    // Simule une version précédente du package : l'agent local est tel que
    // livré à l'époque (empreinte enregistrée), différent du gabarit actuel.
    const ancien = '# AIAD-RGAA — ancienne version livrée\n';
    writeFileSync(gouv(dir, 'AIAD-RGAA.md'), ancien, 'utf-8');
    const manifeste = JSON.parse(readFileSync(gouv(dir, MANIFEST_NAME), 'utf-8'));
    manifeste['AIAD-RGAA.md'] = sha(Buffer.from(ancien, 'utf-8'));
    writeFileSync(gouv(dir, MANIFEST_NAME), JSON.stringify(manifeste), 'utf-8');

    await capturer(() => update(dir, { date: DATE }));

    assert.ok(!existsSync(gouv(dir, `AIAD-RGAA.md.bak-${DATE}`)), 'agent non modifié localement : pas de sauvegarde');
    assert.equal(readFileSync(gouv(dir, 'AIAD-RGAA.md'), 'utf-8'), template('AIAD-RGAA.md'));
    // Manifeste réécrit avec les empreintes livrées actuelles.
    const apres = JSON.parse(readFileSync(gouv(dir, MANIFEST_NAME), 'utf-8'));
    assert.equal(apres['AIAD-RGAA.md'], sha(readFileSync(join(GOUV_SRC, 'AIAD-RGAA.md'))));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CA-005 — sans manifeste : agent différent du gabarit sauvegardé, identique non', async () => {
  const dir = tmp();
  try {
    await capturer(() => init(dir, {}));
    rmSync(gouv(dir, MANIFEST_NAME));
    const local = '# AIAD-RGESN — adapté localement\n';
    writeFileSync(gouv(dir, 'AIAD-RGESN.md'), local, 'utf-8');

    await capturer(() => update(dir, { date: DATE }));

    assert.equal(readFileSync(gouv(dir, `AIAD-RGESN.md.bak-${DATE}`), 'utf-8'), local);
    assert.ok(!existsSync(gouv(dir, `AIAD-RGPD.md.bak-${DATE}`)), 'agent identique non sauvegardé');
    assert.ok(existsSync(gouv(dir, MANIFEST_NAME)), 'manifeste réécrit');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cas limite 4 — manifeste illisible : traité comme absent, puis réécrit', async () => {
  const dir = tmp();
  try {
    await capturer(() => init(dir, {}));
    writeFileSync(gouv(dir, MANIFEST_NAME), '{ pas du json', 'utf-8');
    const local = template('AIAD-AI-ACT.md') + '\nlocal\n';
    writeFileSync(gouv(dir, 'AIAD-AI-ACT.md'), local, 'utf-8');

    await capturer(() => update(dir, { date: DATE }));

    assert.equal(readFileSync(gouv(dir, `AIAD-AI-ACT.md.bak-${DATE}`), 'utf-8'), local);
    assert.ok(!existsSync(gouv(dir, `AIAD-RGPD.md.bak-${DATE}`)));
    const manifeste = JSON.parse(readFileSync(gouv(dir, MANIFEST_NAME), 'utf-8'));
    assert.deepEqual(Object.keys(manifeste).sort(), listShippedAgents());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CA-006 — deux update le même jour : deux sauvegardes distinctes (-2)', async () => {
  const dir = tmp();
  try {
    await capturer(() => init(dir, {}));
    const v1 = template('AIAD-RGPD.md') + '\nv1\n';
    writeFileSync(gouv(dir, 'AIAD-RGPD.md'), v1, 'utf-8');
    await capturer(() => update(dir, { date: DATE }));

    const v2 = template('AIAD-RGPD.md') + '\nv2\n';
    writeFileSync(gouv(dir, 'AIAD-RGPD.md'), v2, 'utf-8');
    const sortie = await capturer(() => update(dir, { date: DATE }));

    assert.equal(readFileSync(gouv(dir, `AIAD-RGPD.md.bak-${DATE}`), 'utf-8'), v1, 'première sauvegarde intacte');
    assert.equal(readFileSync(gouv(dir, `AIAD-RGPD.md.bak-${DATE}-2`), 'utf-8'), v2);
    assert.ok(sortie.includes(`AIAD-RGPD.md → .aiad/gouvernance/AIAD-RGPD.md.bak-${DATE}-2`), sortie);

    // Troisième passage → -3
    writeFileSync(gouv(dir, 'AIAD-RGPD.md'), 'v3\n', 'utf-8');
    await capturer(() => update(dir, { date: DATE }));
    assert.equal(readFileSync(gouv(dir, `AIAD-RGPD.md.bak-${DATE}-3`), 'utf-8'), 'v3\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CA-007 — update --check n’écrit aucun fichier (ni sauvegarde, ni manifeste)', async () => {
  const dir = tmp();
  try {
    await capturer(() => init(dir, {}));
    writeFileSync(gouv(dir, 'AIAD-RGPD.md'), template('AIAD-RGPD.md') + '\nlocal\n', 'utf-8');
    rmSync(gouv(dir, MANIFEST_NAME));
    const avant = empreintesDossier(gouv(dir));

    let stats;
    await capturer(async () => { stats = await update(dir, { check: true, date: DATE }); });
    assert.ok(stats.drifts.some((d) => d.endsWith('AIAD-RGPD.md')), 'divergence toujours listée');

    assert.deepEqual(empreintesDossier(gouv(dir)), avant);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CA-008 — agent absent du package : inchangé et non sauvegardé', async () => {
  const dir = tmp();
  try {
    await capturer(() => init(dir, {}));
    const custom = '# AIAD-CUSTOM — agent maison\n';
    writeFileSync(gouv(dir, 'AIAD-CUSTOM.md'), custom, 'utf-8');

    await capturer(() => update(dir, { date: DATE }));

    assert.equal(readFileSync(gouv(dir, 'AIAD-CUSTOM.md'), 'utf-8'), custom);
    assert.deepEqual(readdirSync(gouv(dir)).filter((f) => f.startsWith('AIAD-CUSTOM.md.bak')), []);
    const manifeste = JSON.parse(readFileSync(gouv(dir, MANIFEST_NAME), 'utf-8'));
    assert.ok(!('AIAD-CUSTOM.md' in manifeste));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
