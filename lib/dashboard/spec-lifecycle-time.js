// AIAD SDD Mode — Dashboard : SPEC lifecycle median time per status (#559).
//
// Reconstitue depuis `.aiad/metrics/pm-snapshots/*.json` (#510) la
// durée passée par les SPECs dans chaque statut. Calcule la médiane
// par statut pour identifier où le pipeline ralentit.
//
// Pure lecture filesystem.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DAY = 24 * 3600 * 1000;

function lireRep(rep) {
  try { return readdirSync(rep); } catch { return []; }
}

function normaliser(s) {
  if (!s) return 'unknown';
  return String(s).toLowerCase().trim();
}

function readSnapshots(racineProjet) {
  const rep = join(racineProjet || '.', '.aiad', 'metrics', 'pm-snapshots');
  const out = [];
  for (const n of lireRep(rep)) {
    if (!n.endsWith('.json')) continue;
    try {
      const data = JSON.parse(readFileSync(join(rep, n), 'utf8'));
      const date = data.date || n.replace(/\.json$/, '');
      const ts = Date.parse(date);
      if (isNaN(ts)) continue;
      out.push({ ts, specs: data.specs || [] });
    } catch { /* ignore */ }
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

function median(arr) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function calculerSpecLifecycleTime(racineProjet) {
  const snapshots = readSnapshots(racineProjet);
  if (snapshots.length < 2) {
    return { items: [], message: snapshots.length === 0 ? 'aucun snapshot' : '1 seul snapshot' };
  }
  // Pour chaque SPEC, reconstitue durée par statut
  const parSpec = new Map();
  for (const snap of snapshots) {
    for (const s of snap.specs) {
      const id = s.id;
      const statut = normaliser(s.statut);
      if (!parSpec.has(id)) parSpec.set(id, { id, transitions: [] });
      const entry = parSpec.get(id);
      const dernier = entry.transitions[entry.transitions.length - 1];
      if (!dernier || dernier.statut !== statut) {
        entry.transitions.push({ statut, debut: snap.ts });
      }
    }
  }
  // Durées par statut
  const dureesParStatut = {};
  for (const entry of parSpec.values()) {
    for (let i = 0; i < entry.transitions.length; i++) {
      const cur = entry.transitions[i];
      const next = entry.transitions[i + 1];
      const fin = next ? next.debut : snapshots[snapshots.length - 1].ts;
      const dureeJours = Math.max(0, Math.floor((fin - cur.debut) / DAY));
      if (!dureesParStatut[cur.statut]) dureesParStatut[cur.statut] = [];
      dureesParStatut[cur.statut].push(dureeJours);
    }
  }
  const items = Object.entries(dureesParStatut).map(([statut, durees]) => ({
    statut,
    median: median(durees),
    nbObservations: durees.length,
    max: durees.length ? Math.max(...durees) : 0,
  }));
  // Tri : statuts non-terminaux médiane desc d'abord
  const PRIORITE = { draft: 0, ready: 1, 'in-progress': 2, review: 3, validation: 4, done: 5, archived: 6 };
  items.sort((a, b) => (PRIORITE[a.statut] ?? 99) - (PRIORITE[b.statut] ?? 99));
  return { items, snapshots: snapshots.length, message: null };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const SL_CSS = `<style>
.sl-table { width:100%; border-collapse:collapse; font-size:.85rem; margin:.4rem 0; }
.sl-table th, .sl-table td { padding:.35rem .5rem; border-bottom:1px solid var(--border, #eee); text-align:left; }
.sl-table th { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.sl-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.72rem; }
.sl-tag.s-review, .sl-tag.s-validation { background:rgba(201,42,42,.12); color:#7a1717; }
.sl-tag.s-in-progress { background:rgba(232,89,12,.12); color:#7a3a08; }
.sl-tag.s-done, .sl-tag.s-archived { background:rgba(43,138,62,.12); color:#1c5a2a; }
.sl-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

export function blocSpecLifecycleTime(donnees) {
  const l = donnees?.specLifecycleTime;
  if (!l) return '';
  if (l.message) {
    return `${SL_CSS}<section>
      <h2>Temps médian par statut SPEC <span class="count">${escape(l.message)}</span></h2>
      <div class="sl-empty">Reconstitue depuis <code>.aiad/metrics/pm-snapshots/*.json</code> la durée médiane que les SPECs passent dans chaque statut. Lance <code>aiad-sdd dashboard --persist</code> régulièrement pour alimenter.</div>
    </section>`;
  }
  if (l.items.length === 0) {
    return `${SL_CSS}<section>
      <h2>Temps médian par statut SPEC <span class="count">aucune transition</span></h2>
    </section>`;
  }
  const rows = l.items.map((it) => `<tr>
    <td><span class="sl-tag s-${escape(it.statut)}">${escape(it.statut)}</span></td>
    <td>${it.median != null ? it.median + 'j' : '—'}</td>
    <td>${it.max}j</td>
    <td class="muted">${it.nbObservations} observation(s)</td>
  </tr>`).join('');
  return `${SL_CSS}<section>
    <h2>Temps médian par statut SPEC <span class="count">${l.items.length} statut(s) · ${l.snapshots} snapshots</span></h2>
    <p class="muted" style="font-size:.85rem">Durée médiane que les SPECs passent dans chaque statut, reconstituée depuis les pm-snapshots. Identifie les goulots du pipeline (statut où la médiane est élevée).</p>
    <table class="sl-table">
      <thead><tr><th>Statut</th><th>Médiane</th><th>Max observé</th><th>Échantillons</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSpecLifecycleTime as computeSpecLifecycleTime,
  blocSpecLifecycleTime as specLifecycleTimeSection,
};
