// AIAD SDD Mode — DPIA / AIPD automatique (Article 35 RGPD).
//
// Produit un **Data Protection Impact Assessment** (Analyse d'Impact relative à
// la Protection des Données — AIPD côté CNIL) pré-rempli pour les SPECs
// touchant des données personnelles. Référentiel : **Règlement (UE) 2016/679
// (RGPD), Article 35** + lignes directrices **WP248 du CEPD** + référentiel
// CNIL "AIPD : la méthode" (3 étapes / 9 sections).
//
// **Cap stratégique** : extension naturelle du #45 (audit AI Act). Ensemble
// `ai-act audit` + `dpia` couvrent les deux régulations EU lourdes pour les
// systèmes IA. **Aucun autre framework SDD ne génère ces deux rapports
// automatiquement** — argument vente unique sur le marché EU/FR.
//
// Le rapport est un **point de départ technique** qui factorise ~70 % du
// remplissage. Ce n'est PAS un substitut au DPO ni au travail légal — les
// sections marquées `(à compléter)` requièrent intervention humaine.
//
// AIPD — 9 sections (méthode CNIL) :
//   1. Description du traitement (finalités, données, durée, destinataires)
//   2. Évaluation de la nécessité et proportionnalité
//   3. Évaluation des risques pour les droits et libertés
//   4. Mesures techniques et organisationnelles (Article 32)
//   5. Consultation du DPO (Article 39.1.c)
//   6. Consultation préalable de la CNIL (Article 36)
//   7. Validation et signature (responsable du traitement)
//   8. Plan d'action et monitoring (Article 35.11)
//   9. Annexes (registre, base légale, sous-traitants)
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { C, log, logHeader } from './term.js';
import { syncFile } from './fs-ops.js';
import { parseFrontmatter } from './frontmatter.js';
import { construireMatrice, scanCode } from './sdd-trace.js';

// ─── Détection des éléments RGPD ────────────────────────────────────────────

/**
 * Identifie les SPECs marquées comme touchant des données personnelles
 * (governance: AIAD-RGPD dans le frontmatter ou champ "Gouvernance" dans le
 * corps).
 */
function lireSpecsRgpd(racine) {
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
    if (/AIAD-RGPD/i.test(govFm) || /AIAD-RGPD/i.test(govBody)) {
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
 * Identifie les fichiers code annotés `@governance AIAD-RGPD,...`.
 */
function lireCodeRgpd(racine) {
  let fichiers;
  try { fichiers = scanCode(racine); }
  catch { return []; }
  return fichiers
    .filter((f) => (f.annotations.governance || []).some((g) => g.tags.includes('AIAD-RGPD')))
    .map((f) => ({ path: f.path, isTest: f.isTest, specs: f.annotations.specs.map((s) => s.id) }));
}

/**
 * Lit `.aiad/gouvernance/AIAD-RGPD.md` et retourne true si l'agent Tier 1
 * est installé (élément 6 — application des standards harmonisés).
 */
function lireAgentRgpd(racine) {
  const path = join(racine, '.aiad', 'gouvernance', 'AIAD-RGPD.md');
  if (!existsSync(path)) return null;
  const contenu = readFileSync(path, 'utf-8');
  return {
    path,
    refConstitutionnel: /Règlement \(UE\) 2016\/679|RGPD|GDPR/i.test(contenu),
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

// ─── Génération du rapport AIPD ─────────────────────────────────────────────

function genererRapport({ projet, specs, code, agent, prd, matrice, dateAnalyse }) {
  const lignes = [];
  lignes.push('---');
  lignes.push('title: AIPD — Analyse d\'Impact relative à la Protection des Données');
  lignes.push('generated-by: aiad-sdd dpia');
  lignes.push(`date: ${dateAnalyse}`);
  lignes.push(`project: ${projet.name || 'TODO'}`);
  lignes.push(`project-version: ${projet.version || 'TODO'}`);
  lignes.push('reference: Règlement (UE) 2016/679 (RGPD), Article 35 + lignes directrices WP248 CEPD');
  lignes.push('---');
  lignes.push('');
  lignes.push('# AIPD — Analyse d\'Impact relative à la Protection des Données');
  lignes.push('');
  lignes.push('> Rapport pré-rempli automatiquement par `aiad-sdd dpia` sur la base des artefacts AIAD du projet (SPECs marquées `governance: AIAD-RGPD`, code annoté `@governance AIAD-RGPD`, PRD). **Ce n\'est pas un substitut au DPO ni au travail légal** — l\'humain doit valider, compléter les sections `(à compléter)` et faire signer le responsable du traitement (section 7).');
  lignes.push('');
  lignes.push('**Référence** : Règlement (UE) 2016/679 (RGPD), **Article 35** — *Analyse d\'impact relative à la protection des données*. Lignes directrices **WP248** du Comité Européen de la Protection des Données (CEPD). Méthode CNIL "AIPD : la méthode" (3 étapes).');
  lignes.push(`**Date** : ${dateAnalyse}`);
  lignes.push(`**Projet** : ${projet.name || '(à compléter)'} — version ${projet.version || '(à compléter)'}`);
  lignes.push('');

  // SECTION 1 — Description du traitement
  lignes.push('## 1. Description du traitement (Article 35.7.a)');
  lignes.push('');
  lignes.push('### 1.1 Responsable du traitement');
  lignes.push(`- **Nom** : ${projet.author || '(à compléter — nom légal de l\'organisation responsable)'}`);
  lignes.push(`- **Représentant UE** : *(à compléter — Article 27 si responsable hors UE)*`);
  lignes.push(`- **DPO / Délégué** : *(à compléter — coordonnées si désigné Article 37)*`);
  lignes.push('');
  lignes.push('### 1.2 Finalités du traitement');
  lignes.push(`- **Description** : ${projet.description || '(à compléter — finalités précises et déterminées)'}`);
  lignes.push('- **Base légale (Article 6)** : *(à compléter — consentement / contrat / obligation légale / mission d\'intérêt public / intérêts légitimes)*');
  lignes.push('- **Base légale données sensibles (Article 9)** si applicable : *(à compléter)*');
  lignes.push('');
  lignes.push('### 1.3 Catégories de données collectées');
  lignes.push('*(à compléter — données d\'identification / contact / professionnelles / financières / connexion / localisation / sensibles Article 9 / données pénales Article 10)*');
  lignes.push('');
  lignes.push('### 1.4 Catégories de personnes concernées');
  lignes.push('*(à compléter — clients / salariés / mineurs / personnes vulnérables…)*');
  lignes.push('');
  lignes.push('### 1.5 Destinataires');
  lignes.push('*(à compléter — internes / sous-traitants Article 28 / transferts hors UE Article 44)*');
  lignes.push('');
  lignes.push('### 1.6 Durées de conservation');
  lignes.push('*(à compléter — durée active + archivage intermédiaire + suppression définitive)*');
  lignes.push('');

  // SECTION 2 — Nécessité et proportionnalité
  lignes.push('## 2. Évaluation de la nécessité et proportionnalité (Article 35.7.b)');
  lignes.push('');
  lignes.push('### 2.1 SPECs touchant des données personnelles');
  lignes.push('');
  if (specs.length === 0) {
    lignes.push('*Aucune SPEC marquée `governance: AIAD-RGPD`. Si le projet traite des données personnelles, identifier explicitement les SPECs concernées via le frontmatter `governance: AIAD-RGPD`.*');
  } else {
    lignes.push('| SPEC | Titre | Statut | Intent parent |');
    lignes.push('|------|-------|--------|---------------|');
    for (const s of specs) {
      lignes.push(`| \`${s.id}\` | ${s.title} | ${s.status} | ${s.parent_intent || '*(non lié)*'} |`);
    }
  }
  lignes.push('');
  lignes.push('### 2.2 Minimisation (Article 5.1.c)');
  lignes.push('*(à compléter — démontrer que seules les données strictement nécessaires sont collectées au regard des finalités)*');
  lignes.push('');
  lignes.push('### 2.3 Exactitude (Article 5.1.d)');
  lignes.push('*(à compléter — mécanismes de mise à jour / rectification / contrôle qualité des données)*');
  lignes.push('');
  lignes.push('### 2.4 Information des personnes (Articles 12-14)');
  lignes.push('*(à compléter — politique de confidentialité, mention d\'information au moment de la collecte, langue claire)*');
  lignes.push('');
  lignes.push('### 2.5 Exercice des droits (Articles 15-22)');
  lignes.push('*(à compléter — accès / rectification / effacement / limitation / portabilité / opposition / décision automatisée Article 22)*');
  lignes.push('');

  // SECTION 3 — Évaluation des risques
  lignes.push('## 3. Évaluation des risques pour les droits et libertés (Article 35.7.c)');
  lignes.push('');
  lignes.push('Méthode CNIL — 3 risques génériques × (gravité × vraisemblance) :');
  lignes.push('');
  lignes.push('### 3.1 Accès illégitime aux données');
  lignes.push('- **Sources** : *(à compléter — humaines internes / externes / non humaines)*');
  lignes.push('- **Impacts potentiels** : *(à compléter — usurpation d\'identité, discrimination, préjudice financier, atteinte à la réputation)*');
  lignes.push('- **Gravité** : *(négligeable / limitée / importante / maximale)*');
  lignes.push('- **Vraisemblance** : *(négligeable / limitée / importante / maximale)*');
  lignes.push('');
  lignes.push('### 3.2 Modification non désirée des données');
  lignes.push('- **Sources** : *(à compléter)*');
  lignes.push('- **Impacts potentiels** : *(à compléter — décisions erronées, perte d\'intégrité, propagation d\'erreurs)*');
  lignes.push('- **Gravité** : *(à compléter)*');
  lignes.push('- **Vraisemblance** : *(à compléter)*');
  lignes.push('');
  lignes.push('### 3.3 Disparition de données');
  lignes.push('- **Sources** : *(à compléter — sinistre, suppression accidentelle, attaque par chiffrement)*');
  lignes.push('- **Impacts potentiels** : *(à compléter — perte de service, impossibilité d\'exercer ses droits)*');
  lignes.push('- **Gravité** : *(à compléter)*');
  lignes.push('- **Vraisemblance** : *(à compléter)*');
  lignes.push('');
  lignes.push('### 3.4 Cartographie globale');
  lignes.push('*(à compléter — synthèse risque résiduel après mesures section 4. La CNIL recommande risque résiduel ≤ "limité" pour traitement acceptable sans consultation préalable)*');
  lignes.push('');

  // SECTION 4 — Mesures techniques et organisationnelles
  lignes.push('## 4. Mesures techniques et organisationnelles (Article 32)');
  lignes.push('');
  lignes.push('### 4.1 Code applicatif annoté `@governance AIAD-RGPD`');
  lignes.push('');
  if (code.length === 0) {
    lignes.push('*Aucun fichier code annoté `@governance AIAD-RGPD`. Si le projet traite des données personnelles (auth, stockage, export, transmission), annoter les fichiers concernés pour traçabilité audit.*');
  } else {
    lignes.push(`${code.length} fichier(s) annoté(s) :`);
    lignes.push('');
    for (const f of code.slice(0, 50)) {
      lignes.push(`- \`${f.path}\`${f.isTest ? ' *(test)*' : ''} ${f.specs.length ? `→ ${f.specs.join(', ')}` : ''}`);
    }
    if (code.length > 50) lignes.push(`- *(+${code.length - 50} autres)*`);
  }
  lignes.push('');
  lignes.push('### 4.2 Mesures techniques');
  lignes.push('- **Chiffrement** : *(à compléter — au repos AES-256, en transit TLS 1.3, gestion des clés)*');
  lignes.push('- **Pseudonymisation / anonymisation** : *(à compléter)*');
  lignes.push('- **Contrôle d\'accès** : *(à compléter — RBAC, MFA, principe du moindre privilège)*');
  lignes.push('- **Sauvegarde et restauration** : *(à compléter — fréquence, test de restauration, RPO/RTO)*');
  lignes.push('- **Journalisation** : *(à compléter — accès, modifications, durée de conservation des logs)*');
  lignes.push('- **Effacement sécurisé** : *(à compléter — politique de suppression à l\'issue de la durée)*');
  lignes.push('');
  lignes.push('### 4.3 Mesures organisationnelles');
  lignes.push('- **Drift Lock AIAD** : toute modification de code applicatif déclenche le hook pre-commit qui exige une mise à jour SPEC dans la même PR (préserve la traçabilité audit RGPD).');
  lignes.push('- **Agent Tier 1 AIAD-RGPD** : droit de veto sur toute SPEC introduisant un traitement non conforme.');
  lignes.push('- **Politique de confidentialité** : *(à compléter — version, date de dernière revue, lien public)*');
  lignes.push('- **Formation du personnel** : *(à compléter — fréquence, attestations)*');
  lignes.push('- **Procédure de violation (Article 33)** : *(à compléter — délai 72h notification CNIL)*');
  lignes.push('- **Contrats sous-traitants (Article 28)** : *(à compléter — clauses RGPD, DPA signés)*');
  lignes.push('');

  // SECTION 5 — Consultation du DPO (Article 39.1.c)
  lignes.push('## 5. Consultation du DPO (Article 39.1.c)');
  lignes.push('');
  lignes.push('*(à compléter — avis du Délégué à la Protection des Données, date de consultation, recommandations émises, suite donnée)*');
  lignes.push('');
  lignes.push('Si pas de DPO désigné : justifier l\'absence (Article 37.1).');
  lignes.push('');

  // SECTION 6 — Consultation préalable de la CNIL
  lignes.push('## 6. Consultation préalable de la CNIL (Article 36)');
  lignes.push('');
  lignes.push('Conditions de déclenchement :');
  lignes.push('- L\'AIPD indique que le traitement présente un **risque résiduel élevé** malgré les mesures envisagées (section 3.4).');
  lignes.push('- Le traitement est listé dans la **délibération CNIL n° 2018-327** (liste des traitements pour lesquels une AIPD est obligatoire).');
  lignes.push('');
  lignes.push('**Décision** : *(à compléter — consultation préalable nécessaire OUI / NON, avec justification)*');
  lignes.push('');

  // SECTION 7 — Validation et signature
  lignes.push('## 7. Validation et signature');
  lignes.push('');
  lignes.push('| Rôle | Nom | Date | Signature |');
  lignes.push('|------|-----|------|-----------|');
  lignes.push('| Responsable du traitement | *(à compléter)* | *(à compléter)* | *(à compléter)* |');
  lignes.push('| DPO | *(à compléter)* | *(à compléter)* | *(à compléter)* |');
  lignes.push('| RSSI | *(à compléter)* | *(à compléter)* | *(à compléter)* |');
  lignes.push('| Métier | *(à compléter)* | *(à compléter)* | *(à compléter)* |');
  lignes.push('');
  lignes.push('**Décision finale** : *(traitement validé / validé sous condition / refusé / consultation CNIL préalable requise)*');
  lignes.push('');

  // SECTION 8 — Plan d'action et monitoring
  lignes.push('## 8. Plan d\'action et monitoring (Article 35.11)');
  lignes.push('');
  lignes.push('### 8.1 Outils techniques en place');
  if (matrice && matrice.summary) {
    lignes.push('- Matrice de traçabilité Intent ↔ SPEC ↔ Code ↔ Tests régénérée à chaque PR :');
    lignes.push(`  - Intents : ${matrice.summary.intents}`);
    lignes.push(`  - SPECs : ${matrice.summary.specs}`);
    lignes.push(`  - Code annoté : ${matrice.summary.annotatedCodeFiles}/${matrice.summary.codeFiles}`);
    lignes.push(`  - Tests annotés : ${matrice.summary.annotatedTestFiles}/${matrice.summary.testFiles}`);
  } else {
    lignes.push('- `aiad-sdd trace --fail-on-gap` (CI parity sur chaque PR)');
  }
  lignes.push('- `aiad-sdd doctor --json` (diagnostic agrégé toutes catégories)');
  lignes.push('- `aiad-sdd dashboard --serve --watch` (monitoring opérationnel)');
  lignes.push('- `aiad-sdd dpia` (re-générer cette AIPD à chaque évolution majeure du traitement, Article 35.11)');
  lignes.push('');
  lignes.push('### 8.2 Cycle de revue');
  lignes.push('*(à compléter — fréquence de revue de l\'AIPD, déclencheurs de mise à jour, processus de versioning)*');
  lignes.push('');

  // SECTION 9 — Annexes
  lignes.push('## 9. Annexes');
  lignes.push('');
  lignes.push('### 9.1 Agent Tier 1 AIAD-RGPD');
  if (agent) {
    lignes.push(`- Installé dans \`${agent.path.replace(/^.+?(\.aiad)/, '$1')}\` ${agent.refConstitutionnel ? '✓ référentiel constitutionnel cité' : '⚠ référentiel à vérifier'}.`);
  } else {
    lignes.push('- ⚠ **AIAD-RGPD manquant** — installer via `npx aiad-sdd gouvernance` avant déploiement.');
  }
  lignes.push('');
  lignes.push('### 9.2 PRD du projet');
  if (prd) {
    lignes.push('Le Product Requirements Document complet est conservé dans `.aiad/PRD.md`.');
  } else {
    lignes.push('*(à compléter — PRD du projet)*');
  }
  lignes.push('');
  lignes.push('### 9.3 Registre des activités de traitement (Article 30)');
  lignes.push('*(à compléter — référence au registre interne de l\'organisation)*');
  lignes.push('');
  lignes.push('### 9.4 Sous-traitants (Article 28)');
  lignes.push('*(à compléter — liste des sous-traitants, contrats DPA, transferts hors UE et garanties Article 46)*');
  lignes.push('');

  // Pied
  lignes.push('---');
  lignes.push('');
  lignes.push('*Rapport pré-rempli par `aiad-sdd dpia`. Sections marquées `(à compléter)` requièrent intervention humaine — une AIPD conforme nécessite la consultation du DPO et la signature du responsable du traitement.*');
  lignes.push('');

  return lignes.join('\n');
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Exécute le DPIA / AIPD sur le projet courant.
 *
 * @param {string} racine
 * @param {{ out?: string, dryRun?: boolean, json?: boolean }} [options]
 * @returns {Promise<{ path: string|null, model: object }>}
 */
export async function dpia(racine, options = {}) {
  const { out, dryRun = false, json = false } = options;

  if (!existsSync(join(racine, '.aiad'))) {
    throw new Error(`.aiad/ introuvable. Lance \`aiad-sdd init\` d'abord.`);
  }

  const projet = lirePackageProject(racine);
  const specs = lireSpecsRgpd(racine);
  const code = lireCodeRgpd(racine);
  const agent = lireAgentRgpd(racine);
  const prd = lirePRD(racine);

  let matrice = null;
  try { matrice = construireMatrice(racine); }
  catch { /* matrice optionnelle */ }

  const dateAnalyse = new Date().toISOString().slice(0, 10);
  const model = { projet, specs, code, agent, prd, matrice, dateAnalyse };

  if (json) {
    process.stdout.write(JSON.stringify({
      date: dateAnalyse,
      project: { name: projet.name, version: projet.version },
      specs: specs.map((s) => ({ id: s.id, title: s.title, status: s.status, parent_intent: s.parent_intent })),
      code: code.map((c) => ({ path: c.path, isTest: c.isTest, specs: c.specs })),
      agent: agent ? { installed: true, refConstitutionnel: agent.refConstitutionnel } : { installed: false },
      summary: matrice ? matrice.summary : null,
    }, null, 2) + '\n');
    return { path: null, model };
  }

  const dest = out
    ? join(racine, out)
    : join(racine, '.aiad', 'metrics', 'rgpd', `DPIA-${dateAnalyse}.md`);
  const contenu = genererRapport(model);

  logHeader(
    'AIAD SDD — DPIA / AIPD (Article 35 RGPD)',
    'Pré-remplissage 9 sections — méthode CNIL',
  );

  const result = syncFile(dest, contenu, { dryRun });
  const sym = result === 'created' ? `${C.vert}+${C.reset}`
    : result === 'updated' ? `${C.cyan}↑${C.reset}`
    : `${C.vert}✓${C.reset}`;
  log(sym, `${dest.replace(racine + '/', '')}${dryRun ? ` ${C.gris}(dry-run)${C.reset}` : ''}`);

  console.log(`
${C.gras}  Synthèse DPIA${C.reset}
    SPECs RGPD          : ${C.cyan}${specs.length}${C.reset}
    Fichiers annotés    : ${C.cyan}${code.length}${C.reset}
    Agent Tier 1 RGPD   : ${agent ? C.vert + 'installé' + C.reset : C.rouge + 'manquant' + C.reset}
    Référence           : Règlement (UE) 2016/679 — Article 35

${C.gris}  Sections marquées "(à compléter)" requièrent un DPO + responsable du traitement.${C.reset}
${C.gris}  Re-générer à chaque évolution majeure du traitement (Article 35.11).${C.reset}
`);

  return { path: dest, model };
}
