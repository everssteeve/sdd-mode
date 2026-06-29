// AIAD SDD Mode — REPL interactif.
//
// Atelier en terminal pour enchaîner intent → spec → gate → validate sans
// quitter la ligne de commande. Cible :
//   - onboarding d'un nouveau membre (mode "atelier")
//   - rédaction rapide de plusieurs Intents/SPECs en série
//   - utilisateur expert qui n'a pas Claude Code sous la main
//
// Cohérence avec le CLI : chaque commande REPL délègue au module ou à la
// commande CLI sous-jacente. Pas de logique métier réimplémentée.
//
// Documentation : https://aiad.ovh

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import readline from 'node:readline';
import { C, log, logHeader } from './term.js';
import { syncFile } from './fs-ops.js';
import { stringifyFrontmatter } from './frontmatter.js';
import { collecterStatus } from './status.js';
import { diagnostiquer } from './doctor.js';
import { construireMatrice } from './sdd-trace.js';

// ─── Définition des commandes ───────────────────────────────────────────────
//
// Chaque commande est une fonction pure (testable) qui prend le contexte et
// les args parsés, et retourne une chaîne ou un objet à afficher.

export const COMMANDES = {
  help: {
    description: 'Affiche l\'aide',
    exec() {
      const lignes = ['Commandes disponibles :'];
      for (const [nom, c] of Object.entries(COMMANDES)) {
        lignes.push(`  ${nom.padEnd(12)} ${c.description}`);
      }
      lignes.push('  exit / quit / .q   Quitter le REPL');
      return lignes.join('\n');
    },
  },

  status: {
    description: 'État du projet (intents, specs, fondamentaux, maturité)',
    exec(ctx) {
      const data = collecterStatus(ctx.racine);
      if (!data.initialise) return 'Projet non initialisé. Lance d\'abord `aiad-sdd init`.';
      const f = data.fondamentaux;
      return [
        `PRD: ${f['PRD.md'].rempli ? 'rédigé' : f['PRD.md'].present ? 'template' : 'absent'}`,
        `ARCHITECTURE: ${f['ARCHITECTURE.md'].rempli ? 'rédigé' : f['ARCHITECTURE.md'].present ? 'template' : 'absent'}`,
        `AGENT-GUIDE: ${f['AGENT-GUIDE.md'].rempli ? 'rédigé' : f['AGENT-GUIDE.md'].present ? 'template' : 'absent'}`,
        `Intents: ${data.cycle.intents}`,
        `SPECs: ${data.cycle.specs}`,
        `Gouvernance: ${data.infrastructure.gouvernanceCount} agent(s) Tier 1`,
        `Maturité: ${data.maturite.score}/${data.maturite.total} — ${data.maturite.label}`,
      ].join('\n');
    },
  },

  trace: {
    description: 'Synthèse de la matrice de traçabilité (rapide, sans écriture)',
    exec(ctx) {
      const m = construireMatrice(ctx.racine);
      const total = compterGaps(m);
      return [
        `Intents: ${m.summary.intents}, SPECs: ${m.summary.specs}`,
        `Code annoté: ${m.summary.annotatedCodeFiles}/${m.summary.codeFiles}`,
        `Tests annotés: ${m.summary.annotatedTestFiles}/${m.summary.testFiles}`,
        `Gaps: ${total} (orphelins ${m.gaps.intentsSansSpec.length}, non-implémentées ${m.gaps.specsValideesNonImplementees.length}, sans tests ${m.gaps.codeSansTests.length})`,
      ].join('\n');
    },
  },

  doctor: {
    description: 'Diagnostic unifié',
    async exec(ctx) {
      const r = await diagnostiquer(ctx.racine);
      const lignes = [];
      for (const c of r.checks) {
        const sym = c.ok ? '✓' : c.severity === 'warn' ? '!' : c.severity === 'info' ? '-' : '✗';
        lignes.push(`  ${sym} ${c.id} — ${c.message}`);
      }
      lignes.push(r.ok ? '✓ Projet en bonne santé.' : '✗ Anomalies détectées.');
      return lignes.join('\n');
    },
  },

  intent: {
    description: 'Crée un nouvel Intent Statement (interactif)',
    async exec(ctx, args) {
      const id = args.id || `INTENT-${prochainNumero(ctx.racine, 'intents')}`;
      const titre = args.titre || `Intent ${id}`;
      const fm = stringifyFrontmatter({
        title: titre,
        status: 'active',
        date: new Date().toISOString().slice(0, 10),
        author: args.author || 'humain',
      });
      const corps = `# ${titre}\n\n## Problème\n\n${args.probleme || '(à compléter — POURQUOI cette intention)'}\n\n## Outcome\n\n(à compléter — quel résultat observable)\n\n## Contraintes\n\n(à compléter)\n`;
      const dest = join(ctx.racine, '.aiad', 'intents', `${id}.md`);
      if (existsSync(dest)) return `${id} existe déjà. Édite manuellement ou choisis un autre ID.`;
      syncFile(dest, fm + corps);
      return `${id} créé : ${dest}`;
    },
  },

  spec: {
    description: 'Crée une nouvelle SPEC depuis un Intent (interactif)',
    async exec(ctx, args) {
      const parent = args.parent;
      if (!parent || !/^INTENT-/.test(parent)) {
        return 'Usage : spec parent=INTENT-NNN [titre="..."] [format=EARS|prose]';
      }
      const num = prochainNumero(ctx.racine, 'specs', parent);
      const slug = (args.slug || 'feat').toLowerCase().replace(/\s+/g, '-');
      const id = `SPEC-${parent.replace('INTENT-', '')}-${num}-${slug}`;
      const fm = stringifyFrontmatter({
        title: args.titre || id,
        parent_intent: parent,
        status: 'draft',
        format: args.format || 'prose',
        date: new Date().toISOString().slice(0, 10),
      });
      const corps = `# ${args.titre || id}\n\n## Contexte\n\n(à compléter — pourquoi cette SPEC, lien avec l'Intent ${parent})\n\n## Critères d'acceptation\n\n(à compléter — observables, mesurables)\n\n## Test de l'Étranger\n\n(à compléter — un dev externe peut-il construire l'implémentation à partir de cette SPEC ?)\n`;
      const dest = join(ctx.racine, '.aiad', 'specs', `${id}.md`);
      if (existsSync(dest)) return `${id} existe déjà.`;
      syncFile(dest, fm + corps);
      return `${id} créée : ${dest}`;
    },
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function compterGaps(m) {
  return (
    m.gaps.intentsSansSpec.length +
    m.gaps.specsSansCode.length +
    m.gaps.specsValideesNonImplementees.length +
    m.gaps.specsOrphelinsSurCode.length +
    m.gaps.intentsOrphelinsSurCode.length +
    m.gaps.codeSansSpec.total +
    m.gaps.codeSansTests.length
  );
}

function prochainNumero(racine, type, parent = null) {
  const dir = join(racine, '.aiad', type);
  if (!existsSync(dir)) return '001';
  const fichiers = readdirSync(dir);
  // INTENT-NNN.md ou SPEC-NNN-N-slug.md
  const re = type === 'intents'
    ? /^INTENT-(\d{3,})/
    : parent
      ? new RegExp(`^${parent.replace('INTENT-', 'SPEC-')}-(\\d+)`)
      : /^SPEC-\d+-(\d+)/;
  const numeros = fichiers
    .map((f) => f.match(re)?.[1])
    .filter(Boolean)
    .map((n) => parseInt(n, 10));
  const max = numeros.length ? Math.max(...numeros) : 0;
  const next = max + 1;
  return type === 'intents' ? String(next).padStart(3, '0') : String(next);
}

/**
 * Parse une ligne REPL en `{ nom, args }`.
 * Format : `commande key=valeur key2="valeur avec espaces"`
 *
 * @param {string} ligne
 * @returns {{ nom: string, args: Record<string, string> }}
 */
export function parserLigne(ligne) {
  const trim = ligne.trim();
  if (!trim) return { nom: '', args: {} };
  const tokens = [...trim.matchAll(/(\w+)=("([^"]*)"|(\S+))|(\S+)/g)];
  const args = {};
  let nom = '';
  for (const m of tokens) {
    if (m[1]) {
      // key=value ou key="value avec espaces"
      args[m[1]] = m[3] !== undefined ? m[3] : m[4];
    } else if (m[5] !== undefined) {
      if (!nom) nom = m[5];
      else if (!args._) args._ = m[5];
    }
  }
  return { nom, args };
}

// ─── Boucle interactive ─────────────────────────────────────────────────────

/**
 * Démarre une session REPL interactive sur la racine donnée.
 *
 * @param {string} racine
 * @returns {Promise<void>}
 */
export function ouvrirRepl(racine) {
  return new Promise((resolve) => {
    logHeader('AIAD SDD — REPL', `Tape "help" pour voir les commandes. "exit" pour quitter.`);
    const ctx = { racine };
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${C.cyan}aiad${C.reset}> `,
      historySize: 100,
      completer: (line) => {
        const noms = Object.keys(COMMANDES).concat(['exit', 'quit', 'help']);
        const hits = noms.filter((n) => n.startsWith(line));
        return [hits.length ? hits : noms, line];
      },
    });

    rl.prompt();
    rl.on('line', async (ligne) => {
      const trim = ligne.trim();
      if (!trim) { rl.prompt(); return; }
      if (['exit', 'quit', '.q'].includes(trim)) {
        rl.close();
        return;
      }
      const { nom, args } = parserLigne(trim);
      const cmd = COMMANDES[nom];
      if (!cmd) {
        log(`${C.rouge}✗${C.reset}`, `Commande inconnue : "${nom}". Tape "help".`);
        rl.prompt();
        return;
      }
      try {
        const out = await cmd.exec(ctx, args);
        if (out) console.log(out);
      } catch (err) {
        log(`${C.rouge}✗${C.reset}`, err.message);
      }
      rl.prompt();
    });
    rl.on('close', () => {
      console.log(`\n  ${C.gris}À bientôt.${C.reset}\n`);
      resolve();
    });
  });
}

// ─── Alias EN canoniques (item #42) ─────────────────────────────────────────
export {
  ouvrirRepl as openRepl,
  parserLigne as parseLine,
};
