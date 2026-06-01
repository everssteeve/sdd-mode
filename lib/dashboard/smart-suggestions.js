// AIAD SDD Mode — Dashboard : suggestions intelligentes de rapprochements (#463).
//
// Détecte les Intents qui partagent des dimensions (tags, OKR, persona,
// outcome) et suggère au PM des rapprochements possibles :
//   - **Cluster tag** : ≥ 3 Intents avec ≥ 2 tags en commun
//   - **Cluster OKR** : ≥ 2 Intents qui visent le même Key Result
//   - **Cluster persona** : ≥ 2 Intents servant le même persona
//   - **Doublon potentiel** : 2 Intents avec ≥ 5 tokens significatifs
//     en commun dans le titre + objectif (peut indiquer un doublon)
//
// Pour chaque cluster, propose une action de rapprochement (regrouper
// en un seul Intent parent / décomposer en SPECs partagées / aligner
// le sprint).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

function lireTagsIntent(intent) {
  const v = intent.tags || intent.Tags || intent.labels || intent.Labels || intent.etiquettes;
  if (Array.isArray(v)) return v.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[,;]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  return [];
}

// Helper générique : extrait set string depuis array ou CSV.
function extraireSet(intent, ...alias) {
  const out = new Set();
  for (const a of alias) {
    const c = intent?.[a];
    if (c == null) continue;
    if (Array.isArray(c)) {
      for (const v of c) if (v) out.add(String(v).trim());
    } else if (typeof c === 'string' && c.trim()) {
      for (const v of c.split(/[,;]/)) {
        const s = v.trim();
        if (s) out.add(s);
      }
    }
  }
  return [...out];
}

function lireOkrsIntent(intent) {
  return extraireSet(intent, 'okr', 'OKR', 'okrs', 'objective', 'Objective', 'objectives');
}

function lirePersonas(intent) {
  return extraireSet(intent, 'personas', 'persona', 'Personas');
}

// Tokens significatifs : mots ≥ 5 chars, lowercased + stripped accents.
const STOP_WORDS = new Set([
  'intent', 'spec', 'cette', 'cetto', 'avoir', 'faire', 'aller', 'avec',
  'pour', 'plus', 'sans', 'mais', 'dans', 'leur', 'leurs', 'notre', 'nous',
  'vous', 'cette', 'celui', 'celle', 'ceux', 'celles', 'mois', 'jour',
]);

function tokensSignificatifs(texte) {
  if (!texte) return new Set();
  const norm = String(texte)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return new Set(
    norm.split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 5 && !STOP_WORDS.has(t))
  );
}

function intersection(setA, setB) {
  const out = [];
  for (const v of setA) if (setB.has(v)) out.push(v);
  return out;
}

// Calcule les clusters par dimension. Retourne `[{type, cle, intents,
// actions}]` triés par taille décroissante.
export function calculerSuggestions(donnees, options = {}) {
  const intents = (donnees?.intents || []).filter((i) => !['done', 'archived'].includes(i.statut));
  const clusters = [];

  // Clusters par OKR partagé
  const parOkr = new Map();
  for (const i of intents) {
    for (const k of lireOkrsIntent(i)) {
      if (!parOkr.has(k)) parOkr.set(k, []);
      parOkr.get(k).push(i);
    }
  }
  for (const [okr, items] of parOkr) {
    if (items.length < 2) continue;
    clusters.push({
      type: 'okr',
      cle: okr,
      intents: items.map((x) => ({ id: x.id, titre: x.titre || '', file: x.file || null, statut: x.statut })),
      action: `Considérer une revue conjointe — ces Intents servent tous ${okr}.`,
    });
  }

  // Clusters par persona partagé
  const parPersona = new Map();
  for (const i of intents) {
    for (const p of lirePersonas(i)) {
      if (!parPersona.has(p)) parPersona.set(p, []);
      parPersona.get(p).push(i);
    }
  }
  for (const [persona, items] of parPersona) {
    if (items.length < 2) continue;
    clusters.push({
      type: 'persona',
      cle: persona,
      intents: items.map((x) => ({ id: x.id, titre: x.titre || '', file: x.file || null, statut: x.statut })),
      action: `Atelier persona-centré possible — ces Intents touchent ${persona}.`,
    });
  }

  // Clusters par tags (≥ 2 tags partagés entre ≥ 3 Intents)
  const tagsParIntent = new Map(intents.map((i) => [i.id, new Set(lireTagsIntent(i))]));
  const dejaVu = new Set();
  for (let i = 0; i < intents.length; i++) {
    const groupe = [intents[i]];
    const tagsA = tagsParIntent.get(intents[i].id);
    if (tagsA.size < 2) continue;
    for (let j = i + 1; j < intents.length; j++) {
      const tagsB = tagsParIntent.get(intents[j].id);
      const inter = intersection(tagsA, tagsB);
      if (inter.length >= 2) groupe.push(intents[j]);
    }
    if (groupe.length >= 3) {
      // Cluster tag détecté — dédoublonne via une clé canonique des IDs.
      const cle = groupe.map((g) => g.id).sort().join('|');
      if (dejaVu.has(cle)) continue;
      dejaVu.add(cle);
      const tagsCommuns = [...tagsA].filter((t) => groupe.every((g) => tagsParIntent.get(g.id).has(t)));
      clusters.push({
        type: 'tag',
        cle: tagsCommuns.join(' + '),
        intents: groupe.map((x) => ({ id: x.id, titre: x.titre || '', file: x.file || null, statut: x.statut })),
        action: `Roadmap thématique possible — ces Intents partagent ${tagsCommuns.map((t) => '#' + t).join(' + ')}.`,
      });
    }
  }

  // Doublons potentiels (titre + objectif similaires)
  const seuil = options.seuilDoublon || 4;
  for (let i = 0; i < intents.length; i++) {
    const tokensA = new Set([
      ...tokensSignificatifs(intents[i].titre),
      ...tokensSignificatifs(intents[i].sections?.objectif),
    ]);
    if (tokensA.size < seuil) continue;
    for (let j = i + 1; j < intents.length; j++) {
      const tokensB = new Set([
        ...tokensSignificatifs(intents[j].titre),
        ...tokensSignificatifs(intents[j].sections?.objectif),
      ]);
      const inter = intersection(tokensA, tokensB);
      if (inter.length >= seuil) {
        clusters.push({
          type: 'doublon',
          cle: inter.slice(0, 5).join(', '),
          intents: [
            { id: intents[i].id, titre: intents[i].titre || '', file: intents[i].file || null, statut: intents[i].statut },
            { id: intents[j].id, titre: intents[j].titre || '', file: intents[j].file || null, statut: intents[j].statut },
          ],
          action: `Doublon potentiel — ${inter.length} tokens significatifs en commun. Vérifier si à fusionner.`,
        });
      }
    }
  }

  // Tri : doublon d'abord (signal le plus actionnable), puis OKR, persona, tag.
  const RANK = { doublon: 0, okr: 1, persona: 2, tag: 3 };
  clusters.sort((a, b) => RANK[a.type] - RANK[b.type] || b.intents.length - a.intents.length);
  return {
    clusters,
    totaux: {
      total: clusters.length,
      okr: clusters.filter((c) => c.type === 'okr').length,
      persona: clusters.filter((c) => c.type === 'persona').length,
      tag: clusters.filter((c) => c.type === 'tag').length,
      doublon: clusters.filter((c) => c.type === 'doublon').length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const BADGE_TYPE = {
  okr: { cls: 'badge-info', label: 'OKR partagé' },
  persona: { cls: 'badge-info', label: 'Persona partagé' },
  tag: { cls: 'badge-muted', label: 'Tags communs' },
  doublon: { cls: 'badge-warn', label: 'Doublon potentiel' },
};

const SUGG_CSS = `<style>
.sugg-card { padding:.55rem .7rem; margin:.4rem 0; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); font-size:.85rem; }
.sugg-card.type-doublon { border-left:4px solid #e8590c; background:rgba(232,89,12,.04); }
.sugg-card.type-okr { border-left:4px solid #4c6ef5; }
.sugg-card.type-persona { border-left:4px solid #9775fa; }
.sugg-card.type-tag { border-left:4px solid #20c997; }
.sugg-card-head { display:flex; align-items:baseline; gap:.5rem; flex-wrap:wrap; }
.sugg-cle { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.78rem; color: var(--muted, #777); }
.sugg-intents { display:flex; flex-wrap:wrap; gap:.3rem; margin:.3rem 0; }
.sugg-intent-chip { padding:.15rem .4rem; background:rgba(127,127,127,.06); border-radius:.2rem; font-size:.75rem; }
.sugg-action { color: var(--muted, #777); font-size:.78rem; font-style: italic; }
</style>`;

function chipIntent(it) {
  const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
  return `<span class="sugg-intent-chip" title="${escape(it.titre)} (${escape(it.statut)})">${idCell}</span>`;
}

export function blocSmartSuggestions(donnees) {
  const s = donnees?.smartSuggestions;
  if (!s) return '';
  if (s.clusters.length === 0) {
    return `<section>
      <h2>Suggestions de rapprochement <span class="count">aucune</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun cluster détecté entre les Intents actifs (OKR commun, persona partagé, tags communs ≥ 2, doublon potentiel). Le catalogue est diversifié.</p>
    </section>`;
  }
  const cards = s.clusters.slice(0, 10).map((c) => {
    const badge = BADGE_TYPE[c.type] || { cls: 'badge-muted', label: c.type };
    return `<div class="sugg-card type-${escape(c.type)}">
      <div class="sugg-card-head">
        <span class="badge ${badge.cls}">${escape(badge.label)}</span>
        <span class="sugg-cle">${escape(c.cle)}</span>
        <span class="muted" style="font-size:.7rem">${c.intents.length} Intent(s)</span>
      </div>
      <div class="sugg-intents">${c.intents.map(chipIntent).join('')}</div>
      <div class="sugg-action">→ ${escape(c.action)}</div>
    </div>`;
  }).join('');
  const t = s.totaux;
  return `${SUGG_CSS}<section>
    <h2>Suggestions de rapprochement <span class="count">${t.total} cluster(s) — ${t.doublon} doublon(s) · ${t.okr} OKR · ${t.persona} persona · ${t.tag} tags</span></h2>
    <p class="muted" style="font-size:.85rem">Détection automatique de clusters d'Intents sur 4 dimensions (OKR partagé, persona partagé, tags communs ≥ 2, doublon potentiel via tokens significatifs). Trié par actionnabilité (doublons d'abord). Seuls les Intents actifs/draft/in-progress sont analysés.</p>
    ${cards}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSuggestions as computeSmartSuggestions,
  blocSmartSuggestions as smartSuggestionsSection,
};
