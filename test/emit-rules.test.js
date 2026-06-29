// Tests d'intégration emit-rules — vérifie l'idempotence (--check) et la
// génération multi-runtime (AGENTS.md, .cursor/rules/, .codex/AGENT.md, GEMINI.md).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';
import { emitRules, extraireReglesAbsolues } from '../lib/emit-rules.js';

// (#222) Mock console.log/error/warn au lieu de process.stdout.write —
// préserve le canal de communication du test runner en mode
// `--test-isolation=process` (le runner publie ses résultats TAP/JSON sur
// stdout). Le code applicatif (term.js, console.log) passe par console.*,
// donc on intercepte la couche au-dessus.
function silencerStdout(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origErr = console.error;
    const origWarn = console.warn;
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    try { return await fn(...args); }
    finally {
      console.log = origLog;
      console.error = origErr;
      console.warn = origWarn;
    }
  };
}
function projetTemp() {
  return mkdtempSync(join(tmpdir(), 'aiad-emit-'));
}

test('emit-rules — produit AGENTS.md et le header CLAUDE.md', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});

    assert.ok(existsSync(join(dir, 'AGENTS.md')), 'AGENTS.md manquant');

    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
    assert.ok(agents.includes('AGENTS.md'));
    assert.ok(agents.includes('source-hash:'));
    assert.ok(agents.includes('TOUJOURS'));
    assert.ok(agents.includes('JAMAIS'));

    // CLAUDE.md doit contenir le header sentinel
    const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');
    assert.ok(claude.includes('aiad-emit-rules:start'));
    assert.ok(claude.includes('aiad-emit-rules:end'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules --check — exit 0 si parité respectée (init claude-code)', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});
    // init émet par défaut uniquement claude-code (AGENTS.md + CLAUDE.md header).
    // Le check doit être no-op sur ce périmètre.
    const stats = await emitRules(dir, { runtimes: ['claude-code'], check: true });
    assert.equal(stats.drifts.length, 0, `drifts inattendus : ${JSON.stringify(stats.drifts)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules --check — exit 0 si parité respectée (init runtime all)', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, { runtimes: ['all'] });
    const stats = await emitRules(dir, { runtimes: ['all'], check: true });
    assert.equal(stats.drifts.length, 0, `drifts inattendus : ${JSON.stringify(stats.drifts)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules --runtime cursor — produit les .mdc Cursor', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['cursor'] });
    assert.ok(existsSync(join(dir, '.cursor', 'rules', 'aiad.mdc')));
    assert.ok(existsSync(join(dir, '.cursor', 'rules', 'aiad-rgpd.mdc')));
    assert.ok(existsSync(join(dir, '.cursor', 'rules', 'aiad-rgaa.mdc')));
    assert.ok(existsSync(join(dir, '.cursor', 'rules', 'aiad-ai-act.mdc')));
    assert.ok(existsSync(join(dir, '.cursor', 'rules', 'aiad-rgesn.mdc')));

    const principal = readFileSync(join(dir, '.cursor', 'rules', 'aiad.mdc'), 'utf-8');
    assert.ok(principal.startsWith('---'), 'frontmatter MDC manquant');
    assert.ok(principal.includes('alwaysApply: true'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules --check — détecte une divergence après édition manuelle', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});

    // Simuler une édition manuelle d'AGENTS.md
    const path = join(dir, 'AGENTS.md');
    writeFileSync(path, readFileSync(path, 'utf-8') + '\n<!-- édit manuel sauvage -->\n', 'utf-8');

    const stats = await emitRules(dir, { runtimes: ['all'], check: true });
    assert.ok(stats.drifts.length >= 1, 'divergence non détectée');
    assert.ok(stats.drifts.some((d) => d === 'AGENTS.md'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

// ─── INCERTITUDE / JNSP ────────────────────────────────────────────────────
// Garde-fou structurant : l'agent doit pouvoir répondre "je ne sais pas".
// La section INCERTITUDE de AGENT-GUIDE.md est extraite et propagée à toutes
// les cibles multi-runtime — garantie qu'un agent Cursor/Codex/Gemini reçoit
// la même consigne JNSP qu'un agent Claude Code.

test('extraireReglesAbsolues — capture la section INCERTITUDE en plus de TOUJOURS/JAMAIS', () => {
  const guide = `## RÈGLES ABSOLUES

### TOUJOURS
- Lire l'AGENT-GUIDE
- Synchroniser SPEC et code

### JAMAIS
- Coder sans SPEC
- Pusher des secrets

### INCERTITUDE — Dire "je ne sais pas"
- JNSP est un signal valide
- Gouvernance non décidable → VETO par défaut
- Annotations @spec absentes → INCONNU

---
`;
  const regles = extraireReglesAbsolues(guide);
  assert.equal(regles.toujours.length, 2);
  assert.equal(regles.jamais.length, 2);
  assert.equal(regles.incertitude.length, 3);
  assert.ok(regles.incertitude[0].includes('JNSP'));
  assert.ok(regles.incertitude.some((l) => l.includes('VETO par défaut')));
});

test('extraireReglesAbsolues — incertitude vide si la section est absente', () => {
  const guide = `## RÈGLES ABSOLUES
### TOUJOURS
- Une règle
### JAMAIS
- Une interdiction
---
`;
  const regles = extraireReglesAbsolues(guide);
  assert.equal(regles.incertitude.length, 0);
});

test('emit-rules — propage la section INCERTITUDE/JNSP aux 5 cibles multi-runtime', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, { runtimes: ['all'] });

    const cibles = [
      join(dir, 'AGENTS.md'),
      join(dir, '.cursor', 'rules', 'aiad.mdc'),
      join(dir, '.codex', 'AGENT.md'),
      join(dir, 'GEMINI.md'),
    ];
    for (const p of cibles) {
      assert.ok(existsSync(p), `cible manquante : ${p}`);
      const contenu = readFileSync(p, 'utf-8');
      assert.ok(
        /INCERTITUDE/i.test(contenu),
        `section INCERTITUDE absente de ${p}`,
      );
      assert.ok(
        /JNSP/.test(contenu),
        `mention JNSP absente de ${p}`,
      );
    }

    // Le header CLAUDE.md référence le garde-fou même si la section
    // détaillée vit dans AGENTS.md (le header reste court par contrat).
    const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');
    assert.ok(/JNSP/.test(claude), 'rappel JNSP absent du header CLAUDE.md');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

// ─── Kiro (SPEC-023-2) ────────────────────────────────────────────────────────

test('emit-rules --runtime kiro — CA-1 : génère au moins un fichier dans .kiro/ sans erreur', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['kiro'] });
    assert.ok(existsSync(join(dir, '.kiro', 'steering', 'aiad.md')), '.kiro/steering/aiad.md manquant');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules --runtime kiro — CA-3 : steering principal contient TOUJOURS / JAMAIS / INCERTITUDE', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['kiro'] });
    const contenu = readFileSync(join(dir, '.kiro', 'steering', 'aiad.md'), 'utf-8');
    assert.ok(contenu.includes('inclusion: always'), 'frontmatter inclusion:always absent');
    assert.ok(/TOUJOURS/i.test(contenu), 'section TOUJOURS absente');
    assert.ok(/JAMAIS/i.test(contenu), 'section JAMAIS absente');
    assert.ok(/INCERTITUDE/i.test(contenu), 'section INCERTITUDE absente');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules --runtime kiro — CA-4 : --check exit 0 si à jour', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['kiro'] });
    const stats = await emitRules(dir, { runtimes: ['kiro'], check: true });
    assert.equal(stats.drifts.length, 0, `drifts inattendus : ${JSON.stringify(stats.drifts)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules --runtime kiro — CA-5 : idempotence (deux exécutions sans changement)', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['kiro'] });
    const contenu1 = readFileSync(join(dir, '.kiro', 'steering', 'aiad.md'), 'utf-8');
    await emitRules(dir, { runtimes: ['kiro'] });
    const contenu2 = readFileSync(join(dir, '.kiro', 'steering', 'aiad.md'), 'utf-8');
    assert.equal(contenu1, contenu2, 'contenu modifié à la deuxième exécution — idempotence brisée');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules --runtime all — CA-2 : inclut la génération Kiro', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, { runtimes: ['all'] });
    assert.ok(existsSync(join(dir, '.kiro', 'steering', 'aiad.md')), '.kiro/steering/aiad.md absent du --runtime all');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules — source-hash change quand seule la section INCERTITUDE est modifiée', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});
    const lireHash = () => {
      const md = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      return md.match(/source-hash:\s*([0-9a-f]+)/)?.[1] || null;
    };
    const hashAvant = lireHash();
    assert.ok(hashAvant, 'source-hash non trouvé en AGENTS.md');

    // Modifie uniquement la section INCERTITUDE de l'AGENT-GUIDE
    const guidePath = join(dir, '.aiad', 'AGENT-GUIDE.md');
    const guideAvant = readFileSync(guidePath, 'utf-8');
    const guideApres = guideAvant.replace(
      /### INCERTITUDE[^\n]*\n/,
      '### INCERTITUDE — Dire "je ne sais pas" (renforcé)\n- Nouvelle règle JNSP additionnelle\n',
    );
    assert.notEqual(guideAvant, guideApres, 'la modification du guide a échoué (section absente du template ?)');
    writeFileSync(guidePath, guideApres, 'utf-8');

    await emitRules(dir, {});
    const hashApres = lireHash();
    assert.notEqual(hashAvant, hashApres, 'source-hash inchangé alors qu\'INCERTITUDE a bougé');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));
