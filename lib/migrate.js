// AIAD SDD Mode — Commande `migrate`.
//
// Détecte des marqueurs structurels d'anciennes versions et applique les
// migrations nécessaires de manière idempotente. L'utilisateur qui saute
// plusieurs versions n'a pas à exécuter manuellement les changements
// structurels documentés en CHANGELOG.
//
// Migrations livrées en v1.14.0 :
//   - M1 : ajouter `.aiad/metrics/traceability/` (introduit en v1.10)
//   - M2 : ajouter `.aiad/facts/` (introduit en v1.6)
//   - M3 : ajouter `.aiad/metrics/{security,audit}/` (v1.6)
//   - M4 : ajouter `.aiad/intents/_index.md` et `.aiad/specs/_index.md` si absents
//   - M5 : recommander `aiad-sdd update --check` si commandes désynchronisées
//
// Mode aperçu par défaut (sans `--force`). Toutes les migrations sont
// idempotentes — relancer ne casse rien.
//
// Documentation : https://aiad.ovh

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { C, log, logHeader } from './term.js';
import { ensureDir, copyFile } from './fs-ops.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

/**
 * Définition d'une migration. `appliquer(racine, dryRun)` retourne une string
 * d'effet ou null si l'action est déjà à jour (no-op).
 */
const MIGRATIONS = [
  {
    id: 'M1-metrics-traceability',
    description: 'Ajouter `.aiad/metrics/traceability/` (introduit v1.10)',
    estApplicable(racine) {
      return existsSync(join(racine, '.aiad')) &&
             !existsSync(join(racine, '.aiad', 'metrics', 'traceability'));
    },
    appliquer(racine, dryRun) {
      const cible = join(racine, '.aiad', 'metrics', 'traceability');
      ensureDir(cible, { dryRun });
      return `créé ${cible}`;
    },
  },

  {
    id: 'M2-facts',
    description: 'Ajouter `.aiad/facts/` (introduit v1.6)',
    estApplicable(racine) {
      return existsSync(join(racine, '.aiad')) &&
             !existsSync(join(racine, '.aiad', 'facts'));
    },
    appliquer(racine, dryRun) {
      const cible = join(racine, '.aiad', 'facts');
      ensureDir(cible, { dryRun });
      return `créé ${cible}`;
    },
  },

  {
    id: 'M3-metrics-security-audit',
    description: 'Ajouter `.aiad/metrics/{security,audit}/` (v1.6)',
    estApplicable(racine) {
      const aiad = join(racine, '.aiad');
      return existsSync(aiad) && (
        !existsSync(join(aiad, 'metrics', 'security')) ||
        !existsSync(join(aiad, 'metrics', 'audit'))
      );
    },
    appliquer(racine, dryRun) {
      const effets = [];
      for (const sub of ['security', 'audit']) {
        const cible = join(racine, '.aiad', 'metrics', sub);
        if (!existsSync(cible)) {
          ensureDir(cible, { dryRun });
          effets.push(sub);
        }
      }
      return `créé ${effets.map((s) => `metrics/${s}`).join(', ')}`;
    },
  },

  {
    id: 'M4-indices',
    description: 'Recopier `_index.md` manquants pour intents/specs',
    estApplicable(racine) {
      const aiad = join(racine, '.aiad');
      if (!existsSync(aiad)) return false;
      return (existsSync(join(aiad, 'intents')) && !existsSync(join(aiad, 'intents', '_index.md'))) ||
             (existsSync(join(aiad, 'specs')) && !existsSync(join(aiad, 'specs', '_index.md')));
    },
    appliquer(racine, dryRun) {
      const effets = [];
      for (const sous of ['intents', 'specs']) {
        const dst = join(racine, '.aiad', sous, '_index.md');
        const src = join(TEMPLATES_DIR, '.aiad', sous, '_index.md');
        if (!existsSync(dst) && existsSync(src)) {
          copyFile(src, dst, { dryRun });
          effets.push(`${sous}/_index.md`);
        }
      }
      return effets.length ? `recopié ${effets.join(', ')}` : null;
    },
  },

  {
    id: 'M5-update-check-recommandé',
    description: 'Vérifie la parité des commandes installées (recommande `aiad-sdd update`)',
    estApplicable(racine) {
      // Heuristique : si .claude/commands/sdd.md existe mais que sdd-trace.md absent,
      // commandes désynchronisées avec v1.10+.
      const cmds = join(racine, '.claude', 'commands');
      if (!existsSync(cmds)) return false;
      const aSdd = existsSync(join(cmds, 'sdd.md'));
      const aTrace = existsSync(join(cmds, 'sdd-trace.md'));
      return aSdd && !aTrace;
    },
    appliquer(_racine, _dryRun) {
      // Cette migration ne touche rien — elle SIGNALE que `update` est requis.
      return 'recommandation : exécute `npx aiad-sdd update` pour resynchroniser les commandes slash.';
    },
  },
];

/**
 * Planifie les migrations applicables. Pure (pas d'I/O d'écriture).
 *
 * @param {string} racine
 * @returns {{ id: string, description: string }[]}
 */
export function planifier(racine) {
  return MIGRATIONS.filter((m) => m.estApplicable(racine));
}

/**
 * Exécute la commande `migrate`.
 *
 * @param {string} racine
 * @param {{ force?: boolean, dryRun?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, planned: object[], appliquees: string[] }>}
 */
export async function migrer(racine, options = {}) {
  const { force = false, dryRun = false } = options;
  const apercu = !force || dryRun;

  if (!existsSync(join(racine, '.aiad'))) {
    logHeader('AIAD SDD — Migrate', 'Pas de `.aiad/` détecté');
    log(`${C.gris}-${C.reset}`, 'Lance `aiad-sdd init` pour bootstrapper le projet.');
    console.log('');
    return { ok: false, planned: [], appliquees: [] };
  }

  const planned = planifier(racine);
  if (planned.length === 0) {
    logHeader('AIAD SDD — Migrate', 'Aucune migration nécessaire');
    log(`${C.vert}✓${C.reset}`, 'Le projet est aligné sur la version courante.');
    console.log('');
    return { ok: true, planned: [], appliquees: [] };
  }

  logHeader(
    `AIAD SDD — Migrate (${planned.length} migration${planned.length > 1 ? 's' : ''} prévue${planned.length > 1 ? 's' : ''})`,
    apercu ? 'Mode aperçu — aucune écriture' : 'Mode exécution',
  );

  const appliquees = [];
  for (const m of planned) {
    const sym = apercu ? `${C.gris}-${C.reset}` : `${C.vert}+${C.reset}`;
    if (apercu) {
      log(sym, `${C.gras}${m.id}${C.reset} ${C.gris}— ${m.description}${C.reset}`);
    } else {
      const effet = m.appliquer(racine, false);
      log(sym, `${C.gras}${m.id}${C.reset} ${C.gris}— ${effet || m.description}${C.reset}`);
      appliquees.push(m.id);
    }
  }

  if (apercu) {
    console.log(`
${C.jaune}${C.gras}  ${planned.length} migration(s) à appliquer.${C.reset}
${C.gris}  Pour exécuter : ${C.reset}${C.cyan}npx aiad-sdd migrate --force${C.reset}
`);
  } else {
    console.log(`
${C.vert}${C.gras}  ✓ ${appliquees.length} migration(s) appliquée(s).${C.reset}
${C.gris}  Lance ensuite : ${C.reset}${C.cyan}npx aiad-sdd doctor${C.reset}${C.gris} pour vérifier.${C.reset}
`);
  }

  return { ok: true, planned, appliquees };
}

// ─── Alias EN canoniques (item #42) ─────────────────────────────────────────
export {
  migrer as migrate,
  planifier as planMigrations,
};
