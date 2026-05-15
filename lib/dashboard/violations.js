// AIAD SDD Mode — Dashboard : violations Gouvernance Tier 1 (#202, AE).
//
// Audit DASHBOARD-AUDIT.md ligne 94 : "Pas de violations actives — la page
// est purement documentaire. Aucune SPEC avec veto/warn n'est listée, aucun
// compteur 'X violations RGPD ouvertes'."
//
// Croisement automatique entre :
//   - Annotations `@governance AIAD-XXX,AIAD-YYY` dans le code (parsées par
//     `lib/sdd-trace.js#scanCode`)
//   - Champ `governance:` dans le frontmatter des SPECs (parsé par
//     `lib/dashboard/collect.js#lireSpecs`)
//
// Deux types de violations détectées :
//
//   Type A — `code-non-déclaré-dans-SPEC` : un fichier code annoté
//   `@governance AIAD-RGPD` cite une SPEC dont le frontmatter `governance:`
//   ne contient pas AIAD-RGPD. Signal : le code traite un domaine sensible
//   sans que la SPEC le déclare → audit Tier 1 incomplet.
//
//   Type B — `SPEC-non-implémentée` : une SPEC done/in-progress déclare
//   `governance: AIAD-RGPD` mais aucun code lié n'est annoté
//   `@governance AIAD-RGPD`. Signal : promesse de conformité sans matérialisation.
//
// Cible : équipe AE pour arbitrer ce qui doit être resyncé.

import { scanCode } from '../sdd-trace.js';

const TIER1_AGENTS = new Set([
  'AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN', 'AIAD-CRA',
]);

// Normalise un identifiant de SPEC pour comparaison robuste (accepte
// `SPEC-001-1` ↔ `SPEC-001-1-slug` ↔ `001-1`).
function shortSpec(id) {
  if (!id) return null;
  const m = String(id).match(/SPEC-(\d+(?:-\d+)?)/i);
  if (m) return `SPEC-${m[1]}`;
  return String(id).slice(0, 32);
}

function tagsFromSpec(spec) {
  const raw = spec?.governance;
  if (!raw) return new Set();
  return new Set(String(raw).split(/[,;]/).map((x) => x.trim()).filter(Boolean));
}

function tagsFromAnnotations(governance) {
  const out = new Set();
  for (const e of governance || []) {
    for (const t of e.tags || []) {
      const norm = String(t).trim().toUpperCase();
      if (norm) out.add(norm);
    }
  }
  return out;
}

export function calculerViolations(racineProjet, donnees, options = {}) {
  const codeScan = options.codeScan || scanCode(racineProjet, { useCache: true });
  const fichiersCode = (codeScan || []).filter((f) => !f.isTest && f.annotated);
  const specs = donnees?.specs || [];

  // Index SPEC → governance tags + statut
  const specIndex = new Map();
  for (const s of specs) {
    specIndex.set(shortSpec(s.id), {
      id: s.id, file: s.file, statut: s.statut || s.status,
      tags: tagsFromSpec(s),
    });
  }

  // Type A : code annoté @governance qui pointe une SPEC où ces tags ne
  // figurent pas dans le frontmatter.
  const typeA = [];
  // Pour Type B : on construit l'inverse — par SPEC, l'ensemble des tags
  // matérialisés par au moins un fichier code.
  const tagsCouvertsParSpec = new Map(); // SPEC → Set<tag>

  for (const f of fichiersCode) {
    const codeTags = tagsFromAnnotations(f.annotations?.governance);
    if (codeTags.size === 0) continue;
    // Le fichier doit aussi pointer une SPEC pour être attribuable.
    const specsCitees = (f.annotations?.specs || []).map((s) => shortSpec(s.id)).filter(Boolean);
    if (specsCitees.length === 0) continue;
    for (const specKey of specsCitees) {
      const spec = specIndex.get(specKey);
      // Accumule la couverture (Type B même si spec inconnue, on enregistre).
      if (!tagsCouvertsParSpec.has(specKey)) tagsCouvertsParSpec.set(specKey, new Set());
      for (const t of codeTags) tagsCouvertsParSpec.get(specKey).add(t);
      if (!spec) continue; // SPEC orpheline déjà signalée ailleurs (gaps)
      // Type A : chaque tag code absent du frontmatter SPEC.
      for (const tag of codeTags) {
        if (!TIER1_AGENTS.has(tag)) continue; // hors Tier 1 → pas une violation
        if (!spec.tags.has(tag)) {
          typeA.push({
            type: 'code-non-déclaré-dans-SPEC',
            tag,
            specId: spec.id,
            specFile: spec.file,
            codeFile: f.path,
            line: (f.annotations?.governance?.[0]?.line) || 0,
          });
        }
      }
    }
  }

  // Type B : SPECs done/in-progress qui déclarent un tag Tier 1 sans aucun
  // code matérialisant ce tag.
  const STATUTS_ACTIFS = new Set(['ready', 'in-progress', 'validation', 'review', 'done']);
  const typeB = [];
  for (const [, spec] of specIndex) {
    if (!STATUTS_ACTIFS.has(spec.statut)) continue;
    const couverts = tagsCouvertsParSpec.get(shortSpec(spec.id)) || new Set();
    for (const tag of spec.tags) {
      if (!TIER1_AGENTS.has(tag)) continue;
      if (!couverts.has(tag)) {
        typeB.push({
          type: 'SPEC-non-implémentée',
          tag,
          specId: spec.id,
          specFile: spec.file,
          statut: spec.statut,
        });
      }
    }
  }

  // Tri stable : typeA d'abord (priorité car code vivant), puis typeB.
  typeA.sort((a, b) => a.specId.localeCompare(b.specId) || a.tag.localeCompare(b.tag));
  typeB.sort((a, b) => a.specId.localeCompare(b.specId) || a.tag.localeCompare(b.tag));

  // Compte par tag Tier 1 pour les KPIs.
  const parTag = {};
  for (const v of [...typeA, ...typeB]) {
    parTag[v.tag] = (parTag[v.tag] || 0) + 1;
  }

  return {
    total: typeA.length + typeB.length,
    typeA: { total: typeA.length, entrees: typeA.slice(0, 50) },
    typeB: { total: typeB.length, entrees: typeB.slice(0, 50) },
    parTag,
  };
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape, lienSourceLigne } from './render.js';

function tagBadge(tag) {
  return `<span class="badge badge-info" style="font-size:.7rem">${escape(tag)}</span>`;
}

export function blocViolations(donnees) {
  const viol = donnees?.violations;
  if (!viol) return '';
  const total = viol.total || 0;
  if (total === 0) {
    return `<section>
      <h2>Violations Tier 1 <span class="count">0</span></h2>
      <div class="alertes ok"><span class="alertes-icon">✓</span><div><strong>Aucune violation gouvernance détectée.</strong><div class="muted">Annotations <code>@governance</code> du code et frontmatter <code>governance:</code> des SPECs sont cohérentes.</div></div></div>
    </section>`;
  }
  const totalA = viol.typeA?.total || 0;
  const totalB = viol.typeB?.total || 0;
  // (#311) Lien fichier+ligne unifié via lienSourceLigne (anchor `#LNN`).
  const rowsA = (viol.typeA?.entrees || []).slice(0, 30).map((v) => `
    <tr>
      <td>${tagBadge(v.tag)}</td>
      <td><code>${escape(v.specId)}</code></td>
      <td>${lienSourceLigne(v.codeFile, v.line, v.codeFile)}${v.line ? `<span class="muted" style="font-size:.75rem"> ${lienSourceLigne(v.codeFile, v.line)}</span>` : ''}</td>
    </tr>`).join('');
  const rowsB = (viol.typeB?.entrees || []).slice(0, 30).map((v) => `
    <tr>
      <td>${tagBadge(v.tag)}</td>
      <td><code>${escape(v.specId)}</code></td>
      <td class="muted">${escape(v.statut || '—')}</td>
    </tr>`).join('');
  const parTagRows = Object.entries(viol.parTag)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, n]) => `<li>${tagBadge(tag)} <strong>${n}</strong></li>`).join('');

  return `<section>
    <h2>Violations Tier 1 <span class="count">${total}</span></h2>
    <div class="kpis">
      <div class="kpi"><div class="label">Annotations orphelines</div><div class="value">${totalA}</div><div class="delta">code dit X · SPEC ne le déclare pas</div></div>
      <div class="kpi"><div class="label">SPECs non implémentées</div><div class="value">${totalB}</div><div class="delta">SPEC promet X · code ne le matérialise pas</div></div>
    </div>
    ${parTagRows ? `<p class="muted" style="font-size:.85rem">Par agent : <ul style="display:inline-flex;gap:.6rem;padding:0;margin:0;list-style:none">${parTagRows}</ul></p>` : ''}
    ${totalA > 0 ? `<details open>
      <summary><strong>Annotations orphelines (Type A)</strong> — ${totalA}</summary>
      <p class="muted" style="font-size:.85rem">Le code est annoté pour un agent Tier 1 mais la SPEC associée ne le déclare pas dans son frontmatter <code>governance:</code>. Ajoute le tag à la SPEC ou retire-le du code.</p>
      <table>
        <thead><tr><th>Agent</th><th>SPEC</th><th>Code</th></tr></thead>
        <tbody>${rowsA}</tbody>
      </table>
    </details>` : ''}
    ${totalB > 0 ? `<details open>
      <summary><strong>SPECs non implémentées (Type B)</strong> — ${totalB}</summary>
      <p class="muted" style="font-size:.85rem">La SPEC déclare une obligation Tier 1 mais aucun fichier code lié n'est annoté <code>@governance</code> pour cet agent. Ajoute <code>@governance AIAD-XXX</code> dans le code applicable.</p>
      <table>
        <thead><tr><th>Agent</th><th>SPEC</th><th>Statut</th></tr></thead>
        <tbody>${rowsB}</tbody>
      </table>
    </details>` : ''}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerViolations as computeViolations,
  blocViolations as violationsSection,
};
