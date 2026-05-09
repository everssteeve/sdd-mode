// AIAD SDD Mode — Dashboard HTML
//
// Lit l'état d'un projet SDD Mode (.aiad/) et produit un dashboard HTML
// multi-pages dans le dossier `dashboard/`. Inspiré de la sortie de
// `sdd-trace.js` (qui ne couvre que la traçabilité), il agrège ici toutes les
// dimensions du projet : artefacts, cycle SDD, gouvernance Tier 1, métriques
// (DORA / flow / qualité), traçabilité Intent ↔ SPEC ↔ Code ↔ Tests, drifts
// & facts, changelog.
//
// Pages produites :
//   - index.html         Vue d'ensemble + maturité + actions
//   - intents.html       Catalogue des Intent Statements
//   - specs.html         Catalogue des SPECs
//   - traceability.html  Matrice Forward / Backward + gaps
//   - metrics.html       DORA + Flow + Qualité (lus depuis .aiad/metrics/)
//   - governance.html    Agents Tier 1 (AI-ACT / RGPD / RGAA / RGESN)
//   - drifts.html        Drifts détectés et facts capturés
//   - changelog.html     Historique des artefacts
//
// Les pages sont statiques, autonomes, sans dépendance externe — elles
// s'ouvrent directement dans un navigateur sans serveur.
//
// Documentation : https://aiad.ovh

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, basename, dirname, extname, resolve } from 'node:path';
import { createServer } from 'node:http';
import { construireMatrice } from './sdd-trace.js';

const C = {
  vert: '\x1b[32m',
  jaune: '\x1b[33m',
  rouge: '\x1b[31m',
  cyan: '\x1b[36m',
  gris: '\x1b[90m',
  gras: '\x1b[1m',
  reset: '\x1b[0m',
};

// ─── Helpers communs ─────────────────────────────────────────────────────────

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function lireFichier(chemin) {
  try { return readFileSync(chemin, 'utf-8'); } catch { return null; }
}

function listerFichiersMd(dir, opts = {}) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => opts.includeIndex || !f.startsWith('_'))
    .map((f) => join(dir, f));
}

function extraireChamp(contenu, nom) {
  if (!contenu) return null;
  // Reconnaît: "Champ : valeur", "**Champ** : valeur", "Champ: valeur"
  const re = new RegExp(`(?:^|\\n)\\s*\\*{0,2}\\s*${nom}\\s*\\*{0,2}\\s*:\\s*([^\\n]+)`, 'i');
  const m = contenu.match(re);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function extraireTitre(contenu) {
  if (!contenu) return null;
  const m = contenu.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function badge(valeur, classes = '') {
  return `<span class="badge ${classes}">${escape(valeur)}</span>`;
}

// Lien vers un fichier source — par défaut relatif au dossier dashboard/
// (donc ".." en préfixe pour remonter à la racine projet). Quand
// `_sourceBase` est défini (ex: GitHub Pages avec --source-base), on préfixe
// par cette URL absolue pour pointer vers le blob GitHub plutôt que vers un
// fichier local introuvable depuis le site publié.
let _sourceBase = '';
function setSourceBase(base) {
  _sourceBase = base ? (base.endsWith('/') ? base : base + '/') : '';
}
function lienSource(file) {
  if (!file) return '';
  const href = _sourceBase ? `${_sourceBase}${escape(file)}` : `../${escape(file)}`;
  return `<a class="src-link" href="${href}" target="_blank" rel="noopener" title="Ouvrir ${escape(file)}">${escape(file)}</a>`;
}

// Mini-distribution barrée (statuts SPEC/Intent par catégorie).
function distributionBar(parts) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return '<div class="dist-bar empty"></div>';
  const segs = parts
    .filter((p) => p.value > 0)
    .map((p) => `<span class="dist-seg ${p.cls}" style="width:${(p.value / total) * 100}%" title="${escape(p.label)} : ${p.value}">${p.value > total / 8 ? p.value : ''}</span>`)
    .join('');
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

function statutBadge(statut) {
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

function sqsBadge(valeur) {
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

// ─── Lecture des artefacts ──────────────────────────────────────────────────

function lireProjet(racineProjet) {
  const pkg = lireFichier(join(racineProjet, 'package.json'));
  let nom = basename(racineProjet);
  let version = null;
  if (pkg) {
    try {
      const o = JSON.parse(pkg);
      if (o.name) nom = o.name;
      if (o.version) version = o.version;
    } catch { /* ignore */ }
  }
  return {
    nom,
    version,
    racine: racineProjet,
    genere: new Date().toISOString(),
  };
}

function lireFondamentaux(racineProjet) {
  const fichiers = ['PRD.md', 'ARCHITECTURE.md', 'AGENT-GUIDE.md'];
  const sentinelles = {
    'PRD.md': '[Titre fonctionnel court]',
    'ARCHITECTURE.md': '[max 5 principes]',
    'AGENT-GUIDE.md': '[Nom du projet]',
  };
  return fichiers.map((nom) => {
    const chemin = join(racineProjet, '.aiad', nom);
    const contenu = lireFichier(chemin);
    const present = contenu !== null;
    const sentinelle = sentinelles[nom];
    const rempli = present && sentinelle ? !contenu.includes(sentinelle) : present;
    return {
      nom,
      chemin: present ? relative(racineProjet, chemin) : null,
      titre: present ? extraireTitre(contenu) : null,
      present,
      rempli,
      tailleKo: present ? Math.round(Buffer.byteLength(contenu) / 1024 * 10) / 10 : 0,
    };
  });
}

function lireIntents(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'intents');
  const fichiers = listerFichiersMd(dir);
  return fichiers.map((chemin) => {
    const contenu = lireFichier(chemin);
    const m = basename(chemin).match(/^(INTENT-[A-Za-z0-9-]+)\.md$/);
    return {
      id: m ? m[1] : basename(chemin, '.md'),
      file: relative(racineProjet, chemin),
      titre: extraireTitre(contenu) || (m ? m[1] : basename(chemin)),
      statut: (extraireChamp(contenu, 'status') || extraireChamp(contenu, 'statut') || 'unknown').toLowerCase(),
      auteur: extraireChamp(contenu, 'auteur') || extraireChamp(contenu, 'author'),
      date: extraireChamp(contenu, 'date'),
      problem: extraireChamp(contenu, 'Problem') || extraireChamp(contenu, 'Problème'),
    };
  });
}

function lireSpecs(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'specs');
  const fichiers = listerFichiersMd(dir).filter((c) => !basename(c).startsWith('spec-ears-template'));
  return fichiers.map((chemin) => {
    const contenu = lireFichier(chemin);
    const m = basename(chemin).match(/^(SPEC-[A-Za-z0-9-]+)\.md$/);
    return {
      id: m ? m[1] : basename(chemin, '.md'),
      file: relative(racineProjet, chemin),
      titre: extraireTitre(contenu) || (m ? m[1] : basename(chemin)),
      parentIntent: extraireChamp(contenu, 'Intent parent') || extraireChamp(contenu, 'parent'),
      statut: (extraireChamp(contenu, 'Statut') || extraireChamp(contenu, 'status') || 'unknown').toLowerCase(),
      format: (extraireChamp(contenu, 'Format') || 'prose').toLowerCase(),
      sqs: extraireChamp(contenu, 'SQS'),
      auteur: extraireChamp(contenu, 'Auteur') || extraireChamp(contenu, 'author'),
      date: extraireChamp(contenu, 'Date') || extraireChamp(contenu, 'date'),
    };
  });
}

function lireGouvernance(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'gouvernance');
  const fichiers = listerFichiersMd(dir);
  const attendus = ['AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN'];
  const presents = new Set(fichiers.map((c) => basename(c, '.md')));
  return attendus.map((id) => {
    const chemin = join(dir, `${id}.md`);
    const contenu = lireFichier(chemin);
    return {
      id,
      present: presents.has(id),
      titre: extraireTitre(contenu) || id,
      file: presents.has(id) ? relative(racineProjet, chemin) : null,
      tailleKo: contenu ? Math.round(Buffer.byteLength(contenu) / 1024 * 10) / 10 : 0,
      declenche: declencheurGouvernance(id),
      referentiel: referentielGouvernance(id),
    };
  });
}

function declencheurGouvernance(id) {
  return {
    'AIAD-AI-ACT': 'Composant IA (ML, LLM, scoring, recommandation)',
    'AIAD-RGPD': 'Traitement de données personnelles',
    'AIAD-RGAA': 'Production d\'une interface utilisateur',
    'AIAD-RGESN': 'Toute décision technique (perf, ressources, dépendances)',
  }[id] || '—';
}

function referentielGouvernance(id) {
  return {
    'AIAD-AI-ACT': 'Règlement (UE) 2024/1689 — EU AI Act',
    'AIAD-RGPD': 'RGPD (UE) 2016/679',
    'AIAD-RGAA': 'RGAA 4.1 / WCAG 2.1',
    'AIAD-RGESN': 'RGESN v2 — Référentiel Général Écoconception',
  }[id] || '—';
}

function lireFacts(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'facts');
  if (!existsSync(dir)) return [];
  const fichiers = listerFichiersMd(dir, { includeIndex: false });
  return fichiers.map((chemin) => {
    const contenu = lireFichier(chemin);
    return {
      id: basename(chemin, '.md'),
      file: relative(racineProjet, chemin),
      titre: extraireTitre(contenu) || basename(chemin),
      date: extraireChamp(contenu, 'Date') || extraireChamp(contenu, 'date'),
      gravite: extraireChamp(contenu, 'Gravité') || extraireChamp(contenu, 'severity') || extraireChamp(contenu, 'gravite'),
      statut: (extraireChamp(contenu, 'Statut') || extraireChamp(contenu, 'status') || 'open').toLowerCase(),
      cause: extraireChamp(contenu, 'Cause') || extraireChamp(contenu, 'cause'),
    };
  });
}

function lireChangelog(racineProjet) {
  const chemin = join(racineProjet, '.aiad', 'CHANGELOG-ARTEFACTS.md');
  const contenu = lireFichier(chemin);
  if (!contenu) return { entrees: [], file: null };
  // Entrées au format : "## [Date] — [Artefact] — [Type]"
  const entrees = [];
  const re = /^##\s+(\d{4}-\d{2}-\d{2})\s*—\s*([^—\n]+?)\s*—\s*([^\n]+)$/gm;
  let m;
  while ((m = re.exec(contenu)) !== null) {
    const start = m.index + m[0].length;
    const next = re.lastIndex;
    // Cherche le prochain titre H2
    const reste = contenu.slice(start);
    const m2 = reste.match(/\n##\s+/);
    const fin = m2 ? start + m2.index : contenu.length;
    const corps = contenu.slice(start, fin).trim();
    entrees.push({
      date: m[1],
      artefact: m[2].trim(),
      type: m[3].trim(),
      auteur: extraireChamp(corps, 'Auteur'),
      raison: extraireChamp(corps, 'Raison'),
      impact: extraireChamp(corps, 'Impact'),
    });
  }
  return { entrees, file: relative(racineProjet, chemin) };
}

// ─── Lecture des metrics ─────────────────────────────────────────────────────
//
// Les fichiers de metrics sont des Markdown ou YAML produits par les
// commandes /aiad et /sdd. On extrait toutes les paires "key: value" présentes
// pour rester tolérant à la diversité des formats.

function parserKv(contenu) {
  if (!contenu) return {};
  const out = {};
  const lignes = contenu.split('\n');
  for (const ligne of lignes) {
    const m = ligne.match(/^\s*-?\s*(?:\*\*)?([A-Za-z][\w-]*)(?:\*\*)?\s*:\s*([^\n#]+?)\s*$/);
    if (!m) continue;
    const cle = m[1].trim();
    let val = m[2].trim().replace(/^["']|["']$/g, '');
    if (/^-?\d+(?:\.\d+)?$/.test(val)) val = Number(val);
    if (val === 'true') val = true;
    if (val === 'false') val = false;
    out[cle] = val;
  }
  return out;
}

function lireMetricsCategorie(racineProjet, categorie) {
  const dir = join(racineProjet, '.aiad', 'metrics', categorie);
  if (!existsSync(dir)) return { categorie, dir: null, fichiers: [] };
  const fichiers = [];
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    let st;
    try { st = statSync(chemin); } catch { continue; }
    if (!st.isFile()) continue;
    if (!/\.(md|yml|yaml|json)$/i.test(nom)) continue;
    if (nom.startsWith('_')) continue;
    const contenu = lireFichier(chemin);
    let data;
    if (nom.endsWith('.json')) {
      try { data = JSON.parse(contenu || '{}'); } catch { data = {}; }
    } else {
      data = parserKv(contenu);
    }
    fichiers.push({
      nom,
      file: relative(racineProjet, chemin),
      mtime: st.mtimeMs,
      data,
    });
  }
  fichiers.sort((a, b) => b.mtime - a.mtime);
  return { categorie, dir: relative(racineProjet, dir), fichiers };
}

function moyenne(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}

function lireMetrics(racineProjet) {
  const cats = ['deployments', 'specs', 'standup', 'drift', 'retro', 'demo', 'sync-strat', 'tech-review', 'security', 'audit'];
  const data = {};
  for (const c of cats) data[c] = lireMetricsCategorie(racineProjet, c);

  // Agrégats de haut niveau pour la page d'accueil
  const deps = data.deployments.fichiers.map((f) => f.data);
  const specs = data.specs.fichiers.map((f) => f.data);
  const standup = data.standup.fichiers.map((f) => f.data);
  const drift = data.drift.fichiers.map((f) => f.data);

  const cycleTimes = deps.map((d) => Number(d.cycle_time_days)).filter((x) => !isNaN(x));
  const leadTimes = deps.map((d) => Number(d.lead_time_days)).filter((x) => !isNaN(x));
  const sqsScores = specs.map((d) => Number(d.sqs_score)).filter((x) => !isNaN(x));
  const wips = standup.map((d) => Number(d.wip)).filter((x) => !isNaN(x));
  const driftCount = drift.reduce((s, d) => s + (Number(d.drifts_count) || 0), 0);
  const driftRes = drift.reduce((s, d) => s + (Number(d.drifts_corriges) || 0), 0);

  const agregats = {
    deployments: {
      total: deps.length,
      success: deps.filter((d) => d.status === 'success').length,
      hotfix: deps.filter((d) => d.status === 'hotfix').length,
      cycleTimeMoyen: moyenne(cycleTimes),
      leadTimeMoyen: moyenne(leadTimes),
    },
    specs: {
      total: specs.length,
      sqsMoyen: moyenne(sqsScores),
      gateFirstPass: specs.filter((d) => Number(d.attempts) === 1).length,
    },
    standup: {
      total: standup.length,
      wipMoyen: moyenne(wips),
    },
    drift: {
      total: drift.length,
      driftsDetectes: driftCount,
      driftsResolus: driftRes,
    },
  };

  return { categories: data, agregats };
}

// ─── Maturité ────────────────────────────────────────────────────────────────

function calculerMaturite(donnees) {
  const fond = donnees.fondamentaux;
  const score = [
    fond.find((f) => f.nom === 'PRD.md')?.rempli,
    fond.find((f) => f.nom === 'ARCHITECTURE.md')?.rempli,
    fond.find((f) => f.nom === 'AGENT-GUIDE.md')?.rempli,
    donnees.intents.length > 0,
    donnees.specs.length > 0,
  ].filter(Boolean).length;

  const niveaux = [
    { label: 'Non initialisé', cls: 'maturite-bad' },
    { label: 'Démarrage', cls: 'maturite-warn' },
    { label: 'Cadrage', cls: 'maturite-warn' },
    { label: 'Opérationnel', cls: 'maturite-info' },
    { label: 'Actif', cls: 'maturite-ok' },
    { label: 'Complet', cls: 'maturite-ok' },
  ];
  return { score, total: 5, ...niveaux[score] };
}

// ─── Construction du modèle complet ─────────────────────────────────────────

export function collecterDonnees(racineProjet) {
  const projet = lireProjet(racineProjet);
  const fondamentaux = lireFondamentaux(racineProjet);
  const intents = lireIntents(racineProjet);
  const specs = lireSpecs(racineProjet);
  const gouvernance = lireGouvernance(racineProjet);
  const facts = lireFacts(racineProjet);
  const changelog = lireChangelog(racineProjet);
  const metrics = lireMetrics(racineProjet);
  const matrice = construireMatrice(racineProjet);

  const donnees = {
    projet,
    fondamentaux,
    intents,
    specs,
    gouvernance,
    facts,
    changelog,
    metrics,
    matrice,
  };
  donnees.maturite = calculerMaturite(donnees);

  // Indices utiles
  const specsParIntent = new Map();
  for (const s of specs) {
    if (!s.parentIntent) continue;
    if (!specsParIntent.has(s.parentIntent)) specsParIntent.set(s.parentIntent, []);
    specsParIntent.get(s.parentIntent).push(s);
  }
  donnees.specsParIntent = specsParIntent;

  return donnees;
}

// ─── CSS partagée ───────────────────────────────────────────────────────────

const CSS = `:root {
  color-scheme: light dark;
  --bg: #f7f8fa;
  --bg-alt: #ffffff;
  --bg-nav: #0f172a;
  --bg-nav-active: #1e293b;
  --fg: #0f172a;
  --fg-muted: #64748b;
  --fg-nav: #cbd5e1;
  --fg-nav-active: #f8fafc;
  --border: #e2e8f0;
  --accent: #2563eb;
  --ok-bg: #dcfce7;
  --ok-fg: #166534;
  --warn-bg: #fef3c7;
  --warn-fg: #92400e;
  --bad-bg: #fee2e2;
  --bad-fg: #991b1b;
  --info-bg: #dbeafe;
  --info-fg: #1e40af;
  --muted-bg: #e2e8f0;
  --muted-fg: #475569;
  --code-bg: #f1f5f9;
}
/* Dark vars : appliquées soit via le réglage OS, soit via toggle manuel
   (html[data-theme="dark"]). Le toggle manuel l'emporte toujours. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0b1020;
    --bg-alt: #111827;
    --bg-nav: #0a0f1d;
    --bg-nav-active: #1f2937;
    --fg: #f1f5f9;
    --fg-muted: #94a3b8;
    --fg-nav: #cbd5e1;
    --fg-nav-active: #ffffff;
    --border: #1f2937;
    --accent: #60a5fa;
    --ok-bg: #14532d;
    --ok-fg: #bbf7d0;
    --warn-bg: #78350f;
    --warn-fg: #fde68a;
    --bad-bg: #7f1d1d;
    --bad-fg: #fecaca;
    --info-bg: #1e3a8a;
    --info-fg: #bfdbfe;
    --muted-bg: #1f2937;
    --muted-fg: #cbd5e1;
    --code-bg: #1f2937;
  }
}
:root[data-theme="dark"] {
  --bg: #0b1020;
  --bg-alt: #111827;
  --bg-nav: #0a0f1d;
  --bg-nav-active: #1f2937;
  --fg: #f1f5f9;
  --fg-muted: #94a3b8;
  --fg-nav: #cbd5e1;
  --fg-nav-active: #ffffff;
  --border: #1f2937;
  --accent: #60a5fa;
  --ok-bg: #14532d;
  --ok-fg: #bbf7d0;
  --warn-bg: #78350f;
  --warn-fg: #fde68a;
  --bad-bg: #7f1d1d;
  --bad-fg: #fecaca;
  --info-bg: #1e3a8a;
  --info-fg: #bfdbfe;
  --muted-bg: #1f2937;
  --muted-fg: #cbd5e1;
  --code-bg: #1f2937;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.5;
  font-size: 14px;
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}
nav.side {
  background: var(--bg-nav);
  color: var(--fg-nav);
  padding: 1.5rem 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
nav.side .brand {
  padding: 0 1.25rem 1.25rem;
  border-bottom: 1px solid rgba(255,255,255,.08);
  margin-bottom: 1rem;
}
nav.side .brand-title {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--fg-nav-active);
  letter-spacing: -.01em;
}
nav.side .brand-sub {
  font-size: .8rem;
  color: var(--fg-nav);
  opacity: .7;
  margin-top: .25rem;
}
nav.side .brand-version {
  display: inline-block;
  margin-top: .35rem;
  padding: .1rem .45rem;
  background: rgba(255,255,255,.08);
  border-radius: 4px;
  font-size: .7rem;
  font-family: ui-monospace, monospace;
}
nav.side ul { list-style: none; padding: 0; margin: 0; }
nav.side li { margin: 0; }
nav.side a {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: .55rem 1.25rem;
  color: var(--fg-nav);
  text-decoration: none;
  border-left: 3px solid transparent;
  font-size: .9rem;
}
nav.side a:hover { background: var(--bg-nav-active); color: var(--fg-nav-active); }
nav.side a.active {
  background: var(--bg-nav-active);
  color: var(--fg-nav-active);
  border-left-color: var(--accent);
  font-weight: 600;
}
nav.side .nav-icon {
  width: 1.1rem;
  text-align: center;
  font-size: 1rem;
  opacity: .85;
}
nav.side .footer {
  margin-top: 2rem;
  padding: 1rem 1.25rem;
  font-size: .75rem;
  color: var(--fg-nav);
  opacity: .5;
  border-top: 1px solid rgba(255,255,255,.08);
}
main {
  padding: 2rem 2.5rem 4rem;
  max-width: 1280px;
}
header.page-header {
  margin-bottom: 1.75rem;
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
  flex-wrap: wrap;
}
header.page-header h1 {
  margin: 0 0 .25rem;
  font-size: 1.75rem;
  letter-spacing: -.02em;
}
header.page-header .subtitle {
  color: var(--fg-muted);
  font-size: .95rem;
}
header.page-header .meta {
  font-size: .8rem;
  color: var(--fg-muted);
}
header.page-header .header-right {
  display: flex;
  align-items: center;
  gap: .75rem;
}
.toggle-theme {
  background: var(--bg-alt);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: .4rem .65rem;
  cursor: pointer;
  font-size: .85rem;
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  transition: background .15s, border-color .15s;
}
.toggle-theme:hover { background: var(--bg); border-color: var(--accent); }
.toggle-theme .icon { font-size: 1rem; line-height: 1; }
:root[data-theme="dark"] .toggle-theme .icon-dark { display: none; }
:root[data-theme="dark"] .toggle-theme .icon-light { display: inline; }
:root:not([data-theme="dark"]) .toggle-theme .icon-light { display: none; }
:root:not([data-theme="dark"]) .toggle-theme .icon-dark { display: inline; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) .toggle-theme .icon-dark { display: none; }
  :root:not([data-theme]) .toggle-theme .icon-light { display: inline; }
}
section { margin-bottom: 2.5rem; }
section h2 {
  font-size: 1.1rem;
  margin: 0 0 .75rem;
  letter-spacing: -.01em;
  display: flex;
  align-items: center;
  gap: .5rem;
}
section h2 .count {
  font-weight: 400;
  color: var(--fg-muted);
  font-size: .9rem;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: .85rem;
  margin-bottom: 1.5rem;
}
.kpi {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem 1.1rem;
}
.kpi .label {
  font-size: .75rem;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: .05em;
  margin-bottom: .35rem;
}
.kpi .value {
  font-size: 1.65rem;
  font-weight: 700;
  letter-spacing: -.02em;
  line-height: 1.1;
}
.kpi .value.small { font-size: 1.15rem; }
.kpi .delta {
  font-size: .75rem;
  margin-top: .25rem;
  color: var(--fg-muted);
}
.kpi.ok .value { color: var(--ok-fg); }
.kpi.warn .value { color: var(--warn-fg); }
.kpi.bad .value { color: var(--bad-fg); }
.card {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}
.card h3 { margin: 0 0 .5rem; font-size: 1rem; }
.card p { margin: .25rem 0; }
.muted { color: var(--fg-muted); }
table {
  border-collapse: collapse;
  width: 100%;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  font-size: .88rem;
}
th, td {
  padding: .65rem .8rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}
th {
  background: var(--bg);
  font-weight: 600;
  font-size: .78rem;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--fg-muted);
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--bg); }
code {
  background: var(--code-bg);
  padding: .1rem .35rem;
  border-radius: 3px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: .85em;
}
.badge {
  display: inline-block;
  padding: .15rem .5rem;
  border-radius: 4px;
  font-size: .75rem;
  font-weight: 600;
  background: var(--muted-bg);
  color: var(--muted-fg);
  white-space: nowrap;
}
.badge-ok { background: var(--ok-bg); color: var(--ok-fg); }
.badge-warn { background: var(--warn-bg); color: var(--warn-fg); }
.badge-bad { background: var(--bad-bg); color: var(--bad-fg); }
.badge-info { background: var(--info-bg); color: var(--info-fg); }
.badge-muted { background: var(--muted-bg); color: var(--muted-fg); }
.maturite {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
}
.maturite .barre {
  flex: 1;
  height: 10px;
  background: var(--muted-bg);
  border-radius: 4px;
  overflow: hidden;
}
.maturite .barre .fill {
  height: 100%;
  background: var(--accent);
  transition: width .4s;
}
.maturite-ok .fill { background: #16a34a; }
.maturite-info .fill { background: #2563eb; }
.maturite-warn .fill { background: #ea580c; }
.maturite-bad .fill { background: #dc2626; }
.maturite .label { font-weight: 600; min-width: 8rem; }
.maturite .score { color: var(--fg-muted); font-size: .9rem; }
.filter {
  margin: 0 0 .75rem;
}
.filter input {
  padding: .5rem .75rem;
  width: 100%;
  max-width: 360px;
  background: var(--bg-alt);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: .9rem;
}
.empty {
  background: var(--bg-alt);
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  color: var(--fg-muted);
  font-size: .95rem;
}
.empty strong { display: block; color: var(--fg); margin-bottom: .25rem; font-size: 1rem; }
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin-top: .5rem;
}
.actions a, .actions code {
  background: var(--code-bg);
  color: var(--fg);
  padding: .35rem .6rem;
  border-radius: 5px;
  text-decoration: none;
  font-size: .8rem;
  border: 1px solid var(--border);
}
.actions a:hover { background: var(--accent); color: white; border-color: var(--accent); }
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 1100px) {
  body { grid-template-columns: 1fr; }
  nav.side {
    position: sticky;
    top: 0;
    z-index: 50;
    height: auto;
    padding: .5rem 1rem;
    display: flex;
    align-items: center;
    gap: .5rem;
    overflow-x: auto;
  }
  nav.side .brand { padding: 0 .5rem 0 0; border: none; margin: 0; flex-shrink: 0; }
  nav.side .brand-sub, nav.side .brand-version { display: none; }
  nav.side ul { display: flex; gap: .25rem; flex: 1; min-width: 0; }
  nav.side a { padding: .4rem .65rem; border-left: none; border-bottom: 3px solid transparent; border-radius: 4px; white-space: nowrap; font-size: .85rem; }
  nav.side a.active { border-left: none; border-bottom-color: var(--accent); background: var(--bg-nav-active); }
  nav.side .footer { display: none; }
  main { padding: 1.5rem 1rem 3rem; }
  .split { grid-template-columns: 1fr; }
  header.page-header h1 { font-size: 1.4rem; }
}
/* Mobile : KPIs sur 2 colonnes, tables avec scroll horizontal,
   cellules plus serrées, badges plus petits */
@media (max-width: 640px) {
  body { font-size: 13px; }
  main { padding: 1rem .75rem 2rem; }
  .kpis { grid-template-columns: repeat(2, 1fr); gap: .5rem; }
  .kpi { padding: .75rem .85rem; }
  .kpi .value { font-size: 1.3rem; }
  .kpi .value.small { font-size: 1rem; }
  table { font-size: .8rem; }
  th, td { padding: .5rem .55rem; }
  .alertes-list { grid-template-columns: 1fr; }
  /* tables wrappées dans un conteneur scrollable */
  section table { display: block; overflow-x: auto; }
  header.page-header { flex-direction: column; align-items: flex-start; gap: .35rem; }
  .toggle-theme { padding: .35rem .5rem; }
}
.row-cluster { display: flex; flex-direction: column; gap: .15rem; }
.row-cluster small { color: var(--fg-muted); font-size: .8rem; }
ul.compact { padding-left: 1.1rem; margin: .25rem 0; }
ul.compact li { margin: .15rem 0; }
.matrix-tab table { font-size: .82rem; }
hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }

/* Source links */
.src-link {
  font-size: .75rem;
  color: var(--fg-muted);
  text-decoration: none;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  border-bottom: 1px dotted transparent;
  transition: color .15s, border-color .15s;
}
.src-link::before { content: "↗ "; opacity: .6; }
.src-link:hover { color: var(--accent); border-bottom-color: var(--accent); }

/* Alertes (page index) */
.alertes {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--ok-bg);
  color: var(--ok-fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem 1.25rem;
}
.alertes .alertes-icon { font-size: 1.5rem; }
.alertes-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: .75rem;
}
.alerte {
  display: block;
  text-decoration: none;
  border: 1px solid var(--border);
  border-left: 4px solid var(--muted-fg);
  border-radius: 6px;
  padding: .85rem 1rem;
  background: var(--bg-alt);
  color: var(--fg);
  transition: transform .12s, box-shadow .12s;
}
.alerte:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.06); }
.alerte-warn { border-left-color: #ea580c; }
.alerte-bad { border-left-color: #dc2626; }
.alerte-titre { font-weight: 600; font-size: .95rem; margin-bottom: .15rem; }
.alerte-detail { color: var(--fg-muted); font-size: .85rem; margin-bottom: .35rem; }
.alerte-action { color: var(--accent); font-size: .8rem; }

/* Distribution bar (statuts) */
.dist-bar {
  display: flex;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--muted-bg);
  margin-bottom: .75rem;
}
.dist-bar.empty { opacity: .3; }
.dist-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: .8rem;
  transition: filter .15s;
  min-width: 1px;
}
.dist-seg:hover { filter: brightness(1.1); }
.seg-ok { background: #16a34a; }
.seg-info { background: #2563eb; }
.seg-warn { background: #ea580c; }
.seg-bad { background: #dc2626; }
.seg-muted { background: #94a3b8; }
.dist-leg {
  display: flex;
  flex-wrap: wrap;
  gap: .85rem;
  font-size: .8rem;
  color: var(--fg-muted);
}
.dist-leg-item { display: inline-flex; align-items: center; gap: .35rem; }
.dist-leg-item strong { color: var(--fg); margin-left: .15rem; }
.dist-leg-dot {
  width: .65rem;
  height: .65rem;
  border-radius: 2px;
  display: inline-block;
}

/* Sparklines */
.kpi .spark-row { margin-top: .35rem; color: var(--accent); opacity: .85; }
svg.spark { display: block; max-width: 100%; height: 28px; }

/* Sortable tables */
table[data-sortable="true"] th {
  cursor: pointer;
  user-select: none;
  position: relative;
}
table[data-sortable="true"] th:hover { color: var(--fg); }
table[data-sortable="true"] th::after {
  content: " ⇅";
  font-size: .7rem;
  opacity: .35;
}
table[data-sortable="true"] th.sort-asc::after { content: " ↑"; opacity: 1; color: var(--accent); }
table[data-sortable="true"] th.sort-desc::after { content: " ↓"; opacity: 1; color: var(--accent); }

/* Rowspan (matrice forward) */
td.rowspan {
  background: var(--bg);
  font-weight: 600;
  border-right: 2px solid var(--border);
  vertical-align: top;
}

/* Impression : nav cachée, couleurs claires forcées, pleine largeur */
@media print {
  body { display: block; background: white; color: black; font-size: 11px; }
  nav.side { display: none; }
  main { padding: 0; max-width: none; }
  .kpi, .card, table { box-shadow: none; page-break-inside: avoid; }
  .alerte { page-break-inside: avoid; }
  .filter, .actions { display: none; }
  a { color: black; text-decoration: none; }
  .src-link { display: none; }
}

/* Focus visible (a11y) */
a:focus-visible, input:focus-visible, button:focus-visible, th:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
`;

const APP_JS = `function bindFilter(inputId, tableId) {
  var input = document.getElementById(inputId);
  var table = document.getElementById(tableId);
  if (!input || !table) return;
  input.addEventListener('input', function () {
    var q = input.value.toLowerCase();
    var rows = table.tBodies[0].rows;
    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i];
      tr.style.display = tr.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
    }
  });
}

// Tri par colonne — déclenché au clic sur un th, alterne asc/desc.
// Lit data-sort sur les td quand présent (utilisé pour les badges /
// dates / nombres avec mise en forme HTML), sinon textContent.
function bindSortable(table) {
  var ths = table.tHead ? table.tHead.rows[0].cells : [];
  for (var i = 0; i < ths.length; i++) {
    (function (col) {
      ths[col].addEventListener('click', function () {
        var asc = !ths[col].classList.contains('sort-asc');
        for (var j = 0; j < ths.length; j++) ths[j].classList.remove('sort-asc', 'sort-desc');
        ths[col].classList.add(asc ? 'sort-asc' : 'sort-desc');
        var rows = Array.prototype.slice.call(table.tBodies[0].rows);
        rows.sort(function (a, b) {
          var ca = a.cells[col], cb = b.cells[col];
          var va = ca && ca.dataset.sort != null ? ca.dataset.sort : (ca ? ca.textContent : '');
          var vb = cb && cb.dataset.sort != null ? cb.dataset.sort : (cb ? cb.textContent : '');
          var na = parseFloat(va), nb = parseFloat(vb);
          var cmp;
          if (!isNaN(na) && !isNaN(nb) && va.trim() !== '' && vb.trim() !== '') cmp = na - nb;
          else cmp = va.trim().localeCompare(vb.trim(), 'fr', { numeric: true });
          return asc ? cmp : -cmp;
        });
        var tbody = table.tBodies[0];
        rows.forEach(function (r) { tbody.appendChild(r); });
      });
    })(i);
  }
}

// Toggle dark/light : alterne data-theme, persiste dans localStorage.
function bindThemeToggle() {
  var btn = document.getElementById('toggleTheme');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme');
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Si pas de choix manuel : on bascule par rapport au système
    var next;
    if (current === 'dark') next = 'light';
    else if (current === 'light') next = 'dark';
    else next = systemDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('aiad-dashboard-theme', next); } catch (e) {}
  });
}

document.addEventListener('DOMContentLoaded', function () {
  var inputs = document.querySelectorAll('[data-filter-target]');
  inputs.forEach(function (inp) {
    bindFilter(inp.id, inp.getAttribute('data-filter-target'));
  });
  var sortables = document.querySelectorAll('table[data-sortable="true"]');
  sortables.forEach(bindSortable);
  bindThemeToggle();
});
`;

// ─── Layout commun ───────────────────────────────────────────────────────────

const PAGES = [
  { slug: 'index', titre: 'Vue d\'ensemble', icone: '◐', file: 'index.html' },
  { slug: 'intents', titre: 'Intents', icone: '◇', file: 'intents.html' },
  { slug: 'specs', titre: 'SPECs', icone: '◆', file: 'specs.html' },
  { slug: 'traceability', titre: 'Traçabilité', icone: '⇄', file: 'traceability.html' },
  { slug: 'metrics', titre: 'Métriques', icone: '⊞', file: 'metrics.html' },
  { slug: 'governance', titre: 'Gouvernance', icone: '⚖', file: 'governance.html' },
  { slug: 'drifts', titre: 'Drifts & Facts', icone: '⚠', file: 'drifts.html' },
  { slug: 'changelog', titre: 'Changelog', icone: '⏱', file: 'changelog.html' },
];

function layout({ slug, titre, sous, donnees, body }) {
  const projet = donnees.projet;
  const itemsNav = PAGES.map((p) => `
    <li><a href="${p.file}" class="${p.slug === slug ? 'active' : ''}">
      <span class="nav-icon">${p.icone}</span>${escape(p.titre)}
    </a></li>`).join('');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escape(titre)} — ${escape(projet.nom)}</title>
<link rel="stylesheet" href="assets/style.css"/>
<script>
  // Applique le thème enregistré avant le rendu pour éviter le flash.
  (function () {
    try {
      var t = localStorage.getItem('aiad-dashboard-theme');
      if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    } catch (e) {}
  })();
</script>
</head>
<body>
<nav class="side">
  <div class="brand">
    <div class="brand-title">${escape(projet.nom)}</div>
    <div class="brand-sub">SDD Mode · Dashboard</div>
    ${projet.version ? `<div class="brand-version">v${escape(projet.version)}</div>` : ''}
  </div>
  <ul>${itemsNav}</ul>
  <div class="footer">Généré ${escape(new Date(projet.genere).toLocaleString('fr-FR'))}<br/>Framework AIAD · aiad.ovh</div>
</nav>
<main>
  <header class="page-header">
    <div>
      <h1>${escape(titre)}</h1>
      ${sous ? `<div class="subtitle">${sous}</div>` : ''}
    </div>
    <div class="header-right">
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

function listerAlertes(donnees) {
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
  return alertes;
}

function pageOverview(donnees) {
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

  const recentSpecs = donnees.specs.slice(0, 5).map((s) => `
    <tr>
      <td><code>${escape(s.id)}</code></td>
      <td>${escape(s.titre)}</td>
      <td>${statutBadge(s.statut)}</td>
      <td>${sqsBadge(s.sqs)}</td>
    </tr>`).join('');

  const matKpiCls = m.score >= 4 ? 'ok' : m.score >= 2 ? 'warn' : 'bad';
  const gapsKpiCls = totalGaps === 0 ? 'ok' : totalGaps <= 5 ? 'warn' : 'bad';

  const blocAlertes = alertes.length === 0
    ? `<div class="alertes ok"><span class="alertes-icon">✓</span><div><strong>Aucune alerte</strong><div class="muted">Le projet ne remonte aucun signal d'attention.</div></div></div>`
    : `<div class="alertes-list">
        ${alertes.map((a) => `<a href="${a.cible}" class="alerte alerte-${a.gravite}">
          <div class="alerte-titre">${escape(a.titre)}</div>
          <div class="alerte-detail">${escape(a.detail)}</div>
          <div class="alerte-action">→ ${escape(a.action)}</div>
        </a>`).join('')}
      </div>`;

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
</div>

<section>
  <h2>Maturité du projet</h2>
  <div class="maturite ${m.cls}">
    <div class="label">${escape(m.label)}</div>
    <div class="barre"><div class="fill" style="width:${(m.score / m.total) * 100}%"></div></div>
    <div class="score">${m.score} / ${m.total}</div>
  </div>
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

function pageIntents(donnees) {
  if (donnees.intents.length === 0) {
    return `<div class="empty">
      <strong>Aucun Intent Statement.</strong>
      Le cycle SDD commence par un Intent : lance <code>/sdd intent</code> dans Claude Code pour capturer le POURQUOI d'une nouvelle fonctionnalité.
    </div>`;
  }
  const rows = donnees.intents.map((i) => {
    const specsLies = donnees.specsParIntent.get(i.id) || [];
    const specsCell = specsLies.length
      ? specsLies.map((s) => `<code>${escape(s.id)}</code>`).join(' ')
      : '<em class="muted">aucune</em>';
    return `<tr>
      <td><code>${escape(i.id)}</code></td>
      <td>
        <div class="row-cluster">
          <strong>${escape(i.titre)}</strong>
          ${lienSource(i.file)}
        </div>
      </td>
      <td data-sort="${escape(i.statut)}">${statutBadge(i.statut)}</td>
      <td>${specsCell}</td>
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
<div class="kpis">${kpis}</div>

<section>
  <h2>Répartition par statut</h2>
  <div class="card">${distributionBar(distParts)}</div>
</section>

<section>
  <h2>Catalogue <span class="count">${donnees.intents.length} intent(s)</span></h2>
  <div class="filter"><input type="search" id="qIntents" data-filter-target="tIntents" placeholder="Filtrer par ID, titre, statut, auteur…"/></div>
  <table id="tIntents" data-sortable="true">
    <thead><tr><th>ID</th><th>Titre</th><th>Statut</th><th>SPECs liées</th><th>Auteur</th><th>Date</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
`;
}

function pageSpecs(donnees) {
  if (donnees.specs.length === 0) {
    return `<div class="empty">
      <strong>Aucune SPEC.</strong>
      Une fois un Intent capturé, lance <code>/sdd spec</code> (ou <code>/sdd spec --ears</code> pour la variante stricte) pour produire la spécification technique.
    </div>`;
  }
  const rows = donnees.specs.map((s) => {
    const sqsNum = Number(s.sqs);
    return `<tr>
    <td><code>${escape(s.id)}</code></td>
    <td>
      <div class="row-cluster">
        <strong>${escape(s.titre)}</strong>
        ${lienSource(s.file)}
      </div>
    </td>
    <td>${s.parentIntent ? `<code>${escape(s.parentIntent)}</code>` : '<em class="muted">—</em>'}</td>
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

function pageTraceability(donnees) {
  const m = donnees.matrice;
  const rowsForward = m.forward.flatMap((row) => {
    if (row.specs.length === 0) {
      return [`<tr><td><code>${escape(row.intent.id)}</code></td><td><em class="muted">(aucune SPEC)</em></td><td>—</td><td>—</td><td>${badge('orphelin', 'badge-bad')}</td></tr>`];
    }
    return row.specs.map((s, idx) => {
      const code = s.code.length ? s.code.map((c) => `<code>${escape(c.path)}</code>`).join('<br/>') : '<em class="muted">aucun</em>';
      const tests = s.tests.length ? s.tests.map((t) => `<code>${escape(t.path)}</code>`).join('<br/>') : '<em class="muted">aucun</em>';
      let verdict = badge('ok', 'badge-ok');
      if (s.code.length === 0) verdict = badge('non-implémentée', 'badge-warn');
      else if (s.tests.length === 0) verdict = badge('non-testée', 'badge-warn');
      // rowspan : on ne ré-affiche l'intent que sur la première SPEC du groupe
      const cellIntent = idx === 0
        ? `<td rowspan="${row.specs.length}" class="rowspan"><code>${escape(row.intent.id)}</code></td>`
        : '';
      return `<tr>
        ${cellIntent}
        <td><code>${escape(s.spec.id)}</code><br/><small class="muted">${escape(s.spec.title)}</small></td>
        <td>${code}</td>
        <td>${tests}</td>
        <td>${verdict}</td>
      </tr>`;
    });
  }).join('');

  const rowsBackward = m.backward.map((row) => {
    const code = row.code.length ? row.code.map((c) => `<code>${escape(c.path)}</code>`).join('<br/>') : '<em class="muted">aucun</em>';
    return `<tr>
      <td><code>${escape(row.test.path)}</code></td>
      <td>${row.spec ? `<code>${escape(row.spec.id)}</code>` : badge('non-tracé', 'badge-bad')}</td>
      <td>${row.intent ? `<code>${escape(row.intent.id)}</code>` : '<em class="muted">—</em>'}</td>
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

function pageMetrics(donnees) {
  const a = donnees.metrics.agregats;
  const cats = donnees.metrics.categories;

  const totalAvecMetrics = Object.values(cats).reduce((s, c) => s + c.fichiers.length, 0);
  if (totalAvecMetrics === 0) {
    return `<div class="empty">
      <strong>Aucune donnée métrique persistée.</strong>
      Les commandes <code>/aiad standup</code>, <code>/aiad demo</code>, <code>/aiad retro</code>, <code>/aiad dora</code>, <code>/aiad flow</code> écrivent leurs métriques dans <code>.aiad/metrics/</code>. Une fois que tu as exécuté ces rituels, les indicateurs apparaîtront ici.
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

  const dora = `
    <div class="kpi"><div class="label">Déploiements</div><div class="value">${a.deployments.total}</div><div class="delta">${a.deployments.success} OK · ${a.deployments.hotfix} hotfix</div></div>
    <div class="kpi"><div class="label">Cycle Time moyen</div><div class="value">${fmt(a.deployments.cycleTimeMoyen, ' j')}</div><div class="spark-row">${sparkline(seriesCycleTime)}</div></div>
    <div class="kpi"><div class="label">Lead Time moyen</div><div class="value">${fmt(a.deployments.leadTimeMoyen, ' j')}</div></div>
    <div class="kpi ${a.deployments.total ? (a.deployments.hotfix / a.deployments.total < 0.05 ? 'ok' : 'warn') : ''}">
      <div class="label">Change Failure Rate</div>
      <div class="value">${a.deployments.total ? Math.round((a.deployments.hotfix / a.deployments.total) * 100) + '%' : '—'}</div>
    </div>
  `;
  const flow = `
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

  const tableauCats = Object.values(cats).map((c) => {
    if (c.fichiers.length === 0) return '';
    const rows = c.fichiers.slice(0, 10).map((f) => `<tr>
      <td><code>${escape(f.nom)}</code></td>
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
<section>
  <h2>DORA</h2>
  <div class="kpis">${dora}</div>
</section>
<section>
  <h2>Flow & Qualité</h2>
  <div class="kpis">${flow}</div>
</section>
${tableauCats}
`;
}

function formaterKv(data) {
  const e = Object.entries(data).slice(0, 6);
  if (e.length === 0) return '<em class="muted">—</em>';
  return e.map(([k, v]) => `<code>${escape(k)}: ${escape(String(v))}</code>`).join(' ');
}

function pageGovernance(donnees) {
  const rows = donnees.gouvernance.map((g) => `<tr>
    <td><strong>${escape(g.id)}</strong></td>
    <td>${g.present ? statutBadge('présent') : statutBadge('absent')}</td>
    <td>${escape(g.referentiel)}</td>
    <td>${escape(g.declenche)}</td>
    <td class="muted">${g.tailleKo ? g.tailleKo + ' Ko' : '—'}</td>
  </tr>`).join('');

  const presents = donnees.gouvernance.filter((g) => g.present).length;
  const total = donnees.gouvernance.length;

  return `
<div class="kpis">
  <div class="kpi ${presents === total ? 'ok' : 'warn'}">
    <div class="label">Couverture Tier 1</div>
    <div class="value">${presents}/${total}</div>
    <div class="delta">${presents === total ? 'tous les agents installés' : 'agents manquants'}</div>
  </div>
</div>

<section>
  <h2>Agents de gouvernance</h2>
  <div class="card">
    <p class="muted">Les agents de gouvernance ont un <strong>droit de veto</strong>. En cas de conflit entre une SPEC et un agent de gouvernance, l'agent de gouvernance prévaut.</p>
  </div>
  <table>
    <thead><tr><th>Agent</th><th>État</th><th>Référentiel</th><th>Déclenché quand…</th><th>Taille</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>

<section>
  <h2>Hiérarchie de priorité</h2>
  <div class="card">
    <ol>
      <li><strong>Art. 5 AI Act</strong> (interdictions) — priorité absolue</li>
      <li><strong>RGPD + Art. 9</strong> — base légale requise si données sensibles</li>
      <li><strong>AI Act haut risque</strong> — obligations procédurales</li>
      <li><strong>RGAA</strong> — accessibilité des interfaces (y compris AI Act : divulgation, supervision, recours)</li>
      <li><strong>RGESN</strong> — optimisation énergétique dans le respect des quatre ci-dessus</li>
    </ol>
  </div>
</section>
`;
}

function pageDrifts(donnees) {
  const facts = donnees.facts;
  if (facts.length === 0) {
    return `<div class="empty">
      <strong>Aucun drift / fact capturé.</strong>
      <code>/sdd fact</code> capture les écarts livré ↔ désiré. <code>/sdd drift-check</code> détecte les divergences code ↔ SPEC. Si vous travaillez en SDD strict, l'absence de fact peut être saine — ou indiquer que le rituel n'est pas encore activé.
    </div>`;
  }
  const rows = facts.map((f) => `<tr>
    <td><code>${escape(f.id)}</code></td>
    <td>
      <div class="row-cluster">
        <strong>${escape(f.titre)}</strong>
        ${lienSource(f.file)}
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

function pageChangelog(donnees) {
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
  <h2>Historique <span class="count">source : <code>${escape(donnees.changelog.file || '')}</code></span></h2>
  <div class="filter"><input type="search" id="qCl" data-filter-target="tCl" placeholder="Filtrer par date, artefact, raison…"/></div>
  <table id="tCl" data-sortable="true">
    <thead><tr><th>Date</th><th>Artefact</th><th>Type</th><th>Auteur</th><th>Raison</th><th>Impact</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
`;
}

// ─── Génération ─────────────────────────────────────────────────────────────

const RENDERERS = {
  index: { titre: 'Vue d\'ensemble', sous: 'Pulse global du projet SDD Mode', render: pageOverview },
  intents: { titre: 'Intent Statements', sous: 'Le POURQUOI capturé avant toute spécification', render: pageIntents },
  specs: { titre: 'SPECs', sous: 'Spécifications techniques atomiques liées aux Intents', render: pageSpecs },
  traceability: { titre: 'Traçabilité', sous: 'Matrice machine-vérifiable Intent ↔ SPEC ↔ Code ↔ Tests', render: pageTraceability },
  metrics: { titre: 'Métriques', sous: 'DORA, Flow et qualité — agrégés depuis .aiad/metrics/', render: pageMetrics },
  governance: { titre: 'Gouvernance Tier 1', sous: 'AI-ACT · RGPD · RGAA · RGESN — droit de veto', render: pageGovernance },
  drifts: { titre: 'Drifts & Facts', sous: 'Écarts livré ↔ désiré et drifts code ↔ SPEC capturés', render: pageDrifts },
  changelog: { titre: 'Changelog des artefacts', sous: 'Historique des mises à jour SDD Mode', render: pageChangelog },
};

export async function dashboard(racineProjet, options = {}) {
  const aiadDir = join(racineProjet, '.aiad');
  if (!existsSync(aiadDir)) {
    console.error(`${C.rouge}  Pas de dossier .aiad/ — initialisez le projet avec 'npx aiad-sdd init'.${C.reset}`);
    process.exit(1);
  }

  const outDir = options.out
    ? join(racineProjet, options.out)
    : join(racineProjet, 'dashboard');
  const verbose = !options.quiet;

  setSourceBase(options.sourceBase || '');

  if (verbose) {
    console.log(`\n${C.cyan}${C.gras}  AIAD SDD Mode — Dashboard HTML${C.reset}\n`);
    console.log(`  ${C.gras}Source${C.reset}      ${relative(racineProjet, aiadDir)}/`);
    console.log(`  ${C.gras}Destination${C.reset} ${relative(racineProjet, outDir)}/\n`);
  }

  const donnees = collecterDonnees(racineProjet);

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const assetsDir = join(outDir, 'assets');
  if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });

  // Assets partagés
  writeFileSync(join(assetsDir, 'style.css'), CSS, 'utf-8');
  writeFileSync(join(assetsDir, 'app.js'), APP_JS, 'utf-8');

  // Dump JSON pour debug / inspection
  writeFileSync(join(outDir, 'data.json'), JSON.stringify(serializerDonnees(donnees), null, 2), 'utf-8');

  // Pages
  const ecrits = [];
  for (const page of PAGES) {
    const def = RENDERERS[page.slug];
    if (!def) continue;
    const body = def.render(donnees);
    const html = layout({
      slug: page.slug,
      titre: def.titre,
      sous: def.sous,
      donnees,
      body,
    });
    const chemin = join(outDir, page.file);
    writeFileSync(chemin, html, 'utf-8');
    ecrits.push(chemin);
  }

  if (verbose) {
    console.log(`  ${C.gras}Synthèse${C.reset}`);
    console.log(`    Maturité       : ${donnees.maturite.score}/${donnees.maturite.total} — ${donnees.maturite.label}`);
    console.log(`    Intents        : ${donnees.intents.length}`);
    console.log(`    SPECs          : ${donnees.specs.length}`);
    console.log(`    Gouvernance    : ${donnees.gouvernance.filter((g) => g.present).length}/${donnees.gouvernance.length}`);
    console.log(`    Facts          : ${donnees.facts.length}`);
    console.log(`    Changelog      : ${donnees.changelog.entrees.length} entrée(s)`);

    console.log(`\n  ${C.gras}Pages générées${C.reset}`);
    for (const p of ecrits) {
      console.log(`    ${C.vert}+${C.reset} ${relative(racineProjet, p)}`);
    }
    console.log(`    ${C.vert}+${C.reset} ${relative(racineProjet, join(assetsDir, 'style.css'))}`);
    console.log(`    ${C.vert}+${C.reset} ${relative(racineProjet, join(assetsDir, 'app.js'))}`);
    console.log(`    ${C.vert}+${C.reset} ${relative(racineProjet, join(outDir, 'data.json'))}`);
    console.log(`\n  ${C.gras}Ouvrir${C.reset}      file://${join(outDir, 'index.html')}\n`);
  }

  return { outDir, donnees, pages: ecrits };
}

function serializerDonnees(d) {
  // Map → object pour sérialisation JSON
  const out = { ...d };
  out.specsParIntent = Object.fromEntries(d.specsParIntent);
  return out;
}

// ─── Serveur HTTP local (--serve) ────────────────────────────────────────────
//
// Sert le dossier dashboard/ sur 127.0.0.1:<port>. Aucune dépendance externe :
// utilise le module http natif de Node. Bound à localhost uniquement (pas
// d'exposition réseau). Pratique pour :
//   - Visualiser le dashboard depuis un navigateur (mobile ou desktop)
//   - Demander à Claude (via MCP Playwright) d'inspecter / capturer la page
//   - Itérer rapidement sur les SPECs sans publier le dashboard

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export function serveDashboard(rootDir, opts = {}) {
  const port = Number(opts.port) || 8765;
  const racine = resolve(rootDir);
  const server = createServer((req, res) => {
    let chemin = decodeURIComponent((req.url || '/').split('?')[0]);
    if (chemin === '/') chemin = '/index.html';
    const cible = join(racine, chemin);
    // Garde anti-traversal : join() normalise déjà `..` mais on revérifie.
    if (!cible.startsWith(racine)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    let st;
    try { st = statSync(cible); } catch { st = null; }
    if (!st || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Not found: ${chemin}`);
      return;
    }
    const mime = MIME[extname(cible).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(readFileSync(cible));
  });

  return new Promise((resolveP, rejectP) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        rejectP(new Error(`Port ${port} déjà utilisé. Réessaie avec --port ${port + 1}.`));
      } else rejectP(err);
    });
    server.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${port}/`;
      console.log(`\n${C.cyan}${C.gras}  Dashboard servi en local${C.reset}`);
      console.log(`    URL    : ${C.cyan}${url}${C.reset}`);
      console.log(`    Source : ${relative(process.cwd(), racine)}`);
      console.log(`    ${C.gris}Ctrl+C pour arrêter le serveur${C.reset}\n`);
      resolveP({ server, url, port });
    });
  });
}
