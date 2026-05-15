// AIAD SDD Mode — Dashboard : markdown render léger (#461).
//
// Rendu Markdown limité, zero-dep, anti-XSS — utilisé pour transformer
// les sections plain-text des Intents (POURQUOI / POUR QUI / OBJECTIF /
// CONTRAINTES / CRITÈRE DE DRIFT) en HTML lisible. Supporte :
//   - **gras** → <strong>
//   - *italic* / _italic_ → <em>
//   - `code inline` → <code>
//   - [texte](url) → <a> (URL https/http/mailto + ancres internes)
//   - listes "- " ou "* " ou "1. " → <ul>/<ol>
//   - lignes vides séparent des paragraphes
//   - mentions d'identifiants AIAD (INTENT-NNN, SPEC-NNN-N, FACT-NNN,
//     ADR-NNN) wrappées en <code>
//
// Stratégie anti-XSS : escape HTML d'abord, puis appliquer les regex
// sur la version échappée. Les valeurs `href` sont validées contre une
// allowlist de protocoles (http/https/mailto/anchor).
//
// Aucun effet de bord. Pure transformation `string → string HTML`.
//
// Documentation : https://aiad.ovh

import { escape } from './render.js';

const SAFE_HREF = /^(https?:\/\/|mailto:|#)/i;

function lienHref(href) {
  if (typeof href !== 'string') return '';
  const trim = href.trim();
  if (SAFE_HREF.test(trim)) return trim;
  return '';
}

// Rend une ligne en inline (gras, italic, code, liens, refs AIAD).
export function rendreLigneInline(ligneEchappee) {
  let s = ligneEchappee;
  // Liens [texte](url) — appliqué avant les autres pour éviter conflit
  // avec * dans l'URL.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, texte, url) => {
    const safe = lienHref(url);
    if (!safe) return m;
    return `<a href="${safe}" target="_blank" rel="noopener">${texte}</a>`;
  });
  // Code inline `...` (1 backtick)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Gras **...** (2 étoiles)
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic *...* ou _..._ (1 étoile, en évitant les ** déjà consumés)
  s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?!\w)/g, '<em>$1</em>');
  s = s.replace(/(?<![_\w])_([^_\n]+)_(?!\w)/g, '<em>$1</em>');
  // Refs AIAD (INTENT-NNN, SPEC-NNN-N, FACT-NNN, ADR-NNN, US-NNN, KR-N.N)
  // Évite double-wrap dans <code> déjà émis.
  s = s.replace(/\b((?:INTENT|SPEC|FACT|ADR|US|KR|O)-[A-Z0-9.\-]+)\b/g, (m, ref) => {
    // Ne pas wrapper si déjà dans un <code> rendu plus haut.
    return `<code>${ref}</code>`;
  });
  return s;
}

// Détecte le type de bloc d'une ligne après trim.
function typeLigne(ligne) {
  if (/^\s*$/.test(ligne)) return 'blank';
  if (/^\s*[*-]\s+/.test(ligne)) return 'ul';
  if (/^\s*\d+\.\s+/.test(ligne)) return 'ol';
  return 'p';
}

function stripPuce(ligne) {
  return ligne.replace(/^\s*(?:[*-]|\d+\.)\s+/, '');
}

// Rend une string Markdown en HTML léger. Sortie sécurisée (escape HTML
// préalable). Renvoie '' si entrée vide.
export function rendreMarkdown(texte) {
  if (texte == null || texte === '') return '';
  const lignes = String(texte).split(/\r?\n/);
  const blocs = [];
  let i = 0;
  while (i < lignes.length) {
    const t = typeLigne(lignes[i]);
    if (t === 'blank') { i++; continue; }
    if (t === 'ul' || t === 'ol') {
      const tag = t === 'ul' ? 'ul' : 'ol';
      const items = [];
      while (i < lignes.length && typeLigne(lignes[i]) === t) {
        const echappee = escape(stripPuce(lignes[i]));
        items.push(`<li>${rendreLigneInline(echappee)}</li>`);
        i++;
      }
      blocs.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }
    // Paragraphe : concat les lignes consécutives non-blank, non-puce.
    const para = [];
    while (i < lignes.length && typeLigne(lignes[i]) === 'p') {
      para.push(escape(lignes[i].trim()));
      i++;
    }
    const inline = rendreLigneInline(para.join(' '));
    blocs.push(`<p>${inline}</p>`);
  }
  return blocs.join('');
}

// Aide pour les modules qui veulent un fallback : si Markdown rendu vide
// (pas de blocs), revenir à un `<pre>` plain text échappé.
export function rendreSectionIntent(texte) {
  const md = rendreMarkdown(texte);
  if (md.trim() === '') return texte ? `<pre>${escape(texte)}</pre>` : '';
  return `<div class="md-light">${md}</div>`;
}

// Alias EN canoniques (#42)
export {
  rendreLigneInline as renderInlineLine,
  rendreMarkdown as renderMarkdown,
  rendreSectionIntent as renderIntentSection,
};
