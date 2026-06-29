// @intent INTENT-027
// @spec SPEC-027-2-calculate-cycle-time
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { calculateCycleTimeDaysFromSpec } from '../lib/dora-record.js';

const CLI = join(import.meta.dirname, '..', 'bin', 'aiad-sdd.js');

function fixture(specs = []) {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-dora-auto-'));
  mkdirSync(join(dir, '.aiad', 'specs', 'archive'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'metrics', 'deployments'), { recursive: true });
  for (const { name, content, archive = false } of specs) {
    const d = archive ? join(dir, '.aiad', 'specs', 'archive') : join(dir, '.aiad', 'specs');
    writeFileSync(join(d, name), content, 'utf8');
  }
  return dir;
}

function specFM(validatedAt) {
  return `---\nid: SPEC-test\nstatut: done\nvalidated_at: "${validatedAt}"\n---\n\n# Body\n`;
}

function specNoFM() {
  return `---\nid: SPEC-test\nstatut: done\n---\n\n# Body\n`;
}

test('dora-auto CA-001 — calcul nominal : cycle_time_days = round(diff / 86400000, 1)', () => {
  const dir = fixture([{ name: 'SPEC-T-1-test.md', content: specFM('2026-01-01T00:00:00.000Z') }]);
  try {
    const deployDate = new Date('2026-01-06T00:00:00.000Z'); // 5 jours plus tard
    const result = calculateCycleTimeDaysFromSpec(dir, deployDate);
    assert.strictEqual(result, 5.0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('dora-auto CA-002 — résultat négatif remplacé par zéro', () => {
  const dir = fixture([{ name: 'SPEC-T-1-test.md', content: specFM('2026-01-10T00:00:00.000Z') }]);
  try {
    const deployDate = new Date('2026-01-05T00:00:00.000Z'); // antérieur à validated_at
    const result = calculateCycleTimeDaysFromSpec(dir, deployDate);
    assert.strictEqual(result, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('dora-auto CA-003 — aucun validated_at : retourne null', () => {
  const dir = fixture([
    { name: 'SPEC-T-1-no-fm.md', content: specNoFM() },
    { name: 'SPEC-T-2-no-fm.md', content: '# Just markdown\n' },
  ]);
  try {
    const result = calculateCycleTimeDaysFromSpec(dir, new Date());
    assert.strictEqual(result, null);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('dora-auto CA-004a — priorité --cycle sur --auto : valeur --cycle utilisée dans le fichier', () => {
  const dir = fixture([{ name: 'SPEC-T-1-test.md', content: specFM('2026-01-01T00:00:00.000Z') }]);
  try {
    const r = spawnSync(
      process.execPath,
      [CLI, 'dora', '--record', '--auto', '--cycle=7', '--status=success', '--release=test-v1'],
      { cwd: dir, encoding: 'utf8' },
    );
    assert.strictEqual(r.status, 0, `exit non-0 : ${r.stderr}`);
    const files = readdirSync(join(dir, '.aiad', 'metrics', 'deployments'));
    assert.ok(files.length > 0, 'aucun fichier déploiement créé');
    const content = readFileSync(join(dir, '.aiad', 'metrics', 'deployments', files[0]), 'utf8');
    assert.ok(content.includes('cycle_time_days: 7'), `cycle_time_days 7 attendu, contenu : ${content}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('dora-auto CA-004b — priorité --cycle sur --auto : warning affiché sur stderr', () => {
  const dir = fixture([{ name: 'SPEC-T-1-test.md', content: specFM('2026-01-01T00:00:00.000Z') }]);
  try {
    const r = spawnSync(
      process.execPath,
      [CLI, 'dora', '--record', '--auto', '--cycle=7', '--status=success', '--release=test-v1'],
      { cwd: dir, encoding: 'utf8' },
    );
    assert.ok(r.stderr.includes('écrase --auto'), `warning "écrase --auto" attendu sur stderr, reçu : ${r.stderr}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('dora-auto CA-005 — arrondi à exactement une décimale', () => {
  // 4.512345 jours en ms
  const diffMs = Math.round(4.512345 * 86400000);
  const validatedAt = new Date('2026-01-01T00:00:00.000Z');
  const deployDate = new Date(Number(validatedAt) + diffMs);
  const dir = fixture([{ name: 'SPEC-T-1-test.md', content: specFM(validatedAt.toISOString()) }]);
  try {
    const result = calculateCycleTimeDaysFromSpec(dir, deployDate);
    // Math.round(4.512345 * 10) / 10 = Math.round(45.12345) / 10 = 45 / 10 = 4.5
    assert.strictEqual(result, 4.5);
    // Vérifier format : pas plus d'une décimale
    assert.match(String(result), /^\d+(\.\d)?$/, 'format attendu : N ou N.N');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('dora-auto CA-006 — date paramétrable : --date=YYYY-MM-DD parsé en UTC minuit', () => {
  const validatedAt = '2026-01-01T00:00:00.000Z';
  const dir = fixture([{ name: 'SPEC-T-1-test.md', content: specFM(validatedAt) }]);
  try {
    // --date=2026-01-06 → 5.0 jours depuis validated_at
    const r = spawnSync(
      process.execPath,
      [CLI, 'dora', '--record', '--auto', '--status=success', '--release=test-v1', '--date=2026-01-06'],
      { cwd: dir, encoding: 'utf8' },
    );
    assert.strictEqual(r.status, 0, `exit non-0 : ${r.stderr}`);
    const files = readdirSync(join(dir, '.aiad', 'metrics', 'deployments'));
    const content = readFileSync(join(dir, '.aiad', 'metrics', 'deployments', files[0]), 'utf8');
    assert.ok(content.includes('cycle_time_days: 5'), `cycle_time_days 5 attendu, contenu : ${content}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
