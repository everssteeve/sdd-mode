// AIAD SDD Mode — EU Sovereignty Score (item #94).
//
// **Cap stratégique** : un score composite **opposable** qui mesure
// l'alignement d'un projet avec les exigences de **souveraineté
// numérique européenne**. Pensé pour les acheteurs publics EU, les
// directions juridiques, et les programmes "cloud au centre" / ENISA /
// EuroStack.
//
// **5 dimensions, 20 points chacune (total 100)** :
//
//   1. **EU jurisdictions** — diversité des juridictions EU couvertes
//      par les packs gouvernance installés (`.aiad/gouvernance` +
//      packs détectés dans .aiad/governance-packs.json si présent).
//   2. **Tier 1 agents** — qualité de la couverture réglementaire
//      (4 agents EU baseline + bonus pour CRA, ISO 42001, sectoriels).
//   3. **Language ratio (FR)** — proportion d'artefacts en français
//      (Intents + SPECs). Cap stratégique : leader FR/EU.
//   4. **CNIL/ANSSI presence** — références explicites aux autorités
//      françaises et européennes dans les artefacts AIAD.
//   5. **EU hosting commitment** — engagement explicite (publiccode.yml
//      countries=fr/eu, config aiad.sovereignty.hosting=eu, ou agent
//      AIAD-SECNUMCLOUD installé).
//
// **Sortie** : `{ score, level, dimensions, recommendations }` —
// niveau Bronze (0-39), Silver (40-69), Gold (70-89), Platinum (90-100).
//
// Documentation : https://aiad.ovh/sovereignty
//
// Référentiels :
//   - EU Digital Sovereignty Strategy 2030
//   - EuroStack initiative — https://eurostack.eu/
//   - ENISA Cybersecurity Index — annual reports
//   - DINUM "doctrine cloud au centre" — Circulaire 5 juillet 2021

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { calculerLangueArtefacts } from './leadership-metrics.js';
import { buildMeta } from './meta.js';
import { listerFichiersMd, lireFichier } from './dashboard/collect.js';
import { C, logHeader } from './term.js';

// ─── Référentiels ───────────────────────────────────────────────────────────

const JURIDICTIONS_EU = [
  'fr', 'de', 'es', 'it', 'nl', 'be', 'ch', 'eu',
];

// Mapping pack → juridictions. Un pack peut couvrir plusieurs juridictions
// (eu-baseline, eu-financial, eu-platforms couvrent toute l'UE).
const PACK_JURIDICTIONS = {
  'eu-baseline': ['eu'],
  'eu-financial': ['eu'],
  'eu-platforms': ['eu'],
  'iso-standards': ['eu'],
  'fr-anssi': ['fr'],
  'de-bsi': ['de'],
  'es-aepd': ['es'],
  'it-agid': ['it'],
  'nl-ap': ['nl'],
  'be-apd': ['be'],
  'ch-fadp': ['ch'],
};

const AGENTS_TIER1_BASELINE = ['AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md'];
const AGENTS_TIER1_PRIME = [
  'AIAD-CRA.md', 'AIAD-ISO-42001.md',
  'AIAD-RGS.md', 'AIAD-PASSI.md', 'AIAD-SECNUMCLOUD.md', 'AIAD-HOMOLOGATION.md',
];

const NIVEAUX = [
  { min: 90, label: 'Platinum', couleur: 'cyan' },
  { min: 70, label: 'Gold', couleur: 'jaune' },
  { min: 40, label: 'Silver', couleur: 'gris' },
  { min: 0, label: 'Bronze', couleur: 'rouge' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function lireConfig(racine) {
  const configPath = join(racine, '.aiad', 'config.yml');
  if (!existsSync(configPath)) return {};
  try {
    const contenu = readFileSync(configPath, 'utf-8');
    const out = {};
    for (const ligne of contenu.split('\n')) {
      const m = ligne.match(/^\s*(\w+(?:\.\w+)*)\s*:\s*(.+?)\s*$/);
      if (m) {
        out[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
      }
    }
    return out;
  } catch { return {}; }
}

function lirePublicCode(racine) {
  const path = join(racine, 'publiccode.yml');
  if (!existsSync(path)) return null;
  try {
    const contenu = readFileSync(path, 'utf-8');
    const out = { _raw: contenu };
    const countries = contenu.match(/countries:\s*\n\s*-\s*['"]?(\w+)['"]?/);
    if (countries) out.country = countries[1];
    return out;
  } catch { return null; }
}

// ─── Dimension 1 — EU jurisdictions ────────────────────────────────────────

export function dimensionJuridictions(racine) {
  // Détection : agents installés qui correspondent à des packs connus.
  const govDir = join(racine, '.aiad', 'gouvernance');
  if (!existsSync(govDir)) return { score: 0, juridictions: [], packs: [] };

  const fichiers = readdirSync(govDir);
  const packsActifs = [];
  const juridictions = new Set();

  // Baseline EU = présence des 4 agents AI-ACT/RGPD/RGAA/RGESN
  if (AGENTS_TIER1_BASELINE.every((a) => fichiers.includes(a))) {
    packsActifs.push('eu-baseline');
    juridictions.add('eu');
  }
  // CRA (Cyber Resilience Act) — agent EU additionnel
  if (fichiers.includes('AIAD-CRA.md')) juridictions.add('eu');
  // ISO 42001 — pas une juridiction mais ajout couverture
  if (fichiers.includes('AIAD-ISO-42001.md')) packsActifs.push('iso-standards');
  // FR ANSSI
  if (fichiers.includes('AIAD-RGS.md') || fichiers.includes('AIAD-SECNUMCLOUD.md') || fichiers.includes('AIAD-PASSI.md')) {
    packsActifs.push('fr-anssi');
    juridictions.add('fr');
  }
  // DE BSI
  if (fichiers.some((f) => f.includes('BSI') || f === 'AIAD-BDSG.md' || f === 'AIAD-C5.md')) {
    packsActifs.push('de-bsi'); juridictions.add('de');
  }
  // ES AEPD
  if (fichiers.some((f) => f === 'AIAD-AEPD.md' || f === 'AIAD-LOPDGDD.md' || f === 'AIAD-ENS.md')) {
    packsActifs.push('es-aepd'); juridictions.add('es');
  }
  // IT AGID
  if (fichiers.some((f) => f === 'AIAD-AGID.md' || f === 'AIAD-CAD.md' || f === 'AIAD-PAGOPA.md')) {
    packsActifs.push('it-agid'); juridictions.add('it');
  }
  // NL AP
  if (fichiers.some((f) => f === 'AIAD-AP.md' || f === 'AIAD-UAVG.md' || f === 'AIAD-BIO.md')) {
    packsActifs.push('nl-ap'); juridictions.add('nl');
  }
  // BE APD
  if (fichiers.some((f) => f === 'AIAD-APD.md' || f === 'AIAD-CCT81.md')) {
    packsActifs.push('be-apd'); juridictions.add('be');
  }
  // CH FADP
  if (fichiers.some((f) => f === 'AIAD-CH-FADP.md' || f === 'AIAD-NLPD.md')) {
    packsActifs.push('ch-fadp'); juridictions.add('ch');
  }

  // Score : 4pt par juridiction EU jusqu'à 5 max
  const liste = [...juridictions].filter((j) => JURIDICTIONS_EU.includes(j));
  const score = Math.min(20, liste.length * 4);
  return { score, juridictions: liste, packs: [...new Set(packsActifs)] };
}

// ─── Dimension 2 — Tier 1 agents ────────────────────────────────────────────

export function dimensionAgentsTier1(racine) {
  const govDir = join(racine, '.aiad', 'gouvernance');
  if (!existsSync(govDir)) return { score: 0, baseline: 0, prime: 0, agents: [] };
  const fichiers = readdirSync(govDir).filter((f) => f.startsWith('AIAD-') && f.endsWith('.md'));

  const baseline = AGENTS_TIER1_BASELINE.filter((a) => fichiers.includes(a)).length;
  const prime = AGENTS_TIER1_PRIME.filter((a) => fichiers.includes(a)).length;

  // Score : 3pt par agent baseline (4 × 3 = 12) + 2pt par agent prime (max 8)
  const score = Math.min(20, baseline * 3 + Math.min(8, prime * 2));
  return { score, baseline, prime, agents: fichiers };
}

// ─── Dimension 3 — Language ratio (FR) ──────────────────────────────────────

export function dimensionLangueFr(racine) {
  const langues = calculerLangueArtefacts(racine);
  if (langues.total === 0) return { score: 0, ratioFr: null, total: 0 };
  // FR pur compte 1.0, mixed compte 0.5, en/neutral comptent 0.
  const eqFr = langues.fr + langues.mixed * 0.5;
  const ratio = eqFr / langues.total;
  const score = Math.round(ratio * 20);
  return {
    score,
    ratioFr: ratio,
    fr: langues.fr,
    mixed: langues.mixed,
    en: langues.en,
    neutral: langues.neutral,
    total: langues.total,
  };
}

// ─── Dimension 4 — CNIL/ANSSI presence ──────────────────────────────────────

const TERMES_AUTORITES = [
  { id: 'cnil', regex: /\bCNIL\b/i, points: 5 },
  { id: 'anssi', regex: /\bANSSI\b/i, points: 5 },
  { id: 'dinum', regex: /\bDINUM\b/i, points: 5 },
  { id: 'secnumcloud', regex: /\bSecNumCloud\b/i, points: 5 },
];

export function dimensionAutorites(racine) {
  const found = new Set();
  // Scanne .aiad/specs, .aiad/intents, .aiad/gouvernance
  for (const sous of ['specs', 'intents', 'gouvernance']) {
    const dir = join(racine, '.aiad', sous);
    if (!existsSync(dir)) continue;
    const fichiers = listerFichiersMd(dir);
    for (const chemin of fichiers) {
      const contenu = lireFichier(chemin) || '';
      for (const t of TERMES_AUTORITES) {
        if (!found.has(t.id) && t.regex.test(contenu)) found.add(t.id);
      }
      if (found.size === TERMES_AUTORITES.length) break;
    }
  }
  let score = 0;
  for (const t of TERMES_AUTORITES) {
    if (found.has(t.id)) score += t.points;
  }
  return { score, autorites: [...found] };
}

// ─── Dimension 5 — EU hosting commitment ────────────────────────────────────

export function dimensionHebergement(racine) {
  const config = lireConfig(racine);
  const publiccode = lirePublicCode(racine);
  const govDir = join(racine, '.aiad', 'gouvernance');
  const govFiles = existsSync(govDir) ? readdirSync(govDir) : [];

  let score = 0;
  const sources = [];

  // Engagement publiccode.yml countries=fr → 10pt
  if (publiccode && publiccode.country && JURIDICTIONS_EU.includes(publiccode.country.toLowerCase())) {
    score += 10;
    sources.push(`publiccode.yml countries=${publiccode.country}`);
  }
  // Config .aiad/config.yml hosting=eu → 5pt
  const hostingValues = ['eu', 'eea', 'ue', 'eee', 'fr'];
  if (config['hosting'] && hostingValues.includes(String(config['hosting']).toLowerCase())) {
    score += 5;
    sources.push(`config.yml hosting=${config['hosting']}`);
  }
  if (config['sovereignty.hosting'] && hostingValues.includes(String(config['sovereignty.hosting']).toLowerCase())) {
    score += 5;
    sources.push(`config.yml sovereignty.hosting=${config['sovereignty.hosting']}`);
  }
  // SecNumCloud agent installé → 10pt
  if (govFiles.includes('AIAD-SECNUMCLOUD.md')) {
    score += 10;
    sources.push('agent AIAD-SECNUMCLOUD installé');
  }

  return { score: Math.min(20, score), sources };
}

// ─── Agrégation ─────────────────────────────────────────────────────────────

function niveauPourScore(score) {
  return NIVEAUX.find((n) => score >= n.min) || NIVEAUX[NIVEAUX.length - 1];
}

function recommendations(dims) {
  const out = [];
  if (dims.juridictions.score < 12) {
    out.push('Installer un pack juridictionnel additionnel (`aiad-sdd gouvernance --pack fr-anssi`, `de-bsi`, etc.) pour renforcer la couverture EU.');
  }
  if (dims.agentsTier1.baseline < 4) {
    out.push('Compléter les 4 agents EU baseline (AI-ACT, RGPD, RGAA, RGESN) — cap commun européen.');
  }
  if (dims.langueFr.ratioFr !== null && dims.langueFr.ratioFr < 0.5) {
    out.push('Rédiger les Intents et SPECs en français pour atteindre la cible "leader FR/EU" — la langue est un signal fort de positionnement.');
  }
  if (dims.autorites.score < 10) {
    out.push('Référencer explicitement la CNIL et l\'ANSSI dans les SPECs sensibles (privacy, sécurité, identité).');
  }
  if (dims.hebergement.score < 10) {
    out.push('Déclarer un engagement d\'hébergement EU dans `publiccode.yml` (`countries: [fr]`) ou installer le pack `fr-anssi` (agent SecNumCloud).');
  }
  return out;
}

export function computeSovereigntyScore(racine) {
  const dimensions = {
    juridictions: dimensionJuridictions(racine),
    agentsTier1: dimensionAgentsTier1(racine),
    langueFr: dimensionLangueFr(racine),
    autorites: dimensionAutorites(racine),
    hebergement: dimensionHebergement(racine),
  };
  const score = Object.values(dimensions).reduce((sum, d) => sum + d.score, 0);
  const niveau = niveauPourScore(score);
  return {
    score,
    level: niveau.label,
    levelColor: niveau.couleur,
    dimensions,
    recommendations: recommendations(dimensions),
    maxScore: 100,
  };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

export function afficherScore(racine, options = {}) {
  const r = computeSovereigntyScore(racine);

  if (options.json) {
    // (#263) _meta cohérent avec dashboard/doctor/status/workspace/trace/brief.
    const withMeta = { _meta: buildMeta({ schema: 'aiad-sdd-sovereignty' }), ...r };
    process.stdout.write(JSON.stringify(withMeta, null, 2) + '\n');
    return withMeta;
  }

  const couleur = C[r.levelColor] || C.gris;
  logHeader(
    'AIAD SDD — EU Sovereignty Score',
    `Score : ${couleur}${r.score}/100${C.reset}  ·  Niveau : ${couleur}${r.level}${C.reset}`,
  );

  const lignes = [
    { lab: 'EU jurisdictions', val: r.dimensions.juridictions.score, max: 20, det: r.dimensions.juridictions.juridictions.join(', ') || '(aucune)' },
    { lab: 'Tier 1 agents', val: r.dimensions.agentsTier1.score, max: 20, det: `${r.dimensions.agentsTier1.baseline} baseline + ${r.dimensions.agentsTier1.prime} prime` },
    { lab: 'Language ratio FR', val: r.dimensions.langueFr.score, max: 20, det: r.dimensions.langueFr.ratioFr === null ? '(aucun artefact)' : `${(r.dimensions.langueFr.ratioFr * 100).toFixed(0)}% FR` },
    { lab: 'CNIL/ANSSI presence', val: r.dimensions.autorites.score, max: 20, det: r.dimensions.autorites.autorites.join(', ') || '(aucune référence)' },
    { lab: 'EU hosting commitment', val: r.dimensions.hebergement.score, max: 20, det: r.dimensions.hebergement.sources.join('; ') || '(aucune source)' },
  ];

  for (const l of lignes) {
    const bar = '█'.repeat(Math.round((l.val / l.max) * 16)).padEnd(16, '·');
    console.log(`  ${l.lab.padEnd(22)} ${C.cyan}${bar}${C.reset}  ${l.val}/${l.max}  ${C.gris}${l.det}${C.reset}`);
  }
  console.log('');

  if (r.recommendations.length > 0) {
    console.log(`  ${C.gras}Recommandations${C.reset}`);
    for (const reco of r.recommendations) console.log(`    ${C.jaune}→${C.reset} ${reco}`);
    console.log('');
  }

  return r;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  dimensionJuridictions as scoreJurisdictions,
  dimensionAgentsTier1 as scoreTier1Agents,
  dimensionLangueFr as scoreLanguageFr,
  dimensionAutorites as scoreAuthorities,
  dimensionHebergement as scoreHosting,
  afficherScore as showScore,
};

export const CONSTANTS = {
  JURIDICTIONS_EU,
  PACK_JURIDICTIONS,
  AGENTS_TIER1_BASELINE,
  AGENTS_TIER1_PRIME,
  NIVEAUX: NIVEAUX.map((n) => ({ min: n.min, label: n.label })),
};
