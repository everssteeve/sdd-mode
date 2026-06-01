// AIAD SDD Mode — Dashboard : alignement OKR / Objectifs (#450).
//
// Le PM doit pouvoir répondre « pour chaque Key Result trimestriel, quels
// Intents le servent et où en sommes-nous ? ». Cohérent avec la pratique
// OKR canonique (objectif qualitatif ambitieux + 3-5 Key Results mesurables).
//
// Source double :
//   (a) frontmatter Intent : `okr: KR-X` / `okrs: [KR-1, KR-2]` /
//       `objective: O-1` / `objectives: [...]`
//   (b) (optionnel) `.aiad/OKR.md` qui décrit la matrice trimestrielle
//       avec sections `## O-1 — Objectif` puis `### KR-N: Description`
//       (format léger, parsé en best-effort).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseFrontmatter } from '../frontmatter.js';
import { lireFichier } from './collect.js';

// Pattern OKR : O-N (objectif) ou KR-N / KR-N.N (key result).
const PATTERN_KR = /\b(KR-[A-Za-z0-9.\-]+)\b/g;
const PATTERN_OBJ = /\b(O-[A-Za-z0-9.\-]+)\b/g;

function lireListe(intent, ...alias) {
  for (const a of alias) {
    const v = intent?.[a];
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === 'string' && v.trim() !== '') {
      return v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

// Extrait les références OKR d'un Intent. Priorité frontmatter, fallback
// scan du corps Intent (sections) pour les KR-N mentionnés en passant.
export function lireRefsOkr(intent) {
  const refsFront = [
    ...lireListe(intent, 'okrs', 'okr', 'OKR'),
    ...lireListe(intent, 'objectives', 'objective', 'Objective'),
    ...lireListe(intent, 'key_results', 'keyResults'),
  ];
  const refs = new Set(refsFront);
  // Scan corpus : seulement si frontmatter ne fournit rien — évite faux
  // positifs sur Intent qui mentionne en passant un KR sans s'engager.
  if (refsFront.length === 0) {
    const corpus = Object.values(intent?.sections || {}).filter(Boolean).join(' ');
    let m;
    while ((m = PATTERN_KR.exec(corpus)) !== null) refs.add(m[1]);
    while ((m = PATTERN_OBJ.exec(corpus)) !== null) refs.add(m[1]);
  }
  return [...refs];
}

// Parse `.aiad/OKR.md` si présent. Format flexible :
//   # OKR Q3-2026
//   ## O-1 — Devenir leader EU
//   ### KR-1.1 : 10k MAU
//   ### KR-1.2 : Conversion > 70 %
//   ## O-2 — ...
export function lireFichierOkr(racineProjet, options = {}) {
  const chemin = options.fichier
    ? join(racineProjet, options.fichier)
    : join(racineProjet, '.aiad', 'OKR.md');
  if (!existsSync(chemin)) return { fichier: null, objectifs: [] };
  const contenu = lireFichier(chemin);
  if (!contenu) return { fichier: null, objectifs: [] };
  const { body } = parseFrontmatter(contenu);
  const objectifs = [];
  let courant = null;
  for (const ligne of body.split(/\r?\n/)) {
    const objM = ligne.match(/^##\s+(O-[A-Za-z0-9.\-]+)\s*[—:\-]?\s*(.*)$/);
    if (objM) {
      courant = { id: objM[1], description: objM[2].trim(), keyResults: [] };
      objectifs.push(courant);
      continue;
    }
    const krM = ligne.match(/^###\s+(KR-[A-Za-z0-9.\-]+)\s*[—:\-]?\s*(.*)$/);
    if (krM && courant) {
      courant.keyResults.push({ id: krM[1], description: krM[2].trim() });
    }
  }
  return {
    fichier: relative(racineProjet, chemin),
    objectifs,
  };
}

export function calculerOkrMapping(racineProjet, donnees) {
  const okr = lireFichierOkr(racineProjet);
  const intents = donnees?.intents || [];
  // Map ref OKR → intents qui la servent.
  const refsParIntent = new Map();
  for (const i of intents) {
    refsParIntent.set(i.id, lireRefsOkr(i));
  }
  const parRef = new Map();
  for (const [iid, refs] of refsParIntent) {
    for (const r of refs) {
      if (!parRef.has(r)) parRef.set(r, []);
      parRef.get(r).push(iid);
    }
  }
  // Enrichit chaque KR du fichier OKR (si présent) avec les Intents servants.
  for (const obj of okr.objectifs) {
    obj.intentsDirect = (parRef.get(obj.id) || []).map((iid) => ({ id: iid, titre: intents.find((i) => i.id === iid)?.titre || '' }));
    for (const kr of obj.keyResults) {
      kr.intents = (parRef.get(kr.id) || []).map((iid) => ({ id: iid, titre: intents.find((i) => i.id === iid)?.titre || '' }));
    }
  }
  // Calcule les références orphelines (pointées par un Intent mais non
  // déclarées dans OKR.md) — signal "OKR à formaliser".
  const declarees = new Set();
  for (const o of okr.objectifs) {
    declarees.add(o.id);
    for (const kr of o.keyResults) declarees.add(kr.id);
  }
  const orphelinesMap = new Map();
  for (const [ref, iids] of parRef) {
    if (!declarees.has(ref)) {
      orphelinesMap.set(ref, iids.map((iid) => ({ id: iid, titre: intents.find((i) => i.id === iid)?.titre || '' })));
    }
  }
  const intentsAlignes = new Set();
  for (const refs of refsParIntent.values()) {
    if (refs.length > 0) {
      for (const i of intents) {
        if (refsParIntent.get(i.id).length > 0) intentsAlignes.add(i.id);
      }
      break;
    }
  }
  return {
    fichier: okr.fichier,
    objectifs: okr.objectifs,
    orphelines: [...orphelinesMap.entries()].map(([ref, items]) => ({ ref, intents: items })),
    totaux: {
      objectifs: okr.objectifs.length,
      keyResults: okr.objectifs.reduce((s, o) => s + o.keyResults.length, 0),
      intentsAlignes: intentsAlignes.size,
      intentsTotal: intents.length,
      orphelines: orphelinesMap.size,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const OKR_CSS = `<style>
.okr-obj { padding:.6rem .8rem; margin:.5rem 0; border:1px solid var(--border, #ddd); border-left:4px solid #4c6ef5; border-radius:.4rem; background:var(--card-bg, #fff); }
.okr-obj-head { font-size: 1rem; font-weight: 600; }
.okr-kr { padding:.35rem .55rem; margin:.3rem 0; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; }
.okr-kr-head { font-weight:500; }
.okr-kr.is-orphelin { background: rgba(232,89,12,.05); border-left:3px solid #e8590c; }
.okr-intents { display:flex; flex-wrap:wrap; gap:.3rem; margin-top:.25rem; }
.okr-intent-chip { padding:.15rem .4rem; background:rgba(76,110,245,.1); border-radius:.2rem; font-size:.75rem; }
.okr-orphelin-banner { padding:.5rem .7rem; margin-top:.5rem; background:rgba(232,89,12,.07); border-left:3px solid #e8590c; border-radius:.25rem; font-size:.85rem; }
</style>`;

function chipIntent(i) {
  const idCell = i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`;
  return `<span class="okr-intent-chip" title="${escape(i.titre || '')}">${idCell}</span>`;
}

export function blocOkrMapping(donnees) {
  const o = donnees?.okrMapping;
  if (!o) return '';
  // Cas 1 : Pas de fichier OKR + zéro orphelin → section omise.
  if (!o.fichier && o.orphelines.length === 0) return '';
  const t = o.totaux;
  const objCards = o.objectifs.map((obj) => {
    const krs = obj.keyResults.map((kr) => {
      const chips = kr.intents.length > 0
        ? `<div class="okr-intents">${kr.intents.map(chipIntent).join('')}</div>`
        : '<div class="muted" style="font-size:.75rem">aucun Intent rattaché</div>';
      const cls = kr.intents.length === 0 ? 'is-orphelin' : '';
      return `<div class="okr-kr ${cls}">
        <div class="okr-kr-head"><code>${escape(kr.id)}</code> ${escape(kr.description)}</div>
        ${chips}
      </div>`;
    }).join('');
    const directChips = obj.intentsDirect.length > 0
      ? `<div class="okr-intents">${obj.intentsDirect.map(chipIntent).join('')}</div>`
      : '';
    return `<div class="okr-obj">
      <div class="okr-obj-head"><code>${escape(obj.id)}</code> ${escape(obj.description)}</div>
      ${directChips}
      ${krs}
    </div>`;
  }).join('');
  const orphelines = o.orphelines.length > 0
    ? `<div class="okr-orphelin-banner"><strong>${o.orphelines.length} référence(s) OKR orpheline(s)</strong> — citée(s) en frontmatter d'Intent mais absente(s) de <code>.aiad/OKR.md</code> :
      <ul>${o.orphelines.slice(0, 8).map((or) => `<li><code>${escape(or.ref)}</code> ← ${or.intents.map(chipIntent).join(' ')}</li>`).join('')}</ul>
    </div>`
    : '';
  const empty = o.fichier && o.objectifs.length === 0
    ? '<p class="muted">Le fichier OKR existe mais ne déclare aucun objectif. Format attendu : `## O-1 — Description` puis `### KR-1.1 : Cible mesurable`.</p>'
    : '';
  return `${OKR_CSS}<section>
    <h2>Alignement OKR <span class="count">${t.objectifs} objectif(s) · ${t.keyResults} KR · ${t.intentsAlignes}/${t.intentsTotal} Intents alignés${t.orphelines > 0 ? ` · ${t.orphelines} orpheline(s)` : ''}</span></h2>
    <p class="muted" style="font-size:.85rem">Pour chaque Key Result trimestriel déclaré dans ${o.fichier ? lienSource(o.fichier) : '<code>.aiad/OKR.md</code>'}, Intents qui le servent (frontmatter <code>okr: KR-X</code> ou alias). KR sans Intent rattaché en orange.</p>
    ${empty}
    ${objCards}
    ${orphelines}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lireRefsOkr as readOkrRefs,
  lireFichierOkr as readOkrFile,
  calculerOkrMapping as computeOkrMapping,
  blocOkrMapping as okrMappingSection,
};
