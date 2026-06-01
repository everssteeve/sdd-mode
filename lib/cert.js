// AIAD SDD Mode — Programme de certification Product Engineer AIAD.
//
// **Matrice 5 × 6** : 5 niveaux (Découvreur / Praticien / Confirmé /
// Expert / Architecte) × 6 axes (Intent Authorship, SPEC Quality,
// Drift Lock, Gouvernance Tier 1, Multi-runtime, Métriques DORA/Flow).
//
// **Badge JWS signé** : format JSON Web Signature (RFC 7515) via HMAC-SHA256
// (default) ou Ed25519 (option). **Cap stratégique** : pas de NFT, pas de
// blockchain — un JWS local est suffisant, vérifiable hors-ligne, gratuit
// pour l'organisation et le candidat. Souveraineté complète.
//
// **Exam** : génération d'un sujet pratique reproductible par seed.
//
// **Configuration** : variable d'environnement `AIAD_CERT_SECRET` (HMAC) ou
// `AIAD_CERT_PRIVATE_KEY` / `AIAD_CERT_PUBLIC_KEY` (Ed25519).
//
// Documentation : https://aiad.ovh

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// ─── Matrice de compétences ─────────────────────────────────────────────────

export const NIVEAUX = ['Découvreur', 'Praticien', 'Confirmé', 'Expert', 'Architecte'];

export const AXES = [
  { id: 'intent', label: 'Intent Authorship' },
  { id: 'spec', label: 'SPEC Quality' },
  { id: 'drift', label: 'Drift Lock' },
  { id: 'gouvernance', label: 'Gouvernance Tier 1' },
  { id: 'multi-runtime', label: 'Multi-runtime' },
  { id: 'metriques', label: 'Métriques DORA/Flow' },
];

/**
 * Matrice 5 × 6 : pour chaque (niveau, axe), le critère mesurable.
 * Lecture : `MATRICE[niveau][axe]` = critère.
 */
export const MATRICE = {
  Découvreur: {
    intent: 'A rédigé son premier Intent Statement avec un POURQUOI clair (≥ 50 caractères, sans copier le pattern par défaut).',
    spec: 'A rédigé une SPEC en prose qui passe `/sdd gate` (SQS ≥ 4/5).',
    drift: 'Comprend le concept de Drift Lock et sait expliquer pourquoi le hook pre-commit existe.',
    gouvernance: 'Connaît les 5 agents Tier 1 EU (AI-ACT, RGPD, RGAA, RGESN, CRA) et sait quand chacun s\'applique.',
    'multi-runtime': 'A initialisé un projet AIAD avec Claude Code et a vu `aiad-sdd emit-rules` régénérer AGENTS.md.',
    metriques: 'Sait nommer les 4 métriques DORA (Deployment Frequency, Lead Time, CFR, MTTR) et les 5 Flow Metrics.',
  },
  Praticien: {
    intent: 'A rédigé ≥ 5 Intents avec frontière (ce qui n\'est pas inclus) explicite + indicateur de succès.',
    spec: 'A rédigé une SPEC en format EARS strict qui passe le linter R1-R7 sans violation.',
    drift: 'A vécu un déclenchement réel du hook pre-commit et a remédié (mise à jour SPEC + code dans même PR).',
    gouvernance: 'A consulté un agent Tier 1 sur une décision réelle et a documenté l\'arbitrage dans la SPEC.',
    'multi-runtime': 'A configuré 2+ runtimes (claude-code + cursor ou autre) et géré les drifts via `emit-rules --check`.',
    metriques: 'Lit le dashboard `aiad-sdd dashboard --serve` et identifie les régressions DORA/Flow d\'une release.',
  },
  Confirmé: {
    intent: 'Mène un Atelier d\'Intention (`/aiad intention`) — facilitation Human Authorship pure (espace sans IA).',
    spec: 'Découpe une SPEC volumineuse via `/sdd split` selon le principe d\'atomicité (une seule responsabilité).',
    drift: 'Configure le mode pre-commit (off/warn/block) et la whitelist `allowed_paths` pour le contexte projet.',
    gouvernance: 'A produit un audit IA Act complet (`aiad-sdd ai-act audit`) et l\'a fait valider par un juriste.',
    'multi-runtime': 'A déployé AIAD sur ≥ 3 runtimes (Claude + Cursor + Gemini ou GitHub Copilot) avec parité CI.',
    metriques: 'Configure les seuils d\'alerte sur le dashboard et déclenche les rituels `/aiad retro` data-driven.',
  },
  Expert: {
    intent: 'A formé ≥ 3 nouveaux praticiens à l\'Intent Authorship (mentor reconnu dans le projet).',
    spec: 'A rédigé une SPEC modèle réutilisée par d\'autres équipes (template `.aiad/specs-library/`) accepté en mainline.',
    drift: 'A intégré le Drift Lock dans une CI multi-environnements (préprod/prod) avec stratégie d\'exception documentée.',
    gouvernance: 'A étendu la gouvernance avec un pack custom (CRA + DORA + DSA selon le secteur) marketplace-validé.',
    'multi-runtime': 'A contribué à `aiad-sdd emit-rules` pour un nouveau runtime IA (PR mergée).',
    metriques: 'A construit un tableau de bord BI externe (Grafana / Metabase) consommant `aiad-sdd doctor --json` + trace.',
  },
  Architecte: {
    intent: 'A défini la doctrine d\'Intent Authorship pour une organisation de ≥ 50 développeurs (ESN ou grand groupe).',
    spec: 'A architecturé un référentiel SPECs partagé inter-équipes avec traçabilité @spec préservée à l\'échelle.',
    drift: 'A conçu la gouvernance Drift Lock pour un monorepo de ≥ 100k fichiers (cache + workers + politiques par équipe).',
    gouvernance: 'A représenté l\'organisation auprès d\'un régulateur EU (CNIL, ANSSI, AGID, BfDI…) sur la conformité IA.',
    'multi-runtime': 'A piloté la stratégie multi-IA d\'une organisation (sélection runtime, négociation contractuelle, gouvernance données).',
    metriques: 'A piloté l\'amélioration DORA / Flow d\'une organisation sur ≥ 12 mois avec gain mesurable (ex. CFR -30 %).',
  },
};

// ─── Fonctions pures (testables) ────────────────────────────────────────────

/**
 * Encode une string en base64url (RFC 7515).
 */
export function base64urlEncode(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function base64urlDecode(input) {
  const padded = input + '='.repeat((4 - input.length % 4) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

/**
 * Construit le payload du badge.
 *
 * @param {{ candidat: string, niveau: string, axes: string[], examIso?: string, issuer?: string }} input
 * @returns {object}
 */
export function construirePayload(input) {
  if (!NIVEAUX.includes(input.niveau)) {
    throw new Error(`Niveau invalide : "${input.niveau}". Valides : ${NIVEAUX.join(', ')}.`);
  }
  if (!Array.isArray(input.axes) || input.axes.length === 0) {
    throw new Error('axes doit être un tableau non vide des axes validés.');
  }
  const axesValides = new Set(AXES.map((a) => a.id));
  const inconnus = input.axes.filter((a) => !axesValides.has(a));
  if (inconnus.length > 0) {
    throw new Error(`Axes inconnus : ${inconnus.join(', ')}. Valides : ${[...axesValides].join(', ')}.`);
  }
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: input.issuer || 'AIAD SDD',
    sub: input.candidat,
    niveau: input.niveau,
    axes: input.axes,
    iat: now,
    exp: now + 3 * 365 * 24 * 3600, // 3 ans
    examPasse: input.examIso || new Date().toISOString().slice(0, 10),
    fmt: 'aiad-cert-v1',
  };
}

/**
 * Signe le badge en JWS (HS256) — format RFC 7515 compact.
 *
 * @param {object} payload
 * @param {string} secret — clé HMAC partagée
 * @returns {string} JWS compact `header.payload.signature`
 */
export function signerBadge(payload, secret) {
  if (typeof secret !== 'string' || secret.length < 16) {
    throw new Error('AIAD_CERT_SECRET requis (≥ 16 caractères) pour signer le badge.');
  }
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = createHmac('sha256', secret).update(signingInput).digest();
  const sigB64 = sig.toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${signingInput}.${sigB64}`;
}

/**
 * Vérifie un badge JWS et retourne le payload si la signature est valide.
 *
 * @param {string} jws
 * @param {string} secret
 * @returns {{ valid: boolean, payload: object|null, raison?: string }}
 */
export function verifierBadge(jws, secret) {
  const parts = String(jws).split('.');
  if (parts.length !== 3) return { valid: false, payload: null, raison: 'format JWS invalide (attendu 3 parties)' };
  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const sigAttendue = createHmac('sha256', secret).update(signingInput).digest();
  let sigRecue;
  try {
    sigRecue = Buffer.from(sigB64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - sigB64.length % 4) % 4), 'base64');
  } catch { return { valid: false, payload: null, raison: 'signature illisible' }; }
  if (sigRecue.length !== sigAttendue.length) return { valid: false, payload: null, raison: 'signature de longueur invalide' };
  if (!timingSafeEqual(sigRecue, sigAttendue)) return { valid: false, payload: null, raison: 'signature ne match pas' };

  let payload;
  try { payload = JSON.parse(base64urlDecode(payloadB64)); }
  catch { return { valid: false, payload: null, raison: 'payload non-JSON' }; }

  // Validations business
  if (payload.fmt !== 'aiad-cert-v1') return { valid: false, payload, raison: 'format inconnu' };
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    return { valid: false, payload, raison: 'badge expiré' };
  }
  return { valid: true, payload };
}

/**
 * Génère un sujet d'examen reproductible par seed.
 *
 * @param {string} niveau
 * @param {{ seed?: number }} [options]
 * @returns {{ niveau: string, sujet: string, axesEvalues: string[] }}
 */
export function genererSujetExam(niveau, options = {}) {
  if (!NIVEAUX.includes(niveau)) {
    throw new Error(`Niveau invalide : "${niveau}".`);
  }
  const axesEvalues = AXES.map((a) => a.id); // tous les 6 axes par défaut
  const lignes = [];
  lignes.push(`# Examen pratique AIAD SDD — Niveau ${niveau}`);
  lignes.push('');
  lignes.push(`> Sujet généré par \`aiad-sdd cert exam ${niveau.toLowerCase()}\`. Durée recommandée : 2-4 heures (Praticien) à 1 jour (Architecte). Reporting au mentor / examinateur référencé dans le badge.`);
  lignes.push('');
  lignes.push('## Compétences évaluées');
  lignes.push('');
  for (const axe of AXES) {
    const critere = MATRICE[niveau][axe.id];
    lignes.push(`- **${axe.label}** — ${critere}`);
  }
  lignes.push('');
  lignes.push('## Épreuves');
  lignes.push('');
  lignes.push(`### Épreuve 1 — Intent Authorship`);
  lignes.push(`Rédige un Intent Statement complet sur un cas métier de ton choix (ou imposé par l'examinateur). Critères : POURQUOI explicite ≥ 50 caractères, conséquence si rien, frontière, indicateur de succès.`);
  lignes.push('');
  lignes.push(`### Épreuve 2 — SPEC Quality`);
  lignes.push(`Rédige une SPEC en format EARS strict liée à l'Intent ci-dessus. Lance \`/sdd gate\` ; vise SQS ≥ 4/5 sans violation R1-R7.`);
  lignes.push('');
  lignes.push(`### Épreuve 3 — Implémentation + Drift Lock`);
  lignes.push(`Implémente la SPEC dans un projet réel (Node, Python ou Rust). Annotations \`@spec\`/\`@verified-by\`/\`@governance\` posées. Le hook pre-commit doit s'activer si tu modifies du code sans toucher la SPEC.`);
  lignes.push('');
  lignes.push(`### Épreuve 4 — Gouvernance Tier 1`);
  lignes.push(`Identifie les agents applicables (RGPD, AI-ACT, CRA, RGAA, RGESN…) et documente l'arbitrage si conflit. Si AI Act haut risque : \`aiad-sdd ai-act audit\`. Si données personnelles : \`aiad-sdd dpia\`.`);
  lignes.push('');
  lignes.push(`### Épreuve 5 — Multi-runtime`);
  lignes.push(`Configure ≥ 2 runtimes IA (\`init --runtime claude-code,cursor\`) et démontre la parité \`emit-rules --check\` sans drift.`);
  lignes.push('');
  lignes.push(`### Épreuve 6 — Métriques`);
  lignes.push(`Génère le dashboard (\`aiad-sdd dashboard\`), commente les 4 métriques DORA et 5 Flow, identifie au moins une amélioration data-driven.`);
  lignes.push('');
  lignes.push('## Validation');
  lignes.push('');
  lignes.push(`L'examinateur signe le badge avec \`aiad-sdd cert badge --niveau ${niveau} --candidat <nom>\`. Configure \`AIAD_CERT_SECRET\` (HMAC partagé organisation/individu).`);
  lignes.push('');
  return {
    niveau,
    sujet: lignes.join('\n'),
    axesEvalues,
  };
}

/**
 * Construit la matrice Markdown pour affichage.
 */
export function rendreMatriceMarkdown() {
  const lignes = [];
  lignes.push('# Matrice de compétences AIAD SDD — Product Engineer');
  lignes.push('');
  lignes.push(`> 5 niveaux × 6 axes. Chaque cellule liste un critère mesurable. La certification (\`aiad-sdd cert badge\`) requiert que les 6 axes soient validés au niveau visé.`);
  lignes.push('');
  for (const niveau of NIVEAUX) {
    lignes.push(`## Niveau — ${niveau}`);
    lignes.push('');
    for (const axe of AXES) {
      lignes.push(`### ${axe.label}`);
      lignes.push('');
      lignes.push(MATRICE[niveau][axe.id]);
      lignes.push('');
    }
  }
  return lignes.join('\n');
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  NIVEAUX as LEVELS,
  AXES as AXES_LIST,
  MATRICE as MATRIX,
  construirePayload as buildPayload,
  signerBadge as signBadge,
  verifierBadge as verifyBadge,
  genererSujetExam as generateExamSubject,
  rendreMatriceMarkdown as renderMatrixMarkdown,
};
