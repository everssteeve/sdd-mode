// AIAD SDD Mode — Review : diff Intent/SPEC entre branches Git.
//
// `aiad-sdd review <branch>` produit un rapport Markdown commentable en PR
// qui liste :
//   - Intents ajoutés / modifiés / supprimés
//   - SPECs ajoutées / modifiées / supprimées
//   - **Agents Tier 1 à re-consulter** : pour chaque SPEC modifiée dont le
//     champ `governance:` du frontmatter mentionne RGPD/AI-ACT/CRA/RGAA/RGESN
//     (ou un agent custom), l'agent en question doit être passé en revue
//     avant le merge.
//   - Recommandations actionnables (commandes à lancer).
//
// **Cap stratégique** : le diff Intent/SPEC est l'unité de discussion d'une
// PR sur un projet AIAD. Pas un diff de code brut. Pas un diff de fichiers
// quelconques. Le réviseur PR voit immédiatement ce qui change **côté
// intention et conformité réglementaire**.
//
// **Zero-dep** : utilise uniquement `git` système via `spawnSync`.
//
// Documentation : https://aiad.ovh

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { C, log, logHeader } from './term.js';

// ─── Helpers Git ────────────────────────────────────────────────────────────

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} a échoué : ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

function gitOptional(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  return r.status === 0 ? r.stdout : null;
}

/**
 * Liste les fichiers `.aiad/intents/*.md` et `.aiad/specs/*.md` sur une ref
 * Git donnée (branche, tag, commit).
 *
 * @param {string} racine
 * @param {string} ref
 * @returns {{ intents: string[], specs: string[] }}
 */
export function listerArtefactsRef(racine, ref) {
  const out = gitOptional(['ls-tree', '-r', '--name-only', ref, '.aiad/'], racine);
  if (out === null) return { intents: [], specs: [] };
  const fichiers = out.split('\n').filter(Boolean);
  return {
    intents: fichiers.filter((f) => f.startsWith('.aiad/intents/') && f.endsWith('.md') && !f.includes('/archive/')).sort(),
    specs: fichiers.filter((f) => f.startsWith('.aiad/specs/') && f.endsWith('.md') && !f.includes('/archive/') && !f.includes('spec-ears-template')).sort(),
  };
}

/**
 * Lit le contenu d'un fichier sur une ref Git donnée.
 *
 * @param {string} racine
 * @param {string} ref
 * @param {string} path
 * @returns {string|null}
 */
export function lireFichierRef(racine, ref, path) {
  const r = spawnSync('git', ['show', `${ref}:${path}`], { cwd: racine, encoding: 'utf-8' });
  if (r.status !== 0) return null;
  return r.stdout;
}

// ─── Fonctions pures de diff ────────────────────────────────────────────────

/**
 * Catégorise les fichiers entre deux ensembles : added / modified / deleted /
 * unchanged.
 *
 * @param {string[]} cible — fichiers sur la branche cible
 * @param {string[]} courant — fichiers sur la branche courante
 * @returns {{ added: string[], modified: string[], deleted: string[], unchanged: string[] }}
 */
export function categoriserFichiers(cible, courant, comparateurContenu = () => false) {
  const setCible = new Set(cible);
  const setCourant = new Set(courant);
  const added = courant.filter((f) => !setCible.has(f));
  const deleted = cible.filter((f) => !setCourant.has(f));
  const intersection = courant.filter((f) => setCible.has(f));
  const modified = intersection.filter((f) => comparateurContenu(f));
  const unchanged = intersection.filter((f) => !comparateurContenu(f));
  return { added, modified, deleted, unchanged };
}

/**
 * Extrait l'ensemble d'agents de gouvernance mentionnés dans le frontmatter
 * d'une SPEC. Tolère les variantes `governance:` (string ou array YAML).
 *
 * @param {string} contenu
 * @returns {string[]}
 */
export function extraireGouvernance(contenu) {
  if (typeof contenu !== 'string') return [];
  const { data } = parseFrontmatter(contenu);
  if (!data || !data.governance) return [];
  if (Array.isArray(data.governance)) {
    return data.governance.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(data.governance).split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Calcule l'union des agents impactés à partir des SPECs ajoutées/modifiées/
 * supprimées. Une SPEC supprimée n'impacte pas (l'agent peut être retiré).
 * Une SPEC ajoutée OU modifiée doit être re-consultée par les agents
 * mentionnés dans son frontmatter (avant ET après pour les modifs).
 *
 * @param {{ avant: string|null, apres: string|null }[]} specsTouchees
 * @returns {string[]} agents triés alphabétiquement
 */
export function calculerImpactGouvernance(specsTouchees) {
  const agents = new Set();
  for (const t of specsTouchees) {
    for (const g of extraireGouvernance(t.avant)) agents.add(g);
    for (const g of extraireGouvernance(t.apres)) agents.add(g);
  }
  return [...agents].sort();
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Compare la branche courante au target.
 *
 * @param {string} racine
 * @param {string} target
 * @returns {{ target: string, intents: object, specs: object, gouvernanceImpactee: string[], specsTouchees: object[] }}
 */
export function comparerBranches(racine, target) {
  if (!existsSync(join(racine, '.git'))) {
    throw new Error('Pas de repo Git détecté à la racine — `aiad-sdd review` requiert un projet versionné Git.');
  }

  const courant = listerArtefactsRef(racine, 'HEAD');
  const cible = listerArtefactsRef(racine, target);

  const cmpIntent = (path) => {
    const a = lireFichierRef(racine, target, path);
    const b = lireFichierRef(racine, 'HEAD', path);
    return a !== b;
  };
  const cmpSpec = cmpIntent;

  const intents = categoriserFichiers(cible.intents, courant.intents, cmpIntent);
  const specs = categoriserFichiers(cible.specs, courant.specs, cmpSpec);

  // Pour chaque SPEC ajoutée/modifiée/supprimée, charge avant + après pour
  // extraire la gouvernance.
  const specsTouchees = [];
  for (const path of specs.added) {
    specsTouchees.push({ path, type: 'added', avant: null, apres: lireFichierRef(racine, 'HEAD', path) });
  }
  for (const path of specs.modified) {
    specsTouchees.push({
      path, type: 'modified',
      avant: lireFichierRef(racine, target, path),
      apres: lireFichierRef(racine, 'HEAD', path),
    });
  }
  for (const path of specs.deleted) {
    specsTouchees.push({ path, type: 'deleted', avant: lireFichierRef(racine, target, path), apres: null });
  }

  return {
    target,
    intents,
    specs,
    specsTouchees,
    gouvernanceImpactee: calculerImpactGouvernance(specsTouchees.filter((s) => s.type !== 'deleted')),
  };
}

// ─── Rapport Markdown ───────────────────────────────────────────────────────

/**
 * Construit un rapport Markdown commentable en PR.
 *
 * @param {object} comparaison — résultat de comparerBranches
 * @returns {string}
 */
export function genererRapportMarkdown(comparaison) {
  const { target, intents, specs, gouvernanceImpactee, specsTouchees } = comparaison;
  const lignes = [];
  lignes.push(`# AIAD SDD — Review vs \`${target}\``);
  lignes.push('');
  lignes.push(`> Diff Intent/SPEC entre la branche courante et \`${target}\`. Coller ce rapport en commentaire de PR pour orienter la revue.`);
  lignes.push('');

  const totalIntents = intents.added.length + intents.modified.length + intents.deleted.length;
  const totalSpecs = specs.added.length + specs.modified.length + specs.deleted.length;
  lignes.push('## Synthèse');
  lignes.push('');
  lignes.push(`- Intents : **${intents.added.length}** ajout(s) · **${intents.modified.length}** modif(s) · **${intents.deleted.length}** suppression(s)`);
  lignes.push(`- SPECs : **${specs.added.length}** ajout(s) · **${specs.modified.length}** modif(s) · **${specs.deleted.length}** suppression(s)`);
  lignes.push(`- Agents Tier 1 à re-consulter : ${gouvernanceImpactee.length === 0 ? '*aucun*' : gouvernanceImpactee.map((a) => `\`${a}\``).join(', ')}`);
  lignes.push('');

  if (totalIntents === 0 && totalSpecs === 0) {
    lignes.push('*Aucune modification d\'artefact AIAD détectée. La PR ne modifie pas l\'intention ni les spécifications — la revue peut se concentrer sur le code.*');
    lignes.push('');
    return lignes.join('\n');
  }

  if (totalIntents > 0) {
    lignes.push('## Intents touchés');
    lignes.push('');
    for (const f of intents.added) lignes.push(`- ➕ Ajout : \`${f}\``);
    for (const f of intents.modified) lignes.push(`- ✏️ Modif : \`${f}\``);
    for (const f of intents.deleted) lignes.push(`- ➖ Suppression : \`${f}\``);
    lignes.push('');
  }

  if (totalSpecs > 0) {
    lignes.push('## SPECs touchées');
    lignes.push('');
    for (const t of specsTouchees) {
      const sym = t.type === 'added' ? '➕ Ajout' : t.type === 'modified' ? '✏️ Modif' : '➖ Suppression';
      const govList = [...new Set([
        ...extraireGouvernance(t.avant || ''),
        ...extraireGouvernance(t.apres || ''),
      ])];
      const govStr = govList.length ? ` — gouvernance : ${govList.map((g) => `\`${g}\``).join(', ')}` : '';
      lignes.push(`- ${sym} : \`${t.path}\`${govStr}`);
    }
    lignes.push('');
  }

  if (gouvernanceImpactee.length > 0) {
    lignes.push('## Agents Tier 1 à re-consulter');
    lignes.push('');
    lignes.push('> Avant le merge, valide que les SPECs touchées respectent les exigences de chaque agent.');
    lignes.push('');
    for (const agent of gouvernanceImpactee) {
      lignes.push(`- ☐ **${agent}** — relire \`.aiad/gouvernance/${agent}.md\` puis vérifier les RÈGLES TOUJOURS / JAMAIS sur les SPECs modifiées.`);
    }
    lignes.push('');
    lignes.push('Commande utile : `aiad-sdd gouvernance lint` détecte les contradictions inter-agents potentielles introduites par cette PR.');
    lignes.push('');
  }

  lignes.push('## Recommandations');
  lignes.push('');
  if (specs.added.length > 0 || specs.modified.length > 0) {
    lignes.push('- Lance `aiad-sdd trace --fail-on-gap` pour vérifier que chaque SPEC modifiée a du code et des tests annotés.');
  }
  if (gouvernanceImpactee.length > 0) {
    lignes.push('- Si la PR affecte un système IA haut risque : `aiad-sdd ai-act audit` pour régénérer l\'Annexe IV.');
    if (gouvernanceImpactee.includes('AIAD-RGPD')) {
      lignes.push('- Données personnelles touchées : `aiad-sdd dpia` pour mettre à jour l\'AIPD.');
    }
  }
  lignes.push('- Re-génère le dashboard avec `aiad-sdd dashboard --serve` et vérifie le graphe de connaissances.');
  lignes.push('');

  return lignes.join('\n');
}

// ─── CLI ────────────────────────────────────────────────────────────────────

/**
 * Exécute la review et imprime le rapport.
 *
 * @param {string} racine
 * @param {string} target
 * @param {{ json?: boolean, out?: string }} [options]
 * @returns {Promise<{ comparaison: object, rapport: string }>}
 */
export async function review(racine, target, options = {}) {
  const comparaison = comparerBranches(racine, target);
  const rapport = genererRapportMarkdown(comparaison);

  if (options.json) {
    process.stdout.write(JSON.stringify({
      target: comparaison.target,
      intents: comparaison.intents,
      specs: comparaison.specs,
      gouvernanceImpactee: comparaison.gouvernanceImpactee,
    }, null, 2) + '\n');
    return { comparaison, rapport };
  }

  if (options.out) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(racine, options.out), rapport, 'utf-8');
    logHeader('AIAD SDD — Review', `Rapport écrit dans ${options.out}`);
    return { comparaison, rapport };
  }

  // Sortie console formatée (Markdown brut)
  console.log(rapport);
  return { comparaison, rapport };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  comparerBranches as compareBranches,
  categoriserFichiers as categorizeFiles,
  extraireGouvernance as extractGovernance,
  calculerImpactGouvernance as computeGovernanceImpact,
  genererRapportMarkdown as generateMarkdownReport,
  listerArtefactsRef as listArtifactsAtRef,
  lireFichierRef as readFileAtRef,
  review as reviewBranch,
};
