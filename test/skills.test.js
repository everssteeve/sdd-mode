// Tests `aiad-sdd skills validate`. Vérifie qu'une skill sans description
// déclencheuse est détectée AVANT que Claude Code l'ignore silencieusement.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { listerSkills, validerSkill, validerSkills } from '../lib/skills.js';
import { init } from '../lib/init.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-skills-')); }

function ecrireSkill(racine, nom, contenu) {
  const dir = join(racine, '.claude', 'skills', nom);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), contenu, 'utf-8');
}

const SKILL_VALIDE = `---
name: ma-skill
description: Use when checking that the matrix of traceability is consistent across files.
---

# Ma skill

Description longue de la skill et de ses déclencheurs et de son fonctionnement.
`;

test('listerSkills — projet vierge → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(listerSkills(d), []);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('listerSkills — détecte les SKILL.md dans .claude/skills/<name>/', () => {
  const d = tmp();
  try {
    ecrireSkill(d, 'a', SKILL_VALIDE);
    ecrireSkill(d, 'b', SKILL_VALIDE);
    // Faux positif à exclure : pas de SKILL.md
    mkdirSync(join(d, '.claude', 'skills', 'pas-de-skill'), { recursive: true });
    writeFileSync(join(d, '.claude', 'skills', 'pas-de-skill', 'README.md'), 'rien');

    const liste = listerSkills(d);
    assert.equal(liste.length, 2);
    assert.ok(liste.some((p) => p.endsWith('a/SKILL.md')));
    assert.ok(liste.some((p) => p.endsWith('b/SKILL.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('validerSkill — skill valide → ok=true', () => {
  const d = tmp();
  try {
    ecrireSkill(d, 'ok-skill', SKILL_VALIDE);
    const r = validerSkill(join(d, '.claude', 'skills', 'ok-skill', 'SKILL.md'));
    assert.equal(r.ok, true);
    assert.equal(r.name, 'ma-skill');
    assert.deepEqual(r.raisons, []);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('validerSkill — pas de frontmatter → invalide', () => {
  const d = tmp();
  try {
    ecrireSkill(d, 'no-fm', '# Pas de frontmatter\n\nCorps libre suffisamment long pour passer le seuil.');
    const r = validerSkill(join(d, '.claude', 'skills', 'no-fm', 'SKILL.md'));
    assert.equal(r.ok, false);
    assert.ok(r.raisons.some((m) => /frontmatter/i.test(m)));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('validerSkill — description manquante → invalide', () => {
  const d = tmp();
  try {
    ecrireSkill(d, 'no-desc', `---
name: foo
---

# Foo

Une skill sans description suffisante mais avec un corps assez long pour passer le minimum.
`);
    const r = validerSkill(join(d, '.claude', 'skills', 'no-desc', 'SKILL.md'));
    assert.equal(r.ok, false);
    assert.ok(r.raisons.some((m) => /description/i.test(m)));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('validerSkill — description trop courte → invalide', () => {
  const d = tmp();
  try {
    ecrireSkill(d, 'short-desc', `---
name: foo
description: Trop court
---

# Foo

Corps long pour ne pas faire échouer la règle 50-caractères du body : suffisant ici.
`);
    const r = validerSkill(join(d, '.claude', 'skills', 'short-desc', 'SKILL.md'));
    assert.equal(r.ok, false);
    assert.ok(r.raisons.some((m) => /trop courte/i.test(m)));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('validerSkill — description > 1536 caractères → invalide (§3.7)', () => {
  const d = tmp();
  try {
    const longue = 'Use when '.padEnd(1600, 'x');
    ecrireSkill(d, 'long-desc', `---
name: foo
description: ${longue}
---

# Foo

Corps long pour ne pas faire échouer la règle 50-caractères du body : suffisant ici.
`);
    const r = validerSkill(join(d, '.claude', 'skills', 'long-desc', 'SKILL.md'));
    assert.equal(r.ok, false);
    assert.ok(r.raisons.some((m) => /trop longue|plafond/i.test(m)));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('skills réelles — toutes les descriptions ≤ 1536 (budget §3.7)', () => {
  const racine = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
  const skills = listerSkills(racine);
  assert.ok(skills.length > 0, 'des skills doivent exister dans templates/.claude/skills/');
  for (const s of skills) {
    const r = validerSkill(s);
    assert.ok(!r.raisons.some((m) => /trop longue/i.test(m)), `${r.name} : description ≤ 1536`);
  }
});

test('validerSkill — name manquant → invalide', () => {
  const d = tmp();
  try {
    ecrireSkill(d, 'no-name', `---
description: Une description suffisamment longue pour passer le seuil minimum imposé par Claude.
---

# Test

Corps long pour ne pas faire échouer la règle 50-caractères du body : suffisant ici.
`);
    const r = validerSkill(join(d, '.claude', 'skills', 'no-name', 'SKILL.md'));
    assert.equal(r.ok, false);
    assert.ok(r.raisons.some((m) => /name/i.test(m)));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('validerSkills — sortie JSON conforme', silencer(async () => {
  const d = tmp();
  try {
    ecrireSkill(d, 'a', SKILL_VALIDE);
    ecrireSkill(d, 'b', '---\nname: b\n---\n\nVide');

    const orig = process.stdout.write.bind(process.stdout);
    let buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    let r;
    try {
      r = await validerSkills(d, { json: true });
    } finally {
      process.stdout.write = orig;
    }
    const parsed = JSON.parse(buf);
    assert.equal(parsed.total, 2);
    assert.equal(parsed.valid, 1);
    assert.equal(parsed.ok, false);
    assert.equal(typeof r.ok, 'boolean');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('validerSkills — projet aiad-sdd init complet → toutes valides', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await validerSkills(d, {});
    assert.equal(r.ok, true, `skills invalides : ${JSON.stringify(r.results.filter(x => !x.ok), null, 2)}`);
    assert.ok(r.total >= 7); // 8 skills livrées par défaut
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));
