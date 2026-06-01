// AIAD SDD Mode — Suggestions de proximité ("did you mean...?").
//
// Si l'utilisateur tape une commande ou un flag inconnu, on calcule la
// distance de Levenshtein entre sa saisie et la liste des candidats valides.
// Si le ou les meilleurs match sont sous un seuil, on les suggère.
//
// **Zero-dep** : implémentation classique en O(n × m) — taille des chaînes
// CLI très petite, pas besoin d'optimisations type Damerau-Levenshtein-OSA.
//
// Documentation : https://aiad.ovh

/**
 * Calcule la distance de Levenshtein entre deux chaînes (insertion,
 * suppression ou substitution comptent 1).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  a = String(a);
  b = String(b);
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Implémentation deux-rangées (espace O(min(a, b))).
  if (a.length > b.length) { const t = a; a = b; b = t; }
  let prev = new Array(a.length + 1);
  let curr = new Array(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;
  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1,        // insertion
        prev[i] + 1,            // suppression
        prev[i - 1] + cout,     // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[a.length];
}

/**
 * Suggère le ou les candidats les plus proches de `saisie`.
 *
 * @param {string} saisie
 * @param {string[]} candidats
 * @param {{ max?: number, seuil?: number }} [options]
 *   - `max` : nombre max de suggestions retournées (défaut 1).
 *   - `seuil` : distance maximale acceptée. Par défaut, calcule un seuil
 *     proportionnel à la longueur (`max(2, ceil(len/3))`) pour tolérer une
 *     coquille sur 3 caractères saisis.
 * @returns {string[]} suggestions triées par distance croissante (vide si
 *                    aucune n'est sous le seuil)
 */
export function suggererProches(saisie, candidats, options = {}) {
  const s = String(saisie || '').trim();
  if (!s || !Array.isArray(candidats) || candidats.length === 0) return [];
  const max = options.max ?? 1;
  const seuilDefaut = Math.max(2, Math.ceil(s.length / 3));
  const seuil = options.seuil ?? seuilDefaut;

  const scored = candidats.map((c) => ({ c, d: levenshtein(s, c) }))
    .filter((x) => x.d <= seuil)
    .sort((a, b) => a.d - b.d || a.c.localeCompare(b.c));

  return scored.slice(0, max).map((x) => x.c);
}

/**
 * Construit le suffixe humain "Voulais-tu dire `xxx` ?" pour un message
 * d'erreur. Vide si pas de suggestion.
 *
 * @param {string} saisie
 * @param {string[]} candidats
 * @param {{ max?: number, seuil?: number, prefix?: string }} [options]
 * @returns {string}
 */
export function indiceVoulaisTuDire(saisie, candidats, options = {}) {
  const sugg = suggererProches(saisie, candidats, options);
  if (sugg.length === 0) return '';
  const prefix = options.prefix ?? 'Voulais-tu dire';
  if (sugg.length === 1) return `${prefix} \`${sugg[0]}\` ?`;
  return `${prefix} ${sugg.map((s) => `\`${s}\``).join(' ou ')} ?`;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  suggererProches as findClosest,
  indiceVoulaisTuDire as didYouMean,
};
