// AIAD SDD Mode — Raccourci CLI standup (#191).
//
// Produit l'URL pré-filtrée vers `dashboard/kanban.html?lens=<role>&focus=today`
// pour le rituel quotidien `/aiad standup`. Évite le copier-coller des 5 URLs
// par rôle documentées dans `templates/.claude/aiad/standup.md`.
//
// Trois sorties stables :
//   - relative : `dashboard/kanban.html?...`  (à coller dans Slack/Teams)
//   - absolue  : `file:///<root>/dashboard/kanban.html?...`  (à ouvrir local)
//   - servable : (optionnel) `http://host:port/kanban.html?...` quand un serveur
//                statique sert déjà le dossier `dashboard/`

import { resolve as resolvePath, join as joinPath } from 'node:path';
import { existsSync, statSync, readdirSync } from 'node:fs';

const ROLES_VALIDES = ['all', 'pm', 'pe', 'ae', 'qa', 'tl'];

export function normaliserLens(lens) {
  if (lens == null || lens === '') return 'all';
  const v = String(lens).trim().toLowerCase();
  if (!ROLES_VALIDES.includes(v)) {
    const err = new Error(`Lens invalide : "${lens}". Valeurs autorisées : ${ROLES_VALIDES.join(', ')}.`);
    err.code = 'INVALID_LENS';
    throw err;
  }
  return v;
}

// Construit l'URL focus-mode du Kanban.
//   opts.lens      : pm|pe|ae|qa|tl|all (défaut all)
//   opts.focus     : true (défaut) → ajoute `?focus=today` ; false → URL nue
//   opts.outDir    : chemin du dashboard (défaut `dashboard`)
//   opts.cwd       : racine pour résoudre l'URL absolue (défaut process.cwd())
//   opts.serverUrl : si fourni, produit aussi `http(s)://...` (sans le préfixe outDir)
//   opts.publicUrl : URL publique permanente (GitHub Pages, etc.) — produit `publicUrl`
//                    shareable Slack/Teams. (#256)
//
// Retour : { lens, relative, absolute, serverUrl?, publicUrl?, exists }
export function buildStandupUrl(opts = {}) {
  const lens = normaliserLens(opts.lens);
  const focus = opts.focus !== false; // défaut true
  const outDir = opts.outDir || 'dashboard';
  const racine = opts.cwd || process.cwd();
  const params = [];
  if (lens && lens !== 'all') params.push(`lens=${encodeURIComponent(lens)}`);
  if (focus) params.push('focus=today');
  const query = params.length ? `?${params.join('&')}` : '';
  const relative = `${outDir}/kanban.html${query}`;
  const absoluteFs = resolvePath(racine, outDir, 'kanban.html');
  const absolute = `file://${absoluteFs}${query}`;
  const exists = existsSync(joinPath(racine, outDir, 'kanban.html'));
  const out = { lens, focus, relative, absolute, exists };
  if (opts.serverUrl) {
    const base = String(opts.serverUrl).replace(/\/$/, '');
    out.serverUrl = `${base}/kanban.html${query}`;
  }
  // (#256) URL publique permanente — cohérent avec #240 (dashboard --public-url).
  if (opts.publicUrl) {
    const base = String(opts.publicUrl).replace(/\/+$/, '');
    out.publicUrl = `${base}/kanban.html${query}`;
  }
  return out;
}

// Liste explicite des URLs par rôle — utile pour `aiad-sdd standup --all`
// (à coller en bloc dans le canal standup async).
export function tousLesLiens(opts = {}) {
  return ['pm', 'pe', 'ae', 'qa', 'tl'].map((r) => buildStandupUrl({ ...opts, lens: r }));
}

// ─── Détection "dashboard stale" (#193) ─────────────────────────────────────
//
// Compare le mtime de `dashboard/kanban.html` à celui des artefacts AIAD
// (.aiad/intents/, .aiad/specs/, .aiad/metrics/). Si au moins un fichier
// AIAD est plus récent que kanban.html, le dashboard est "stale" — la vue
// imprimée par `aiad-sdd standup` reflète un état périmé.
//
// Stratégie : scan top-level récursif (1 niveau seulement, suffisant pour
// .aiad/ qui a une profondeur faible). Zero-dep, sync (pas de I/O massif).

const SOURCES_AIAD = ['intents', 'specs', 'metrics', 'gouvernance', 'facts'];

function mtimeMax(racine) {
  let max = 0;
  const aiad = joinPath(racine, '.aiad');
  if (!existsSync(aiad)) return null;
  for (const sub of SOURCES_AIAD) {
    const dir = joinPath(aiad, sub);
    if (!existsSync(dir)) continue;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      const p = joinPath(dir, e.name);
      try {
        const st = statSync(p);
        if (st.mtimeMs > max) max = st.mtimeMs;
        if (st.isDirectory()) {
          let sub2;
          try { sub2 = readdirSync(p, { withFileTypes: true }); }
          catch { continue; }
          for (const f of sub2) {
            try {
              const st2 = statSync(joinPath(p, f.name));
              if (st2.mtimeMs > max) max = st2.mtimeMs;
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
    }
  }
  return max || null;
}

export function dashboardEstStale(opts = {}) {
  const racine = opts.cwd || process.cwd();
  const outDir = opts.outDir || 'dashboard';
  const kanban = joinPath(racine, outDir, 'kanban.html');
  if (!existsSync(kanban)) {
    return { stale: false, raison: 'kanban-absent', kanbanMtime: null, aiadMtime: null };
  }
  const kStat = statSync(kanban);
  const aiadMtime = mtimeMax(racine);
  if (aiadMtime == null) {
    return { stale: false, raison: 'aiad-absent', kanbanMtime: kStat.mtimeMs, aiadMtime: null };
  }
  if (aiadMtime > kStat.mtimeMs) {
    const ageS = Math.round((aiadMtime - kStat.mtimeMs) / 1000);
    return { stale: true, raison: 'aiad-plus-recent', kanbanMtime: kStat.mtimeMs, aiadMtime, ecartSecondes: ageS };
  }
  return { stale: false, raison: 'a-jour', kanbanMtime: kStat.mtimeMs, aiadMtime };
}

export { ROLES_VALIDES as STANDUP_ROLES };
export { buildStandupUrl as buildStandupURL };
export { dashboardEstStale as dashboardIsStale };
