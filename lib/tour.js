// AIAD SDD Mode — Guided tour interactif (item #108).
//
// **Cap stratégique** : un nouvel utilisateur AIAD ouvre une centaine de
// commandes possibles. `tour` lui propose un **parcours pédagogique de
// 5 étapes** sur un projet jouet — Intent → SPEC → Gate → Trace →
// conclusion — qui explique chaque concept à mesure qu'il le pratique.
//
// **Différence avec `init --interactive` (#54)** : `init` boostrap un
// vrai projet en 4 questions, `tour` enseigne sans toucher au projet
// utilisateur (sortie dans `.aiad-tour/` par défaut, supprimable).
//
// **Zero-dep** : `node:readline` natif (cohérent avec init-tui.js).
//
// **Mode non-interactif** : `--non-interactive` passe les réponses par
// défaut, utile pour tests et démos CI. Mode `--out <path>` pour cibler
// un dossier différent.
//
// Documentation : https://aiad.ovh/tour

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import { C, logHeader } from './term.js';

const SORTIE_DEFAUT = '.aiad-tour';

// ─── Étapes du tour ────────────────────────────────────────────────────────

/**
 * Représente une étape du tour avec :
 *   - intro : court texte explicatif
 *   - prompt : question posée à l'utilisateur (string ou null si pas de question)
 *   - defaut : réponse par défaut (utilisée en mode non-interactif)
 *   - action(rep, ctx) : effet de bord (écrire un fichier, etc.)
 *   - outro : feedback après l'action
 */
export const ETAPES = [
  {
    id: 'welcome',
    intro: [
      'AIAD SDD = Spec Driven Development pour agents IA.',
      'En 5 étapes, tu vas créer un Intent, une SPEC, simuler une Gate,',
      'et générer une matrice de traçabilité. Pas de panique : tout se passe',
      `dans un dossier dédié (\`${SORTIE_DEFAUT}/\` par défaut) que tu peux supprimer.`,
    ],
    prompt: null,
    defaut: null,
    action: null,
    outro: '',
  },
  {
    id: 'intent',
    intro: [
      'ÉTAPE 1 — Intent Statement',
      'L\'Intent décrit POURQUOI on fait quelque chose (jamais comment).',
      'Il appartient à l\'humain : c\'est le contrat avec les agents IA.',
    ],
    prompt: 'Que veux-tu permettre à l\'utilisateur de faire ?',
    defaut: 'Récupérer une copie complète de ses données personnelles',
    action: (rep, ctx) => {
      const id = 'INT-001';
      const path = join(ctx.dir, 'intents', `${id}.md`);
      mkdirSync(join(ctx.dir, 'intents'), { recursive: true });
      const body = [
        '---',
        `title: ${rep}`,
        'createdAt: ' + new Date().toISOString().slice(0, 10),
        'author: tour-aiad-sdd',
        '---',
        '',
        `# ${rep}`,
        '',
        '**Pourquoi** : améliorer la transparence et respecter le droit d\'accès RGPD.',
        '**Pour qui** : tout utilisateur authentifié.',
        '**Critère de succès** : l\'utilisateur reçoit ses données < 5 minutes après demande.',
      ].join('\n');
      writeFileSync(path, body, 'utf-8');
      ctx.intent = { id, path, title: rep };
    },
    outro: 'Intent écrit dans intents/INT-001.md. C\'est le POURQUOI.',
  },
  {
    id: 'spec',
    intro: [
      'ÉTAPE 2 — SPEC technique',
      'La SPEC traduit l\'Intent en COMMENT : critères d\'acceptation testables,',
      'contraintes techniques, périmètre exact.',
      'Une bonne SPEC passe le "Test de l\'Étranger" : quelqu\'un sans contexte',
      'doit pouvoir l\'implémenter correctement.',
    ],
    prompt: 'En une ligne, quelle est la contrainte technique principale ?',
    defaut: 'Export au format JSON, signé, généré sous 5 min',
    action: (rep, ctx) => {
      const id = 'SPEC-001-1-export-donnees';
      const path = join(ctx.dir, 'specs', `${id}.md`);
      mkdirSync(join(ctx.dir, 'specs'), { recursive: true });
      const body = [
        '---',
        `title: Export des données personnelles utilisateur`,
        `intent: ${ctx.intent.id}`,
        'governance: AIAD-RGPD',
        'version: 1.0.0',
        '---',
        '',
        `# SPEC : Export des données utilisateur (${ctx.intent.id})`,
        '',
        `**Contrainte** : ${rep}`,
        '',
        '## Critères d\'acceptation (EARS)',
        '',
        '- **AC-1** WHEN l\'utilisateur clique sur "Exporter mes données", THE SYSTEM SHALL générer un export JSON dans les 5 minutes.',
        '- **AC-2** WHILE l\'export est en cours, THE SYSTEM SHALL afficher un indicateur de progression.',
        '- **AC-3** WHEN l\'export est prêt, THE SYSTEM SHALL notifier l\'utilisateur par email avec un lien signé valide 24h.',
      ].join('\n');
      writeFileSync(path, body, 'utf-8');
      ctx.spec = { id, path };
    },
    outro: 'SPEC écrite avec 3 critères EARS. C\'est le COMMENT.',
  },
  {
    id: 'gate',
    intro: [
      'ÉTAPE 3 — Execution Gate (SQS)',
      'Avant qu\'un agent IA touche au code, la SPEC doit passer la Gate :',
      'un scoring sur 5 critères (Intent clair, Testabilité, Périmètre,',
      'Gouvernance, Pré-requis). Score ≥ 4/5 → on peut coder.',
    ],
    prompt: 'Sur 5, à combien estimes-tu la qualité de la SPEC précédente ?',
    defaut: '4',
    action: (rep, ctx) => {
      const score = parseInt(rep, 10);
      const valide = !Number.isNaN(score) && score >= 4;
      ctx.gate = { score: Number.isNaN(score) ? 0 : score, valide };
    },
    outro: (ctx) => ctx.gate.valide
      ? `Score ${ctx.gate.score}/5 — Gate OUVERTE. L\'agent peut implémenter.`
      : `Score ${ctx.gate.score}/5 — Gate FERMÉE. Il faut améliorer la SPEC avant d\'aller plus loin.`,
  },
  {
    id: 'trace',
    intro: [
      'ÉTAPE 4 — Traçabilité Intent ↔ SPEC ↔ Code ↔ Tests',
      'AIAD pose des annotations machine dans le code :',
      '  // @intent INT-001',
      '  // @spec SPEC-001-1-export-donnees',
      '  // @verified-by tests/export.test.ts',
      'La commande `aiad-sdd trace` génère une matrice qui détecte les drifts',
      '(code sans SPEC, SPEC sans code, tests manquants).',
    ],
    prompt: null,
    defaut: null,
    action: (_rep, ctx) => {
      const path = join(ctx.dir, 'metrics', 'traceability', 'matrix.json');
      mkdirSync(join(ctx.dir, 'metrics', 'traceability'), { recursive: true });
      const matrix = {
        generatedAt: new Date().toISOString(),
        intents: [{ id: ctx.intent.id, specs: [ctx.spec.id] }],
        specs: [{ id: ctx.spec.id, code: [], tests: [] }],
        gaps: [
          { kind: 'spec-without-code', spec: ctx.spec.id, message: 'SPEC sans implémentation — c\'est normal, on est en mode démo.' },
        ],
      };
      writeFileSync(path, JSON.stringify(matrix, null, 2), 'utf-8');
      ctx.matrix = matrix;
    },
    outro: 'Matrice de traçabilité générée. 1 gap (normal pour la démo).',
  },
  {
    id: 'done',
    intro: [
      'ÉTAPE 5 — Et après ?',
      'Tu as parcouru le cycle complet AIAD : Intent → SPEC → Gate → Trace.',
      'Pour ton vrai projet :',
      '  npx aiad-sdd init                  # init complet',
      '  npx aiad-sdd init --interactive    # TUI 4 questions',
      '  npx aiad-sdd help                  # liste des 50+ commandes',
      'Documentation : https://aiad.ovh',
    ],
    prompt: null,
    defaut: null,
    action: null,
    outro: '',
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function poser(rl, question) {
  return new Promise((resolve) => rl.question(question, (rep) => resolve(rep)));
}

function texteEtape(etape, index, total) {
  const head = `\n${C.gras}${C.cyan}━━━ ${index + 1}/${total} — ${etape.id.toUpperCase()} ━━━${C.reset}\n`;
  const intro = etape.intro.map((l) => `  ${l}`).join('\n');
  return head + intro + '\n';
}

// ─── Pipeline ──────────────────────────────────────────────────────────────

/**
 * Lance le tour. En mode interactif, lit les réponses via readline.
 * En mode non-interactif (`--non-interactive` ou tests), applique les
 * `defaut` directement.
 *
 * @param {string} racine
 * @param {{ out?: string, nonInteractive?: boolean, json?: boolean, rl?: object }} [options]
 */
export async function tour(racine, options = {}) {
  const dir = join(racine, options.out || SORTIE_DEFAUT);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const ctx = { dir, racine, intent: null, spec: null, gate: null, matrix: null };

  if (!options.json && !options.nonInteractive) {
    logHeader('AIAD SDD — Guided tour', 'Parcours pédagogique 5 étapes (Intent → SPEC → Gate → Trace)');
  }

  let rl = options.rl;
  let rlOwned = false;
  if (!options.nonInteractive && !options.json && !rl) {
    rl = readline.createInterface({ input: stdin, output: stdout });
    rlOwned = true;
  }

  try {
    for (let i = 0; i < ETAPES.length; i++) {
      const etape = ETAPES[i];
      if (!options.json) {
        process.stdout.write(texteEtape(etape, i, ETAPES.length));
      }

      let reponse = etape.defaut;
      if (etape.prompt && !options.nonInteractive && !options.json && rl) {
        const saisie = await poser(rl, `  ${C.jaune}${etape.prompt}${C.reset}\n  ${C.gris}[défaut : ${etape.defaut}]${C.reset}\n  > `);
        reponse = saisie.trim() || etape.defaut;
      }

      if (typeof etape.action === 'function') {
        etape.action(reponse, ctx);
      }

      const outro = typeof etape.outro === 'function' ? etape.outro(ctx) : etape.outro;
      if (outro && !options.json) {
        console.log(`  ${C.vert}✓${C.reset} ${outro}`);
      }
    }
  } finally {
    if (rlOwned && rl) rl.close();
  }

  const resultat = {
    dir: dir.replace(racine + '/', ''),
    intent: ctx.intent && ctx.intent.id,
    spec: ctx.spec && ctx.spec.id,
    gateScore: ctx.gate && ctx.gate.score,
    gateValid: ctx.gate && ctx.gate.valide,
    fichiers: [
      ctx.intent && ctx.intent.path.replace(racine + '/', ''),
      ctx.spec && ctx.spec.path.replace(racine + '/', ''),
      ctx.matrix && join(dir, 'metrics', 'traceability', 'matrix.json').replace(racine + '/', ''),
    ].filter(Boolean),
  };

  if (options.json) {
    process.stdout.write(JSON.stringify(resultat, null, 2) + '\n');
  } else {
    console.log(`\n  ${C.gris}Tour terminé — artefacts dans ${C.cyan}${resultat.dir}/${C.reset}${C.gris} (supprime ce dossier pour nettoyer).${C.reset}\n`);
  }
  return resultat;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  ETAPES as STEPS,
  tour as guidedTour,
};

export const CONSTANTS = {
  SORTIE_DEFAUT,
};
