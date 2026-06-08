// AIAD SDD Mode — Phase Research + gate GO/NO-GO déterministe (item §3.5).
//
// **Cap stratégique** : le cycle SDD score la *qualité de la SPEC* (SQS) mais
// jamais la *viabilité de l'intention*. On ajoute une phase Research entre
// Intent et SPEC, ancrée dans le code (Discovery), qui produit un verdict
// gradué `GO | CONDITIONAL GO | DEFER | NO-GO`. Comme pour les autres gates,
// le verdict final n'est PAS le jugement libre du modèle : il est recalculé
// ici de façon déterministe à partir de signaux machine-vérifiables et mappé
// sur le contrat canonique (`lib/verdict.js`, exit codes 0/1/2).
//
// **Human Authorship** : la Research informe, l'humain tranche. Le verdict
// GO/NO-GO DOIT être déclaré par un humain dans l'artefact ; en son absence
// (ou si une inconnue JNSP reste ouverte, ou si le Discovery n'est pas ancré
// dans le code), le verdict est `JNSP` (exit 2) — fail-closed. Le scorer ne
// *fabrique* jamais une décision d'aller/ne-pas-aller ; il ne fait que la
// durcir (downgrade `GO → CONDITIONAL GO` s'il reste des inconnues non levées).
//
// **Heuristiques machine** (cf. plan §3.5 §4.2) :
//   - couverture Discovery : ≥ 1 ancrage code réel (`chemin:ligne` / `evidence:`)
//   - inconnues : items listés sous « Risques & inconnues »
//   - JNSP ouverts : marqueurs `TODO-JNSP` / `[JNSP]` non résolus
//
// Mapping décision → verdict canonique :
//   GO             → PASS         (exit 0)
//   CONDITIONAL GO → CONDITIONAL  (exit 0, conditions non vides)
//   DEFER          → FAIL         (exit 1)
//   NO-GO          → FAIL         (exit 1)
//   (Discovery absent · JNSP ouvert · verdict humain absent) → JNSP (exit 2)
//
// **Zero-dep**.
//
// @intent INTENT-003
// @spec SPEC-003-1-research-phase
// @verified-by test/research.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { emitVerdict } from './verdict.js';

/** Décisions graduées du gate Research (déclarées par l'humain). */
export const DECISIONS = ['GO', 'CONDITIONAL GO', 'DEFER', 'NO-GO'];

/** Mapping décision Research → verdict canonique (`lib/verdict.js`). */
export const DECISION_VERDICT = Object.freeze({
  GO: 'PASS',
  'CONDITIONAL GO': 'CONDITIONAL',
  DEFER: 'FAIL',
  'NO-GO': 'FAIL',
});

/** Confiance par défaut (%) si l'humain n'a pas chiffré sa décision. */
const CONFIANCE_BASE = Object.freeze({
  GO: 90,
  'CONDITIONAL GO': 60,
  DEFER: 40,
  'NO-GO': 20,
});

// ─── Détection d'un ancrage code (Discovery) ────────────────────────────────

// Un ancrage = preuve que la Research touche du code réel : soit `chemin:ligne`
// (ex. `src/auth/login.ts:42`), soit un marqueur explicite `evidence:`.
const ANCRAGE_FICHIER_LIGNE = /\b[\w./-]+\.[a-z0-9]+:\d+/i;
const ANCRAGE_EVIDENCE = /\bevidence\s*:/i;

/** Vrai si une ligne porte un ancrage code exploitable (et non un placeholder). */
export function ligneAncree(ligne) {
  if (/[…]|\.\.\.|<[^>]+>/.test(ligne) && !ANCRAGE_FICHIER_LIGNE.test(ligne)) return false;
  return ANCRAGE_FICHIER_LIGNE.test(ligne) || ANCRAGE_EVIDENCE.test(ligne);
}

// ─── Parsing de l'artefact Research ─────────────────────────────────────────

/**
 * Découpe le corps Markdown en sections par titre `##` (clé = titre normalisé
 * sans accents/casse → lignes du corps de la section).
 *
 * @param {string} body
 * @returns {Map<string, string[]>}
 */
function decouperSections(body) {
  const sections = new Map();
  let courante = '';
  sections.set(courante, []);
  for (const ligne of body.split('\n')) {
    const m = ligne.match(/^#{2,3}\s+(.*?)\s*$/);
    if (m) {
      courante = normaliser(m[1]);
      sections.set(courante, []);
    } else {
      sections.get(courante).push(ligne);
    }
  }
  return sections;
}

function normaliser(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Items de liste non vides (`- …` / `* …`) d'un bloc de lignes. */
function itemsListe(lignes) {
  const out = [];
  for (const l of lignes || []) {
    const m = l.match(/^\s*[-*]\s+(.*\S)\s*$/);
    if (!m) continue;
    const txt = m[1].trim();
    // Placeholder du template (« … », « <…> », vide) → ignoré.
    if (txt === '' || /^[…\-]+$/.test(txt) || /^<.*>$/.test(txt)) continue;
    out.push(txt);
  }
  return out;
}

function sectionContenant(sections, motcle) {
  for (const [titre, lignes] of sections) {
    if (titre.includes(motcle)) return lignes;
  }
  return null;
}

/**
 * Parse un artefact Research en modèle structuré machine-vérifiable.
 *
 * @param {string} contenu — Markdown complet de l'artefact
 * @returns {{
 *   intent: string|null,
 *   discovery: { populated: boolean, anchors: string[] },
 *   unknowns: string[],
 *   openJnsp: string[],
 *   conditions: string[],
 *   declared: { decision: string|null, confidence: number|null },
 * }}
 */
export function parserResearch(contenu) {
  const { data, body } = parseFrontmatter(contenu);
  const sections = decouperSections(body);

  // Intent parent : frontmatter `intent:` ou `(← INTENT-NNN)` dans le titre.
  let intent = typeof data.intent === 'string' ? data.intent : null;
  if (!intent) {
    const m = body.match(/INTENT-[A-Za-z0-9-]+/);
    if (m) intent = m[0];
  }

  // Discovery : ancrages code réels dans la section dédiée.
  const ligDiscovery = sectionContenant(sections, 'discovery') || [];
  const anchors = [];
  for (const l of ligDiscovery) {
    if (ligneAncree(l)) {
      const m = l.match(ANCRAGE_FICHIER_LIGNE);
      anchors.push(m ? m[0] : l.trim());
    }
  }

  const unknowns = itemsListe(sectionContenant(sections, 'inconnue') || sectionContenant(sections, 'risque'));
  const conditions = itemsListe(sectionContenant(sections, 'condition'));

  // JNSP ouverts : marqueurs explicites non résolus, n'importe où dans le corps.
  const openJnsp = [];
  for (const l of body.split('\n')) {
    if (/TODO-JNSP\s*:|\[JNSP\]|JNSP\s*[—:-]/.test(l) && !/résolu|resolu|tranch/i.test(l)) {
      openJnsp.push(l.trim());
    }
  }

  // Verdict déclaré par l'humain : `Verdict : DECISION (confidence: NN %)`.
  let decision = null;
  let confidence = null;
  const mv = body.match(/verdict\s*:?\s*(GO|CONDITIONAL GO|DEFER|NO-GO)\b/i);
  if (mv) {
    const up = mv[1].toUpperCase();
    decision = DECISIONS.find((d) => d === up) || null;
  }
  const mc = body.match(/confidence\s*:?\s*(\d{1,3})\s*%/i);
  if (mc) {
    const n = Number(mc[1]);
    if (Number.isFinite(n)) confidence = Math.max(0, Math.min(100, n));
  }

  return {
    intent,
    discovery: { populated: anchors.length > 0, anchors },
    unknowns,
    openJnsp,
    conditions,
    declared: { decision, confidence },
  };
}

// ─── Calcul du verdict gradué ───────────────────────────────────────────────

/**
 * Calcule le verdict Research déterministe à partir du modèle parsé.
 * Fail-closed : Discovery non ancré, JNSP ouvert ou verdict humain absent → JNSP.
 *
 * @param {object} modele — sortie de {@link parserResearch}
 * @returns {{
 *   verdict: 'PASS'|'CONDITIONAL'|'FAIL'|'JNSP',
 *   decision: string|null,
 *   confidence: number,
 *   conditions: string[],
 *   unknowns: string[],
 *   discovery: object,
 *   reasons: string[],
 * }}
 */
export function calculerVerdictResearch(modele) {
  const { discovery, unknowns, openJnsp, conditions, declared } = modele;
  const reasons = [];

  // 1. Discovery obligatoire : pas d'ancrage code → indécidable (anti specs-to-code).
  if (!discovery.populated) {
    reasons.push('Discovery non ancré dans le code (aucun `chemin:ligne` ni `evidence:` cité).');
    return mk('JNSP', null, 0, [], unknowns, discovery, reasons);
  }

  // 2. Inconnues JNSP ouvertes → décision humaine requise.
  if (openJnsp.length > 0) {
    reasons.push(`${openJnsp.length} inconnue(s) JNSP ouverte(s) — à trancher avant un GO/NO-GO.`);
    return mk('JNSP', null, 0, [], unknowns, discovery, reasons);
  }

  // 3. Human Authorship : le verdict d'aller/ne-pas-aller appartient à l'humain.
  if (!declared.decision) {
    reasons.push('Verdict GO/NO-GO non tranché par un humain (ligne `Verdict :` absente).');
    return mk('JNSP', null, 0, [], unknowns, discovery, reasons);
  }

  const conf = declared.confidence != null
    ? declared.confidence
    : Math.max(0, Math.min(100, (CONFIANCE_BASE[declared.decision] ?? 50) - 10 * unknowns.length));

  // 4. Rejet humain (NO-GO/DEFER) : respecté tel quel (l'humain est conservateur).
  if (declared.decision === 'NO-GO' || declared.decision === 'DEFER') {
    reasons.push(`Décision humaine : ${declared.decision}.`);
    return mk('FAIL', declared.decision, conf, [], unknowns, discovery, reasons);
  }

  // 5. GO déclaré mais inconnues non levées → durci en CONDITIONAL GO (machine
  //    conservatrice : on ne masque pas une inconnue derrière un GO franc).
  if (declared.decision === 'GO' && unknowns.length > 0) {
    reasons.push(`GO déclaré durci en CONDITIONAL GO : ${unknowns.length} inconnue(s) non levée(s).`);
    return mk('CONDITIONAL', 'CONDITIONAL GO', conf, conditions.length ? conditions : unknowns, unknowns, discovery, reasons);
  }

  // 6. CONDITIONAL GO : exige des conditions explicites (sinon indécidable).
  if (declared.decision === 'CONDITIONAL GO') {
    const cond = conditions.length ? conditions : unknowns;
    if (cond.length === 0) {
      reasons.push('CONDITIONAL GO sans conditions explicites ni inconnues listées.');
      return mk('JNSP', null, 0, [], unknowns, discovery, reasons);
    }
    reasons.push('Décision humaine : CONDITIONAL GO — conditions à lever.');
    return mk('CONDITIONAL', 'CONDITIONAL GO', conf, cond, unknowns, discovery, reasons);
  }

  // 7. GO franc, aucune inconnue.
  reasons.push('Décision humaine : GO — Discovery ancré, aucune inconnue ouverte.');
  return mk('PASS', 'GO', conf, [], unknowns, discovery, reasons);
}

function mk(verdict, decision, confidence, conditions, unknowns, discovery, reasons) {
  return { verdict, decision, confidence, conditions, unknowns, discovery, reasons };
}

// ─── Chargement d'artefact + émission de verdict ────────────────────────────

/**
 * Localise un artefact Research par identifiant (préfixe) dans `.aiad/research/`.
 *
 * @param {string} projetDir
 * @param {string} id — RESEARCH-NNN(-slug) ou NNN
 * @returns {{ path: string, contenu: string }|null}
 */
export function chargerResearch(projetDir, id) {
  const dir = join(projetDir, '.aiad', 'research');
  if (!existsSync(dir)) return null;
  const prefixe = /^RESEARCH-/i.test(id) ? id : `RESEARCH-${id}`;
  let fichier = readdirSync(dir).find((f) => f.toLowerCase() === `${prefixe.toLowerCase()}.md`);
  if (!fichier) {
    fichier = readdirSync(dir)
      .filter((f) => f.endsWith('.md') && f !== '_index.md')
      .find((f) => f.toLowerCase().startsWith(prefixe.toLowerCase()));
  }
  if (!fichier) return null;
  const path = join(dir, fichier);
  return { path, contenu: readFileSync(path, 'utf-8') };
}

/**
 * Émet le verdict Research (enveloppe canonique + exit code). Sans effet de
 * bord process : retourne `{ code, enveloppe, ... }`.
 *
 * @param {string} projetDir
 * @param {string} id
 * @param {{ json?: boolean, schema?: object, stream?: {write: Function} }} [opts]
 * @returns {{ code: 0|1|2, verdict: string, enveloppe: object, valide: boolean, erreurs: string[] }}
 */
export function emitResearchVerdict(projetDir, id, { json = false, schema = null, stream = process.stdout } = {}) {
  const artefact = chargerResearch(projetDir, id);
  if (!artefact) {
    return emitVerdict({
      verdict: 'JNSP',
      payload: { decision: null, confidence: 0, conditions: [], unknowns: [], discovery: { populated: false, anchors: [] }, reasons: [`Artefact Research introuvable pour « ${id} » — lance d'abord /sdd research.`] },
      schema, json, stream,
    });
  }
  const modele = parserResearch(artefact.contenu);
  const r = calculerVerdictResearch(modele);
  return emitVerdict({
    verdict: r.verdict,
    payload: {
      decision: r.decision,
      confidence: r.confidence,
      conditions: r.conditions,
      unknowns: r.unknowns,
      discovery: r.discovery,
      reasons: r.reasons,
    },
    schema, json, stream,
  });
}

// ─── Prérequis Discovery (consommé par /sdd spec et /sdd exec, §3.5 SPEC-B) ──

/**
 * Vérifie qu'un Intent donné dispose d'une Research liée avec Discovery ancré
 * dans le code. Utilisé comme gate de prérequis avant `/sdd spec` / `/sdd exec`.
 * Fail-closed : aucune Research, Discovery vide ou verdict bloquant → non prêt.
 *
 * @param {string} projetDir
 * @param {string} intentId — INTENT-NNN
 * @returns {{ ready: boolean, research: string|null, verdict: string|null, raison: string }}
 */
export function discoveryPrete(projetDir, intentId) {
  const dir = join(projetDir, '.aiad', 'research');
  if (!existsSync(dir)) {
    return { ready: false, research: null, verdict: null, raison: 'Aucun dossier .aiad/research/ — lance /sdd research.' };
  }
  const cible = (intentId || '').toUpperCase();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md') || f === '_index.md') continue;
    const contenu = readFileSync(join(dir, f), 'utf-8');
    const modele = parserResearch(contenu);
    if (cible && (modele.intent || '').toUpperCase() !== cible) continue;
    const r = calculerVerdictResearch(modele);
    if (!modele.discovery.populated) {
      return { ready: false, research: f.replace(/\.md$/, ''), verdict: r.verdict, raison: 'Discovery non ancré dans le code.' };
    }
    if (r.verdict === 'FAIL') {
      return { ready: false, research: f.replace(/\.md$/, ''), verdict: r.verdict, raison: `Verdict ${r.decision} — passage en SPEC non autorisé sans nouvelle Research.` };
    }
    if (r.verdict === 'JNSP') {
      return { ready: false, research: f.replace(/\.md$/, ''), verdict: r.verdict, raison: r.reasons[0] || 'Verdict JNSP — décision humaine requise.' };
    }
    return { ready: true, research: f.replace(/\.md$/, ''), verdict: r.verdict, raison: 'Research GO/CONDITIONAL GO avec Discovery ancré.' };
  }
  return { ready: false, research: null, verdict: null, raison: `Aucune Research liée à ${intentId || 'cet Intent'} — lance /sdd research.` };
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  parserResearch as parseResearch,
  calculerVerdictResearch as computeResearchVerdict,
  chargerResearch as loadResearch,
  emitResearchVerdict as emitResearch,
  discoveryPrete as discoveryReady,
  ligneAncree as lineAnchored,
};
