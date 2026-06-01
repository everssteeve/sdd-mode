// AIAD SDD Mode — Mini-parser YAML frontmatter zero-dep.
//
// Le parsing actuel des artefacts (Intent / SPEC) repose sur des regex
// tolérantes qui matchent des champs en clair dans le corps Markdown
// ("**Statut** : ready"). Cela rend la lecture fragile dès qu'un utilisateur
// formate différemment. Pour fiabiliser sans introduire de dépendance, ce
// module offre un parseur minimaliste compatible avec la convention de
// frontmatter inline délimitée par `---` ... `---`.
//
// Compatibilité ascendante : `parseFrontmatter(c)` retourne toujours
// `{ data, body }`. Si le fichier ne commence pas par `---`, `data` est `{}`
// et `body` est le contenu complet — les anciens lecteurs basés sur regex
// continuent à fonctionner sur le `body`.
//
// Sous-ensemble YAML supporté (suffisant pour les artefacts SDD) :
//   - chaînes (avec ou sans quotes simples/doubles)
//   - nombres (entiers, décimaux, négatifs)
//   - booléens (true / false)
//   - null (null, ~)
//   - listes inline : `tags: [a, b, c]`
//   - listes multilignes :
//       tags:
//         - a
//         - b
//
// Non supporté (volontairement) : objets imbriqués, multi-doc, anchors/refs,
// types datetime ; les artefacts SDD n'en ont pas besoin.
//
// Documentation : https://aiad.ovh

const FENCE = '---';

function parseScalar(brut) {
  const s = brut.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number.parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return Number.parseFloat(s);
  // Chaîne entre quotes : on dépiaute la première paire matching.
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  // Liste inline `[a, b, c]`.
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((x) => parseScalar(x));
  }
  return s;
}

function indentLevel(ligne) {
  const m = ligne.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

/**
 * Parse les lignes YAML d'un bloc frontmatter en objet plat.
 * Supporte clés scalaires, listes inline, listes multilignes (préfixe `- `).
 *
 * @param {string[]} lignes
 * @returns {Record<string, unknown>}
 */
function parseLignes(lignes) {
  const out = {};
  let cleListe = null;
  let indentListe = null;

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    if (ligne.trim() === '' || ligne.trim().startsWith('#')) continue;

    const ind = indentLevel(ligne);
    const sansIndent = ligne.slice(ind);

    // Item de liste multilignes (`  - valeur`).
    if (sansIndent.startsWith('- ') && cleListe && ind > (indentListe ?? -1)) {
      out[cleListe].push(parseScalar(sansIndent.slice(2)));
      continue;
    }

    // Sinon : c'est une nouvelle clé.
    cleListe = null;

    const match = sansIndent.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!match) continue;
    const cle = match[1];
    const valeur = match[2];

    if (valeur === '') {
      // Démarrage potentiel d'une liste multilignes : on regarde la prochaine
      // ligne non vide.
      const next = lignes.slice(i + 1).find((l) => l.trim() !== '' && !l.trim().startsWith('#'));
      if (next && next.trim().startsWith('- ')) {
        out[cle] = [];
        cleListe = cle;
        indentListe = ind;
      } else {
        out[cle] = null;
      }
    } else {
      out[cle] = parseScalar(valeur);
    }
  }
  return out;
}

/**
 * Extrait le frontmatter d'une chaîne. Retourne toujours `{ data, body }`.
 *
 * @param {string} contenu
 * @returns {{ data: Record<string, unknown>, body: string }}
 */
export function parseFrontmatter(contenu) {
  if (typeof contenu !== 'string') return { data: {}, body: '' };
  // Doit commencer par `---` suivi d'un saut de ligne.
  if (!contenu.startsWith(FENCE + '\n') && contenu !== FENCE && !contenu.startsWith(FENCE + '\r\n')) {
    return { data: {}, body: contenu };
  }
  // Trouver la fermeture sur sa propre ligne.
  const apresOuverture = contenu.slice(FENCE.length).replace(/^\r?\n/, '');
  const reFermeture = /\n---\s*(\r?\n|$)/;
  const m = apresOuverture.match(reFermeture);
  if (!m) return { data: {}, body: contenu };
  const blocYaml = apresOuverture.slice(0, m.index);
  const body = apresOuverture.slice(m.index + m[0].length);
  const data = parseLignes(blocYaml.split(/\r?\n/));
  return { data, body };
}

/**
 * Sérialise un objet plat en frontmatter YAML simple. Utilisé par la
 * commande `aiad-sdd docs` ou des migrations futures. Ne supporte que les
 * mêmes types que `parseFrontmatter`.
 *
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
export function stringifyFrontmatter(data) {
  if (!data || Object.keys(data).length === 0) return '';
  const lignes = ['---'];
  for (const [cle, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      lignes.push(`${cle}: [${val.map(formaterScalaire).join(', ')}]`);
    } else {
      lignes.push(`${cle}: ${formaterScalaire(val)}`);
    }
  }
  lignes.push('---', '');
  return lignes.join('\n');
}

function formaterScalaire(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v);
  // Quoter si la chaîne contient des caractères ambigus pour YAML.
  if (/^(true|false|null|~)$/i.test(s) || /^-?\d/.test(s) || s.includes(': ') || s.includes('#')) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}
