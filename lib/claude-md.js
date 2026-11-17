// AIAD SDD Mode — Bloc AIAD dans `CLAUDE.md`.
//
// La section SDD Mode est posée entre deux balises : `uninstall` peut ainsi
// retirer exactement ce que l'outil a écrit, sans toucher au texte que
// l'équipe a mis avant ou après.
//
// @intent INTENT-039
// @spec SPEC-039-1-installation-fiable
// @verified-by test/claude-md.test.js
//
// Documentation : https://aiad.ovh

export const BLOC_DEBUT = '<!-- aiad-sdd:section-start -->';
export const BLOC_FIN = '<!-- aiad-sdd:section-end -->';

/** Entoure la section livrée de ses balises (idempotent). */
export function envelopperSectionSdd(section) {
  const corps = String(section).trim();
  if (corps.includes(BLOC_DEBUT)) return corps + '\n';
  return `${BLOC_DEBUT}\n${corps}\n${BLOC_FIN}\n`;
}

/**
 * Retire la section SDD Mode d'un `CLAUDE.md`.
 *
 * - Bloc balisé → retiré exactement.
 * - Installation antérieure aux balises → la section est retirée si elle est
 *   identique au gabarit livré (`gabarit`), ou, à défaut, du titre
 *   `# SDD Mode` jusqu'à la dernière ligne du gabarit si elle est retrouvée.
 * - Sinon rien n'est retiré : `retire` vaut false et l'appelant le signale.
 *
 * @param {string} contenu
 * @param {string} [gabarit] — section telle que livrée (sans balises)
 * @returns {{ contenu: string, retire: boolean }}
 */
export function retirerSectionSdd(contenu, gabarit = '') {
  const texte = String(contenu);
  const d = texte.indexOf(BLOC_DEBUT);
  const f = texte.indexOf(BLOC_FIN);
  const finir = (avant, apres) => {
    const a = avant.trimEnd();
    const b = apres.replace(/^\s+/, '');
    const joint = a && b ? `${a}\n\n${b}` : a || b;
    return joint ? joint.trimEnd() + '\n' : '';
  };
  if (d >= 0 && f > d) {
    return { contenu: finir(texte.slice(0, d), texte.slice(f + BLOC_FIN.length)), retire: true };
  }
  const tpl = String(gabarit).trim();
  if (tpl) {
    const i = texte.indexOf(tpl);
    if (i >= 0) return { contenu: finir(texte.slice(0, i), texte.slice(i + tpl.length)), retire: true };
    const titre = texte.search(/^# SDD Mode/m);
    const derniere = tpl.split('\n').pop();
    if (titre >= 0 && derniere) {
      const j = texte.indexOf(derniere, titre);
      if (j >= 0) return { contenu: finir(texte.slice(0, titre), texte.slice(j + derniere.length)), retire: true };
    }
  }
  return { contenu: texte, retire: false };
}

export {
  envelopperSectionSdd as wrapSddSection,
  retirerSectionSdd as removeSddSection,
};
