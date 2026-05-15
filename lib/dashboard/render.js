// AIAD SDD Mode — Dashboard : helpers de rendu + layout + pages.
//
// Extraits de lib/dashboard.js pour ramener l'orchestrateur sous 300 LOC.
// Les pages sont conservées dans un seul fichier — pour rester DRY autour
// des helpers visuels (badge / sparkline / statutBadge / lienSource) et
// éviter une explosion artificielle en 8 modules quasi-vides.
//
// Documentation : https://aiad.ovh

import { join, basename } from 'node:path';
import { construireMatrice } from '../sdd-trace.js';
import { pmSection, pmTopBanner, detailIntentHtml, indexerContextePm, tagsIntent } from './pm.js';
import { blocRituels } from './rituels.js';
import { blocOutcomes } from './outcomes.js';
import { blocSanteGlobale } from './sante-globale.js';
import { blocLeadership } from '../leadership-metrics.js';
import { blocBadgesReadme } from './badges-block.js';
import { metaShareTags } from './meta-share.js';
import { metaCsp, THEME_DETECT_SCRIPT } from './csp.js';
import { VERSION_AIAD } from '../meta.js';
import { blocQueueQa } from './qa.js';
export { blocQueueQa };

// ─── Helpers communs ─────────────────────────────────────────────────────────

export const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// Helpers FS / parsing Markdown : importés depuis ./dashboard/collect.js
// (lireFichier, listerFichiersMd, extraireChamp, extraireTitre).

function badge(valeur, classes = '') {
  return `<span class="badge ${classes}">${escape(valeur)}</span>`;
}

// Lien vers un fichier source — par défaut relatif au dossier dashboard/
// (donc ".." en préfixe pour remonter à la racine projet). Quand
// `_sourceBase` est défini (ex: GitHub Pages avec --source-base), on préfixe
// par cette URL absolue pour pointer vers le blob GitHub plutôt que vers un
// fichier local introuvable depuis le site publié.
let _sourceBase = '';
export function setSourceBase(base) {
  _sourceBase = base ? (base.endsWith('/') ? base : base + '/') : '';
}
export function lienSource(file, texte) {
  if (!file) return '';
  const href = hrefSource(file);
  const label = texte != null ? texte : file;
  return `<a class="src-link" href="${href}" target="_blank" rel="noopener" title="Ouvrir ${escape(file)}">${escape(label)}</a>`;
}

// (#313) URL brute pour les cas qui veulent customiser le wrapper `<a>` (kanban
// cards qui héritent du style parent, mentions inline `<p>...source...</p>`).
// Respecte _sourceBase comme `lienSource()`. Toujours échappé HTML.
export function hrefSource(file, ligne) {
  if (!file) return '';
  const anchor = ligne != null ? `#L${ligne}` : '';
  return _sourceBase ? `${_sourceBase}${escape(file)}${anchor}` : `../${escape(file)}${anchor}`;
}

// (#309) Lien vers une ligne précise dans un fichier source. Utilisé par les
// tables qui exposent une "Ligne L24" (ADRs, drift, tech-debt). L'anchor
// `#L24` est interprété par GitHub/GitLab/Bitbucket pour scroller pile sur la
// ligne, et reste inoffensif sur un fichier local (ignoré par le navigateur).
export function lienSourceLigne(file, ligne, texte) {
  if (!file) return texte ? escape(texte) : '';
  const label = texte != null ? texte : (ligne != null ? `L${ligne}` : file);
  const href = hrefSource(file, ligne);
  return `<a class="src-link" href="${href}" target="_blank" rel="noopener" title="Ouvrir ${escape(file)}${ligne != null ? ' à la ligne ' + ligne : ''}">${escape(label)}</a>`;
}

// Mini-distribution barrée (statuts SPEC/Intent par catégorie).
function distributionBar(parts) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return '<div class="dist-bar empty"></div>';
  const segs = parts.filter((p) => p.value > 0).map((p) => `<span class="dist-seg ${p.cls}" style="width:${(p.value / total) * 100}%" title="${escape(p.label)} : ${p.value}">${p.value > total / 8 ? p.value : ''}</span>`).join('');
  const legende = parts.map((p) => `<span class="dist-leg-item"><span class="dist-leg-dot ${p.cls}"></span>${escape(p.label)} <strong>${p.value}</strong></span>`).join('');
  return `<div class="dist-bar">${segs}</div><div class="dist-leg">${legende}</div>`;
}

// Sparkline SVG (8x32) pour un tableau de valeurs numériques chronologiques.
function sparkline(values, opts = {}) {
  const w = opts.width || 120;
  const h = opts.height || 32;
  if (!values || values.length === 0) return `<svg class="spark" width="${w}" height="${h}"></svg>`;
  if (values.length === 1) {
    return `<svg class="spark" width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="3" /></svg>`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = w / (values.length - 1);
  const points = values.map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / span) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function statutBadge(statut) {
  if (!statut) return badge('—', 'badge-muted');
  const s = String(statut).toLowerCase();
  const map = {
    draft: 'badge-warn',
    review: 'badge-info',
    ready: 'badge-info',
    'in-progress': 'badge-info',
    validation: 'badge-info',
    done: 'badge-ok',
    active: 'badge-ok',
    archived: 'badge-muted',
    template: 'badge-warn',
    unknown: 'badge-muted',
  };
  return `<span class="badge ${map[s] || 'badge-muted'}">${escape(s)}</span>`;
}

export function sqsBadge(valeur) {
  if (valeur == null || valeur === '' || isNaN(Number(valeur))) {
    return badge('—', 'badge-muted');
  }
  const v = Number(valeur);
  let cls = 'badge-bad';
  if (v >= 4) cls = 'badge-ok';
  else if (v >= 3) cls = 'badge-warn';
  return `<span class="badge ${cls}">SQS ${v.toFixed(1)}/5</span>`;
}

function pct(num, den) {
  if (!den) return null;
  return Math.round((num / den) * 100);
}

// Badge "fraîcheur des données" (#145). Échelle : `< 1h` ok / `< TTL/4 h` ok /
// `< TTL h` warn / `≥ TTL h` bad. TTL configurable via env
// `AIAD_DASHBOARD_TTL_HOURS` (défaut 24, #178). Rituel hebdo → TTL=168.
export function freshnessBadge(isoTimestamp, opts = {}) {
  const t = isoTimestamp ? Date.parse(isoTimestamp) : NaN;
  if (isNaN(t)) return '';
  const envTtl = Number(process.env.AIAD_DASHBOARD_TTL_HOURS);
  const ttlH = opts.ttlHours ?? (Number.isFinite(envTtl) && envTtl > 0 ? envTtl : 24);
  const warnH = Math.max(1, Math.round(ttlH / 4));
  const ageMin = Math.round((Date.now() - t) / 60000);
  const ageHrs = Math.round((Date.now() - t) / 3600000);
  const ageDays = Math.round((Date.now() - t) / 86400000);
  let cls, label;
  if (ageMin < 60) { cls = 'ok'; label = ageMin < 1 ? 'à l\'instant' : `il y a ${ageMin} min`; }
  else if (ageHrs < warnH) { cls = 'ok'; label = `il y a ${ageHrs} h`; }
  else if (ageHrs < ttlH) { cls = 'warn'; label = `il y a ${ageHrs} h — à régénérer`; }
  else { cls = 'bad'; label = ageHrs < 48 ? `il y a ${ageHrs} h — données obsolètes` : `il y a ${ageDays} j — données obsolètes`; }
  const titre = `Données générées : ${new Date(t).toLocaleString('fr-FR')}. TTL ${ttlH}h. Cliquer pour copier la commande de rafraîchissement.`;
  // (#177) Badge cliquable : copie la commande au clipboard, feedback via JS
  // (cf. lib/dashboard/assets.js handler global). Reste un <span> pour
  // rétrocompat (les anciens dashboards sans JS resteront lisibles).
  return `<span class="badge badge-${cls} freshness" role="button" tabindex="0" data-copy="npx aiad-sdd dashboard" title="${escape(titre)}">${escape(label)}</span>`;
}

// (#220-style refactor) KPI cards extraits dans `./kpi-cards.js` pour
// rester sous la limite stricte 850 LOC effectives. Import + ré-export
// pour exposer les helpers à `pageOverview` ET aux consommateurs externes.
import { kpiSbom, kpiSovereignty, kpiHookStats, kpiViolations } from './kpi-cards.js';
export { kpiSbom, kpiSovereignty, kpiHookStats, kpiViolations };

// ─── Lecture des artefacts ──────────────────────────────────────────────────
// Ces fonctions lecteur sont déplacées dans `./dashboard/collect.js` et
// `collecterDonnees` est importée depuis là. Le bloc legacy ci-dessous est
// conservé temporairement à des fins de comparaison avant suppression.
//
// MIGRATION : tout l'extrait jusqu'à `collecterDonnees` (inclus) a été déplacé
// dans le module dédié. Le code suivant est ignoré (renommé) pour rester
// gardable mais inutilisé en runtime.
// ─── Layout commun ───────────────────────────────────────────────────────────

export const PAGES = [
  { slug: 'index', titre: 'Vue d\'ensemble', icone: '◐', file: 'index.html' },
  { slug: 'pm', titre: 'PM Cockpit', icone: '◑', file: 'pm.html' },
  { slug: 'intents', titre: 'Intents', icone: '◇', file: 'intents.html' },
  { slug: 'specs', titre: 'SPECs', icone: '◆', file: 'specs.html' },
  { slug: 'traceability', titre: 'Traçabilité', icone: '⇄', file: 'traceability.html' },
  { slug: 'graph', titre: 'Graphe', icone: '⊛', file: 'graph.html' },
  { slug: 'metrics', titre: 'Métriques', icone: '⊞', file: 'metrics.html' },
  { slug: 'qa', titre: 'QA', icone: '✓', file: 'qa.html' },
  { slug: 'adrs', titre: 'ADRs', icone: '⎈', file: 'adrs.html' },
  { slug: 'legal', titre: 'Legal', icone: '§', file: 'legal.html' },
  { slug: 'governance', titre: 'Gouvernance', icone: '⚖', file: 'governance.html' },
  { slug: 'drifts', titre: 'Drifts & Facts', icone: '⚠', file: 'drifts.html' },
  { slug: 'changelog', titre: 'Changelog', icone: '⏱', file: 'changelog.html' },
  { slug: 'onboarding', titre: 'Onboarding', icone: '?', file: 'onboarding.html' },
  { slug: 'kanban', titre: 'Kanban', icone: '▦', file: 'kanban.html' },
  { slug: 'sre', titre: 'SRE / Ops', icone: '⚙', file: 'sre.html' },
  { slug: 'dpo', titre: 'DPO / RGPD', icone: '⊙', file: 'dpo.html' }];

export function layout({ slug, titre, sous, donnees, body }) {
  const projet = donnees.projet;
  const itemsNav = PAGES.map((p) => `
    <li><a href="${p.file}" class="${p.slug === slug ? 'active' : ''}">
      <span class="nav-icon">${p.icone}</span>${escape(p.titre)}
    </a></li>`).join('');
  const pageTitle = `${titre} — ${projet.nom || 'projet'}`;
  const pageFile = PAGES.find((p) => p.slug === slug)?.file || 'index.html';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="aiad-generated-at" content="${escape(projet.genere || '')}"/><meta name="aiad-version" content="${escape(VERSION_AIAD)}"/>
${metaCsp()}
<title>${escape(pageTitle)}</title>
${metaShareTags(donnees, titre, sous, { pageFile })}
<link rel="icon" href="favicon.svg" type="image/svg+xml"/>
<link rel="manifest" href="manifest.webmanifest"/>
<link rel="stylesheet" href="assets/style.css"/>
<script>${THEME_DETECT_SCRIPT}</script>
</head>
<body>
<nav class="side">
  <div class="brand">
    <div class="brand-title">${escape(projet.nom)}</div>
    <div class="brand-sub">SDD Mode · Dashboard</div>
    ${projet.version ? `<div class="brand-version">v${escape(projet.version)}</div>` : ''}
  </div>
  <ul>${itemsNav}</ul>
  <div class="footer">Généré ${escape(new Date(projet.genere).toLocaleString('fr-FR'))}<br/>Framework AIAD v${escape(VERSION_AIAD)} · <a href="https://aiad.ovh" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">aiad.ovh</a></div>
</nav>
<main>
  <header class="page-header">
    <div>
      <h1>${escape(titre)}</h1>
      ${sous ? `<div class="subtitle">${sous}</div>` : ''}
    </div>
    <div class="header-right">
      ${freshnessBadge(projet.genere)}
      <div class="meta">${escape(projet.nom)}${projet.version ? ' · v' + escape(projet.version) : ''}</div>
      <button type="button" class="toggle-theme" id="toggleTheme" aria-label="Basculer thème clair / sombre" title="Basculer thème clair / sombre">
        <span class="icon icon-dark">☾</span><span class="icon icon-light">☀</span>
      </button>
    </div>
  </header>
  ${body}
</main>
<script src="assets/app.js"></script>
</body>
</html>
`;
}

// ─── Renderers de pages ──────────────────────────────────────────────────────

export function listerAlertes(donnees) {
  const alertes = [];
  // SQS faibles
  for (const s of donnees.specs) {
    const v = Number(s.sqs);
    if (!isNaN(v) && v < 4 && ['draft', 'review'].includes(s.statut)) {
      alertes.push({
        gravite: 'warn',
        titre: `SQS faible sur ${s.id}`,
        detail: `${v.toFixed(1)}/5 — ${s.titre}`,
        cible: `specs.html`,
        action: 'remédiation à appliquer avant Gate',
      });
    }
  }
  // Facts critiques ouverts (priorité 1) + facts major ouverts (priorité 2)
  for (const f of donnees.facts) {
    const ouvert = !['closed', 'resolu', 'résolu'].includes(f.statut);
    if (!ouvert) continue;
    if (f.gravite === 'critical') {
      alertes.push({
        gravite: 'bad',
        titre: `Fact critique ouvert — ${f.id}`,
        detail: f.titre,
        cible: 'drifts.html',
        action: 'investigation immédiate',
      });
    } else if (f.gravite === 'major') {
      alertes.push({
        gravite: 'warn',
        titre: `Fact majeur ouvert — ${f.id}`,
        detail: f.titre,
        cible: 'drifts.html',
        action: 'planifier remédiation',
      });
    }
  }
  // SPECs validées sans code (gap de traçabilité bloquant)
  for (const s of donnees.matrice.gaps.specsValideesNonImplementees) {
    alertes.push({
      gravite: 'warn',
      titre: `SPEC validée sans code — ${s.id}`,
      detail: `statut ${s.status} mais aucune annotation @spec dans le code`,
      cible: 'traceability.html',
      action: 'lancer /sdd exec ou annoter le code livré',
    });
  }
  // Drifts non résolus
  const driftsNonRes = donnees.metrics.agregats.drift.driftsDetectes - donnees.metrics.agregats.drift.driftsResolus;
  if (driftsNonRes > 0) {
    alertes.push({
      gravite: 'warn',
      titre: `${driftsNonRes} drift(s) détecté(s) non résolu(s)`,
      detail: 'Code modifié sans synchronisation SPEC',
      cible: 'metrics.html',
      action: 'lancer /sdd drift-check sur les zones concernées',
    });
  }
  // Intents zombie (active depuis > 30j)
  const auj = new Date();
  for (const i of donnees.intents) {
    if (i.statut !== 'active' || !i.date) continue;
    const age = (auj - new Date(i.date)) / (1000 * 60 * 60 * 24);
    if (age > 30) {
      alertes.push({
        gravite: 'warn',
        titre: `Intent zombie — ${i.id}`,
        detail: `actif depuis ${Math.round(age)}j sans clôture`,
        cible: 'intents.html',
        action: 'archiver ou relancer (cf. /aiad health)',
      });
    }
  }
  // Gouvernance manquante
  const manquants = donnees.gouvernance.filter((g) => !g.present);
  if (manquants.length) {
    alertes.push({
      gravite: 'bad',
      titre: `${manquants.length} agent(s) Tier 1 manquant(s)`,
      detail: manquants.map((g) => g.id).join(', '),
      cible: 'governance.html',
      action: 'lancer npx aiad-sdd gouvernance',
    });
  }
  // (#153 / #167) DPIA avec sections "(à compléter)" → action DPO requise.
  // Paliers : > 10 → bad ; > 0 → warn.
  const lastDpia = donnees.supplementaire?.dpia?.latest;
  if (lastDpia && lastDpia.aCompleter > 0) {
    const gravite = lastDpia.aCompleter > 10 ? 'bad' : 'warn';
    alertes.push({
      gravite,
      titre: `DPIA incomplet — ${lastDpia.aCompleter} section(s) à compléter`,
      detail: `${lastDpia.nom} (${lastDpia.sectionsCount} sections déclarées)${gravite === 'bad' ? ' — chantier DPO conséquent' : ''}`,
      cible: 'legal.html',
      action: gravite === 'bad'
        ? 'solliciter le DPO en priorité — planifier une session dédiée'
        : 'solliciter le DPO pour clôturer les sections marquées',
    });
  }
  // (#153 / #167) AI Act audit avec placeholders. Paliers : > 6 → bad ; > 0 → warn.
  const lastAct = donnees.supplementaire?.aiAct?.latest;
  if (lastAct && lastAct.aCompleter > 0) {
    const gravite = lastAct.aCompleter > 6 ? 'bad' : 'warn';
    alertes.push({
      gravite,
      titre: `AI Act Annexe IV — ${lastAct.aCompleter} section(s) à compléter`,
      detail: `${lastAct.nom} (${lastAct.sectionsCount}/8 sections déclarées)${gravite === 'bad' ? ' — risque conformité élevé' : ''}`,
      cible: 'legal.html',
      action: gravite === 'bad'
        ? 'compléter ce sprint — sinon mise sur le marché EU bloquée'
        : 'compléter les sections "(à compléter)" du rapport',
    });
  }
  // (#165) Combinaison à risque : AI Act incomplet ET pack EU sensible installé
  const packs = donnees.legalPacks || [];
  const packsEuRisque = packs.filter((p) => p.id === 'eu-platforms' || p.id === 'eu-financial').map((p) => p.id);
  if (lastAct && lastAct.aCompleter > 5 && packsEuRisque.length > 0) {
    alertes.push({
      gravite: 'bad',
      titre: `Risque conformité EU élevé — AI Act très incomplet (${lastAct.aCompleter} placeholders) avec exposition ${packsEuRisque.join('+')}`,
      detail: `Pack(s) EU installé(s) : ${packsEuRisque.join(', ')}. Le marché EU exige un dossier Annexe IV solide avant mise sur le marché.`,
      cible: 'legal.html',
      action: 'priorité 1 : compléter le rapport AI Act ce sprint',
    });
  }
  return alertes;
}

export function pageOverview(donnees) {
  const m = donnees.maturite;
  const fond = donnees.fondamentaux;
  const matrice = donnees.matrice;
  const totalGaps = matrice.gaps.intentsSansSpec.length
    + matrice.gaps.specsSansCode.length
    + matrice.gaps.specsValideesNonImplementees.length
    + matrice.gaps.specsOrphelinsSurCode.length
    + matrice.gaps.intentsOrphelinsSurCode.length
    + matrice.gaps.codeSansSpec.length
    + matrice.gaps.codeSansTests.length;
  const alertes = listerAlertes(donnees);

  const fondamentaux = fond.map((f) => `
    <tr>
      <td>${f.chemin ? lienSource(f.chemin) : `<code>${escape(f.nom)}</code>`}</td>
      <td>${f.present ? statutBadge(f.rempli ? 'rédigé' : 'template') : statutBadge('absent')}</td>
      <td>${f.titre ? escape(f.titre) : '<em class="muted">—</em>'}</td>
      <td class="muted">${f.tailleKo ? f.tailleKo + ' Ko' : '—'}</td>
    </tr>`).join('');

  const intentsActifs = donnees.intents.filter((i) => i.statut === 'active').length;
  const specsReady = donnees.specs.filter((s) => ['ready', 'in-progress', 'validation', 'done'].includes(s.statut)).length;
  const driftsOuverts = donnees.facts.filter((f) => f.statut !== 'closed' && f.statut !== 'resolu' && f.statut !== 'résolu').length;

  const gouvOk = donnees.gouvernance.filter((g) => g.present).length;
  const gouvAttendu = donnees.gouvernance.length;

  const recentChanges = donnees.changelog.entrees.slice(0, 5).map((e) => `
    <tr>
      <td class="muted">${escape(e.date)}</td>
      <td><strong>${escape(e.artefact)}</strong></td>
      <td>${escape(e.type)}</td>
      <td class="muted">${escape(e.auteur || '—')}</td>
    </tr>`).join('');

  // (#330) ID hyperlié vers le fichier SPEC (cohérent #327 sur specs.html).
  const recentSpecs = donnees.specs.slice(0, 5).map((s) => `
    <tr>
      <td>${s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`}</td>
      <td>${escape(s.titre)}</td>
      <td>${statutBadge(s.statut)}</td>
      <td>${sqsBadge(s.sqs)}</td>
    </tr>`).join('');

  const matKpiCls = m.score >= 4 ? 'ok' : m.score >= 2 ? 'warn' : 'bad';
  const gapsKpiCls = totalGaps === 0 ? 'ok' : totalGaps <= 5 ? 'warn' : 'bad';

  // (#168) > 5 alertes : on affiche les 5 plus graves, le reste dans <details>.
  const POIDS = { bad: 0, warn: 1, info: 2 };
  const tri = [...alertes].sort((a, b) => (POIDS[a.gravite] ?? 9) - (POIDS[b.gravite] ?? 9));
  const visibles = tri.slice(0, 5);
  const repliees = tri.slice(5);
  const rdA = (a) => `<a href="${a.cible}" class="alerte alerte-${a.gravite}"><div class="alerte-titre">${escape(a.titre)}</div><div class="alerte-detail">${escape(a.detail)}</div><div class="alerte-action">→ ${escape(a.action)}</div></a>`;
  const blocAlertes = alertes.length === 0
    ? `<div class="alertes ok"><span class="alertes-icon">✓</span><div><strong>Aucune alerte</strong><div class="muted">Le projet ne remonte aucun signal d'attention.</div></div></div>`
    : `<div class="alertes-list">${visibles.map(rdA).join('')}</div>${repliees.length === 0 ? '' : `<details style="margin-top:.75rem"><summary><strong>+ ${repliees.length} autre(s) alerte(s)</strong> <span class="muted">priorité moindre</span></summary><div class="alertes-list" style="margin-top:.5rem">${repliees.map(rdA).join('')}</div></details>`}`;

  return `
${alertes.length > 0
  ? `<section><h2>Alertes <span class="count">${alertes.length} signal(s)</span></h2>${blocAlertes}</section>`
  : `<section><h2>Alertes</h2>${blocAlertes}</section>`}
<div class="kpis">
  <div class="kpi ${matKpiCls}">
    <div class="label">Maturité</div>
    <div class="value">${m.score}/5</div>
    <div class="delta">${escape(m.label)}</div>
  </div>
  <div class="kpi">
    <div class="label">Intents actifs</div>
    <div class="value">${intentsActifs}<span class="muted" style="font-size:1rem;font-weight:400;"> / ${donnees.intents.length}</span></div>
    <div class="delta">total</div>
  </div>
  <div class="kpi">
    <div class="label">SPECs prêtes+</div>
    <div class="value">${specsReady}<span class="muted" style="font-size:1rem;font-weight:400;"> / ${donnees.specs.length}</span></div>
    <div class="delta">ready / in-progress / done</div>
  </div>
  <div class="kpi ${gouvOk === gouvAttendu ? 'ok' : 'warn'}">
    <div class="label">Gouvernance Tier 1</div>
    <div class="value">${gouvOk}/${gouvAttendu}</div>
    <div class="delta">agents installés</div>
  </div>
  <div class="kpi ${gapsKpiCls}">
    <div class="label">Gaps traçabilité</div>
    <div class="value">${totalGaps}</div>
    <div class="delta">tous types confondus</div>
  </div>
  <div class="kpi ${driftsOuverts === 0 ? 'ok' : 'warn'}">
    <div class="label">Drifts ouverts</div>
    <div class="value">${driftsOuverts}</div>
    <div class="delta">sur ${donnees.facts.length} fact(s)</div>
  </div>
  ${kpiSbom(donnees)}
  ${kpiSovereignty(donnees)}
  ${kpiHookStats(donnees)}
  ${kpiViolations(donnees)}
</div>

${blocSanteGlobale(donnees)}
${blocLeadership(donnees)}
${blocOutcomes(donnees)}
${blocBadgesReadme(donnees)}
${pmSection(donnees)}${blocRituels(donnees)}

<section>
  <h2>Maturité du projet</h2>
  <div class="maturite ${m.cls}">
    <div class="label">${escape(m.label)}</div>
    <div class="barre"><div class="fill" style="width:${(m.score / m.total) * 100}%"></div></div>
    <div class="score">${m.score} / ${m.total}</div>
  </div>
  ${m.raisonPlafond ? `<p class="muted" style="margin-top:.5rem"><strong>Plafonné à ${m.plafond}/5</strong> — ${escape(m.raisonPlafond)}. <a href="https://aiad.ovh/docs/maturite" target="_blank" rel="noopener">Comment relever le score</a>.</p>` : ''}
</section>

<section>
  <h2>Artefacts fondamentaux</h2>
  <table>
    <thead><tr><th>Fichier</th><th>État</th><th>Titre</th><th>Taille</th></tr></thead>
    <tbody>${fondamentaux}</tbody>
  </table>
</section>

<div class="split">
  <section>
    <h2>SPECs récentes</h2>
    ${donnees.specs.length === 0
      ? `<div class="empty"><strong>Aucune SPEC pour le moment.</strong>Lance <code>/sdd spec</code> pour créer la première.</div>`
      : `<table>
          <thead><tr><th>ID</th><th>Titre</th><th>Statut</th><th>SQS</th></tr></thead>
          <tbody>${recentSpecs}</tbody>
        </table>`}
  </section>
  <section>
    <h2>Changelog récent</h2>
    ${donnees.changelog.entrees.length === 0
      ? `<div class="empty"><strong>Aucune entrée de changelog.</strong>Les changements d'artefacts seront tracés ici.</div>`
      : `<table>
          <thead><tr><th>Date</th><th>Artefact</th><th>Type</th><th>Auteur</th></tr></thead>
          <tbody>${recentChanges}</tbody>
        </table>`}
  </section>
</div>

<section>
  <h2>Actions rapides</h2>
  <div class="actions">
    <a href="intents.html">→ Voir les Intents</a>
    <a href="specs.html">→ Voir les SPECs</a>
    <a href="traceability.html">→ Matrice de traçabilité</a>
    <a href="metrics.html">→ Métriques DORA & Flow</a>
    <a href="governance.html">→ Gouvernance Tier 1</a>
    <a href="drifts.html">→ Drifts & Facts</a>
  </div>
</section>
`;
}

export function pageIntents(donnees) {
  if (donnees.intents.length === 0) {
    return `<div class="empty">
      <strong>Aucun Intent Statement.</strong>
      Le cycle SDD commence par un Intent : lance <code>/sdd intent</code> dans Claude Code pour capturer le POURQUOI d'une nouvelle fonctionnalité.
    </div>`;
  }
  // (#231) Contexte PM + helpers — externalisés dans pm.js pour respecter
  // le budget LOC de render.js.
  const ctxPm = indexerContextePm(donnees);
  const rows = donnees.intents.map((i) => {
    // Match court (#231) si la map en a, sinon fallback legacy. Couvre
    // l'ancien cas (parent_intent = id long exact) et le nouveau (parent_intent
    // court ↔ Intent ID long, vu sur le bench).
    const viaCourt = ctxPm.specsParIntentId.get(i.id);
    const viaLegacy = donnees.specsParIntent?.get(i.id);
    const specsLies = (viaCourt && viaCourt.length ? viaCourt : viaLegacy) || [];
    const specsCell = specsLies.length
      ? specsLies.map((s) => s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`).join(' ')
      : '<em class="muted">aucune</em>';
    const av = ctxPm.avancementById.get(i.id);
    const tags = tagsIntent(i, specsLies, ctxPm);
    const detail = detailIntentHtml(i, av);
    return `<tr data-tags="${escape(tags.join(' '))}" data-statut="${escape(i.statut)}">
      <td>${i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`}</td>
      <td><strong>${escape(i.titre)}</strong>
        <details class="intents-row-details"><summary>Voir détail Intent (POURQUOI / OBJECTIF / …)</summary>
          <div class="intents-details">${detail.sections}</div>
        </details></td>
      <td data-sort="${escape(i.statut)}">${statutBadge(i.statut)}</td>
      <td>${specsCell}</td>
      <td data-sort="${av?.ratio ?? -1}">${detail.progress}</td>
      <td class="muted">${escape(i.auteur || '—')}</td>
      <td class="muted" data-sort="${escape(i.date || '')}">${escape(i.date || '—')}</td>
    </tr>`;
  }).join('');

  const parStatut = {};
  for (const i of donnees.intents) {
    parStatut[i.statut] = (parStatut[i.statut] || 0) + 1;
  }
  const distParts = [
    { label: 'active', value: parStatut.active || 0, cls: 'seg-ok' },
    { label: 'in-progress', value: parStatut['in-progress'] || 0, cls: 'seg-info' },
    { label: 'draft', value: parStatut.draft || 0, cls: 'seg-warn' },
    { label: 'done', value: parStatut.done || 0, cls: 'seg-muted' },
    { label: 'archived', value: parStatut.archived || 0, cls: 'seg-muted' },
  ];

  const kpis = ['active', 'draft', 'done', 'archived'].map((s) => `
    <div class="kpi">
      <div class="label">${s}</div>
      <div class="value">${parStatut[s] || 0}</div>
    </div>`).join('');

  return `
${pmTopBanner(donnees)}
<div class="kpis">${kpis}</div>

<section>
  <h2>Répartition par statut</h2>
  <div class="card">${distributionBar(distParts)}</div>
</section>

<section>
  <h2>Catalogue <span class="count">${donnees.intents.length} intent(s)</span></h2>
  <div class="pm-filter-chips" data-pm-filter-target="tIntents" role="toolbar" aria-label="Filtres rapides PM">
    <button type="button" data-pm-filter="*" aria-pressed="true">Tous</button>
    <button type="button" data-pm-filter="zombie" aria-pressed="false">Zombies</button>
    <button type="button" data-pm-filter="draft-vieux" aria-pressed="false">Drafts &gt;14j</button>
    <button type="button" data-pm-filter="sans-spec" aria-pressed="false">Sans SPEC</button>
    <button type="button" data-pm-filter="sans-livraison" aria-pressed="false">Sans livraison</button>
  </div>
  <div class="filter"><input type="search" id="qIntents" data-filter-target="tIntents" placeholder="Filtrer par ID, titre, statut, auteur…"/></div>
  <table id="tIntents" data-sortable="true">
    <thead><tr><th>ID</th><th>Titre</th><th>Statut</th><th>SPECs liées</th><th>Avancement</th><th>Auteur</th><th>Date</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
`;
}

export function pageSpecs(donnees) {
  if (donnees.specs.length === 0) {
    return `<div class="empty">
      <strong>Aucune SPEC.</strong>
      Une fois un Intent capturé, lance <code>/sdd spec</code> (ou <code>/sdd spec --ears</code> pour la variante stricte) pour produire la spécification technique.
    </div>`;
  }
  // (#327) SPEC ID + Intent parent hyperliés vers fichiers sources.
  const intentsById = new Map(donnees.intents.map((i) => [i.id, i]));
  const rows = donnees.specs.map((s) => {
    const sqsNum = Number(s.sqs);
    const parent = s.parentIntent ? intentsById.get(s.parentIntent) : null;
    const cellParent = s.parentIntent
      ? (parent?.file ? lienSource(parent.file, s.parentIntent) : `<code>${escape(s.parentIntent)}</code>`)
      : '<em class="muted">—</em>';
    return `<tr>
    <td>${s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`}</td>
    <td>
      <div class="row-cluster">
        <strong>${escape(s.titre)}</strong>
      </div>
    </td>
    <td>${cellParent}</td>
    <td data-sort="${escape(s.format)}">${badge(s.format, s.format === 'ears' ? 'badge-info' : 'badge-muted')}</td>
    <td data-sort="${isNaN(sqsNum) ? '' : sqsNum}">${sqsBadge(s.sqs)}</td>
    <td data-sort="${escape(s.statut)}">${statutBadge(s.statut)}</td>
    <td class="muted" data-sort="${escape(s.date || '')}">${escape(s.date || '—')}</td>
  </tr>`;
  }).join('');

  const parStatut = {};
  for (const s of donnees.specs) parStatut[s.statut] = (parStatut[s.statut] || 0) + 1;
  const earsCount = donnees.specs.filter((s) => s.format === 'ears').length;
  const sqsValeurs = donnees.specs.map((s) => Number(s.sqs)).filter((x) => !isNaN(x));
  const sqsMoy = sqsValeurs.length ? sqsValeurs.reduce((a, b) => a + b, 0) / sqsValeurs.length : null;

  const distSpec = [
    { label: 'done', value: parStatut.done || 0, cls: 'seg-ok' },
    { label: 'in-progress', value: parStatut['in-progress'] || 0, cls: 'seg-info' },
    { label: 'validation', value: parStatut.validation || 0, cls: 'seg-info' },
    { label: 'ready', value: parStatut.ready || 0, cls: 'seg-info' },
    { label: 'review', value: parStatut.review || 0, cls: 'seg-warn' },
    { label: 'draft', value: parStatut.draft || 0, cls: 'seg-warn' },
    { label: 'archived', value: parStatut.archived || 0, cls: 'seg-muted' },
  ];

  const sqsCls = sqsMoy == null ? '' : sqsMoy >= 4 ? 'ok' : sqsMoy >= 3 ? 'warn' : 'bad';

  const kpis = `
    <div class="kpi"><div class="label">Total</div><div class="value">${donnees.specs.length}</div></div>
    <div class="kpi ${sqsCls}"><div class="label">SQS moyen</div><div class="value">${sqsMoy != null ? sqsMoy.toFixed(1) + '/5' : '—'}</div></div>
    <div class="kpi"><div class="label">Done</div><div class="value">${parStatut.done || 0}</div></div>
    <div class="kpi"><div class="label">In progress</div><div class="value">${parStatut['in-progress'] || 0}</div></div>
    <div class="kpi"><div class="label">Draft / Review</div><div class="value">${(parStatut.draft || 0) + (parStatut.review || 0)}</div></div>
    <div class="kpi"><div class="label">Format EARS</div><div class="value">${earsCount}</div></div>
  `;

  return `
<div class="kpis">${kpis}</div>

<section>
  <h2>Répartition par statut</h2>
  <div class="card">${distributionBar(distSpec)}</div>
</section>

<section>
  <h2>Catalogue <span class="count">${donnees.specs.length} spec(s)</span></h2>
  <div class="filter"><input type="search" id="qSpecs" data-filter-target="tSpecs" placeholder="Filtrer par ID, titre, intent, format…"/></div>
  <table id="tSpecs" data-sortable="true">
    <thead><tr><th>ID</th><th>Titre</th><th>Intent parent</th><th>Format</th><th>SQS</th><th>Statut</th><th>Date</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
`;
}

export function pageTraceability(donnees) {
  // (#326) Cellules ID Intent/SPEC + paths code/tests deviennent hyperliées.
  // Intent/SPEC pointent vers le fichier .md (sans anchor — la SPEC entière
  // est le contexte). Code/tests pointent vers la ligne `@spec` (anchor #LN).
  const m = donnees.matrice;
  const cellIdLink = (id, file) => file ? lienSource(file, id) : `<code>${escape(id)}</code>`;
  const cellPath = (p) => lienSourceLigne(p.path, p.line, p.path);
  const rowsForward = m.forward.flatMap((row) => {
    if (row.specs.length === 0) {
      return [`<tr><td>${cellIdLink(row.intent.id, row.intent.file)}</td><td><em class="muted">(aucune SPEC)</em></td><td>—</td><td>—</td><td>${badge('orphelin', 'badge-bad')}</td></tr>`];
    }
    return row.specs.map((s, idx) => {
      const code = s.code.length ? s.code.map(cellPath).join('<br/>') : '<em class="muted">aucun</em>';
      const tests = s.tests.length ? s.tests.map(cellPath).join('<br/>') : '<em class="muted">aucun</em>';
      let verdict = badge('ok', 'badge-ok');
      if (s.code.length === 0) verdict = badge('non-implémentée', 'badge-warn');
      else if (s.tests.length === 0) verdict = badge('non-testée', 'badge-warn');
      // rowspan : on ne ré-affiche l'intent que sur la première SPEC du groupe
      const cellIntent = idx === 0
        ? `<td rowspan="${row.specs.length}" class="rowspan">${cellIdLink(row.intent.id, row.intent.file)}</td>`
        : '';
      return `<tr>
        ${cellIntent}
        <td>${cellIdLink(s.spec.id, s.spec.file)}<br/><small class="muted">${escape(s.spec.title)}</small></td>
        <td>${code}</td>
        <td>${tests}</td>
        <td>${verdict}</td>
      </tr>`;
    });
  }).join('');

  const rowsBackward = m.backward.map((row) => {
    const code = row.code.length ? row.code.map(cellPath).join('<br/>') : '<em class="muted">aucun</em>';
    return `<tr>
      <td>${cellPath(row.test)}</td>
      <td>${row.spec ? cellIdLink(row.spec.id, row.spec.file) : badge('non-tracé', 'badge-bad')}</td>
      <td>${row.intent ? cellIdLink(row.intent.id, row.intent.file) : '<em class="muted">—</em>'}</td>
      <td>${code}</td>
    </tr>`;
  }).join('');

  const gapsTotal = m.gaps.intentsSansSpec.length + m.gaps.specsSansCode.length
    + m.gaps.specsValideesNonImplementees.length + m.gaps.specsOrphelinsSurCode.length
    + m.gaps.intentsOrphelinsSurCode.length + m.gaps.codeSansSpec.length
    + m.gaps.codeSansTests.length;

  return `
<div class="kpis">
  <div class="kpi"><div class="label">Intents</div><div class="value">${m.summary.intents}</div></div>
  <div class="kpi"><div class="label">SPECs</div><div class="value">${m.summary.specs}</div></div>
  <div class="kpi"><div class="label">Code annoté</div><div class="value small">${m.summary.annotatedCodeFiles} / ${m.summary.codeFiles}</div></div>
  <div class="kpi"><div class="label">Tests annotés</div><div class="value small">${m.summary.annotatedTestFiles} / ${m.summary.testFiles}</div></div>
  <div class="kpi ${gapsTotal === 0 ? 'ok' : 'warn'}"><div class="label">Gaps détectés</div><div class="value">${gapsTotal}</div></div>
</div>

<section class="matrix-tab">
  <h2>Matrice Forward · Intent → SPEC → Code → Tests</h2>
  ${m.forward.length === 0
    ? `<div class="empty"><strong>Aucun intent à tracer.</strong>Lance <code>/sdd intent</code> puis annote ton code avec <code>@spec SPEC-NNN-...</code>.</div>`
    : `<div class="filter"><input type="search" id="qFwd" data-filter-target="tFwd" placeholder="Filtrer la matrice forward…"/></div>
       <table id="tFwd">
         <thead><tr><th>Intent</th><th>SPEC</th><th>Code</th><th>Tests</th><th>Verdict</th></tr></thead>
         <tbody>${rowsForward}</tbody>
       </table>`}
</section>

<section class="matrix-tab">
  <h2>Matrice Backward · Tests → Code → SPEC → Intent</h2>
  ${m.backward.length === 0
    ? `<div class="empty"><strong>Aucun test annoté.</strong>Ajoute <code>@spec SPEC-...</code> dans tes fichiers de test pour bâtir la matrice backward.</div>`
    : `<div class="filter"><input type="search" id="qBwd" data-filter-target="tBwd" placeholder="Filtrer la matrice backward…"/></div>
       <table id="tBwd">
         <thead><tr><th>Test</th><th>SPEC</th><th>Intent</th><th>Code couvert</th></tr></thead>
         <tbody>${rowsBackward}</tbody>
       </table>`}
</section>

<section>
  <h2>Gaps détectés</h2>
  <div class="split">
    <div class="card">
      <h3>Orphelins</h3>
      <ul class="compact">
        <li><strong>${m.gaps.intentsSansSpec.length}</strong> intent(s) sans SPEC</li>
        <li><strong>${m.gaps.specsSansCode.length}</strong> SPEC(s) sans code (hors draft/review)</li>
        <li><strong>${m.gaps.specsOrphelinsSurCode.length}</strong> SPEC(s) référencé(s) dans le code mais absent(s) des artefacts</li>
        <li><strong>${m.gaps.intentsOrphelinsSurCode.length}</strong> Intent(s) référencé(s) dans le code mais absent(s) des artefacts</li>
      </ul>
    </div>
    <div class="card">
      <h3>Non-implémentés / non-tracés</h3>
      <ul class="compact">
        <li><strong>${m.gaps.specsValideesNonImplementees.length}</strong> SPEC(s) validée(s) sans code</li>
        <li><strong>${m.gaps.codeSansSpec.length}</strong> fichier(s) code sans <code>@spec</code></li>
        <li><strong>${m.gaps.codeSansTests.length}</strong> fichier(s) annoté(s) sans test lié</li>
      </ul>
    </div>
  </div>
</section>
`;
}

export function pageMetrics(donnees) {
  const a = donnees.metrics.agregats;
  const cats = donnees.metrics.categories;

  const totalAvecMetrics = Object.values(cats).reduce((s, c) => s + c.fichiers.length, 0);
  // (#181) Même sans métriques persistées dans .aiad/metrics/, le bloc
  // Leadership EU/FR reste pertinent : il dérive de la matrice de
  // traçabilité et des Intents (calculs purs, pas d'historique). On l'affiche
  // donc en premier puis un message "Aucune autre métrique persistée".
  if (totalAvecMetrics === 0) {
    return `${blocLeadership(donnees)}
<div class="empty">
      <strong>Aucune autre donnée métrique persistée.</strong>
      Les commandes <code>/aiad standup</code>, <code>/aiad demo</code>, <code>/aiad retro</code>, <code>/aiad dora</code>, <code>/aiad flow</code> écrivent leurs métriques dans <code>.aiad/metrics/</code>. Une fois que tu as exécuté ces rituels, DORA et Flow apparaîtront ici.
      <div class="actions" style="justify-content:center;margin-top:1rem;">
        <a href="changelog.html">→ Changelog</a>
        <a href="traceability.html">→ Traçabilité</a>
      </div>
    </div>`;
  }

  function fmt(n, suffixe = '') {
    if (n == null || isNaN(n)) return '—';
    return Math.round(n * 10) / 10 + suffixe;
  }

  // Séries chronologiques pour sparklines (ordre ascendant)
  const seriesCycleTime = [...cats.deployments.fichiers]
    .sort((a, b) => a.mtime - b.mtime)
    .map((f) => Number(f.data.cycle_time_days))
    .filter((x) => !isNaN(x));
  const seriesSqs = [...cats.specs.fichiers]
    .sort((a, b) => a.mtime - b.mtime)
    .map((f) => Number(f.data.sqs_score))
    .filter((x) => !isNaN(x));
  const seriesWip = [...cats.standup.fichiers]
    .sort((a, b) => a.mtime - b.mtime)
    .map((f) => Number(f.data.wip))
    .filter((x) => !isNaN(x));
  const seriesDrift = [...cats.drift.fichiers]
    .sort((a, b) => a.mtime - b.mtime)
    .map((f) => Number(f.data.drifts_count))
    .filter((x) => !isNaN(x));

  // #136 — Honnêteté DORA : ne pas afficher des cadrans `—` quand aucun
  // déploiement n'a été enregistré. Bannière explicite + guide d'alimentation.
  const doraVide = a.deployments.total === 0;
  const dora = doraVide
    ? `<div class="empty">
        <strong>Données DORA absentes</strong>
        Aucun déploiement enregistré dans <code>.aiad/metrics/deployments/</code>. Pour activer les 4 indicateurs DORA (Deployment Frequency, Lead Time, Change Failure Rate, MTTR), exécute <code>/aiad dora</code> après chaque mise en production — ou écris directement un fichier <code>YYYY-MM-DD-deploy-NN.md</code> avec les clés <code>status: success|hotfix</code>, <code>cycle_time_days: N</code>, <code>lead_time_days: N</code>.
        <div class="actions" style="justify-content:center;margin-top:1rem;">
          <a href="https://aiad.ovh/docs/dora-format" target="_blank" rel="noopener">→ Format d'alimentation détaillé</a>
        </div>
      </div>`
    : `
    <div class="kpi"><div class="label">Déploiements</div><div class="value">${a.deployments.total}</div><div class="delta">${a.deployments.success} OK · ${a.deployments.hotfix} hotfix</div></div>
    <div class="kpi"><div class="label">Cycle Time moyen</div><div class="value">${fmt(a.deployments.cycleTimeMoyen, ' j')}</div><div class="spark-row">${sparkline(seriesCycleTime)}</div></div>
    <div class="kpi"><div class="label">Lead Time moyen</div><div class="value">${fmt(a.deployments.leadTimeMoyen, ' j')}</div></div>
    <div class="kpi ${a.deployments.hotfix / a.deployments.total < 0.05 ? 'ok' : 'warn'}">
      <div class="label">Change Failure Rate</div>
      <div class="value">${Math.round((a.deployments.hotfix / a.deployments.total) * 100) + '%'}</div>
    </div>
  `;
  const flowVide = a.standup.total === 0 && a.specs.total === 0 && a.drift.total === 0;
  const flow = flowVide
    ? `<div class="empty">
        <strong>Données Flow & Qualité absentes</strong>
        Aucun standup, score SQS ou drift enregistré dans <code>.aiad/metrics/</code>. Exécute <code>/aiad standup</code> (WIP, blockers du jour), <code>/sdd gate</code> (SQS), <code>/sdd drift-check</code> (drift count) pour alimenter ces indicateurs.
        <div class="actions" style="justify-content:center;margin-top:1rem;">
          <a href="https://aiad.ovh/docs/flow-format" target="_blank" rel="noopener">→ Format d'alimentation détaillé</a>
        </div>
      </div>`
    : `
    <div class="kpi"><div class="label">WIP moyen</div><div class="value">${fmt(a.standup.wipMoyen)}</div><div class="delta">${a.standup.total} standup(s)</div><div class="spark-row">${sparkline(seriesWip)}</div></div>
    <div class="kpi ${a.specs.sqsMoyen != null ? (a.specs.sqsMoyen >= 4 ? 'ok' : a.specs.sqsMoyen >= 3 ? 'warn' : 'bad') : ''}">
      <div class="label">SQS moyen</div>
      <div class="value">${fmt(a.specs.sqsMoyen, '/5')}</div>
      <div class="delta">${a.specs.total} spec(s) gate</div>
      <div class="spark-row">${sparkline(seriesSqs)}</div>
    </div>
    <div class="kpi"><div class="label">Gate au 1ᵉʳ passage</div><div class="value">${a.specs.total ? Math.round(a.specs.gateFirstPass / a.specs.total * 100) + '%' : '—'}</div></div>
    <div class="kpi ${a.drift.driftsDetectes === 0 ? 'ok' : 'warn'}">
      <div class="label">Drifts</div>
      <div class="value">${a.drift.driftsDetectes}</div>
      <div class="delta">${a.drift.driftsResolus} résolu(s)</div>
      <div class="spark-row">${sparkline(seriesDrift)}</div>
    </div>
  `;

  // (#349) Filename hyperlié vers la source. f.file capté par collect.js.
  const tableauCats = Object.values(cats).map((c) => {
    if (c.fichiers.length === 0) return '';
    const rows = c.fichiers.slice(0, 10).map((f) => `<tr>
      <td>${f.file ? lienSource(f.file, f.nom) : `<code>${escape(f.nom)}</code>`}</td>
      <td class="muted">${escape(new Date(f.mtime).toLocaleDateString('fr-FR'))}</td>
      <td>${formaterKv(f.data)}</td>
    </tr>`).join('');
    return `<section>
      <h2>${escape(c.categorie)} <span class="count">${c.fichiers.length} fichier(s) · ${escape(c.dir || '')}</span></h2>
      <table>
        <thead><tr><th>Fichier</th><th>Date</th><th>Métriques détectées</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
  }).filter(Boolean).join('');

  return `
${blocQueueQa(donnees)}
<section>
  <h2>DORA</h2>
  ${doraVide ? dora : `<div class="kpis">${dora}</div>`}
</section>
${blocLeadership(donnees)}
<section>
  <h2>Flow & Qualité</h2>
  ${flowVide ? flow : `<div class="kpis">${flow}</div>`}
</section>
${tableauCats}
`;
}

// `blocLeadership` est rendu par `lib/leadership-metrics.js` (#146 / #151)
// pour respecter la limite stricte LOC de ce fichier.

function formaterKv(data) {
  const e = Object.entries(data).slice(0, 6);
  return e.length === 0 ? '<em class="muted">—</em>' : e.map(([k, v]) => `<code>${escape(k)}: ${escape(String(v))}</code>`).join(' ');
}

// (#201) pageGovernance déplacée dans `./governance.js` pour rester sous la
// limite 850 LOC effectives — ré-exportée ici par compatibilité.
export { pageGovernance } from './governance.js';

export function pageDrifts(donnees) {
  const facts = donnees.facts;
  if (facts.length === 0) {
    return `<div class="empty">
      <strong>Aucun drift / fact capturé.</strong>
      <code>/sdd fact</code> capture les écarts livré ↔ désiré. <code>/sdd drift-check</code> détecte les divergences code ↔ SPEC. Si vous travaillez en SDD strict, l'absence de fact peut être saine — ou indiquer que le rituel n'est pas encore activé.
    </div>`;
  }
  // (#327) FACT ID hyperlié vers le fichier source.
  const rows = facts.map((f) => `<tr>
    <td>${f.file ? lienSource(f.file, f.id) : `<code>${escape(f.id)}</code>`}</td>
    <td>
      <div class="row-cluster">
        <strong>${escape(f.titre)}</strong>
      </div>
    </td>
    <td data-sort="${f.gravite === 'critical' ? '3' : f.gravite === 'major' ? '2' : '1'}">${badge(f.gravite || '—', f.gravite === 'critical' ? 'badge-bad' : f.gravite === 'major' ? 'badge-warn' : 'badge-muted')}</td>
    <td data-sort="${escape(f.statut)}">${statutBadge(f.statut)}</td>
    <td class="muted" data-sort="${escape(f.date || '')}">${escape(f.date || '—')}</td>
    <td class="muted" title="${escape(f.cause || '')}">${escape((f.cause || '').slice(0, 80))}${f.cause && f.cause.length > 80 ? '…' : ''}</td>
  </tr>`).join('');

  const parStatut = {};
  for (const f of facts) parStatut[f.statut] = (parStatut[f.statut] || 0) + 1;

  return `
<div class="kpis">
  <div class="kpi"><div class="label">Total facts</div><div class="value">${facts.length}</div></div>
  <div class="kpi ${(parStatut.open || 0) === 0 ? 'ok' : 'warn'}"><div class="label">Ouverts</div><div class="value">${parStatut.open || 0}</div></div>
  <div class="kpi"><div class="label">Résolus</div><div class="value">${(parStatut.closed || 0) + (parStatut.resolu || 0) + (parStatut['résolu'] || 0)}</div></div>
</div>

<section>
  <h2>Drifts & Facts capturés</h2>
  <div class="filter"><input type="search" id="qFacts" data-filter-target="tFacts" placeholder="Filtrer par titre, statut, cause…"/></div>
  <table id="tFacts" data-sortable="true">
    <thead><tr><th>ID</th><th>Titre</th><th>Gravité</th><th>Statut</th><th>Date</th><th>Cause</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
`;
}

export function pageChangelog(donnees) {
  if (donnees.changelog.entrees.length === 0) {
    return `<div class="empty">
      <strong>Aucune entrée dans le changelog des artefacts.</strong>
      Le fichier <code>.aiad/CHANGELOG-ARTEFACTS.md</code> trace les mises à jour significatives des artefacts SDD Mode. Il est rempli au fil de l'eau lors des commandes <code>/sdd</code> et <code>/aiad</code>.
    </div>`;
  }
  const rows = donnees.changelog.entrees.map((e) => `<tr>
    <td class="muted">${escape(e.date)}</td>
    <td><strong>${escape(e.artefact)}</strong></td>
    <td>${escape(e.type)}</td>
    <td class="muted">${escape(e.auteur || '—')}</td>
    <td>${escape((e.raison || '').slice(0, 120))}${e.raison && e.raison.length > 120 ? '…' : ''}</td>
    <td class="muted">${escape((e.impact || '').slice(0, 80))}${e.impact && e.impact.length > 80 ? '…' : ''}</td>
  </tr>`).join('');

  return `
<div class="kpis">
  <div class="kpi"><div class="label">Entrées</div><div class="value">${donnees.changelog.entrees.length}</div></div>
</div>
<section>
  <h2>Historique <span class="count">source : ${donnees.changelog.file ? lienSource(donnees.changelog.file) : '<code>—</code>'}</span></h2>
  <div class="filter"><input type="search" id="qCl" data-filter-target="tCl" placeholder="Filtrer par date, artefact, raison…"/></div>
  <table id="tCl" data-sortable="true">
    <thead><tr><th>Date</th><th>Artefact</th><th>Type</th><th>Auteur</th><th>Raison</th><th>Impact</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
`;
}


// ─── Génération ─────────────────────────────────────────────────────────────
