// AIAD SDD Mode — Tutoriels in-CLI multiples par domaine (item #126).
//
// **Cap stratégique** : étendre le `tour` générique (#108) avec **4
// tutoriels spécialisés** qui matérialisent un workflow AIAD réaliste
// pour les domaines critiques : auth OIDC, paiement PCI-DSS, RAG LLM,
// export RGPD. Chaque tutoriel :
//
//   1. Crée un Intent Statement réaliste dans `.aiad-tutorial-<domain>/intents/`
//   2. Génère la SPEC associée depuis `templates/.aiad/specs-library/`
//   3. Pose une matrice de traçabilité initiale
//   4. Affiche le workflow agent IA correspondant (commandes à enchaîner)
//
// **Différence avec `tour` (#108)** : `tour` est un parcours unique
// pédagogique générique. Les tutoriels sont **réalistes** : artefacts
// pré-remplis avec contenu domaine réel pour copier-coller.
//
// **Zero-dep** : réutilise `lib/specs-library.js` et `lib/frontmatter.js`.
//
// Documentation : https://aiad.ovh/tutorials

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { interpolerTemplate } from './specs-library.js';
import { C, logHeader } from './term.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LIBRARY_DIR = join(__dirname, '..', 'templates', '.aiad', 'specs-library');

// ─── Catalogue ─────────────────────────────────────────────────────────────

/**
 * Définition des 4 tutoriels initiaux. Chaque tutoriel propose un Intent
 * réaliste + une SPEC du domaine + un workflow d'agent IA recommandé.
 */
export const TUTORIELS = {
  'auth-oidc': {
    title: 'OIDC + PKCE — Authentification utilisateur',
    intent: {
      title: 'Permettre la connexion via un fournisseur OIDC tiers',
      body: [
        '## Pourquoi',
        '',
        'Les utilisateurs préfèrent réutiliser un compte existant (Google, GitHub,',
        'FranceConnect) plutôt que créer un nouveau couple email/mot de passe.',
        '',
        '## Pour qui',
        '',
        'Tout visiteur du service ayant déjà un compte chez l\'un des IdP retenus.',
        '',
        '## Critère de succès',
        '',
        'L\'utilisateur arrive à se connecter en moins de 10 secondes avec',
        '< 3 clics, et la session est tracée pour audit RGPD.',
      ].join('\n'),
    },
    specDomain: 'auth-oidc',
    workflow: [
      '/sdd intent INT-001          # capturer l\'Intent (créé par ce tutoriel)',
      '/sdd spec  INT-001 --ears    # rédiger la SPEC EARS depuis le template auth-oidc',
      '/sdd gate  SPEC-001-1-x      # scoring SQS ≥ 4/5 + revue gouvernance AIAD-RGPD',
      '/sdd exec  SPEC-001-1-x      # implémentation par l\'agent IA',
      '/sdd validate                # validation post-implémentation',
      'aiad-sdd trace --fail-on-gap # vérification traçabilité Intent↔SPEC↔Code',
    ],
  },

  'payment-pci': {
    title: 'Paiement carte PCI-DSS SAQ A + PSD2 SCA',
    intent: {
      title: 'Permettre le paiement par carte bancaire en respectant PCI-DSS et PSD2',
      body: [
        '## Pourquoi',
        '',
        'Encaisser les achats sans manipuler de données carte côté serveur',
        '(éligibilité SAQ A : moins d\'audit, moins de risque, moins de coût).',
        '',
        '## Pour qui',
        '',
        'Acheteur final B2C ou B2B avec une carte Visa/Mastercard/CB acceptée.',
        '',
        '## Critère de succès',
        '',
        'Paiement < 30s end-to-end, SCA déclenchée selon les règles PSD2 RTS',
        '(montant > 30€, comportement à risque), aucune donnée PAN/CVV ne',
        'transite par les serveurs propres.',
      ].join('\n'),
    },
    specDomain: 'payment-pci',
    workflow: [
      '/sdd intent INT-001',
      '/sdd spec  INT-001 --ears',
      '/sdd gate  SPEC-001-1-x      # gouvernance AIAD-RGPD + AIAD-CRA',
      '/aiad gouvernance lint        # détecte contradictions PCI vs RGPD',
      '/sdd exec  SPEC-001-1-x',
      'aiad-sdd verify-reproducibility  # check supply-chain du SDK paiement',
    ],
  },

  'rag-llm': {
    title: 'RAG (Retrieval-Augmented Generation) — chatbot documenté',
    intent: {
      title: 'Permettre aux clients d\'interroger la documentation en langage naturel',
      body: [
        '## Pourquoi',
        '',
        'Réduire le volume de tickets support de niveau 1 (questions à réponse',
        'déjà documentée) en offrant un assistant IA qui cite ses sources.',
        '',
        '## Pour qui',
        '',
        'Clients authentifiés du service, équipes support en interne.',
        '',
        '## Critère de succès',
        '',
        '≥ 70% des questions reçoivent une réponse correcte avec citation des',
        'sources, hallucination détectée < 5% (mesure manuelle hebdomadaire).',
      ].join('\n'),
    },
    specDomain: 'rag-llm',
    workflow: [
      '/sdd intent INT-001',
      '/sdd spec  INT-001 --ears',
      '/sdd gate  SPEC-001-1-x       # gouvernance AIAD-AI-ACT + AIAD-RGPD',
      'aiad-sdd dpia                 # AIPD Article 35 RGPD pour traitement IA',
      'aiad-sdd ai-act audit         # documentation Annexe IV AI Act',
      '/sdd exec  SPEC-001-1-x',
    ],
  },

  'gdpr-data-export': {
    title: 'Export RGPD — Articles 15 + 20 (accès + portabilité)',
    intent: {
      title: 'Permettre aux utilisateurs d\'exporter une copie complète de leurs données',
      body: [
        '## Pourquoi',
        '',
        'RGPD Article 15 (droit d\'accès) + Article 20 (portabilité) : obligation',
        'légale, sanctions CNIL jusqu\'à 4% du CA mondial annuel.',
        '',
        '## Pour qui',
        '',
        'Tout utilisateur authentifié du service.',
        '',
        '## Critère de succès',
        '',
        'L\'export est livré dans les **1 mois maximum** (Article 12.3 RGPD),',
        'format structuré machine-readable (JSON), signé pour intégrité, et',
        'inclut toutes les sources : DB, indexes search, backups actifs.',
      ].join('\n'),
    },
    specDomain: 'gdpr-data-export',
    workflow: [
      '/sdd intent INT-001',
      '/sdd spec  INT-001 --ears',
      '/sdd gate  SPEC-001-1-x',
      'aiad-sdd dpia                # AIPD obligatoire (traitement à risque)',
      'aiad-sdd sovereignty --check # exit 1 si score EU Sovereignty < 60',
      '/sdd exec  SPEC-001-1-x',
    ],
  },
};

// ─── Listing / lookup ─────────────────────────────────────────────────────

export function listerTutoriels() {
  return Object.entries(TUTORIELS).map(([id, t]) => ({
    id, title: t.title, specDomain: t.specDomain,
  }));
}

export function tutorielExiste(id) {
  return Object.prototype.hasOwnProperty.call(TUTORIELS, id);
}

// ─── Génération projet jouet ──────────────────────────────────────────────

/**
 * Exécute le tutoriel : crée Intent + SPEC dans `.aiad-tutorial-<id>/`.
 *
 * @param {string} racine
 * @param {string} id
 * @param {{ out?: string, json?: boolean }} [options]
 */
export function executerTutoriel(racine, id, options = {}) {
  const t = TUTORIELS[id];
  if (!t) {
    throw new Error(`Tutoriel inconnu : "${id}". Disponibles : ${Object.keys(TUTORIELS).join(', ')}.`);
  }
  const dir = join(racine, options.out || `.aiad-tutorial-${id}`);
  mkdirSync(join(dir, 'intents'), { recursive: true });
  mkdirSync(join(dir, 'specs'), { recursive: true });
  mkdirSync(join(dir, 'metrics', 'traceability'), { recursive: true });

  // 1. Intent
  const intentId = 'INT-001';
  const intentPath = join(dir, 'intents', `${intentId}-${id}.md`);
  const intentContent = [
    '---',
    `title: ${t.intent.title}`,
    `createdAt: ${new Date().toISOString().slice(0, 10)}`,
    `author: tutorial-aiad-sdd`,
    `domain: ${id}`,
    '---',
    '',
    `# ${t.intent.title}`,
    '',
    t.intent.body,
  ].join('\n');
  writeFileSync(intentPath, intentContent, 'utf-8');

  // 2. SPEC depuis specs-library (template du domaine)
  const specId = `SPEC-001-1-${id}`;
  const specPath = join(dir, 'specs', `${specId}.md`);
  const templatePath = join(LIBRARY_DIR, `${t.specDomain}.md`);
  let specContent;
  if (existsSync(templatePath)) {
    const raw = readFileSync(templatePath, 'utf-8');
    specContent = interpolerTemplate(raw, {
      title: t.intent.title,
      parent_intent: intentId,
      spec_id: specId,
      idp: 'GoogleOIDC',
      service: id,
    });
  } else {
    specContent = `---\ntitle: ${t.intent.title}\nintent: ${intentId}\n---\n# ${t.intent.title}\n\n_(SPEC template absent pour ${t.specDomain})_`;
  }
  writeFileSync(specPath, specContent, 'utf-8');

  // 3. Matrice de traçabilité initiale (1 gap : SPEC sans code, normal en démo)
  const matrixPath = join(dir, 'metrics', 'traceability', 'matrix.json');
  writeFileSync(matrixPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    intents: [{ id: intentId, specs: [specId] }],
    specs: [{ id: specId, code: [], tests: [] }],
    gaps: [{
      kind: 'spec-without-code',
      spec: specId,
      message: '(démo) SPEC sans implémentation — c\'est normal pour ce tutoriel.',
    }],
  }, null, 2), 'utf-8');

  const resultat = {
    tutoriel: id,
    dir: dir.replace(racine + '/', ''),
    intent: intentPath.replace(racine + '/', ''),
    spec: specPath.replace(racine + '/', ''),
    matrice: matrixPath.replace(racine + '/', ''),
    workflow: t.workflow,
  };

  if (options.json) {
    process.stdout.write(JSON.stringify(resultat, null, 2) + '\n');
    return resultat;
  }

  logHeader(`AIAD SDD — Tutoriel : ${t.title}`, `Projet jouet créé dans ${resultat.dir}/`);
  console.log(`  ${C.vert}✓${C.reset} Intent  : ${resultat.intent}`);
  console.log(`  ${C.vert}✓${C.reset} SPEC    : ${resultat.spec}`);
  console.log(`  ${C.vert}✓${C.reset} Matrice : ${resultat.matrice}`);
  console.log('');
  console.log(`  ${C.gras}Workflow recommandé pour ce domaine${C.reset}`);
  for (const cmd of t.workflow) {
    console.log(`    ${C.cyan}$ ${cmd}${C.reset}`);
  }
  console.log('');
  console.log(`  ${C.gris}Pour nettoyer : rm -rf ${resultat.dir}${C.reset}\n`);
  return resultat;
}

// ─── Listing CLI ──────────────────────────────────────────────────────────

export function afficherListe(options = {}) {
  const tuts = listerTutoriels();
  if (options.json) {
    process.stdout.write(JSON.stringify({ tutoriels: tuts }, null, 2) + '\n');
    return tuts;
  }
  logHeader('AIAD SDD — Tutoriels disponibles', `${tuts.length} tutoriels par domaine`);
  for (const t of tuts) {
    console.log(`  ${C.cyan}${t.id.padEnd(20)}${C.reset} ${t.title}`);
    console.log(`    ${C.gris}SPEC template : ${t.specDomain}${C.reset}`);
  }
  console.log('');
  console.log(`  ${C.gris}Usage : aiad-sdd tutorial <id>${C.reset}\n`);
  return tuts;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  TUTORIELS as TUTORIALS,
  listerTutoriels as listTutorials,
  tutorielExiste as tutorialExists,
  executerTutoriel as runTutorial,
  afficherListe as showList,
};
