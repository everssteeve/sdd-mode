// AIAD SDD Mode — Dashboard : page DPO / Data Protection Officer (#205).
//
// Audit DASHBOARD-AUDIT.md section 6a (DPO 🔴, "Manquant à 100 %"). Page
// dédiée qui réunit en un seul cockpit les artefacts RGPD du projet :
//   - DPIA générées (parse déjà fait par `lib/dashboard/collect-supplementary.js`)
//   - SPECs qui déclarent `governance: AIAD-RGPD` (frontmatter)
//   - Fichiers code annotés `@governance AIAD-RGPD` (re-scan ou matrice)
//   - Coverage RGPD : SPECs RGPD ayant ≥ 1 fichier code annoté
//   - SPECs RGPD non couvertes (Type B de #202 filtré sur AIAD-RGPD)
//
// Cible : DPO qui veut un seul écran "où en est la conformité RGPD du
// produit" sans naviguer entre 3 pages.

import { scanCode } from '../sdd-trace.js';

const TAG_RGPD = 'AIAD-RGPD';

function tagsFromSpec(spec) {
  const raw = spec?.governance;
  if (!raw) return new Set();
  return new Set(String(raw).split(/[,;]/).map((x) => x.trim()).filter(Boolean));
}

function shortSpec(id) {
  if (!id) return null;
  const m = String(id).match(/SPEC-(\d+(?:-\d+)?)/i);
  return m ? `SPEC-${m[1]}` : String(id).slice(0, 32);
}

export function calculerDpo(racineProjet, donnees, options = {}) {
  const dpia = donnees?.supplementaire?.dpia || { fichiers: [], total: 0, latest: null };
  const specs = donnees?.specs || [];

  // SPECs déclarant AIAD-RGPD dans leur frontmatter `governance:`.
  const specsRgpd = specs.filter((s) => tagsFromSpec(s).has(TAG_RGPD));

  // Scan du code pour les fichiers annotés `@governance AIAD-RGPD`.
  const codeScan = options.codeScan || scanCode(racineProjet, { useCache: true });
  const fichiersCode = (codeScan || []).filter((f) => !f.isTest && f.annotated);
  const fichiersRgpd = [];
  // Map SPEC → fichiers annotés RGPD (pour calculer la coverage)
  const couvertureParSpec = new Map();
  for (const f of fichiersCode) {
    const tags = new Set();
    for (const g of f.annotations?.governance || []) {
      for (const t of g.tags || []) tags.add(String(t).trim().toUpperCase());
    }
    if (!tags.has(TAG_RGPD)) continue;
    fichiersRgpd.push({ path: f.path });
    for (const s of f.annotations?.specs || []) {
      const key = shortSpec(s.id);
      if (!couvertureParSpec.has(key)) couvertureParSpec.set(key, []);
      couvertureParSpec.get(key).push(f.path);
    }
  }

  // SPECs RGPD couvertes ou non par au moins 1 fichier code annoté RGPD.
  const STATUTS_ACTIFS = new Set(['ready', 'in-progress', 'validation', 'review', 'done']);
  const couvertes = [];
  const nonCouvertes = [];
  for (const s of specsRgpd) {
    const key = shortSpec(s.id);
    const fichiers = couvertureParSpec.get(key) || [];
    const entry = { id: s.id, file: s.file, statut: s.statut, fichiersCount: fichiers.length };
    if (fichiers.length > 0) couvertes.push({ ...entry, fichiers });
    else if (STATUTS_ACTIFS.has(s.statut)) nonCouvertes.push(entry);
  }

  // Ratio coverage = couvertes / (couvertes + nonCouvertes actives)
  const totalActif = couvertes.length + nonCouvertes.length;
  const ratioCoverage = totalActif > 0 ? couvertes.length / totalActif : null;

  return {
    dpia: {
      total: dpia.total || 0,
      latest: dpia.latest || null,
      fichiers: (dpia.fichiers || []).slice(0, 10).map((d) => ({
        nom: d.nom, file: d.file, date: d.date, complete: d.complete, aCompleter: d.aCompleter,
      })),
    },
    specsRgpd: {
      total: specsRgpd.length,
      entrees: specsRgpd.slice(0, 50).map((s) => ({ id: s.id, file: s.file, statut: s.statut })),
    },
    fichiersRgpd: {
      total: fichiersRgpd.length,
      entrees: fichiersRgpd.slice(0, 50),
    },
    coverage: {
      ratio: ratioCoverage,
      couvertes: couvertes.length,
      nonCouvertes: nonCouvertes.length,
      entreesNonCouvertes: nonCouvertes.slice(0, 30),
    },
  };
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

export function pageDpo(donnees) {
  const dpo = donnees?.dpo;
  if (!dpo) return '<div class="empty"><strong>Données DPO non collectées.</strong></div>';

  const dpiaSection = dpo.dpia.total === 0
    ? `<section>
        <h2>DPIA (Data Protection Impact Assessment)</h2>
        <div class="empty">
          <strong>Aucune DPIA générée.</strong>
          Lance <code>aiad-sdd dpia</code> pour générer un squelette Article 35 RGPD (méthode CNIL, 9 sections).
        </div>
      </section>`
    : `<section>
        <h2>DPIA <span class="count">${dpo.dpia.total}</span></h2>
        <div class="kpis">
          <div class="kpi"><div class="label">DPIA générées</div><div class="value">${dpo.dpia.total}</div><div class="delta">total</div></div>
          <div class="kpi"><div class="label">Dernière</div><div class="value" style="font-size:1rem">${escape(dpo.dpia.latest?.date || '—')}</div><div class="delta">${dpo.dpia.latest?.complete ? '<span class="badge badge-ok">complète</span>' : `<span class="badge badge-warn">${dpo.dpia.latest?.aCompleter || 0} sections à compléter</span>`}</div></div>
        </div>
        <details ${dpo.dpia.total > 0 ? 'open' : ''}>
          <summary><strong>Liste des DPIA</strong></summary>
          <table>
            <thead><tr><th>Nom</th><th>Date</th><th>Sections à compléter</th><th>État</th></tr></thead>
            <tbody>${dpo.dpia.fichiers.map((d) => `<tr>
              <td>${lienSource(d.file, d.nom)}</td>
              <td class="muted">${escape(d.date || '—')}</td>
              <td class="muted">${d.aCompleter}</td>
              <td>${d.complete ? '<span class="badge badge-ok">complète</span>' : '<span class="badge badge-warn">en cours</span>'}</td>
            </tr>`).join('')}</tbody>
          </table>
        </details>
      </section>`;

  const ratioPct = dpo.coverage.ratio != null ? Math.round(dpo.coverage.ratio * 100) : null;
  const ratioBadge = ratioPct == null
    ? '<span class="badge">—</span>'
    : ratioPct === 100
    ? `<span class="badge badge-ok">${ratioPct}%</span>`
    : ratioPct >= 50
    ? `<span class="badge badge-warn">${ratioPct}%</span>`
    : `<span class="badge badge-bad">${ratioPct}%</span>`;

  const inventaireSection = `<section>
    <h2>Inventaire RGPD <span class="count">${dpo.specsRgpd.total} SPEC(s) · ${dpo.fichiersRgpd.total} fichier(s) code</span></h2>
    <div class="kpis">
      <div class="kpi"><div class="label">SPECs <code>AIAD-RGPD</code></div><div class="value">${dpo.specsRgpd.total}</div><div class="delta">déclarent gouvernance RGPD</div></div>
      <div class="kpi"><div class="label">Fichiers annotés</div><div class="value">${dpo.fichiersRgpd.total}</div><div class="delta"><code>@governance AIAD-RGPD</code></div></div>
      <div class="kpi"><div class="label">Coverage</div><div class="value" style="font-size:1.5rem">${ratioBadge}</div><div class="delta">SPECs couvertes / actives</div></div>
    </div>
    ${dpo.specsRgpd.total > 0 ? `
      <details>
        <summary><strong>SPECs déclarant <code>AIAD-RGPD</code></strong> (${dpo.specsRgpd.total})</summary>
        <table>
          <thead><tr><th>SPEC</th><th>Fichier</th><th>Statut</th></tr></thead>
          <tbody>${dpo.specsRgpd.entrees.map((s) => `<tr>
            <td>${s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`}</td>
            <td>${s.file ? lienSource(s.file) : '<span class="muted">—</span>'}</td>
            <td class="muted">${escape(s.statut || '—')}</td>
          </tr>`).join('')}</tbody>
        </table>
      </details>` : ''}
    ${dpo.fichiersRgpd.total > 0 ? `
      <details>
        <summary><strong>Fichiers code annotés <code>@governance AIAD-RGPD</code></strong> (${dpo.fichiersRgpd.total})</summary>
        <ul style="margin:.5rem 0;padding-left:1.2rem">${dpo.fichiersRgpd.entrees.map((f) => `<li>${lienSource(f.path)}</li>`).join('')}</ul>
      </details>` : ''}
  </section>`;

  const gapsSection = dpo.coverage.nonCouvertes === 0
    ? ''
    : `<section>
        <h2>Angles morts RGPD <span class="count">${dpo.coverage.nonCouvertes}</span></h2>
        <p class="muted">SPECs <strong>actives</strong> (ready/in-progress/review/validation/done) qui déclarent <code>governance: AIAD-RGPD</code> mais dont aucun fichier code lié n'est annoté <code>@governance AIAD-RGPD</code>. Signal : promesse de conformité sans matérialisation.</p>
        <div class="alerte alerte-warn" style="margin-bottom:.5rem">
          <div class="alerte-titre">${dpo.coverage.nonCouvertes} SPEC(s) RGPD non couverte(s) par du code annoté</div>
          <div class="alerte-action">→ Ajoute <code>@governance AIAD-RGPD</code> sur les fichiers code qui implémentent ces SPECs.</div>
        </div>
        <table>
          <thead><tr><th>SPEC</th><th>Fichier source</th><th>Statut</th></tr></thead>
          <tbody>${dpo.coverage.entreesNonCouvertes.map((s) => `<tr>
            <td>${s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`}</td>
            <td>${s.file ? lienSource(s.file) : '<span class="muted">—</span>'}</td>
            <td class="muted">${escape(s.statut || '—')}</td>
          </tr>`).join('')}</tbody>
        </table>
      </section>`;

  return `${dpiaSection}\n${inventaireSection}\n${gapsSection}`;
}

// Alias EN canoniques (#42)
export {
  calculerDpo as computeDpo,
  pageDpo as dpoPage,
};
