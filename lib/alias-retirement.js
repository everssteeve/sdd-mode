// AIAD SDD Mode — Retrait des alias plats (v2.0).
//
// Jusqu'à la v1.x, chaque sous-commande des routers `/sdd` et `/aiad` avait un
// alias plat (`/sdd-spec`, `/aiad-status`…) annoncé comme retiré à la v2. La
// v2.0 ne les livre plus ; ce module les retire des projets déjà installés.
//
// Règle de sûreté : on ne supprime un fichier `.claude/commands/<sdd|aiad>-*.md`
// que s'il est reconnaissable comme livré par le package —
//   - il porte le marqueur d'alias (« alias rétro-compatible ») ; ou
//   - son contenu est identique à la commande du profil minimal, et le projet
//     dispose du router correspondant (`.claude/sdd/<sub>.md` présent).
// Une commande écrite ou modifiée par l'utilisateur n'est jamais supprimée.
//
// @intent INTENT-036
// @spec SPEC-036-2-retrait-alias-plats
// @verified-by test/alias-retirement.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATES_MIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'minimal', '.claude', 'commands');

/** Marqueur présent dans la description de tout alias plat livré en v1.x. */
export const MARQUEUR_ALIAS = 'alias rétro-compatible';

/** Commandes de premier niveau conservées : routers et aide. */
export const COMMANDES_CONSERVEES = Object.freeze(['sdd.md', 'aiad.md', 'aiad-help.md']);

/**
 * Liste les alias plats retirables d'un projet.
 *
 * @param {string} projetDir
 * @returns {{ fichier: string, motif: 'alias' | 'minimal-remplacé' }[]} chemins relatifs au projet
 */
export function listerAliasPlats(projetDir) {
  const dir = join(projetDir, '.claude', 'commands');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir).sort()) {
    const m = nom.match(/^(sdd|aiad)-(.+)\.md$/);
    if (!m || COMMANDES_CONSERVEES.includes(nom)) continue;
    let contenu;
    try { contenu = readFileSync(join(dir, nom), 'utf-8'); } catch { continue; }
    const rel = `.claude/commands/${nom}`;
    if (contenu.includes(MARQUEUR_ALIAS)) {
      out.push({ fichier: rel, motif: 'alias' });
      continue;
    }
    const corpsRouter = join(projetDir, '.claude', m[1], `${m[2]}.md`);
    const gabaritMin = join(TEMPLATES_MIN, nom);
    if (existsSync(corpsRouter) && existsSync(gabaritMin) && readFileSync(gabaritMin, 'utf-8') === contenu) {
      out.push({ fichier: rel, motif: 'minimal-remplacé' });
    }
  }
  return out;
}

/**
 * Retire les alias plats d'un projet (ou les liste seulement en mode `check`).
 *
 * @param {string} projetDir
 * @param {{ check?: boolean }} [options]
 * @returns {string[]} chemins relatifs retirés (ou à retirer en mode check)
 */
export function retirerAliasPlats(projetDir, options = {}) {
  const cibles = listerAliasPlats(projetDir);
  if (!options.check) {
    for (const c of cibles) rmSync(join(projetDir, c.fichier), { force: true });
  }
  return cibles.map((c) => c.fichier);
}
