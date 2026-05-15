// Tests `lib/governance-lint.js` — détection de contradictions inter-agents Tier 1.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  tokenizer,
  similariteJaccard,
  extraireRegles,
  chargerAgents,
  detecterConflits,
  detecterDoublons,
  detecterAgentsManquants,
  lintGouvernance,
  // alias EN
  tokenize,
  jaccardSimilarity,
  extractRules,
  loadAgents,
  detectConflicts,
  detectDuplicates,
  detectMissingAgents,
  lintGovernance,
} from '../lib/governance-lint.js';
import { init } from '../lib/init.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-gov-lint-')); }

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

// ─── tokenizer ──────────────────────────────────────────────────────────────

test('tokenizer — retire stop words FR + EN', () => {
  const t = tokenizer('Le système doit toujours chiffrer la donnée');
  assert.ok(!t.includes('le'));
  assert.ok(!t.includes('la'));
  assert.ok(!t.includes('toujours'));
  assert.ok(t.includes('systeme'));
  assert.ok(t.includes('chiffrer'));
  assert.ok(t.includes('donnee'));
});

test('tokenizer — minuscules + normalisation NFD', () => {
  const t = tokenizer('Données Personnelles ÉTÉ');
  assert.ok(t.includes('donnees'));
  assert.ok(t.includes('personnelles'));
  // 'été' → 'ete' (4 chars donc inclus, mais 'ete' n'est pas dans stop words)
  assert.ok(t.includes('ete'));
});

test('tokenizer — exclut les mots < 3 chars', () => {
  const t = tokenizer('a b cd ef gh');
  // 'cd', 'ef', 'gh' sont 2 chars → exclus
  assert.deepEqual(t, []);
});

test('tokenizer — retire les **TOUJOURS** / **JAMAIS** / `code`', () => {
  const t = tokenizer('- **TOUJOURS** chiffrer le `password` en transit');
  // "TOUJOURS" est entre **, retiré ; "password" est dans `code`, retiré.
  assert.ok(!t.includes('toujours'));
  assert.ok(!t.includes('password'));
  assert.ok(t.includes('chiffrer'));
  assert.ok(t.includes('transit'));
});

// ─── similariteJaccard ─────────────────────────────────────────────────────

test('similariteJaccard — ensembles identiques → 1', () => {
  assert.equal(similariteJaccard(['a', 'b', 'c'], ['a', 'b', 'c']), 1);
});

test('similariteJaccard — ensembles disjoints → 0', () => {
  assert.equal(similariteJaccard(['a', 'b'], ['c', 'd']), 0);
});

test('similariteJaccard — chevauchement partiel', () => {
  // {a,b,c} ∩ {b,c,d} = {b,c}, ∪ = {a,b,c,d} → 2/4 = 0.5
  assert.equal(similariteJaccard(['a', 'b', 'c'], ['b', 'c', 'd']), 0.5);
});

test('similariteJaccard — vide → 0', () => {
  assert.equal(similariteJaccard([], []), 0);
  assert.equal(similariteJaccard(['x'], []), 0);
});

// ─── extraireRegles ────────────────────────────────────────────────────────

test('extraireRegles — extrait TOUJOURS / JAMAIS et ignore le reste', () => {
  const c = `
## RÈGLES ABSOLUES — TOUJOURS

- **TOUJOURS** chiffrer les données en transit
- **TOUJOURS** valider les inputs

## RÈGLES ABSOLUES — JAMAIS

- **JAMAIS** stocker les mots de passe en clair
- **JAMAIS** désactiver TLS

Texte hors règles, à ignorer.
`;
  const r = extraireRegles(c);
  assert.equal(r.toujours.length, 2);
  assert.equal(r.jamais.length, 2);
  assert.match(r.toujours[0], /chiffrer/);
  assert.match(r.jamais[0], /stocker/);
});

test('extraireRegles — accepte les variantes ALWAYS / NEVER', () => {
  const c = `- **ALWAYS** encrypt at rest
- **NEVER** disable TLS`;
  const r = extraireRegles(c);
  assert.equal(r.toujours.length, 1);
  assert.equal(r.jamais.length, 1);
});

test('extraireRegles — fichier sans règles → tableaux vides', () => {
  assert.deepEqual(extraireRegles('# Title\n\nNo rules here.'), { toujours: [], jamais: [] });
});

// ─── detecterConflits ──────────────────────────────────────────────────────

test('detecterConflits — TOUJOURS de A vs JAMAIS de B avec mêmes mots clés', () => {
  const agents = [
    {
      id: 'AIAD-A',
      regles: { toujours: ['- **TOUJOURS** stocker les logs salariés pendant un an minimum'], jamais: [] },
    },
    {
      id: 'AIAD-B',
      regles: { toujours: [], jamais: ['- **JAMAIS** stocker les logs salariés au-delà du strict nécessaire mensuel'] },
    },
  ];
  const conflits = detecterConflits(agents, { seuilSimilarite: 0.3, minTokensCommuns: 2 });
  assert.ok(conflits.length >= 1);
  assert.equal(conflits[0].a, 'AIAD-A');
  assert.equal(conflits[0].b, 'AIAD-B');
  assert.ok(conflits[0].tokensCommuns.includes('stocker'));
});

test('detecterConflits — règles dissemblables → aucun conflit', () => {
  const agents = [
    { id: 'A', regles: { toujours: ['- **TOUJOURS** chiffrer en transit'], jamais: [] } },
    { id: 'B', regles: { toujours: [], jamais: ['- **JAMAIS** désactiver les logs'] } },
  ];
  const conflits = detecterConflits(agents);
  assert.equal(conflits.length, 0);
});

test('detecterConflits — pas de comparaison agent vs lui-même', () => {
  const agents = [
    {
      id: 'A',
      regles: {
        toujours: ['- **TOUJOURS** logger les accès'],
        jamais: ['- **JAMAIS** logger les accès'], // contradiction interne sur le même agent
      },
    },
  ];
  const conflits = detecterConflits(agents);
  assert.equal(conflits.length, 0, 'détection inter-agents seulement');
});

test('detecterConflits — déduplication symétrique', () => {
  const r1 = ['- **TOUJOURS** stocker les logs salariés en cloud'];
  const r2 = ['- **JAMAIS** stocker les logs salariés en cloud'];
  const agents = [
    { id: 'A', regles: { toujours: r1, jamais: r2 } },
    { id: 'B', regles: { toujours: r1, jamais: r2 } },
  ];
  const conflits = detecterConflits(agents);
  // Pas explosé en N² doublons grâce à la dédup
  assert.ok(conflits.length <= 4);
});

// ─── detecterDoublons ──────────────────────────────────────────────────────

test('detecterDoublons — règles dupliquées dans le même agent', () => {
  const agent = {
    id: 'A',
    regles: {
      toujours: [
        '- **TOUJOURS** chiffrer en transit',
        '- **TOUJOURS** chiffrer en transit',
      ],
      jamais: [],
    },
  };
  const r = detecterDoublons(agent);
  assert.equal(r.length, 1);
  assert.equal(r[0].type, 'TOUJOURS');
});

test('detecterDoublons — règles formulées différemment mais sémantiquement identiques', () => {
  const agent = {
    id: 'A',
    regles: {
      toujours: [
        '- **TOUJOURS** chiffrer les données en transit',
        '- **TOUJOURS** en transit chiffrer les données',
      ],
      jamais: [],
    },
  };
  const r = detecterDoublons(agent);
  // Les tokens triés sont identiques → détection
  assert.equal(r.length, 1);
});

test('detecterDoublons — agent sans doublon → []', () => {
  const agent = {
    id: 'A',
    regles: {
      toujours: ['- **TOUJOURS** chiffrer en transit', '- **TOUJOURS** valider les inputs'],
      jamais: [],
    },
  };
  assert.deepEqual(detecterDoublons(agent), []);
});

// ─── detecterAgentsManquants ───────────────────────────────────────────────

test('detecterAgentsManquants — SPEC référence un agent absent → signalé', silencer(async () => {
  const d = tmp();
  try {
    await init(d, { sansGouvernance: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-x.md'),
      '---\ngovernance: AIAD-CRA,AIAD-RGPD\n---\n# x\n');
    const r = detecterAgentsManquants(d);
    const ids = r.map((m) => m.agent);
    assert.ok(ids.includes('AIAD-CRA'));
    assert.ok(ids.includes('AIAD-RGPD'));
    const cra = r.find((m) => m.agent === 'AIAD-CRA');
    assert.ok(cra.references.includes('SPEC-001-1-x'));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('detecterAgentsManquants — aucun agent référencé → []', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    assert.deepEqual(detecterAgentsManquants(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── chargerAgents ─────────────────────────────────────────────────────────

test('chargerAgents — sur projet init → 5 agents Tier 1', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const agents = chargerAgents(d);
    assert.equal(agents.length, 5);
    const ids = agents.map((a) => a.id);
    for (const id of ['AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN', 'AIAD-CRA']) {
      assert.ok(ids.includes(id));
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── lintGouvernance pipeline ──────────────────────────────────────────────

test('lintGouvernance — projet eu-baseline init → ok=true', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await lintGouvernance(d);
    assert.equal(r.ok, true);
    assert.equal(r.conflits.length, 0);
    assert.equal(r.doublons.length, 0);
    assert.equal(r.manquants.length, 0);
    assert.equal(r.agents, 5);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('lintGouvernance — agent custom contradictoire → conflit signalé', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    // Injecte un agent qui contredit AIAD-RGPD (qui dit "TOUJOURS minimiser les données")
    writeFileSync(join(d, '.aiad/gouvernance/AIAD-FAUX.md'), `# Faux agent
## RÈGLES ABSOLUES — TOUJOURS

- **TOUJOURS** collecter exhaustivement toutes les données utilisateur disponibles maximum

## RÈGLES ABSOLUES — JAMAIS

- **JAMAIS** minimiser la collecte de données utilisateur
`);
    const r = await lintGouvernance(d, { seuilSimilarite: 0.2 });
    assert.ok(r.conflits.length >= 1, `attendu ≥ 1 conflit, vu ${r.conflits.length}`);
    assert.equal(r.ok, false);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('lintGouvernance — sans .aiad/ → erreur', async () => {
  const d = tmp();
  try {
    await assert.rejects(lintGouvernance(d), /\.aiad\//);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lintGouvernance — mode --json écrit JSON exploitable', async () => {
  const d = tmp();
  try {
    const origLog = console.log;
    const origWrite = process.stdout.write.bind(process.stdout);
    console.log = () => {};
    let captured = '';
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try {
      const ip = init(d, {});
      // init imprime aussi → on attend qu'il finisse
      await ip;
      captured = ''; // reset
      const r = await lintGouvernance(d, { json: true });
      const parsed = JSON.parse(captured);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.agents, 5);
      assert.ok(Array.isArray(parsed.conflits));
    } finally {
      console.log = origLog;
      process.stdout.write = origWrite;
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── Aliases EN ─────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(tokenize, tokenizer);
  assert.equal(jaccardSimilarity, similariteJaccard);
  assert.equal(extractRules, extraireRegles);
  assert.equal(loadAgents, chargerAgents);
  assert.equal(detectConflicts, detecterConflits);
  assert.equal(detectDuplicates, detecterDoublons);
  assert.equal(detectMissingAgents, detecterAgentsManquants);
  assert.equal(lintGovernance, lintGouvernance);
});
