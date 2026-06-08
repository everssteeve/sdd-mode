// AIAD SDD Mode — Détection des marqueurs TODO-JNSP (items §3.2).
//
// **Cap stratégique** : le protocole JNSP (« je ne sais pas » = signal valide)
// devient *enforced* au niveau harness via un hook `PreToolUse` qui bloque le
// `git commit` tant qu'un marqueur de question agent→humain non tranchée
// subsiste dans le code stagé. Le `pre-commit.sh` reste le filet (défense en
// profondeur). Ce module porte la **logique pure** (testable) ; les scripts de
// hook self-contained (`.aiad/hooks/jnsp-scan.js`) en répliquent le marqueur
// par portabilité (un hook embarqué dans un projet utilisateur ne peut pas
// importer `lib/`). Le test `test/jnsp.test.js` garde les deux sources alignées.
//
// **Faux positifs écartés** (cf. `test/pre-commit.test.js`) :
//   1. la doc Markdown (.md/.markdown/.mdx) qui décrit le pattern ;
//   2. les mentions hors commentaire (chaînes, backticks) via une regex
//      ancrée sur un délimiteur de commentaire non précédé d'un backtick.
//
// **Zero-dep**.
//
// @intent INTENT-002
// @spec SPEC-002-1-gouvernance-enforced
// @verified-by test/jnsp.test.js
//
// Documentation : https://aiad.ovh

// Token construit par morceaux pour que ce fichier ne se déclenche pas
// lui-même lors d'un scan (la chaîne littérale complète n'apparaît jamais).
export const JNSP_TOKEN = 'TODO-' + 'JNSP';

/**
 * Source canonique de la regex de marqueur (chaîne, pour pouvoir comparer
 * avec le hook self-contained et garantir l'absence de divergence).
 */
export const JNSP_REGEX_SOURCE = `(^|[^\`])\\s*(//|/\\*|<!--|--|#|;|%|\\*)\\s*${JNSP_TOKEN}:`;

/** Construit une RegExp neuve (évite tout état `lastIndex` partagé). */
export function marqueur(flags = '') {
  return new RegExp(JNSP_REGEX_SOURCE, flags);
}

/**
 * Un fichier est « code » (scanné) s'il n'est pas de la documentation Markdown.
 *
 * @param {string} chemin
 * @returns {boolean}
 */
export function estFichierCode(chemin) {
  return !/\.(md|markdown|mdx)$/i.test(chemin);
}

/**
 * Scanne un contenu et retourne les lignes contenant un marqueur JNSP non résolu.
 *
 * @param {string} contenu
 * @param {string} [chemin] — pour étiqueter les hits
 * @returns {Array<{ file: string|undefined, line: number, text: string }>}
 */
export function scannerContenu(contenu, chemin) {
  const re = marqueur();
  const hits = [];
  const lignes = String(contenu).split('\n');
  for (let i = 0; i < lignes.length; i++) {
    if (re.test(lignes[i])) {
      hits.push({ file: chemin, line: i + 1, text: lignes[i].trim() });
    }
  }
  return hits;
}

/**
 * Construit la décision de hook `PreToolUse` à partir des hits.
 * Aucun hit → autorisé (decision null). Au moins un hit → deny + raison.
 *
 * @param {Array<{file?: string, line: number, text: string}>} hits
 * @returns {{ deny: boolean, reason: string }}
 */
export function construireDecisionHook(hits) {
  if (!hits || hits.length === 0) return { deny: false, reason: '' };
  const liste = hits.slice(0, 20)
    .map((h) => `  - ${h.file ? `${h.file}:` : ''}${h.line} ${h.text}`)
    .join('\n');
  const extra = hits.length > 20 ? `\n  … (+${hits.length - 20} autres)` : '';
  return {
    deny: true,
    reason:
      `Garde-fou JNSP : ${hits.length} marqueur(s) ${JNSP_TOKEN} non résolu(s) dans le code stagé.\n` +
      `${liste}${extra}\n` +
      `Tranche la question (remplace le marqueur par la décision humaine) avant de committer.`,
  };
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  estFichierCode as isCodeFile,
  scannerContenu as scanContent,
  construireDecisionHook as buildHookDecision,
};
