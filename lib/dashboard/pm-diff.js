// AIAD SDD Mode — Dashboard : diff "what changed this week" (#433).
//
// Au moment de la génération du dashboard, on persiste un snapshot
// minimal `{id, statut}` pour Intents et SPECs dans
// `.aiad/metrics/pm-snapshots/YYYY-MM-DD.json`. Le rendu compare le
// snapshot le plus récent avec celui d'il y a ~7 jours pour répondre :
// « Qu'est-ce qui a bougé cette semaine ? ».
//
// Persistance idempotente sur la journée (`writeFileSync` écrase
// l'éventuel snapshot du même jour — pas de duplication).
//
// Documentation : https://aiad.ovh

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DOSSIER = ['metrics', 'pm-snapshots'];
const JOUR_MS = 24 * 3600 * 1000;

function cheminDossier(racine) {
  return join(racine, '.aiad', ...DOSSIER);
}

// Écrit le snapshot du jour. Idempotent : même jour → écrase.
export function ecrireSnapshot(racineProjet, donnees, options = {}) {
  const dir = cheminDossier(racineProjet);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const date = options.date || new Date().toISOString().slice(0, 10);
  const snapshot = {
    date,
    intents: (donnees?.intents || []).map((i) => ({ id: i.id, statut: i.statut })),
    specs: (donnees?.specs || []).map((s) => ({ id: s.id, statut: s.statut, parentIntent: s.parentIntent || null })),
  };
  const chemin = join(dir, `${date}.json`);
  if (options.dryRun) return { fichier: chemin, ecrit: false, snapshot };
  writeFileSync(chemin, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
  return { fichier: chemin, ecrit: true, snapshot };
}

// Liste les snapshots persistés, tri chrono asc.
export function lireSnapshots(racineProjet) {
  const dir = cheminDossier(racineProjet);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m) continue;
    try {
      const data = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
      out.push({ date: m[1], fichier: join(dir, f), data, mtime: statSync(join(dir, f)).mtimeMs });
    } catch { /* JSON cassé → ignoré */ }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Trouve le snapshot le plus proche d'il y a N jours (par défaut 7) sans
// jamais retourner le snapshot d'aujourd'hui. Tolère ±2 jours autour de
// la cible. Renvoie `null` si aucun candidat.
export function snapshotReference(snapshots, options = {}) {
  if (!snapshots || snapshots.length < 2) return null;
  const now = options.now != null ? options.now : Date.now();
  const cibleJours = options.cibleJours || 7;
  const tolerance = options.tolerance || 2;
  const dateNow = new Date(now).toISOString().slice(0, 10);
  const candidats = snapshots
    .filter((s) => s.date !== dateNow)
    .map((s) => ({
      ...s,
      delta: Math.abs(Math.round((now - new Date(s.date).getTime()) / JOUR_MS) - cibleJours),
    }))
    .filter((s) => s.delta <= cibleJours + tolerance)
    .sort((a, b) => a.delta - b.delta);
  return candidats[0] || null;
}

// Compare 2 snapshots → renvoie listes de transitions par catégorie.
export function diffSnapshots(snapAvant, snapApres) {
  const result = {
    intents: { nouveaux: [], passesActifs: [], passesDone: [], passesArchive: [], transitions: [] },
    specs: { nouvelles: [], passesDone: [], transitions: [] },
  };
  if (!snapAvant || !snapApres) return result;
  const mapAvantI = new Map((snapAvant.data?.intents || []).map((x) => [x.id, x.statut]));
  for (const i of snapApres.data?.intents || []) {
    const ancien = mapAvantI.get(i.id);
    if (!ancien) {
      result.intents.nouveaux.push({ id: i.id, statut: i.statut });
      continue;
    }
    if (ancien !== i.statut) {
      result.intents.transitions.push({ id: i.id, de: ancien, vers: i.statut });
      if (i.statut === 'active') result.intents.passesActifs.push({ id: i.id, de: ancien });
      else if (i.statut === 'done') result.intents.passesDone.push({ id: i.id, de: ancien });
      else if (i.statut === 'archived') result.intents.passesArchive.push({ id: i.id, de: ancien });
    }
  }
  const mapAvantS = new Map((snapAvant.data?.specs || []).map((x) => [x.id, x.statut]));
  for (const s of snapApres.data?.specs || []) {
    const ancien = mapAvantS.get(s.id);
    if (!ancien) {
      result.specs.nouvelles.push({ id: s.id, statut: s.statut, parentIntent: s.parentIntent });
      continue;
    }
    if (ancien !== s.statut) {
      result.specs.transitions.push({ id: s.id, de: ancien, vers: s.statut, parentIntent: s.parentIntent });
      if (s.statut === 'done') result.specs.passesDone.push({ id: s.id, de: ancien, parentIntent: s.parentIntent });
    }
  }
  return result;
}

export function calculerPmDiff(racineProjet, donnees, options = {}) {
  ecrireSnapshot(racineProjet, donnees, options);
  const snapshots = lireSnapshots(racineProjet);
  if (snapshots.length === 0) return { diff: null, reference: null, courant: null, totalChangements: 0 };
  const courant = snapshots[snapshots.length - 1];
  const reference = snapshotReference(snapshots, options);
  const diff = diffSnapshots(reference, courant);
  const totalChangements = diff.intents.nouveaux.length + diff.intents.transitions.length
    + diff.specs.nouvelles.length + diff.specs.transitions.length;
  return { diff, reference, courant, totalChangements };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

function badgeTransition(de, vers) {
  return `<span class="badge badge-info" style="font-size:.7rem">${escape(de)} → ${escape(vers)}</span>`;
}

export function blocPmDiff(donnees) {
  const r = donnees?.pmDiff;
  if (!r) return '';
  if (!r.reference) {
    return `<section>
      <h2>Ce qui a changé cette semaine <span class="count">snapshot initial posé</span></h2>
      <p class="muted">Aucun snapshot antérieur d'au moins ~7 jours n'a été trouvé. Le dashboard a écrit son premier snapshot dans <code>.aiad/metrics/pm-snapshots/</code> — relance <code>aiad-sdd dashboard</code> dans une semaine pour voir le diff.</p>
    </section>`;
  }
  const di = r.diff.intents, ds = r.diff.specs;
  if (r.totalChangements === 0) {
    return `<section>
      <h2>Ce qui a changé cette semaine <span class="count">depuis ${escape(r.reference.date)} : aucun changement</span></h2>
      <p class="muted">Pas de transition Intent/SPEC ni nouvel élément capturé depuis le snapshot de référence.</p>
    </section>`;
  }
  const lignes = [];
  if (di.nouveaux.length > 0) {
    lignes.push(`<h3>Intents capturés <span class="count">${di.nouveaux.length}</span></h3><ul>`);
    for (const i of di.nouveaux.slice(0, 8)) lignes.push(`<li><code>${escape(i.id)}</code> — créé en <span class="badge badge-info" style="font-size:.7rem">${escape(i.statut)}</span></li>`);
    lignes.push('</ul>');
  }
  if (di.transitions.length > 0) {
    lignes.push(`<h3>Transitions Intent <span class="count">${di.transitions.length}</span></h3><ul>`);
    for (const t of di.transitions.slice(0, 8)) lignes.push(`<li><code>${escape(t.id)}</code> ${badgeTransition(t.de, t.vers)}</li>`);
    lignes.push('</ul>');
  }
  if (ds.nouvelles.length > 0) {
    lignes.push(`<h3>SPECs créées <span class="count">${ds.nouvelles.length}</span></h3><ul>`);
    for (const s of ds.nouvelles.slice(0, 8)) lignes.push(`<li><code>${escape(s.id)}</code> en <span class="badge badge-info" style="font-size:.7rem">${escape(s.statut)}</span>${s.parentIntent ? ` ← ${escape(s.parentIntent)}` : ''}</li>`);
    lignes.push('</ul>');
  }
  if (ds.transitions.length > 0) {
    lignes.push(`<h3>Transitions SPEC <span class="count">${ds.transitions.length}</span></h3><ul>`);
    for (const t of ds.transitions.slice(0, 8)) lignes.push(`<li><code>${escape(t.id)}</code> ${badgeTransition(t.de, t.vers)}${t.parentIntent ? ` ← ${escape(t.parentIntent)}` : ''}</li>`);
    lignes.push('</ul>');
  }
  return `<section>
    <h2>Ce qui a changé cette semaine <span class="count">${r.totalChangements} changement(s) depuis ${escape(r.reference.date)}</span></h2>
    <p class="muted" style="font-size:.85rem">Comparaison du snapshot courant (${escape(r.courant.date)}) avec celui d'il y a ~7 jours (${escape(r.reference.date)}). Snapshots persistés dans <code>.aiad/metrics/pm-snapshots/</code>.</p>
    ${lignes.join('\n')}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  ecrireSnapshot as writeSnapshot,
  lireSnapshots as readSnapshots,
  snapshotReference as referenceSnapshot,
  diffSnapshots as diffSnaps,
  calculerPmDiff as computePmDiff,
  blocPmDiff as pmDiffSection,
};
