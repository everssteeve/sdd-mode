// AIAD SDD Mode — Audit IA Act formel (Règlement UE 2024/1689).
//
// Produit un rapport conforme à l'**Annexe IV** du Règlement UE 2024/1689
// (technical documentation requirements pour systèmes IA classés haut risque).
// Utilise les artefacts AIAD existants (Intents, SPECs, gouvernance Tier 1,
// matrice de traçabilité, code annoté `@governance AIAD-AI-ACT`) pour
// pré-remplir ce qui peut l'être ; les éléments légaux ou contextuels
// que l'humain doit fournir sont marqués `(à compléter)`.
//
// **Cap stratégique** : argument vente unique sur le marché EU. Aucun autre
// framework SDD ne génère ce rapport automatiquement. Ce n'est PAS un
// substitut au travail légal — c'est un point de départ qui factorise
// 80 % du remplissage technique.
//
// Annexe IV (résumé des 8 sections) :
//   1. Description générale (purpose, version, fournisseur)
//   2. Description détaillée du développement
//   3. Monitoring et contrôle
//   4. Système de gestion des risques (Article 9)
//   5. Changements significatifs apportés au système
//   6. Standards harmonisés appliqués (HHS / EN ISO/IEC)
//   7. Déclaration UE de conformité
//   8. Système de monitoring post-marché (Article 72)
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { C, log, logHeader } from './term.js';
import { syncFile } from './fs-ops.js';
import { parseFrontmatter } from './frontmatter.js';
import { construireMatrice, scanCode } from './sdd-trace.js';

// ─── Détection des éléments AI Act ──────────────────────────────────────────

/**
 * Identifie les SPECs marquées comme touchant un composant IA (governance:
 * AIAD-AI-ACT dans le frontmatter ou champ "Gouvernance" dans le corps).
 */
function lireSpecsAiAct(racine) {
  const dir = join(racine, '.aiad', 'specs');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir)) {
    if (!nom.endsWith('.md') || nom.startsWith('_') || nom.startsWith('spec-ears-template')) continue;
    const m = nom.match(/^(SPEC-[A-Za-z0-9-]+)\.md$/);
    if (!m) continue;
    const path = join(dir, nom);
    const contenu = readFileSync(path, 'utf-8');
    const { data, body } = parseFrontmatter(contenu);
    const govFm = data.governance ? String(data.governance) : '';
    const govBody = (body.match(/Gouvernance applicable[^\n]*\n([^#]+)/i) || [])[1] || '';
    if (/AIAD-AI-ACT/i.test(govFm) || /AIAD-AI-ACT/i.test(govBody)) {
      out.push({
        id: m[1],
        title: data.title || data.titre || m[1],
        status: data.status || data.statut || 'unknown',
        parent_intent: data.parent_intent || null,
      });
    }
  }
  return out;
}

/**
 * Identifie les fichiers code annotés `@governance AIAD-AI-ACT,...`.
 */
function lireCodeAiAct(racine) {
  let fichiers;
  try { fichiers = scanCode(racine); }
  catch { return []; }
  return fichiers
    .filter((f) => (f.annotations.governance || []).some((g) => g.tags.includes('AIAD-AI-ACT')))
    .map((f) => ({ path: f.path, isTest: f.isTest, specs: f.annotations.specs.map((s) => s.id) }));
}

/**
 * Lit `.aiad/gouvernance/AIAD-AI-ACT.md` et retourne true si l'agent Tier 1
 * est installé (élément 6 de l'Annexe IV : application des standards
 * harmonisés — l'agent EU AI Act fait office de référentiel internalisé).
 */
function lireAgentAiAct(racine) {
  const path = join(racine, '.aiad', 'gouvernance', 'AIAD-AI-ACT.md');
  if (!existsSync(path)) return null;
  const contenu = readFileSync(path, 'utf-8');
  return {
    path: path,
    refConstitutionnel: /Règlement \(UE\) 2024\/1689|EU AI Act/i.test(contenu),
    aMission: /MISSION/i.test(contenu),
    aRegles: /TOUJOURS|JAMAIS/i.test(contenu),
  };
}

function lirePackageProject(racine) {
  const p = join(racine, 'package.json');
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf-8')); }
  catch { return {}; }
}

function lirePRD(racine) {
  const p = join(racine, '.aiad', 'PRD.md');
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf-8');
}

// ─── Génération du rapport Annexe IV ────────────────────────────────────────

function genererRapport({ racine, projet, specs, code, agent, prd, matrice, dateAudit }) {
  const lignes = [];
  lignes.push('---');
  lignes.push('title: Audit IA Act — Documentation technique (Annexe IV)');
  lignes.push(`generated-by: aiad-sdd ai-act audit`);
  lignes.push(`date: ${dateAudit}`);
  lignes.push(`project: ${projet.name || 'TODO'}`);
  lignes.push(`project-version: ${projet.version || 'TODO'}`);
  lignes.push('reference: Règlement (UE) 2024/1689 (EU AI Act), Annexe IV');
  lignes.push('---');
  lignes.push('');
  lignes.push(`# Audit IA Act — Documentation technique`);
  lignes.push('');
  lignes.push(`> Rapport pré-rempli automatiquement par \`aiad-sdd ai-act audit\` sur la base des artefacts AIAD du projet. **Ce n'est pas un substitut au travail légal** — l'humain doit valider, compléter les sections \`(à compléter)\` et signer la déclaration de conformité finale (section 7).`);
  lignes.push('');
  lignes.push(`**Référence** : Règlement (UE) 2024/1689, Annexe IV — *Technical documentation referred to in Article 11(1)*.`);
  lignes.push(`**Date** : ${dateAudit}`);
  lignes.push(`**Projet** : ${projet.name || '(à compléter)'} — version ${projet.version || '(à compléter)'}`);
  lignes.push('');

  // SECTION 1 — Description générale
  lignes.push('## 1. Description générale du système IA');
  lignes.push('');
  lignes.push(`### 1.1 Fournisseur`);
  lignes.push(`- **Nom** : ${projet.author || '(à compléter — nom légal de l\'organisation responsable)'}`);
  lignes.push(`- **Adresse** : *(à compléter — siège social UE ou représentant désigné Article 25)*`);
  lignes.push(`- **Contact** : ${projet.author && projet.author.match(/<([^>]+)>/) ? projet.author.match(/<([^>]+)>/)[1] : '(à compléter)'}`);
  lignes.push('');
  lignes.push(`### 1.2 Système IA`);
  lignes.push(`- **Nom** : ${projet.name || '(à compléter)'}`);
  lignes.push(`- **Version** : ${projet.version || '(à compléter)'}`);
  lignes.push(`- **Description** : ${projet.description || '(à compléter — usage prévu, marché EU cible, finalité)'}`);
  lignes.push(`- **Classification AI Act** : *(à compléter — système haut risque selon Annexe III ? GPAI ? système prohibé Article 5 ?)*`);
  lignes.push('');
  if (prd) {
    lignes.push(`### 1.3 PRD lié`);
    lignes.push(`Le Product Requirements Document complet est conservé dans \`.aiad/PRD.md\`.`);
    lignes.push('');
  }

  // SECTION 2 — Description détaillée du développement
  lignes.push('## 2. Description détaillée du développement');
  lignes.push('');
  lignes.push(`### 2.1 Méthodologie`);
  lignes.push(`Le système est développé selon le **framework AIAD SDD Mode** : cycle Intent → SPEC → Execution Gate (SQS ≥ 4/5) → Exécution → Validation → Drift Lock. Source ouverte (MIT), zero-dep runtime, traçabilité machine-vérifiable.`);
  lignes.push('');
  lignes.push(`### 2.2 SPECs touchant des composants IA`);
  lignes.push('');
  if (specs.length === 0) {
    lignes.push('*Aucune SPEC marquée \`@governance AIAD-AI-ACT\`. Si le système contient des composants IA, identifier explicitement les SPECs concernées via le frontmatter \`governance: AIAD-AI-ACT\`.*');
  } else {
    lignes.push('| SPEC | Titre | Statut | Intent |');
    lignes.push('|------|-------|--------|--------|');
    for (const s of specs) {
      lignes.push(`| \`${s.id}\` | ${s.title} | ${s.status} | ${s.parent_intent || '*(non lié)*'} |`);
    }
  }
  lignes.push('');
  lignes.push(`### 2.3 Code applicatif annoté \`@governance AIAD-AI-ACT\``);
  lignes.push('');
  if (code.length === 0) {
    lignes.push('*Aucun fichier code annoté \`@governance AIAD-AI-ACT\`. Si le système touche un composant IA (ML / LLM / scoring), annoter les fichiers concernés.*');
  } else {
    lignes.push(`${code.length} fichier(s) annoté(s) :`);
    lignes.push('');
    for (const f of code.slice(0, 50)) {
      lignes.push(`- \`${f.path}\`${f.isTest ? ' *(test)*' : ''} ${f.specs.length ? `→ ${f.specs.join(', ')}` : ''}`);
    }
    if (code.length > 50) lignes.push(`- *(+${code.length - 50} autres)*`);
  }
  lignes.push('');
  lignes.push(`### 2.4 Données d'entraînement, validation, test`);
  lignes.push('*(à compléter — origine, qualité, biais identifiés, mesures de mitigation, période de collecte, base légale RGPD pour les données personnelles)*');
  lignes.push('');

  // SECTION 3 — Monitoring et contrôle
  lignes.push('## 3. Monitoring, fonctionnement et contrôle');
  lignes.push('');
  lignes.push(`### 3.1 Traçabilité automatique`);
  lignes.push('La matrice machine-vérifiable Intent ↔ SPEC ↔ Code ↔ Tests est régénérée à chaque PR via `aiad-sdd trace --fail-on-gap`. Les gaps bloquants déclenchent un échec CI.');
  lignes.push('');
  if (matrice && matrice.summary) {
    lignes.push(`État courant :`);
    lignes.push(`- Intents : ${matrice.summary.intents}`);
    lignes.push(`- SPECs : ${matrice.summary.specs}`);
    lignes.push(`- Code annoté : ${matrice.summary.annotatedCodeFiles}/${matrice.summary.codeFiles}`);
    lignes.push(`- Tests annotés : ${matrice.summary.annotatedTestFiles}/${matrice.summary.testFiles}`);
    lignes.push('');
  }
  lignes.push(`### 3.2 Contrôle humain (Article 14)`);
  lignes.push('*(à compléter — mécanismes d\'intervention humaine, procédure d\'arrêt, supervision par opérateur qualifié)*');
  lignes.push('');
  lignes.push(`### 3.3 Mesures techniques de robustesse, précision, cybersécurité (Article 15)`);
  lignes.push('*(à compléter — métriques de performance, plage d\'erreur acceptable, résistance aux attaques adverses, plan de continuité)*');
  lignes.push('');

  // SECTION 4 — Système de gestion des risques (Article 9)
  lignes.push('## 4. Système de gestion des risques (Article 9)');
  lignes.push('');
  lignes.push('Le projet utilise le **Drift Lock** machine-vérifiable comme premier niveau de gestion des risques techniques :');
  lignes.push('- Toute modification de code applicatif doit être accompagnée d\'une mise à jour SPEC dans la même PR (hook pre-commit).');
  lignes.push('- Toute SPEC est validée par un Execution Gate (SQS ≥ 4/5) avant exécution.');
  lignes.push('- Les agents Tier 1 (RGPD, AI-ACT, RGAA, RGESN) ont un droit de veto.');
  lignes.push('');
  lignes.push(`Risques sectoriels et plan de mitigation : *(à compléter)*`);
  lignes.push('');

  // SECTION 5 — Changements significatifs
  lignes.push('## 5. Changements significatifs apportés au système');
  lignes.push('');
  lignes.push('Voir `.aiad/CHANGELOG-ARTEFACTS.md` (historique des modifications structurelles des artefacts AIAD) et l\'historique git du projet.');
  lignes.push('');

  // SECTION 6 — Standards harmonisés
  lignes.push('## 6. Standards harmonisés appliqués');
  lignes.push('');
  if (agent) {
    lignes.push(`- **AIAD-AI-ACT (agent Tier 1)** installé dans \`.aiad/gouvernance/AIAD-AI-ACT.md\` ${agent.refConstitutionnel ? '✓ référentiel constitutionnel cité' : '⚠ référentiel à vérifier'}.`);
  } else {
    lignes.push('- ⚠ **AIAD-AI-ACT manquant** — installer via `npx aiad-sdd gouvernance` avant déploiement.');
  }
  lignes.push('- *(à compléter — autres standards harmonisés appliqués : EN ISO/IEC 23894:2023, EN ISO/IEC 42001:2023, etc.)*');
  lignes.push('');

  // SECTION 7 — Déclaration UE de conformité
  lignes.push('## 7. Déclaration UE de conformité');
  lignes.push('');
  lignes.push('*(à compléter — copie de la déclaration UE de conformité signée Article 47 + format Annexe V)*');
  lignes.push('');

  // SECTION 8 — Monitoring post-marché
  lignes.push('## 8. Système de monitoring post-marché (Article 72)');
  lignes.push('');
  lignes.push('Outils techniques disponibles dans le projet :');
  lignes.push('- `aiad-sdd dashboard --serve --watch` (monitoring opérationnel)');
  lignes.push('- `aiad-sdd trace --fail-on-gap` (CI sur chaque PR)');
  lignes.push('- `aiad-sdd doctor --json` (diagnostic agrégé)');
  lignes.push('');
  lignes.push(`Plan post-marché : *(à compléter — collecte d'incidents, retours utilisateurs, déclencheurs d'alerte AI Office Article 73)*`);
  lignes.push('');

  // Pied
  lignes.push('---');
  lignes.push('');
  lignes.push(`*Rapport pré-rempli par \`aiad-sdd ai-act audit\` v${process.env.npm_package_version || '1.14.0'}.*`);
  lignes.push(`*Sections marquées \`(à compléter)\` requièrent intervention humaine — un audit conforme nécessite un juriste qualifié AI Act.*`);
  lignes.push('');

  return lignes.join('\n');
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Exécute l'audit AI Act sur le projet courant.
 *
 * @param {string} racine
 * @param {{ out?: string, dryRun?: boolean, json?: boolean }} [options]
 * @returns {Promise<{ path: string, model: object }>}
 */
export async function audit(racine, options = {}) {
  const { out, dryRun = false, json = false } = options;

  if (!existsSync(join(racine, '.aiad'))) {
    throw new Error(`.aiad/ introuvable. Lance \`aiad-sdd init\` d'abord.`);
  }

  const projet = lirePackageProject(racine);
  const specs = lireSpecsAiAct(racine);
  const code = lireCodeAiAct(racine);
  const agent = lireAgentAiAct(racine);
  const prd = lirePRD(racine);
  let matrice;
  try { matrice = construireMatrice(racine); } catch { matrice = null; }

  const dateAudit = new Date().toISOString().slice(0, 10);
  const model = { projet, specs, code, agent: !!agent, dateAudit, summary: matrice?.summary };

  if (json) {
    process.stdout.write(JSON.stringify(model, null, 2) + '\n');
    return { path: null, model };
  }

  const dest = out
    ? join(racine, out)
    : join(racine, '.aiad', 'metrics', 'ai-act', `AUDIT-${dateAudit}.md`);
  const contenu = genererRapport({ racine, projet, specs, code, agent, prd, matrice, dateAudit });

  logHeader(
    `AIAD SDD — Audit IA Act (Annexe IV)`,
    `Règlement (UE) 2024/1689 — pré-remplissage automatique`,
  );

  const result = syncFile(dest, contenu, { dryRun });
  const sym = result === 'created' ? `${C.vert}+${C.reset}`
    : result === 'updated' ? `${C.cyan}↑${C.reset}`
    : `${C.vert}✓${C.reset}`;
  log(sym, `${dest.replace(racine + '/', '')}${dryRun ? ` ${C.gris}(dry-run)${C.reset}` : ''}`);

  console.log(`
${C.gras}  Synthèse${C.reset}
    SPECs AI Act      : ${C.cyan}${specs.length}${C.reset}
    Fichiers code     : ${C.cyan}${code.length}${C.reset} annotés \`@governance AIAD-AI-ACT\`
    Agent Tier 1      : ${agent ? C.vert + 'présent' : C.rouge + 'manquant'}${C.reset}
    Sections \`(à compléter)\` : ${C.jaune}plusieurs${C.reset} (humain requis)

${C.jaune}${C.gras}  ⚠ Cet audit n'est pas un substitut au travail légal.${C.reset}
${C.gris}  Faire valider par un juriste qualifié AI Act avant déclaration de conformité.${C.reset}
`);

  return { path: dest, model };
}
