#!/usr/bin/env node

import { argv, exit, cwd } from 'node:process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { init } from '../lib/init.js';
import { update } from '../lib/update.js';
import { upgrade } from '../lib/upgrade.js';
import { addGovernance } from '../lib/governance.js';
import { installerPack, listerPacks, packExiste } from '../lib/governance-packs.js';
import { showStatus } from '../lib/status.js';
import { installerHooks, desinstallerHooks } from '../lib/hooks.js';
import { bench } from '../lib/coldstart.js';
import { trace } from '../lib/sdd-trace.js';
import { emitRules, RUNTIMES_VALIDES as EMIT_RUNTIMES } from '../lib/emit-rules.js';
import { dashboard, serveDashboard, watcher } from '../lib/dashboard.js';
import { doctor } from '../lib/doctor.js';
import { uninstall } from '../lib/uninstall.js';
import { validerSkills } from '../lib/skills.js';
import { docs } from '../lib/docs.js';
import { optIn as telemetryOptIn, optOut as telemetryOptOut, showStatus as telemetryStatus, track as telemetryTrack } from '../lib/telemetry.js';
import { incrementSession as feedbackIncrementSession, tryInvite as feedbackTryInvite, runFeedbackCommand } from '../lib/feedback.js';
import { ouvrirRepl } from '../lib/repl.js';
import { migrer } from '../lib/migrate.js';
import { migrate as migrateV2 } from '../lib/migrate-v2.js';
import { exporterObsidian } from '../lib/obsidian-export.js';
import { setLang } from '../lib/i18n.js';
import { runWorkspace } from '../lib/workspace.js';
import { audit as aiActAudit } from '../lib/ai-act-audit.js';
import { installCommunityPack } from '../lib/governance-marketplace.js';
import { genererSbom } from '../lib/sbom.js';
import { verifyReproducibility } from '../lib/reproducibility.js';
import { dpia } from '../lib/dpia.js';
import { listerTemplates, templateExiste, creerProjet } from '../lib/templates.js';
import { lancerTui } from '../lib/init-tui.js';
import { indiceVoulaisTuDire } from '../lib/suggest.js';
import { importer as importerExterne } from '../lib/import.js';
import { scorerArtefact, VERDICTS as SCORE_VERDICTS } from '../lib/score.js';
import { listerTemplatesSpec, templateSpecExiste, creerSpecDepuisTemplate } from '../lib/specs-library.js';
import { lintGouvernance } from '../lib/governance-lint.js';
import { review } from '../lib/review.js';
import { suggererAnnotations } from '../lib/suggest-annotations.js';
import { exporterOpenApi } from '../lib/openapi-export.js';
import { genererStorybook } from '../lib/storybook.js';
import {
  NIVEAUX as CERT_NIVEAUX,
  AXES as CERT_AXES,
  MATRICE as CERT_MATRICE,
  construirePayload, signerBadge, verifierBadge,
  genererSujetExam, rendreMatriceMarkdown,
} from '../lib/cert.js';
import { afficherListe as marketplaceListe, afficherInfo as marketplaceInfo } from '../lib/marketplace.js';
import {
  appendEvenement, afficherLog as auditLog, verifier as auditVerifier, hashFichier, ACTIONS_VALIDES as AUDIT_ACTIONS,
} from '../lib/audit.js';
import {
  genererAttestation, verifierFichier as verifierProvenance, bundleSigstoreCommande,
} from '../lib/provenance.js';
import { afficherStats as hookStats } from '../lib/hook-sandbox.js';
import {
  genererPublicCode, genererFranceConnect, checkCommunNumerique, COMMUN_NUMERIQUE_CRITERES as DINUM_CRITERES,
} from '../lib/dinum.js';
import { afficherScore as sovereigntyScore, DIMENSIONS as SOVEREIGNTY_DIMENSIONS, NIVEAUX as SOVEREIGNTY_NIVEAUX } from '../lib/sovereignty-score.js';
import { extraireAdrs } from '../lib/dashboard/adrs.js';
import { recordDeployment, importDeploysFromGit, listerDeploys, STATUTS_VALIDES as DORA_STATUS } from '../lib/dora-record.js';
import { checkUpdate, estAutorise as updateAutorise } from '../lib/self-update.js';
import { buildStandupUrl, tousLesLiens, normaliserLens, dashboardEstStale } from '../lib/standup-url.js';
import { brief } from '../lib/brief.js';
import { genererBadge, genererTousLesBadges, genererShieldsEndpoint, TYPES_VALIDES as BADGE_TYPES } from '../lib/badge.js';
import { buildMeta } from '../lib/meta.js';
import {
  reviewMr as gitlabReviewMr, creerIssue, intentVersIssue,
  publierWiki, artefactVersWiki, chargerConfig as gitlabConfig,
} from '../lib/gitlab.js';
import {
  reviewPr as azureReviewPr, creerWorkItem, intentVersWorkItem,
  publierWiki as azurePublierWiki, artefactVersWiki as azureArtefactVersWiki,
  chargerConfig as azureConfig,
} from '../lib/azure-devops.js';
import { exporterArborescence as exporterConfluence } from '../lib/confluence.js';
import {
  emettreTest as webhookTest, listerSouscriptions, emettre as webhookEmettre, CONSTANTS as WEBHOOKS_CONSTANTS,
} from '../lib/webhooks.js';
import { reflect } from '../lib/reflect.js';
import { negotiate } from '../lib/negotiate.js';
import { refactorSpec, refactorAll } from '../lib/refactor-spec.js';
import { bumpSpec, verifierVersion } from '../lib/spec-version.js';
import { archiver, restaurer, afficherListe as afficherArchives, TYPES_ARTEFACTS as ARCHIVE_TYPES } from '../lib/archive.js';
import { show as slaShow, check as slaCheck, update as slaUpdate, POLITIQUE_DEFAUT as SLA_POLITIQUE } from '../lib/sla.js';
import { emettre as completionEmettre, CONSTANTS as COMPLETION_CONSTANTS } from '../lib/completion.js';
import { tour as guidedTour } from '../lib/tour.js';
import { piiScan, DETECTEURS as PII_DETECTEURS } from '../lib/pii-scan.js';
import { backup as backupArchive, restore as restoreArchive, inspecter as inspecterArchive } from '../lib/backup.js';
import { installerGarde as installerOffline, status as offlineStatus, afficherLog as offlineLog } from '../lib/offline.js';
import {
  reviewPr as bitbucketReviewPr, creerIssue as bitbucketCreerIssue,
  intentVersIssue as bitbucketIntentVersIssue, chargerConfig as bitbucketConfig,
} from '../lib/bitbucket.js';
import {
  afficherListe as ciTemplatesListe, installerTemplate as ciInstaller, listerForges as ciListerForges,
} from '../lib/ci-templates.js';
import {
  installerArtefact as ghAppInstaller, setup as ghAppSetup, listerArtefacts as ghAppListerArtefacts,
} from '../lib/github-app.js';
import { anonymiserBatch, kAnonymity as kAnonymityCheck } from '../lib/anonymize.js';
import {
  afficherListe as pluginsListe, afficherInfo as pluginsInfo,
  installerLocal as pluginsInstaller, desinstallerLocal as pluginsDesinstaller,
} from '../lib/plugins.js';
import {
  executerBefore as commandHookBefore, executerAfter as commandHookAfter,
  hooksDisponibles as commandHooksDisponibles, templateHook as commandHookTemplate,
} from '../lib/command-hooks.js';
import { genererSchema as cliSchemaGenerer } from '../lib/cli-schema.js';
import {
  afficherConfig as orgAfficherConfig, verifier as orgVerifier, templateConfig as orgTemplate,
} from '../lib/org-config.js';
import {
  whoami as rbacWhoami, init as rbacInit, check as rbacCheck,
} from '../lib/rbac.js';
import {
  executerTutoriel, afficherListe as tutorielsListe, TUTORIELS as TUTORIELS_REG,
} from '../lib/tutorial.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const VERSION = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')).version;

/**
 * Charge un schéma de verdict versionné (§3.4). Priorité : chemin explicite
 * `--json-schema`, puis `.aiad/schema/verdicts/` du projet, puis celui livré
 * par le package. Retourne `null` si introuvable (validation alors sautée).
 *
 * @param {string} nom — gate | trace | validate | security
 * @param {string} [cheminExplicite]
 * @returns {object|null}
 */
function chargerSchemaVerdict(nom, cheminExplicite) {
  const candidats = [
    cheminExplicite ? join(cwd(), cheminExplicite) : null,
    join(cwd(), '.aiad', 'schema', 'verdicts', `${nom}.schema.json`),
    join(__dirname, '..', '.aiad', 'schema', 'verdicts', `${nom}.schema.json`),
  ].filter(Boolean);
  for (const p of candidats) {
    try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { /* suivant */ }
  }
  return null;
}

// Active le garde air-gapped (item #112) si AIAD_OFFLINE est positionné
// ou si .aiad/config.yml déclare `offline: true`. Idempotent.
try { installerOffline(cwd()); } catch { /* never break CLI startup */ }

// Schéma global des options. Union des flags utilisés par toutes les
// commandes — `parseArgs` rejette nativement les flags inconnus, supporte
// `--flag=value`, `--flag value` et les short flags définis par `short`.
const OPTIONS_SCHEMA = {
  // Booléens
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  force: { type: 'boolean' },
  minimal: { type: 'boolean' },
  'sans-gouvernance': { type: 'boolean' },
  'with-git-hooks': { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  check: { type: 'boolean' },
  uninstall: { type: 'boolean' },
  purge: { type: 'boolean' },
  pack: { type: 'string' },
  'pack-from': { type: 'string' },
  unsafe: { type: 'boolean' },
  list: { type: 'boolean' },
  lang: { type: 'string' },
  json: { type: 'boolean' },
  'output-format': { type: 'string' },
  'json-schema': { type: 'string' },
  diff: { type: 'string' },
  'fail-on-gap': { type: 'boolean' },
  quiet: { type: 'boolean' },
  serve: { type: 'boolean' },
  watch: { type: 'boolean' },
  interactive: { type: 'boolean', short: 'i' },
  suggest: { type: 'boolean' },
  // Strings
  upgrade: { type: 'string' },
  runtime: { type: 'string' },
  out: { type: 'string' },
  format: { type: 'string' },
  port: { type: 'string' },
  'source-base': { type: 'string' },
  expected: { type: 'string' },
  from: { type: 'string' },
  niveau: { type: 'string' },
  candidat: { type: 'string' },
  candidate: { type: 'string' },
  axes: { type: 'string' },
  mr: { type: 'string' },
  branch: { type: 'string' },
  intent: { type: 'string' },
  spec: { type: 'string' },
  project: { type: 'string' },
  token: { type: 'string' },
  id: { type: 'string' },
  org: { type: 'string' },
  repo: { type: 'string' },
  wiki: { type: 'string' },
  type: { type: 'string' },
  since: { type: 'string' },
  jours: { type: 'string' },
  ai: { type: 'boolean' },
  all: { type: 'boolean' },
  reason: { type: 'string' },
  restore: { type: 'string' },
  complete: { type: 'string' },
  'non-interactive': { type: 'boolean' },
  input: { type: 'string' },
  k: { type: 'string' },
  'quasi-ids': { type: 'string' },
  config: { type: 'string' },
  strict: { type: 'boolean' },
  fix: { type: 'boolean' },
  apply: { type: 'boolean' },
  persist: { type: 'boolean' },
  threshold: { type: 'string' },
  staged: { type: 'boolean' },
  rules: { type: 'boolean' },
  password: { type: 'string' },
  'key-file': { type: 'string' },
  archive: { type: 'string' },
  // (#150) `aiad-sdd dora --record` flags
  record: { type: 'boolean' },
  status: { type: 'string' },
  cycle: { type: 'string' },
  lead: { type: 'string' },
  release: { type: 'string' },
  commit: { type: 'string' },
  date: { type: 'string' },
  // (#185) `aiad-sdd dora --import-git`
  'import-git': { type: 'boolean' },
  // (#154) `aiad-sdd doctor --supplementaire`
  supplementaire: { type: 'boolean' },
  // (#191) `aiad-sdd standup --lens=<role>` raccourci focus-mode Kanban
  lens: { type: 'string' },
  open: { type: 'boolean' },
  // (#193) `aiad-sdd standup --regen` régénère le dashboard si stale
  regen: { type: 'boolean' },
  // (#195) `aiad-sdd migrate-v2 --rollback-on-error --keep-backups N`
  'rollback-on-error': { type: 'boolean' },
  'keep-backups': { type: 'string' },
  // (#221) `aiad-sdd doctor --strict-sante=N` exit 1 si santé < N
  'strict-sante': { type: 'string' },
  // (#229) `aiad-sdd brief --strict=N` exit 1 si santé < N
  strict: { type: 'string' },
  // (#230) `aiad-sdd badge` génère SVG santé pour README
  label: { type: 'string' },
  'data-dir': { type: 'string' },
  // (#240) `aiad-sdd dashboard --public-url=https://…` → URLs absolues
  // pour og:url, og:image, sitemap.xml, robots.txt (crawlers Slack/Teams).
  'public-url': { type: 'string' },
  // (#252) `aiad-sdd dashboard --full` → data.json complet (sans troncature).
  full: { type: 'boolean' },
  // (#269) `aiad-sdd brief --markdown` → sortie Markdown Slack/Teams/Notion.
  markdown: { type: 'boolean' },
  // (#284) `aiad-sdd badge --shields-endpoint` → JSON shields.io endpoint format.
  'shields-endpoint': { type: 'boolean' },
  // (#295) `aiad-sdd brief --diff=<file>` → delta vs snapshot précédent.
  diff: { type: 'string' },
  // (#299) `aiad-sdd brief --strict-tests=N` → exit 1 si counts.tests < N.
  'strict-tests': { type: 'string' },
  // (§3.6) `aiad-sdd mini-gate <spec> --phase N` → verdict de tranche.
  phase: { type: 'string' },
  runs: { type: 'string' },
  delivered: { type: 'boolean' },
  apply: { type: 'boolean' },
  auteur: { type: 'string' },
  author: { type: 'string' },
  seuil: { type: 'string' },
  lecon: { type: 'string' },
};

let parsed;
try {
  parsed = parseArgs({
    args: argv.slice(2),
    options: OPTIONS_SCHEMA,
    allowPositionals: true,
    strict: true,
  });
} catch (err) {
  // Suggestion fuzzy si flag inconnu : Node lève typiquement
  // "Unknown option '--xxx'" → on extrait le nom et on cherche le plus
  // proche parmi les flags du schéma.
  let astuce = '';
  const m = (err.message || '').match(/Unknown option '?--?([\w-]+)'?/i);
  if (m) {
    const candidats = Object.keys(OPTIONS_SCHEMA);
    const indice = indiceVoulaisTuDire(m[1], candidats, { max: 2, prefix: 'Voulais-tu écrire' });
    if (indice) astuce = `\n  ${indice.replace(/`(\w[\w-]*)`/g, (_, f) => `\`--${f}\``)}`;
  }
  console.error(`\n  ${err.message}${astuce}\n  Lance \`aiad-sdd help\` pour voir les options.\n`);
  exit(1);
}

const values = parsed.values;
const positionals = parsed.positionals;
const command = positionals[0];

// Helpers
const liste = (s, defaut) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : defaut);

const AIDE = `
  aiad-sdd v${VERSION} — Spec Driven Development pour Claude Code
  https://aiad.ovh

  Commandes :
    new <template> [<dir>] Bootstrap un projet clés-en-main (--list pour voir la liste)
    import [--from src]   Importe Spec Kit / Kiro vers .aiad/ (auto-détection sinon)
    score <intent|spec> <id>  Score local via Ollama (souverain, AIAD_OLLAMA_URL)
    template <domain>     Génère une SPEC depuis bibliothèque (auth-oidc, payment-pci, rag-llm, gdpr-data-export)
    review <branch>       Diff Intent/SPEC vs branche cible (rapport Markdown commentable en PR)
    suggest-annotations <fichier>  Ollama local suggère @spec/@governance/@verified-by (Human Authorship préservé)
    export <sub>          Génère artefacts externes : openapi (OpenAPI 3.1) | confluence (publish pages)
    storybook             Storybook HTML zero-dep des 30 commandes slash (recherche + filtres)
    cert <sub>            Programme certification Product Engineer AIAD (matrix|exam|badge|verify)
    marketplace <sub>     Catalogue packs verticaux premium (list|info <id>) — santé/auto/aero/industriel
    audit <sub>           Audit trail crypto-signé append-only (log|verify|append) — AI Act/RGPD/CRA
    provenance <sub>      Attestation SLSA Provenance v1.0 signée HMAC (generate|verify|sigstore)
    hook-stats            Métriques santé du hook pre-commit (latence p50/p95, timeouts, fuites)
    dinum <sub>           Kit DINUM FR (publiccode|franceconnect|check) — soumission code.gouv.fr
    sovereignty           Score EU Sovereignty composite (5 dimensions, niveau Bronze→Platinum)
    adrs [--json]         Liste les Architecture Decision Records extraits de .aiad/ARCHITECTURE.md
    dora --record         Enregistre un déploiement DORA (status, cycle, lead, release, commit, date)
    dora --import-git     Importe les déploiements depuis les tags Git (--since YYYY-MM-DD)
    self-update [--json]  Vérifie une mise à jour npm (opt-in, jamais silencieux)
    standup --lens <role> Imprime l'URL Kanban focus-mode du rituel standup (lens=pm|pe|ae|qa|tl|all, --open, --all, --regen, --serve, --port, --json, --markdown)
    brief [--json|--markdown|--strict=N|--strict-tests=N|--diff=<file>|--quiet] Résumé one-pager projet · --strict=N exit 1 si santé<N · --strict-tests=N exit 1 si tests<N · --markdown Slack/Notion · --diff delta · --quiet silent en CI si pass
    badge [--out PATH]    Génère SVG badge (style shields.io) pour README · --type=sante|maturite|violations · --all (3 badges) · --shields-endpoint (JSON pour gist+shields.io) · --dry-run --label "Custom" --json
    gitlab <sub>          Connecteur GitLab (review --mr|issue --intent|wiki --intent|--spec)
    azure <sub>           Connecteur Azure DevOps (pr --id|work-item --intent|wiki --intent|--spec)
    webhooks <sub>        Webhooks AIAD signés HMAC (list|test --type <event>|emit --type <event>)
    reflect [--since|--jours]   Rétrospective sprint via Ollama local — 3-5 axes d'amélioration
    negotiate <A> <B>     Médiation entre 2 Intents via Ollama : conflits + Intent commun + arbitrages
    refactor-spec <id>    Détection SPEC > 200 LOC ou > 7 critères + découpage proposé (--all|--ai)
    spec-version <sub>    Versioning sémantique SPEC (check <id>|bump <id> <kind>) — détecte breaking
    archive <id>          Archive Intent/SPEC (--reason|--list|--restore <id>|--dry-run) → audit + webhook
    sla <sub>             Matrice SLA support/sécurité (show|check|update) — injecte dans SECURITY.md
    completion <shell>    Auto-complétion CLI (bash|zsh|fish) — script à sourcer dans le shell
    tour                  Guided tour interactif (Intent→SPEC→Gate→Trace) — onboarding pédagogique
    pii-scan [<file>]     Détecte PII (IBAN/NIR/cartes/tokens/email/tel) — pre-commit RGPD (--staged|--json)
    offline <sub>         Mode air-gapped (status|log) — bloque tout HTTP non-local (AIAD_OFFLINE=1)
    bitbucket <sub>       Connecteur Bitbucket (pr --id|issue --intent) — Cloud + Server REST
    ci-template <forge>   Installe template CI/CD (github|gitlab|jenkins|drone|bitbucket|azure) — --list pour le détail · #233/#235/#236
    github-app <sub>      Installe workflow/manifest GitHub (install workflow|install manifest|setup)
    anonymize --input <p> Anonymise un JSON (hash PII / généralisation / k-anonymity / Laplace DP)
    plugin <sub>          Système de plugins AIAD (list|info|install <dir>|uninstall <id>)
    hooks-init            Crée .aiad/hooks/aiad-hooks.js (template ESM beforeCommand/afterCommand)
    schema [--format]     Génère OpenAPI 3.1 des sorties --json (yaml|json, --out, --dry-run)
    org <sub>             Configuration org-level (show|init|check) — politiques cross-projets
    rbac <sub>            RBAC léger sur artefacts (whoami|init|check) — owner+reviewers frontmatter
    tutorial <id>         Tutoriel domaine (auth-oidc|payment-pci|rag-llm|gdpr-data-export) — --list
    backup [--out path]   Archive cryptée AES-256-GCM de .aiad/ (--password|--key-file) — RGPD/CRA
    restore --archive <p> Restaure une archive .aiad-backup (--password|--key-file|--force|--dry-run)
    init [options]        Initialise SDD Mode dans le projet courant
    update [options]      Met à jour un projet existant (commandes + gouvernance)
    gouvernance           Ajoute/met à jour les agents de gouvernance
    gouvernance lint      Détecte les contradictions TOUJOURS/JAMAIS inter-agents Tier 1
    hooks [options]       Installe / désinstalle le hook Git pre-commit (Drift Lock)
    status [--json|--markdown] Affiche l'état SDD du projet · --markdown pour paste PR/Slack/Notion
    doctor [--json|--markdown|--quiet|--fix|--supplementaire|--strict-sante=N] Diagnostic + score santé #218 · --markdown PR/Slack · --quiet silent en CI si pass · --strict-sante=N exit 1 si <N
    skills validate       Vérifie le frontmatter des skills (.claude/skills/)
    repl                  REPL interactif (atelier intent/spec/trace/doctor sans quitter le terminal)
    migrate [--force]     Détecte les versions installées < courante et applique les migrations structurelles
    migrate-v2 [--apply]  Squelette migration v1 → v2 (dry-run par défaut, --json, --rollback-on-error, --keep-backups N)
    obsidian [--out=DIR]  Exporte .aiad/ vers un Obsidian Vault (wiki-links + MOC + README, défaut : obsidian-vault/)
    workspace <sub>       Mode multi-projet (doctor|trace|analytics) — agrège cross-org
    ai-act audit          Pré-remplit la documentation Annexe IV du Règlement (UE) 2024/1689
    sbom [options]        Génère un SBOM CycloneDX v1.5 (Cyber Resilience Act EU 2024/2847)
    dpia [options]        Pré-remplit l'AIPD Article 35 RGPD (méthode CNIL, 9 sections)
    verify-reproducibility  Calcule le content hash déterministe du tarball (CRA, SLSA, NIST SSDF)
    docs [--check]        Régénère DOCUMENTATION.md depuis les sources (CI parity)
    telemetry <sub>       Télémétrie opt-in (opt-in / opt-out / status [--json])
    feedback [<sub>]      Feedback qualitatif (opt-in / opt-out / status) — invitation auto toutes les 15 sessions
    uninstall [options]   Retire aiad-sdd du projet (mode aperçu sauf --force)
    bench [compare]       Mesure cold-start ; --persist log historique ; compare --since N --threshold T
    research <id>         Gate Research GO/NO-GO déterministe (§3.5) — verdict gradué ancré Discovery (exit 0/1/2)
    discovery-check [id]   Prérequis Discovery (§3.5) — Research liée prête pour /sdd spec|exec (exit 0/1/2)
    mini-gate <spec>       Mini-gate par tranche (§3.6) — --phase N (ou --all) → PASS|CONDITIONAL|FAIL|JNSP (exit 0/1/2)
    exec-status <spec>     Avancement d'un plan d'exécution phasé (§3.6) — marqueurs [ ][~][x][!][-] (--json)
    trace [options]       Génère la matrice Intent ↔ SPEC ↔ Code ↔ Tests
    dashboard [options]   Génère le dashboard HTML multi-pages dans dashboard/
    emit-rules [options]  Régénère AGENTS.md, CLAUDE.md, .cursor/rules/, .codex/, GEMINI.md
    help                  Affiche cette aide

  Options init :
    -i, --interactive     TUI interactive en français (4 questions, zero-dep)
    --minimal             Profil AIAD-Lean : 4 commandes (intent/spec/gate/drift-check)
    --upgrade <module>    Ajoute un module (rituals|metrics|gouvernance|all)
    --runtime <list>      Cible IA — claude-code|cursor|codex|copilot|gemini|all
                          (séparés par virgule, défaut : claude-code)
    --sans-gouvernance    Initialise sans les agents de gouvernance
    --with-git-hooks      Installe le hook pre-commit (Drift Lock)
    --force               Écrase les fichiers existants
    --dry-run             Aperçu — affiche ce qui serait écrit sans rien écrire

  Options update :
    --sans-gouvernance    Met à jour sans toucher la gouvernance
    --check               Mode CI — exit 1 si divergence avec le package
    --dry-run             Aperçu — affiche ce qui serait écrit sans rien écrire

  Options hooks :
    --uninstall           Désinstalle le hook pre-commit
    --force               Écrase un hook pre-commit utilisateur existant

  Options uninstall :
    (sans flag)           Mode aperçu — affiche les actions, n'écrit rien
    --force               Exécute la désinstallation framework
    --purge --force       Supprime aussi .aiad/ (artefacts métier — irréversible)

  Options trace :
    --format <list>       Formats produits (md,json,html,sarif — défaut: tous)
    --out <dir>           Dossier de sortie (défaut: .aiad/metrics/traceability)
    --json                Imprime la matrice JSON sur stdout (CI)
    --fail-on-gap         Exit 1 si gap bloquant détecté (CI)
    --quiet               Pas de résumé console
    --watch               Régénère la matrice à chaque changement (intent/spec/code)
    --suggest             Crée un squelette EARS pour chaque SPEC orpheline (référencée
                          par le code mais absente de .aiad/specs/). À combiner avec --dry-run
                          pour aperçu, ou exécution directe pour générer les squelettes.

  Options emit-rules :
    --runtime <list>      Runtimes ciblés — claude-code|cursor|codex|copilot|gemini|all
                          (séparés par virgule, défaut : all)
    --check               Mode CI — exit 1 si divergence avec AGENT-GUIDE

  Options dashboard :
    --out <dir>           Dossier de sortie (défaut : dashboard)
    --quiet               Pas de résumé console
    --serve               Lance un serveur HTTP local après génération
    --watch               Re-génère le dashboard à chaque changement dans .aiad/
                          (à combiner avec --serve)
    --port <n>            Port du serveur --serve (défaut : 8765)
    --public-url <url>    URL absolue publique (GitHub Pages, etc.) pour og:url/og:image/sitemap
                          (ou variable env AIAD_PUBLIC_URL — requis pour preview Slack/Teams)
    --check               Mode CI : valide la génération sans écrire les fichiers (exit 1 si erreur)
    --full                Inclut TOUTES les gaps dans data.json (défaut tronqué à 100 entrées par liste,
                          réduit ~860 KB → ~80 KB pour les consumers CI)
    --source-base <url>   URL préfixant les liens vers les fichiers .md sources
                          (ex: GitHub Pages → blob/main/). Valeur 'auto' pour
                          détecter depuis git remote.origin.url
                          (github/gitlab/bitbucket reconnus). Forme
                          'auto:main' pour cibler une branche précise au lieu
                          de HEAD (utile : dev/master/develop).
                          (ou variable env AIAD_SOURCE_BASE — utile en CI/CD)

  Exemples :
    npx aiad-sdd init                       Initialisation complète
    npx aiad-sdd init --minimal             Profil minimal (4 commandes, ≤ 1k tokens)
    npx aiad-sdd init --upgrade rituals     Ajoute les rituels au profil minimal
    npx aiad-sdd init --upgrade gouvernance Ajoute les agents Tier 1 (AI-ACT, RGPD, …)
    npx aiad-sdd init --upgrade metrics     Ajoute dashboards & métriques DORA/flow
    npx aiad-sdd init --upgrade all         Bascule minimal → profil complet
    npx aiad-sdd init --with-git-hooks      Init + Drift Lock pre-commit
    npx aiad-sdd update                     Mise à jour (préserve vos fichiers)
    npx aiad-sdd init --force               Réinitialisation (écrase tout)
    npx aiad-sdd gouvernance                Met à jour les agents de gouvernance
    npx aiad-sdd hooks                      Installe le hook pre-commit
    npx aiad-sdd hooks --uninstall          Désinstalle le hook pre-commit
    npx aiad-sdd status                     État du projet SDD
    npx aiad-sdd trace                      Génère la matrice de traçabilité (md+json+html)
    npx aiad-sdd trace --fail-on-gap        Échoue si gap bloquant (usage CI)
    npx aiad-sdd dashboard                  Génère le dashboard HTML dans dashboard/
    npx aiad-sdd dashboard --serve          Génère puis sert sur http://127.0.0.1:8765
    npx aiad-sdd dashboard --out docs/dash  Dashboard dans un dossier custom
    npx aiad-sdd emit-rules                 Régénère AGENTS.md + Cursor + Codex + Gemini
    npx aiad-sdd emit-rules --runtime cursor  Cible un runtime unique
    npx aiad-sdd emit-rules --check         Vérifie la parité (usage CI)

  Exit codes :
    0  succès / verdict PASS
    1  échec, erreur ou verdict FAIL
    2  verdict JNSP (Je Ne Sais Pas) — décision humaine requise, ce n'est
       pas une erreur. Émis par les commandes qui détectent une situation
       non décidable (intent flou, critère non testable, gouvernance
       ambiguë, fichier illisible). Voir AGENTS.md section « INCERTITUDE ».

  Framework AIAD — Artificial Intelligence Agent Development — Open Source
`;

// Convention d'exit codes. EXIT_JNSP=2 distingue le verdict « décision
// humaine requise » d'une vraie erreur (1). Utilisé par les commandes qui
// peuvent retourner UNKNOWN/JNSP (regulatory-veto, sqs-scoring, etc.) une
// fois la couche skills propagée — pour l'instant exposé pour les
// consommateurs CI qui veulent distinguer « bloqué par humain » de « bug ».
const EXIT_JNSP = 2;
export { EXIT_JNSP };

// (#276) Extrait la section d'aide d'une commande spécifique depuis AIDE.
// Combine la ligne descriptive (ex: "    brief [--json|--strict=N] …") et
// la section "Options <cmd> :" si elle existe. Retourne null si commande
// inconnue dans le help.
export function extraireAideCommande(aide, command) {
  const lignes = aide.split('\n');
  // Match la ligne descriptive : "    <command>[ <space>...]" (4 espaces + cmd + suite)
  const cmdEscape = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reDesc = new RegExp(`^    ${cmdEscape}(\\s|$)`);
  const idxDesc = lignes.findIndex((l) => reDesc.test(l));
  if (idxDesc === -1) return null;
  // Cherche aussi la section "  Options <command> :" (indentée 2 espaces)
  const reOpts = new RegExp(`^  Options ${cmdEscape} :`);
  const idxOpts = lignes.findIndex((l) => reOpts.test(l));
  const out = [`  aiad-sdd ${command} — ${lignes[idxDesc].trim()}`, ''];
  if (idxOpts !== -1) {
    out.push(lignes[idxOpts]);
    // Lit les lignes suivantes jusqu'à blank-line + nouveau header indenté <= 2 espaces
    let i = idxOpts + 1;
    while (i < lignes.length) {
      const l = lignes[i];
      // Stop quand on rencontre un header de section (commence par 0-2 espaces + mot)
      if (/^\s{0,2}\S/.test(l) && !/^    /.test(l) && l.trim() !== '') break;
      out.push(l);
      i++;
    }
  }
  out.push('  Aide complète : `aiad-sdd --help`');
  return out.join('\n');
}

async function main() {
  // i18n : applique --lang ou détecte via env. À placer en TÊTE de main()
  // pour que toute l'aide / messages d'erreur respectent la langue choisie.
  setLang(values.lang || null);

  // Court-circuits : -h / --help / -v / --version peuvent être passés sans
  // commande, ou comme commande positionnelle.
  // (#275) Version doit court-circuiter AVANT help, car `aiad-sdd --version`
  // a `command === undefined` ce qui matchait la branche help → print AIDE.
  if (values.version || command === 'version') {
    console.log(`aiad-sdd v${VERSION}`);
    return;
  }
  if (values.help || command === 'help' || command === undefined) {
    // (#276) Si --help est combiné avec une commande, n'affiche que la
    // section pertinente : ligne descriptive + "Options <cmd>" si présente.
    // `aiad-sdd brief --help` ne devrait pas dump les 167 lignes du help global.
    if (values.help && command && command !== 'help') {
      const sectionAide = extraireAideCommande(AIDE, command);
      if (sectionAide) {
        console.log(sectionAide);
        return;
      }
      // Pas de section trouvée → fallback help global (commande inconnue traitée plus loin)
    }
    console.log(AIDE);
    return;
  }

  // Hook utilisateur beforeCommand (item #120) — peut bloquer la commande.
  if (commandHooksDisponibles(cwd())) {
    try {
      await commandHookBefore(cwd(), { command, args: values, env: process.env });
    } catch (err) {
      console.error(`\n  ✗ Hook beforeCommand a refusé la commande "${command}" :\n    ${err.message}\n`);
      exit(1);
    }
  }

  // Télémétrie opt-in (silencieuse si opt-out — défaut). Aucune donnée
  // envoyée tant que `aiad-sdd telemetry opt-in` n'a pas été exécuté.
  // Pas tracké pour les sous-commandes `telemetry` elles-mêmes (boucle).
  if (command !== 'telemetry') {
    telemetryTrack('command_run', {
      command,
      version: VERSION,
      runtimes: values.runtime ? values.runtime.split(',').map((s) => s.trim()) : [],
    });
  }
  if (command !== 'feedback') {
    feedbackIncrementSession();
  }

  switch (command) {
    case 'init': {
      const dryRun = Boolean(values['dry-run']);
      if (values.upgrade) {
        await upgrade(cwd(), values.upgrade, {
          force: Boolean(values.force),
          dryRun,
        });
        break;
      }
      // Mode interactif : la TUI guide l'utilisateur sur 4 questions.
      if (values.interactive) {
        const tuiOpts = await lancerTui({ force: Boolean(values.force) });
        if (tuiOpts.annule) break;
        await init(cwd(), {
          sansGouvernance: tuiOpts.sansGouvernance,
          force: tuiOpts.force,
          withGitHooks: tuiOpts.withGitHooks,
          minimal: tuiOpts.minimal,
          runtimes: tuiOpts.runtimes,
          dryRun,
        });
        // Pack non-baseline : appliquer après l'init pour superposer.
        if (tuiOpts.pack && tuiOpts.pack !== 'eu-baseline') {
          await installerPack(cwd(), tuiOpts.pack, { force: tuiOpts.force, dryRun });
        }
        break;
      }
      await init(cwd(), {
        sansGouvernance: Boolean(values['sans-gouvernance']),
        force: Boolean(values.force),
        withGitHooks: Boolean(values['with-git-hooks']),
        minimal: Boolean(values.minimal),
        runtimes: liste(values.runtime, ['claude-code']),
        dryRun,
      });
      break;
    }

    case 'update': {
      const json = Boolean(values.json);
      const savedLog = console.log;
      if (json) console.log = () => {};
      let stats;
      try {
        stats = await update(cwd(), {
          sansGouvernance: Boolean(values['sans-gouvernance']),
          dryRun: Boolean(values['dry-run']),
          check: Boolean(values.check),
        });
      } finally {
        if (json) console.log = savedLog;
      }
      if (json) {
        process.stdout.write(JSON.stringify({
          check: Boolean(values.check), dryRun: Boolean(values['dry-run']),
          created: stats.created, updated: stats.updated, unchanged: stats.unchanged, preserved: stats.preserved, drifts: stats.drifts,
        }, null, 2) + '\n');
      }
      if (values.check && stats && stats.drifts && stats.drifts.length > 0) {
        exit(1);
      }
      break;
    }

    case 'gouvernance': {
      // Sous-commande `lint` : détection de contradictions inter-agents.
      if (positionals[1] === 'lint' && positionals[2] === 'rules') {
        const rules = [
          { id: 'conflit', label: 'Conflit TOUJOURS↔JAMAIS inter-agents (Jaccard ≥ 0.6, ≥ 3 tokens communs)' },
          { id: 'doublon', label: 'Doublon de règle dans un même agent (TOUJOURS ou JAMAIS)' },
          { id: 'agent-manquant', label: 'Agent Tier 1 baseline manquant (AI-ACT, RGPD, RGAA, RGESN)' },
        ];
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ rules, total: rules.length }, null, 2) + '\n');
        } else {
          console.log(`\n  Règles de détection gouvernance lint (${rules.length}) :\n`);
          for (const r of rules) console.log(`    • ${r.id} — ${r.label}`);
          console.log('');
        }
        break;
      }
      if (positionals[1] === 'lint') {
        const r = await lintGouvernance(cwd(), { json: Boolean(values.json) });
        if (!r.ok) exit(1);
        break;
      }
      // Sous-commande `info <id>` : détails d'un pack (variant found/not-found).
      if (positionals[1] === 'info') {
        const id = positionals[2];
        const packs = listerPacks();
        const p = id ? packs.find((x) => x.id === id) : null;
        if (!p) {
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({
              id: id || null, found: false, available: packs.map((x) => x.id),
            }, null, 2) + '\n');
          } else {
            console.error(`\n  Pack inconnu : "${id || ''}". Disponibles : ${packs.map((x) => x.id).join(', ')}.\n`);
            exit(1);
          }
          break;
        }
        const { existsSync, readdirSync } = await import('node:fs');
        const agents = existsSync(p.sourceDir) ? readdirSync(p.sourceDir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')) : [];
        const { sourceDir, ...packMeta } = p;
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ id: p.id, found: true, pack: packMeta, agents, total: agents.length }, null, 2) + '\n');
        } else {
          console.log(`\n  ${packMeta.titre} (${p.id})\n  ${packMeta.description}\n  Juridiction : ${packMeta.juridiction}\n  Agents (${agents.length}) : ${agents.join(', ')}\n`);
        }
        break;
      }
      if (values.list) {
        const packs = listerPacks().map(({ sourceDir, ...rest }) => rest);
        if (values.json) {
          process.stdout.write(JSON.stringify({ packs, total: packs.length }, null, 2) + '\n');
          break;
        }
        console.log(`\n${VERSION ? '' : ''}  Packs de gouvernance disponibles :\n`);
        for (const p of packs) {
          const tag = p.defaut ? ' (défaut)' : '';
          console.log(`    • ${p.id}${tag}`);
          console.log(`      ${p.titre}`);
          console.log(`      ${p.description}\n`);
        }
        break;
      }
      if (values['pack-from']) {
        // Marketplace : pack tiers depuis un dossier local.
        await installCommunityPack(cwd(), values['pack-from'], {
          force: Boolean(values.force),
          dryRun: Boolean(values['dry-run']),
          unsafe: Boolean(values.unsafe),
        });
        break;
      }
      if (values.pack) {
        if (!packExiste(values.pack)) {
          console.error(`\n  Pack inconnu : "${values.pack}". Lance 'aiad-sdd gouvernance --list' pour voir les packs.\n`);
          exit(1);
        }
        await installerPack(cwd(), values.pack, {
          force: Boolean(values.force),
          dryRun: Boolean(values['dry-run']),
        });
        break;
      }
      // Comportement legacy : installe le pack eu-baseline (4 agents Tier 1).
      await addGovernance(cwd(), { force: Boolean(values.force) });
      break;
    }

    case 'hooks':
      if (positionals[1] === 'status') {
        const { existsSync } = await import('node:fs');
        const projetDir = cwd();
        const hookScript = join(projetDir, '.aiad', 'hooks', 'pre-commit.sh');
        const huskyDir = join(projetDir, '.husky');
        const gitHook = join(projetDir, '.git', 'hooks', 'pre-commit');
        const configFile = join(projetDir, '.aiad', 'config.yml');
        const bypassFile = join(projetDir, '.aiad', 'hook-bypass.yml');
        const status = {
          hookScript: existsSync(hookScript),
          husky: existsSync(huskyDir),
          gitHook: existsSync(gitHook),
          config: existsSync(configFile),
          bypass: existsSync(bypassFile),
          mode: existsSync(huskyDir) ? 'husky' : (existsSync(gitHook) ? 'git' : 'none'),
          installed: existsSync(hookScript) && (existsSync(huskyDir) || existsSync(gitHook)),
        };
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify(status, null, 2) + '\n');
        } else {
          console.log(`\n  Hooks AIAD ${status.installed ? 'installés' : 'non installés'} (mode=${status.mode})\n`);
          for (const [k, v] of Object.entries(status)) {
            if (typeof v === 'boolean') console.log(`    ${v ? '✓' : '✗'} ${k}`);
          }
          console.log('');
        }
      } else if (values.uninstall) {
        await desinstallerHooks(cwd());
      } else {
        await installerHooks(cwd(), { force: Boolean(values.force) });
      }
      break;

    case 'status':
      await showStatus(cwd(), {
        json: Boolean(values.json),
        markdown: Boolean(values.markdown),
      });
      break;

    case 'doctor': {
      if (values.fix) {
        const { fix: doctorFix } = await import('../lib/doctor-fix.js');
        const r = doctorFix(cwd(), {
          apply: Boolean(values.apply),
          json: Boolean(values.json),
        });
        // Pas d'exit 1 en dry-run même s'il y a des fixes (informatif)
        if (!r.dryRun && r.applied < r.detected) exit(1);
        break;
      }
      // (#221) Mode strict CI/CD : --strict-sante=N exit 1 si santé < N
      const seuilSante = values['strict-sante'] != null
        ? Number(values['strict-sante'])
        : null;
      const rapport = await doctor(cwd(), {
        json: Boolean(values.json),
        markdown: Boolean(values.markdown),
        quiet: Boolean(values.quiet),
        supplementaire: Boolean(values.supplementaire),
        seuilSante: Number.isFinite(seuilSante) ? seuilSante : null,
      });
      if (!rapport.ok) exit(1);
      break;
    }

    case 'repl':
      await ouvrirRepl(cwd());
      break;

    case 'migrate': {
      const json = Boolean(values.json);
      const savedLog = console.log;
      if (json) console.log = () => {};
      let r;
      try {
        r = await migrer(cwd(), {
          force: Boolean(values.force),
          dryRun: Boolean(values['dry-run']),
        });
      } finally {
        if (json) console.log = savedLog;
      }
      if (json) {
        process.stdout.write(JSON.stringify({
          ok: r.ok,
          planned: (r.planned || []).map((p) => ({ id: p.id, description: p.description })),
          appliquees: r.appliquees || [],
        }, null, 2) + '\n');
      }
      break;
    }

    case 'migrate-v2': {
      // (#129) Squelette migration v1 → v2. Dry-run par défaut, --apply
      // requis pour toucher les fichiers. Aucune transform livrée tant que
      // v2 n'est pas définie — la commande détecte juste la version courante.
      // (#195) Options de backup/rollback :
      //   --rollback-on-error : restore le snapshot pré-apply si une transform échoue
      //   --keep-backups N    : ne conserve que les N derniers (défaut 5)
      const keepBackups = values['keep-backups'] != null ? Number(values['keep-backups']) : undefined;
      const r = await migrateV2(cwd(), {
        apply: Boolean(values.apply),
        cible: values.expected,
        rollbackOnError: Boolean(values['rollback-on-error']),
        keepBackups,
      });
      if (values.json) {
        process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      } else {
        console.log(`\n  AIAD migrate-v2 — mode ${r.mode || 'aucun'}\n`);
        if (r.detection.exists) {
          console.log(`    Détection : ${r.detection.version} (${r.detection.fichiers} artefact(s))`);
          if (r.detection.marqueurs.length) {
            console.log(`    Marqueurs : ${r.detection.marqueurs.join(', ')}`);
          }
        }
        console.log(`    ${r.message}\n`);
        if (r.plan && r.plan.length > 0) {
          console.log('  Plan :');
          for (const p of r.plan) console.log(`    · ${p.id} — ${p.titre} (${p.diff.length} changement(s))`);
        }
        if (r.appliquees.length > 0) {
          console.log('\n  Appliquées :');
          for (const a of r.appliquees) console.log(`    ✓ ${a.id} (${a.dureeMs}ms)`);
        }
        if (r.erreurs.length > 0) {
          console.log('\n  Erreurs :');
          for (const e of r.erreurs) console.log(`    ✗ ${e.id} — ${e.raison} ${e.message ? `: ${e.message}` : ''}`);
        }
        if (r.backup?.ok) {
          console.log(`\n  Backup : ${r.backup.files} fichier(s) → .aiad/migrations/v2-backup-${r.backup.timestamp}/`);
        }
        if (r.rollback?.ok) {
          console.log(`  Rollback : ${r.rollback.files} fichier(s) restauré(s) depuis le snapshot.`);
        }
        if (r.prune && r.prune.pruned.length > 0) {
          console.log(`  Pruning : ${r.prune.pruned.length} backup(s) ancien(s) supprimé(s).`);
        }
        console.log('');
      }
      if (!r.ok) exit(1);
      break;
    }

    case 'obsidian': {
      // (#85) Export .aiad/ vers un Obsidian Vault avec wiki-links + MOC.
      const r = exporterObsidian(cwd(), { out: values.out, dryRun: Boolean(values['dry-run']) });
      if (values.json) {
        process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      } else if (!r.ok) {
        console.error(`\n  ! Export Obsidian impossible : ${r.raison || 'erreur inconnue'}\n`);
      } else {
        console.log(`\n  AIAD → Obsidian Vault (${r.mode})\n`);
        console.log(`    Destination : ${r.dir}/`);
        if (r.mode === 'apply') {
          console.log(`    Fichiers    : ${r.files}`);
          console.log(`    Artefacts indexés : ${r.artefacts}`);
          console.log(`\n  Ouvre Obsidian → "Open another vault" → sélectionne le dossier.\n`);
        } else {
          console.log(`    ${r.message}\n`);
        }
      }
      if (!r.ok) exit(1);
      break;
    }

    case 'workspace': {
      const sub = positionals[1];
      // (#277) Sans sous-commande → usage (cohérent avec gitlab/azure/bitbucket).
      // Avant : default 'doctor' déclenchait une erreur "Configuration introuvable"
      // qui paraissait être un bug plutôt qu'un usage manquant.
      if (!sub) {
        console.log('\n  Usage : aiad-sdd workspace <sub>');
        console.log('  Sous-commandes : doctor, trace, analytics');
        console.log('  Détail : aiad-sdd workspace --help\n');
        break;
      }
      if (sub === 'analytics') {
        const { analyserWorkspace } = await import('../lib/workspace-analytics.js');
        await analyserWorkspace(cwd(), {
          config: values.out || 'aiad-workspace.json',
          json: Boolean(values.json),
        });
        break;
      }
      if (!['doctor', 'trace'].includes(sub)) {
        console.error(`\n  Sous-commande inconnue : "${sub}". Disponibles : doctor, trace, analytics.\n`);
        exit(1);
      }
      const result = await runWorkspace(cwd(), sub, {
        config: values.out || 'aiad-workspace.json',
        json: Boolean(values.json),
        markdown: Boolean(values.markdown),
        quiet: Boolean(values.quiet),
      });
      // Exit 1 si au moins un projet en erreur ou si en mode doctor un projet non sain
      if (sub === 'doctor' && result.summary.healthy < result.summary.analyzed) exit(1);
      if (result.summary.errored > 0) exit(1);
      break;
    }

    case 'ai-act': {
      const sub = positionals[1];
      if (sub !== 'audit') {
        console.error(`\n  Sous-commande inconnue : "${sub || ''}". Disponible : audit.\n`);
        exit(1);
      }
      await aiActAudit(cwd(), {
        out: values.out,
        dryRun: Boolean(values['dry-run']),
        json: Boolean(values.json),
      });
      break;
    }

    case 'telemetry': {
      const sub = positionals[1];
      if (sub === 'opt-in') await telemetryOptIn();
      else if (sub === 'opt-out') await telemetryOptOut();
      else if (sub === 'status' || sub === undefined) await telemetryStatus({ json: Boolean(values.json) });
      else {
        console.error(`\n  Sous-commande inconnue : "${sub}". Disponibles : opt-in, opt-out, status.\n`);
        exit(1);
      }
      break;
    }

    case 'feedback': {
      const sub = positionals[1];
      if (sub !== undefined && !['opt-in', 'opt-out', 'status'].includes(sub)) {
        console.error(`\n  Sous-commande inconnue : "${sub}". Disponibles : opt-in, opt-out, status.\n`);
        exit(1);
      }
      await runFeedbackCommand(sub, VERSION);
      break;
    }

    case 'docs': {
      const json = Boolean(values.json);
      const savedLog = console.log;
      if (json) console.log = () => {};
      let r;
      try {
        r = await docs(cwd(), {
          check: Boolean(values.check),
          out: values.out,
        });
      } finally {
        if (json) console.log = savedLog;
      }
      if (json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      if (values.check && r.drift) exit(1);
      break;
    }

    case 'skills': {
      const sub = positionals[1];
      if (sub !== 'validate') {
        console.error(`\n  Sous-commande inconnue : "${sub || ''}"\n  Disponible : aiad-sdd skills validate\n`);
        exit(1);
      }
      const r = await validerSkills(cwd(), { json: Boolean(values.json) });
      if (!r.ok) exit(1);
      break;
    }

    case 'uninstall':
      await uninstall(cwd(), {
        force: Boolean(values.force),
        purge: Boolean(values.purge),
        dryRun: Boolean(values['dry-run']),
      });
      break;

    case 'bench': {
      const sub = positionals[1];
      if (sub === 'compare') {
        const { compareCli } = await import('../lib/bench-history.js');
        const r = compareCli(cwd(), {
          since: values.since ? parseInt(values.since, 10) : undefined,
          threshold: values.threshold ? parseFloat(values.threshold) : undefined,
          json: Boolean(values.json),
        });
        if (r.suffisant && r.regression) exit(1);
        break;
      }
      if (sub === 'history') {
        // (#449) Liste l'historique persisté des runs cold-start.
        const { lireHistorique } = await import('../lib/bench-history.js');
        const runs = lireHistorique(cwd());
        if (values.json) {
          process.stdout.write(JSON.stringify({ runs, total: runs.length }, null, 2) + '\n');
        } else if (runs.length === 0) {
          console.log('Aucun historique cold-start persisté. Utilise `aiad-sdd bench --persist` pour logger un run.');
        } else {
          console.log(`${runs.length} run(s) historisé(s) :`);
          for (const r of runs.slice(-10)) console.log(`  - ${r.ts}: ${r.apresTokens || '?'} tokens`);
        }
        break;
      }
      if (sub === 'metrics') {
        const metrics = [
          { id: 'apresTokens', label: 'Tokens system prompt à froid (après routers v1.7)' },
          { id: 'apresBytes', label: 'Bytes system prompt à froid (chargement initial)' },
          { id: 'avantTokens', label: 'Tokens system prompt baseline (avant routers, référence)' },
          { id: 'transitionTokens', label: 'Tokens chargés par appel router (sous-commande activée)' },
          { id: 'routersCount', label: 'Nombre de routers de commandes (3 — sdd, aiad, aiad-help)' },
          { id: 'aliasCount', label: 'Nombre d\'alias rétro-compatibles plats (legacy)' },
        ];
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ metrics, total: metrics.length }, null, 2) + '\n');
        } else {
          console.log(`\n  Métriques bench cold-start AIAD (${metrics.length}) :\n`);
          for (const m of metrics) console.log(`    • ${m.id} — ${m.label}`);
          console.log('');
        }
        break;
      }
      if (sub === 'flow') {
        const metrics = [
          { id: 'cycle-time', label: 'Cycle Time', desc: 'Temps actif sur un Intent/SPEC (début implémentation → done)' },
          { id: 'lead-time', label: 'Lead Time', desc: 'Temps total dans le système (création Intent → done)' },
          { id: 'throughput', label: 'Throughput', desc: 'Nombre d\'Intents/SPECs livrés par période (semaine/mois)' },
          { id: 'wip', label: 'WIP (Work in Progress)', desc: 'Nombre d\'Intents/SPECs actifs en parallèle' },
          { id: 'flow-efficiency', label: 'Flow Efficiency', desc: 'Ratio temps actif / temps total (vise > 40%)' },
        ];
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ metrics, total: metrics.length }, null, 2) + '\n');
        } else {
          console.log(`\n  Métriques Flow standard (${metrics.length}) :\n`);
          for (const m of metrics) console.log(`    • ${m.id} — ${m.label}\n      ${m.desc}`);
          console.log('');
        }
        break;
      }
      const resultat = bench(cwd(), { json: Boolean(values.json) });
      if (values.persist && resultat) {
        const { appendRun } = await import('../lib/bench-history.js');
        const r = appendRun(cwd(), resultat);
        if (!values.json) console.log(`\n  ✓ Run loggé dans ${r.path}\n`);
      }
      break;
    }

    case 'trace':
      // Mode verdict machine (§3.3/§3.4) : enveloppe canonique + exit 0/1/2.
      // Distinct du `--json` historique (matrice complète, inchangé).
      if (values['output-format'] === 'verdict') {
        const { emitDriftVerdict } = await import('../lib/drift-verdict.js');
        const schema = chargerSchemaVerdict('trace', values['json-schema']);
        const r = emitDriftVerdict(cwd(), { json: true, schema });
        exit(r.code);
      }
      await trace(cwd(), {
        out: values.out,
        formats: liste(values.format, ['md', 'json', 'html', 'sarif']),
        quiet: Boolean(values.quiet),
        failOnGap: Boolean(values['fail-on-gap']),
        json: Boolean(values.json),
        watch: Boolean(values.watch),
        suggest: Boolean(values.suggest),
        dryRun: Boolean(values['dry-run']),
      });
      break;

    case 'veto': {
      // Veto Tier 1 déterministe par diff (§3.1 levier 3) : exit 0/1/2.
      const { emitVeto } = await import('../lib/veto.js');
      const schema = chargerSchemaVerdict('veto', values['json-schema']);
      const r = emitVeto(cwd(), {
        diff: values.diff || (positionals[1] && positionals[1] !== 'verdict' ? positionals[1] : undefined),
        json: values['output-format'] === 'verdict' || Boolean(values.json),
        schema,
      });
      if (!(values['output-format'] === 'verdict' || values.json)) {
        if (r.verdict === 'PASS') {
          console.log(`\n  ${r.enveloppe.triggered.length ? `Zones Tier 1 touchées : ${r.enveloppe.triggered.join(', ')} — toutes annotées @governance.` : 'Aucune zone Tier 1 touchée.'}\n  Verdict : PASS\n`);
        } else {
          console.error(`\n  ⚠️  Veto Tier 1 — ${r.enveloppe.violations.length} zone(s) réglementée(s) sans annotation @governance :`);
          for (const v of r.enveloppe.violations) console.error(`      • ${v.file} → manque @governance ${v.agent}`);
          console.error(`\n  Verdict : JNSP (UNKNOWN = VETO, fail-closed). Pose l'annotation @governance ou tranche avec le subagent.\n`);
        }
      }
      exit(r.code);
      break;
    }

    case 'research':
    case 'research-score': {
      // Gate Research GO/NO-GO déterministe (§3.5) : exit 0/1/2.
      // `aiad-sdd research <RESEARCH-id|NNN>` — verdict gradué ancré Discovery.
      const { emitResearchVerdict } = await import('../lib/research.js');
      const id = positionals[1];
      if (!id) {
        console.error('\n  Usage : aiad-sdd research <RESEARCH-NNN|NNN>\n  Score la viabilité d\'une Research (GO | CONDITIONAL GO | DEFER | NO-GO).\n');
        exit(1);
      }
      const schema = chargerSchemaVerdict('research', values['json-schema']);
      const machine = values['output-format'] === 'verdict' || Boolean(values.json);
      const r = emitResearchVerdict(cwd(), id, { json: machine, schema });
      if (!machine) {
        const e = r.enveloppe;
        if (r.verdict === 'PASS' || r.verdict === 'CONDITIONAL') {
          console.log(`\n  Research ${id} — décision : ${e.decision} (confiance ${e.confidence} %)`);
          if (e.conditions.length) {
            console.log('  Conditions à lever :');
            for (const c of e.conditions) console.log(`      • ${c}`);
          }
          console.log(`  Verdict : ${r.verdict}\n`);
        } else if (r.verdict === 'FAIL') {
          console.error(`\n  Research ${id} — décision : ${e.decision} (confiance ${e.confidence} %)`);
          console.error(`  ${e.reasons.join(' ')}`);
          console.error('  Verdict : FAIL — pas de passage en SPEC sans nouvelle Research.\n');
        } else {
          console.error(`\n  ⚠️  Research ${id} — indécidable (JNSP) :`);
          for (const raison of e.reasons) console.error(`      • ${raison}`);
          console.error('\n  Verdict : JNSP (décision humaine requise). Complète le Discovery, lève les inconnues ou tranche le GO/NO-GO.\n');
        }
      }
      exit(r.code);
      break;
    }

    case 'discovery-check': {
      // Prérequis Discovery (§3.5 SPEC-B) : une Research liée GO/CONDITIONAL GO
      // avec Discovery ancré est-elle prête pour `/sdd spec` / `/sdd exec` ?
      // Consommé par le hook UserPromptSubmit `discovery-gate.js`. Exit 0/1/2.
      const { discoveryPrete } = await import('../lib/research.js');
      const { emitVerdict } = await import('../lib/verdict.js');
      const intentId = positionals[1] || null;
      const d = discoveryPrete(cwd(), intentId);
      const verdict = d.ready ? 'PASS' : (d.verdict === 'FAIL' ? 'FAIL' : 'JNSP');
      const schema = chargerSchemaVerdict('discovery', values['json-schema']);
      const machine = values['output-format'] === 'verdict' || Boolean(values.json);
      const r = emitVerdict({
        verdict,
        payload: { ready: d.ready, intent: intentId, research: d.research, raison: d.raison },
        schema, json: machine,
      });
      if (!machine) {
        if (d.ready) {
          console.log(`\n  Discovery prêt pour ${intentId || 'cet Intent'} — Research ${d.research} (${d.raison})\n  Verdict : PASS\n`);
        } else {
          console.error(`\n  ⚠️  Discovery non prêt${intentId ? ` pour ${intentId}` : ''} : ${d.raison}`);
          console.error(`  Lance \`/sdd research\` avant \`/sdd spec\` / \`/sdd exec\`.\n  Verdict : ${verdict}\n`);
        }
      }
      exit(r.code);
      break;
    }

    case 'mini-gate': {
      // Mini-gate par tranche d'exécution (§3.6) : verdict PASS|CONDITIONAL|
      // FAIL|JNSP, exit 0/0/1/2. `--all` agrège le plan complet.
      const specId = positionals[1];
      if (!specId) {
        console.error('\n  Usage : aiad-sdd mini-gate <SPEC-id> --phase N  (ou --all)\n  Valide une tranche d\'exécution (tests livrés + dette).\n');
        exit(1);
      }
      const machine = values['output-format'] === 'verdict' || Boolean(values.json);
      if (values.all) {
        const { chargerPlan, parserPlan } = await import('../lib/exec-status.js');
        const { calculerMiniGatePlan } = await import('../lib/mini-gate.js');
        const { codeSortie } = await import('../lib/verdict.js');
        const plan = chargerPlan(cwd(), specId);
        if (!plan) {
          console.error(`\n  ⚠️  Plan d'exécution introuvable pour « ${specId} » — lance d'abord /sdd exec.\n  Verdict : JNSP\n`);
          exit(2);
        }
        const r = calculerMiniGatePlan(parserPlan(plan.contenu), cwd());
        if (machine) {
          process.stdout.write(JSON.stringify({ verdict: r.verdict, exitCode: codeSortie(r.verdict), conditions: r.conditions, parTranche: r.parTranche }) + '\n');
        } else {
          console.log(`\n  Mini-gate (plan ${specId}) :`);
          for (const t of r.parTranche) console.log(`    ${t.verdict === 'PASS' ? '✓' : t.verdict === 'CONDITIONAL' ? '~' : '✗'} Phase ${t.num} — ${t.titre} : ${t.verdict}`);
          if (r.conditions.length) { console.log('  Dette à lever :'); for (const c of r.conditions) console.log(`      • ${c}`); }
          console.log(`  Verdict global : ${r.verdict}\n`);
        }
        exit(codeSortie(r.verdict));
      }
      if (!values.phase) {
        console.error('\n  Précise la tranche : aiad-sdd mini-gate <SPEC-id> --phase N\n');
        exit(1);
      }
      const { emitMiniGate } = await import('../lib/mini-gate.js');
      const schema = chargerSchemaVerdict('minigate', values['json-schema']);
      const r = emitMiniGate(cwd(), specId, Number(values.phase), { json: machine, schema });
      if (!machine) {
        const e = r.enveloppe;
        const tete = `Phase ${e.phase}${e.titre ? ` — ${e.titre}` : ''}`;
        if (r.verdict === 'PASS' || r.verdict === 'CONDITIONAL') {
          console.log(`\n  Mini-gate ${tete} : ${r.verdict}`);
          if (e.conditions.length) { console.log('  Dette à lever avant la gate finale :'); for (const c of e.conditions) console.log(`      • ${c}`); }
          console.log('');
        } else {
          console.error(`\n  ✗ Mini-gate ${tete} : ${r.verdict}`);
          for (const raison of e.raisons) console.error(`      • ${raison}`);
          console.error('');
        }
      }
      exit(r.code);
      break;
    }

    case 'exec-status': {
      // Affiche l'avancement d'un plan d'exécution phasé (§3.6).
      const { chargerPlan, parserPlan, rendreStatut, prochaineTranche } = await import('../lib/exec-status.js');
      const specId = positionals[1];
      if (!specId) {
        console.error('\n  Usage : aiad-sdd exec-status <SPEC-id>\n');
        exit(1);
      }
      const plan = chargerPlan(cwd(), specId);
      if (!plan) {
        console.error(`\n  Plan d'exécution introuvable pour « ${specId} » — lance d'abord /sdd exec.\n`);
        exit(1);
      }
      const modele = parserPlan(plan.contenu);
      if (values.json) {
        const suivante = prochaineTranche(modele);
        process.stdout.write(JSON.stringify({ phases: modele.phases.map((p) => ({ num: p.num, titre: p.titre, statut: p.statut.key })), summary: modele.summary, next: suivante ? suivante.num : null }, null, 2) + '\n');
      } else {
        console.log(`\n  Plan d'exécution ${specId}\n`);
        console.log(rendreStatut(modele));
        const suivante = prochaineTranche(modele);
        console.log(suivante ? `\n  Prochaine tranche : Phase ${suivante.num} — ${suivante.titre}\n` : '\n  Toutes les tranches sont validées.\n');
      }
      break;
    }

    case 'canary': {
      // Canary suite (§3.10) : rejoue les cas figés contre une baseline pour
      // séparer régression réelle (FAIL/DRIFT) et bruit de serving. Exit 0/1/2.
      const {
        chargerCasCanary, executerCanary, lireSnapshotCanary,
      } = await import('../lib/canary.js');
      const { codeSortie } = await import('../lib/verdict.js');
      const { spawnSync } = await import('node:child_process');
      const { existsSync: existe, readFileSync: lire } = await import('node:fs');

      const cas = chargerCasCanary(cwd());
      if (cas.length === 0) {
        console.error('\n  Aucun cas canary dans .aiad/canary/cases/ — `aiad-sdd init` en fournit un set figé.\n  Verdict : JNSP\n');
        exit(2);
      }
      const runs = Number(values.runs) > 0 ? Number(values.runs) : 1;

      // Runner réel : deterministic → spawn `aiad-sdd <command>` K fois et lit
      // le verdict ; generative → lit les échantillons collectés.
      const runner = (c) => {
        if (c.kind === 'deterministic') {
          const args = c.command.split(/\s+/).filter(Boolean);
          if (!args.includes('--output-format')) args.push('--output-format', 'verdict');
          const observations = [];
          for (let i = 0; i < runs; i++) {
            const res = spawnSync(process.execPath, [__filename, ...args], { encoding: 'utf-8' });
            let verdict = null;
            try {
              const ligne = (res.stdout || '').trim().split('\n').filter(Boolean).pop();
              verdict = ligne ? JSON.parse(ligne).verdict : null;
            } catch { /* sortie non-JSON */ }
            // Fallback : exit code → verdict canonique (0 PASS / 1 FAIL / 2 JNSP).
            if (!verdict) verdict = res.status === 0 ? 'PASS' : res.status === 2 ? 'JNSP' : 'FAIL';
            observations.push(verdict);
          }
          return { observations };
        }
        // generative : échantillons figés sur disque.
        const p = join(cwd(), '.aiad', 'metrics', 'canary', 'samples', `${c.id}.json`);
        if (!existe(p)) return { observations: [] };
        try {
          const arr = JSON.parse(lire(p, 'utf-8'));
          return { observations: Array.isArray(arr) ? arr : [] };
        } catch { return { observations: [] }; }
      };

      const snapshot = lireSnapshotCanary(cwd());
      const rapport = executerCanary(cas, runner, { snapshot });
      const machine = values['output-format'] === 'verdict' || Boolean(values.json);
      const date = new Date().toISOString().slice(0, 10);
      const payload = { ...rapport, date, exitCode: codeSortie(rapport.verdict) };

      if (machine) {
        process.stdout.write(JSON.stringify(payload) + '\n');
      } else {
        console.log(`\n  Canary suite — ${date}`);
        if (snapshot.model) console.log(`  Snapshot : ${snapshot.model}${snapshot.effort ? ` · effort ${snapshot.effort}` : ''}${snapshot.claude_code_version ? ` · ${snapshot.claude_code_version}` : ''}\n`);
        for (const r of rapport.cases) {
          const icone = r.verdict === 'PASS' ? '✓' : r.verdict === 'CONDITIONAL' ? '~' : r.verdict === 'FAIL' ? '✗' : '?';
          const det = r.kind === 'generative' && r.dispersion != null ? ` (dispersion ${r.dispersion} %)` : r.observed != null ? ` (${r.observed})` : '';
          console.log(`    ${icone} ${r.id} [${r.kind}] : ${r.verdict}${det}`);
          for (const raison of r.reasons || []) console.log(`        ${raison}`);
        }
        const s = rapport.summary;
        console.log(`\n  ${s.pass}/${s.total} stables · ${s.drift} DRIFT · ${s.fail} régression(s) · ${s.unknown} indécidable(s)`);
        console.log(`  Verdict : ${rapport.verdict}\n`);
      }
      exit(codeSortie(rapport.verdict));
      break;
    }

    case 'dashboard': {
      const dashboardOpts = {
        out: values.out,
        quiet: Boolean(values.quiet),
        sourceBase: values['source-base'],
        publicUrl: values['public-url'],
        check: Boolean(values.check),
        full: Boolean(values.full),
      };
      // (#250) --check : valide collect+render sans écrire (CI). Pas de
      // --serve, --watch possible en mode check : on retourne juste le résultat.
      if (dashboardOpts.check) {
        const r = await dashboard(cwd(), dashboardOpts);
        if (values.json) {
          // (#296) _meta cohérent avec écosystème (10ᵉ schéma distinct).
          const withMeta = { _meta: buildMeta({ schema: 'aiad-sdd-dashboard-check' }), ...r };
          process.stdout.write(JSON.stringify(withMeta, null, 2) + '\n');
        } else if (r.ok) {
          console.log(`  ✓ Dashboard --check : ${r.pages.length} page(s) OK.\n`);
        } else {
          console.error(`\n  ✗ Dashboard --check : ${r.errors.length} erreur(s) :`);
          for (const e of r.errors) console.error(`    - ${e}`);
          console.error('');
        }
        if (!r.ok) exit(1);
        break;
      }
      const result = await dashboard(cwd(), dashboardOpts);
      if (values.serve) {
        // (#310) Propage --quiet à serveDashboard pour silencer le banner
        // "Dashboard servi en local …" en CI / scripts d'orchestration.
        const { server } = await serveDashboard(result.outDir, { port: values.port, quiet: Boolean(values.quiet) });
        let watch;
        if (values.watch) {
          watch = watcher(cwd(), async (filename) => {
            try {
              await dashboard(cwd(), { ...dashboardOpts, quiet: true });
              console.log(`  ↻ Dashboard régénéré (${filename || 'changement détecté'})`);
            } catch (err) {
              console.error(`  ✗ Régénération échouée : ${err.message}`);
            }
          });
          console.log('  ⏵ Watch actif sur .aiad/ — modifie un Intent ou une SPEC pour voir le dashboard se mettre à jour.');
        }
        const arret = () => {
          console.log('\n  Arrêt du serveur…');
          if (watch) watch.close();
          server.close(() => process.exit(0));
        };
        process.on('SIGINT', arret);
        process.on('SIGTERM', arret);
        await new Promise(() => {});
      }
      break;
    }

    case 'sbom': {
      await genererSbom(cwd(), {
        out: values.out,
        json: Boolean(values.json),
        dryRun: Boolean(values['dry-run']),
      });
      break;
    }

    case 'verify-reproducibility': {
      const r = await verifyReproducibility(cwd(), {
        expected: values.expected,
        json: Boolean(values.json),
      });
      if (values.expected && r.match === false) exit(1);
      break;
    }

    case 'dpia': {
      await dpia(cwd(), {
        out: values.out,
        json: Boolean(values.json),
        dryRun: Boolean(values['dry-run']),
      });
      break;
    }

    case 'import': {
      if (positionals[1] === 'sources') {
        const sources = [
          { id: 'spec-kit', label: 'Spec Kit (GitHub .specify/ ou frontmatter spec-kit)' },
          { id: 'kiro', label: 'Kiro (.kiro/ steering + specs)' },
          { id: 'auto', label: 'Auto-détection (priorité kiro > spec-kit)' },
        ];
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ sources, total: sources.length }, null, 2) + '\n');
        } else {
          console.log(`\n  Sources d'import AIAD (${sources.length}) :\n`);
          for (const s of sources) console.log(`    • ${s.id} — ${s.label}`);
          console.log('');
        }
        break;
      }
      await importerExterne(cwd(), {
        from: values.from || 'auto',
        force: Boolean(values.force),
        dryRun: Boolean(values['dry-run']),
      });
      break;
    }

    case 'marketplace': {
      const sub = positionals[1] || 'list';
      if (sub === 'list') {
        marketplaceListe({
          secteur: values.from,
          juridiction: values.runtime, // réutilise le flag --runtime pour filtre juridiction (pragmatique)
          json: Boolean(values.json),
        });
      } else if (sub === 'info') {
        const id = positionals[2];
        if (!id) {
          console.error(`\n  Usage : aiad-sdd marketplace info <id>\n  Exemple : aiad-sdd marketplace info eu-health\n`);
          exit(1);
        }
        const pack = marketplaceInfo(id, { json: Boolean(values.json) });
        if (!pack) exit(1);
      } else {
        console.error(`\n  Usage : aiad-sdd marketplace <sub>\n  Sous-commandes : list, info <id>\n`);
        exit(1);
      }
      break;
    }

    case 'cert': {
      const sub = positionals[1];
      const arg = positionals[2];
      if (sub === 'matrix') {
        if (values.json) {
          process.stdout.write(JSON.stringify({
            niveaux: CERT_NIVEAUX, axes: CERT_AXES.map((a) => ({ id: a.id, label: a.label })),
            matrice: CERT_MATRICE,
          }, null, 2) + '\n');
        } else {
          console.log(rendreMatriceMarkdown());
        }
      } else if (sub === 'axes') {
        const axes = CERT_AXES.map((a) => ({ id: a.id, label: a.label }));
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ axes, total: axes.length }, null, 2) + '\n');
        } else {
          console.log(`\n  Axes de compétences certification AIAD (${axes.length}) :\n`);
          for (const a of axes) console.log(`    • ${a.id} — ${a.label}`);
          console.log('');
        }
      } else if (sub === 'niveaux') {
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ niveaux: CERT_NIVEAUX, total: CERT_NIVEAUX.length }, null, 2) + '\n');
        } else {
          console.log(`\n  Niveaux de certification AIAD (${CERT_NIVEAUX.length}, ordre croissant) :\n`);
          for (const n of CERT_NIVEAUX) console.log(`    • ${n}`);
          console.log('');
        }
      } else if (sub === 'valeurs') {
        const valeurs = [
          { id: 'primaute-intention', label: 'Primauté de l\'Intention Humaine' },
          { id: 'honnetete-contradictions', label: 'Honnêteté sur les Contradictions' },
          { id: 'sobriete-intentionnelle', label: 'Sobriété Intentionnelle' },
          { id: 'ouverture-radicale', label: 'Ouverture Radicale' },
          { id: 'empirisme-sans-concession', label: 'Empirisme sans Concession' },
          { id: 'responsabilite-partagee', label: 'Responsabilité Partagée' },
          { id: 'human-authorship', label: 'Human Authorship — La paternité de l\'intention ne se délègue pas' },
        ];
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ valeurs, total: valeurs.length }, null, 2) + '\n');
        } else {
          console.log(`\n  Les 7 valeurs fondamentales AIAD (${valeurs.length}) :\n`);
          for (const v of valeurs) console.log(`    • ${v.id} — ${v.label}`);
          console.log('');
        }
      } else if (sub === 'exam') {
        const niveau = arg || 'Praticien';
        const niveauNorm = CERT_NIVEAUX.find((n) => n.toLowerCase() === niveau.toLowerCase());
        if (!niveauNorm) {
          console.error(`\n  Niveau inconnu : "${niveau}". Disponibles : ${CERT_NIVEAUX.join(', ')}.\n`);
          exit(1);
        }
        const r = genererSujetExam(niveauNorm);
        if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
        else console.log(r.sujet);
      } else if (sub === 'badge') {
        const niveau = values.niveau || arg || 'Praticien';
        const candidat = values.candidat || values.candidate;
        const axes = values.axes ? values.axes.split(',').map((s) => s.trim()) : CERT_AXES.map((a) => a.id);
        if (!candidat) {
          console.error(`\n  --candidat requis. Exemple : aiad-sdd cert badge --niveau Praticien --candidat "Steeve Evers"\n`);
          exit(1);
        }
        const niveauNorm = CERT_NIVEAUX.find((n) => n.toLowerCase() === niveau.toLowerCase());
        if (!niveauNorm) {
          console.error(`\n  Niveau inconnu : "${niveau}". Disponibles : ${CERT_NIVEAUX.join(', ')}.\n`);
          exit(1);
        }
        const secret = process.env.AIAD_CERT_SECRET;
        if (!secret) {
          console.error(`\n  AIAD_CERT_SECRET manquant. Définis-le (≥ 16 caractères) :\n    export AIAD_CERT_SECRET="<clé partagée organisation/candidat>"\n`);
          exit(1);
        }
        try {
          const payload = construirePayload({ candidat, niveau: niveauNorm, axes });
          const jws = signerBadge(payload, secret);
          if (values.json) {
            process.stdout.write(JSON.stringify({ jws, payload }, null, 2) + '\n');
          } else {
            console.log(`\n  ✓ Badge AIAD émis pour ${candidat} (${niveauNorm}) — valide 3 ans.\n`);
            console.log(jws);
            console.log(`\n  Conserve ce badge JWS — il est vérifiable hors-ligne via :`);
            console.log(`    aiad-sdd cert verify "${jws}"\n`);
          }
        } catch (err) {
          console.error(`\n  ${err.message}\n`);
          exit(1);
        }
      } else if (sub === 'verify') {
        const jws = arg;
        if (!jws) {
          console.error(`\n  Usage : aiad-sdd cert verify <jws>\n`);
          exit(1);
        }
        const secret = process.env.AIAD_CERT_SECRET;
        if (!secret) {
          console.error(`\n  AIAD_CERT_SECRET manquant pour vérifier le badge.\n`);
          exit(1);
        }
        const r = verifierBadge(jws, secret);
        if (values.json) {
          process.stdout.write(JSON.stringify(r, null, 2) + '\n');
        } else if (r.valid) {
          console.log(`\n  ✓ Badge valide.`);
          console.log(`    Candidat : ${r.payload.sub}`);
          console.log(`    Niveau   : ${r.payload.niveau}`);
          console.log(`    Axes     : ${r.payload.axes.join(', ')}`);
          console.log(`    Émis     : ${new Date(r.payload.iat * 1000).toISOString().slice(0, 10)}`);
          console.log(`    Expire   : ${new Date(r.payload.exp * 1000).toISOString().slice(0, 10)}\n`);
        } else {
          console.error(`\n  ✗ Badge invalide : ${r.raison}\n`);
          exit(1);
        }
      } else {
        console.error(`\n  Usage : aiad-sdd cert <sub>\n  Sous-commandes : matrix, exam <niveau>, badge --niveau <N> --candidat <C>, verify <jws>\n`);
        exit(1);
      }
      break;
    }

    case 'storybook': {
      await genererStorybook(cwd(), {
        out: values.out,
        dryRun: Boolean(values['dry-run']),
        json: Boolean(values.json),
      });
      break;
    }

    case 'export': {
      const sub = positionals[1];
      if (sub === 'openapi') {
        await exporterOpenApi(cwd(), {
          out: values.out,
          format: values.format === 'json' ? 'json' : 'yaml',
          dryRun: Boolean(values['dry-run']),
          json: Boolean(values.json),
        });
      } else if (sub === 'confluence') {
        try {
          const r = await exporterConfluence(cwd(), {
            domain: values.from,
            spaceKey: values.project,
            email: values.candidat,
            token: values.token,
            dryRun: Boolean(values['dry-run']),
          });
          if (values.json) {
            process.stdout.write(JSON.stringify(r, null, 2) + '\n');
          } else {
            console.log(`\n  ✓ Confluence : ${r.total} page(s) ${values['dry-run'] ? '(dry-run)' : 'publiées'}.`);
            for (const p of r.pages.slice(0, 10)) {
              console.log(`    [${p.kind}] ${p.title} → ${p.action}`);
            }
            if (r.pages.length > 10) console.log(`    (+${r.pages.length - 10} autres)`);
            console.log('');
          }
        } catch (err) {
          console.error(`\n  ${err.message}\n`);
          exit(1);
        }
      } else {
        console.error(`\n  Usage : aiad-sdd export <sub>\n  Sous-commandes : openapi, confluence\n`);
        exit(1);
      }
      break;
    }

    case 'suggest-annotations': {
      const fichier = positionals[1];
      if (!fichier) {
        console.error(`\n  Usage : aiad-sdd suggest-annotations <fichier>\n  Exemple : aiad-sdd suggest-annotations src/auth/login.ts\n`);
        exit(1);
      }
      try {
        await suggererAnnotations(cwd(), fichier, {
          json: Boolean(values.json),
        });
      } catch (err) {
        if (err.message && /fetch failed|ECONNREFUSED/.test(err.message)) {
          console.error(`\n  ${err.message}\n  Ollama indisponible. Démarre-le via \`ollama serve\` ou pointe AIAD_OLLAMA_URL vers ton serveur.\n`);
        } else {
          console.error(`\n  Erreur suggest-annotations : ${err.message}\n`);
        }
        exit(1);
      }
      break;
    }

    case 'review': {
      const target = positionals[1];
      if (!target) {
        console.error(`\n  Usage : aiad-sdd review <branch>\n  Exemples : aiad-sdd review main\n            aiad-sdd review origin/main --out review.md\n`);
        exit(1);
      }
      try {
        await review(cwd(), target, {
          json: Boolean(values.json),
          out: values.out,
        });
      } catch (err) {
        console.error(`\n  Erreur review : ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'template': {
      if (values.list || positionals[1] === 'list') {
        const liste = listerTemplatesSpec().map(({ frontmatter, path, ...rest }) => rest);
        if (values.json) {
          process.stdout.write(JSON.stringify({ templates: liste, total: liste.length }, null, 2) + '\n');
          break;
        }
        console.log(`\n  Templates de SPEC disponibles :\n`);
        for (const t of liste) {
          console.log(`    • ${t.id}`);
          if (t.governance.length) console.log(`      Gouvernance : ${t.governance.join(' · ')}`);
          console.log('');
        }
        console.log(`  Usage : npx aiad-sdd template <domain> [--out path] [--dry-run]\n`);
        break;
      }
      if (positionals[1] === 'info') {
        const id = positionals[2];
        const liste = listerTemplatesSpec();
        const t = id ? liste.find((x) => x.id === id) : null;
        if (!t) {
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ id: id || null, found: false, available: liste.map((x) => x.id) }, null, 2) + '\n');
          } else {
            console.error(`\n  Template inconnu : "${id || ''}". Disponibles : ${liste.map((x) => x.id).join(', ')}.\n`);
            exit(1);
          }
          break;
        }
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ id: t.id, found: true, template: { id: t.id, title: t.title, governance: t.governance } }, null, 2) + '\n');
        } else {
          console.log(`\n  ${t.title} (${t.id})\n  Gouvernance : ${t.governance.join(' · ') || '—'}\n`);
        }
        break;
      }
      const domain = positionals[1];
      if (!domain) {
        console.error(`\n  Usage : aiad-sdd template <domain> [--list]\n  Exemples : aiad-sdd template auth-oidc\n            aiad-sdd template payment-pci --dry-run\n`);
        exit(1);
      }
      if (!templateSpecExiste(domain)) {
        const dispo = listerTemplatesSpec().map((t) => t.id).join(', ');
        console.error(`\n  Domaine inconnu : "${domain}". Disponibles : ${dispo}\n`);
        exit(1);
      }
      await creerSpecDepuisTemplate(cwd(), domain, {
        out: values.out,
        dryRun: Boolean(values['dry-run']),
        force: Boolean(values.force),
      });
      break;
    }

    case 'score': {
      const type = positionals[1];
      const id = positionals[2];
      if (type === 'verdicts') {
        const verdicts = SCORE_VERDICTS.map((v) => ({ label: v.label, seuil: v.seuil }));
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ verdicts, total: verdicts.length }, null, 2) + '\n');
        } else {
          console.log(`\n  Verdicts scoring AIAD (${verdicts.length}) :\n`);
          for (const v of verdicts) console.log(`    • ${v.label} (pct ≥ ${(v.seuil * 100).toFixed(0)}%)`);
          console.log('');
        }
        break;
      }
      if (!type || !id) {
        console.error(`\n  Usage : aiad-sdd score <intent|spec> <id>\n  Exemples : aiad-sdd score spec SPEC-001-1-auth\n            aiad-sdd score intent INTENT-001\n`);
        exit(1);
      }
      try {
        const r = await scorerArtefact(cwd(), type, id, {
          json: Boolean(values.json),
        });
        // Exit 1 si verdict insuffisant (utile pour CI parity)
        if (r.verdict && r.verdict.label === 'Insuffisant') exit(1);
      } catch (err) {
        if (err.message && /fetch failed|ECONNREFUSED/.test(err.message)) {
          console.error(`\n  ${err.message}\n  Ollama indisponible. Démarre-le via \`ollama serve\` ou pointe AIAD_OLLAMA_URL vers ton serveur.\n`);
        } else {
          console.error(`\n  Erreur scoring : ${err.message}\n`);
        }
        exit(1);
      }
      break;
    }

    case 'new': {
      if (values.list || positionals[1] === 'list') {
        const liste = listerTemplates().map(({ id, title, description, target, language, framework, license }) => ({
          id, title, description, target, language, framework, license,
        }));
        if (values.json) {
          process.stdout.write(JSON.stringify({ templates: liste, total: liste.length }, null, 2) + '\n');
          break;
        }
        console.log(`\n  Templates de projets disponibles :\n`);
        for (const t of liste) {
          console.log(`    • ${t.id}`);
          console.log(`      ${t.title}`);
          console.log(`      ${t.description}\n`);
        }
        console.log(`  Usage : npx aiad-sdd new <template> [<dir>] [--force] [--dry-run]\n`);
        break;
      }
      if (positionals[1] === 'info') {
        const id = positionals[2];
        const liste = listerTemplates();
        const t = id ? liste.find((x) => x.id === id) : null;
        if (!t) {
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ id: id || null, found: false, available: liste.map((x) => x.id) }, null, 2) + '\n');
          } else {
            console.error(`\n  Template inconnu : "${id || ''}". Disponibles : ${liste.map((x) => x.id).join(', ')}.\n`);
            exit(1);
          }
          break;
        }
        const template = { id: t.id, title: t.title, description: t.description, target: t.target, language: t.language, framework: t.framework, license: t.license };
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ id: t.id, found: true, template }, null, 2) + '\n');
        } else {
          console.log(`\n  ${t.title} (${t.id})\n  ${t.description}\n  Target: ${t.target} · Lang: ${t.language}${t.framework ? ' · Framework: ' + t.framework : ''} · License: ${t.license}\n`);
        }
        break;
      }
      const templateId = positionals[1];
      if (!templateId) {
        console.error(`\n  Argument manquant : npx aiad-sdd new <template>. Lance \`--list\` pour voir les templates.\n`);
        exit(1);
      }
      if (!templateExiste(templateId)) {
        const dispo = listerTemplates().map((t) => t.id).join(', ');
        console.error(`\n  Template inconnu : "${templateId}". Disponibles : ${dispo}\n`);
        exit(1);
      }
      const dir = positionals[2] || templateId;
      const destDir = dir.startsWith('/') ? dir : join(cwd(), dir);
      await creerProjet(templateId, destDir, {
        force: Boolean(values.force),
        dryRun: Boolean(values['dry-run']),
      });
      break;
    }

    case 'emit-rules': {
      if (positionals[1] === 'runtimes') {
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ runtimes: EMIT_RUNTIMES, total: EMIT_RUNTIMES.length }, null, 2) + '\n');
        } else {
          console.log(`\n  Runtimes IA supportés par emit-rules (${EMIT_RUNTIMES.length}) :\n`);
          for (const r of EMIT_RUNTIMES) console.log(`    • ${r}`);
          console.log('');
        }
        break;
      }
      const json = Boolean(values.json);
      const savedLog = console.log;
      if (json) console.log = () => {};
      let stats;
      try {
        stats = await emitRules(cwd(), {
          runtimes: liste(values.runtime, ['all']),
          check: Boolean(values.check),
          force: Boolean(values.force),
          dryRun: Boolean(values['dry-run']),
        });
      } finally {
        if (json) console.log = savedLog;
      }
      if (json) {
        process.stdout.write(JSON.stringify({
          runtimes: liste(values.runtime, ['all']),
          check: Boolean(values.check),
          dryRun: Boolean(values['dry-run']),
          created: stats.created, updated: stats.updated, unchanged: stats.unchanged, drifts: stats.drifts,
        }, null, 2) + '\n');
      }
      if (values.check && stats && stats.drifts && stats.drifts.length > 0) {
        exit(1);
      }
      break;
    }

    case 'hook-stats': {
      hookStats(cwd(), { json: Boolean(values.json) });
      break;
    }

    case 'gitlab': {
      const sub = positionals[1];
      const config = gitlabConfig({ projectId: values.project, token: values.token });
      try {
        if (sub === 'review') {
          const r = await gitlabReviewMr(cwd(), {
            mrIid: values.mr,
            branch: values.branch || 'main',
            projectId: values.project,
            token: values.token,
            dryRun: Boolean(values['dry-run']),
          });
          if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
          else if (r.dryRun) console.log('\n  (dry-run) — corps du commentaire MR :\n\n' + r.body + '\n');
          else console.log(`\n  ✓ Commentaire posté sur MR !${values.mr}.\n`);
        } else if (sub === 'issue') {
          if (!values.intent) {
            console.error('\n  Usage : aiad-sdd gitlab issue --intent <INT-NNN>\n');
            exit(1);
          }
          const payload = intentVersIssue(cwd(), values.intent);
          if (values['dry-run']) {
            if (values.json) {
              process.stdout.write(JSON.stringify({ dryRun: true, payload }, null, 2) + '\n');
            } else {
              console.log('\n  (dry-run) — payload Issue :\n\n' + JSON.stringify(payload, null, 2) + '\n');
            }
          } else {
            const r = await creerIssue(config, payload);
            if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
            else console.log(`\n  ✓ Issue #${r.iid} créée : ${r.web_url}\n`);
          }
        } else if (sub === 'wiki') {
          const kind = values.intent ? 'intent' : (values.spec ? 'spec' : null);
          const id = values.intent || values.spec;
          if (!kind || !id) {
            console.error('\n  Usage : aiad-sdd gitlab wiki --intent <INT-NNN> | --spec <SPEC-NNN-N-slug>\n');
            exit(1);
          }
          const payload = artefactVersWiki(cwd(), { kind, id });
          if (values['dry-run']) {
            if (values.json) {
              process.stdout.write(JSON.stringify({ dryRun: true, kind, payload }, null, 2) + '\n');
            } else {
              console.log('\n  (dry-run) — page wiki :\n\n' + JSON.stringify(payload, null, 2) + '\n');
            }
          } else {
            const r = await publierWiki(config, payload);
            if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
            else console.log(`\n  ✓ Page wiki ${r.action} : ${payload.slug}\n`);
          }
        } else {
          console.error('\n  Usage : aiad-sdd gitlab <sub>\n  Sous-commandes : review, issue, wiki\n');
          exit(1);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'tutorial': {
      try {
        const id = positionals[1];
        if (!id || values.list) {
          tutorielsListe({ json: Boolean(values.json) });
        } else if (id === 'info') {
          const tutId = positionals[2];
          const available = Object.keys(TUTORIELS_REG);
          const t = tutId && TUTORIELS_REG[tutId];
          if (!t) {
            if (Boolean(values.json)) {
              process.stdout.write(JSON.stringify({ id: tutId || null, found: false, available }, null, 2) + '\n');
            } else {
              console.error(`\n  Tutoriel inconnu : "${tutId || ''}". Disponibles : ${available.join(', ')}.\n`);
              exit(1);
            }
            break;
          }
          const tutorial = { id: tutId, title: t.title, specDomain: t.specDomain, intentTitle: t.intent.title, workflow: t.workflow };
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ id: tutId, found: true, tutorial }, null, 2) + '\n');
          } else {
            console.log(`\n  ${t.title} (${tutId})\n  SpecDomain : ${t.specDomain}\n  Intent     : ${t.intent.title}\n  Workflow (${t.workflow.length}) :\n${t.workflow.map((w) => '    ' + w).join('\n')}\n`);
          }
        } else {
          executerTutoriel(cwd(), id, {
            out: values.out,
            json: Boolean(values.json),
          });
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'rbac': {
      const sub = positionals[1] || 'whoami';
      try {
        if (sub === 'whoami') {
          rbacWhoami(cwd(), { json: Boolean(values.json) });
        } else if (sub === 'init') {
          const r = rbacInit(cwd(), { force: Boolean(values.force), dryRun: Boolean(values['dry-run']) });
          if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
          else console.log(`\n  ✓ Template équipes créé : ${r.path}${r.dryRun ? ' (dry-run)' : ''}\n`);
        } else if (sub === 'check') {
          const strict = Boolean(values.strict);
          const r = rbacCheck(cwd(), { strict, json: Boolean(values.json) });
          if (!r.valid) exit(1);
        } else {
          console.error('\n  Usage : aiad-sdd rbac <sub>\n  Sous-commandes : whoami, init [--force], check [--strict]\n');
          exit(1);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'org': {
      const sub = positionals[1] || 'show';
      try {
        if (sub === 'show') {
          orgAfficherConfig(cwd(), { json: Boolean(values.json) });
        } else if (sub === 'init') {
          const { writeFileSync, mkdirSync, existsSync: existsLocal } = await import('node:fs');
          const path = join(cwd(), '.aiad', 'org.yml');
          const existsBefore = existsLocal(path);
          const dryRun = Boolean(values['dry-run']);
          if (existsBefore && !values.force && !dryRun) {
            console.error(`\n  ${path} existe déjà. --force pour écraser.\n`);
            exit(1);
          }
          if (!dryRun) {
            if (!existsLocal(join(cwd(), '.aiad'))) mkdirSync(join(cwd(), '.aiad'), { recursive: true });
            writeFileSync(path, orgTemplate(), 'utf-8');
          }
          const action = dryRun ? 'preview' : (existsBefore ? 'overwritten' : 'created');
          if (values.json) {
            process.stdout.write(JSON.stringify({ path, exists: existsBefore, action, dryRun }, null, 2) + '\n');
          } else {
            console.log(`\n  ✓ Template org config ${action} : ${path}${dryRun ? ' (dry-run)' : ''}\n  Édite ce fichier pour définir les politiques organisationnelles.\n`);
          }
        } else if (sub === 'check') {
          // Construit un état projet minimal pour la vérification
          const { readdirSync, existsSync: existsLocal } = await import('node:fs');
          const govDir = join(cwd(), '.aiad', 'gouvernance');
          const governanceFiles = existsLocal(govDir) ? readdirSync(govDir) : [];
          const { computeSovereigntyScore } = await import('../lib/sovereignty-score.js');
          const sov = computeSovereigntyScore(cwd());
          const projetEtat = {
            governanceFiles,
            sovereigntyScore: sov.score,
            runtimes: values.runtime ? values.runtime.split(',').map((s) => s.trim()) : [],
          };
          const r = orgVerifier(cwd(), projetEtat, { json: Boolean(values.json) });
          if (!r.valid && r.strict) exit(1);
        } else {
          console.error('\n  Usage : aiad-sdd org <sub>\n  Sous-commandes : show, init [--force], check [--runtime <list>]\n');
          exit(1);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'schema': {
      try {
        cliSchemaGenerer(cwd(), {
          out: values.out,
          format: values.format === 'json' ? 'json' : 'yaml',
          dryRun: Boolean(values['dry-run']),
          json: Boolean(values.json),
        });
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'hooks-init': {
      try {
        const { writeFileSync, mkdirSync, existsSync: existsLocal } = await import('node:fs');
        const dir = join(cwd(), '.aiad', 'hooks');
        const path = join(dir, 'aiad-hooks.js');
        const relPath = '.aiad/hooks/aiad-hooks.js';
        const dryRun = Boolean(values['dry-run']);
        if (existsLocal(path) && !values.force && !dryRun) {
          if (values.json) {
            process.stdout.write(JSON.stringify({ path: relPath, dryRun: false, exists: true }, null, 2) + '\n');
          } else {
            console.error(`\n  ${path} existe déjà. Utilise --force pour écraser.\n`);
          }
          exit(1);
        }
        if (!dryRun) {
          if (!existsLocal(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(path, commandHookTemplate(), 'utf-8');
        }
        if (values.json) {
          process.stdout.write(JSON.stringify({ path: relPath, dryRun }, null, 2) + '\n');
        } else {
          console.log(`\n  ✓ Template hook ${dryRun ? '(dry-run, non écrit)' : `créé : ${path}`}\n  Édite ce fichier pour ajouter tes policies before/after.\n`);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'plugin': {
      const sub = positionals[1] || 'list';
      try {
        if (sub === 'list') {
          pluginsListe(cwd(), { json: Boolean(values.json) });
        } else if (sub === 'info') {
          const name = positionals[2];
          if (!name) {
            console.error('\n  Usage : aiad-sdd plugin info <name>\n');
            exit(1);
          }
          pluginsInfo(cwd(), name, { json: Boolean(values.json) });
        } else if (sub === 'install') {
          const src = positionals[2];
          if (!src) {
            console.error('\n  Usage : aiad-sdd plugin install <local-path>\n  Pour npm : npm install <package> puis aiad-sdd plugin list\n');
            exit(1);
          }
          const r = pluginsInstaller(cwd(), join(cwd(), src), {
            force: Boolean(values.force),
            dryRun: Boolean(values['dry-run']),
          });
          if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
          else console.log(`\n  ✓ Plugin "${r.manifest.name}" installé ${r.dryRun ? '(dry-run) ' : ''}dans .aiad/plugins/${r.id}/\n`);
        } else if (sub === 'uninstall') {
          const id = positionals[2];
          if (!id) {
            console.error('\n  Usage : aiad-sdd plugin uninstall <id>\n');
            exit(1);
          }
          const r = pluginsDesinstaller(cwd(), id, { dryRun: Boolean(values['dry-run']) });
          if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
          else console.log(`\n  ✓ Plugin "${id}" désinstallé ${r.dryRun ? '(dry-run)' : ''}.\n`);
        } else {
          console.error('\n  Usage : aiad-sdd plugin <sub>\n  Sous-commandes : list, info <name>, install <dir>, uninstall <id>\n');
          exit(1);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'anonymize': {
      try {
        if (!values.input) {
          console.error('\n  Usage : aiad-sdd anonymize --input <path.json> [--config <path.json>] [--k 5 --quasi-ids age,cp] [--out path]\n');
          exit(1);
        }
        const records = JSON.parse(readFileSync(join(cwd(), values.input), 'utf-8'));
        if (!Array.isArray(records)) {
          console.error('\n  L\'input doit être un tableau JSON de records.\n');
          exit(1);
        }
        const config = values.config
          ? JSON.parse(readFileSync(join(cwd(), values.config), 'utf-8'))
          : {};
        if (values.k && values['quasi-ids']) {
          config.kAnonymity = {
            k: parseInt(values.k, 10),
            quasiIds: values['quasi-ids'].split(','),
          };
        }
        const { records: out, rapport } = anonymiserBatch(records, config);
        if (values.out) {
          const { writeFileSync } = await import('node:fs');
          writeFileSync(join(cwd(), values.out), JSON.stringify(out, null, 2), 'utf-8');
        }
        if (values.json) {
          process.stdout.write(JSON.stringify({ rapport, records: out }, null, 2) + '\n');
        } else {
          console.log(`\n  ✓ Anonymisation : ${rapport.total} records, ${rapport.isoles} isolés${rapport.conforme ? '' : ' ⚠ NON k-anonyme'}.`);
          if (values.out) console.log(`  Écrit dans ${values.out}.\n`);
          else console.log('  (utilise --out pour écrire le résultat)\n');
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'github-app': {
      const sub = positionals[1] || 'setup';
      try {
        if (sub === 'setup') {
          ghAppSetup({ json: Boolean(values.json) });
        } else if (sub === 'info') {
          const id = positionals[2];
          const artefacts = ghAppListerArtefacts();
          const a = id ? artefacts.find((x) => x.id === id) : null;
          if (!a) {
            if (Boolean(values.json)) {
              process.stdout.write(JSON.stringify({ id: id || null, found: false, available: artefacts.map((x) => x.id) }, null, 2) + '\n');
            } else {
              console.error(`\n  Artefact inconnu : "${id || ''}". Disponibles : ${artefacts.map((x) => x.id).join(', ')}.\n`);
              exit(1);
            }
            break;
          }
          const artefact = { id: a.id, label: a.label, source: a.source, cible: a.cible, description: a.description };
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ id: a.id, found: true, artefact }, null, 2) + '\n');
          } else {
            console.log(`\n  ${a.label} (${a.id})\n  ${a.description}\n  Source: ${a.source}\n  Cible : ${a.cible}\n`);
          }
        } else if (sub === 'install') {
          const id = positionals[2];
          if (!id) {
            console.error('\n  Usage : aiad-sdd github-app install <workflow|manifest>\n');
            exit(1);
          }
          ghAppInstaller(cwd(), id, {
            out: values.out,
            force: Boolean(values.force),
            dryRun: Boolean(values['dry-run']),
            json: Boolean(values.json),
          });
        } else {
          console.error('\n  Usage : aiad-sdd github-app <sub>\n  Sous-commandes : setup, install <workflow|manifest>\n');
          exit(1);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'ci-template': {
      try {
        const forgeId = positionals[1];
        if (!forgeId || values.list) {
          ciTemplatesListe({ json: Boolean(values.json) });
        } else if (forgeId === 'info') {
          const id = positionals[2];
          const forges = ciListerForges();
          const f = id ? forges.find((x) => x.id === id) : null;
          if (!f) {
            if (Boolean(values.json)) {
              process.stdout.write(JSON.stringify({ id: id || null, found: false, available: forges.map((x) => x.id) }, null, 2) + '\n');
            } else {
              console.error(`\n  Forge inconnue : "${id || ''}". Disponibles : ${forges.map((x) => x.id).join(', ')}.\n`);
              exit(1);
            }
            break;
          }
          const forge = { id: f.id, label: f.label, source: f.source, cible: f.cible, description: f.description };
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ id: f.id, found: true, forge }, null, 2) + '\n');
          } else {
            console.log(`\n  ${f.label} (${f.id})\n  ${f.description}\n  Source: ${f.source}\n  Cible:  ${f.cible}\n`);
          }
        } else {
          ciInstaller(cwd(), forgeId, {
            out: values.out,
            force: Boolean(values.force),
            dryRun: Boolean(values['dry-run']),
            json: Boolean(values.json),
          });
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'bitbucket': {
      const sub = positionals[1];
      try {
        if (sub === 'pr') {
          const r = await bitbucketReviewPr(cwd(), {
            prId: values.id || values.mr,
            branch: values.branch || 'main',
            token: values.token,
            workspace: values.org,
            project: values.project,
            repo: values.repo,
            dryRun: Boolean(values['dry-run']),
          });
          if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
          else if (r.dryRun) console.log('\n  (dry-run) — corps du commentaire PR :\n\n' + r.body + '\n');
          else console.log(`\n  ✓ Commentaire posté sur PR #${values.id || values.mr}.\n`);
        } else if (sub === 'issue') {
          if (!values.intent) {
            console.error('\n  Usage : aiad-sdd bitbucket issue --intent <INT-NNN>\n');
            exit(1);
          }
          const payload = bitbucketIntentVersIssue(cwd(), values.intent);
          if (values['dry-run']) {
            if (values.json) {
              process.stdout.write(JSON.stringify({ dryRun: true, payload }, null, 2) + '\n');
            } else {
              console.log('\n  (dry-run) — payload Issue Bitbucket :\n\n' + JSON.stringify(payload, null, 2) + '\n');
            }
          } else {
            const config = bitbucketConfig({
              workspace: values.org,
              repo: values.repo,
              token: values.token,
            });
            const r = await bitbucketCreerIssue(config, payload);
            if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
            else console.log(`\n  ✓ Issue #${r.id} créée : ${r.links?.html?.href || ''}\n`);
          }
        } else {
          console.error('\n  Usage : aiad-sdd bitbucket <sub>\n  Sous-commandes : pr, issue\n');
          exit(1);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'offline': {
      const sub = positionals[1] || 'status';
      try {
        if (sub === 'status') {
          offlineStatus(cwd(), { json: Boolean(values.json) });
        } else if (sub === 'log') {
          offlineLog(cwd(), { json: Boolean(values.json) });
        } else {
          console.error('\n  Usage : aiad-sdd offline <sub>\n  Sous-commandes : status, log\n');
          exit(1);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'backup': {
      try {
        const password = values.password
          || (values['key-file'] && readFileSync(values['key-file'], 'utf-8').trim())
          || process.env.AIAD_BACKUP_PASSWORD;
        if (!password) {
          console.error('\n  Mot de passe requis : --password "<pwd>" | --key-file <chemin> | env AIAD_BACKUP_PASSWORD\n');
          exit(1);
        }
        const r = backupArchive(cwd(), {
          password,
          out: values.out,
          dryRun: Boolean(values['dry-run']),
          json: Boolean(values.json),
        });
        if (!values.json) {
          console.log(`\n  ✓ Backup ${values['dry-run'] ? '(dry-run) ' : ''}créé : ${r.path}`);
          console.log(`    Fichiers : ${r.files} · Taille plaintext : ${r.plaintextSize}B · Archive : ${r.size}B\n`);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'restore': {
      try {
        const password = values.password
          || (values['key-file'] && readFileSync(values['key-file'], 'utf-8').trim())
          || process.env.AIAD_BACKUP_PASSWORD;
        if (!password) {
          console.error('\n  Mot de passe requis pour déchiffrer.\n');
          exit(1);
        }
        if (!values.archive) {
          console.error('\n  --archive <chemin> requis.\n');
          exit(1);
        }
        const r = restoreArchive(cwd(), {
          archive: values.archive,
          password,
          out: values.out,
          force: Boolean(values.force),
          dryRun: Boolean(values['dry-run']),
          json: Boolean(values.json),
        });
        if (!values.json) {
          console.log(`\n  ✓ Restauré ${r.files} fichier(s) ${values['dry-run'] ? '(dry-run) ' : ''}depuis archive du ${r.createdAt}.\n`);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'pii-scan': {
      const arg = positionals[1];
      if (values.rules) {
        const rules = PII_DETECTEURS.map((d) => ({ id: d.id, label: d.label, severity: d.severity, hasVerify: typeof d.verify === 'function' }));
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ rules, total: rules.length }, null, 2) + '\n');
        } else {
          console.log(`\n  ${rules.length} règles de détection PII :\n`);
          for (const r of rules) console.log(`    [${r.severity}] ${r.id} — ${r.label}${r.hasVerify ? ' (vérification)' : ''}`);
          console.log('');
        }
        break;
      }
      const r = piiScan(cwd(), {
        path: arg,
        staged: Boolean(values.staged) && !arg,
        json: Boolean(values.json),
      });
      if (r.findings > 0 && r.mode === 'block') exit(1);
      break;
    }

    case 'tour': {
      await guidedTour(cwd(), {
        out: values.out,
        nonInteractive: Boolean(values['non-interactive']),
        json: Boolean(values.json),
      });
      break;
    }

    case 'completion': {
      try {
        if (values.complete !== undefined) {
          completionEmettre(cwd(), { complete: values.complete });
        } else if (values.list) {
          const shells = COMPLETION_CONSTANTS.SHELLS_VALIDES;
          const install = { bash: '~/.bashrc', zsh: '~/.zshrc', fish: '~/.config/fish/completions/aiad-sdd.fish' };
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ shells, install, total: shells.length }, null, 2) + '\n');
          } else {
            console.log('\n  Shells supportés : ' + shells.join(', ') + '\n');
            for (const s of shells) console.log(`  ${s}\t→ ${install[s]}`);
            console.log('');
          }
        } else {
          const shell = positionals[1];
          completionEmettre(cwd(), { shell });
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'sla': {
      const sub = positionals[1] || 'show';
      try {
        if (sub === 'policy') {
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify(SLA_POLITIQUE, null, 2) + '\n');
          } else {
            console.log(`\n  Politique SLA par défaut AIAD :\n`);
            for (const [k, v] of Object.entries(SLA_POLITIQUE)) {
              if (typeof v === 'object') {
                console.log(`    ${k} :`);
                for (const [sk, sv] of Object.entries(v)) console.log(`      ${sk} : ${sv}`);
              } else console.log(`    ${k} : ${v}`);
            }
            console.log('');
          }
          break;
        }
        if (sub === 'show') {
          slaShow(cwd(), { json: Boolean(values.json) });
        } else if (sub === 'check') {
          const r = slaCheck(cwd(), { json: Boolean(values.json) });
          if (!r.valid) exit(1);
        } else if (sub === 'update') {
          slaUpdate(cwd(), {
            dryRun: Boolean(values['dry-run']),
            json: Boolean(values.json),
          });
        } else {
          console.error('\n  Usage : aiad-sdd sla <sub>\n  Sous-commandes : show, check, update [--dry-run]\n');
          exit(1);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'archive': {
      try {
        if (positionals[1] === 'types') {
          const types = ARCHIVE_TYPES.map((t) => ({ kind: t.kind, prefixes: t.prefixes, format: t.format }));
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ types, total: types.length }, null, 2) + '\n');
          } else {
            console.log(`\n  Types d'artefacts archivables (${types.length}) :\n`);
            for (const t of types) console.log(`    • ${t.kind} (préfixes : ${t.prefixes.join(', ')}, format : ${t.format})`);
            console.log('');
          }
          break;
        }
        if (values.delivered || (positionals[1] === 'delivered')) {
          // Cycle anti dock rot (§3.8 SPEC-B) : liste les artefacts livrés/clos.
          // Par défaut → liste seule (dry-run) ; `--apply` archive les `safe`.
          const { listerLivrables } = await import('../lib/archive.js');
          const livrables = listerLivrables(cwd());
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ total: livrables.length, delivered: livrables }, null, 2) + '\n');
          } else if (livrables.length === 0) {
            console.log('\n  ~ Aucun artefact livré et clos (status: done) à sortir du contexte chaud.\n');
          } else {
            console.log(`\n  Artefacts livrés et clos (${livrables.length}) — anti dock rot :\n`);
            for (const a of livrables) {
              const icone = a.safe ? '✓' : '⚠';
              console.log(`    ${icone} ${a.fichier} [${a.kind}] — ${a.title}`);
              if (!a.safe) console.log(`        ${a.raison}`);
            }
            if (values.apply) {
              console.log('');
              for (const a of livrables.filter((x) => x.safe)) {
                await archiver(cwd(), a.id, { raison: 'Anti dock rot — livré et clos (§3.8)', dryRun: Boolean(values['dry-run']), json: false });
              }
            } else {
              console.log('\n  Relance avec --apply pour archiver les artefacts ✓ (les ⚠ restent en place).\n');
            }
          }
        } else if (values.list || (positionals[1] === 'list')) {
          afficherArchives(cwd(), { json: Boolean(values.json) });
        } else if (values.restore) {
          await restaurer(cwd(), values.restore, {
            dryRun: Boolean(values['dry-run']),
            json: Boolean(values.json),
          });
        } else {
          const id = positionals[1];
          if (!id) {
            console.error('\n  Usage : aiad-sdd archive <ID> [--reason "..."] [--dry-run]\n         aiad-sdd archive --list\n         aiad-sdd archive --restore <ID>\n');
            exit(1);
          }
          await archiver(cwd(), id, {
            raison: values.reason,
            dryRun: Boolean(values['dry-run']),
            json: Boolean(values.json),
          });
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'memory': {
      // Memory native (§3.8) : propose des Lessons « from logs » (récurrence ≥
      // seuil sur plusieurs sources) ; la promotion exige un auteur humain.
      const {
        collecterObservations, proposerPromotions, promouvoir, cheminStore, curer,
        SEUIL_PROMOTION_DEFAUT,
      } = await import('../lib/memory.js');
      const sub = positionals[1] || 'propose';
      const seuil = Number(values.seuil) > 0 ? Number(values.seuil) : SEUIL_PROMOTION_DEFAUT;

      if (sub === 'propose' || sub === 'promote') {
        const candidats = proposerPromotions(collecterObservations(cwd()), { seuil });
        if (sub === 'propose') {
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ seuil, total: candidats.length, candidats }, null, 2) + '\n');
          } else if (candidats.length === 0) {
            console.log(`\n  ~ Aucun pattern récurrent (≥ ${seuil} sources) à promouvoir. La mémoire ne s'invente pas sur un cas isolé.\n`);
          } else {
            console.log(`\n  Candidats à la promotion en mémoire (≥ ${seuil} sources) :\n`);
            for (const c of candidats) {
              console.log(`    • ${c.exemples[0] || c.signature} — ${c.occurrences}× (${c.kinds.join('/')})`);
              console.log(`        sources : ${c.sources.slice(0, 6).join(', ')}`);
            }
            console.log(`\n  Promouvoir : aiad-sdd memory promote --auteur "Nom" [--seuil N] [--lecon "…"]\n  (Human Authorship — aucune promotion sans auteur humain.)\n`);
          }
          break;
        }
        // promote : exige un auteur, promeut le 1er candidat (ou tous si --apply).
        const auteur = values.auteur || values.author;
        if (!auteur) {
          console.error('\n  ✗ Promotion refusée : --auteur "Nom" requis (Human Authorship).\n  Verdict : JNSP\n');
          exit(2);
        }
        if (candidats.length === 0) {
          console.error(`\n  ~ Aucun candidat (≥ ${seuil} sources) à promouvoir.\n`);
          exit(1);
        }
        const { existsSync: existe, readFileSync: lire, writeFileSync: ecrire, mkdirSync: mkd } = await import('node:fs');
        const { dirname: dn } = await import('node:path');
        const store = cheminStore(cwd());
        let contenu = existe(store) ? lire(store, 'utf-8') : '';
        const aPromouvoir = values.apply ? candidats : [candidats[0]];
        for (const c of aPromouvoir) {
          const r = promouvoir(contenu, c, { auteur, lecon: values.lecon });
          contenu = r.contenu;
        }
        if (!Boolean(values['dry-run'])) {
          mkd(dn(store), { recursive: true });
          ecrire(store, contenu, 'utf-8');
        }
        console.log(`\n  ✓ ${aPromouvoir.length} entrée(s) promue(s) par ${auteur} → ${store}${values['dry-run'] ? ' (dry-run)' : ''}\n`);
        break;
      }

      if (sub === 'curate') {
        const { existsSync: existe, readFileSync: lire } = await import('node:fs');
        const store = cheminStore(cwd());
        if (!existe(store)) {
          console.log('\n  ~ Aucun store mémoire (.aiad/memory/MEMORY.md) à curer.\n');
          break;
        }
        const r = curer(lire(store, 'utf-8'));
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ besoinSplit: r.besoinSplit, lignes: r.lignes, themes: r.themes.map((t) => t.slug) }, null, 2) + '\n');
        } else if (!r.besoinSplit) {
          console.log(`\n  ✓ Store sous le plafond (${r.lignes} lignes) — aucun éclatement nécessaire.\n`);
        } else {
          console.log(`\n  ⚠ Store à ${r.lignes} lignes → éclatement proposé en ${r.themes.length} thème(s) : ${r.themes.map((t) => t.slug).join(', ')}\n`);
        }
        break;
      }

      console.error('\n  Usage : aiad-sdd memory <propose|promote|curate> [--auteur "Nom"] [--seuil N] [--apply]\n');
      exit(1);
      break;
    }

    case 'spec-version': {
      const sub = positionals[1];
      try {
        if (sub === 'check') {
          const id = positionals[2];
          if (!id) {
            console.error('\n  Usage : aiad-sdd spec-version check <SPEC-ID> [--ref HEAD]\n');
            exit(1);
          }
          const r = verifierVersion(cwd(), id, {
            ref: values.from || 'HEAD',
            json: Boolean(values.json),
          });
          if (r && r.validation && !r.validation.valid) exit(1);
        } else if (sub === 'bump') {
          const id = positionals[2];
          const kind = positionals[3] || 'patch';
          if (!id) {
            console.error('\n  Usage : aiad-sdd spec-version bump <SPEC-ID> <major|minor|patch>\n');
            exit(1);
          }
          bumpSpec(cwd(), id, kind, {
            dryRun: Boolean(values['dry-run']),
            json: Boolean(values.json),
          });
        } else {
          console.error('\n  Usage : aiad-sdd spec-version <sub>\n  Sous-commandes : check <id>, bump <id> <major|minor|patch>\n');
          exit(1);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'refactor-spec': {
      try {
        if (values.all) {
          await refactorAll(cwd(), { json: Boolean(values.json) });
        } else {
          const id = positionals[1];
          if (!id) {
            console.error('\n  Usage : aiad-sdd refactor-spec <SPEC-ID> [--ai] [--json]\n         aiad-sdd refactor-spec --all  (audit toutes les SPECs)\n');
            exit(1);
          }
          await refactorSpec(cwd(), id, {
            ai: Boolean(values.ai),
            json: Boolean(values.json),
          });
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'negotiate': {
      const a = positionals[1];
      const b = positionals[2];
      try {
        await negotiate(cwd(), a, b, {
          out: values.out,
          json: Boolean(values.json),
        });
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'reflect': {
      try {
        await reflect(cwd(), {
          since: values.since,
          jours: values.jours ? parseInt(values.jours, 10) : undefined,
          json: Boolean(values.json),
        });
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'webhooks': {
      const sub = positionals[1] || 'list';
      try {
        if (sub === 'list') {
          listerSouscriptions(cwd(), { json: Boolean(values.json) });
        } else if (sub === 'types') {
          const events = WEBHOOKS_CONSTANTS.EVENTS_VALIDES;
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ events, total: events.length }, null, 2) + '\n');
          } else {
            console.log(`\n  Types d'événements webhooks supportés (${events.length}) :\n`);
            for (const e of events) console.log(`    • ${e}`);
            console.log('');
          }
        } else if (sub === 'test') {
          const r = await webhookTest(cwd(), { type: values.type, dryRun: Boolean(values['dry-run']) });
          if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
          else {
            console.log(`\n  Événement émis : ${r.event.type} (id=${r.event.id})`);
            console.log(`  ${r.deliveries.length} livraison(s) :`);
            for (const d of r.deliveries) {
              console.log(`    ${d.ok ? '✓' : '✗'} ${d.url}${d.status ? ` [${d.status}]` : ''}${d.raison ? ' — ' + d.raison : ''}${d.dryRun ? ' (dry-run)' : ''}`);
            }
            console.log('');
          }
        } else if (sub === 'emit') {
          if (!values.type) {
            console.error('\n  Usage : aiad-sdd webhooks emit --type <event>\n');
            exit(1);
          }
          const r = await webhookEmettre(cwd(), { type: values.type, source: 'aiad-sdd webhooks emit' }, {
            dryRun: Boolean(values['dry-run']),
          });
          if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
          else console.log(`\n  ✓ ${r.deliveries.length} livraison(s) ${values['dry-run'] ? '(dry-run)' : 'émises'} pour ${r.event.type}.\n`);
        } else {
          console.error('\n  Usage : aiad-sdd webhooks <sub>\n  Sous-commandes : list, test [--type <event>], emit --type <event> [--dry-run]\n');
          exit(1);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'azure': {
      const sub = positionals[1];
      const config = azureConfig({
        org: values.org, project: values.project,
        repo: values.repo, wiki: values.wiki, token: values.token,
      });
      try {
        if (sub === 'pr') {
          const r = await azureReviewPr(cwd(), {
            prId: values.id || values.mr,
            branch: values.branch || 'main',
            org: values.org, project: values.project, repo: values.repo,
            token: values.token,
            dryRun: Boolean(values['dry-run']),
          });
          if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
          else if (r.dryRun) console.log('\n  (dry-run) — corps du thread PR :\n\n' + r.body + '\n');
          else console.log(`\n  ✓ Thread posté sur PR #${values.id || values.mr}.\n`);
        } else if (sub === 'work-item') {
          if (!values.intent) {
            console.error('\n  Usage : aiad-sdd azure work-item --intent <INT-NNN>\n');
            exit(1);
          }
          const payload = intentVersWorkItem(cwd(), values.intent);
          if (values['dry-run']) {
            if (values.json) {
              process.stdout.write(JSON.stringify({ dryRun: true, payload }, null, 2) + '\n');
            } else {
              console.log('\n  (dry-run) — Work Item à créer :\n\n' + JSON.stringify(payload, null, 2) + '\n');
            }
          } else {
            const r = await creerWorkItem(config, payload);
            if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
            else console.log(`\n  ✓ Work Item ${r.id} créé : ${r._links?.html?.href || ''}\n`);
          }
        } else if (sub === 'wiki') {
          const kind = values.intent ? 'intent' : (values.spec ? 'spec' : null);
          const id = values.intent || values.spec;
          if (!kind || !id) {
            console.error('\n  Usage : aiad-sdd azure wiki --intent <INT-NNN> | --spec <SPEC-NNN-N-slug>\n');
            exit(1);
          }
          const payload = azureArtefactVersWiki(cwd(), { kind, id });
          if (values['dry-run']) {
            if (values.json) {
              process.stdout.write(JSON.stringify({ dryRun: true, kind, payload }, null, 2) + '\n');
            } else {
              console.log('\n  (dry-run) — page wiki Azure :\n\n' + JSON.stringify(payload, null, 2) + '\n');
            }
          } else {
            const r = await azurePublierWiki(config, payload);
            if (values.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
            else console.log(`\n  ✓ Page wiki ${r.action} : ${payload.path}\n`);
          }
        } else {
          console.error('\n  Usage : aiad-sdd azure <sub>\n  Sous-commandes : pr, work-item, wiki\n');
          exit(1);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'sovereignty': {
      if (positionals[1] === 'dimensions') {
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ dimensions: SOVEREIGNTY_DIMENSIONS, total: SOVEREIGNTY_DIMENSIONS.length, scoreMax: SOVEREIGNTY_DIMENSIONS.reduce((s, d) => s + d.max, 0) }, null, 2) + '\n');
        } else {
          console.log(`\n  Dimensions Sovereignty Score AIAD (${SOVEREIGNTY_DIMENSIONS.length}) :\n`);
          for (const d of SOVEREIGNTY_DIMENSIONS) console.log(`    • ${d.id} (${d.max} pts) — ${d.label}\n      ${d.desc}`);
          console.log('');
        }
        break;
      }
      if (positionals[1] === 'niveaux') {
        const niveaux = SOVEREIGNTY_NIVEAUX.map((n) => ({ label: n.label, min: n.min }));
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ niveaux, total: niveaux.length }, null, 2) + '\n');
        } else {
          console.log(`\n  Niveaux Sovereignty Score AIAD (${niveaux.length}) :\n`);
          for (const n of niveaux) console.log(`    • ${n.label} — score ≥ ${n.min}`);
          console.log('');
        }
        break;
      }
      const r = sovereigntyScore(cwd(), { json: Boolean(values.json) });
      if (values.check && r.score < 60) exit(1);
      break;
    }

    case 'adrs': {
      const r = extraireAdrs(cwd());
      if (values.json) {
        // (#298) _meta cohérent. 12ᵉ schéma de l'écosystème.
        const withMeta = { _meta: buildMeta({ schema: 'aiad-sdd-adrs' }), ...r };
        process.stdout.write(JSON.stringify(withMeta, null, 2) + '\n');
      } else {
        console.log(`\n  AIAD SDD — Architecture Decision Records`);
        console.log(`  Source : ${r.fichier || '.aiad/ARCHITECTURE.md (absent)'}\n`);
        if (r.total === 0) {
          console.log(`  Aucun ADR détecté.`);
          console.log(`  Convention : ajouter des lignes \`- **ADR-NNN** : décision\` dans ARCHITECTURE.md.\n`);
        } else {
          console.log(`  ${r.total} ADR(s) détecté(s)\n`);
          for (const a of r.entrees) {
            const section = a.section ? ` · ${a.section}` : '';
            console.log(`  ${a.id}  ${a.titre}${section}  (L${a.ligne})`);
          }
          console.log();
        }
      }
      break;
    }

    case 'self-update': {
      // (#128) Le user a tapé `aiad-sdd self-update` → c'est déjà
      // l'opt-in explicite. Aucun appel réseau silencieux : la commande
      // n'est pas appelée automatiquement. L'env AIAD_UPDATE_CHECK est
      // réservé à un futur hook passif (lazy au lancement d'autres commandes).
      void updateAutorise; // (réservé pour usage futur)
      const r = await checkUpdate();
      if (values.json) {
        process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      } else {
        if (r.status === 'unknown') {
          console.log(`  ! Registry inaccessible (${r.error || 'inconnue'}) — version locale ${r.locale || '?'}`);
          exit(1);
        }
        if (r.status === 'up-to-date') {
          console.log(`  ✓ aiad-sdd v${r.locale} est à jour (dernière sur npm : v${r.distante}).`);
        } else if (r.status === 'update-available') {
          console.log(`  ↑ Mise à jour disponible : v${r.locale} → v${r.distante}`);
          console.log(`    ${r.action}`);
          console.log(`    Changelog : https://github.com/aiad-fr/aiad-sdd/blob/main/CHANGELOG.md`);
        } else if (r.status === 'ahead') {
          console.log(`  i Version locale v${r.locale} en avance sur npm (v${r.distante}). Tu développes sans doute en local.`);
        }
      }
      break;
    }

    case 'brief': {
      // (#228) Résumé one-pager du projet : maturité + santé + focus + rituels.
      // (#229) --strict=N : exit 1 si santé < N (CI/CD guardrail).
      // (#269) --markdown : sortie Markdown pasteable Slack/Teams/Notion/PR.
      const seuilStrict = values.strict != null ? Number(values.strict) : null;
      const seuilTests = values['strict-tests'] != null ? Number(values['strict-tests']) : null;
      const briefPublicUrl = values['public-url'] || process.env.AIAD_PUBLIC_URL || null;
      const r = brief(cwd(), {
        json: Boolean(values.json),
        markdown: Boolean(values.markdown),
        quiet: Boolean(values.quiet),
        out: values.out,
        strict: Number.isFinite(seuilStrict) ? seuilStrict : null,
        strictTests: Number.isFinite(seuilTests) ? seuilTests : null,
        diff: values.diff,
        publicUrl: briefPublicUrl,
      });
      if (r?.strictFail || r?.strictTestsFail) exit(1);
      break;
    }

    case 'badge': {
      // (#230) Génère SVG badge santé projet pour README.md
      // (#231) --type=sante|maturite|violations ; --all génère les 3
      // (#284) --shields-endpoint → JSON shields.io endpoint format
      const baseOpts = {
        out: values.out,
        dataDir: values['data-dir'],
        label: values.label,
        dryRun: Boolean(values['dry-run']),
      };
      // (#284) Court-circuit shields-endpoint : génère JSON conforme spec
      // (#285) Avec --all : tableau de 3 endpoints (sante+maturite+violations)
      if (values['shields-endpoint']) {
        if (values.all) {
          const allJson = BADGE_TYPES.map((t) => ({
            type: t,
            ...genererShieldsEndpoint(cwd(), { ...baseOpts, type: t }),
          }));
          if (values.out) {
            const cheminOut = values.out.startsWith('/') ? values.out : join(cwd(), values.out);
            const { writeFileSync, mkdirSync } = await import('node:fs');
            const { dirname } = await import('node:path');
            mkdirSync(dirname(cheminOut), { recursive: true });
            writeFileSync(cheminOut, JSON.stringify(allJson, null, 2), 'utf-8');
            console.log(`  Shields endpoints (×3) écrits : ${cheminOut}`);
          } else {
            process.stdout.write(JSON.stringify(allJson, null, 2) + '\n');
          }
          break;
        }
        const type = values.type || 'sante';
        if (!BADGE_TYPES.includes(type)) {
          console.error(`\n  Type "${type}" inconnu. Valides : ${BADGE_TYPES.join(', ')}\n`);
          exit(1);
        }
        const json = genererShieldsEndpoint(cwd(), { ...baseOpts, type });
        if (values.out) {
          // Écriture fichier (utile pour CI qui commit le JSON dans le repo)
          const cheminOut = values.out.startsWith('/') ? values.out : join(cwd(), values.out);
          const { writeFileSync, mkdirSync } = await import('node:fs');
          const { dirname } = await import('node:path');
          mkdirSync(dirname(cheminOut), { recursive: true });
          writeFileSync(cheminOut, JSON.stringify(json, null, 2), 'utf-8');
          console.log(`  Shields endpoint écrit : ${cheminOut}`);
        } else {
          process.stdout.write(JSON.stringify(json, null, 2) + '\n');
        }
        break;
      }
      if (values.all) {
        if (values.out) {
          console.error(`\n  --all incompatible avec --out (3 fichiers générés). Omettez --out.\n`);
          exit(1);
        }
        const results = genererTousLesBadges(cwd(), baseOpts);
        if (values.json) {
          process.stdout.write(JSON.stringify(results.map((r) => ({
            type: r.type, path: r.path || null,
            message: r.donnees?.message ?? null, bytes: r.svg.length,
          })), null, 2) + '\n');
        } else if (values['dry-run']) {
          for (const r of results) process.stdout.write(`<!-- ${r.type} -->\n${r.svg}\n`);
        } else {
          for (const r of results) console.log(`  ${r.type.padEnd(10)} → ${r.path}  ${r.donnees?.message || '(non calculé)'}`);
        }
        break;
      }
      const type = values.type || 'sante';
      if (!BADGE_TYPES.includes(type)) {
        console.error(`\n  Type "${type}" inconnu. Valides : ${BADGE_TYPES.join(', ')}\n`);
        exit(1);
      }
      const r = genererBadge(cwd(), { ...baseOpts, type });
      if (values.json) {
        process.stdout.write(JSON.stringify({
          type: r.type, path: r.path || null,
          message: r.donnees?.message ?? null,
          score: r.donnees?.score ?? null,
          niveau: r.donnees?.niveau ?? null,
          bytes: r.svg.length,
        }, null, 2) + '\n');
      } else if (values['dry-run']) {
        process.stdout.write(r.svg);
      } else {
        console.log(`  Badge écrit : ${r.path}`);
        if (r.donnees) console.log(`  ${r.donnees.message}`);
        else console.log(`  ${type} non calculé — lance \`aiad-sdd dashboard\` d'abord.`);
      }
      break;
    }

    case 'standup': {
      // (#191) Raccourci CLI : produit l'URL `dashboard/kanban.html?lens=<role>&focus=today`
      // pour le rituel standup. Aucun appel réseau, aucun fichier écrit.
      // --lens=<role>   : pm|pe|ae|qa|tl|all  (défaut all)
      // --all           : imprime les 5 URLs (PM/PE/AE/QA/TL) — utile pour async
      // --out=<dir>     : chemin du dashboard (défaut "dashboard")
      // --open          : ouvre l'URL absolue via `open`/`xdg-open`/`start`
      // --json          : sortie machine-lisible
      // (#193) Auto-detect dashboard stale (mtime .aiad/ > mtime kanban.html)
      // --regen         : régénère le dashboard avant d'imprimer l'URL si stale
      // (#256) --public-url=https://… (ou env AIAD_PUBLIC_URL) → produit
      //                    un champ `publicUrl` shareable dans Slack/Teams.
      try {
        const outDir = values.out || 'dashboard';
        const publicUrl = values['public-url'] || process.env.AIAD_PUBLIC_URL || null;
        const staleInfo = dashboardEstStale({ cwd: cwd(), outDir });
        let regenResult = null;
        if (staleInfo.stale && values.regen) {
          // Régénère le dashboard inline avant de produire l'URL.
          const mod = await import('../lib/dashboard.js');
          const t0 = Date.now();
          const r = await mod.dashboard(cwd(), { out: outDir, quiet: true });
          regenResult = { pages: r.pages.length, dureeMs: Date.now() - t0 };
          // Note : après regen, kanban.html a un mtime plus récent → stale=false.
          staleInfo.stale = false;
          staleInfo.raison = 'regen-effectue';
        }
        if (values.all) {
          const liens = tousLesLiens({ cwd: cwd(), outDir, publicUrl });
          if (values.json) {
            // (#297) _meta cohérent avec écosystème (11ᵉ schéma).
            const payload = { _meta: buildMeta({ schema: 'aiad-sdd-standup', action: 'all' }), liens, stale: staleInfo };
            if (regenResult) payload.regen = regenResult;
            process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
          } else if (values.markdown) {
            // (#270) Bloc Markdown pasteable Slack/Teams en async standup.
            // Préfère publicUrl si défini, sinon relative.
            const dateFr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            process.stdout.write(`## 🎯 Standup focus du jour — ${dateFr}\n\n`);
            process.stdout.write('| Rôle | Kanban focus |\n');
            process.stdout.write('|---|---|\n');
            const noms = { pm: 'PM (Product Manager)', pe: 'PE (Product Engineer)', ae: 'AE (Agents Engineer)', qa: 'QA', tl: 'TL (Tech Lead)' };
            for (const l of liens) {
              const url = l.publicUrl || l.relative;
              process.stdout.write(`| **${noms[l.lens] || l.lens.toUpperCase()}** | ${url} |\n`);
            }
            if (staleInfo.stale) {
              process.stdout.write(`\n> ⚠️ Dashboard périmé (régénère avec \`aiad-sdd standup --regen --all --markdown\`).\n`);
            }
            process.stdout.write('\n');
          } else {
            if (regenResult) {
              console.log(`\n  ✓ Dashboard régénéré (${regenResult.pages} pages, ${regenResult.dureeMs}ms)`);
            }
            console.log('\n  Standup — URLs Kanban focus-mode par rôle :\n');
            for (const l of liens) {
              const url = l.publicUrl || l.relative;
              console.log(`    ${l.lens.toUpperCase().padEnd(3)} → ${url}`);
            }
            if (!liens[0].exists) {
              console.log('\n  ! kanban.html introuvable — lance `aiad-sdd dashboard` d\'abord.');
            } else if (staleInfo.stale) {
              console.log(`\n  ⚠ Dashboard périmé (.aiad/ modifié il y a ${staleInfo.ecartSecondes}s après la dernière génération). Relance avec --regen.`);
            }
            console.log('');
          }
          break;
        }
        const r = buildStandupUrl({ lens: values.lens, cwd: cwd(), outDir, publicUrl });
        if (values.json) {
          // (#297) _meta cohérent. action: 'single' distingue du mode --all.
          const payload = { _meta: buildMeta({ schema: 'aiad-sdd-standup', action: 'single' }), ...r, stale: staleInfo };
          if (regenResult) payload.regen = regenResult;
          process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
        } else {
          if (regenResult) {
            console.log(`\n  ✓ Dashboard régénéré (${regenResult.pages} pages, ${regenResult.dureeMs}ms)`);
          }
          console.log(`\n  Standup — lens ${r.lens.toUpperCase()}, focus du jour :\n`);
          console.log(`    Relatif : ${r.relative}`);
          console.log(`    Absolu  : ${r.absolute}`);
          if (r.publicUrl) console.log(`    Public  : ${r.publicUrl}`);
          if (!r.exists) {
            console.log('\n  ! kanban.html introuvable — lance `aiad-sdd dashboard` d\'abord.');
          } else if (staleInfo.stale) {
            console.log(`\n  ⚠ Dashboard périmé (.aiad/ modifié il y a ${staleInfo.ecartSecondes}s après la dernière génération). Relance avec --regen.`);
          }
          console.log('');
        }
        // (#192) --serve : démarre un serveur HTTP statique local sur
        // dashboard/, produit l'URL http://… et garde le process vivant
        // jusqu'à Ctrl+C. Évite le piège file:// bloqué par certains
        // navigateurs strict-mode.
        if (values.serve) {
          if (!r.exists) {
            console.error('  ! Refus de servir : kanban.html introuvable. Lance `aiad-sdd dashboard` d\'abord.');
            exit(1);
          }
          const { join: joinPath2, resolve: resolvePath2 } = await import('node:path');
          const racineDash = resolvePath2(cwd(), outDir);
          // (#310) Propage --quiet à serveDashboard pour silencer le banner.
          const { server, url: serverBase } = await serveDashboard(racineDash, { port: values.port, quiet: Boolean(values.quiet) });
          const httpUrl = buildStandupUrl({ lens: values.lens, cwd: cwd(), outDir, serverUrl: serverBase.replace(/\/$/, '') }).serverUrl;
          console.log(`  Lien standup : ${httpUrl}\n`);
          if (values.open) {
            const { spawn } = await import('node:child_process');
            const cmd = process.platform === 'darwin' ? 'open'
              : process.platform === 'win32' ? 'start'
              : 'xdg-open';
            const args = process.platform === 'win32' ? ['', httpUrl] : [httpUrl];
            spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
          }
          const arret = () => {
            console.log('\n  Arrêt du serveur…');
            server.close(() => process.exit(0));
          };
          process.on('SIGINT', arret);
          process.on('SIGTERM', arret);
          void joinPath2;
          await new Promise(() => {});
        } else if (values.open) {
          if (!r.exists) {
            console.error('  ! Refus d\'ouvrir : kanban.html introuvable.');
            exit(1);
          }
          const { spawn } = await import('node:child_process');
          const cmd = process.platform === 'darwin' ? 'open'
            : process.platform === 'win32' ? 'start'
            : 'xdg-open';
          const args = process.platform === 'win32' ? ['', r.absolute] : [r.absolute];
          spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
        }
      } catch (e) {
        if (e.code === 'INVALID_LENS') {
          console.error(`\n  ${e.message}\n`);
          exit(1);
        }
        throw e;
      }
      break;
    }

    case 'dora': {
      // Sous-commandes : `dora --record` (manuel) ou `dora --import-git`.
      // NB : `--release` plutôt que `--version` car ce dernier est réservé
      // au flag global qui affiche la version d'aiad-sdd.
      try {
        if (positionals[1] === 'types') {
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ statuses: DORA_STATUS, total: DORA_STATUS.length }, null, 2) + '\n');
          } else {
            console.log(`\n  Statuts de déploiement DORA (${DORA_STATUS.length}) :\n`);
            for (const s of DORA_STATUS) console.log(`    • ${s}`);
            console.log('');
          }
          break;
        }
        if (positionals[1] === 'metrics') {
          const metrics = [
            { id: 'deployment-frequency', label: 'Deployment Frequency', desc: 'Fréquence de déploiements production (par jour/semaine/mois)' },
            { id: 'lead-time-changes', label: 'Lead Time for Changes', desc: 'Délai entre commit et mise en production' },
            { id: 'change-failure-rate', label: 'Change Failure Rate', desc: 'Pourcentage de déploiements provoquant un incident' },
            { id: 'mttr', label: 'Mean Time to Recovery', desc: 'Temps moyen de remise en service après incident' },
          ];
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ metrics, total: metrics.length }, null, 2) + '\n');
          } else {
            console.log(`\n  Métriques DORA standard (${metrics.length}) :\n`);
            for (const m of metrics) console.log(`    • ${m.id} — ${m.label}\n      ${m.desc}`);
            console.log('');
          }
          break;
        }
        if (values.list) {
          // (#447) Liste les déploiements existants depuis .aiad/metrics/deployments/
          const deployments = listerDeploys(cwd());
          if (values.json) {
            process.stdout.write(JSON.stringify({
              _meta: buildMeta({ schema: 'aiad-sdd-dora', action: 'list' }),
              deployments, total: deployments.length,
            }, null, 2) + '\n');
          } else if (deployments.length === 0) {
            console.log('Aucun déploiement enregistré dans .aiad/metrics/deployments/.');
          } else {
            console.log(`${deployments.length} déploiement(s) :`);
            for (const d of deployments) console.log(`  - ${d.nom} (${d.status}${d.version ? ', ' + d.version : ''})`);
          }
        } else if (values['import-git']) {
          // (#185) Génère un fichier deploy par tag Git
          const imported = importDeploysFromGit(cwd(), { since: values.since });
          if (values.json) {
            // (#263) _meta cohérent. `action: 'import-git'` discrimine du record.
            process.stdout.write(JSON.stringify({
              _meta: buildMeta({ schema: 'aiad-sdd-dora', action: 'import-git' }),
              imported,
            }, null, 2) + '\n');
          } else if (imported.length === 0) {
            console.log('Aucun tag Git trouvé (vérifie que tu es dans un repo Git avec des tags' + (values.since ? ` créés depuis ${values.since}` : '') + ').');
          } else {
            console.log(`✓ ${imported.length} déploiement(s) importé(s) depuis les tags Git :`);
            for (const r of imported) console.log(`  - ${r.nom} (${r.status}, tag ${r.tag})`);
          }
        } else if (values.record) {
          const r = recordDeployment(cwd(), {
            status: values.status,
            cycleTimeDays: values.cycle !== undefined ? Number(values.cycle) : undefined,
            leadTimeDays: values.lead !== undefined ? Number(values.lead) : undefined,
            version: values.release,
            commit: values.commit,
            date: values.date,
          });
          if (values.json) {
            process.stdout.write(JSON.stringify({
              _meta: buildMeta({ schema: 'aiad-sdd-dora', action: 'record' }),
              ...r,
            }, null, 2) + '\n');
          } else {
            console.log(`✓ Déploiement enregistré : ${r.nom} (${r.status})`);
          }
        } else {
          console.error('Usage :');
          console.error('  aiad-sdd dora --record --status=success|hotfix|failed [--cycle=N] [--lead=N] [--release=X] [--commit=SHA] [--date=YYYY-MM-DD]');
          console.error('  aiad-sdd dora --import-git [--since=YYYY-MM-DD] [--json]');
          exit(1);
        }
      } catch (err) {
        console.error('✗ ' + err.message);
        exit(1);
      }
      break;
    }

    case 'dinum': {
      const sub = positionals[1] || 'check';
      try {
        if (sub === 'criteria') {
          const criteria = DINUM_CRITERES.map((c) => ({ id: c.id, label: c.label }));
          if (Boolean(values.json)) {
            process.stdout.write(JSON.stringify({ criteria, total: criteria.length }, null, 2) + '\n');
          } else {
            console.log(`\n  Critères Commun Numérique de l'État FR (${criteria.length}) :\n`);
            for (const c of criteria) console.log(`    • ${c.id} — ${c.label}`);
            console.log('');
          }
          break;
        }
        if (sub === 'publiccode') {
          genererPublicCode(cwd(), {
            out: values.out,
            agency: values.from,
            lang: values.lang,
            dryRun: Boolean(values['dry-run']),
            json: Boolean(values.json),
          });
        } else if (sub === 'franceconnect') {
          genererFranceConnect(cwd(), {
            out: values.out,
            niveau: values.niveau,
            dryRun: Boolean(values['dry-run']),
            json: Boolean(values.json),
          });
        } else if (sub === 'check') {
          const r = checkCommunNumerique(cwd(), { json: Boolean(values.json) });
          if (r.score < 60) exit(1);
        } else {
          console.error(`\n  Usage : aiad-sdd dinum <sub>\n  Sous-commandes : publiccode, franceconnect, check\n`);
          exit(1);
        }
      } catch (err) {
        console.error(`\n  ${err.message}\n`);
        exit(1);
      }
      break;
    }

    case 'provenance': {
      const sub = positionals[1] || 'generate';
      if (sub === 'generate') {
        try {
          genererAttestation(cwd(), {
            dryRun: Boolean(values['dry-run']),
            json: Boolean(values.json),
            out: values.out,
          });
        } catch (err) {
          console.error(`\n  ${err.message}\n`);
          exit(1);
        }
      } else if (sub === 'verify') {
        const r = verifierProvenance(cwd(), { json: Boolean(values.json) });
        if (!r.valid) exit(1);
      } else if (sub === 'sigstore') {
        if (Boolean(values.json)) {
          const predicate = '.aiad/provenance/attestation.json';
          const bundle = predicate + '.sigstore-bundle';
          process.stdout.write(JSON.stringify({
            predicate, bundle, predicateType: 'slsaprovenance1',
            docsUrl: 'https://docs.sigstore.dev/cosign/signing/signing_with_blobs/',
            commands: {
              sign: `cosign attest-blob --predicate ${predicate} --type slsaprovenance1 --bundle ${bundle} <tarball.tgz>`,
              verify: `cosign verify-blob-attestation --bundle ${bundle} --type slsaprovenance1 --certificate-identity-regexp '.*' --certificate-oidc-issuer-regexp '.*' <tarball.tgz>`,
            },
          }, null, 2) + '\n');
        } else {
          console.log(bundleSigstoreCommande(cwd()));
        }
      } else {
        console.error(`\n  Usage : aiad-sdd provenance <sub>\n  Sous-commandes : generate, verify, sigstore (commande cosign à coller en CI)\n`);
        exit(1);
      }
      break;
    }

    case 'audit': {
      const sub = positionals[1] || 'log';
      if (sub === 'log') {
        auditLog(cwd(), { json: Boolean(values.json) });
      } else if (sub === 'types') {
        if (Boolean(values.json)) {
          process.stdout.write(JSON.stringify({ actions: AUDIT_ACTIONS, total: AUDIT_ACTIONS.length }, null, 2) + '\n');
        } else {
          console.log(`\n  Actions audit log AIAD (${AUDIT_ACTIONS.length}) :\n`);
          for (const a of AUDIT_ACTIONS) console.log(`    • ${a}`);
          console.log('');
        }
      } else if (sub === 'verify') {
        const r = auditVerifier(cwd(), { json: Boolean(values.json) });
        if (!r.valid) exit(1);
      } else if (sub === 'append') {
        const action = positionals[2];
        const artifact = positionals[3];
        if (!action || !artifact) {
          console.error(`\n  Usage : aiad-sdd audit append <action> <artifact>\n  Actions : created, modified, deleted, imported, archived\n  Exemple : aiad-sdd audit append modified .aiad/specs/SPEC-001-1-x.md\n`);
          exit(1);
        }
        try {
          const hashApres = action === 'deleted' ? null : hashFichier(cwd(), artifact);
          const event = appendEvenement(cwd(), { action, artifact, hashApres });
          if (values.json) {
            process.stdout.write(JSON.stringify(event, null, 2) + '\n');
          } else {
            console.log(`\n  ✓ Événement ${action} enregistré pour ${artifact}.\n  hashChain : ${event.hashChain.slice(0, 32)}...\n  ${event.sig === null ? '⚠ non signé (AIAD_AUDIT_SECRET absent)' : 'signature : ' + event.sig.slice(0, 32) + '...'}\n`);
          }
        } catch (err) {
          console.error(`\n  ${err.message}\n`);
          exit(1);
        }
      } else {
        console.error(`\n  Usage : aiad-sdd audit <sub>\n  Sous-commandes : log, verify, append <action> <artifact>\n`);
        exit(1);
      }
      break;
    }

    default: {
      const COMMANDES_VALIDES = [
        'init', 'update', 'gouvernance', 'hooks', 'status', 'doctor', 'repl',
        'migrate', 'migrate-v2', 'obsidian', 'workspace', 'ai-act', 'sbom', 'verify-reproducibility',
        'dpia', 'docs', 'telemetry', 'feedback', 'skills', 'uninstall', 'bench', 'trace',
        'dashboard', 'emit-rules', 'new', 'import', 'score', 'template',
        'review', 'suggest-annotations', 'export', 'storybook', 'cert',
        'marketplace', 'audit', 'provenance', 'hook-stats', 'dinum', 'sovereignty', 'adrs', 'dora', 'self-update', 'standup', 'brief', 'badge', 'gitlab', 'azure', 'webhooks', 'reflect', 'negotiate', 'refactor-spec', 'spec-version', 'archive', 'sla', 'completion', 'tour', 'pii-scan', 'backup', 'restore', 'offline', 'bitbucket', 'ci-template', 'github-app', 'anonymize', 'plugin', 'hooks-init', 'schema', 'org', 'rbac', 'tutorial', 'help', 'version',
      ];
      const indice = indiceVoulaisTuDire(command, COMMANDES_VALIDES, { max: 2 });
      const ligneIndice = indice ? `  ${indice}\n\n` : '';
      console.error(`\n  Commande inconnue : "${command}"\n${ligneIndice}  Lance \`aiad-sdd help\` pour la liste complète.\n`);
      exit(1);
    }
  }
}

const _aiadStart = Date.now();
main()
  .then(async () => {
    // Hook utilisateur afterCommand — best-effort
    if (commandHooksDisponibles(cwd())) {
      await commandHookAfter(cwd(), {
        command, args: values, exitCode: 0, durationMs: Date.now() - _aiadStart,
      });
    }
    // Invitation feedback périodique (toutes les 15 sessions, TTY uniquement, fail-safe)
    if (command !== 'feedback') {
      await feedbackTryInvite(VERSION);
    }
  })
  .catch(async (err) => {
    console.error('\n  Erreur :', err.message);
    if (commandHooksDisponibles(cwd())) {
      await commandHookAfter(cwd(), {
        command, args: values, exitCode: 1, durationMs: Date.now() - _aiadStart,
      });
    }
    exit(1);
  });
