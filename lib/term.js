// AIAD SDD Mode — Helpers d'affichage CLI partagés.
//
// Centralise la palette ANSI et les helpers `log*` jusque-là dupliqués dans
// init.js, update.js, upgrade.js, governance.js, hooks.js, dashboard.js,
// sdd-trace.js, emit-rules.js, status.js, coldstart.js. Module pur, sans
// effet de bord côté FS.
//
// Conventions :
//   - Les couleurs respectent NO_COLOR (https://no-color.org). Quand la
//     variable d'environnement NO_COLOR est définie OU que stdout n'est pas
//     un TTY, les codes ANSI sont neutralisés — utile en CI / pipes.
//   - Toutes les chaînes utilisateur restent en français. Les noms exportés
//     sont en anglais pour rejoindre la convention de l'écosystème Node et
//     préparer l'ouverture EU.
//
// Documentation : https://aiad.ovh

const FORCE_NO_COLOR =
  Boolean(process.env.NO_COLOR) ||
  process.env.AIAD_NO_COLOR === '1' ||
  (process.stdout && typeof process.stdout.isTTY === 'boolean' && !process.stdout.isTTY);

function code(seq) {
  return FORCE_NO_COLOR ? '' : seq;
}

// Palette ANSI 16 couleurs — lisible en thèmes clairs comme sombres.
export const COLORS = Object.freeze({
  vert: code('\x1b[32m'),
  jaune: code('\x1b[33m'),
  rouge: code('\x1b[31m'),
  cyan: code('\x1b[36m'),
  gris: code('\x1b[90m'),
  gras: code('\x1b[1m'),
  reset: code('\x1b[0m'),
});

// Alias court — courant dans les fichiers existants (`C`).
export const C = COLORS;

// Helpers de log structurés. Tous écrivent sur stdout via console.log
// avec un préfixe en deux espaces (le standard du CLI aiad-sdd).
export function log(symbole, message) {
  console.log(`  ${symbole} ${message}`);
}

export function logCreation(chemin) {
  log(`${C.vert}+${C.reset}`, chemin);
}

export function logMaj(chemin) {
  log(`${C.cyan}↑${C.reset}`, `${chemin} ${C.gris}(synchronisé)${C.reset}`);
}

export function logOk(chemin) {
  log(`${C.vert}✓${C.reset}`, `${chemin} ${C.gris}(à jour)${C.reset}`);
}

export function logExiste(chemin) {
  log(`${C.jaune}~${C.reset}`, `${chemin} ${C.gris}(existe déjà, ignoré)${C.reset}`);
}

export function logEcrase(chemin) {
  log(`${C.jaune}!${C.reset}`, `${chemin} ${C.gris}(écrasé)${C.reset}`);
}

export function logPreserve(chemin) {
  log(`${C.jaune}~${C.reset}`, `${chemin} ${C.gris}(préservé)${C.reset}`);
}

export function logSkip(chemin, raison) {
  log(`${C.gris}-${C.reset}`, `${chemin} ${C.gris}(${raison})${C.reset}`);
}

export function logDrift(chemin) {
  log(`${C.rouge}✗${C.reset}`, `${chemin} ${C.rouge}(divergence)${C.reset}`);
}

// Bandeau de section — "  Titre\n" avec gras + saut de ligne après pour
// séparer les sections du log.
export function logSection(titre) {
  console.log(`\n${C.gras}  ${titre}${C.reset}\n`);
}

// En-tête de commande — utilisé par init / update / upgrade / emit-rules.
export function logHeader(titre, sousTitre) {
  console.log(`
${C.cyan}${C.gras}  ${titre}${C.reset}${sousTitre ? `\n${C.gris}  ${sousTitre}${C.reset}` : ''}
`);
}

// Récap final compact (créé / mis à jour / inchangé / préservé).
export function logStats({ created = 0, updated = 0, unchanged = 0, preserved = 0 } = {}) {
  console.log(
    `\n  ${C.vert}+${C.reset} ${created} créé(s)    ` +
      `${C.cyan}↑${C.reset} ${updated} synchronisé(s)    ` +
      `${C.vert}✓${C.reset} ${unchanged} inchangé(s)    ` +
      `${C.jaune}~${C.reset} ${preserved} préservé(s)\n`,
  );
}

// Détecte si la palette est active (utile pour adapter un test ou un rendu
// alternatif).
export function colorsEnabled() {
  return !FORCE_NO_COLOR;
}
