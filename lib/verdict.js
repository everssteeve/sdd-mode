// AIAD SDD Mode — Contrat de sortie déterministe des verdicts (item §3.4).
//
// **Cap stratégique** : « computation off-context ». Aucun déterminisme LLM
// n'est garanti (pas de `seed` ; variance floating-point + routing MoE +
// batching). Le verdict final d'une gate / validation / audit ne doit donc
// JAMAIS venir du jugement libre du modèle, mais d'un script CLI déterministe
// dont la sortie est validée par schéma et signalée par un exit code stable.
//
// Ce module fournit le contrat unique consommé par toutes les commandes de
// verdict (`gate`, `validate`, `security`, `trace`) ET par les hooks harness
// (PreToolUse / Stop) : le verdict affiché à l'humain, injecté au modèle et lu
// par le hook est strictement le même artefact.
//
// **Exit codes (alignés CLAUDE.md)** :
//   0 = PASS  (succès / conforme)
//   1 = FAIL  (échec / non-conforme)
//   2 = JNSP  (« je ne sais pas » — décision humaine requise, PAS une erreur)
//
// `CONDITIONAL` (§3.6) est accepté comme verdict gradué → exit 0 avec
// conditions non vides ; `UNKNOWN` (sortie EN de gouvernance fail-closed) est
// un alias de `JNSP`.
//
// **Zero-dep** : validateur JSON Schema maison (sous-ensemble suffisant pour
// les schémas de verdict versionnés dans `.aiad/schema/verdicts/`).
//
// @intent INTENT-002
// @spec SPEC-002-1-gouvernance-enforced
// @verified-by test/verdict.test.js
//
// Documentation : https://aiad.ovh

// ─── Verdicts canoniques & exit codes ───────────────────────────────────────

/** Verdicts canoniques (sortie FR de référence). */
export const VERDICTS_CANONIQUES = ['PASS', 'CONDITIONAL', 'FAIL', 'JNSP'];

/** Mapping verdict → exit code stable. */
export const VERDICT_EXIT = Object.freeze({
  PASS: 0,
  CONDITIONAL: 0, // accepté, mais porte des conditions à lever (cf. §3.6)
  FAIL: 1,
  JNSP: 2,
});

/**
 * Alias acceptés (sorties EN, variantes de gouvernance, casse libre) →
 * verdict canonique. Le fail-closed réglementaire `UNKNOWN` mappe sur `JNSP`.
 */
export const VERDICT_ALIASES = Object.freeze({
  OK: 'PASS',
  SUCCESS: 'PASS',
  CONFORME: 'PASS',
  'CONDITIONAL PASS': 'CONDITIONAL',
  CONDITIONNEL: 'CONDITIONAL',
  KO: 'FAIL',
  ECHEC: 'FAIL',
  'NON-CONFORME': 'FAIL',
  REJECTED: 'FAIL',
  UNKNOWN: 'JNSP',
  INCONNU: 'JNSP',
  INCONNUE: 'JNSP',
});

/**
 * Normalise un libellé de verdict (casse, accents, alias) vers un verdict
 * canonique. Lève si non reconnu (un verdict ambigu ne doit jamais passer en
 * silence — c'est un cas JNSP à la charge de l'appelant).
 *
 * @param {string} brut
 * @returns {'PASS'|'CONDITIONAL'|'FAIL'|'JNSP'}
 */
export function normaliserVerdict(brut) {
  if (typeof brut !== 'string' || brut.trim() === '') {
    throw new Error(`Verdict vide ou non-string : ${JSON.stringify(brut)}`);
  }
  const up = brut.trim().toUpperCase();
  if (VERDICTS_CANONIQUES.includes(up)) return up;
  if (Object.prototype.hasOwnProperty.call(VERDICT_ALIASES, up)) return VERDICT_ALIASES[up];
  throw new Error(`Verdict inconnu : "${brut}". Attendu : ${VERDICTS_CANONIQUES.join(' | ')} (ou un alias).`);
}

/**
 * Exit code associé à un verdict (après normalisation).
 *
 * @param {string} verdict
 * @returns {0|1|2}
 */
export function codeSortie(verdict) {
  return VERDICT_EXIT[normaliserVerdict(verdict)];
}

// ─── Validateur JSON Schema minimal (zero-dep) ──────────────────────────────

/**
 * Valide une valeur contre un sous-ensemble de JSON Schema couvrant les
 * besoins des schémas de verdict : `type` (string|number|integer|boolean|
 * object|array|null + union via tableau), `required`, `properties`, `enum`,
 * `items`, `additionalProperties` (bool). Non exhaustif volontairement :
 * suffisant et auditable, sans dépendance.
 *
 * @param {*} valeur
 * @param {object} schema
 * @param {string} [chemin]
 * @returns {{ valide: boolean, erreurs: string[] }}
 */
export function validerSchema(valeur, schema, chemin = '$') {
  const erreurs = [];
  if (!schema || typeof schema !== 'object') return { valide: true, erreurs };

  // type (string ou tableau de types — union)
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatch(valeur, t))) {
      erreurs.push(`${chemin} : type attendu ${types.join('|')}, reçu ${typeReel(valeur)}`);
      return { valide: false, erreurs }; // inutile de descendre si le type est faux
    }
  }

  // enum
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => deepEqual(e, valeur))) {
    erreurs.push(`${chemin} : valeur ${JSON.stringify(valeur)} hors enum ${JSON.stringify(schema.enum)}`);
  }

  // object
  if (valeur && typeof valeur === 'object' && !Array.isArray(valeur)) {
    if (Array.isArray(schema.required)) {
      for (const clef of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(valeur, clef)) {
          erreurs.push(`${chemin} : propriété requise manquante « ${clef} »`);
        }
      }
    }
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [clef, sousSchema] of Object.entries(schema.properties)) {
        if (Object.prototype.hasOwnProperty.call(valeur, clef)) {
          const r = validerSchema(valeur[clef], sousSchema, `${chemin}.${clef}`);
          erreurs.push(...r.erreurs);
        }
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      const connues = new Set(Object.keys(schema.properties));
      for (const clef of Object.keys(valeur)) {
        if (!connues.has(clef)) erreurs.push(`${chemin} : propriété non autorisée « ${clef} »`);
      }
    }
  }

  // array
  if (Array.isArray(valeur) && schema.items) {
    valeur.forEach((item, i) => {
      const r = validerSchema(item, schema.items, `${chemin}[${i}]`);
      erreurs.push(...r.erreurs);
    });
  }

  return { valide: erreurs.length === 0, erreurs };
}

function typeMatch(valeur, t) {
  switch (t) {
    case 'null': return valeur === null;
    case 'array': return Array.isArray(valeur);
    case 'object': return valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);
    case 'string': return typeof valeur === 'string';
    case 'boolean': return typeof valeur === 'boolean';
    case 'number': return typeof valeur === 'number' && Number.isFinite(valeur);
    case 'integer': return typeof valeur === 'number' && Number.isInteger(valeur);
    default: return false;
  }
}

function typeReel(valeur) {
  if (valeur === null) return 'null';
  if (Array.isArray(valeur)) return 'array';
  if (typeof valeur === 'number') return Number.isInteger(valeur) ? 'integer' : 'number';
  return typeof valeur;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') {
    const ka = Object.keys(a); const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

// ─── Émission d'un verdict (contrat unique) ─────────────────────────────────

/**
 * Construit l'enveloppe canonique d'un verdict, validée et prête à émettre.
 * Ne fait PAS d'effet de bord process (testable) : retourne le code de sortie
 * et l'enveloppe ; c'est l'appelant CLI qui décide d'`exit(code)`.
 *
 * Règle fail-closed : si un schéma est fourni et que le payload ne valide pas,
 * le verdict est **dégradé en échec d'émission** (code 1) AVANT toute écriture
 * — on ne publie jamais une sortie machine non conforme.
 *
 * @param {object} opts
 * @param {string} opts.verdict — verdict (canonique ou alias)
 * @param {object} [opts.payload] — données du verdict (scores, evidence, …)
 * @param {object} [opts.schema] — JSON Schema de validation (optionnel)
 * @param {boolean} [opts.json] — si vrai, écrit l'enveloppe JSON sur `stream`
 * @param {{ write: Function }} [opts.stream] — flux de sortie (déf. stdout)
 * @returns {{ code: 0|1|2, verdict: string, enveloppe: object, valide: boolean, erreurs: string[] }}
 */
export function emitVerdict({ verdict, payload = {}, schema = null, json = false, stream = process.stdout } = {}) {
  const canon = normaliserVerdict(verdict);
  const enveloppe = { verdict: canon, exitCode: VERDICT_EXIT[canon], ...payload };

  let valide = true;
  let erreurs = [];
  if (schema) {
    const r = validerSchema(enveloppe, schema);
    valide = r.valide;
    erreurs = r.erreurs;
  }

  // Cohérence §3.6 : CONDITIONAL DOIT porter des conditions non vides.
  if (canon === 'CONDITIONAL' && !(Array.isArray(payload.conditions) && payload.conditions.length > 0)) {
    valide = false;
    erreurs.push('$ : verdict CONDITIONAL sans `conditions` non vide');
  }

  if (!valide) {
    if (json) stream.write(JSON.stringify({ verdict: 'FAIL', exitCode: 1, error: 'schema_validation_failed', erreurs }) + '\n');
    return { code: 1, verdict: 'FAIL', enveloppe, valide: false, erreurs };
  }

  if (json) stream.write(JSON.stringify(enveloppe) + '\n');
  return { code: VERDICT_EXIT[canon], verdict: canon, enveloppe, valide: true, erreurs: [] };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  normaliserVerdict as normalizeVerdict,
  codeSortie as exitCode,
  validerSchema as validateSchema,
  emitVerdict as emit,
  VERDICTS_CANONIQUES as CANONICAL_VERDICTS,
};
