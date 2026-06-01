// Tests #196 — Dette technique (JNSP + SPECs > 200 LOC) sur adrs.html.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  scannerTodoJnsp, specsGrosses, specsApprochantSeuil, calculerTechDebt, blocTechDebt,
  scanTodoJnsp, largeSpecs, nearLimitSpecs, computeTechDebt, techDebtSection,
} from '../lib/dashboard/tech-debt.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-techdebt-'));
}

test('scannerTodoJnsp — projet vide → []', () => {
  const r = scannerTodoJnsp(tmpProjet());
  assert.deepEqual(r, []);
});

test('scannerTodoJnsp — détecte TODO-JNSP: dans .js .ts .py .md', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, 'src'));
    writeFileSync(join(racine, 'src', 'a.js'), '// TODO-JNSP: choisir entre Redis et Postgres\nconst x = 1;\n');
    writeFileSync(join(racine, 'src', 'b.ts'), 'const y = 2; // TODO-JNSP: format date ISO ou UNIX ?\n');
    writeFileSync(join(racine, 'src', 'c.py'), '# TODO-JNSP: niveau de log par défaut ?\n');
    writeFileSync(join(racine, 'note.md'), 'TODO-JNSP: validation par qui ?\n');
    const r = scannerTodoJnsp(racine);
    assert.equal(r.length, 4);
    const questions = r.map((m) => m.question).sort();
    assert.match(questions[0], /choisir entre/);
    assert.equal(r.every((m) => m.file && m.line), true);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('scannerTodoJnsp — ignore node_modules / dist / .git', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, 'node_modules'));
    mkdirSync(join(racine, 'dist'));
    writeFileSync(join(racine, 'node_modules', 'm.js'), 'TODO-JNSP: noise\n');
    writeFileSync(join(racine, 'dist', 'm.js'), 'TODO-JNSP: noise\n');
    const r = scannerTodoJnsp(racine);
    assert.deepEqual(r, []);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('scannerTodoJnsp — garde-fou max', () => {
  const racine = tmpProjet();
  try {
    let body = '';
    for (let i = 0; i < 10; i++) body += `// TODO-JNSP: marker ${i}\n`;
    writeFileSync(join(racine, 'big.js'), body);
    const r = scannerTodoJnsp(racine, { max: 3 });
    assert.equal(r.length, 3);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('specsGrosses — < seuil → []', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad'));
    mkdirSync(join(racine, '.aiad', 'specs'));
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-001-1-x.md'), '---\nid: SPEC-001-1-x\n---\n# Court\nLigne 1\nLigne 2\n');
    const r = specsGrosses(racine, { specs: [{ id: 'SPEC-001-1-x', file: '.aiad/specs/SPEC-001-1-x.md' }] });
    assert.deepEqual(r, []);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('specsGrosses — > seuil → détecté trié par LOC desc', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad'));
    mkdirSync(join(racine, '.aiad', 'specs'));
    // 50 lignes non vides
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-A.md'),
      '---\nid: A\n---\n' + Array(50).fill('contenu').join('\n') + '\n');
    // 80 lignes non vides
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-B.md'),
      '---\nid: B\n---\n' + Array(80).fill('contenu').join('\n') + '\n');
    const donnees = { specs: [
      { id: 'A', file: '.aiad/specs/SPEC-A.md', statut: 'ready' },
      { id: 'B', file: '.aiad/specs/SPEC-B.md', statut: 'in-progress' },
    ] };
    const r = specsGrosses(racine, donnees, { seuil: 40 });
    assert.equal(r.length, 2);
    assert.equal(r[0].id, 'B', 'plus gros en tête');
    assert.equal(r[0].loc, 80);
    assert.equal(r[1].loc, 50);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('specsGrosses — exclut le frontmatter du compte', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad'));
    mkdirSync(join(racine, '.aiad', 'specs'));
    // 5 lignes de frontmatter (entre les `---`) + 3 lignes de corps
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-FM.md'),
      '---\nid: FM\ntitre: t\nstatut: ready\n---\n\nligne1\nligne2\nligne3\n');
    const r = specsGrosses(racine, { specs: [{ id: 'FM', file: '.aiad/specs/SPEC-FM.md' }] }, { seuil: 2 });
    assert.equal(r.length, 1);
    assert.equal(r[0].loc, 3, 'seules les 3 lignes de corps comptent');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerTechDebt — agrégat shape stable', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, 'src'));
    writeFileSync(join(racine, 'src', 'a.js'), '// TODO-JNSP: déléguer ?\n');
    mkdirSync(join(racine, '.aiad'));
    mkdirSync(join(racine, '.aiad', 'specs'));
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-X.md'),
      '---\nid: X\n---\n' + Array(300).fill('x').join('\n'));
    const r = calculerTechDebt(racine, { specs: [{ id: 'X', file: '.aiad/specs/SPEC-X.md' }] });
    assert.equal(r.seuilLoc, 200);
    assert.equal(r.jnsp.total, 1);
    assert.equal(r.specsGrosses.total, 1);
    assert.equal(r.specsGrosses.entrees[0].id, 'X');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('blocTechDebt — pas de dette → section "ok"', () => {
  const html = blocTechDebt({ techDebt: {
    seuilLoc: 200,
    jnsp: { total: 0, markers: [] },
    specsGrosses: { total: 0, entrees: [] },
  } });
  assert.match(html, /Pas de dette signalée/);
  assert.match(html, /Dette technique.*0/);
});

test('blocTechDebt — JNSP + grosses → 2 blocs + 2 KPI', () => {
  const html = blocTechDebt({ techDebt: {
    seuilLoc: 200,
    jnsp: { total: 2, markers: [
      { file: 'src/a.js', line: 5, question: 'q1' },
      { file: 'src/b.ts', line: 10, question: 'q2' },
    ] },
    specsGrosses: { total: 1, entrees: [{ id: 'SPEC-X', file: '.aiad/specs/SPEC-X.md', loc: 250, statut: 'ready' }] },
  } });
  assert.match(html, /JNSP non résolus.*2/);
  assert.match(html, /SPECs > 200 LOC.*1/);
  assert.match(html, /src\/a\.js/);
  assert.match(html, /SPEC-X/);
  assert.match(html, /refactor-spec/);
});

test('blocTechDebt — sans donnees.techDebt → chaîne vide', () => {
  assert.equal(blocTechDebt({}), '');
  assert.equal(blocTechDebt({ techDebt: null }), '');
});

test('Alias EN canoniques', () => {
  assert.equal(scanTodoJnsp, scannerTodoJnsp);
  assert.equal(largeSpecs, specsGrosses);
  assert.equal(nearLimitSpecs, specsApprochantSeuil);
  assert.equal(computeTechDebt, calculerTechDebt);
  assert.equal(techDebtSection, blocTechDebt);
});

// ─── #197 Ancienneté JNSP + seuil LOC configurable ──────────────────────────

test('scannerTodoJnsp — classifie chaque marker par âge (recent/medium/stale)', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, 'src'));
    const fRecent = join(racine, 'src', 'recent.js');
    const fMedium = join(racine, 'src', 'medium.js');
    const fStale  = join(racine, 'src', 'stale.js');
    writeFileSync(fRecent, '// TODO-JNSP: récent\n');
    writeFileSync(fMedium, '// TODO-JNSP: medium\n');
    writeFileSync(fStale,  '// TODO-JNSP: ancien\n');
    const now = Date.now();
    // recent : 3 jours
    const t3 = new Date(now - 3 * 86_400_000);
    utimesSync(fRecent, t3, t3);
    // medium : 15 jours
    const t15 = new Date(now - 15 * 86_400_000);
    utimesSync(fMedium, t15, t15);
    // stale : 60 jours
    const t60 = new Date(now - 60 * 86_400_000);
    utimesSync(fStale, t60, t60);
    const r = scannerTodoJnsp(racine, { now });
    assert.equal(r.length, 3);
    const byAge = {};
    for (const m of r) byAge[m.age] = (byAge[m.age] || 0) + 1;
    assert.equal(byAge.recent, 1);
    assert.equal(byAge.medium, 1);
    assert.equal(byAge.stale, 1);
    const stale = r.find((m) => m.age === 'stale');
    assert.ok(stale.ageDays >= 59 && stale.ageDays <= 61, `stale ageDays=${stale.ageDays}`);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('specsApprochantSeuil — entre seuilWarn et seuil → warning tier', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad'));
    mkdirSync(join(racine, '.aiad', 'specs'));
    // 150 lignes : entre 100 et 200 → warning
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-W.md'),
      '---\nid: W\n---\n' + Array(150).fill('contenu').join('\n') + '\n');
    // 250 lignes : > 200 → critique (PAS warning)
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-C.md'),
      '---\nid: C\n---\n' + Array(250).fill('contenu').join('\n') + '\n');
    // 50 lignes : < 100 → ni l'un ni l'autre
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-S.md'),
      '---\nid: S\n---\n' + Array(50).fill('contenu').join('\n') + '\n');
    const donnees = { specs: [
      { id: 'W', file: '.aiad/specs/SPEC-W.md' },
      { id: 'C', file: '.aiad/specs/SPEC-C.md' },
      { id: 'S', file: '.aiad/specs/SPEC-S.md' },
    ] };
    const warning = specsApprochantSeuil(racine, donnees, { seuil: 200, seuilWarn: 100 });
    assert.equal(warning.length, 1, 'seul SPEC-W est dans la fenêtre warning');
    assert.equal(warning[0].id, 'W');
    assert.equal(warning[0].loc, 150);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('specsApprochantSeuil — seuilWarn >= seuil → garde-fou []', () => {
  const r = specsApprochantSeuil(tmpProjet(), { specs: [] }, { seuil: 100, seuilWarn: 100 });
  assert.deepEqual(r, []);
});

test('calculerTechDebt — lit seuilLoc depuis .aiad/config.json', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad'));
    mkdirSync(join(racine, '.aiad', 'specs'));
    writeFileSync(join(racine, '.aiad', 'config.json'), JSON.stringify({ techDebt: { seuilLoc: 50, seuilLocWarn: 25 } }));
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-1.md'),
      '---\nid: 1\n---\n' + Array(60).fill('x').join('\n')); // 60 LOC > 50 → critique
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-2.md'),
      '---\nid: 2\n---\n' + Array(30).fill('x').join('\n')); // 30 LOC : entre 25 et 50 → warning
    const donnees = { specs: [
      { id: '1', file: '.aiad/specs/SPEC-1.md' },
      { id: '2', file: '.aiad/specs/SPEC-2.md' },
    ] };
    const r = calculerTechDebt(racine, donnees);
    assert.equal(r.seuilLoc, 50, 'seuil lu depuis config.json');
    assert.equal(r.seuilLocWarn, 25);
    assert.equal(r.sourceSeuil, 'config');
    assert.equal(r.specsGrosses.total, 1);
    assert.equal(r.specsWarning.total, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerTechDebt — options ont précédence sur config', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad'));
    writeFileSync(join(racine, '.aiad', 'config.json'), JSON.stringify({ techDebt: { seuilLoc: 50 } }));
    const r = calculerTechDebt(racine, { specs: [] }, { seuil: 300 });
    assert.equal(r.seuilLoc, 300);
    assert.equal(r.sourceSeuil, 'options');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerTechDebt — config invalide (json cassé) → fallback défaut', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad'));
    writeFileSync(join(racine, '.aiad', 'config.json'), '{ not json');
    const r = calculerTechDebt(racine, { specs: [] });
    assert.equal(r.seuilLoc, 200);
    assert.equal(r.sourceSeuil, 'default');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerTechDebt — jnsp.parAge présent dans la sortie', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, 'src'));
    writeFileSync(join(racine, 'src', 'a.js'), '// TODO-JNSP: q1\n');
    const t = new Date(Date.now() - 60 * 86_400_000);
    utimesSync(join(racine, 'src', 'a.js'), t, t);
    const r = calculerTechDebt(racine, { specs: [] });
    assert.equal(r.jnsp.parAge.stale, 1);
    assert.equal(r.jnsp.parAge.recent, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('blocTechDebt — KPI age "X oubliés" affiché si stale > 0', () => {
  const html = blocTechDebt({ techDebt: {
    seuilLoc: 200,
    seuilLocWarn: 100,
    sourceSeuil: 'default',
    jnsp: { total: 5, markers: [
      { file: 'a.js', line: 1, question: 'q1', age: 'stale', ageDays: 50 },
      { file: 'b.js', line: 1, question: 'q2', age: 'stale', ageDays: 80 },
      { file: 'c.js', line: 1, question: 'q3', age: 'medium', ageDays: 15 },
      { file: 'd.js', line: 1, question: 'q4', age: 'recent', ageDays: 3 },
      { file: 'e.js', line: 1, question: 'q5', age: 'recent', ageDays: 1 },
    ], parAge: { stale: 2, medium: 1, recent: 2, unknown: 0 } },
    specsGrosses: { total: 0, entrees: [] },
    specsWarning: { total: 0, entrees: [] },
  } });
  assert.match(html, /2 oubliés/);
  assert.match(html, /&gt; 30j/);
  assert.match(html, /7-30j/);
  // Tri stale en tête
  const idxStale = html.indexOf('q2');
  const idxRecent = html.indexOf('q4');
  assert.ok(idxStale < idxRecent, 'stale rendu avant recent');
});

test('blocTechDebt — warning block affiché quand specsWarning.total > 0', () => {
  const html = blocTechDebt({ techDebt: {
    seuilLoc: 200,
    seuilLocWarn: 100,
    sourceSeuil: 'default',
    jnsp: { total: 0, markers: [], parAge: {} },
    specsGrosses: { total: 0, entrees: [] },
    specsWarning: { total: 1, entrees: [{ id: 'SPEC-NW', file: 'a.md', loc: 150, statut: 'ready' }] },
  } });
  assert.match(html, /à surveiller/);
  assert.match(html, /SPECs > 100 LOC/);
  assert.match(html, /SPEC-NW/);
});

// (#311) JNSP rows : fichier + ligne hyperliés vers `FILE#LNN`.
test('#311 blocTechDebt — markers JNSP avec fichier+ligne hyperliés (anchor #LNN)', () => {
  const debt = {
    seuilLoc: 50,
    seuilLocWarn: 25,
    jnsp: { total: 1, markers: [{ file: 'src/auth.ts', line: 42, question: 'OIDC ou SAML ?', age: 'medium', ageDays: 12 }], parAge: {} },
    specsGrosses: { total: 0, entrees: [] },
    specsWarning: { total: 0, entrees: [] },
  };
  const html = blocTechDebt({ techDebt: debt });
  assert.match(html, /href="\.\.\/src\/auth\.ts#L42"/);
  assert.match(html, />L42<\/a>/);
});

test('blocTechDebt — source seuil exposée (config / option CLI)', () => {
  const baseDebt = {
    seuilLoc: 50,
    seuilLocWarn: 25,
    jnsp: { total: 0, markers: [], parAge: {} },
    specsGrosses: { total: 1, entrees: [{ id: 'X', file: '.aiad/specs/SPEC-X.md', loc: 60, statut: 'ready' }] },
    specsWarning: { total: 0, entrees: [] },
  };
  const htmlCfg = blocTechDebt({ techDebt: { ...baseDebt, sourceSeuil: 'config' } });
  assert.match(htmlCfg, /\(config projet\)/);
  const htmlOpt = blocTechDebt({ techDebt: { ...baseDebt, sourceSeuil: 'options' } });
  assert.match(htmlOpt, /\(option CLI\)/);
});
