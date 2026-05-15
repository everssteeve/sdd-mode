// AIAD SDD Mode — Dashboard : couverture PRD (#423).
//
// Parse `.aiad/PRD.md` §3 (Personas) et §6 (User Stories) puis croise avec
// les Intent Statements pour répondre à la question PM canonique :
// « Quelles user stories du PRD ont au moins un Intent ? Quels personas
//   du PRD sont servis par mes intentions actuelles ? ».
//
// 2 sources de liaison Intent ↔ persona / US :
//   (a) frontmatter explicite (`personas: [Marketing EU, RSSI]`,
//       `user_stories: [US-001, US-003]`) — autoritaire.
//   (b) heuristique sur le corps Markdown — recherche du nom de persona
//       ou de l'id US-NNN dans le texte de l'Intent (sections POUR QUI,
//       OBJECTIF, ou body complet).
//
// Aucun effet de bord. Pure transformation `(racine, intents) → coverage`.
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseFrontmatter } from '../frontmatter.js';
import { lireFichier } from './collect.js';

// ─── Parsing PRD ─────────────────────────────────────────────────────────────

// Extrait la section `## N. Personas et Use Cases` (numéro optionnel).
// Retourne `{ personas: [{ nom, besoin, resultat }], fichier }`. Robuste
// aux variantes EN (`## Personas`, `## Personas and use cases`).
export function lirePersonasPrd(racineProjet, options = {}) {
  const chemin = options.fichier
    ? join(racineProjet, options.fichier)
    : join(racineProjet, '.aiad', 'PRD.md');
  if (!existsSync(chemin)) return { fichier: null, total: 0, personas: [] };
  const contenu = lireFichier(chemin);
  if (!contenu) return { fichier: null, total: 0, personas: [] };
  const { body } = parseFrontmatter(contenu);
  const lignes = body.split(/\r?\n/);
  const personas = [];
  let inSection = false;
  let header = null;
  for (const ligne of lignes) {
    const headerMatch = ligne.match(/^##\s+(.+?)\s*$/);
    if (headerMatch) {
      const titre = headerMatch[1].toLowerCase();
      if (/personas?\b/.test(titre) && /use\s*cases?|cas|et\b/.test(titre.replace(/[*_:]/g, '')) || /^personas?$/.test(titre.replace(/[*_:0-9.\s]/g, ''))) {
        inSection = true;
        header = null;
        continue;
      }
      if (inSection) break;
      continue;
    }
    if (!inSection) continue;
    const cells = ligne.split('|').map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length < 2) continue;
    // Skip header + separator rows.
    if (!header) {
      if (/persona/i.test(cells[0]) || /^[-\s|:]+$/.test(cells.join(''))) {
        header = cells;
        continue;
      }
    }
    if (/^[-\s|:]+$/.test(ligne) || /^---/.test(cells[0])) continue;
    // Skip placeholders like `[Nom]`
    if (/^\[.*\]$/.test(cells[0])) continue;
    if (!cells[0]) continue;
    personas.push({
      nom: cells[0],
      besoin: cells[1] || '',
      resultat: cells[2] || '',
    });
  }
  return {
    fichier: relative(racineProjet, chemin),
    total: personas.length,
    personas,
  };
}

// Extrait la section `## N. User Stories` (numéro optionnel). Parse le bloc
// ``` ```N | PRIO | persona peut action ... → Outcome : ... ``` ```
// Retourne `{ userStories: [{ id, priorite, persona, action, outcome }] }`.
export function lireUserStoriesPrd(racineProjet, options = {}) {
  const chemin = options.fichier
    ? join(racineProjet, options.fichier)
    : join(racineProjet, '.aiad', 'PRD.md');
  if (!existsSync(chemin)) return { fichier: null, total: 0, userStories: [] };
  const contenu = lireFichier(chemin);
  if (!contenu) return { fichier: null, total: 0, userStories: [] };
  const { body } = parseFrontmatter(contenu);
  const lignes = body.split(/\r?\n/);
  const stories = [];
  let inSection = false;
  for (const ligne of lignes) {
    const headerMatch = ligne.match(/^##\s+(.+?)\s*$/);
    if (headerMatch) {
      const titre = headerMatch[1].toLowerCase();
      if (/user\s*stories|user\s*story/.test(titre)) {
        inSection = true;
        continue;
      }
      if (inSection) break;
      continue;
    }
    if (!inSection) continue;
    // Pattern `US-NNN | PRIO | persona peut action ... → Outcome : ...`
    const m = ligne.match(/^\s*(US-[A-Za-z0-9-]+)\s*\|\s*(\w+)\s*\|\s*(.+?)(?:\s*→\s*Outcome\s*:\s*(.+))?$/i);
    if (!m) continue;
    stories.push({
      id: m[1],
      priorite: m[2].toUpperCase(),
      action: m[3].trim(),
      outcome: m[4] ? m[4].trim() : '',
    });
  }
  return {
    fichier: relative(racineProjet, chemin),
    total: stories.length,
    userStories: stories,
  };
}

// ─── Couverture Intent ↔ Persona / User Story ──────────────────────────────

function tokensSafePersona(nom) {
  return String(nom || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

// Heuristique : un Intent sert un persona si AU MOINS un token significatif
// du nom (≥ 3 chars) apparaît dans le body lowercase. Le frontmatter explicite
// `personas: [...]` prime toujours.
export function intentSertPersona(intent, persona) {
  const explicite = lireListeAlias(intent, 'personas', 'persona');
  if (explicite.includes(persona.nom)) return true;
  if (explicite.some((e) => e.toLowerCase() === persona.nom.toLowerCase())) return true;
  const corpus = construireCorpus(intent);
  if (!corpus) return false;
  const tokens = tokensSafePersona(persona.nom);
  if (tokens.length === 0) return false;
  // Match strict : au moins 1 token unique présent ; pour les personas
  // multi-mots, on exige tous les tokens (évite "Marketing EU" qui matche
  // sur "marketing" seul dans un contexte différent).
  if (tokens.length === 1) return corpus.includes(tokens[0]);
  return tokens.every((t) => corpus.includes(t));
}

// Heuristique : un Intent sert une User Story si l'id `US-NNN` apparaît
// dans le frontmatter ou dans le body de l'Intent.
export function intentSertUs(intent, us) {
  const explicite = lireListeAlias(intent, 'user_stories', 'userStories', 'us');
  if (explicite.includes(us.id)) return true;
  const corpus = construireCorpus(intent);
  if (!corpus) return false;
  return corpus.includes(us.id.toLowerCase());
}

// (#428) Heuristique : un Intent sert un Outcome du PRD §4 si :
//   (a) frontmatter `outcomes: [Latence, Conversion]` mentionne explicitement
//       le nom du critère
//   (b) ou le corpus Intent contient des tokens significatifs du nom de
//       l'outcome (≥ 4 chars pour éviter mots trop génériques)
//   (c) ou le corpus Intent contient la cible / baseline / valeur numérique
//       de l'outcome (ex. "50 ms", "70 %")
export function intentSertOutcome(intent, outcome) {
  const nomCritere = outcome?.critere || '';
  const explicite = lireListeAlias(intent, 'outcomes', 'outcome');
  if (explicite.some((e) => e.toLowerCase() === nomCritere.toLowerCase())) return true;
  const corpus = construireCorpus(intent);
  if (!corpus) return false;
  // Token significatif (≥ 4 chars) du nom de critère.
  const tokens = String(nomCritere || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
  if (tokens.length > 0 && tokens.every((t) => corpus.includes(t))) return true;
  // Valeur cible (ex. "< 50") ou baseline présente → fort signal de lien.
  const valeurs = [outcome?.cible, outcome?.baseline].filter(Boolean).map(String);
  for (const v of valeurs) {
    const num = v.match(/([0-9][0-9.,]*)\s*([%a-z]+)?/i);
    if (!num) continue;
    const pattern = num[1] + (num[2] || '');
    if (pattern.length >= 2 && corpus.includes(pattern.toLowerCase())) return true;
  }
  return false;
}

function lireListeAlias(intent, ...alias) {
  for (const a of alias) {
    const v = intent?.[a];
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string') return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function construireCorpus(intent) {
  if (!intent) return '';
  const parts = [intent.titre || ''];
  const s = intent.sections || {};
  for (const k of ['pourquoi', 'pourQui', 'objectif', 'contraintes', 'critereDrift']) {
    if (s[k]) parts.push(s[k]);
  }
  return parts.join(' ').toLowerCase();
}

// Calcule la couverture complète pour un set de personas + user stories.
// (#428) Inclut désormais le mapping Outcome → Intents (3ᵉ dimension PRD).
export function calculerCouverturePrd(racineProjet, donnees) {
  const personasInfo = lirePersonasPrd(racineProjet);
  const usInfo = lireUserStoriesPrd(racineProjet);
  const intents = donnees?.intents || [];

  const personas = personasInfo.personas.map((p) => {
    const intentsServants = intents
      .filter((i) => intentSertPersona(i, p))
      .map((i) => ({ id: i.id, file: i.file || null, titre: i.titre || '' }));
    return { ...p, intents: intentsServants, count: intentsServants.length };
  });

  const userStories = usInfo.userStories.map((us) => {
    const intentsServants = intents
      .filter((i) => intentSertUs(i, us))
      .map((i) => ({ id: i.id, file: i.file || null, titre: i.titre || '' }));
    return { ...us, intents: intentsServants, count: intentsServants.length };
  });

  // (#428) Outcomes du PRD §4 — déjà parsés par lib/dashboard/outcomes.js et
  // exposés dans `donnees.outcomes.criteres`. On croise ici avec les Intents.
  const outcomesSrc = (donnees?.outcomes?.criteres) || [];
  const outcomes = outcomesSrc.map((o) => {
    const intentsServants = intents
      .filter((i) => intentSertOutcome(i, o))
      .map((i) => ({ id: i.id, file: i.file || null, titre: i.titre || '' }));
    return { ...o, intents: intentsServants, count: intentsServants.length };
  });
  const outcomesCouverts = outcomes.filter((o) => o.count > 0).length;

  const personasCouvertes = personas.filter((p) => p.count > 0).length;
  const usCouvertes = userStories.filter((u) => u.count > 0).length;

  return {
    fichier: personasInfo.fichier || usInfo.fichier || null,
    personas,
    userStories,
    outcomes,
    totaux: {
      personas: personas.length,
      personasCouvertes,
      userStories: userStories.length,
      userStoriesCouvertes: usCouvertes,
      outcomes: outcomes.length,
      outcomesCouverts,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeCouverture(count) {
  if (count === 0) return '<span class="badge badge-bad">0 Intent</span>';
  if (count === 1) return `<span class="badge badge-warn">${count} Intent</span>`;
  return `<span class="badge badge-ok">${count} Intents</span>`;
}

function listeIntents(intents) {
  if (!intents.length) return '<em class="muted">aucun</em>';
  return intents.slice(0, 6).map((i) => i.file
    ? lienSource(i.file, i.id)
    : `<code>${escape(i.id)}</code>`).join(' ');
}

export function blocCouverturePrd(donnees) {
  const c = donnees?.prdCoverage;
  if (!c || (c.personas.length === 0 && c.userStories.length === 0 && (c.outcomes || []).length === 0)) return '';
  const pers = c.personas.map((p) => `<tr>
    <td><strong>${escape(p.nom)}</strong></td>
    <td class="muted">${escape(p.besoin || '—')}</td>
    <td>${badgeCouverture(p.count)}</td>
    <td>${listeIntents(p.intents)}</td>
  </tr>`).join('');
  const us = c.userStories.map((u) => `<tr>
    <td><code>${escape(u.id)}</code></td>
    <td><span class="badge ${u.priorite === 'MUST' ? 'badge-bad' : u.priorite === 'SHOULD' ? 'badge-warn' : 'badge-muted'}">${escape(u.priorite)}</span></td>
    <td class="muted">${escape(u.action || '—')}</td>
    <td>${badgeCouverture(u.count)}</td>
    <td>${listeIntents(u.intents)}</td>
  </tr>`).join('');
  // (#428) Section Outcomes → Intents
  const outcomes = (c.outcomes || []).map((o) => `<tr>
    <td><strong>${escape(o.critere || '')}</strong></td>
    <td class="muted">${escape(o.baseline || '—')} → <span class="badge badge-info" style="font-size:.7rem">${escape(o.cible || '—')}</span></td>
    <td>${badgeCouverture(o.count)}</td>
    <td>${listeIntents(o.intents)}</td>
  </tr>`).join('');
  const t = c.totaux;
  const outcomeCounter = (t.outcomes || 0) > 0
    ? ` · ${t.outcomesCouverts}/${t.outcomes} outcomes`
    : '';
  return `<section>
    <h2>Couverture PRD <span class="count">${t.personasCouvertes}/${t.personas} personas · ${t.userStoriesCouvertes}/${t.userStories} US${outcomeCounter}</span></h2>
    <p class="muted" style="font-size:.85rem">Pour chaque persona, user story et outcome déclaré dans ${c.fichier ? lienSource(c.fichier) : '<code>PRD.md</code>'}, nombre d'Intents qui le servent (matching frontmatter explicite + heuristique sur POURQUOI / POUR QUI / OBJECTIF + valeur cible).</p>
    ${pers ? `<h3>Personas</h3>
    <table>
      <thead><tr><th>Persona</th><th>Besoin</th><th>Couverture</th><th>Intents</th></tr></thead>
      <tbody>${pers}</tbody>
    </table>` : ''}
    ${us ? `<h3 style="margin-top:1rem">User Stories</h3>
    <table>
      <thead><tr><th>ID</th><th>Prio</th><th>Action</th><th>Couverture</th><th>Intents</th></tr></thead>
      <tbody>${us}</tbody>
    </table>` : ''}
    ${outcomes ? `<h3 style="margin-top:1rem">Outcomes → Intents</h3>
    <table>
      <thead><tr><th>Critère</th><th>Baseline → Cible</th><th>Couverture</th><th>Intents</th></tr></thead>
      <tbody>${outcomes}</tbody>
    </table>` : ''}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lirePersonasPrd as readPrdPersonas,
  lireUserStoriesPrd as readPrdUserStories,
  calculerCouverturePrd as computePrdCoverage,
  blocCouverturePrd as prdCoverageSection,
  intentSertPersona as intentServesPersona,
  intentSertUs as intentServesUserStory,
  intentSertOutcome as intentServesOutcome,
};
