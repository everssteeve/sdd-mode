// AIAD SDD Mode — Provenance signée des artefacts (SLSA Provenance v1.0).
//
// **Cap stratégique** : `npm publish --provenance` (déjà actif via
// `.github/workflows/release.yml`) signe le tarball npm via Sigstore/Rekor
// (SLSA L3). Ce module ajoute une **double signature AIAD interne** au
// format in-toto Statement / SLSA Provenance v1.0 :
//
//   - format `https://in-toto.io/Statement/v1` + predicate
//     `https://slsa.dev/provenance/v1`
//   - subject = liste des fichiers du tarball avec sha256
//   - signature HMAC-SHA256 sur le statement (vérifiable hors-ligne)
//   - bundle compatible cosign attest-blob pour soumission Rekor optionnelle
//
// **Garantie end-to-end** : npm provenance prouve "ce tarball vient de ce
// commit + ce workflow". Provenance AIAD prouve "ce contenu a été émis
// par un acteur qui détient AIAD_PROVENANCE_SECRET" — utile en air-gapped
// ou pour vérifier après transit chez un mirror.
//
// Documentation : https://aiad.ovh/provenance
//
// Standards référencés :
//   - SLSA v1.0 — https://slsa.dev/spec/v1.0/
//   - in-toto Attestation Framework — https://in-toto.io/Statement/v1
//   - Sigstore cosign — https://docs.sigstore.dev/cosign/
//   - npm provenance — https://docs.npmjs.com/generating-provenance-statements

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHmac, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { C, logHeader } from './term.js';

const STATEMENT_TYPE = 'https://in-toto.io/Statement/v1';
const PREDICATE_TYPE = 'https://slsa.dev/provenance/v1';
const BUILD_TYPE = 'https://aiad.ovh/buildtypes/npm-pack-v1';

// ─── Helpers crypto ─────────────────────────────────────────────────────────

function sha256(contenu) {
  return createHash('sha256').update(contenu).digest('hex');
}

function hmacSign(message, secret) {
  return createHmac('sha256', secret).update(message).digest('hex');
}

// ─── Inventaire du tarball ──────────────────────────────────────────────────

/**
 * Liste les fichiers qui seront inclus dans le tarball npm via
 * `npm pack --dry-run --json` (déjà utilisé par lib/reproducibility.js).
 *
 * @param {string} racine
 * @returns {{ files: { path: string, size: number }[], name: string, version: string }}
 */
export function inventaireTarball(racine) {
  const r = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: racine,
    encoding: 'utf-8',
    timeout: 60000,
  });
  if (r.status !== 0) {
    throw new Error(`npm pack --dry-run a échoué : ${r.stderr || r.stdout}`);
  }
  // npm pack --dry-run --json retourne un tableau d'un objet
  const output = JSON.parse(r.stdout);
  const pkg = Array.isArray(output) ? output[0] : output;
  return {
    name: pkg.name,
    version: pkg.version,
    files: (pkg.files || []).map((f) => ({ path: f.path, size: f.size })),
  };
}

/**
 * Calcule le sha256 de chaque fichier listé (résolu depuis racine).
 *
 * @returns {{ name: string, digest: { sha256: string } }[]}
 */
export function digestsFichiers(racine, files) {
  return files.map((f) => {
    const abs = join(racine, f.path);
    const contenu = readFileSync(abs);
    return { name: f.path, digest: { sha256: sha256(contenu) } };
  });
}

// ─── SLSA Statement ─────────────────────────────────────────────────────────

/**
 * Construit un in-toto Statement / SLSA Provenance v1.0.
 *
 * Champs SLSA Provenance v1.0 :
 *   - buildDefinition.buildType — URI identifiant le type de build
 *   - buildDefinition.externalParameters — entrées du build (commit, tag)
 *   - runDetails.builder.id — qui a produit l'artefact
 *   - runDetails.metadata.invocationId — id d'exécution
 *
 * @param {{ subject: object[], commit?: string, tag?: string, builderId?: string, invocationId?: string }} input
 * @returns {object}
 */
export function construireStatement(input) {
  if (!Array.isArray(input.subject) || input.subject.length === 0) {
    throw new Error('subject requis : tableau non vide d\'objets { name, digest.sha256 }.');
  }
  for (const s of input.subject) {
    if (!s.name || !s.digest || !s.digest.sha256) {
      throw new Error(`subject invalide : ${JSON.stringify(s)} — name + digest.sha256 requis.`);
    }
  }
  return {
    _type: STATEMENT_TYPE,
    predicateType: PREDICATE_TYPE,
    subject: input.subject,
    predicate: {
      buildDefinition: {
        buildType: BUILD_TYPE,
        externalParameters: {
          commit: input.commit || null,
          tag: input.tag || null,
        },
        internalParameters: {
          tool: 'aiad-sdd',
        },
        resolvedDependencies: [],
      },
      runDetails: {
        builder: {
          id: input.builderId || 'https://aiad.ovh/builders/local-cli',
          version: { 'aiad-sdd': input.aiadVersion || 'unknown' },
        },
        metadata: {
          invocationId: input.invocationId || `aiad-${Date.now()}`,
          startedOn: input.startedOn || new Date().toISOString(),
          finishedOn: new Date().toISOString(),
        },
      },
    },
  };
}

/**
 * Détecte le commit + tag courants via git (best-effort).
 */
function gitContext(racine) {
  const out = {};
  const cArg = ['rev-parse', 'HEAD'];
  const tArg = ['describe', '--tags', '--exact-match'];
  try {
    const c = spawnSync('git', cArg, { cwd: racine, encoding: 'utf-8' });
    if (c.status === 0) out.commit = c.stdout.trim();
  } catch { /* ignore */ }
  try {
    const t = spawnSync('git', tArg, { cwd: racine, encoding: 'utf-8' });
    if (t.status === 0) out.tag = t.stdout.trim();
  } catch { /* ignore */ }
  return out;
}

/**
 * Lit la version du package depuis package.json.
 */
function versionAiad(racine) {
  const p = join(racine, 'package.json');
  if (!existsSync(p)) return 'unknown';
  try { return JSON.parse(readFileSync(p, 'utf-8')).version || 'unknown'; }
  catch { return 'unknown'; }
}

/**
 * Signe le statement avec HMAC-SHA256.
 *
 * Format de sortie :
 *   {
 *     statement: { ... },
 *     signature: {
 *       algorithm: "hmac-sha256",
 *       value: "abcdef..." // hex
 *     }
 *   }
 *
 * @param {object} statement
 * @param {string} secret — ≥ 16 caractères
 * @returns {{ statement: object, signature: { algorithm: string, value: string } }}
 */
export function signerStatement(statement, secret) {
  if (typeof secret !== 'string' || secret.length < 16) {
    throw new Error('secret HMAC requis (≥ 16 caractères) — définir AIAD_PROVENANCE_SECRET.');
  }
  const message = JSON.stringify(statement);
  return {
    statement,
    signature: {
      algorithm: 'hmac-sha256',
      value: hmacSign(message, secret),
    },
  };
}

/**
 * Vérifie une attestation : (a) signature HMAC, (b) digests des fichiers
 * actuels matchent les digests du subject.
 *
 * @param {object} attestation
 * @param {string} secret
 * @param {string} racine
 * @returns {{ valid: boolean, raisons: string[] }}
 */
export function verifierAttestation(attestation, secret, racine) {
  const raisons = [];
  if (!attestation || !attestation.statement || !attestation.signature) {
    return { valid: false, raisons: ['format attestation invalide'] };
  }
  const stmt = attestation.statement;

  // Signature HMAC
  if (secret) {
    const sigAttendue = hmacSign(JSON.stringify(stmt), secret);
    if (sigAttendue !== attestation.signature.value) {
      raisons.push('signature HMAC ne match pas (secret incorrect ou attestation altérée)');
    }
  } else {
    raisons.push('AIAD_PROVENANCE_SECRET absent : signature non vérifiée');
  }

  // Format SLSA
  if (stmt._type !== STATEMENT_TYPE) raisons.push(`_type attendu ${STATEMENT_TYPE}, vu ${stmt._type}`);
  if (stmt.predicateType !== PREDICATE_TYPE) raisons.push(`predicateType attendu ${PREDICATE_TYPE}, vu ${stmt.predicateType}`);

  // Re-vérification des digests si racine fournie
  if (racine && Array.isArray(stmt.subject)) {
    for (const s of stmt.subject) {
      const abs = join(racine, s.name);
      if (!existsSync(abs)) {
        raisons.push(`subject "${s.name}" introuvable sur disque`);
        continue;
      }
      const digestActuel = sha256(readFileSync(abs));
      if (digestActuel !== s.digest.sha256) {
        raisons.push(`subject "${s.name}" : digest sha256 a changé`);
      }
    }
  }

  return { valid: raisons.length === 0, raisons };
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Génère l'attestation complète et l'écrit dans .aiad/provenance/attestation.json.
 *
 * @param {string} racine
 * @param {{ secret?: string, dryRun?: boolean, json?: boolean, out?: string }} [options]
 * @returns {{ path: string, attestation: object, count: number }}
 */
export function genererAttestation(racine, options = {}) {
  const secret = options.secret || process.env.AIAD_PROVENANCE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AIAD_PROVENANCE_SECRET requis (≥ 16 caractères) pour signer l\'attestation.\n  Définir : export AIAD_PROVENANCE_SECRET="<clé partagée build/release>"');
  }

  const inv = inventaireTarball(racine);
  const subject = digestsFichiers(racine, inv.files);
  const ctx = gitContext(racine);

  const statement = construireStatement({
    subject,
    commit: ctx.commit,
    tag: ctx.tag,
    aiadVersion: versionAiad(racine),
    invocationId: `aiad-${inv.name}-${inv.version}-${Date.now()}`,
  });

  const attestation = signerStatement(statement, secret);

  const outRel = options.out || '.aiad/provenance/attestation.json';
  const outAbs = join(racine, outRel);

  if (!options.dryRun) {
    if (!existsSync(dirname(outAbs))) mkdirSync(dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, JSON.stringify(attestation, null, 2) + '\n', 'utf-8');
  }

  if (options.json) {
    process.stdout.write(JSON.stringify({
      path: outRel,
      count: subject.length,
      package: { name: inv.name, version: inv.version },
      commit: ctx.commit || null,
      tag: ctx.tag || null,
      dryRun: Boolean(options.dryRun),
    }, null, 2) + '\n');
  } else {
    logHeader(
      'AIAD SDD — Attestation SLSA Provenance v1.0',
      `${subject.length} fichier(s) du tarball ${inv.name}@${inv.version}`,
    );
    console.log(`  ${C.vert}✓${C.reset} Attestation ${options.dryRun ? '(dry-run, non écrite)' : `écrite dans ${C.cyan}${outRel}${C.reset}`}`);
    console.log(`  ${C.gris}commit : ${ctx.commit || '(aucun)'}${ctx.tag ? ` · tag : ${ctx.tag}` : ''}${C.reset}`);
    console.log(`  ${C.gris}signée HMAC-SHA256 (AIAD_PROVENANCE_SECRET) — vérifiable hors-ligne via aiad-sdd provenance verify${C.reset}`);
    console.log('');
  }

  return { path: outAbs, attestation, count: subject.length };
}

/**
 * Vérifie l'attestation existante.
 */
export function verifierFichier(racine, options = {}) {
  const secret = options.secret || process.env.AIAD_PROVENANCE_SECRET;
  const path = join(racine, options.path || '.aiad/provenance/attestation.json');
  if (!existsSync(path)) {
    if (options.json) {
      process.stdout.write(JSON.stringify({ valid: false, raisons: ['attestation absente'] }, null, 2) + '\n');
    } else {
      console.error(`\n  ${C.rouge}✗${C.reset} Attestation absente : ${path}\n  Génère-la d'abord avec : aiad-sdd provenance generate\n`);
    }
    return { valid: false, raisons: ['attestation absente'] };
  }
  const attestation = JSON.parse(readFileSync(path, 'utf-8'));
  const r = verifierAttestation(attestation, secret, racine);
  if (options.json) {
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    return r;
  }
  logHeader('AIAD SDD — Vérification provenance', attestation.statement.subject.length + ' fichier(s)');
  if (r.valid) {
    console.log(`  ${C.vert}✓${C.reset} Attestation valide. Signature HMAC OK + digests intègres.\n`);
  } else {
    console.error(`  ${C.rouge}✗${C.reset} Attestation invalide : ${r.raisons.length} anomalie(s).`);
    for (const raison of r.raisons.slice(0, 10)) console.error(`    ${C.rouge}-${C.reset} ${raison}`);
    console.error('');
  }
  return r;
}

/**
 * Produit un bundle prêt à soumettre à Rekor via cosign.
 * Format : la commande à exécuter (cosign attest-blob), pas exécutée
 * automatiquement (cosign est un binaire externe non embarqué).
 */
export function bundleSigstoreCommande(racine, options = {}) {
  const path = options.path || '.aiad/provenance/attestation.json';
  return [
    `# Soumission Sigstore/Rekor (nécessite cosign + identité OIDC GitHub Actions)`,
    `# https://docs.sigstore.dev/cosign/signing/signing_with_blobs/`,
    ``,
    `cosign attest-blob \\`,
    `  --predicate ${path} \\`,
    `  --type slsaprovenance1 \\`,
    `  --bundle ${path}.sigstore-bundle \\`,
    `  <chemin-vers-tarball.tgz>`,
    ``,
    `# Vérification publique (sans secret) :`,
    `cosign verify-blob-attestation \\`,
    `  --bundle ${path}.sigstore-bundle \\`,
    `  --type slsaprovenance1 \\`,
    `  --certificate-identity-regexp '.*' \\`,
    `  --certificate-oidc-issuer-regexp '.*' \\`,
    `  <chemin-vers-tarball.tgz>`,
  ].join('\n');
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  inventaireTarball as tarballInventory,
  digestsFichiers as fileDigests,
  construireStatement as buildStatement,
  signerStatement as signStatement,
  verifierAttestation as verifyAttestation,
  genererAttestation as generateAttestation,
  verifierFichier as verifyFile,
  bundleSigstoreCommande as sigstoreBundleCommand,
};
