// AIAD SDD Mode — Helpers d'anonymisation RGPD (item #118).
//
// **Cap stratégique** : les templates AIAD (multi-tenant, search,
// observability, notifications, billing) mentionnent souvent
// l'anonymisation comme prérequis RGPD. Sans **helpers prêts à l'emploi
// et testés**, chaque équipe les ré-implémente — avec des risques de
// confusion **pseudonymisation vs anonymisation** :
//
//   - **Pseudonymisation** (RGPD Article 4.5) : remplacer un identifiant
//     par un alias réversible si on possède la clé. **Reste une donnée
//     personnelle**.
//   - **Anonymisation** (Considérant 26 RGPD) : suppression
//     **irréversible** de l'identifiabilité. Sort du champ RGPD.
//
// **Helpers fournis** :
//   - `hashPii(value, salt)` — SHA-256 préfixé "pii_sha256:" pour
//     pseudonymisation cohérente inter-records.
//   - `hashIban(iban)` / `hashEmail(email)` / `hashPhone(phone)` —
//     wrappers normalisés.
//   - `generaliserAge(age)` — bin 10 ans (Sweeney 2002 k-anonymity).
//   - `generaliserCodePostal(cp, niveau)` — réduit précision FR/EU.
//   - `kAnonymity(records, k, quasiIds)` — détecte les bins < k et
//     supprime ou marque les enregistrements isolés.
//   - `bruitLaplace(valeur, epsilon, sensitivite)` — Differential
//     Privacy : ajoute du bruit Laplace pour requêtes agrégées.
//   - `supprimerChamps(record, champs)` — wipe in-place de fields
//     identifiants directs.
//   - `anonymiserBatch(records, options)` — pipeline complet.
//
// **Zero-dep** : crypto natif Node 18+.
//
// Documentation : https://aiad.ovh/anonymize
// Référence : Sweeney 2002 "k-anonymity: A model for protecting privacy"
//             Dwork 2006 "Differential privacy"

import { createHash, createHmac, randomInt } from 'node:crypto';

// ─── Hashing PII ───────────────────────────────────────────────────────────

const PREFIX_HASH = 'pii_sha256:';

/**
 * Hash une valeur PII avec SHA-256 (optionnellement salée via HMAC).
 *
 * Pseudonymisation **cohérente** : même valeur + même salt → même hash
 * (utile pour joindre des records anonymisés sans révéler l'identité).
 *
 * @param {string} value
 * @param {string} [salt] — si fourni, utilise HMAC-SHA256 (salt-keyed)
 * @returns {string} "pii_sha256:<hex>"
 */
export function hashPii(value, salt) {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  if (v.length === 0) return null;
  if (salt) {
    return PREFIX_HASH + createHmac('sha256', salt).update(v).digest('hex');
  }
  return PREFIX_HASH + createHash('sha256').update(v).digest('hex');
}

/**
 * Hash un IBAN : normalise (uppercase, sans espaces) avant hashing.
 */
export function hashIban(iban, salt) {
  if (typeof iban !== 'string') return null;
  const norm = iban.replace(/\s+/g, '').toUpperCase();
  return hashPii(norm, salt);
}

/**
 * Hash un email : normalise (lowercase, trim) avant hashing.
 */
export function hashEmail(email, salt) {
  if (typeof email !== 'string') return null;
  return hashPii(email.trim().toLowerCase(), salt);
}

/**
 * Hash un téléphone : ne garde que les chiffres avant hashing.
 */
export function hashPhone(phone, salt) {
  if (typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return null;
  return hashPii(digits, salt);
}

// ─── Généralisation ────────────────────────────────────────────────────────

/**
 * Bin un âge en tranches de 10 ans (0-9, 10-19, ..., 90+).
 *
 * Sweeney 2002 : la **généralisation** est la 1ère technique pour
 * atteindre k-anonymity.
 */
export function generaliserAge(age) {
  if (typeof age !== 'number' || !Number.isFinite(age) || age < 0) return null;
  if (age >= 90) return '90+';
  const debut = Math.floor(age / 10) * 10;
  return `${debut}-${debut + 9}`;
}

/**
 * Généralise un code postal FR/EU.
 *
 * @param {string} cp
 * @param {1|2|3} [niveau=2] — 1: département (2 chars), 2: ville (3 chars), 3: tout-sauf-dernier (4 chars)
 */
export function generaliserCodePostal(cp, niveau = 2) {
  if (typeof cp !== 'string') return null;
  const norm = cp.replace(/\s+/g, '');
  if (!/^\d{4,5}$/.test(norm)) return null;
  const keep = { 1: 2, 2: 3, 3: 4 }[niveau] ?? 3;
  return norm.slice(0, keep) + 'X'.repeat(Math.max(0, norm.length - keep));
}

// ─── Suppression directe ───────────────────────────────────────────────────

/**
 * Retire des champs sensibles d'un record (non in-place).
 *
 * @param {object} record
 * @param {string[]} champs
 */
export function supprimerChamps(record, champs) {
  if (!record || typeof record !== 'object') return record;
  const out = { ...record };
  for (const c of champs || []) delete out[c];
  return out;
}

// ─── k-anonymity ──────────────────────────────────────────────────────────

/**
 * Évalue k-anonymity sur une collection de records.
 *
 * Pour chaque combinaison de **quasi-identifiants** (ex. âge généralisé +
 * code postal + sexe), compte le nombre de records. Toute combinaison qui
 * apparaît < k fois est **isolée** → l'individu est ré-identifiable.
 *
 * @param {object[]} records
 * @param {number} k — seuil minimal (5 recommandé)
 * @param {string[]} quasiIds — clés à utiliser pour le grouping
 * @returns {{ buckets: Record<string, number>, isoles: object[], conforme: boolean }}
 */
export function kAnonymity(records, k, quasiIds) {
  if (!Array.isArray(records)) throw new Error('records doit être un tableau.');
  if (typeof k !== 'number' || k < 1) throw new Error('k doit être un entier ≥ 1.');
  if (!Array.isArray(quasiIds) || quasiIds.length === 0) {
    throw new Error('quasiIds doit être un tableau non vide.');
  }
  const buckets = {};
  for (const r of records) {
    const key = quasiIds.map((q) => String(r[q] ?? '')).join('|');
    buckets[key] = (buckets[key] || 0) + 1;
  }
  const isoles = records.filter((r) => {
    const key = quasiIds.map((q) => String(r[q] ?? '')).join('|');
    return buckets[key] < k;
  });
  return {
    buckets,
    isoles,
    conforme: isoles.length === 0,
  };
}

/**
 * Filtre une collection pour ne garder que les records k-anonymes
 * (élimine les isolés détectés par `kAnonymity`).
 */
export function filtrerKAnonymity(records, k, quasiIds) {
  const { isoles } = kAnonymity(records, k, quasiIds);
  const setIsoles = new Set(isoles);
  return records.filter((r) => !setIsoles.has(r));
}

// ─── Differential Privacy ─────────────────────────────────────────────────

/**
 * Génère un bruit Laplace pour Differential Privacy.
 *
 * Mécanisme de Dwork (2006) : pour une requête `f` de sensibilité `Δf`,
 * on ajoute `Laplace(0, Δf/ε)`. ε petit = plus de bruit = plus de privacy.
 *
 * Pour les usages **production** Differential Privacy, utiliser une
 * bibliothèque dédiée (OpenDP, IBM diffprivlib). Cette implémentation
 * vise les requêtes agrégées non-critiques (analytics produit).
 *
 * @param {number} epsilon — privacy budget (recommandé 0.1 à 1.0)
 * @param {number} [sensitivite=1] — Δf
 * @returns {number} bruit à ajouter à la valeur
 */
export function bruitLaplace(epsilon, sensitivite = 1) {
  if (typeof epsilon !== 'number' || epsilon <= 0) {
    throw new Error('epsilon doit être un nombre > 0.');
  }
  if (typeof sensitivite !== 'number' || sensitivite <= 0) {
    throw new Error('sensitivite doit être un nombre > 0.');
  }
  const scale = sensitivite / epsilon;
  // Inverse-CDF de Laplace : -scale * sign(u) * ln(1 - 2|u|), u ∈ (-0.5, 0.5)
  // u via crypto.randomInt(0, 2^32) puis transformé.
  const r = randomInt(0, 0xffffffff) / 0xffffffff; // [0, 1)
  const u = r - 0.5; // (-0.5, 0.5]
  const signe = u < 0 ? -1 : 1;
  // Évite ln(0) en bornant l'argument
  const arg = Math.max(1 - 2 * Math.abs(u), Number.EPSILON);
  return -scale * signe * Math.log(arg);
}

/**
 * Applique le mécanisme Laplace à une valeur agrégée (count, sum, mean).
 */
export function appliquerLaplace(valeur, epsilon, sensitivite = 1) {
  if (typeof valeur !== 'number') throw new Error('valeur doit être un nombre.');
  return valeur + bruitLaplace(epsilon, sensitivite);
}

// ─── Pipeline batch ────────────────────────────────────────────────────────

/**
 * Anonymise une collection de records avec une configuration complète.
 *
 * @param {object[]} records
 * @param {{
 *   hashChamps?: { champ: string, type?: 'iban'|'email'|'phone'|'generic' }[],
 *   supprimerChamps?: string[],
 *   generaliser?: { champ: string, type: 'age'|'cp', niveau?: number }[],
 *   salt?: string,
 *   kAnonymity?: { k: number, quasiIds: string[] }
 * }} options
 * @returns {{ records: object[], rapport: { total: number, isoles: number, conforme: boolean } }}
 */
export function anonymiserBatch(records, options = {}) {
  if (!Array.isArray(records)) throw new Error('records doit être un tableau.');
  const salt = options.salt;

  let out = records.map((r) => {
    let rec = { ...r };
    // Hash
    for (const h of options.hashChamps || []) {
      if (rec[h.champ] === undefined || rec[h.champ] === null) continue;
      const type = h.type || 'generic';
      if (type === 'iban') rec[h.champ] = hashIban(rec[h.champ], salt);
      else if (type === 'email') rec[h.champ] = hashEmail(rec[h.champ], salt);
      else if (type === 'phone') rec[h.champ] = hashPhone(rec[h.champ], salt);
      else rec[h.champ] = hashPii(rec[h.champ], salt);
    }
    // Suppression
    rec = supprimerChamps(rec, options.supprimerChamps);
    // Généralisation
    for (const g of options.generaliser || []) {
      if (rec[g.champ] === undefined || rec[g.champ] === null) continue;
      if (g.type === 'age') rec[g.champ] = generaliserAge(rec[g.champ]);
      else if (g.type === 'cp') rec[g.champ] = generaliserCodePostal(rec[g.champ], g.niveau || 2);
    }
    return rec;
  });

  let rapport = { total: out.length, isoles: 0, conforme: true };
  if (options.kAnonymity) {
    const { k, quasiIds } = options.kAnonymity;
    const r = kAnonymity(out, k, quasiIds);
    rapport.isoles = r.isoles.length;
    rapport.conforme = r.conforme;
    // Optionnel : retirer les isolés (politique stricte)
    if (options.kAnonymity.strict) {
      const set = new Set(r.isoles);
      out = out.filter((rec) => !set.has(rec));
    }
  }

  return { records: out, rapport };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  hashPii as hashPiiValue,
  hashIban as hashIbanValue,
  hashEmail as hashEmailValue,
  hashPhone as hashPhoneValue,
  generaliserAge as generalizeAge,
  generaliserCodePostal as generalizePostalCode,
  supprimerChamps as suppressFields,
  kAnonymity as kAnonymityCheck,
  filtrerKAnonymity as filterKAnonymity,
  bruitLaplace as laplaceNoise,
  appliquerLaplace as applyLaplace,
  anonymiserBatch as anonymizeBatch,
};

export const CONSTANTS = {
  PREFIX_HASH,
};
