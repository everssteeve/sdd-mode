// AIAD SDD Mode — Métriques de leadership EU/FR.
//
// 4 indicateurs propres au framework, exposés dans `aiad-sdd doctor --json`
// pour permettre aux équipes de mesurer leur adoption du cycle SDD au-delà
// des checks structurels classiques :
//
//   1. humanAuthorshipRatio — % d'Intent Statements ≥ 50 caractères de
//      contenu (signal d'effort humain réel, pas auto-généré).
//   2. governanceCoverage — % de fichiers code dans des chemins sensibles
//      qui portent une annotation `@governance`.
//   3. traceCompleteness — % de SPECs liées à la fois au code (`@spec`) ET
//      aux tests (matrice forward).
//   4. langueArtefacts — ratio FR / EN / mixte des titres d'Intents+SPECs.
//      Mesure du positionnement langue (cap stratégique : leader FR/EU).
//
// Toutes les métriques sont **pures** : entrée modèle de traçabilité +
// répertoire `.aiad/`, sortie objet JSON-sérialisable. Permet d'agréger
// facilement vers un dashboard externe ou des objectifs OKR.
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { lireFichier, listerFichiersMd, extraireTitre } from './dashboard/collect.js';
import { construireMatrice, scanCode } from './sdd-trace.js';
import { parseFrontmatter } from './frontmatter.js';

const SEUIL_AUTHORSHIP_CHARS = 50;

// Heuristiques sur les chemins sensibles qui devraient déclencher une
// gouvernance. Couvre les cas classiques EU :
//   - auth / users / accounts → RGPD
//   - ai / ml / llm / agents → AI Act
//   - components / pages / app → RGAA
const PATHS_SENSIBLES = [
  /(^|\/)(auth|users|accounts|account|login|gdpr|privacy|sessions?)\//i,
  /(^|\/)(ai|ml|llm|models?|agents?|inference|training|scoring)\//i,
  /(^|\/)(components?|pages?|views?|app)\//i,
];

function estPathSensible(p) {
  return PATHS_SENSIBLES.some((re) => re.test(p));
}

// ─── 1. humanAuthorshipRatio ────────────────────────────────────────────────

export function calculerHumanAuthorship(racine) {
  const dir = join(racine, '.aiad', 'intents');
  if (!existsSync(dir)) return { total: 0, sufficient: 0, ratio: null };
  const fichiers = listerFichiersMd(dir);
  let suffisants = 0;
  for (const chemin of fichiers) {
    const contenu = lireFichier(chemin) || '';
    const { body } = parseFrontmatter(contenu);
    const propre = body.trim();
    if (propre.length >= SEUIL_AUTHORSHIP_CHARS) suffisants++;
  }
  return {
    total: fichiers.length,
    sufficient: suffisants,
    ratio: fichiers.length === 0 ? null : suffisants / fichiers.length,
    seuilCharsMinimum: SEUIL_AUTHORSHIP_CHARS,
  };
}

// ─── 2. governanceCoverage ──────────────────────────────────────────────────

export function calculerGovernanceCoverage(racine) {
  // Scanne directement le code (incluant tests) à la recherche de fichiers
  // dans des chemins sensibles ET porteurs d'au moins une annotation
  // `@governance AIAD-…`.
  let fichiers;
  try { fichiers = scanCode(racine); }
  catch { return { sensitiveFiles: 0, governedFiles: 0, ratio: null }; }

  const sensibles = fichiers.filter((f) => !f.isTest && estPathSensible(f.path));
  const couverts = sensibles.filter((f) => (f.annotations.governance || []).length > 0);
  return {
    sensitiveFiles: sensibles.length,
    governedFiles: couverts.length,
    ratio: sensibles.length === 0 ? null : couverts.length / sensibles.length,
  };
}

// ─── 3. traceCompleteness ───────────────────────────────────────────────────

export function calculerTraceCompleteness(matrice) {
  if (!matrice || !matrice.forward) return { total: 0, complete: 0, ratio: null };
  let total = 0;
  let complets = 0;
  for (const ligne of matrice.forward) {
    for (const s of ligne.specs) {
      total++;
      if (s.code.length > 0 && s.tests.length > 0) complets++;
    }
  }
  return { total, complete: complets, ratio: total === 0 ? null : complets / total };
}

// ─── 4. langueArtefacts ─────────────────────────────────────────────────────
//
// Heuristique mots-vides (stop words) :
//   - une majorité de mots-vides FR ("le/la/les/de/des/un/une/et/à/dans/...")
//     dans les titres → fr ;
//   - majorité de mots-vides EN ("the/a/an/of/in/and/to/for/...") → en ;
//   - mélange ≥ 25 % de chaque → mixed ;
//   - aucun mot-vide reconnu → neutre.

const STOP_FR = new Set(['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'à', 'au', 'aux', 'dans', 'sur', 'pour', 'avec', 'sans', 'en', 'par', 'que', 'qui', 'ce', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'votre', 'leur']);
const STOP_EN = new Set(['the', 'a', 'an', 'of', 'in', 'and', 'to', 'for', 'with', 'on', 'at', 'by', 'from', 'this', 'that', 'these', 'those', 'my', 'your', 'their', 'our', 'is', 'are', 'be', 'as']);

function classerLangue(titre) {
  // Match direct sans normalisation pour éviter les collisions
  // (ex. "à" FR ≠ "a" EN après strip diacritics — sinon l'article anglais
  // "a" matcherait aussi le stop FR et bruiterait la classification).
  const mots = String(titre || '').toLowerCase().split(/\s+/);
  let fr = 0; let en = 0;
  for (const m of mots) {
    if (STOP_FR.has(m)) fr++;
    if (STOP_EN.has(m)) en++;
  }
  const total = fr + en;
  if (total === 0) return 'neutral';
  const pctFr = fr / total;
  if (pctFr >= 0.75) return 'fr';
  if (pctFr <= 0.25) return 'en';
  return 'mixed';
}

export function calculerLangueArtefacts(racine) {
  const out = { fr: 0, en: 0, mixed: 0, neutral: 0, total: 0 };
  for (const sous of ['intents', 'specs']) {
    const dir = join(racine, '.aiad', sous);
    if (!existsSync(dir)) continue;
    for (const chemin of listerFichiersMd(dir)) {
      // Ignore le template EARS
      if (basename(chemin).startsWith('spec-ears-template')) continue;
      const contenu = lireFichier(chemin) || '';
      const { data, body } = parseFrontmatter(contenu);
      const titre = data.title || data.titre || extraireTitre(body) || '';
      const langue = classerLangue(titre);
      out[langue]++;
      out.total++;
    }
  }
  return out;
}

// ─── Agrégation ─────────────────────────────────────────────────────────────

export function computeLeadershipMetrics(racine) {
  const matrice = (() => {
    try { return construireMatrice(racine); } catch { return null; }
  })();
  return {
    humanAuthorshipRatio: calculerHumanAuthorship(racine),
    governanceCoverage: calculerGovernanceCoverage(racine),
    traceCompleteness: calculerTraceCompleteness(matrice),
    langueArtefacts: calculerLangueArtefacts(racine),
  };
}

// ─── Historique (#169) ──────────────────────────────────────────────────────
//
// Persiste 1 snapshot mensuel dans `.aiad/metrics/leadership/YYYY-MM.json`.
// Idempotent : si le fichier du mois courant existe déjà, on le met à jour ;
// on ne crée jamais de doublon par mois. Stratégie : moins de bruit dans
// l'historique (1 ligne/mois), suffisant pour une sparkline 12 mois.

function moisCourant(now = new Date()) {
  return now.toISOString().slice(0, 7); // YYYY-MM
}

export function enregistrerSnapshotLeadership(racine, metrics, options = {}) {
  const mois = options.mois || moisCourant();
  const dir = join(racine, '.aiad', 'metrics', 'leadership');
  mkdirSync(dir, { recursive: true });
  const chemin = join(dir, `${mois}.json`);
  const payload = {
    mois,
    ts: Date.now(),
    humanAuthorshipRatio: metrics.humanAuthorshipRatio?.ratio ?? null,
    governanceCoverage: metrics.governanceCoverage?.ratio ?? null,
    traceCompleteness: metrics.traceCompleteness?.ratio ?? null,
    langueArtefacts: metrics.langueArtefacts || null,
  };
  writeFileSync(chemin, JSON.stringify(payload, null, 2), 'utf-8');
  return { mois, file: chemin };
}

export function lireHistoireLeadership(racine, options = {}) {
  const dir = join(racine, '.aiad', 'metrics', 'leadership');
  if (!existsSync(dir)) return [];
  let fichiers;
  try { fichiers = readdirSync(dir); } catch { return []; }
  const out = [];
  for (const nom of fichiers) {
    if (!/^\d{4}-\d{2}\.json$/.test(nom)) continue;
    try {
      const json = JSON.parse(readFileSync(join(dir, nom), 'utf-8'));
      out.push(json);
    } catch { /* ignore corrompu */ }
  }
  out.sort((a, b) => (a.mois || '').localeCompare(b.mois || ''));
  const max = options.derniersMois ?? 12;
  return out.slice(-max);
}

// ─── Rendu HTML (#146 / #151) ───────────────────────────────────────────────
//
// Bloc "Leadership EU/FR" affiché entre DORA et Flow dans `metrics.html`.
// Réutilise les ratios déjà calculés par `computeLeadershipMetrics` et
// exposés via `donnees.signaux.leadership`. Renvoie chaîne vide si aucun
// signal disponible (projet sans `.aiad/` ou calcul échoué).

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function pctLeader(m) {
  if (!m || typeof m.ratio !== 'number') return null;
  return Math.round(m.ratio * 100);
}

function clsLeader(v) {
  if (v === null) return '';
  return v >= 80 ? 'ok' : v >= 50 ? 'warn' : 'bad';
}

// (#170) Helper qui décide entre `delta` chiffré "N/M unité" et un message
// amical "Pas encore de <chose>" quand `total === 0`. Évite de montrer
// `0/0 Intents ≥ 50 caractères` qui est techniquement vrai mais confusant.
function deltaOuVide(metric, sufField, totalField, unite, vide) {
  if (!metric || metric[totalField] === 0 || metric[totalField] == null) return vide;
  return `${metric[sufField] ?? 0}/${metric[totalField]} ${unite}`;
}

// (#169) Mini-sparkline SVG inline pour l'évolution mensuelle d'une métrique.
// Renvoie chaîne vide si moins de 2 points (rien à dessiner).
function sparklineMois(values) {
  const v = values.filter((x) => typeof x === 'number');
  if (v.length < 2) return '';
  const w = 120, h = 18;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const step = w / (v.length - 1);
  const points = v.map((x, i) => `${(i * step).toFixed(1)},${(h - ((x - min) / span) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// (#169) Extrait une série mensuelle pour une clé donnée depuis l'historique.
function serie(historique, key) {
  return historique.map((snap) => {
    const v = snap[key];
    return typeof v === 'number' ? v * 100 : null;
  });
}

export function blocLeadership(donnees) {
  const lead = donnees?.signaux?.leadership;
  if (!lead) return '';
  const ha = pctLeader(lead.humanAuthorshipRatio);
  const gc = pctLeader(lead.governanceCoverage);
  const tc = pctLeader(lead.traceCompleteness);
  const langue = lead.langueArtefacts || {};
  const stats = [
    { label: 'FR', n: langue.fr || 0 },
    { label: 'EN', n: langue.en || 0 },
    { label: 'mixte', n: langue.mixed || 0 },
  ].sort((a, b) => b.n - a.n);
  const dominante = stats[0].n ? `${stats[0].label} ${stats[0].n}` : '—';
  const langueTotal = (langue.fr || 0) + (langue.en || 0) + (langue.mixed || 0) + (langue.neutral || 0);
  // (#169) Historique mensuel injecté via donnees.signaux.leadershipHistory
  const hist = donnees?.signaux?.leadershipHistory || [];
  const sparkHa = sparklineMois(serie(hist, 'humanAuthorshipRatio'));
  const sparkGc = sparklineMois(serie(hist, 'governanceCoverage'));
  const sparkTc = sparklineMois(serie(hist, 'traceCompleteness'));
  const histLegend = hist.length >= 2
    ? `<p class="muted">Évolution sur ${hist.length} mois (de ${hist[0].mois} à ${hist[hist.length - 1].mois}).</p>`
    : '';
  return `
<section>
  <h2>Leadership EU/FR</h2>
  <p class="muted">Indicateurs de positionnement leader — calculés en local, sans télémétrie.</p>
  ${histLegend}
  <div class="kpis">
    <div class="kpi ${clsLeader(ha)}">
      <div class="label">Human Authorship</div>
      <div class="value">${ha === null ? '—' : ha + '%'}</div>
      <div class="delta">${deltaOuVide(lead.humanAuthorshipRatio, 'sufficient', 'total', 'Intents ≥ 50 caractères', "Pas encore d'Intent")}</div>
      ${sparkHa ? `<div class="spark-row">${sparkHa}</div>` : ''}
    </div>
    <div class="kpi ${clsLeader(gc)}">
      <div class="label">Governance Coverage</div>
      <div class="value">${gc === null ? '—' : gc + '%'}</div>
      <div class="delta">${deltaOuVide(lead.governanceCoverage, 'governedFiles', 'sensitiveFiles', 'fichiers sensibles annotés', 'Aucun fichier sensible détecté')}</div>
      ${sparkGc ? `<div class="spark-row">${sparkGc}</div>` : ''}
    </div>
    <div class="kpi ${clsLeader(tc)}">
      <div class="label">Trace Completeness</div>
      <div class="value">${tc === null ? '—' : tc + '%'}</div>
      <div class="delta">${deltaOuVide(lead.traceCompleteness, 'complete', 'total', 'SPECs avec code+tests', 'Pas encore de SPEC')}</div>
      ${sparkTc ? `<div class="spark-row">${sparkTc}</div>` : ''}
    </div>
    <div class="kpi">
      <div class="label">Langue artefacts</div>
      <div class="value">${escape(dominante)}</div>
      <div class="delta">${langueTotal === 0 ? 'Aucun artefact à classer' : `${langue.fr ?? 0} FR · ${langue.en ?? 0} EN · ${langue.mixed ?? 0} mixte · ${langue.neutral ?? 0} neutre`}</div>
    </div>
  </div>
</section>`;
}
