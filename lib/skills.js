// AIAD SDD Mode — Validation des skills Claude Code.
//
// Les skills déclenchées automatiquement par Claude Code reposent sur le
// frontmatter de `.claude/skills/<name>/SKILL.md` :
//
//   ---
//   name: traceability
//   description: Use when generating, auditing or repairing the …
//   ---
//
// Si `description` est absent, vide ou inférieur à 30 caractères, Claude
// Code ne déclenche pas la skill — un piège silencieux qui peut casser le
// cycle SDD sans qu'on s'en aperçoive. Cette commande vérifie en passe
// tous les skills déployés.
//
// Documentation : https://aiad.ovh

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { C, log, logHeader } from './term.js';
import { parseFrontmatter } from './frontmatter.js';

const MIN_DESCRIPTION = 30; // seuil heuristique : sous ~30 caractères, le
                            // déclenchement par Claude est aléatoire.

/**
 * Liste les skills présentes dans .claude/skills/.
 *
 * @param {string} racine
 * @returns {string[]} chemins relatifs vers chaque SKILL.md
 */
export function listerSkills(racine) {
  const dir = join(racine, '.claude', 'skills');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir)) {
    const sousDir = join(dir, nom);
    let st;
    try { st = statSync(sousDir); } catch { continue; }
    if (!st.isDirectory()) continue;
    const skillFile = join(sousDir, 'SKILL.md');
    if (existsSync(skillFile)) out.push(skillFile);
  }
  return out;
}

/**
 * Valide une skill individuelle. Renvoie un objet diagnostic.
 *
 * @param {string} cheminSkillMd
 * @returns {{ path: string, name: string, ok: boolean, raisons: string[] }}
 */
export function validerSkill(cheminSkillMd) {
  const raisons = [];
  let contenu;
  try {
    contenu = readFileSync(cheminSkillMd, 'utf-8');
  } catch (err) {
    return { path: cheminSkillMd, name: '?', ok: false, raisons: [`Lecture impossible : ${err.message}`] };
  }

  const { data, body } = parseFrontmatter(contenu);

  if (!contenu.startsWith('---')) {
    raisons.push('Aucun frontmatter YAML — Claude Code ne déclenchera pas la skill.');
  }

  if (!data.name || String(data.name).trim() === '') {
    raisons.push('Champ `name` manquant ou vide.');
  }

  const desc = data.description ? String(data.description).trim() : '';
  if (desc === '') {
    raisons.push('Champ `description` manquant ou vide — déclenchement impossible.');
  } else if (desc.length < MIN_DESCRIPTION) {
    raisons.push(`Description trop courte (${desc.length} caractères, minimum recommandé : ${MIN_DESCRIPTION}).`);
  }

  // Sanity body : non-vide
  if (!body || body.trim().length < 50) {
    raisons.push('Corps de la skill quasi vide (< 50 caractères).');
  }

  return {
    path: cheminSkillMd,
    name: data.name || '?',
    ok: raisons.length === 0,
    raisons,
  };
}

/**
 * Valide toutes les skills d'un projet et imprime un rapport.
 *
 * @param {string} racine
 * @param {{ json?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, total: number, valid: number, results: object[] }>}
 */
export async function validerSkills(racine, options = {}) {
  const { json = false } = options;
  const fichiers = listerSkills(racine);
  const results = fichiers.map(validerSkill);
  const valides = results.filter((r) => r.ok).length;
  const ok = results.every((r) => r.ok);
  const rapport = { ok, total: results.length, valid: valides, results };

  if (json) {
    process.stdout.write(JSON.stringify(rapport, null, 2) + '\n');
    return rapport;
  }

  logHeader('AIAD SDD Mode — Skills validate', `${results.length} skill(s) trouvée(s)`);

  if (results.length === 0) {
    console.log(`  ${C.gris}Aucune skill installée — voir .claude/skills/.${C.reset}\n`);
    return rapport;
  }

  for (const r of results) {
    const sym = r.ok ? `${C.vert}✓${C.reset}` : `${C.rouge}✗${C.reset}`;
    log(sym, `${C.gras}${r.name}${C.reset} ${C.gris}— ${relative(racine, r.path)}${C.reset}`);
    for (const m of r.raisons) {
      console.log(`     ${C.rouge}↳${C.reset} ${m}`);
    }
  }

  if (ok) {
    console.log(`\n${C.vert}${C.gras}  ✓ Toutes les skills sont valides (${valides}/${results.length}).${C.reset}\n`);
  } else {
    console.log(`\n${C.rouge}${C.gras}  ✗ ${results.length - valides} skill(s) invalide(s) sur ${results.length}.${C.reset}\n`);
  }

  return rapport;
}

// ─── Alias EN canoniques (item #42) ─────────────────────────────────────────
export {
  listerSkills as listSkills,
  validerSkill as validateSkill,
  validerSkills as validateSkills,
};
