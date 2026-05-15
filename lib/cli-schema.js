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
  status: {
    summary: 'État du projet SDD',
    // (#363) Schema refactor vers vraie shape (lib/status.js).
    schema: { type: 'object', required: ['initialise', 'projetDir'], properties: {
      initialise: { type: 'boolean' }, projetDir: { type: 'string' },
      fondamentaux: { type: 'object', additionalProperties: { type: 'object', properties: {
        present: { type: 'boolean' }, rempli: { type: 'boolean' },
      } } },
      cycle: { type: 'object', properties: { intents: { type: 'integer' }, specs: { type: 'integer' } } },
      infrastructure: { type: 'object', properties: {
        claudeMd: { type: 'boolean' }, commands: { type: 'boolean' }, gouvernanceCount: { type: 'integer' },
      } },
      maturite: { type: 'object', properties: {
        score: { type: 'integer' }, total: { type: 'integer' }, label: { type: 'string' },
      } },
      santeGlobale: { type: ['object', 'null'] },
      publicationContext: { $ref: '#/components/schemas/PublicationContext' },
    } },
  },
  doctor: {
    summary: 'Diagnostic complet du projet',
    // (#364) Schema complété : racine, santeGlobale (#218), version (CLI).
    schema: { type: 'object', required: ['ok', 'version', 'racine', 'checks'], properties: {
      ok: { type: 'boolean' }, version: { type: 'string' }, racine: { type: 'string' },
      checks: { type: 'array', items: { type: 'object', properties: {
        id: { type: 'string' }, ok: { type: 'boolean' }, message: { type: 'string' },
        severity: { type: ['string', 'null'], enum: ['warn', 'info', null] },
      } } },
      leadership: { $ref: '#/components/schemas/LeadershipMetrics' },
      santeGlobale: { type: ['object', 'null'] },
      publicationContext: { $ref: '#/components/schemas/PublicationContext' },
      santeStrictFail: { type: 'object', properties: { seuil: { type: 'integer' }, score: { type: 'integer' } } },
    } },
  },
  trace: {
    summary: 'Matrice de traçabilité Intent ↔ SPEC ↔ Code ↔ Tests',
    schema: { $ref: '#/components/schemas/TraceabilityMatrix' },
  },
  sbom: {
    summary: 'Software Bill of Materials CycloneDX v1.5',
    schema: { $ref: '#/components/schemas/CycloneDxSbom' },
  },
  dpia: {
    summary: 'AIPD pré-remplie (Article 35 RGPD)',
    // (#362) Schema corrigé vs ancienne version (déclarait `path, sections`
    // fields qui n'existent pas runtime). Vraie shape : lib/dpia.js#L362.
    schema: { type: 'object', required: ['date', 'project'], properties: {
      date: { type: 'string', format: 'date' },
      project: { type: 'object', properties: { name: { type: 'string' }, version: { type: 'string' } } },
      specs: { type: 'array', items: { type: 'object', properties: {
        id: { type: 'string' }, title: { type: 'string' },
        status: { type: 'string' }, parent_intent: { type: ['string', 'null'] },
      } } },
      code: { type: 'array', items: { type: 'object', properties: {
        path: { type: 'string' }, isTest: { type: 'boolean' }, specs: { type: 'array', items: { type: 'string' } },
      } } },
      agent: { type: 'object', properties: { installed: { type: 'boolean' }, refConstitutionnel: { type: 'string' } } },
      summary: { type: ['object', 'null' ] },
    } },
  },
  sovereignty: {
    summary: 'Score EU Sovereignty composite (5 dimensions)',
    schema: { $ref: '#/components/schemas/SovereigntyScore' },
  },
  adrs: {
    summary: 'Architecture Decision Records extraits de .aiad/ARCHITECTURE.md',
    schema: { type: 'object', required: ['fichier', 'total', 'entrees'], properties: {
      fichier: { type: ['string', 'null'] }, total: { type: 'integer' },
      entrees: { type: 'array', items: { type: 'object', required: ['id', 'titre', 'ligne'], properties: {
        id: { type: 'string' }, titre: { type: 'string' }, section: { type: ['string', 'null'] },
        ligne: { type: 'integer' }, corps: { type: 'string' },
      } } },
    } },
  },
  sla: {
    summary: 'Matrice SLA (versions supportées + politique)',
    schema: { $ref: '#/components/schemas/SlaMatrix' },
  },
  'audit log': {
    summary: 'Log audit trail crypto-signé',
    schema: {
      type: 'object',
      required: ['total', 'events'],
      properties: {
        total: { type: 'integer' },
        events: { type: 'array', items: { $ref: '#/components/schemas/AuditEvent' } },
      },
    },
  },
  'audit verify': {
    summary: 'Vérification de la chaîne audit (intégrité + signatures)',
    schema: { type: 'object', required: ['valid'], properties: {
      valid: { type: 'boolean' },
      raisons: { type: 'array', items: { type: 'string' } },
      indexCassures: { type: 'array', items: { type: 'integer' } },
    } },
  },
  'archive --list': {
    summary: 'Liste des artefacts archivés',
    schema: { type: 'object', required: ['total', 'archives'], properties: {
      total: { type: 'integer' },
      archives: { type: 'array', items: { $ref: '#/components/schemas/ArchivedArtifact' } },
    }
    },
  },
  'hook-stats': {
    summary: 'Métriques du hook pre-commit (p50/p95/timeouts)',
    schema: { $ref: '#/components/schemas/HookStats' },
  },
  'pii-scan': {
    summary: 'Détection de PII dans Intents/SPECs',
    schema: { type: 'object', required: ['mode', 'files', 'findings'], properties: {
      mode: { type: 'string', enum: ['block', 'warn', 'off'] }, files: { type: 'integer' },
      findings: { type: 'integer' }, byFile: { type: 'object', additionalProperties: { type: 'array' } },
    } },
  },
  reflect: {
    summary: 'Rétrospective sprint via Ollama (3-5 axes)',
    schema: {
      type: 'object',
      required: ['axes'],
      properties: {
        since: { type: 'string', format: 'date-time' },
        axes: { type: 'array', items: { $ref: '#/components/schemas/ReflectAxis' } },
        // (#359) Early-return path : pas d'artefact dans la fenêtre →
        // `{ axes: [], raison: 'aucun artefact dans la fenêtre' }`.
        raison: { type: 'string', description: 'Présent ssi axes vides (e.g. "aucun artefact dans la fenêtre").' },
      },
    },
  },
  'webhooks list': {
    summary: 'Liste des souscriptions webhooks',
    schema: {
      type: 'object',
      properties: {
        subscriptions: { type: 'array', items: { $ref: '#/components/schemas/WebhookSubscription' } },
      },
    },
  },
  'offline status': {
    summary: 'Statut du mode air-gapped',
    schema: {
      type: 'object',
      required: ['offline'],
      properties: {
        offline: { type: 'boolean' },
        env: { type: ['string', 'null'] },
        allowlist: { type: 'array', items: { type: 'string' } },
        attempts: { type: 'integer' },
        recent: { type: 'array' },
      },
    },
  },
  // (#372) dashboard --check : valide collect+render sans écrire fichiers.
  'dashboard check': {
    summary: 'Mode --check : valide collect+render sans écrire (exit 1 si erreur)',
    schema: {
      type: 'object',
      required: ['ok', 'errors', 'pages'],
      properties: {
        ok: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
        pages: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  // (#385) bench --json : métriques taille commandes slash (routers v1.7).
  bench: {
    summary: 'Métriques taille commandes slash (avant/transition/après routers v1.7)',
    schema: { type: 'object', properties: {
      avantBytes: { type: 'integer' }, transitionBytes: { type: 'integer' }, apresBytes: { type: 'integer' },
      avantTokens: { type: 'integer' }, transitionTokens: { type: 'integer' }, apresTokens: { type: 'integer' },
      reductionFinalePct: { type: 'integer' }, reductionTransitionPct: { type: 'integer' }, charsPerToken: { type: 'number' },
      routers: { type: 'object' }, alias: { type: 'object' }, subSdd: { type: 'object' }, subAiad: { type: 'object' },
    } },
  },
  // (#367) ci-template list — dernière route enum AiadMeta sans doc.
  'ci-template list': {
    summary: 'Liste des templates CI/CD AIAD (6 forges)',
    schema: { type: 'object', required: ['forges'], properties: {
      forges: { type: 'array', items: { type: 'object', properties: {
        id: { type: 'string', enum: ['github', 'gitlab', 'jenkins', 'drone', 'bitbucket', 'azure'] },
        label: { type: 'string' }, source: { type: 'string' }, cible: { type: 'string' }, description: { type: 'string' },
      } } },
    } },
  },
  // (#366) Standup — 2 routes (single lens vs --all).
  standup: {
    summary: 'URL Kanban focus-mode (single lens : all|pm|pe|ae|qa|tl)',
    schema: { type: 'object', required: ['lens', 'focus', 'relative', 'absolute', 'exists'], properties: {
      lens: { type: 'string', enum: ['all', 'pm', 'pe', 'ae', 'qa', 'tl'] },
      focus: { type: 'boolean' }, relative: { type: 'string' },
      absolute: { type: 'string' }, exists: { type: 'boolean' },
      stale: { type: 'object', description: 'Présent ssi kanban.html plus ancien que .aiad/.' },
    } },
  },
  'standup all': {
    summary: 'URLs Kanban focus-mode pour les 5 rôles (PM/PE/AE/QA/TL)',
    schema: { type: 'object', required: ['liens'], properties: {
      liens: { type: 'array', items: { type: 'object', properties: {
        lens: { type: 'string', enum: ['pm', 'pe', 'ae', 'qa', 'tl'] },
        focus: { type: 'boolean' }, relative: { type: 'string' },
        absolute: { type: 'string' }, exists: { type: 'boolean' },
      } } },
      stale: { type: 'object' },
    } },
  },
  // (#365) Routes dora record / import-git.
  'dora record': {
    summary: 'Enregistre un déploiement DORA',
    schema: { type: 'object', required: ['date', 'file', 'status'], properties: {
      date: { type: 'string', format: 'date' }, file: { type: 'string' },
      nn: { type: 'integer' }, nom: { type: 'string' },
      status: { type: 'string', enum: ['success', 'hotfix', 'failed'] },
    } },
  },
  'dora import-git': {
    summary: 'Importe les tags Git comme déploiements DORA',
    // (#380) items shape complète : file, nom, date, nn, status, tag.
    schema: { type: 'object', required: ['imported'], properties: {
      imported: { type: 'array', items: { type: 'object', properties: {
        file: { type: 'string' }, nom: { type: 'string' },
        date: { type: 'string', format: 'date' }, nn: { type: 'string' },
        status: { type: 'string', enum: ['success', 'hotfix', 'failed'] }, tag: { type: 'string' },
      } } },
    } },
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
    schema: { type: 'object', required: ['optIn'], properties: {
      optIn: { type: 'boolean' },
      anonymousId: { type: ['string', 'null'] },
      since: { type: ['string', 'null'], format: 'date-time' },
      endpoint: { type: ['string', 'null'] },
      localLog: { type: ['string', 'null'] },
    } },
  },
  // (#397) plugin list — plugins AIAD installés dans .aiad/plugins/.
  'plugin list': {
    summary: 'Liste des plugins AIAD installés (.aiad/plugins/)',
    schema: { type: 'object', required: ['total', 'plugins'], properties: {
      total: { type: 'integer' },
      plugins: { type: 'array', items: { type: 'object', required: ['name'], properties: {
        name: { type: 'string' }, version: { type: 'string' }, source: { type: 'string' },
        commands: { type: 'array', items: { type: 'string' } },
        specTemplates: { type: 'array', items: { type: 'string' } },
        hooks: { type: 'array', items: { type: 'string' } },
      } } },
    } },
  },
  // (#412) tutorial — liste des 4 tutoriels spécialisés AIAD.
  'tutorial': {
    summary: 'Liste des tutoriels AIAD spécialisés par domaine (auth-oidc, payment-pci, rag-llm, gdpr-data-export)',
    schema: { type: 'object', required: ['tutoriels'], properties: {
      tutoriels: { type: 'array', items: { type: 'object', required: ['id', 'title', 'specDomain'], properties: {
        id: { type: 'string' }, title: { type: 'string' }, specDomain: { type: 'string' },
      } } },
    } },
  },
  // (#411) badge — génère SVG badge README santé/maturité/violations.
  'badge': {
    summary: 'Génère SVG badge README (style shields.io) — santé/maturité/violations',
    schema: { type: 'object', required: ['type', 'bytes'], properties: {
      type: { type: 'string', enum: ['sante', 'maturite', 'violations'] },
      path: { type: ['string', 'null'] }, message: { type: ['string', 'null'] },
      score: { type: ['integer', 'null'] }, niveau: { type: ['string', 'null'] },
      bytes: { type: 'integer' },
    } },
  },
  // (#410) sla update — injecte/met à jour le bloc SLA dans SECURITY.md.
  'sla update': {
    summary: 'Met à jour SECURITY.md avec la matrice SLA (dry-run par défaut)',
    schema: { type: 'object', required: ['action', 'path', 'versions', 'dryRun'], properties: {
      action: { type: 'string', enum: ['created', 'updated', 'appended'] },
      path: { type: 'string' }, versions: { type: 'integer' }, dryRun: { type: 'boolean' },
    } },
  },
  // (#409) sla check — vérifie cohérence SLA matrix (patchWindows + versions).
  'sla check': {
    summary: 'Vérifie cohérence SLA matrix (patchWindows complète, versions classées)',
    schema: { type: 'object', required: ['matrice', 'validation'], properties: {
      matrice: { $ref: '#/components/schemas/SlaMatrix' },
      validation: { type: 'object', required: ['valid', 'issues'], properties: {
        valid: { type: 'boolean' }, issues: { type: 'array', items: { type: 'string' } },
      } },
    } },
  },
  // (#407) audit append — enregistre événement audit (crypto-signé via hashChain).
  'audit append': {
    summary: 'Enregistre un événement audit (created|modified|deleted|imported|archived)',
    schema: { $ref: '#/components/schemas/AuditEvent' },
  },
  // (#406) webhooks test — émet un événement de test (dry-run + delivery report).
  'webhooks test': {
    summary: 'Émet un événement webhook de test (dry-run + delivery report)',
    schema: { type: 'object', required: ['event', 'deliveries'], properties: {
      event: { type: 'object', required: ['id', 'type', 'occurredAt'], properties: {
        id: { type: 'string', format: 'uuid' }, type: { type: 'string' },
        occurredAt: { type: 'string', format: 'date-time' },
        source: { type: 'string' }, data: { type: 'object' },
      } },
      deliveries: { type: 'array', items: { type: 'object', required: ['url', 'ok'], properties: {
        url: { type: 'string', format: 'uri' }, ok: { type: 'boolean' },
        status: { type: 'integer' }, raison: { type: 'string' }, dryRun: { type: 'boolean' },
      } } },
    } },
  },
  // (#405) tour — guided tour AIAD (créé .aiad-tour/ avec Intent+SPEC+Gate démo).
  'tour': {
    summary: 'Guided tour AIAD — créé .aiad-tour/ avec Intent+SPEC+Gate démo',
    schema: { type: 'object', required: ['dir', 'intent', 'spec', 'gateScore', 'gateValid', 'fichiers'], properties: {
      dir: { type: 'string' }, intent: { type: 'string' }, spec: { type: 'string' },
      gateScore: { type: 'integer' }, gateValid: { type: 'boolean' },
      fichiers: { type: 'array', items: { type: 'string' } },
    } },
  },
  // (#404) schema — méta-route : compte des paths/schemas OpenAPI générés.
  'schema': {
    summary: 'Génère et compte les paths/schemas OpenAPI 3.1 du CLI',
    schema: { type: 'object', required: ['path', 'format', 'paths', 'schemas', 'dryRun'], properties: {
      path: { type: 'string' },
      format: { type: 'string', enum: ['json', 'yaml'] },
      paths: { type: 'integer' }, schemas: { type: 'integer' }, dryRun: { type: 'boolean' },
    } },
  },
  // (#403) doctor --fix — application automatique de fixes sains.
  'doctor --fix': {
    summary: 'Application automatique de fixes santé sûrs (catégorie blanche)',
    schema: { type: 'object', required: ['detected', 'applied', 'dryRun', 'fixes'], properties: {
      detected: { type: 'integer' }, applied: { type: 'integer' }, dryRun: { type: 'boolean' },
      fixes: { type: 'array', items: { type: 'object', required: ['kind', 'path'], properties: {
        kind: { type: 'string', enum: ['create-directory', 'create-index', 'add-frontmatter'] },
        path: { type: 'string' }, label: { type: 'string' },
        content: { type: 'string' }, file: { type: 'string' },
        applied: { type: 'boolean' }, message: { type: 'string' },
      } } },
    } },
  },
  // (#402) org check — conformité projet vs policies org-wide.
  'org check': {
    summary: 'Vérification conformité projet vs config org-wide',
    schema: { type: 'object', required: ['valid'], properties: {
      valid: { type: 'boolean' },
      raison: { type: 'string', enum: ['no-org-config'] },
      source: { type: 'string' }, strict: { type: 'boolean' },
      violations: { type: 'array', items: { type: 'object', required: ['rule', 'message'], properties: {
        rule: { type: 'string' }, message: { type: 'string' },
      } } },
    } },
  },
  // (#401) org show — config org-wide effective (.aiad/org.yml).
  'org show': {
    summary: 'Config org-wide effective (.aiad/org.yml ou héritage)',
    schema: { type: 'object', required: ['source', 'config'], properties: {
      source: { type: ['string', 'null'] },
      config: { type: ['object', 'null'], additionalProperties: true },
    } },
  },
  // (#400) skills validate — validation .claude/skills/ frontmatter + body.
  'skills validate': {
    summary: 'Validation des skills .claude/skills/ (frontmatter + body sanity)',
    schema: { type: 'object', required: ['ok', 'total', 'valid', 'results'], properties: {
      ok: { type: 'boolean' }, total: { type: 'integer' }, valid: { type: 'integer' },
      results: { type: 'array', items: { type: 'object', required: ['path', 'name', 'ok'], properties: {
        path: { type: 'string' }, name: { type: 'string' }, ok: { type: 'boolean' },
        raisons: { type: 'array', items: { type: 'string' } },
      } } },
    } },
  },
  // (#399) rbac check — validation owner/reviewers sur artefacts stagés.
  'rbac check': {
    summary: 'Validation RBAC owner/reviewers sur artefacts stagés',
    schema: { type: 'object', required: ['valid', 'violations', 'stages'], properties: {
      valid: { type: 'boolean' },
      violations: { type: 'array', items: { type: 'object', properties: {
        fichier: { type: 'string' }, raison: { type: 'string' },
      } } },
      stages: { type: 'integer' },
    } },
  },
  // (#396) rbac whoami — identité git + équipes RBAC du dev courant.
  'rbac whoami': {
    summary: 'Identité git + équipes RBAC du dev courant',
    schema: { type: 'object', required: ['email', 'teams'], properties: {
      email: { type: ['string', 'null'] },
      teams: { type: 'array', items: { type: 'string' } },
    } },
  },
  // (#395) ai-act audit — Annexe IV Règlement (UE) 2024/1689 (EU AI Act).
  'ai-act audit': {
    summary: 'Audit IA Act EU (Annexe IV Règlement 2024/1689) — pré-remplissage',
    schema: { type: 'object', required: ['projet', 'specs', 'code', 'agent', 'dateAudit'], properties: {
      projet: { type: 'object', additionalProperties: true },
      specs: { type: 'array', items: { type: 'object', required: ['id'], properties: {
        id: { type: 'string' }, title: { type: 'string' },
        status: { type: 'string' }, parent_intent: { type: ['string', 'null'] },
      } } },
      code: { type: 'array', items: { type: 'object', required: ['path'], properties: {
        path: { type: 'string' }, isTest: { type: 'boolean' },
        specs: { type: 'array', items: { type: 'string' } },
      } } },
      agent: { type: 'boolean' }, dateAudit: { type: 'string', format: 'date' },
      summary: { type: 'object', properties: {
        intents: { type: 'integer' }, specs: { type: 'integer' }, codeFiles: { type: 'integer' },
        annotatedCodeFiles: { type: 'integer' }, testFiles: { type: 'integer' }, annotatedTestFiles: { type: 'integer' },
      } },
    } },
  },
  // (#394) migrate-v2 — squelette de migration AIAD v1 → v2.
  'migrate-v2': {
    summary: 'Migration AIAD v1 → v2 (dry-run par défaut, --apply pour exécuter)',
    schema: { type: 'object', required: ['ok', 'message', 'detection', 'plan', 'appliquees', 'erreurs'], properties: {
      ok: { type: 'boolean' }, mode: { type: 'string', enum: ['dry-run', 'apply'] },
      raison: { type: 'string' }, message: { type: 'string' },
      detection: { type: 'object', required: ['exists'], properties: {
        exists: { type: 'boolean' }, version: { type: ['string', 'null'] },
        marqueurs: { type: 'array', items: { type: 'string' } }, fichiers: { type: 'integer' },
      } },
      plan: { type: 'array', items: { type: 'object', required: ['id', 'titre'], properties: {
        id: { type: 'string' }, titre: { type: 'string' }, diff: { type: 'array' },
      } } },
      appliquees: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, dureeMs: { type: 'integer' } } } },
      erreurs: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, raison: { type: 'string' }, message: { type: 'string' } } } },
      backup: { type: ['object', 'null'] }, rollback: { type: ['object', 'null'] }, prune: { type: ['object', 'null'] },
    } },
  },
  // (#393) dinum check — kit Commun Numérique de l'État FR (code.gouv.fr).
  'dinum check': {
    summary: 'Score Commun Numérique de l\'État FR (9 critères, code.gouv.fr)',
    schema: { type: 'object', required: ['score', 'reussis', 'total', 'criteres'], properties: {
      score: { type: 'integer', minimum: 0, maximum: 100 },
      reussis: { type: 'integer' }, total: { type: 'integer' },
      criteres: { type: 'array', items: { type: 'object', required: ['critere', 'label', 'ok'], properties: {
        critere: { type: 'string' }, label: { type: 'string' }, ok: { type: 'boolean' },
      } } },
    } },
  },
  // (#392) self-update — comparaison version locale vs registry npm.
  'self-update': {
    summary: 'Vérification mise à jour npm (registry vs version locale)',
    schema: { type: 'object', required: ['locale', 'status'], properties: {
      locale: { type: 'string' }, distante: { type: ['string', 'null'] },
      status: { type: 'string', enum: ['up-to-date', 'update-available', 'ahead', 'unknown'] },
      action: { type: ['string', 'null'] }, error: { type: 'string' },
    } },
  },
  // (#390) gouvernance lint — vérifie cohérence des références agents AIAD.
  'gouvernance lint': {
    summary: 'Lint cohérence des références gouvernance (conflits, doublons, manquants)',
    schema: { type: 'object', required: ['ok'], properties: {
      ok: { type: 'boolean' },
      agents: { type: 'array', items: { type: 'string' } },
      conflits: { type: 'array', items: { type: 'object' } },
      doublons: { type: 'array', items: { type: 'object' } },
      manquants: { type: 'array', items: { type: 'object', properties: {
        agent: { type: 'string' },
        references: { type: 'array', items: { type: 'string' } },
      } } },
    } },
  },
  // (#389) workspace trace — agrège construireMatrice() par sous-projet.
  'workspace trace': {
    summary: 'Workspace multi-projet — agrégation trace() par sous-projet',
    schema: { type: 'object', required: ['reports', 'summary'], properties: {
      workspace: { type: 'object' },
      reports: { type: 'array', items: { type: 'object', required: ['name', 'path', 'status'], properties: {
        name: { type: 'string' }, path: { type: 'string' },
        status: { type: 'string', enum: ['analyzed', 'skipped', 'error'] },
        ok: { type: 'boolean' }, matrix: { $ref: '#/components/schemas/TraceabilityMatrix' },
      } } },
      summary: { type: 'object', properties: {
        total: { type: 'integer' }, analyzed: { type: 'integer' },
        skipped: { type: 'integer' }, errored: { type: 'integer' }, healthy: { type: 'integer' },
        totals: { type: 'object', properties: { intents: { type: 'integer' }, specs: { type: 'integer' }, gaps: { type: 'integer' } } },
      } },
    } },
  },
  // (#386) workspace analytics — agrégation cross-org pour ESN/grand groupe.
  'workspace analytics': {
    summary: 'Workspace multi-projet — analytics (sovereignty, velocity, drift cross-org)',
    schema: { type: 'object', required: ['workspace', 'projets', 'analytics'], properties: {
      workspace: { type: 'object' },
      projets: { type: 'array', items: { type: 'object', properties: {
        name: { type: 'string' }, path: { type: 'string' }, exists: { type: 'boolean' },
        intents: { type: 'integer' }, specs: { type: 'integer' },
        sovereignty: { type: ['integer', 'null'] }, governance: { type: 'array', items: { type: 'string' } },
        velocite: { type: ['object', 'null'] }, driftCount: { type: 'integer' },
      } } },
      analytics: { type: 'object', properties: {
        total: { type: 'integer' }, available: { type: 'integer' },
        sovereignty: { type: 'object' }, juridictionsCouvertes: { type: 'array', items: { type: 'string' } },
        topAgents: { type: 'array', items: { type: 'object' } },
        topPacks: { type: 'array', items: { type: 'object' } },
        velocite: { type: 'object' }, driftRate: { type: 'number' },
      } },
    } },
  },
  'workspace doctor': {
    summary: 'Workspace multi-projet — agrégation doctor() par sous-projet',
    schema: { type: 'object', required: ['reports', 'summary'], properties: {
      workspace: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
      reports: { type: 'array', items: { type: 'object', required: ['name', 'path', 'status'], properties: {
        name: { type: 'string' }, path: { type: 'string' },
        status: { type: 'string', enum: ['analyzed', 'skipped', 'error'] },
        ok: { type: 'boolean' }, doctor: { type: 'object' },
        publicationContext: { $ref: '#/components/schemas/PublicationContext' },
        reason: { type: 'string' }, error: { type: 'string' },
      } } },
      summary: { type: 'object', properties: {
        total: { type: 'integer' }, analyzed: { type: 'integer' },
        skipped: { type: 'integer' }, errored: { type: 'integer' }, healthy: { type: 'integer' },
        totals: { type: 'object', properties: { intents: { type: 'integer' }, specs: { type: 'integer' }, gaps: { type: 'integer' } } },
      } },
    } },
  },
};

// ─── Schémas réutilisables (components) ────────────────────────────────────

export const COMPONENT_SCHEMAS = {
  // (#273) Bloc `_meta` partagé par toutes les sorties --json (#258).
  // Schémas distincts : aiad-sdd-{dashboard, brief, doctor, status,
  // workspace, trace, sovereignty, dora, hook-stats}. Le champ `schema`
  // sert de discriminator pour les consumers génériques.
  AiadMeta: {
    type: 'object',
    description: 'Métadonnées de provenance/version pour discriminer le type de payload AIAD. Présent en tête de toute sortie --json.',
    required: ['schema', 'version', 'generated'],
    properties: {
      schema: {
        type: 'string',
        description: 'Discriminator côté consumer.',
        enum: [
          'aiad-sdd-dashboard', 'aiad-sdd-dashboard-check', 'aiad-sdd-brief',
          'aiad-sdd-doctor', 'aiad-sdd-status', 'aiad-sdd-workspace',
          'aiad-sdd-trace', 'aiad-sdd-sovereignty', 'aiad-sdd-dora',
          'aiad-sdd-hook-stats', 'aiad-sdd-standup', 'aiad-sdd-adrs',
          'aiad-sdd-ci-template',
        ],
      },
      version: {
        type: 'string',
        description: 'Version SemVer du package aiad-sdd qui a produit le payload.',
        pattern: '^\\d+\\.\\d+\\.\\d+',
      },
      generated: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp ISO 8601 de la génération.',
      },
      action: {
        type: 'string',
        description: 'Sous-action quand le schema couvre plusieurs verbes (workspace doctor/trace/analytics, dora record/import-git).',
      },
      slim: {
        type: 'boolean',
        description: '(dashboard uniquement) `true` si listes tronquées (matrice.gaps.codeSansSpec → 100 entrées). `false` si --full.',
      },
      source: {
        type: 'object',
        description: '(brief uniquement) Référence au schema source dont brief est dérivé (= aiad-sdd-dashboard).',
        properties: {
          schema: { type: 'string' },
          slim: { type: 'boolean' },
        },
      },
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
  // (#361) Sous-objets détaillés — auparavant `{ type: 'object' }` génériques.
  // 4 dimensions de leadership AIAD (lib/leadership-metrics.js) calculées
  // séparément avec ratios distincts. `ratio` peut être null si numerateur
  // est 0 (division by zero évitée).
  LeadershipMetrics: {
    type: 'object',
    description: 'Métriques leadership AIAD : human authorship, governance, trace, langue.',
    properties: {
      humanAuthorshipRatio: { type: 'object', properties: {
        total: { type: 'integer' }, sufficient: { type: 'integer' },
        ratio: { type: ['number', 'null'] }, seuilCharsMinimum: { type: 'integer' },
      } },
      governanceCoverage: { type: 'object', properties: {
        sensitiveFiles: { type: 'integer' }, governedFiles: { type: 'integer' },
        ratio: { type: ['number', 'null'] },
      } },
      traceCompleteness: { type: 'object', properties: {
        total: { type: 'integer' }, complete: { type: 'integer' },
        ratio: { type: ['number', 'null'] },
      } },
      langueArtefacts: { type: 'object', properties: {
        fr: { type: 'integer' }, en: { type: 'integer' }, mixed: { type: 'integer' },
        neutral: { type: 'integer' }, total: { type: 'integer' },
      } },
    },
  },
  // Verdict réutilisable par toute commande --json qui peut répondre
  // "je ne sais pas". `jnsp` (alias `unknown`) signale qu'une décision
  // humaine est requise — distinct d'un échec PASS/FAIL. Le CLI sort en
  // exit 2 (vs 1 pour FAIL). Cf. AGENTS.md section « INCERTITUDE ».
  JnspVerdict: {
    type: 'object', required: ['verdict'],
    properties: {
      verdict: { type: 'string', enum: ['pass', 'fail', 'jnsp'] },
      motif: { type: 'string' }, question: { type: 'string' },
      contexte: { type: 'object' },
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
