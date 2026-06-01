// AIAD SDD Mode — Sortie SARIF v2.1.0 pour la matrice de traçabilité.
//
// Format standard reconnu par GitHub Code Scanning, GitLab Security
// Dashboard et SonarQube. Permet aux gaps de traçabilité SDD d'apparaître
// directement dans l'UI sécurité de la forge utilisée par l'équipe — un
// avantage clé pour le positionnement leader EU/FR du framework.
//
// Spec officielle : https://docs.oasis-open.org/sarif/sarif/v2.1.0/

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function lireVersionPackage() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    return pkg.version;
  } catch { return '0.0.0'; }
}

const RULES = [
  {
    id: 'AIAD-TRACE-001',
    name: 'intent-without-spec',
    shortDescription: { text: 'Intent sans SPEC associée' },
    fullDescription: { text: "L'Intent Statement n'a pas encore donné lieu à une SPEC technique. Le cycle SDD requiert qu'une SPEC valide formalise le COMMENT avant tout code." },
    helpUri: 'https://aiad.ovh/trace#orphans',
    defaultConfiguration: { level: 'warning' },
  },
  {
    id: 'AIAD-TRACE-002',
    name: 'spec-not-implemented',
    shortDescription: { text: 'SPEC validée sans code applicatif' },
    fullDescription: { text: "La SPEC est marquée ready/in-progress/validation/done mais aucun code applicatif ne porte d'annotation @spec correspondante." },
    helpUri: 'https://aiad.ovh/trace#non-implemented',
    defaultConfiguration: { level: 'error' },
  },
  {
    id: 'AIAD-TRACE-003',
    name: 'spec-orphan-on-code',
    shortDescription: { text: 'SPEC référencée par le code mais absente des artefacts' },
    fullDescription: { text: "Le code annote `@spec SPEC-NNN-N-...` mais aucun fichier `.aiad/specs/SPEC-NNN-N-*.md` ne correspond. Soit la SPEC a été supprimée, soit son ID a changé." },
    helpUri: 'https://aiad.ovh/trace#orphans',
    defaultConfiguration: { level: 'error' },
  },
  {
    id: 'AIAD-TRACE-004',
    name: 'intent-orphan-on-code',
    shortDescription: { text: 'Intent référencé par le code mais absent des artefacts' },
    fullDescription: { text: "Le code annote `@intent INTENT-NNN` mais aucun fichier `.aiad/intents/INTENT-NNN.md` ne correspond." },
    helpUri: 'https://aiad.ovh/trace#orphans',
    defaultConfiguration: { level: 'error' },
  },
  {
    id: 'AIAD-TRACE-005',
    name: 'code-without-spec',
    shortDescription: { text: 'Code applicatif sans annotation @spec' },
    fullDescription: { text: "Le fichier de code n'est rattaché à aucune SPEC. Le Drift Lock recommande qu'un fichier applicatif soit traçable jusqu'à une intention." },
    helpUri: 'https://aiad.ovh/trace#untraced',
    defaultConfiguration: { level: 'note' },
  },
  {
    id: 'AIAD-TRACE-006',
    name: 'code-without-tests',
    shortDescription: { text: 'Code annoté @spec sans test associé' },
    fullDescription: { text: "Le fichier de code porte une annotation @spec mais aucun test n'est lié (ni via @verified-by sur ce fichier, ni via une SPEC mentionnée par un test)." },
    helpUri: 'https://aiad.ovh/trace#untested',
    defaultConfiguration: { level: 'warning' },
  },
];

function location(uri, line = 1) {
  return {
    physicalLocation: {
      artifactLocation: { uri },
      region: { startLine: Math.max(1, Number(line) || 1) },
    },
  };
}

function resultat(ruleId, level, message, uri, line) {
  return {
    ruleId,
    level,
    message: { text: message },
    locations: [location(uri, line)],
  };
}

/**
 * Convertit le modèle de traçabilité en document SARIF v2.1.0 sérialisable.
 *
 * @param {object} modele — sortie de `construireMatrice`
 * @returns {object} document SARIF prêt à `JSON.stringify`
 */
export function rendreSarif(modele) {
  const version = lireVersionPackage();
  const results = [];

  for (const x of modele.gaps.intentsSansSpec) {
    results.push(resultat('AIAD-TRACE-001', 'warning',
      `Intent ${x.id} (« ${x.title || ''} ») n'a pas de SPEC associée.`,
      x.file, 1));
  }
  for (const x of modele.gaps.specsValideesNonImplementees) {
    results.push(resultat('AIAD-TRACE-002', 'error',
      `SPEC ${x.id} marquée ${x.status} sans annotation @spec dans le code applicatif.`,
      x.file, 1));
  }
  for (const x of modele.gaps.specsOrphelinsSurCode) {
    results.push(resultat('AIAD-TRACE-003', 'error',
      `SPEC ${x.id} référencée par le code mais absente de .aiad/specs/.`,
      x.file, x.line));
  }
  for (const x of modele.gaps.intentsOrphelinsSurCode) {
    results.push(resultat('AIAD-TRACE-004', 'error',
      `Intent ${x.id} référencé par le code mais absent de .aiad/intents/.`,
      x.file, x.line));
  }
  for (const f of modele.gaps.codeSansSpec) {
    results.push(resultat('AIAD-TRACE-005', 'note',
      `Aucune annotation @spec dans ${f.path}.`,
      f.path, 1));
  }
  for (const f of modele.gaps.codeSansTests) {
    results.push(resultat('AIAD-TRACE-006', 'warning',
      `Code ${f.path} annoté @spec mais sans test lié.`,
      f.path, 1));
  }

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'aiad-sdd-trace',
            version,
            informationUri: 'https://aiad.ovh',
            rules: RULES,
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
            endTimeUtc: new Date(modele.generatedAt || Date.now()).toISOString(),
          },
        ],
      },
    ],
  };
}
