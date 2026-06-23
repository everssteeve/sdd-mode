/**
 * @spec SPEC-017-3-digest-delta
 * @intent INTENT-017
 * @verified-by test/dashboard-digest.test.js
 * @governance AIAD-RGESN
 */

// AIAD SDD Mode — Dashboard : digest delta + snapshots persistants.
//
// Persiste un snapshot horodaté (YYYY-MM-DD-HHmm) dans
// `.aiad/metrics/digest/` à chaque génération. Compare avec le
// snapshot précédent pour afficher les déltas : SPECs livrées,
// Intents archivés, zombies, score santé.
//
// Pattern calqué sur pm-diff.js (lireSnapshots / ecrireSnapshot).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { escape } from './render.js';

const DIGEST_DIR = ['.aiad', 'metrics', 'digest'];

function cheminDigest(racine) {
  return join(racine || '.', ...DIGEST_DIR);
}

function horodatage(date) {
  const d = date instanceof Date ? date : new Date(date);
  const YYYY = d.getUTCFullYear();
  const MM = String(d.getUTCMonth() + 1).padStart(2, '0');
  const DD = String(d.getUTCDate()).padStart(2, '0');
  const HH = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD}-${HH}${mm}`;
}

function extraireComptes(donnees) {
  const specs = donnees?.specs || [];
  const intents = donnees?.intents || [];
  return {
    specsCount: {
      done: specs.filter((s) => s.statut === 'done').length,
      draft: specs.filter((s) => s.statut === 'draft').length,
      active: specs.filter((s) => s.statut === 'in-progress' || s.statut === 'ready').length,
    },
    intentsCount: {
      done: intents.filter((i) => i.statut === 'done').length,
      active: intents.filter((i) => i.statut === 'active').length,
      archived: intents.filter((i) => i.statut === 'archived').length,
    },
    zombiesCount: (donnees?.pm?.zombies || []).length,
    santeScore: donnees?.santeGlobale?.score ?? null,
  };
}

// Lit le fichier JSON le plus récent dans `.aiad/metrics/digest/` (tri chrono par nom).
// Retourne null si aucun fichier ou répertoire absent.
export function lireDernierSnapshotDigest(racineProjet) {
  const dir = cheminDigest(racineProjet);
  if (!existsSync(dir)) return null;
  const fichiers = readdirSync(dir)
    .filter((f) => f.match(/^\d{4}-\d{2}-\d{2}-\d{4}\.json$/))
    .sort();
  if (fichiers.length === 0) return null;
  const dernier = fichiers[fichiers.length - 1];
  try {
    return JSON.parse(readFileSync(join(dir, dernier), 'utf-8'));
  } catch (e) {
    console.warn(`[digest-delta] Snapshot illisible : ${join(dir, dernier)}`);
    return null;
  }
}

// Compare l'état courant avec le snapshot précédent.
// Retourne { delta, depuis, message }.
// delta contient les 4 valeurs numériques (null si première génération).
export function calculerDigestDelta(donnees, snapshotPrecedent) {
  const courant = extraireComptes(donnees);
  if (snapshotPrecedent === null) {
    return { delta: null, depuis: null, message: 'Première génération — aucun delta disponible.' };
  }
  let snapshotValide = snapshotPrecedent;
  if (!snapshotPrecedent?.specsCount || !snapshotPrecedent?.intentsCount) {
    return { delta: null, depuis: null, message: 'Première génération — aucun delta disponible.' };
  }
  const delta = {
    specsDone: courant.specsCount.done - (snapshotValide.specsCount?.done ?? 0),
    intentsArchived: courant.intentsCount.archived - (snapshotValide.intentsCount?.archived ?? 0),
    zombies: courant.zombiesCount - (snapshotValide.zombiesCount ?? 0),
    santeScore: courant.santeScore !== null && snapshotValide.santeScore !== null
      ? courant.santeScore - snapshotValide.santeScore
      : null,
  };
  const estNul = delta.specsDone === 0 && delta.intentsArchived === 0 && delta.zombies === 0
    && (delta.santeScore === null || delta.santeScore === 0);
  return {
    delta,
    depuis: snapshotValide.generatedAt || null,
    message: estNul ? 'Aucun changement depuis la dernière génération.' : null,
  };
}

// Écrit un snapshot horodaté avec l'état courant.
export function ecrireSnapshotDigest(racineProjet, donnees, options = {}) {
  const dir = cheminDigest(racineProjet);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const now = options.now ? new Date(options.now) : new Date();
  const comptes = extraireComptes(donnees);
  const snapshot = {
    generatedAt: now.toISOString(),
    ...comptes,
  };
  const nom = `${horodatage(now)}.json`;
  const chemin = join(dir, nom);
  if (options.dryRun) return { fichier: chemin, ecrit: false, snapshot };
  writeFileSync(chemin, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
  return { fichier: chemin, ecrit: true, snapshot };
}

// Rendu HTML de la section digest (intégrable dans today.html / overview.html).
export function blocDigestDelta(donnees) {
  const r = donnees?.digestDelta;
  if (!r) return '';

  if (r.delta === null) {
    return `<section aria-label="Digest delta">
  <h2>Digest delta</h2>
  <p class="muted">${escape(r.message)}</p>
</section>`;
  }

  if (r.message === 'Aucun changement depuis la dernière génération.') {
    return `<section aria-label="Digest delta">
  <h2>Digest delta</h2>
  <p class="muted">${escape(r.message)}</p>
</section>`;
  }

  const { delta } = r;
  const lignes = [];
  if (delta.specsDone !== 0) {
    const signe = delta.specsDone > 0 ? '+' : '';
    lignes.push(`<li>SPECs livrées : <strong>${signe}${delta.specsDone}</strong></li>`);
  }
  if (delta.intentsArchived !== 0) {
    const signe = delta.intentsArchived > 0 ? '+' : '';
    lignes.push(`<li>Intents archivés : <strong>${signe}${delta.intentsArchived}</strong></li>`);
  }
  if (delta.zombies !== 0) {
    const signe = delta.zombies > 0 ? '+' : '';
    lignes.push(`<li>Zombies : <strong>${signe}${delta.zombies}</strong></li>`);
  }
  if (delta.santeScore !== null && delta.santeScore !== 0) {
    const signe = delta.santeScore > 0 ? '+' : '';
    lignes.push(`<li>Score santé : <strong>${signe}${delta.santeScore}</strong></li>`);
  }

  const depuis = r.depuis ? ` <span class="muted" style="font-size:.85rem">depuis ${escape(r.depuis.slice(0, 10))}</span>` : '';
  return `<section aria-label="Digest delta">
  <h2>Digest delta${depuis}</h2>
  <ul>${lignes.join('')}</ul>
</section>`;
}

export {
  lireDernierSnapshotDigest as readLastDigestSnapshot,
  calculerDigestDelta as computeDigestDelta,
  ecrireSnapshotDigest as writeDigestSnapshot,
  blocDigestDelta as digestDeltaSection,
};
