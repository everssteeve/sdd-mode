// AIAD SDD Mode — Schéma OpenAPI 3.1 des sorties `--json` du CLI (item #121).
//
// **Cap stratégique** : permettre l'**intégration robuste** par des
// consommateurs externes (ServiceNow, dashboards custom, équipes plateforme,
// pipelines analytics) qui consomment `aiad-sdd <cmd> --json`. Sans un
// schéma versionné, chaque consommateur réinvente ses types — fragile et
// non opposable.
//
// **Approche** : produire un **document OpenAPI 3.1 fictif** où chaque
// commande `--json` est modélisée comme un `path` `/cli/<command>` avec
// une `200 response` typée. Les schemas réutilisables sont dans
// `components.schemas`. Compatible avec les générateurs de clients
// (openapi-typescript, openapi-generator, etc.).
//
// **Zero-dep** : sérialiseur YAML maison réutilisé depuis `openapi-export.js`.
//
// Documentation : https://aiad.ovh/cli-schema

import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { versYaml } from './openapi-export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Catalogue des sorties --json ──────────────────────────────────────────

/**
 * Catalogue des commandes `--json` documentées avec leur schéma de
 * réponse JSON Schema. Mise à jour manuelle lors de l'ajout d'une
 * nouvelle commande JSON.
 *
 * Format : `{ command: { summary, schema, example? } }`
 */
export const CATALOGUE = {
  // (#363) status — vraie shape lib/status.js.
  status: {
    summary: 'État du projet SDD',
    schema: { type: 'object', required: ['initialise', 'projetDir'], properties: { initialise: { type: 'boolean' }, projetDir: { type: 'string' }, fondamentaux: { type: 'object', additionalProperties: { type: 'object', properties: { present: { type: 'boolean' }, rempli: { type: 'boolean' } } } }, cycle: { type: 'object', properties: { intents: { type: 'integer' }, specs: { type: 'integer' } } }, infrastructure: { type: 'object', properties: { claudeMd: { type: 'boolean' }, commands: { type: 'boolean' }, gouvernanceCount: { type: 'integer' } } }, maturite: { type: 'object', properties: { score: { type: 'integer' }, total: { type: 'integer' }, label: { type: 'string' } } }, santeGlobale: { type: ['object', 'null'] }, publicationContext: { $ref: '#/components/schemas/PublicationContext' } } },
  },
  // (#364) doctor — racine, santeGlobale (#218), version (CLI).
  doctor: {
    summary: 'Diagnostic complet du projet',
    schema: { type: 'object', required: ['ok', 'version', 'racine', 'checks'], properties: { ok: { type: 'boolean' }, version: { type: 'string' }, racine: { type: 'string' }, checks: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, ok: { type: 'boolean' }, message: { type: 'string' }, severity: { type: ['string', 'null'], enum: ['warn', 'info', null] } } } }, leadership: { $ref: '#/components/schemas/LeadershipMetrics' }, santeGlobale: { type: ['object', 'null'] }, publicationContext: { $ref: '#/components/schemas/PublicationContext' }, santeStrictFail: { type: 'object', properties: { seuil: { type: 'integer' }, score: { type: 'integer' } } } } },
  },
  trace: {
    summary: 'Matrice de traçabilité Intent ↔ SPEC ↔ Code ↔ Tests',
    schema: { $ref: '#/components/schemas/TraceabilityMatrix' },
  },
  sbom: {
    summary: 'Software Bill of Materials CycloneDX v1.5',
    schema: { $ref: '#/components/schemas/CycloneDxSbom' },
  },
  // (#362) dpia — voir lib/dpia.js#L362.
  dpia: {
    summary: 'AIPD pré-remplie (Article 35 RGPD)',
    schema: { type: 'object', required: ['date', 'project'], properties: { date: { type: 'string', format: 'date' }, project: { type: 'object', properties: { name: { type: 'string' }, version: { type: 'string' } } }, specs: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, status: { type: 'string' }, parent_intent: { type: ['string', 'null'] } } } }, code: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, isTest: { type: 'boolean' }, specs: { type: 'array', items: { type: 'string' } } } } }, agent: { type: 'object', properties: { installed: { type: 'boolean' }, refConstitutionnel: { type: 'string' } } }, summary: { type: ['object', 'null'] } } },
  },
  sovereignty: {
    summary: 'Score EU Sovereignty composite (5 dimensions)',
    schema: { $ref: '#/components/schemas/SovereigntyScore' },
  },
  adrs: {
    summary: 'Architecture Decision Records extraits de .aiad/ARCHITECTURE.md',
    schema: { type: 'object', required: ['fichier', 'total', 'entrees'], properties: { fichier: { type: ['string', 'null'] }, total: { type: 'integer' }, entrees: { type: 'array', items: { type: 'object', required: ['id', 'titre', 'ligne'], properties: { id: { type: 'string' }, titre: { type: 'string' }, section: { type: ['string', 'null'] }, ligne: { type: 'integer' }, corps: { type: 'string' } } } } } },
  },
  sla: {
    summary: 'Matrice SLA (versions supportées + politique)',
    schema: { $ref: '#/components/schemas/SlaMatrix' },
  },
  'audit log': {
    summary: 'Log audit trail crypto-signé',
    schema: { type: 'object', required: ['total', 'events'], properties: { total: { type: 'integer' }, events: { type: 'array', items: { $ref: '#/components/schemas/AuditEvent' } } } },
  },
  'audit verify': {
    summary: 'Vérification de la chaîne audit (intégrité + signatures)',
    schema: { type: 'object', required: ['valid'], properties: { valid: { type: 'boolean' }, raisons: { type: 'array', items: { type: 'string' } }, indexCassures: { type: 'array', items: { type: 'integer' } } } },
  },
  'archive --list': {
    summary: 'Liste des artefacts archivés',
    schema: { type: 'object', required: ['total', 'archives'], properties: { total: { type: 'integer' }, archives: { type: 'array', items: { $ref: '#/components/schemas/ArchivedArtifact' } } } },
  },
  'hook-stats': {
    summary: 'Métriques du hook pre-commit (p50/p95/timeouts)',
    schema: { $ref: '#/components/schemas/HookStats' },
  },
  'pii-scan': {
    summary: 'Détection de PII dans Intents/SPECs',
    schema: { type: 'object', required: ['mode', 'files', 'findings'], properties: { mode: { type: 'string', enum: ['block', 'warn', 'off'] }, files: { type: 'integer' }, findings: { type: 'integer' }, byFile: { type: 'object', additionalProperties: { type: 'array' } } } },
  },
  // (#359) reflect — early-return : pas d'artefact → `{ axes: [], raison: '...' }`.
  reflect: {
    summary: 'Rétrospective sprint via Ollama (3-5 axes)',
    schema: { type: 'object', required: ['axes'], properties: { since: { type: 'string', format: 'date-time' }, axes: { type: 'array', items: { $ref: '#/components/schemas/ReflectAxis' } }, raison: { type: 'string' } } },
  },
  'webhooks list': {
    summary: 'Liste des souscriptions webhooks',
    schema: { type: 'object', properties: { subscriptions: { type: 'array', items: { $ref: '#/components/schemas/WebhookSubscription' } } } },
  },
  'offline status': {
    summary: 'Statut du mode air-gapped',
    schema: { type: 'object', required: ['offline'], properties: { offline: { type: 'boolean' }, env: { type: ['string', 'null'] }, allowlist: { type: 'array', items: { type: 'string' } }, attempts: { type: 'integer' }, recent: { type: 'array' } } },
  },
  // (#372) dashboard --check : valide collect+render sans écrire fichiers.
  'dashboard check': {
    summary: 'Mode --check : valide collect+render sans écrire (exit 1 si erreur)',
    schema: { type: 'object', required: ['ok', 'errors', 'pages'], properties: { ok: { type: 'boolean' }, errors: { type: 'array', items: { type: 'string' } }, pages: { type: 'array', items: { type: 'string' } } } },
  },
  // (#385) bench --json : métriques taille commandes slash (routers v1.7).
  bench: {
    summary: 'Métriques taille commandes slash (avant/transition/après routers v1.7)',
    schema: { type: 'object', properties: { avantBytes: { type: 'integer' }, transitionBytes: { type: 'integer' }, apresBytes: { type: 'integer' }, avantTokens: { type: 'integer' }, transitionTokens: { type: 'integer' }, apresTokens: { type: 'integer' }, reductionFinalePct: { type: 'integer' }, reductionTransitionPct: { type: 'integer' }, charsPerToken: { type: 'number' }, routers: { type: 'object' }, alias: { type: 'object' }, subSdd: { type: 'object' }, subAiad: { type: 'object' } } },
  },
  // (#367) ci-template list — dernière route enum AiadMeta sans doc.
  'ci-template list': {
    summary: 'Liste des templates CI/CD AIAD (6 forges)',
    schema: { type: 'object', required: ['forges'], properties: { forges: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', enum: ['github', 'gitlab', 'jenkins', 'drone', 'bitbucket', 'azure'] }, label: { type: 'string' }, source: { type: 'string' }, cible: { type: 'string' }, description: { type: 'string' } } } } } },
  },
  // (#366) Standup — 2 routes (single lens vs --all).
  // (#366) Standup — 2 routes (single lens vs --all). stale présent ssi kanban.html plus ancien que .aiad/.
  standup: {
    summary: 'URL Kanban focus-mode (single lens : all|pm|pe|ae|qa|tl)',
    schema: { type: 'object', required: ['lens', 'focus', 'relative', 'absolute', 'exists'], properties: { lens: { type: 'string', enum: ['all', 'pm', 'pe', 'ae', 'qa', 'tl'] }, focus: { type: 'boolean' }, relative: { type: 'string' }, absolute: { type: 'string' }, exists: { type: 'boolean' }, stale: { type: 'object' } } },
  },
  'standup all': {
    summary: 'URLs Kanban focus-mode pour les 5 rôles (PM/PE/AE/QA/TL)',
    schema: { type: 'object', required: ['liens'], properties: { liens: { type: 'array', items: { type: 'object', properties: { lens: { type: 'string', enum: ['pm', 'pe', 'ae', 'qa', 'tl'] }, focus: { type: 'boolean' }, relative: { type: 'string' }, absolute: { type: 'string' }, exists: { type: 'boolean' } } } }, stale: { type: 'object' } } },
  },
  // (#365) Routes dora record / import-git.
  'dora record': {
    summary: 'Enregistre un déploiement DORA',
    schema: { type: 'object', required: ['date', 'file', 'status'], properties: { date: { type: 'string', format: 'date' }, file: { type: 'string' }, nn: { type: 'integer' }, nom: { type: 'string' }, status: { type: 'string', enum: ['success', 'hotfix', 'failed'] } } },
  },
  'dora import-git': {
    summary: 'Importe les tags Git comme déploiements DORA',
    // (#380) items shape complète : file, nom, date, nn, status, tag.
    schema: { type: 'object', required: ['imported'], properties: { imported: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, nom: { type: 'string' }, date: { type: 'string', format: 'date' }, nn: { type: 'string' }, status: { type: 'string', enum: ['success', 'hotfix', 'failed'] }, tag: { type: 'string' } } } } } },
  },
  // (#345) brief + workspace : routes avec publicationContext $ref (#339/#342).
  brief: {
    summary: 'Brief one-pager — santé + maturité + 3 alertes + 3 rituels',
    schema: { type: 'object', properties: {
      projet: { type: 'string' },
      maturite: { type: ['object', 'null'] }, sante: { type: ['object', 'null'] },
      publicationContext: { $ref: '#/components/schemas/PublicationContext' },
      alertes: { type: 'array', items: { type: 'object' } },
      rituels: { type: 'array', items: { type: 'object' } },
      counts: { type: 'object', properties: {
        intents: { type: 'integer' }, specs: { type: 'integer' }, tests: { type: 'integer' },
        violations: { type: 'integer' }, specsSansTests: { type: 'integer' },
      } },
    } },
  },
  // (#391) telemetry status — opt-in tracking config, lecture seule.
  'telemetry status': {
    summary: 'Statut télémétrie AIAD (opt-in, anonymousId, endpoint)',
    schema: { type: 'object', required: ['optIn'], properties: { optIn: { type: 'boolean' }, anonymousId: { type: ['string', 'null'] }, since: { type: ['string', 'null'], format: 'date-time' }, endpoint: { type: ['string', 'null'] }, localLog: { type: ['string', 'null'] } } },
  },
  // (#397) plugin list — plugins AIAD installés dans .aiad/plugins/.
  'plugin list': {
    summary: 'Liste des plugins AIAD installés (.aiad/plugins/)',
    schema: { type: 'object', required: ['total', 'plugins'], properties: { total: { type: 'integer' }, plugins: { type: 'array', items: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, version: { type: 'string' }, source: { type: 'string' }, commands: { type: 'array', items: { type: 'string' } }, specTemplates: { type: 'array', items: { type: 'string' } }, hooks: { type: 'array', items: { type: 'string' } } } } } } },
  },
  // (#451) plugin info — détails d'un plugin (variant found / not-found).
  'plugin info': {
    summary: 'Détail d\'un plugin (found=true/false + available)',
    schema: { type: 'object', required: ['name', 'found'], properties: { name: { type: 'string' }, found: { type: 'boolean' }, available: { type: 'array', items: { type: 'string' } }, plugin: { type: 'object', required: ['name', 'source', 'path', 'manifest'], properties: { name: { type: 'string' }, version: { type: 'string' }, source: { type: 'string', enum: ['npm', 'local'] }, path: { type: 'string' }, manifest: { type: 'object' } } } } },
  },
  // (#452) emit-rules --check — parité multi-runtime AIAD vs AGENT-GUIDE.
  'emit-rules --check': {
    summary: 'Vérifie parité multi-runtime (AGENTS/CLAUDE/Cursor/Codex/Gemini) vs AGENT-GUIDE',
    schema: { type: 'object', required: ['runtimes', 'check', 'created', 'updated', 'unchanged', 'drifts'], properties: { runtimes: { type: 'array', items: { type: 'string' } }, check: { type: 'boolean' }, dryRun: { type: 'boolean' }, created: { type: 'integer' }, updated: { type: 'integer' }, unchanged: { type: 'integer' }, drifts: { type: 'array', items: { type: 'string' } } } },
  },
  // (#453) docs --check — drift detect DOCUMENTATION.md vs source-hash.
  'docs --check': {
    summary: 'Vérifie synchronisation DOCUMENTATION.md (drift sur source-hash commandes/skills/agents)',
    schema: { type: 'object', required: ['ok', 'drift', 'path', 'hash'], properties: { ok: { type: 'boolean' }, drift: { type: 'boolean' }, path: { type: 'string' }, hash: { type: 'string' } } },
  },
  // (#454) update --check — parité projet vs package (commandes + gouvernance + hooks + templates).
  'update --check': {
    summary: 'Vérifie parité projet vs package (commandes Claude/Cursor/Codex + gouvernance + hooks)',
    schema: { type: 'object', required: ['check', 'created', 'updated', 'unchanged', 'preserved', 'drifts'], properties: { check: { type: 'boolean' }, dryRun: { type: 'boolean' }, created: { type: 'integer' }, updated: { type: 'integer' }, unchanged: { type: 'integer' }, preserved: { type: 'integer' }, drifts: { type: 'array', items: { type: 'string' } } } },
  },
  // (#455) migrate — plan/applique migrations idempotentes sur .aiad/ (M1..M5).
  'migrate': {
    summary: 'Plan/applique migrations idempotentes .aiad/ (M1-traceability..M5-update-check)',
    schema: { type: 'object', required: ['ok', 'planned', 'appliquees'], properties: { ok: { type: 'boolean' }, planned: { type: 'array', items: { type: 'object', required: ['id', 'description'], properties: { id: { type: 'string' }, description: { type: 'string' } } } }, appliquees: { type: 'array', items: { type: 'string' } } } },
  },
  // (#456) completion --list — shells supportés + chemins d'install.
  'completion --list': {
    summary: 'Liste shells supportés pour l\'auto-complétion CLI (bash|zsh|fish) + chemins',
    schema: { type: 'object', required: ['shells', 'install', 'total'], properties: { shells: { type: 'array', items: { type: 'string', enum: ['bash', 'zsh', 'fish'] } }, install: { type: 'object', properties: { bash: { type: 'string' }, zsh: { type: 'string' }, fish: { type: 'string' } } }, total: { type: 'integer' } } },
  },
  // (#457) provenance sigstore — commandes cosign Sigstore/Rekor (sign + verify).
  'provenance sigstore': {
    summary: 'Commandes cosign Sigstore/Rekor pour signer/vérifier attestation SLSA',
    schema: { type: 'object', required: ['predicate', 'bundle', 'predicateType', 'commands'], properties: { predicate: { type: 'string' }, bundle: { type: 'string' }, predicateType: { type: 'string' }, docsUrl: { type: 'string' }, commands: { type: 'object', required: ['sign', 'verify'], properties: { sign: { type: 'string' }, verify: { type: 'string' } } } } },
  },
  // (#458) gitlab issue --dry-run — preview payload Issue depuis Intent AIAD.
  'gitlab issue --dry-run': {
    summary: 'Preview payload GitLab Issue depuis Intent AIAD (--dry-run, sans appel API)',
    schema: { type: 'object', required: ['dryRun', 'payload'], properties: { dryRun: { type: 'boolean' }, payload: { type: 'object', required: ['title', 'description', 'labels'], properties: { title: { type: 'string' }, description: { type: 'string' }, labels: { type: 'array', items: { type: 'string' } } } } } },
  },
  // (#459) gitlab wiki --dry-run — preview page Wiki depuis Intent/SPEC AIAD.
  'gitlab wiki --dry-run': {
    summary: 'Preview payload GitLab Wiki depuis Intent/SPEC AIAD (--dry-run, sans appel API)',
    schema: { type: 'object', required: ['dryRun', 'kind', 'payload'], properties: { dryRun: { type: 'boolean' }, kind: { type: 'string', enum: ['intent', 'spec'] }, payload: { type: 'object', required: ['slug', 'title', 'content'], properties: { slug: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' } } } } },
  },
  // (#460) bitbucket issue --dry-run — preview payload Issue Bitbucket depuis Intent AIAD.
  'bitbucket issue --dry-run': {
    summary: 'Preview payload Bitbucket Issue depuis Intent AIAD (--dry-run, sans appel API)',
    schema: { type: 'object', required: ['dryRun', 'payload'], properties: { dryRun: { type: 'boolean' }, payload: { type: 'object', required: ['title', 'content', 'kind', 'priority'], properties: { title: { type: 'string' }, content: { type: 'string' }, kind: { type: 'string' }, priority: { type: 'string' } } } } },
  },
  // (#461) azure work-item --dry-run — preview Work Item Azure DevOps depuis Intent AIAD.
  'azure work-item --dry-run': {
    summary: 'Preview Work Item Azure DevOps depuis Intent AIAD (--dry-run, sans appel API)',
    schema: { type: 'object', required: ['dryRun', 'payload'], properties: { dryRun: { type: 'boolean' }, payload: { type: 'object', required: ['type', 'title', 'description', 'tags'], properties: { type: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } } } } },
  },
  // (#462) azure wiki --dry-run — preview page Wiki Azure DevOps depuis Intent/SPEC AIAD.
  'azure wiki --dry-run': {
    summary: 'Preview payload Azure Wiki depuis Intent/SPEC AIAD (--dry-run, sans appel API)',
    schema: { type: 'object', required: ['dryRun', 'kind', 'payload'], properties: { dryRun: { type: 'boolean' }, kind: { type: 'string', enum: ['intent', 'spec'] }, payload: { type: 'object', required: ['path', 'title', 'content'], properties: { path: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' } } } } },
  },
  // (#463) cert exam — sujet d'examen certification AIAD par niveau (5 niveaux, 6 axes).
  'cert exam': {
    summary: 'Sujet d\'examen certification AIAD pour un niveau donné (Découvreur..Architecte)',
    schema: { type: 'object', required: ['niveau', 'sujet', 'axesEvalues'], properties: { niveau: { type: 'string', enum: ['Découvreur', 'Praticien', 'Confirmé', 'Expert', 'Architecte'] }, sujet: { type: 'string' }, axesEvalues: { type: 'array', items: { type: 'string' } } } },
  },
  // (#464) cert matrix — 100ᵉ route 🎉 — matrice complète 5 niveaux × 6 axes certification AIAD.
  'cert matrix': {
    summary: 'Matrice de compétences certification AIAD (5 niveaux × 6 axes)',
    schema: { type: 'object', required: ['niveaux', 'axes', 'matrice'], properties: { niveaux: { type: 'array', items: { type: 'string' } }, axes: { type: 'array', items: { type: 'object', required: ['id', 'label'], properties: { id: { type: 'string' }, label: { type: 'string' } } } }, matrice: { type: 'object', additionalProperties: { type: 'object' } } } },
  },
  // (#465) org init --dry-run — preview création .aiad/org.yml (template policies org-wide).
  'org init --dry-run': {
    summary: 'Preview création .aiad/org.yml depuis template (--dry-run, sans écriture)',
    schema: { type: 'object', required: ['path', 'exists', 'action', 'dryRun'], properties: { path: { type: 'string' }, exists: { type: 'boolean' }, action: { type: 'string', enum: ['preview', 'created', 'overwritten'] }, dryRun: { type: 'boolean' } } },
  },
  // (#466) hooks status — état d'installation des hooks Git AIAD (read-only).
  'hooks status': {
    summary: 'État installation hooks Git AIAD (hookScript/husky/gitHook/config/bypass + mode)',
    schema: { type: 'object', required: ['hookScript', 'husky', 'gitHook', 'config', 'bypass', 'mode', 'installed'], properties: { hookScript: { type: 'boolean' }, husky: { type: 'boolean' }, gitHook: { type: 'boolean' }, config: { type: 'boolean' }, bypass: { type: 'boolean' }, mode: { type: 'string', enum: ['husky', 'git', 'none'] }, installed: { type: 'boolean' } } },
  },
  // (#467) pii-scan --rules — catalogue des règles de détection PII (14 detectors).
  'pii-scan --rules': {
    summary: 'Catalogue des règles de détection PII (id, label, severity, hasVerify)',
    schema: { type: 'object', required: ['rules', 'total'], properties: { rules: { type: 'array', items: { type: 'object', required: ['id', 'label', 'severity', 'hasVerify'], properties: { id: { type: 'string' }, label: { type: 'string' }, severity: { type: 'string', enum: ['critique', 'eleve', 'moyen'] }, hasVerify: { type: 'boolean' } } } }, total: { type: 'integer' } } },
  },
  // (#468) gouvernance info — détails d'un pack de gouvernance (multi-variant found/not-found + agents).
  'gouvernance info': {
    summary: 'Détails d\'un pack de gouvernance AIAD (found=true/false + agents Tier 1)',
    schema: { type: 'object', required: ['id', 'found'], properties: { id: { type: ['string', 'null'] }, found: { type: 'boolean' }, available: { type: 'array', items: { type: 'string' } }, pack: { type: 'object', properties: { id: { type: 'string' }, titre: { type: 'string' }, description: { type: 'string' }, juridiction: { type: 'string' }, defaut: { type: 'boolean' } } }, agents: { type: 'array', items: { type: 'string' } }, total: { type: 'integer' } } },
  },
  // (#469) template info — détails d'un template SPEC (multi-variant found/not-found).
  'template info': {
    summary: 'Détails d\'un template SPEC par domaine (found=true/false + governance)',
    schema: { type: 'object', required: ['id', 'found'], properties: { id: { type: ['string', 'null'] }, found: { type: 'boolean' }, available: { type: 'array', items: { type: 'string' } }, template: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, governance: { type: 'array', items: { type: 'string' } } } } } },
  },
  // (#470) new info — détails d'un template projet (multi-variant found/not-found).
  'new info': {
    summary: 'Détails d\'un template projet (fastapi-aiad/node-aiad/…) — found + target + framework',
    schema: { type: 'object', required: ['id', 'found'], properties: { id: { type: ['string', 'null'] }, found: { type: 'boolean' }, available: { type: 'array', items: { type: 'string' } }, template: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, target: { type: 'string' }, language: { type: 'string' }, framework: { type: 'string' }, license: { type: 'string' } } } } },
  },
  // (#471) ci-template info — détails d'une forge CI/CD (multi-variant found/not-found).
  'ci-template info': {
    summary: 'Détails d\'une forge CI/CD (github/gitlab/jenkins/drone/bitbucket/azure) — source/cible/description',
    schema: { type: 'object', required: ['id', 'found'], properties: { id: { type: ['string', 'null'] }, found: { type: 'boolean' }, available: { type: 'array', items: { type: 'string' } }, forge: { type: 'object', properties: { id: { type: 'string', enum: ['github', 'gitlab', 'jenkins', 'drone', 'bitbucket', 'azure'] }, label: { type: 'string' }, source: { type: 'string' }, cible: { type: 'string' }, description: { type: 'string' } } } } },
  },
  // (#472) tutorial info — détails d'un tutoriel AIAD (multi-variant found/not-found + workflow).
  'tutorial info': {
    summary: 'Détails d\'un tutoriel AIAD par domaine (intent/specDomain + workflow étapes)',
    schema: { type: 'object', required: ['id', 'found'], properties: { id: { type: ['string', 'null'] }, found: { type: 'boolean' }, available: { type: 'array', items: { type: 'string' } }, tutorial: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, specDomain: { type: 'string' }, intentTitle: { type: 'string' }, workflow: { type: 'array', items: { type: 'string' } } } } } },
  },
  // (#473) github-app info — détails d'un artefact GitHub App (workflow|manifest).
  'github-app info': {
    summary: 'Détails d\'un artefact GitHub App (workflow PR ou manifest) — source/cible/description',
    schema: { type: 'object', required: ['id', 'found'], properties: { id: { type: ['string', 'null'] }, found: { type: 'boolean' }, available: { type: 'array', items: { type: 'string' } }, artefact: { type: 'object', properties: { id: { type: 'string', enum: ['workflow', 'manifest'] }, label: { type: 'string' }, source: { type: 'string' }, cible: { type: 'string' }, description: { type: 'string' } } } } },
  },
  // (#474) webhooks types — catalogue des 10 types d'événements webhooks supportés.
  'webhooks types': {
    summary: 'Catalogue des types d\'événements webhooks supportés (intent/spec/governance/audit/drift)',
    schema: { type: 'object', required: ['events', 'total'], properties: { events: { type: 'array', items: { type: 'string', enum: ['intent.created', 'intent.updated', 'intent.deleted', 'spec.validated', 'spec.created', 'spec.updated', 'governance.veto', 'governance.warning', 'audit.violation', 'drift.detected'] } }, total: { type: 'integer' } } },
  },
  // (#475) audit types — catalogue des 5 actions audit log valides (created/modified/deleted/imported/archived).
  'audit types': {
    summary: 'Catalogue des actions audit log valides (created/modified/deleted/imported/archived)',
    schema: { type: 'object', required: ['actions', 'total'], properties: { actions: { type: 'array', items: { type: 'string', enum: ['created', 'modified', 'deleted', 'imported', 'archived'] } }, total: { type: 'integer' } } },
  },
  // (#476) dora types — catalogue des 3 statuts DORA (success/hotfix/failed).
  'dora types': {
    summary: 'Catalogue des statuts de déploiement DORA (success/hotfix/failed)',
    schema: { type: 'object', required: ['statuses', 'total'], properties: { statuses: { type: 'array', items: { type: 'string', enum: ['success', 'hotfix', 'failed'] } }, total: { type: 'integer' } } },
  },
  // (#477) cert axes — catalogue des 6 axes de certification AIAD (intent/spec/drift/gouvernance/multi-runtime/metriques).
  'cert axes': {
    summary: 'Catalogue des 6 axes de certification AIAD avec id et label',
    schema: { type: 'object', required: ['axes', 'total'], properties: { axes: { type: 'array', items: { type: 'object', required: ['id', 'label'], properties: { id: { type: 'string' }, label: { type: 'string' } } } }, total: { type: 'integer' } } },
  },
  // (#478) score verdicts — catalogue des 4 verdicts scoring AIAD avec seuils %.
  'score verdicts': {
    summary: 'Catalogue des 4 verdicts scoring AIAD (Excellent/Bon/À retravailler/Insuffisant) avec seuils',
    schema: { type: 'object', required: ['verdicts', 'total'], properties: { verdicts: { type: 'array', items: { type: 'object', required: ['label', 'seuil'], properties: { label: { type: 'string', enum: ['Excellent', 'Bon', 'À retravailler', 'Insuffisant'] }, seuil: { type: 'number' } } } }, total: { type: 'integer' } } },
  },
  // (#479) archive types — catalogue des 2 types d'artefacts archivables (intents/specs) + formats ID.
  'archive types': {
    summary: 'Catalogue des types d\'artefacts archivables (intents/specs) avec préfixes ID acceptés',
    schema: { type: 'object', required: ['types', 'total'], properties: { types: { type: 'array', items: { type: 'object', required: ['kind', 'prefixes', 'format'], properties: { kind: { type: 'string', enum: ['intents', 'specs'] }, prefixes: { type: 'array', items: { type: 'string' } }, format: { type: 'string' } } } }, total: { type: 'integer' } } },
  },
  // (#480) cert niveaux — catalogue des 5 niveaux certification AIAD (Découvreur..Architecte).
  'cert niveaux': {
    summary: 'Catalogue des 5 niveaux de certification AIAD (Découvreur, Praticien, Confirmé, Expert, Architecte)',
    schema: { type: 'object', required: ['niveaux', 'total'], properties: { niveaux: { type: 'array', items: { type: 'string', enum: ['Découvreur', 'Praticien', 'Confirmé', 'Expert', 'Architecte'] } }, total: { type: 'integer' } } },
  },
  // (#481) dinum criteria — catalogue des 9 critères Commun Numérique de l'État FR.
  'dinum criteria': {
    summary: 'Catalogue des 9 critères Commun Numérique de l\'État FR (open-source, license-libre, RGAA/RGPD/RGESN, …)',
    schema: { type: 'object', required: ['criteria', 'total'], properties: { criteria: { type: 'array', items: { type: 'object', required: ['id', 'label'], properties: { id: { type: 'string' }, label: { type: 'string' } } } }, total: { type: 'integer' } } },
  },
  // (#482) emit-rules runtimes — catalogue des 6 runtimes IA supportés (5 + 'all').
  'emit-rules runtimes': {
    summary: 'Catalogue des runtimes IA supportés par emit-rules (claude-code, cursor, codex, copilot, gemini, all)',
    schema: { type: 'object', required: ['runtimes', 'total'], properties: { runtimes: { type: 'array', items: { type: 'string', enum: ['claude-code', 'cursor', 'codex', 'copilot', 'gemini', 'all'] } }, total: { type: 'integer' } } },
  },
  // (#483) sla policy — politique SLA par défaut AIAD (versions + patch windows par sévérité).
  'sla policy': {
    summary: 'Politique SLA par défaut AIAD (support majeur, dépréciation, patchWindows par sévérité)',
    schema: { type: 'object', required: ['currentMajorSupportDays', 'patchWindows'], properties: { currentMajorSupportDays: { type: 'integer' }, currentMajorExtendedDays: { type: 'integer' }, previousMajorOverlapDays: { type: 'integer' }, deprecationNoticeDays: { type: 'integer' }, patchWindows: { type: 'object', required: ['critique', 'eleve', 'moyen', 'bas'], properties: { critique: { type: 'string' }, eleve: { type: 'string' }, moyen: { type: 'string' }, bas: { type: 'string' } } } } },
  },
  // (#484) gouvernance lint rules — catalogue des 3 règles de détection gouvernance.
  'gouvernance lint rules': {
    summary: 'Catalogue des 3 règles de détection gouvernance lint (conflit, doublon, agent-manquant)',
    schema: { type: 'object', required: ['rules', 'total'], properties: { rules: { type: 'array', items: { type: 'object', required: ['id', 'label'], properties: { id: { type: 'string', enum: ['conflit', 'doublon', 'agent-manquant'] }, label: { type: 'string' } } } }, total: { type: 'integer' } } },
  },
  // (#485) dora metrics — catalogue des 4 métriques DORA standard (Deployment Frequency, Lead Time, CFR, MTTR).
  'dora metrics': {
    summary: 'Catalogue des 4 métriques DORA standard (deployment-frequency, lead-time-changes, change-failure-rate, mttr)',
    schema: { type: 'object', required: ['metrics', 'total'], properties: { metrics: { type: 'array', items: { type: 'object', required: ['id', 'label', 'desc'], properties: { id: { type: 'string', enum: ['deployment-frequency', 'lead-time-changes', 'change-failure-rate', 'mttr'] }, label: { type: 'string' }, desc: { type: 'string' } } } }, total: { type: 'integer' } } },
  },
  // (#486) bench metrics — catalogue des 6 métriques bench cold-start AIAD (tokens/bytes/routers/alias).
  'bench metrics': {
    summary: 'Catalogue des 6 métriques bench cold-start AIAD (apresTokens/Bytes, avantTokens, transitionTokens, routersCount, aliasCount)',
    schema: { type: 'object', required: ['metrics', 'total'], properties: { metrics: { type: 'array', items: { type: 'object', required: ['id', 'label'], properties: { id: { type: 'string', enum: ['apresTokens', 'apresBytes', 'avantTokens', 'transitionTokens', 'routersCount', 'aliasCount'] }, label: { type: 'string' } } } }, total: { type: 'integer' } } },
  },
  // (#487) bench flow — catalogue des 5 Flow Metrics standard (Cycle Time, Lead Time, Throughput, WIP, Flow Efficiency).
  'bench flow': {
    summary: 'Catalogue des 5 Flow Metrics standard (cycle-time, lead-time, throughput, wip, flow-efficiency)',
    schema: { type: 'object', required: ['metrics', 'total'], properties: { metrics: { type: 'array', items: { type: 'object', required: ['id', 'label', 'desc'], properties: { id: { type: 'string', enum: ['cycle-time', 'lead-time', 'throughput', 'wip', 'flow-efficiency'] }, label: { type: 'string' }, desc: { type: 'string' } } } }, total: { type: 'integer' } } },
  },
  // (#488) cert valeurs — 🎉 boucle 300 — catalogue des 7 valeurs fondamentales AIAD.
  'cert valeurs': {
    summary: 'Les 7 valeurs fondamentales AIAD (Primauté Intention, Honnêteté Contradictions, Sobriété, Ouverture, Empirisme, Responsabilité, Human Authorship)',
    schema: { type: 'object', required: ['valeurs', 'total'], properties: { valeurs: { type: 'array', items: { type: 'object', required: ['id', 'label'], properties: { id: { type: 'string', enum: ['primaute-intention', 'honnetete-contradictions', 'sobriete-intentionnelle', 'ouverture-radicale', 'empirisme-sans-concession', 'responsabilite-partagee', 'human-authorship'] }, label: { type: 'string' } } } }, total: { type: 'integer' } } },
  },
  // (#489) import sources — catalogue des 3 sources d'import (spec-kit, kiro, auto).
  'import sources': {
    summary: 'Catalogue des sources d\'import AIAD (spec-kit, kiro, auto)',
    schema: { type: 'object', required: ['sources', 'total'], properties: { sources: { type: 'array', items: { type: 'object', required: ['id', 'label'], properties: { id: { type: 'string', enum: ['spec-kit', 'kiro', 'auto'] }, label: { type: 'string' } } } }, total: { type: 'integer' } } },
  },
  // (#490) sovereignty dimensions — catalogue des 5 dimensions Sovereignty Score AIAD (20 pts chaque).
  'sovereignty dimensions': {
    summary: 'Catalogue des 5 dimensions Sovereignty Score AIAD (20 pts chacune, total 100)',
    schema: { type: 'object', required: ['dimensions', 'total', 'scoreMax'], properties: { dimensions: { type: 'array', items: { type: 'object', required: ['id', 'label', 'max', 'desc'], properties: { id: { type: 'string', enum: ['juridictions', 'agentsTier1', 'langueFr', 'autorites', 'hebergement'] }, label: { type: 'string' }, max: { type: 'integer' }, desc: { type: 'string' } } } }, total: { type: 'integer' }, scoreMax: { type: 'integer' } } },
  },
  // (#491) sovereignty niveaux — catalogue des 4 niveaux Sovereignty (Bronze/Silver/Gold/Platinum) avec seuils.
  'sovereignty niveaux': {
    summary: 'Catalogue des 4 niveaux Sovereignty Score (Bronze 0-39, Silver 40-69, Gold 70-89, Platinum 90-100)',
    schema: { type: 'object', required: ['niveaux', 'total'], properties: { niveaux: { type: 'array', items: { type: 'object', required: ['label', 'min'], properties: { label: { type: 'string', enum: ['Platinum', 'Gold', 'Silver', 'Bronze'] }, min: { type: 'integer' } } } }, total: { type: 'integer' } } },
  },
  // (#416) restore — restaure une archive .aiad-backup (decrypt + extract).
  'restore': {
    summary: 'Restaure une archive .aiad-backup (decrypt + extract files)',
    schema: { type: 'object', required: ['files', 'out', 'createdAt', 'manifest', 'dryRun'], properties: { files: { type: 'integer' }, out: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' }, manifest: { type: 'array', items: { type: 'object', required: ['path', 'size'], properties: { path: { type: 'string' }, size: { type: 'integer' } } } }, dryRun: { type: 'boolean' } } },
  },
  // (#415) backup — archive .aiad-backup chiffrée AES-256-GCM (--password requis).
  'backup': {
    summary: 'Crée archive .aiad-backup chiffrée AES-256-GCM (--password requis)',
    schema: { type: 'object', required: ['path', 'files', 'size', 'plaintextSize', 'dryRun'], properties: { path: { type: 'string' }, files: { type: 'integer' }, size: { type: 'integer' }, plaintextSize: { type: 'integer' }, dryRun: { type: 'boolean' } } },
  },
  // (#414) spec-version bump — bump version SPEC + réécrit frontmatter.
  'spec-version bump': {
    summary: 'Bump SPEC version (major|minor|patch) — réécrit frontmatter',
    schema: { type: 'object', required: ['spec', 'ancienne', 'nouvelle', 'kind', 'dryRun'], properties: { spec: { type: 'string' }, ancienne: { type: 'string' }, nouvelle: { type: 'string' }, kind: { type: 'string', enum: ['major', 'minor', 'patch'] }, dryRun: { type: 'boolean' } } },
  },
  // (#413) spec-version check — cohérence semver SPEC vs état git précédent.
  'spec-version check': {
    summary: 'Vérifie cohérence semver SPEC vs état git précédent (breaking + additions)',
    schema: { type: 'object', required: ['spec'], properties: { spec: { type: 'string' }, neuf: { type: 'boolean' }, versionAvant: { type: 'string' }, versionApres: { type: 'string' }, diff: { type: 'object', properties: { breaking: { type: 'array', items: { type: 'object' } }, additions: { type: 'array', items: { type: 'object' } }, needsBumpKind: { type: 'string', enum: ['major', 'minor', 'patch'] } } }, validation: { type: 'object', required: ['valid'], properties: { valid: { type: 'boolean' }, raison: { type: 'string' }, attendu: { type: 'string' } } } } },
  },
  // (#412) tutorial — liste des 4 tutoriels spécialisés AIAD.
  'tutorial': {
    summary: 'Liste des tutoriels AIAD spécialisés par domaine (auth-oidc, payment-pci, rag-llm, gdpr-data-export)',
    schema: { type: 'object', required: ['tutoriels'], properties: { tutoriels: { type: 'array', items: { type: 'object', required: ['id', 'title', 'specDomain'], properties: { id: { type: 'string' }, title: { type: 'string' }, specDomain: { type: 'string' } } } } } },
  },
  // (#411) badge — génère SVG badge README santé/maturité/violations.
  'badge': {
    summary: 'Génère SVG badge README (style shields.io) — santé/maturité/violations',
    schema: { type: 'object', required: ['type', 'bytes'], properties: { type: { type: 'string', enum: ['sante', 'maturite', 'violations'] }, path: { type: ['string', 'null'] }, message: { type: ['string', 'null'] }, score: { type: ['integer', 'null'] }, niveau: { type: ['string', 'null'] }, bytes: { type: 'integer' } } },
  },
  // (#410) sla update — injecte/met à jour le bloc SLA dans SECURITY.md.
  'sla update': {
    summary: 'Met à jour SECURITY.md avec la matrice SLA (dry-run par défaut)',
    schema: { type: 'object', required: ['action', 'path', 'versions', 'dryRun'], properties: { action: { type: 'string', enum: ['created', 'updated', 'appended'] }, path: { type: 'string' }, versions: { type: 'integer' }, dryRun: { type: 'boolean' } } },
  },
  // (#409) sla check — vérifie cohérence SLA matrix (patchWindows + versions).
  'sla check': {
    summary: 'Vérifie cohérence SLA matrix (patchWindows complète, versions classées)',
    schema: { type: 'object', required: ['matrice', 'validation'], properties: { matrice: { $ref: '#/components/schemas/SlaMatrix' }, validation: { type: 'object', required: ['valid', 'issues'], properties: { valid: { type: 'boolean' }, issues: { type: 'array', items: { type: 'string' } } } } } },
  },
  // (#407) audit append — enregistre événement audit (crypto-signé via hashChain).
  'audit append': {
    summary: 'Enregistre un événement audit (created|modified|deleted|imported|archived)',
    schema: { $ref: '#/components/schemas/AuditEvent' },
  },
  // (#406) webhooks test — émet un événement de test (dry-run + delivery report).
  'webhooks test': {
    summary: 'Émet un événement webhook de test (dry-run + delivery report)',
    schema: { $ref: '#/components/schemas/WebhooksEmission' },
  },
  // (#450) offline log — liste tentatives HTTP bloquées en mode air-gapped (audit trail SOC).
  'offline log': {
    summary: 'Liste les tentatives HTTP bloquées en mode air-gapped (audit trail SOC)',
    schema: { type: 'object', required: ['total', 'attempts'], properties: { total: { type: 'integer' }, attempts: { type: 'array', items: { type: 'object', properties: { ts: { type: 'string', format: 'date-time' }, url: { type: 'string' }, contexte: { type: 'string' }, bloque: { type: 'boolean' } } } } } },
  },
  // (#449) bench history — liste l'historique cold-start persisté (.aiad/metrics/bench-history.jsonl).
  'bench history': {
    summary: 'Liste l\'historique des runs cold-start persistés',
    schema: { type: 'object', required: ['runs', 'total'], properties: { runs: { type: 'array', items: { type: 'object', required: ['ts'], properties: { ts: { type: 'string', format: 'date-time' }, apresTokens: { type: 'integer' }, apresBytes: { type: 'integer' }, transitionTokens: { type: 'integer' }, avantTokens: { type: 'integer' }, routersCount: { type: 'integer' }, aliasCount: { type: 'integer' } } } }, total: { type: 'integer' } } },
  },
  // (#447) dora --list — liste des déploiements DORA depuis .aiad/metrics/deployments/.
  'dora --list': {
    summary: 'Liste les déploiements DORA enregistrés (tri date desc)',
    schema: { type: 'object', required: ['deployments', 'total'], properties: { deployments: { type: 'array', items: { type: 'object', required: ['date', 'nom'], properties: { date: { type: 'string', format: 'date' }, nn: { type: 'string' }, nom: { type: 'string' }, status: { type: 'string', enum: ['success', 'hotfix', 'failed'] }, version: { type: 'string' }, commit: { type: 'string' }, cycleTimeDays: { type: 'number' }, leadTimeDays: { type: 'number' } } } }, total: { type: 'integer' } } },
  },
  // (#446) hooks-init — crée .aiad/hooks/aiad-hooks.js depuis template (4ᵉ utilisateur DryRunPathResult).
  'hooks-init': {
    summary: 'Crée .aiad/hooks/aiad-hooks.js depuis template command-hook (--dry-run pour aperçu)',
    schema: { $ref: '#/components/schemas/DryRunPathResult' },
  },
  // (#445) new --list — catalogue templates projets (fastapi-aiad, node-aiad, ...).
  'new --list': {
    summary: 'Liste catalogue templates de projets bootstrap (fastapi-aiad, node-aiad)',
    schema: { type: 'object', required: ['templates', 'total'], properties: { templates: { type: 'array', items: { type: 'object', required: ['id', 'title'], properties: { id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, target: { type: 'string' }, language: { type: 'string' }, framework: { type: 'string' }, license: { type: 'string' } } } }, total: { type: 'integer' } } },
  },
  // (#444) template --list — catalogue des templates SPEC par domaine (10+ verticaux).
  'template --list': {
    summary: 'Liste catalogue des templates SPEC par domaine (auth-oidc, payment-pci, …)',
    schema: { type: 'object', required: ['templates', 'total'], properties: { templates: { type: 'array', items: { type: 'object', required: ['id', 'title'], properties: { id: { type: 'string' }, title: { type: 'string' }, governance: { type: 'array', items: { type: 'string' } } } } }, total: { type: 'integer' } } },
  },
  // (#443) gouvernance --list — catalogue des packs de gouvernance par juridiction.
  'gouvernance --list': {
    summary: 'Liste catalogue des packs de gouvernance AIAD par juridiction',
    schema: { type: 'object', required: ['packs', 'total'], properties: { packs: { type: 'array', items: { type: 'object', required: ['id', 'titre'], properties: { id: { type: 'string' }, titre: { type: 'string' }, description: { type: 'string' }, juridiction: { type: 'string' }, defaut: { type: 'boolean' } } } }, total: { type: 'integer' } } },
  },
  // (#442) marketplace info — détails d'un pack spécifique (multi-variant found/not-found).
  'marketplace info': {
    summary: 'Détails d\'un pack marketplace AIAD (multi-variant trouvé/inconnu)',
    schema: { type: 'object', required: ['id', 'found'], properties: { id: { type: 'string' }, found: { type: 'boolean' }, pack: { type: 'object' }, available: { type: 'array', items: { type: 'string' } } } },
  },
  // (#441) marketplace list — catalogue packs verticaux premium (filtrable secteur/juridiction).
  'marketplace list': {
    summary: 'Liste catalogue packs marketplace AIAD verticaux premium',
    schema: { type: 'object', required: ['packs', 'total', 'filters'], properties: { packs: { type: 'array', items: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, title: { type: 'string' }, secteur: { type: 'string' }, juridiction: { type: 'string' }, couverture: { type: 'array', items: { type: 'string' } }, cible: { type: 'string' }, agents_attendus: { type: 'array', items: { type: 'string' } }, modele: { type: 'string' }, prix_indicatif_eur: { type: 'string' }, fournisseur: { type: 'object', properties: { nom: { type: 'string' }, contact: { type: 'string' }, url: { type: 'string' } } } } } }, total: { type: 'integer' }, filters: { type: 'object', properties: { secteur: { type: ['string', 'null'] }, juridiction: { type: ['string', 'null'] } } } } },
  },
  // (#439) github-app setup + install — discovery + installer artefacts GitHub App.
  'github-app setup': {
    summary: 'Liste des artefacts GitHub App installables (workflow PR + manifest)',
    schema: { type: 'object', required: ['artefacts'], properties: { artefacts: { type: 'array', items: { type: 'object', required: ['id', 'label'], properties: { id: { type: 'string', enum: ['workflow', 'manifest'] }, label: { type: 'string' }, source: { type: 'string' }, cible: { type: 'string' }, description: { type: 'string' } } } } } },
  },
  'github-app install': {
    summary: 'Installe artefact GitHub App (workflow PR ou manifest)',
    schema: { type: 'object', required: ['artefact', 'cible', 'action'], properties: { artefact: { type: 'string', enum: ['workflow', 'manifest'] }, cible: { type: 'string' }, action: { type: 'string', enum: ['created', 'overwritten', 'skipped'] }, dryRun: { type: 'boolean' }, reason: { type: 'string' } } },
  },
  // (#440) archive --restore — restaure un artefact archivé.
  'archive --restore': {
    summary: 'Restaure un artefact AIAD archivé (depuis .aiad/<sous>/archive/)',
    schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, dryRun: { type: 'boolean' }, restored: { type: 'boolean' } } },
  },
  // (#437) archive — archive un artefact AIAD (Intent ou SPEC).
  'archive': {
    summary: 'Archive un artefact AIAD (Intent ou SPEC) — déplace vers .aiad/<sous>/archive/',
    schema: { type: 'object', required: ['id', 'archivePath'], properties: { id: { type: 'string' }, archivePath: { type: 'string' }, dryRun: { type: 'boolean' }, archived: { type: 'boolean' } } },
  },
  // (#435) ci-template install — pose un workflow CI dans une forge (6 forges).
  'ci-template': {
    summary: 'Installe template CI/CD pour une forge (github/gitlab/jenkins/drone/bitbucket/azure)',
    schema: { type: 'object', required: ['forge', 'source', 'cible', 'action'], properties: { forge: { type: 'string', enum: ['github', 'gitlab', 'jenkins', 'drone', 'bitbucket', 'azure'] }, source: { type: 'string' }, cible: { type: 'string' }, action: { type: 'string', enum: ['created', 'overwritten', 'skipped'] }, dryRun: { type: 'boolean' }, reason: { type: 'string' } } },
  },
  // (#434) bench compare — comparaison régression cold-start sur historique.
  'bench compare': {
    summary: 'Comparaison historique cold-start (régression vs seuil sur fenêtre récente/ancienne)',
    schema: { type: 'object', required: ['totalRuns', 'since', 'threshold', 'regression', 'suffisant'], properties: { totalRuns: { type: 'integer' }, since: { type: 'integer' }, threshold: { type: 'number' }, recents: { type: 'array', items: { type: 'object' } }, anciens: { type: 'array', items: { type: 'object' } }, moyenneRecente: { type: 'number' }, moyenneAncienne: { type: 'number' }, delta: { type: 'number' }, ratio: { type: 'number' }, regression: { type: 'boolean' }, suffisant: { type: 'boolean' } } },
  },
  // (#433) gitlab review / bitbucket pr / azure pr — posts review comment (3 routes share ReviewCommentPayload).
  'gitlab review': {
    summary: 'Poste review comment sur GitLab MR (--dry-run produit body sans HTTP)',
    schema: { $ref: '#/components/schemas/ReviewCommentPayload' },
  },
  'bitbucket pr': {
    summary: 'Poste review comment sur Bitbucket PR (Cloud + Server REST)',
    schema: { $ref: '#/components/schemas/ReviewCommentPayload' },
  },
  'azure pr': {
    summary: 'Poste review comment sur Azure DevOps PR',
    schema: { $ref: '#/components/schemas/ReviewCommentPayload' },
  },
  // (#432) review — diff Intent/SPEC vs branche cible (impact gouvernance).
  'review': {
    summary: 'Diff Intent/SPEC vs branche cible (rapport + impact gouvernance)',
    schema: { type: 'object', required: ['target', 'intents', 'specs', 'gouvernanceImpactee'], properties: { target: { type: 'string' }, intents: { $ref: '#/components/schemas/FileDiff' }, specs: { $ref: '#/components/schemas/FileDiff' }, gouvernanceImpactee: { type: 'array', items: { type: 'string' } } } },
  },
  // (#431/#436) rbac init — DryRunPathResult partagé (rbac init + dinum publiccode + dinum franceconnect).
  'rbac init': {
    summary: 'Crée .aiad/rbac/teams.yml depuis template (--dry-run pour aperçu)',
    schema: { $ref: '#/components/schemas/DryRunPathResult' },
  },
  // (#436) dinum publiccode — génère publiccode.yml (Italian Decreto Trasparenza).
  'dinum publiccode': {
    summary: 'Génère publiccode.yml (référencement code.gouv.fr / forge mutualisation)',
    schema: { $ref: '#/components/schemas/DryRunPathResult' },
  },
  // (#436) dinum franceconnect — kit FranceConnect (acr_values eIDAS).
  'dinum franceconnect': {
    summary: 'Génère doc FranceConnect (acr_values eIDAS faible/substantiel/élevé)',
    schema: { $ref: '#/components/schemas/DryRunPathResult' },
  },
  // (#430) anonymize — anonymise JSON records (hash PII / k-anonymity / Laplace DP).
  'anonymize': {
    summary: 'Anonymise JSON records (hash PII / k-anonymity / Laplace DP) — RGPD',
    schema: { type: 'object', required: ['rapport', 'records'], properties: { rapport: { type: 'object', required: ['total', 'isoles', 'conforme'], properties: { total: { type: 'integer' }, isoles: { type: 'integer' }, conforme: { type: 'boolean' } } }, records: { type: 'array', items: { type: 'object' } } } },
  },
  // (#429) export confluence — publie Intents+SPECs vers Confluence (REST API).
  'export confluence': {
    summary: 'Exporte Intents+SPECs vers Confluence (publier ou dry-run preview)',
    schema: { type: 'object', required: ['pages', 'total'], properties: { pages: { type: 'array', items: { type: 'object', required: ['kind', 'title', 'action'], properties: { kind: { type: 'string', enum: ['root', 'intent', 'spec'] }, title: { type: 'string' }, action: { type: 'string', enum: ['dry-run', 'created', 'updated'] } } } }, total: { type: 'integer' } } },
  },
  // (#427) export openapi — exporte OpenAPI 3.1 depuis SPECs AIAD api: true.
  'export openapi': {
    summary: 'Exporte OpenAPI 3.1 depuis SPECs AIAD marquées api: true',
    schema: { type: 'object', required: ['doc', 'warnings', 'specsCount'], properties: { doc: { type: 'object', required: ['openapi', 'info'], properties: { openapi: { type: 'string' }, info: { type: 'object' }, paths: { type: 'object' }, components: { type: 'object' } } }, warnings: { type: 'array', items: { type: 'string' } }, specsCount: { type: 'integer' } } },
  },
  // (#426) storybook — inventaire commandes slash AIAD (32 commandes sdd+aiad).
  'storybook': {
    summary: 'Inventaire des commandes slash AIAD (zero-dep, JSON catalog)',
    schema: { type: 'object', required: ['total', 'byNamespace', 'commands'], properties: { total: { type: 'integer' }, byNamespace: { type: 'object', additionalProperties: { type: 'integer' } }, commands: { type: 'array', items: { type: 'object', required: ['id', 'namespace'], properties: { id: { type: 'string' }, namespace: { type: 'string' }, description: { type: 'string' } } } } } },
  },
  // (#425) verify-reproducibility — content hash sha256 déterministe (npm pack reproductible).
  'verify-reproducibility': {
    summary: 'Vérifie reproductibilité tarball (content hash sha256 déterministe)',
    schema: { type: 'object', required: ['hash', 'files', 'expected', 'match'], properties: { hash: { type: 'string' }, files: { type: 'integer' }, expected: { type: ['string', 'null'] }, match: { type: ['boolean', 'null'] } } },
  },
  // (#424) obsidian — export .aiad/ vers Obsidian Vault (wiki-links + MOC).
  'obsidian': {
    summary: 'Exporte .aiad/ vers Obsidian Vault (wiki-links + MOC + README)',
    schema: { type: 'object', required: ['ok', 'files'], properties: { ok: { type: 'boolean' }, files: { type: 'integer' }, mode: { type: 'string', enum: ['dry-run', 'apply'] }, dir: { type: ['string', 'null'] }, raison: { type: 'string', enum: ['aiad-absent'] }, message: { type: 'string' }, artefacts: { type: 'integer' } } },
  },
  // (#423) refactor-spec — détecte SPECs trop grosses et propose découpage.
  'refactor-spec': {
    summary: 'Évalue SPEC (LOC/critères) et propose découpage si dépassement seuil',
    schema: { type: 'object', required: ['spec', 'evaluation', 'proposition'], properties: { spec: { type: 'string' }, evaluation: { type: 'object', required: ['loc', 'criteres', 'doitRefactoriser'], properties: { loc: { type: 'integer' }, criteres: { type: 'integer' }, sections: { type: 'array', items: { type: 'object', properties: { level: { type: 'integer' }, titre: { type: 'string' }, ligne: { type: 'integer' }, fin: { type: 'integer' } } } }, depasseLoc: { type: 'boolean' }, depasseCriteres: { type: 'boolean' }, doitRefactoriser: { type: 'boolean' } } }, proposition: { type: 'object', required: ['mode'], properties: { mode: { type: 'string', enum: ['structurel', 'semantique'] }, sousSpecs: { type: 'array', items: { type: 'object' } }, rationale: { type: 'string' } } } } },
  },
  // (#422) cert verify — vérifie signature JWS + expiration badge cert.
  'cert verify': {
    summary: 'Vérifie badge JWS Product Engineer (signature HMAC + expiration)',
    schema: { type: 'object', required: ['valid', 'payload'], properties: { valid: { type: 'boolean' }, payload: { type: ['object', 'null'] }, raison: { type: 'string' } } },
  },
  // (#421) cert badge — émet badge JWS Product Engineer signé HMAC-SHA256.
  'cert badge': {
    summary: 'Émet badge JWS Product Engineer AIAD (signé HMAC-SHA256, valide 3 ans)',
    schema: { type: 'object', required: ['jws', 'payload'], properties: { jws: { type: 'string' }, payload: { type: 'object', required: ['iss', 'sub', 'niveau', 'axes', 'iat', 'exp', 'fmt'], properties: { iss: { type: 'string' }, sub: { type: 'string' }, niveau: { type: 'string', enum: ['Découvreur', 'Praticien', 'Confirmé', 'Expert', 'Architecte'] }, axes: { type: 'array', items: { type: 'string' } }, iat: { type: 'integer' }, exp: { type: 'integer' }, examPasse: { type: 'string', format: 'date' }, fmt: { type: 'string' } } } } },
  },
  // (#420) provenance verify — vérifie signature HMAC + digests d'attestation.
  'provenance verify': {
    summary: 'Vérifie attestation SLSA Provenance (signature HMAC + digests sha256)',
    schema: { type: 'object', required: ['valid', 'raisons'], properties: { valid: { type: 'boolean' }, raisons: { type: 'array', items: { type: 'string' } } } },
  },
  // (#419) provenance generate — attestation SLSA Provenance v1.0 signée HMAC.
  'provenance generate': {
    summary: 'Génère attestation SLSA Provenance v1.0 signée HMAC-SHA256 (AIAD_PROVENANCE_SECRET)',
    schema: { type: 'object', required: ['path', 'count', 'package', 'commit', 'tag', 'dryRun'], properties: { path: { type: 'string' }, count: { type: 'integer' }, package: { type: 'object', properties: { name: { type: 'string' }, version: { type: 'string' } } }, commit: { type: ['string', 'null'] }, tag: { type: ['string', 'null'] }, dryRun: { type: 'boolean' } } },
  },
  // (#417) webhooks emit — émet un événement réel (intent.created, spec.validated…).
  'webhooks emit': {
    summary: 'Émet un événement webhook réel (intent.created/spec.validated/governance.veto/…)',
    schema: { $ref: '#/components/schemas/WebhooksEmission' },
  },
  // (#405) tour — guided tour AIAD (créé .aiad-tour/ avec Intent+SPEC+Gate démo).
  'tour': {
    summary: 'Guided tour AIAD — créé .aiad-tour/ avec Intent+SPEC+Gate démo',
    schema: { type: 'object', required: ['dir', 'intent', 'spec', 'gateScore', 'gateValid', 'fichiers'], properties: { dir: { type: 'string' }, intent: { type: 'string' }, spec: { type: 'string' }, gateScore: { type: 'integer' }, gateValid: { type: 'boolean' }, fichiers: { type: 'array', items: { type: 'string' } } } },
  },
  // (#404) schema — méta-route : compte des paths/schemas OpenAPI générés.
  'schema': {
    summary: 'Génère et compte les paths/schemas OpenAPI 3.1 du CLI',
    schema: { type: 'object', required: ['path', 'format', 'paths', 'schemas', 'dryRun'], properties: { path: { type: 'string' }, format: { type: 'string', enum: ['json', 'yaml'] }, paths: { type: 'integer' }, schemas: { type: 'integer' }, dryRun: { type: 'boolean' } } },
  },
  // (#403) doctor --fix — application automatique de fixes sains.
  'doctor --fix': {
    summary: 'Application automatique de fixes santé sûrs (catégorie blanche)',
    schema: { type: 'object', required: ['detected', 'applied', 'dryRun', 'fixes'], properties: { detected: { type: 'integer' }, applied: { type: 'integer' }, dryRun: { type: 'boolean' }, fixes: { type: 'array', items: { type: 'object', required: ['kind', 'path'], properties: { kind: { type: 'string', enum: ['create-directory', 'create-index', 'add-frontmatter'] }, path: { type: 'string' }, label: { type: 'string' }, content: { type: 'string' }, file: { type: 'string' }, applied: { type: 'boolean' }, message: { type: 'string' } } } } } },
  },
  // (#402) org check — conformité projet vs policies org-wide.
  'org check': {
    summary: 'Vérification conformité projet vs config org-wide',
    schema: { type: 'object', required: ['valid'], properties: { valid: { type: 'boolean' }, raison: { type: 'string', enum: ['no-org-config'] }, source: { type: 'string' }, strict: { type: 'boolean' }, violations: { type: 'array', items: { type: 'object', required: ['rule', 'message'], properties: { rule: { type: 'string' }, message: { type: 'string' } } } } } },
  },
  // (#401) org show — config org-wide effective (.aiad/org.yml).
  'org show': {
    summary: 'Config org-wide effective (.aiad/org.yml ou héritage)',
    schema: { type: 'object', required: ['source', 'config'], properties: { source: { type: ['string', 'null'] }, config: { type: ['object', 'null'], additionalProperties: true } } },
  },
  // (#400) skills validate — validation .claude/skills/ frontmatter + body.
  'skills validate': {
    summary: 'Validation des skills .claude/skills/ (frontmatter + body sanity)',
    schema: { type: 'object', required: ['ok', 'total', 'valid', 'results'], properties: { ok: { type: 'boolean' }, total: { type: 'integer' }, valid: { type: 'integer' }, results: { type: 'array', items: { type: 'object', required: ['path', 'name', 'ok'], properties: { path: { type: 'string' }, name: { type: 'string' }, ok: { type: 'boolean' }, raisons: { type: 'array', items: { type: 'string' } } } } } } },
  },
  // (#399) rbac check — validation owner/reviewers sur artefacts stagés.
  'rbac check': {
    summary: 'Validation RBAC owner/reviewers sur artefacts stagés',
    schema: { type: 'object', required: ['valid', 'violations', 'stages'], properties: { valid: { type: 'boolean' }, stages: { type: 'integer' }, violations: { type: 'array', items: { type: 'object', properties: { fichier: { type: 'string' }, raison: { type: 'string' } } } } } },
  },
  // (#396) rbac whoami — identité git + équipes RBAC du dev courant.
  'rbac whoami': {
    summary: 'Identité git + équipes RBAC du dev courant',
    schema: { type: 'object', required: ['email', 'teams'], properties: { email: { type: ['string', 'null'] }, teams: { type: 'array', items: { type: 'string' } } } },
  },
  // (#395) ai-act audit — Annexe IV Règlement (UE) 2024/1689 (EU AI Act).
  'ai-act audit': {
    summary: 'Audit IA Act EU (Annexe IV Règlement 2024/1689) — pré-remplissage',
    schema: { type: 'object', required: ['projet', 'specs', 'code', 'agent', 'dateAudit'], properties: { projet: { type: 'object', additionalProperties: true }, specs: { type: 'array', items: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, title: { type: 'string' }, status: { type: 'string' }, parent_intent: { type: ['string', 'null'] } } } }, code: { type: 'array', items: { type: 'object', required: ['path'], properties: { path: { type: 'string' }, isTest: { type: 'boolean' }, specs: { type: 'array', items: { type: 'string' } } } } }, agent: { type: 'boolean' }, dateAudit: { type: 'string', format: 'date' }, summary: { type: 'object', properties: { intents: { type: 'integer' }, specs: { type: 'integer' }, codeFiles: { type: 'integer' }, annotatedCodeFiles: { type: 'integer' }, testFiles: { type: 'integer' }, annotatedTestFiles: { type: 'integer' } } } } },
  },
  // (#394) migrate-v2 — squelette de migration AIAD v1 → v2.
  'migrate-v2': {
    summary: 'Migration AIAD v1 → v2 (dry-run par défaut, --apply pour exécuter)',
    schema: { type: 'object', required: ['ok', 'message', 'detection', 'plan', 'appliquees', 'erreurs'], properties: { ok: { type: 'boolean' }, mode: { type: 'string', enum: ['dry-run', 'apply'] }, raison: { type: 'string' }, message: { type: 'string' }, detection: { type: 'object', required: ['exists'], properties: { exists: { type: 'boolean' }, version: { type: ['string', 'null'] }, marqueurs: { type: 'array', items: { type: 'string' } }, fichiers: { type: 'integer' } } }, plan: { type: 'array', items: { type: 'object', required: ['id', 'titre'], properties: { id: { type: 'string' }, titre: { type: 'string' }, diff: { type: 'array' } } } }, appliquees: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, dureeMs: { type: 'integer' } } } }, erreurs: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, raison: { type: 'string' }, message: { type: 'string' } } } }, backup: { type: ['object', 'null'] }, rollback: { type: ['object', 'null'] }, prune: { type: ['object', 'null'] } } },
  },
  // (#393) dinum check — kit Commun Numérique de l'État FR (code.gouv.fr).
  'dinum check': {
    summary: 'Score Commun Numérique de l\'État FR (9 critères, code.gouv.fr)',
    schema: { type: 'object', required: ['score', 'reussis', 'total', 'criteres'], properties: { score: { type: 'integer', minimum: 0, maximum: 100 }, reussis: { type: 'integer' }, total: { type: 'integer' }, criteres: { type: 'array', items: { type: 'object', required: ['critere', 'label', 'ok'], properties: { critere: { type: 'string' }, label: { type: 'string' }, ok: { type: 'boolean' } } } } } },
  },
  // (#392) self-update — comparaison version locale vs registry npm.
  'self-update': {
    summary: 'Vérification mise à jour npm (registry vs version locale)',
    schema: { type: 'object', required: ['locale', 'status'], properties: { locale: { type: 'string' }, distante: { type: ['string', 'null'] }, status: { type: 'string', enum: ['up-to-date', 'update-available', 'ahead', 'unknown'] }, action: { type: ['string', 'null'] }, error: { type: 'string' } } },
  },
  // (#390) gouvernance lint — vérifie cohérence des références agents AIAD.
  'gouvernance lint': {
    summary: 'Lint cohérence des références gouvernance (conflits, doublons, manquants)',
    schema: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, agents: { type: 'array', items: { type: 'string' } }, conflits: { type: 'array', items: { type: 'object' } }, doublons: { type: 'array', items: { type: 'object' } }, manquants: { type: 'array', items: { type: 'object', properties: { agent: { type: 'string' }, references: { type: 'array', items: { type: 'string' } } } } } } },
  },
  // (#389) workspace trace — agrège construireMatrice() par sous-projet.
  'workspace trace': {
    summary: 'Workspace multi-projet — agrégation trace() par sous-projet',
    schema: { type: 'object', required: ['reports', 'summary'], properties: { workspace: { type: 'object' }, reports: { type: 'array', items: { type: 'object', required: ['name', 'path', 'status'], properties: { name: { type: 'string' }, path: { type: 'string' }, status: { type: 'string', enum: ['analyzed', 'skipped', 'error'] }, ok: { type: 'boolean' }, matrix: { $ref: '#/components/schemas/TraceabilityMatrix' } } } }, summary: { type: 'object', properties: { total: { type: 'integer' }, analyzed: { type: 'integer' }, skipped: { type: 'integer' }, errored: { type: 'integer' }, healthy: { type: 'integer' }, totals: { type: 'object', properties: { intents: { type: 'integer' }, specs: { type: 'integer' }, gaps: { type: 'integer' } } } } } } },
  },
  // (#386) workspace analytics — agrégation cross-org pour ESN/grand groupe.
  'workspace analytics': {
    summary: 'Workspace multi-projet — analytics (sovereignty, velocity, drift cross-org)',
    schema: { type: 'object', required: ['workspace', 'projets', 'analytics'], properties: { workspace: { type: 'object' }, projets: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, path: { type: 'string' }, exists: { type: 'boolean' }, intents: { type: 'integer' }, specs: { type: 'integer' }, sovereignty: { type: ['integer', 'null'] }, governance: { type: 'array', items: { type: 'string' } }, velocite: { type: ['object', 'null'] }, driftCount: { type: 'integer' } } } }, analytics: { type: 'object', properties: { total: { type: 'integer' }, available: { type: 'integer' }, sovereignty: { type: 'object' }, juridictionsCouvertes: { type: 'array', items: { type: 'string' } }, topAgents: { type: 'array', items: { type: 'object' } }, topPacks: { type: 'array', items: { type: 'object' } }, velocite: { type: 'object' }, driftRate: { type: 'number' } } } } },
  },
  'workspace doctor': {
    summary: 'Workspace multi-projet — agrégation doctor() par sous-projet',
    schema: { type: 'object', required: ['reports', 'summary'], properties: { workspace: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } }, reports: { type: 'array', items: { type: 'object', required: ['name', 'path', 'status'], properties: { name: { type: 'string' }, path: { type: 'string' }, status: { type: 'string', enum: ['analyzed', 'skipped', 'error'] }, ok: { type: 'boolean' }, doctor: { type: 'object' }, publicationContext: { $ref: '#/components/schemas/PublicationContext' }, reason: { type: 'string' }, error: { type: 'string' } } } }, summary: { type: 'object', properties: { total: { type: 'integer' }, analyzed: { type: 'integer' }, skipped: { type: 'integer' }, errored: { type: 'integer' }, healthy: { type: 'integer' }, totals: { type: 'object', properties: { intents: { type: 'integer' }, specs: { type: 'integer' }, gaps: { type: 'integer' } } } } } } },
  },
};

// ─── Schémas réutilisables (components) ────────────────────────────────────

export const COMPONENT_SCHEMAS = {
  // (#273) Bloc `_meta` partagé par toutes les sorties --json (#258).
  // Schémas distincts : aiad-sdd-{dashboard, brief, doctor, status,
  // workspace, trace, sovereignty, dora, hook-stats}. Le champ `schema`
  // sert de discriminator pour les consumers génériques.
  // AiadMeta — _meta présent en tête de toute sortie --json (discriminator + version + timestamp).
  AiadMeta: {
    type: 'object', required: ['schema', 'version', 'generated'],
    properties: {
      schema: { type: 'string', enum: [
        'aiad-sdd-dashboard', 'aiad-sdd-dashboard-check', 'aiad-sdd-brief',
        'aiad-sdd-doctor', 'aiad-sdd-status', 'aiad-sdd-workspace',
        'aiad-sdd-trace', 'aiad-sdd-sovereignty', 'aiad-sdd-dora',
        'aiad-sdd-hook-stats', 'aiad-sdd-standup', 'aiad-sdd-adrs', 'aiad-sdd-ci-template',
      ] },
      version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+' },
      generated: { type: 'string', format: 'date-time' },
      action: { type: 'string' }, slim: { type: 'boolean' },
      source: { type: 'object', properties: { schema: { type: 'string' }, slim: { type: 'boolean' } } },
    },
  },
  // (#343) Contexte de publication exposé par les 4 dérivés majeurs de
  // data.json (brief, doctor, status, workspace.reports[]). Permet aux
  // consumers (Slack-bot, Notion sync, audit scripts) de reconstruire
  // les URLs absolues vers les fichiers source sans relire data.json.
  // Toujours présent — strings vides quand non configuré.
  PublicationContext: {
    type: 'object',
    description: 'Contexte publication exposé par brief/doctor/status/workspace --json.',
    required: ['sourceBase', 'publicUrl'],
    properties: {
      sourceBase: { type: 'string' }, publicUrl: { type: 'string' },
    },
  },
  // (#355) TraceabilityMatrix — summary + forward + backward + gaps (object).
  TraceabilityMatrix: {
    type: 'object', properties: {
      summary: { type: 'object', properties: {
        intents: { type: 'integer' }, specs: { type: 'integer' }, codeFiles: { type: 'integer' },
        annotatedCodeFiles: { type: 'integer' }, testFiles: { type: 'integer' }, annotatedTestFiles: { type: 'integer' },
      } },
      forward: { type: 'array', items: { type: 'object', properties: {
        intent: { type: 'object' }, specs: { type: 'array', items: { type: 'object' } },
      } } },
      backward: { type: 'array', items: { type: 'object', properties: {
        test: { type: 'object' }, spec: { type: ['object', 'null'] },
        intent: { type: ['object', 'null'] }, code: { type: 'array', items: { type: 'object' } },
      } } },
      gaps: {
        type: 'object',
        description: 'Lacunes détectées dans la matrice (objet groupé par type).',
        properties: {
          intentsSansSpec: { type: 'array', items: { type: 'object' } },
          specsSansCode: { type: 'array', items: { type: 'object' } },
          specsValideesNonImplementees: { type: 'array', items: { type: 'object' } },
          specsOrphelinsSurCode: { type: 'array', items: { type: 'object' } },
          intentsOrphelinsSurCode: { type: 'array', items: { type: 'object' } },
          codeSansSpec: { type: 'array', items: { type: 'object' } },
          codeSansTests: { type: 'array', items: { type: 'object' } },
        },
      },
      // (SPEC-024-1) SPECs exemptées de traçabilité (livrable sans code applicatif
      // annotable) — exposées pour visibilité, hors décompte de gaps.
      specsExemptees: { type: 'array', items: { type: 'object' } },
      generatedAt: { type: 'string', format: 'date-time' },
    },
  },
  // (#383) Audit shape réelle aiad-sdd sbom --json :
  // { bomFormat, specVersion, serialNumber, version, metadata, components, dependencies }.
  CycloneDxSbom: {
    type: 'object',
    description: 'CycloneDX v1.5 — voir https://cyclonedx.org/specification/overview/',
    properties: {
      bomFormat: { type: 'string', enum: ['CycloneDX'] },
      specVersion: { type: 'string' },
      serialNumber: { type: 'string' },
      version: { type: 'integer' },
      metadata: { type: 'object' },
      components: { type: 'array', items: { type: 'object' } },
      dependencies: { type: 'array', items: { type: 'object' } },
    },
  },
  // (#370) 5 dimensions détaillées (étaient `{ type: 'object' }` génériques).
  SovereigntyScore: {
    type: 'object', required: ['score', 'level', 'dimensions'],
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 100 },
      level: { type: 'string', enum: ['Bronze', 'Silver', 'Gold', 'Platinum'] },
      levelColor: { type: 'string', enum: ['cyan', 'jaune', 'gris', 'rouge'] },
      maxScore: { type: 'integer' },
      dimensions: { type: 'object', properties: {
        juridictions: { type: 'object', properties: {
          score: { type: 'integer' }, juridictions: { type: 'array', items: { type: 'string' } },
          packs: { type: 'array', items: { type: 'object' } },
        } },
        agentsTier1: { type: 'object', properties: {
          score: { type: 'integer' }, baseline: { type: 'integer' }, prime: { type: 'integer' },
          agents: { type: 'array', items: { type: 'object' } },
        } },
        langueFr: { type: 'object', properties: {
          score: { type: 'integer' }, ratioFr: { type: ['number', 'null'] }, total: { type: 'integer' },
          fr: { type: 'integer' }, en: { type: 'integer' }, mixed: { type: 'integer' }, neutral: { type: 'integer' },
        } },
        autorites: { type: 'object', properties: {
          score: { type: 'integer' }, autorites: { type: 'array', items: { type: 'object' } },
        } },
        hebergement: { type: 'object', properties: {
          score: { type: 'integer' }, sources: { type: 'array', items: { type: 'object' } },
        } },
      } },
      recommendations: { type: 'array', items: { type: 'string' } },
    },
  },
  // (#360) `politique` object exposé par lib/sla.js:164 — manquait au
  // schema. Documente la politique de support utilisée pour calculer la
  // matrice (utile aux consumers pour ré-évaluer si la politique change).
  // SlaMatrix — politique.patchWindows : 4 niveaux critique/eleve/moyen/bas (texte humain).
  SlaMatrix: {
    type: 'object', required: ['generatedAt', 'versionCourante', 'politique', 'versions'],
    properties: {
      generatedAt: { type: 'string', format: 'date' }, versionCourante: { type: ['string', 'null'] },
      politique: { type: 'object', properties: {
        currentMajorSupportDays: { type: 'integer' }, previousMajorOverlapDays: { type: 'integer' },
        deprecationNoticeDays: { type: 'integer' },
        patchWindows: { type: 'object', additionalProperties: { type: 'string' } },
      } },
      versions: { type: 'array', items: { type: 'object', properties: {
        major: { type: 'integer' }, versionRange: { type: 'string' },
        releaseDate: { type: ['string', 'null'] }, supportedUntil: { type: ['string', 'null'] },
        status: { type: 'string', enum: ['supported', 'security-only', 'unsupported'] },
      } } },
    },
  },
  // (#357) Audit shape réelle (lib/audit.js#construireEvenement) :
  // - construireEvenement() pose toujours `ts, actor, action, artifact,
  //   hashAvant (null par défaut), hashApres (null par défaut), hashChain`.
  // - signerEvenement() ajoute `sig` (string HMAC). Si pas signé : sig absent.
  // Fix : 7 champs requis (avant : 3 seulement) ; `sig` optionnel et string
  // (avant `['string','null']` — incorrect car sig absent = pas en JSON).
  // AuditEvent — hashChain calculé via sha256(précédent + event). sig HMAC optionnel.
  AuditEvent: {
    type: 'object',
    required: ['ts', 'actor', 'action', 'artifact', 'hashAvant', 'hashApres', 'hashChain'],
    properties: {
      ts: { type: 'string', format: 'date-time' }, actor: { type: 'string' },
      action: { type: 'string', enum: ['created', 'modified', 'deleted', 'imported', 'archived'] },
      artifact: { type: 'string' },
      hashAvant: { type: ['string', 'null'] }, hashApres: { type: ['string', 'null'] },
      hashChain: { type: 'string' }, sig: { type: ['string', 'null'] },
    },
  },
  ArchivedArtifact: {
    type: 'object', required: ['id', 'sousDossier', 'fichier'],
    properties: {
      id: { type: 'string' }, sousDossier: { type: 'string', enum: ['intents', 'specs'] },
      fichier: { type: 'string' }, archivedAt: { type: ['string', 'null'], format: 'date-time' },
      archivedBy: { type: ['string', 'null'] }, archivedReason: { type: ['string', 'null'] },
    },
  },
  // (#358) `recent` (10 derniers événements exécution hook) manquait — exposé
  // par `aiad-sdd hook-stats --json` (lib/hook-sandbox.js#afficherStats).
  HookStats: {
    type: 'object',
    description: 'Statistiques santé du hook pre-commit AIAD (latency p50/p95, fail rate, timeouts, scope-leaks).',
    required: ['stats', 'recent'],
    properties: {
      stats: {
        type: 'object',
        required: ['count', 'p50', 'p95', 'max', 'ratioFail', 'timeouts', 'scopeLeaks', 'sante'],
        properties: {
          count: { type: 'integer' },
          p50: { type: 'integer' },
          p95: { type: 'integer' },
          max: { type: 'integer' },
          ratioFail: { type: 'number' },
          timeouts: { type: 'integer' },
          scopeLeaks: { type: 'integer' },
          sante: { type: 'string', enum: ['verte', 'attention', 'critique', 'inconnue'] },
        },
      },
      recent: { type: 'array', items: { type: 'object', properties: {
        ts: { type: 'string', format: 'date-time' }, durationMs: { type: 'integer' },
        exitCode: { type: 'integer' }, timedOut: { type: 'boolean' },
        scopeLeaks: { type: 'array', items: { type: 'string' } },
      } } },
    },
  },
  ReflectAxis: {
    type: 'object', required: ['titre', 'observation', 'recommandation', 'priorite'],
    properties: {
      titre: { type: 'string' }, observation: { type: 'string' }, recommandation: { type: 'string' },
      priorite: { type: 'string', enum: ['haute', 'moyenne', 'basse'] },
    },
  },
  WebhookSubscription: {
    type: 'object', properties: {
      url: { type: 'string', format: 'uri' }, events: { type: 'array', items: { type: 'string' } },
      secret: { type: 'string' }, headers: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },
  // (#436) DryRunPathResult — partagé par rbac init + dinum publiccode + dinum franceconnect.
  DryRunPathResult: { type: 'object', required: ['path', 'dryRun'], properties: { path: { type: 'string' }, dryRun: { type: 'boolean' } } },
  // (#433) ReviewCommentPayload — partagé par gitlab review + bitbucket pr + azure pr.
  ReviewCommentPayload: { type: 'object', required: ['dryRun', 'body'], properties: { dryRun: { type: 'boolean' }, body: { type: 'string' } } },
  // (#432) FileDiff — partagé par review intents/specs.
  FileDiff: {
    type: 'object', properties: {
      added: { type: 'array', items: { type: 'string' } }, modified: { type: 'array', items: { type: 'string' } }, deleted: { type: 'array', items: { type: 'string' } }, unchanged: { type: 'array', items: { type: 'string' } },
    },
  },
  // (#417) WebhooksEmission — partagé par webhooks test + webhooks emit.
  WebhooksEmission: {
    type: 'object', required: ['event', 'deliveries'], properties: {
      event: { type: 'object', required: ['id', 'type', 'occurredAt'], properties: {
        id: { type: 'string', format: 'uuid' }, type: { type: 'string' }, occurredAt: { type: 'string', format: 'date-time' }, source: { type: 'string' }, data: { type: 'object' },
      } },
      deliveries: { type: 'array', items: { type: 'object', required: ['url', 'ok'], properties: { url: { type: 'string', format: 'uri' }, ok: { type: 'boolean' }, status: { type: 'integer' }, raison: { type: 'string' }, dryRun: { type: 'boolean' } } } },
    },
  },
  // (#361) Sous-objets détaillés — auparavant `{ type: 'object' }` génériques.
  // 4 dimensions de leadership AIAD (lib/leadership-metrics.js) calculées
  // séparément avec ratios distincts. `ratio` peut être null si numerateur
  // est 0 (division by zero évitée).
  LeadershipMetrics: {
    type: 'object', properties: {
      humanAuthorshipRatio: { type: 'object', properties: { total: { type: 'integer' }, sufficient: { type: 'integer' }, ratio: { type: ['number', 'null'] }, seuilCharsMinimum: { type: 'integer' } } },
      governanceCoverage: { type: 'object', properties: { sensitiveFiles: { type: 'integer' }, governedFiles: { type: 'integer' }, ratio: { type: ['number', 'null'] } } },
      traceCompleteness: { type: 'object', properties: { total: { type: 'integer' }, complete: { type: 'integer' }, ratio: { type: ['number', 'null'] } } },
      langueArtefacts: { type: 'object', properties: { fr: { type: 'integer' }, en: { type: 'integer' }, mixed: { type: 'integer' }, neutral: { type: 'integer' }, total: { type: 'integer' } } },
    },
  },
  // JnspVerdict — Cf. AGENTS.md section « INCERTITUDE ». jnsp ≠ FAIL (exit 2 vs exit 1).
  JnspVerdict: {
    type: 'object', required: ['verdict'],
    properties: {
      verdict: { type: 'string', enum: ['pass', 'fail', 'jnsp'] }, motif: { type: 'string' }, question: { type: 'string' }, contexte: { type: 'object' },
    },
  },
};

// ─── Construction OpenAPI 3.1 ──────────────────────────────────────────────

function lireVersionPkg() {
  const path = join(__dirname, '..', 'package.json');
  if (!existsSync(path)) return 'unknown';
  try { return JSON.parse(readFileSync(path, 'utf-8')).version || 'unknown'; }
  catch { return 'unknown'; }
}

/**
 * Construit le document OpenAPI 3.1 complet depuis le CATALOGUE.
 *
 * @param {{ info?: object, catalogue?: object, components?: object }} [options]
 */
export function construireOpenApi(options = {}) {
  const catalogue = options.catalogue || CATALOGUE;
  const components = options.components || COMPONENT_SCHEMAS;
  const version = lireVersionPkg();

  // (#273 follow-up #274) Wrap chaque schéma avec `_meta` requis via `allOf`.
  // Approche non-intrusive : ne mute pas le CATALOGUE source, ajoute la
  // contrainte à la composition. Permet à un codegen OpenAPI typé de
  // refuser un payload sans _meta.
  const metaWrapper = {
    type: 'object',
    required: ['_meta'],
    properties: { _meta: { $ref: '#/components/schemas/AiadMeta' } },
  };
  const paths = {};
  for (const [cmd, meta] of Object.entries(catalogue)) {
    const path = '/cli/' + cmd.replace(/\s+/g, '/');
    // Le schéma final combine `_meta` requis + le schéma spécifique de la
    // commande. Si meta.schema est un $ref, on l'agrège dans allOf ;
    // sinon (objet inline), même traitement.
    const schemaComposite = { allOf: [metaWrapper, meta.schema] };
    paths[path] = {
      get: {
        summary: meta.summary,
        operationId: 'cli_' + cmd.replace(/\W+/g, '_'),
        tags: ['cli'],
        description: `Sortie de la commande \`aiad-sdd ${cmd} --json\`.\n\nCette route est **fictive** — utilisée uniquement pour documenter la forme JSON via OpenAPI. La commande s'exécute via le CLI local.\n\nLe payload contient toujours un bloc \`_meta\` (cf. #258) en tête, permettant au consumer de discriminer la source via \`_meta.schema\`.`,
        responses: {
          200: {
            description: meta.summary,
            content: {
              'application/json': {
                schema: schemaComposite,
                ...(meta.example ? { example: meta.example } : {}),
              },
            },
          },
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'AIAD SDD — CLI JSON outputs',
      version,
      description: [
        'Documentation des sorties `--json` du CLI `aiad-sdd`.',
        '',
        'Permet l\'intégration par des consommateurs externes (ServiceNow,',
        'dashboards custom, pipelines analytics).',
        '',
        'Les routes sont **fictives** : chaque endpoint modélise la forme',
        'JSON retournée par `aiad-sdd <command> --json`.',
        '',
        'Documentation : https://aiad.ovh/cli-schema',
      ].join('\n'),
      contact: {
        name: 'AIAD',
        url: 'https://aiad.ovh',
      },
      license: { name: 'MIT' },
      ...(options.info || {}),
    },
    paths,
    components: { schemas: components },
    tags: [{ name: 'cli', description: 'Commandes CLI AIAD SDD' }],
  };
}

// ─── Validation minimale ──────────────────────────────────────────────────

/**
 * Valide la structure minimale d'un document OpenAPI 3.1 généré.
 *
 * @returns {{ valid: boolean, raisons: string[] }}
 */
export function validerOpenApi(doc) {
  const raisons = [];
  if (!doc || typeof doc !== 'object') return { valid: false, raisons: ['doc invalide'] };
  if (doc.openapi !== '3.1.0') raisons.push('openapi doit être "3.1.0"');
  if (!doc.info || !doc.info.title || !doc.info.version) raisons.push('info.{title,version} requis');
  if (!doc.paths || Object.keys(doc.paths).length === 0) raisons.push('paths vide');
  if (!doc.components || !doc.components.schemas) raisons.push('components.schemas requis');
  for (const [p, op] of Object.entries(doc.paths || {})) {
    if (!op.get || !op.get.responses || !op.get.responses['200']) {
      raisons.push(`${p} : opération GET 200 manquante`);
    }
  }
  return { valid: raisons.length === 0, raisons };
}

// ─── Pipeline CLI ──────────────────────────────────────────────────────────

/**
 * Génère le schéma et l'écrit (yaml/json).
 *
 * @param {string} racine
 * @param {{ out?: string, format?: 'yaml'|'json', dryRun?: boolean, json?: boolean }} [options]
 */
export function genererSchema(racine, options = {}) {
  const format = options.format === 'json' ? 'json' : 'yaml';
  const doc = construireOpenApi();
  const contenu = format === 'json'
    ? JSON.stringify(doc, null, 2) + '\n'
    : versYaml(doc) + '\n';

  const ext = format === 'json' ? '.json' : '.yaml';
  const outRel = options.out || `.aiad/schema/cli-openapi${ext}`;
  const outAbs = join(racine, outRel);

  if (!options.dryRun) {
    if (!existsSync(dirname(outAbs))) mkdirSync(dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, contenu, 'utf-8');
  }

  if (options.json) {
    process.stdout.write(JSON.stringify({
      path: outRel,
      format,
      paths: Object.keys(doc.paths).length,
      schemas: Object.keys(doc.components.schemas).length,
      dryRun: Boolean(options.dryRun),
    }, null, 2) + '\n');
    return { path: outAbs, doc };
  }

  console.log(`\n  ✓ Schéma OpenAPI 3.1 généré : ${Object.keys(doc.paths).length} routes, ${Object.keys(doc.components.schemas).length} schemas.`);
  console.log(`  ${options.dryRun ? '(dry-run, non écrit)' : `Écrit dans ${outRel}`}\n`);
  return { path: outAbs, doc };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  construireOpenApi as buildOpenApi,
  validerOpenApi as validateOpenApi,
  genererSchema as generateSchema,
};

export const CONSTANTS = {
  CATALOGUE_KEYS: Object.keys(CATALOGUE),
  COMPONENTS_KEYS: Object.keys(COMPONENT_SCHEMAS),
};
