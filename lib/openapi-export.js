// AIAD SDD Mode — Export OpenAPI 3.1 depuis SPECs marquées `api: true`.
//
// **Cas d'usage** : un projet AIAD a défini ses endpoints API via des SPECs
// (avec critères EARS observables : R1 WHEN /endpoint THEN response). Ce
// module produit un document **OpenAPI 3.1.0** consommable par Stoplight /
// Postman / redoc / @stoplight/spectral / API portails.
//
// **Convention frontmatter** :
//   ```yaml
//   ---
//   title: "Récupère un utilisateur par ID"
//   api: true
//   api_method: GET                     # ou api_methods: [GET, HEAD]
//   api_path: /users/{id}
//   api_tags: [users]
//   api_summary: "Récupère un utilisateur"     # défaut: title
//   api_request_schema: GetUserRequest          # référence components.schemas
//   api_response_status: 200
//   api_response_schema: User
//   governance: AIAD-RGPD
//   ---
//   ```
//
// Le **corps** de la SPEC (sans frontmatter) devient la `description` de
// l'opération — ce qui inclut les critères EARS R1, R2, ... directement
// lisibles dans Swagger UI.
//
// **Zero-dep** : sortie YAML générée à la main (pas de dépendance js-yaml).
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { syncFile } from './fs-ops.js';
import { C, log, logHeader } from './term.js';

// ─── Lecture des SPECs avec api: true ───────────────────────────────────────

/**
 * Liste les SPECs marquées comme exposant une API.
 *
 * @param {string} racine
 * @returns {{ id: string, path: string, frontmatter: object, body: string }[]}
 */
export function lireSpecsApi(racine) {
  const dir = join(racine, '.aiad', 'specs');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir)) {
    if (!nom.endsWith('.md') || nom.startsWith('_') || nom.startsWith('spec-ears-template')) continue;
    const m = nom.match(/^(SPEC-[A-Za-z0-9-]+)\.md$/);
    if (!m) continue;
    const path = join(dir, nom);
    try {
      const contenu = readFileSync(path, 'utf-8');
      const { data, body } = parseFrontmatter(contenu);
      if (data.api === true) {
        out.push({ id: m[1], path, frontmatter: data, body: body || '' });
      }
    } catch { /* ignore */ }
  }
  return out;
}

// ─── Fonctions pures (testables) ────────────────────────────────────────────

const METHODES_VALIDES = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

/**
 * Construit l'objet `paths` OpenAPI 3.1 depuis la liste des SPECs API.
 *
 * @param {object[]} specs
 * @returns {{ paths: object, warnings: string[] }}
 */
export function construirePaths(specs) {
  const paths = {};
  const warnings = [];

  for (const spec of specs) {
    const fm = spec.frontmatter;
    const apiPath = fm.api_path;
    if (typeof apiPath !== 'string' || apiPath.length === 0) {
      warnings.push(`${spec.id} : api_path manquant — ignoré.`);
      continue;
    }

    // Méthodes : api_methods[] ou api_method (string).
    let methodes = [];
    if (Array.isArray(fm.api_methods)) {
      methodes = fm.api_methods.map((s) => String(s).toLowerCase());
    } else if (typeof fm.api_method === 'string') {
      methodes = [fm.api_method.toLowerCase()];
    } else {
      warnings.push(`${spec.id} : api_method ou api_methods manquant — ignoré.`);
      continue;
    }

    // Validation des méthodes
    const invalides = methodes.filter((m) => !METHODES_VALIDES.has(m));
    if (invalides.length > 0) {
      warnings.push(`${spec.id} : méthode(s) invalide(s) ${invalides.join(', ')} — ignorées.`);
      methodes = methodes.filter((m) => METHODES_VALIDES.has(m));
      if (methodes.length === 0) continue;
    }

    if (!paths[apiPath]) paths[apiPath] = {};

    for (const methode of methodes) {
      paths[apiPath][methode] = construireOperation(spec);
    }
  }

  return { paths, warnings };
}

/**
 * Construit l'objet Operation OpenAPI pour une SPEC.
 */
export function construireOperation(spec) {
  const fm = spec.frontmatter;
  const op = {
    operationId: spec.id,
    summary: fm.api_summary || fm.title || spec.id,
    description: spec.body.trim() || `Voir la SPEC ${spec.id} pour les détails.`,
  };

  if (Array.isArray(fm.api_tags) && fm.api_tags.length > 0) {
    op.tags = fm.api_tags.map((t) => String(t));
  }

  // Request body schema
  if (fm.api_request_schema) {
    op.requestBody = {
      required: fm.api_request_required !== false,
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${fm.api_request_schema}` },
        },
      },
    };
  }

  // Responses
  const status = fm.api_response_status || 200;
  const responses = {};
  responses[String(status)] = {
    description: fm.api_response_description || 'Réponse réussie',
    ...(fm.api_response_schema
      ? {
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${fm.api_response_schema}` },
            },
          },
        }
      : {}),
  };
  // Erreurs additionnelles si déclarées
  if (Array.isArray(fm.api_error_statuses)) {
    for (const s of fm.api_error_statuses) {
      responses[String(s)] = { description: `Erreur ${s}` };
    }
  }
  op.responses = responses;

  // Tags gouvernance → x-governance (extension)
  if (fm.governance) {
    const govs = Array.isArray(fm.governance)
      ? fm.governance
      : String(fm.governance).split(',').map((s) => s.trim()).filter(Boolean);
    if (govs.length > 0) op['x-aiad-governance'] = govs;
  }

  return op;
}

/**
 * Construit le document OpenAPI 3.1.0 complet.
 *
 * @param {object[]} specs
 * @param {{ title?: string, version?: string, description?: string, server?: string }} [info]
 * @returns {{ doc: object, warnings: string[] }}
 */
export function construireOpenApiDoc(specs, info = {}) {
  const { paths, warnings } = construirePaths(specs);
  const doc = {
    openapi: '3.1.0',
    info: {
      title: info.title || 'API exportée depuis AIAD SDD',
      version: info.version || '0.1.0',
      description: info.description || `Document généré automatiquement depuis ${specs.length} SPEC(s) AIAD marquée(s) \`api: true\`.\n\nVoir le projet sur https://aiad.ovh`,
    },
    paths,
    components: {
      schemas: {
        // Schémas placeholder référencés mais non encore définis ; à compléter
        // par l'humain ou par un script post-export.
      },
    },
  };
  if (info.server) {
    doc.servers = [{ url: info.server }];
  }
  // Liste des $ref utilisés mais non définis → warning
  const refsUtilises = collecterRefs(doc.paths);
  if (refsUtilises.size > 0) {
    warnings.push(`${refsUtilises.size} schéma(s) référencé(s) sans définition : ${[...refsUtilises].slice(0, 10).join(', ')}${refsUtilises.size > 10 ? '…' : ''}. Ajoute components.schemas dans une étape de post-traitement.`);
  }
  return { doc, warnings };
}

function collecterRefs(paths) {
  const out = new Set();
  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (k === '$ref' && typeof v === 'string') {
        const m = v.match(/^#\/components\/schemas\/(.+)$/);
        if (m) out.add(m[1]);
      } else if (typeof v === 'object') walk(v);
    }
  };
  walk(paths);
  return out;
}

// ─── Sérialisation YAML zero-dep ────────────────────────────────────────────

/**
 * Sérialise un objet JS en YAML strict (sous-ensemble suffisant pour
 * OpenAPI 3.1). Limites : pas de tags YAML custom, pas d'ancres, pas de
 * blocs `|` ou `>`. Convient au document OpenAPI plat.
 *
 * @param {*} obj
 * @param {number} [niveau]
 * @returns {string}
 */
export function versYaml(obj, niveau = 0) {
  const indent = '  '.repeat(niveau);
  if (obj === null) return 'null';
  if (typeof obj === 'boolean' || typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') {
    // Quote si caractères spéciaux YAML ou commence par chiffre / vrai-faux
    if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(obj) && !['true', 'false', 'null', 'yes', 'no', 'on', 'off'].includes(obj.toLowerCase()) && obj.length > 0) {
      return obj;
    }
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return '\n' + obj.map((v) => `${indent}- ${versYaml(v, niveau + 1).replace(/^\n/, '')}`).join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    const lignes = entries.map(([k, v]) => {
      const keyStr = /^[A-Za-z_][A-Za-z0-9_-]*$/.test(k) ? k : JSON.stringify(k);
      const valYaml = versYaml(v, niveau + 1);
      if (valYaml.startsWith('\n')) {
        return `${indent}${keyStr}:${valYaml}`;
      }
      return `${indent}${keyStr}: ${valYaml}`;
    });
    return '\n' + lignes.join('\n');
  }
  return JSON.stringify(obj);
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Exécute l'export OpenAPI sur le projet courant.
 *
 * @param {string} racine
 * @param {{ out?: string, format?: 'yaml'|'json', dryRun?: boolean, json?: boolean, info?: object }} [options]
 * @returns {Promise<{ path: string|null, doc: object, warnings: string[] }>}
 */
export async function exporterOpenApi(racine, options = {}) {
  const { out, format = 'yaml', dryRun = false, json = false, info = {} } = options;

  if (!existsSync(join(racine, '.aiad'))) {
    throw new Error(`.aiad/ introuvable. Lance \`aiad-sdd init\` d'abord.`);
  }

  const specs = lireSpecsApi(racine);
  const { doc, warnings } = construireOpenApiDoc(specs, info);

  if (json) {
    process.stdout.write(JSON.stringify({ doc, warnings, specsCount: specs.length }, null, 2) + '\n');
    return { path: null, doc, warnings };
  }

  const ext = format === 'json' ? '.json' : '.yaml';
  const dest = out
    ? join(racine, out)
    : join(racine, '.aiad', 'metrics', 'api', `openapi${ext}`);

  const contenu = format === 'json'
    ? JSON.stringify(doc, null, 2)
    : versYaml(doc).replace(/^\n/, '');

  logHeader(
    'AIAD SDD — Export OpenAPI 3.1',
    `${specs.length} SPEC(s) avec \`api: true\` → ${format.toUpperCase()}`,
  );

  if (specs.length === 0) {
    console.log(`  ${C.jaune}~${C.reset} Aucune SPEC marquée \`api: true\` dans .aiad/specs/.`);
    console.log(`  ${C.gris}Ajoute \`api: true\` au frontmatter d'une SPEC + \`api_method:\` + \`api_path:\` pour qu'elle soit exportée.${C.reset}\n`);
    return { path: null, doc, warnings };
  }

  // s'assurer que le dossier parent existe
  if (!dryRun) {
    const parentDir = dirname(dest);
    if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
  }

  const result = syncFile(dest, contenu, { dryRun });
  const sym = result === 'created' ? `${C.vert}+${C.reset}`
    : result === 'updated' ? `${C.cyan}↑${C.reset}`
    : `${C.vert}✓${C.reset}`;
  log(sym, `${dest.replace(racine + '/', '')}${dryRun ? ` ${C.gris}(dry-run)${C.reset}` : ''}`);

  if (warnings.length > 0) {
    console.log(`\n  ${C.gras}Avertissements${C.reset}`);
    for (const w of warnings.slice(0, 10)) {
      console.log(`  ${C.jaune}~${C.reset} ${w}`);
    }
    if (warnings.length > 10) console.log(`  ${C.gris}(+${warnings.length - 10} autres)${C.reset}`);
  }

  console.log(`\n${C.gras}  Synthèse export${C.reset}
    SPECs API exportées : ${C.cyan}${specs.length}${C.reset}
    Endpoints           : ${C.cyan}${Object.keys(doc.paths).length}${C.reset}
    Format              : ${format.toUpperCase()} (OpenAPI 3.1.0)

${C.gris}  Outils compatibles : Stoplight, Postman, redoc, Spectral, API portails.${C.reset}
${C.gris}  Note : les schémas références (\`$ref:\`) sont à compléter par l'humain dans \`components.schemas\`.${C.reset}
`);

  return { path: dest, doc, warnings };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  lireSpecsApi as listApiSpecs,
  construirePaths as buildPaths,
  construireOperation as buildOperation,
  construireOpenApiDoc as buildOpenApiDoc,
  versYaml as toYaml,
  exporterOpenApi as exportOpenApi,
};
