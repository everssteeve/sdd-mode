// @spec SPEC-016-1-architecture-4-couches
// @intent INTENT-016

export const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// Lien vers un fichier source — par défaut relatif au dossier dashboard/
// (donc ".." en préfixe pour remonter à la racine projet). Quand
// `_sourceBase` est défini (ex: GitHub Pages avec --source-base), on préfixe
// par cette URL absolue pour pointer vers le blob GitHub plutôt que vers un
// fichier local introuvable depuis le site publié.
let _sourceBase = '';
export function setSourceBase(base) {
  _sourceBase = base ? (base.endsWith('/') ? base : base + '/') : '';
}
export function lienSource(file, texte) {
  if (!file) return '';
  const href = hrefSource(file);
  const label = texte != null ? texte : file;
  return `<a class="src-link" href="${href}" target="_blank" rel="noopener" title="Ouvrir ${escape(file)}">${escape(label)}</a>`;
}

// (#313) URL brute pour les cas qui veulent customiser le wrapper `<a>` (kanban
// cards qui héritent du style parent, mentions inline `<p>...source...</p>`).
// Respecte _sourceBase comme `lienSource()`. Toujours échappé HTML.
export function hrefSource(file, ligne) {
  if (!file) return '';
  const anchor = ligne != null ? `#L${ligne}` : '';
  return _sourceBase ? `${_sourceBase}${escape(file)}${anchor}` : `../${escape(file)}${anchor}`;
}

// (#309) Lien vers une ligne précise dans un fichier source. Utilisé par les
// tables qui exposent une "Ligne L24" (ADRs, drift, tech-debt). L'anchor
// `#L24` est interprété par GitHub/GitLab/Bitbucket pour scroller pile sur la
// ligne, et reste inoffensif sur un fichier local (ignoré par le navigateur).
export function lienSourceLigne(file, ligne, texte) {
  if (!file) return texte ? escape(texte) : '';
  const label = texte != null ? texte : (ligne != null ? `L${ligne}` : file);
  const href = hrefSource(file, ligne);
  return `<a class="src-link" href="${href}" target="_blank" rel="noopener" title="Ouvrir ${escape(file)}${ligne != null ? ' à la ligne ' + ligne : ''}">${escape(label)}</a>`;
}
