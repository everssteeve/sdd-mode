// AIAD SDD Mode — Dashboard : page SRE / Ops (#203).
//
// Audit DASHBOARD-AUDIT.md section 6c (SRE/Ops 🔴, "Manquant à 100 %").
// Page dédiée qui agrège 3 sources opérationnelles déjà collectées :
//   - hookStats (`.aiad/metrics/hook-runs.jsonl`) : latence p50/p95, fails,
//     timeouts, fuites de scope du pre-commit hook
//   - deploys (`.aiad/metrics/deployments/*.md`) : déjà parsés dans
//     `donnees.metrics` (DORA)
//   - rapports security/audit par sévérité (`.aiad/metrics/security/*.md`,
//     `.aiad/metrics/audit/*.md`)
//
// Cible : équipe SRE/Ops qui pilote le hook pre-commit, la fréquence de
// déploiement et la posture sécurité opérationnelle.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Sévérités attendues dans les rapports `/sdd security` (extraites du texte).
// On parse de manière tolérante — les rapports sont en Markdown libre.
// Conventions supportées (au moins une doit matcher) :
//   - Section H2 dédiée : `## Risques critiques`, `## Critique`, `## Risques moyens`
//   - Badge dans le texte : `**Critique**`, `[critique]`
//   - Frontmatter (rapports SPEC-spécifiques) : `severity: critique`
const SEVERITES = ['critique', 'élevé', 'moyen', 'mineur', 'bonne pratique'];

// Aliases de section H2/H3 par sévérité. Le 1er mot peut être "Risques",
// "Vulnérabilités", "Findings" ou absent ; le mot-clé sévérité doit suivre.
const ALIASES_SECTION = {
  critique: ['critique', 'critiques', 'critical', 'high', 'élevé', 'élevés', 'eleve', 'eleves', 'severe', 'graves'],
  'élevé': ['élevé', 'élevés', 'eleve', 'eleves'],
  moyen: ['moyen', 'moyens', 'medium', 'modéré', 'modérés', 'modere'],
  mineur: ['mineur', 'mineurs', 'minor', 'low', 'faible', 'faibles', 'nit', 'nits'],
  'bonne pratique': ['bonne pratique', 'bonnes pratiques', 'best practices', 'good practices'],
};

function lireRepertoireMarkdown(racine, sousDossier) {
  const dir = join(racine, '.aiad', 'metrics', sousDossier);
  if (!existsSync(dir)) return [];
  let entries;
  try { entries = readdirSync(dir); } catch { return []; }
  const out = [];
  for (const nom of entries) {
    if (!nom.endsWith('.md')) continue;
    const p = join(dir, nom);
    let st;
    try { st = statSync(p); } catch { continue; }
    let contenu;
    try { contenu = readFileSync(p, 'utf-8'); } catch { continue; }
    out.push({ file: relative(racine, p), name: nom, mtime: st.mtimeMs, contenu });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

// Extrait le frontmatter YAML simpliste d'un rapport (clé: valeur).
function parserFrontmatter(contenu) {
  const m = contenu.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return {};
  const out = {};
  for (const ligne of m[1].split('\n')) {
    const kv = ligne.match(/^([a-zA-Z_-]+):\s*(.+?)\s*$/);
    if (kv) out[kv[1].toLowerCase()] = kv[2].trim();
  }
  return out;
}

// Section H2/H3 → sévérité reconnue, ou null si non-pertinent.
function severitePourTitre(titre) {
  const t = String(titre).toLowerCase().trim()
    .replace(/^[#*\s]+/, '')
    .replace(/[*:]+$/, '')
    .trim();
  for (const [sev, aliases] of Object.entries(ALIASES_SECTION)) {
    for (const a of aliases) {
      // Match "critique", "risques critiques", "vulnérabilités critiques", "findings critique"
      const re = new RegExp(`(^|\\s)${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
      if (re.test(t)) return sev;
    }
  }
  return null;
}

// Compte les items (lignes `- ...`) dans la section comprise entre `debut`
// (exclu) et le prochain `## ` (exclu) ou fin du document. Une section
// "Aucun." compte 0. Le titre de la section lui-même n'est pas compté.
function compterItemsSection(lignes, debutIdx) {
  let total = 0;
  for (let i = debutIdx + 1; i < lignes.length; i++) {
    const l = lignes[i];
    if (/^##+\s/.test(l)) break;
    // Items en liste : `- **X-001**`, `* **R-001**`, `- texte`.
    if (/^\s*[-*]\s+/.test(l) && !/^\s*[-*]\s*$/.test(l)) total += 1;
  }
  return total;
}

export function compterSeverites(rapports) {
  const compte = {};
  for (const s of SEVERITES) compte[s] = 0;
  for (const r of rapports) {
    const lignes = (r.contenu || '').split('\n');
    // (1) Frontmatter `severity: critique` → +1 sur la sévérité déclarée.
    const fm = parserFrontmatter(r.contenu || '');
    if (fm.severity) {
      const sev = severitePourTitre(fm.severity);
      if (sev) compte[sev] += 1;
    }
    // (2) Sections H2/H3 nommées : compte les items de chaque section.
    // En parallèle on note pour chaque ligne dans quelle section sévérité
    // elle se trouve (ou null), pour éviter de double-compter les badges.
    const sectionParLigne = new Array(lignes.length).fill(null);
    let sectionCourante = null;
    for (let i = 0; i < lignes.length; i++) {
      const m = lignes[i].match(/^(##+)\s+(.+?)\s*$/);
      if (m) {
        const sev = severitePourTitre(m[2]);
        sectionCourante = sev;
        if (sev) {
          compte[sev] += compterItemsSection(lignes, i);
        }
      }
      sectionParLigne[i] = sectionCourante;
    }
    // (3) Badges standalone (`**Critique** — ...`, `[critique]`). On les
    // compte SAUF s'ils sont dans la section de la MÊME sévérité (sinon
    // double-compte : un item `- **R-001**` dans `## Critique` ne doit pas
    // ajouter 1 au critique pour le badge `**R-001**`).
    // Skip aussi les badges qui sont des items en liste `- **...` ou `* **...`.
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (/^\s*[-*]\s+\*\*/.test(l)) continue; // item de liste — pas un badge sevérité
      const lower = l.toLowerCase();
      for (const s of SEVERITES) {
        if (sectionParLigne[i] === s) continue; // déjà compté comme item
        const re = new RegExp(`(^|\\s)(\\*\\*|\\[)\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
        if (re.test(lower)) compte[s] += 1;
      }
    }
  }
  return compte;
}

export function calculerSre(racineProjet, donnees) {
  const supplementaire = donnees?.supplementaire || {};
  const hookStats = supplementaire.hookStats || { available: false, count: 0 };

  // Deploys déjà parsés dans donnees.metrics.deployments. On les surface
  // tels quels.
  const deployments = donnees?.metrics?.deployments || null;

  // Rapports security et audit pour le rollup sévérité.
  const security = lireRepertoireMarkdown(racineProjet, 'security');
  const audit = lireRepertoireMarkdown(racineProjet, 'audit');
  const severitesSecurity = compterSeverites(security);
  const severitesAudit = compterSeverites(audit);

  return {
    hookStats,
    deployments,
    security: { total: security.length, derniers: security.slice(0, 10).map((r) => ({ file: r.file, name: r.name, mtime: r.mtime })) },
    audit: { total: audit.length, derniers: audit.slice(0, 10).map((r) => ({ file: r.file, name: r.name, mtime: r.mtime })) },
    severites: {
      security: severitesSecurity,
      audit: severitesAudit,
    },
  };
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape } from './render.js';

function badgeSante(sante) {
  if (sante === 'sain') return '<span class="badge badge-ok">sain</span>';
  if (sante === 'dégradé' || sante === 'degradé') return '<span class="badge badge-warn">dégradé</span>';
  if (sante === 'critique') return '<span class="badge badge-bad">critique</span>';
  return '<span class="badge">' + escape(sante || 'inconnue') + '</span>';
}

function lignesSeverites(compte) {
  const out = [];
  const couleurs = { critique: 'badge-bad', 'élevé': 'badge-bad', moyen: 'badge-warn', mineur: 'badge-info', 'bonne pratique': 'badge-ok' };
  for (const s of SEVERITES) {
    if (!compte[s]) continue;
    const c = couleurs[s] || '';
    out.push(`<li><span class="badge ${c}" style="font-size:.7rem">${escape(s)}</span> <strong>${compte[s]}</strong></li>`);
  }
  return out.join('');
}

function blocHookStats(hookStats) {
  if (!hookStats || !hookStats.available) {
    return `<section>
      <h2>Hook pre-commit</h2>
      <div class="empty">
        <strong>Aucune métrique hook capturée.</strong>
        Active le hook via <code>aiad-sdd hooks-init</code> puis fais un commit pour générer <code>.aiad/metrics/hook-runs.jsonl</code>.
      </div>
    </section>`;
  }
  const p95Warning = hookStats.p95 > 1500 ? ` <span class="muted" style="font-size:.75rem">(&gt; 1500ms recommandé)</span>` : '';
  return `<section>
    <h2>Hook pre-commit <span class="count">${hookStats.count} run(s)</span></h2>
    <div class="kpis">
      <div class="kpi"><div class="label">Santé</div><div class="value" style="font-size:1.5rem">${badgeSante(hookStats.sante)}</div><div class="delta">${hookStats.count} run(s)</div></div>
      <div class="kpi"><div class="label">Latence p50</div><div class="value">${hookStats.p50 || 0}ms</div><div class="delta">médian</div></div>
      <div class="kpi"><div class="label">Latence p95</div><div class="value">${hookStats.p95 || 0}ms</div><div class="delta">95ᵉ percentile${p95Warning}</div></div>
      <div class="kpi"><div class="label">Échecs</div><div class="value">${hookStats.timeouts || 0}</div><div class="delta">timeouts cumulés</div></div>
    </div>
    ${hookStats.scopeLeaks > 0 ? `<div class="alerte alerte-warn"><div class="alerte-titre">${hookStats.scopeLeaks} fuite(s) de scope détectée(s)</div><div class="alerte-detail">Le hook a modifié des fichiers en dehors du scope <code>staged</code>. Vérifie la config.</div></div>` : ''}
    <p class="muted" style="font-size:.85rem">Diagnostic complet : <code>aiad-sdd hook-stats</code>.</p>
  </section>`;
}

function blocDeploys(deployments) {
  if (!deployments || !deployments.total) {
    return `<section>
      <h2>Déploiements (DORA)</h2>
      <div class="empty">
        <strong>Aucun déploiement enregistré.</strong>
        Lance <code>aiad-sdd dora --record</code> manuellement ou <code>aiad-sdd dora --import-git</code> pour importer depuis les tags Git.
      </div>
    </section>`;
  }
  return `<section>
    <h2>Déploiements <span class="count">${deployments.total}</span></h2>
    <div class="kpis">
      <div class="kpi"><div class="label">Total</div><div class="value">${deployments.total}</div><div class="delta">${deployments.deployFrequency || '—'}</div></div>
      <div class="kpi"><div class="label">Cycle Time moyen</div><div class="value">${deployments.cycleTimeMoyen != null ? deployments.cycleTimeMoyen.toFixed(1) + 'j' : '—'}</div><div class="delta">commit → prod</div></div>
      <div class="kpi"><div class="label">Lead Time moyen</div><div class="value">${deployments.leadTimeMoyen != null ? deployments.leadTimeMoyen.toFixed(1) + 'j' : '—'}</div><div class="delta">idée → prod</div></div>
      <div class="kpi"><div class="label">Change Failure Rate</div><div class="value">${deployments.cfr != null ? (deployments.cfr * 100).toFixed(0) + '%' : '—'}</div><div class="delta">hotfixes / total</div></div>
    </div>
    <p class="muted" style="font-size:.85rem">Détail dans <a href="metrics.html">métriques</a> · source <code>.aiad/metrics/deployments/</code>.</p>
  </section>`;
}

function blocSecurite(sre) {
  const totalSec = sre.security.total;
  const totalAudit = sre.audit.total;
  if (totalSec === 0 && totalAudit === 0) {
    return `<section>
      <h2>Sécurité & Audit</h2>
      <div class="empty">
        <strong>Aucun rapport sécurité/audit.</strong>
        Lance <code>/sdd security</code> et <code>/sdd audit</code> pour générer les premiers rapports.
      </div>
    </section>`;
  }
  const ligneSec = lignesSeverites(sre.severites.security);
  const ligneAudit = lignesSeverites(sre.severites.audit);
  return `<section>
    <h2>Sécurité & Audit <span class="count">${totalSec + totalAudit} rapport(s)</span></h2>
    <div class="kpis">
      <div class="kpi"><div class="label">Rapports <code>/sdd security</code></div><div class="value">${totalSec}</div><div class="delta">total</div></div>
      <div class="kpi"><div class="label">Rapports <code>/sdd audit</code></div><div class="value">${totalAudit}</div><div class="delta">total</div></div>
    </div>
    ${ligneSec ? `<p class="muted" style="font-size:.85rem">Sécurité par sévérité : <ul style="display:inline-flex;gap:.6rem;padding:0;margin:0;list-style:none">${ligneSec}</ul></p>` : ''}
    ${ligneAudit ? `<p class="muted" style="font-size:.85rem">Audit par sévérité : <ul style="display:inline-flex;gap:.6rem;padding:0;margin:0;list-style:none">${ligneAudit}</ul></p>` : ''}
    <p class="muted" style="font-size:.85rem">Détail brut dans <a href="metrics.html">métriques</a>.</p>
  </section>`;
}

export function pageSre(donnees) {
  const sre = donnees?.sre;
  if (!sre) return `<div class="empty"><strong>Données SRE non collectées.</strong></div>`;
  return `
${blocHookStats(sre.hookStats)}
${blocDeploys(sre.deployments)}
${blocSecurite(sre)}
`;
}

// Alias EN canoniques (#42)
export {
  calculerSre as computeSre,
  pageSre as srePage,
};
