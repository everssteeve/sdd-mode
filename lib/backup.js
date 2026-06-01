// AIAD SDD Mode — Backup crypté AES-256-GCM des artefacts (item #110).
//
// **Cap stratégique** : la conformité **RGPD article 30** (registre des
// traitements) et le **Cyber Resilience Act EU 2024/2847** exigent
// l'archivage long terme et confidentiel des artefacts d'analyse,
// décisions de gouvernance et SPECs sécurité — souvent **5 à 10 ans**.
//
// Un backup zero-dep, **chiffré localement**, vérifiable hors-ligne, sans
// dépendance cloud, satisfait ces exigences pour les organisations
// souveraines (administrations FR, banques EU, OIV/OSE).
//
// **Crypto** :
//   - **AES-256-GCM** (NIST SP 800-38D) — chiffrement authentifié.
//   - **PBKDF2-HMAC-SHA256** avec 200 000 itérations (recommandation
//     OWASP 2023) pour dériver une clé 32 octets depuis un mot de passe.
//   - **IV 12 octets** aléatoire (CSPRNG), **AuthTag 16 octets**.
//   - Salt 32 octets aléatoire, généré à chaque backup.
//
// **Format archive (.aiad-backup)** — auto-portant, lisible hors-ligne :
//   Ligne 1 : `AIAD-BACKUP-V1\n`
//   Ligne 2 : JSON metadata (base64 sur les champs binaires) + `\n`
//   Ligne 3+ : ciphertext binaire concaténé (taille = manifest.totalSize)
//
// Metadata : `{ version, createdAt, kdf, kdfIter, salt, iv, authTag,
//             manifest: [{ path, size }] }`
//
// **Authentification end-to-end** : GCM authentifie le ciphertext ;
// toute modification de l'archive après création entraîne un échec de
// déchiffrement (`Unsupported state or unable to authenticate data`).
//
// Documentation : https://aiad.ovh/backup

import {
  existsSync, readFileSync, writeFileSync, mkdirSync,
  readdirSync, statSync,
} from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'node:crypto';

const MAGIC = 'AIAD-BACKUP-V1';
const KDF_ITER = 200_000;
const KDF = 'pbkdf2-sha256';
const ALGO = 'aes-256-gcm';
const SALT_LEN = 32;
const IV_LEN = 12;
const KEY_LEN = 32;
const TAG_LEN = 16;

// ─── Inventaire .aiad/ ─────────────────────────────────────────────────────

/**
 * Liste récursive des fichiers d'un dossier (tri stable lexicographique).
 *
 * @param {string} racine — base du backup
 * @param {string} sousDir — dossier à scanner relatif à racine (défaut `.aiad`)
 * @returns {{ path: string, size: number, abs: string }[]} — `path` est relatif à racine
 */
export function listerFichiers(racine, sousDir = '.aiad') {
  const base = join(racine, sousDir);
  if (!existsSync(base)) return [];
  const out = [];
  function visit(abs) {
    const enfants = readdirSync(abs).sort();
    for (const enfant of enfants) {
      const chemin = join(abs, enfant);
      let st;
      try { st = statSync(chemin); } catch { continue; }
      if (st.isDirectory()) {
        visit(chemin);
      } else if (st.isFile()) {
        const rel = relative(racine, chemin).split(sep).join('/');
        out.push({ path: rel, size: st.size, abs: chemin });
      }
    }
  }
  visit(base);
  return out;
}

// ─── Crypto helpers ────────────────────────────────────────────────────────

/**
 * Dérive une clé AES-256 depuis un mot de passe via PBKDF2.
 *
 * @param {string} password
 * @param {Buffer} salt
 * @param {number} [iter]
 */
export function deriverCle(password, salt, iter = KDF_ITER) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Mot de passe requis (≥ 8 caractères).');
  }
  return pbkdf2Sync(password, salt, iter, KEY_LEN, 'sha256');
}

/**
 * Construit le manifest + concatène les contenus en un Buffer unique.
 *
 * @param {{ path: string, size: number, abs: string }[]} fichiers
 * @returns {{ manifest: { path: string, size: number }[], plaintext: Buffer }}
 */
export function construirePayload(fichiers) {
  const manifest = [];
  const buffers = [];
  for (const f of fichiers) {
    const buf = readFileSync(f.abs);
    manifest.push({ path: f.path, size: buf.length });
    buffers.push(buf);
  }
  return { manifest, plaintext: Buffer.concat(buffers) };
}

/**
 * Chiffre un Buffer avec AES-256-GCM.
 *
 * @param {Buffer} plaintext
 * @param {Buffer} key
 * @param {Buffer} iv
 * @returns {{ ciphertext: Buffer, authTag: Buffer }}
 */
export function chiffrer(plaintext, key, iv) {
  if (key.length !== KEY_LEN) throw new Error(`Clé doit faire ${KEY_LEN} octets.`);
  if (iv.length !== IV_LEN) throw new Error(`IV doit faire ${IV_LEN} octets.`);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, authTag };
}

/**
 * Déchiffre un Buffer avec AES-256-GCM (échoue si tag invalide).
 */
export function dechiffrer(ciphertext, key, iv, authTag) {
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// ─── Pack archive ─────────────────────────────────────────────────────────

/**
 * Construit le buffer complet de l'archive (header texte + body binaire).
 */
export function packArchive(metadata, ciphertext) {
  const header = MAGIC + '\n' + JSON.stringify(metadata) + '\n';
  return Buffer.concat([Buffer.from(header, 'utf-8'), ciphertext]);
}

/**
 * Découpe une archive en `{ metadata, ciphertext }`.
 */
export function unpackArchive(buffer) {
  const ascii = buffer.toString('utf-8');
  const nl1 = ascii.indexOf('\n');
  if (nl1 === -1) throw new Error('Archive : magic absent.');
  const magic = ascii.slice(0, nl1);
  if (magic !== MAGIC) throw new Error(`Archive : magic "${magic}" inattendu (attendu ${MAGIC}).`);
  const nl2 = ascii.indexOf('\n', nl1 + 1);
  if (nl2 === -1) throw new Error('Archive : metadata absent.');
  const metaJson = ascii.slice(nl1 + 1, nl2);
  let metadata;
  try { metadata = JSON.parse(metaJson); }
  catch (err) { throw new Error(`Archive : metadata JSON invalide : ${err.message}`); }
  // Header (texte) doit être lu en bytes pour calculer l'offset binaire
  const headerBytes = Buffer.byteLength(MAGIC + '\n' + metaJson + '\n', 'utf-8');
  const ciphertext = buffer.slice(headerBytes);
  return { metadata, ciphertext };
}

// ─── Pipeline ──────────────────────────────────────────────────────────────

/**
 * Crée un backup chiffré du dossier `.aiad/` (configurable).
 *
 * @param {string} racine
 * @param {{ password: string, out?: string, sousDir?: string, dryRun?: boolean, json?: boolean }} options
 * @returns {{ path: string, files: number, size: number, manifest: object[] }}
 */
export function backup(racine, options = {}) {
  if (!options.password) throw new Error('Mot de passe requis (--password ou option `password`).');
  const sousDir = options.sousDir || '.aiad';
  const fichiers = listerFichiers(racine, sousDir);
  if (fichiers.length === 0) {
    throw new Error(`Aucun fichier à sauvegarder dans ${sousDir}.`);
  }

  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriverCle(options.password, salt);

  const { manifest, plaintext } = construirePayload(fichiers);
  const { ciphertext, authTag } = chiffrer(plaintext, key, iv);

  const metadata = {
    version: 1,
    createdAt: new Date().toISOString(),
    kdf: KDF,
    kdfIter: KDF_ITER,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    sousDir,
    manifest,
  };

  const archive = packArchive(metadata, ciphertext);
  const outRel = options.out || `aiad-backup-${new Date().toISOString().slice(0, 10)}.aiad-backup`;
  const outAbs = join(racine, outRel);

  if (!options.dryRun) {
    if (!existsSync(dirname(outAbs))) mkdirSync(dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, archive);
  }

  const resultat = {
    path: outRel,
    files: fichiers.length,
    size: archive.length,
    plaintextSize: plaintext.length,
    manifest,
  };
  if (options.json) {
    process.stdout.write(JSON.stringify({
      path: outRel,
      files: fichiers.length,
      size: archive.length,
      plaintextSize: plaintext.length,
      dryRun: Boolean(options.dryRun),
    }, null, 2) + '\n');
  }
  return resultat;
}

/**
 * Restaure une archive dans un dossier cible (par défaut : la racine).
 *
 * Sécurité : refuse les chemins absolus ou contenant `..` (path traversal).
 *
 * @param {string} racine
 * @param {{ archive: string, password: string, out?: string, force?: boolean, dryRun?: boolean, json?: boolean }} options
 */
export function restore(racine, options = {}) {
  if (!options.archive) throw new Error('--archive <chemin> requis.');
  if (!options.password) throw new Error('Mot de passe requis (--password).');

  const archivePath = join(racine, options.archive);
  if (!existsSync(archivePath)) throw new Error(`Archive introuvable : ${options.archive}.`);
  const buffer = readFileSync(archivePath);
  const { metadata, ciphertext } = unpackArchive(buffer);

  if (metadata.version !== 1) {
    throw new Error(`Version d'archive ${metadata.version} non supportée (attendu 1).`);
  }

  const salt = Buffer.from(metadata.salt, 'base64');
  const iv = Buffer.from(metadata.iv, 'base64');
  const authTag = Buffer.from(metadata.authTag, 'base64');
  const key = deriverCle(options.password, salt, metadata.kdfIter || KDF_ITER);

  let plaintext;
  try {
    plaintext = dechiffrer(ciphertext, key, iv, authTag);
  } catch (err) {
    throw new Error(`Déchiffrement échoué : ${err.message}. Mot de passe incorrect ou archive altérée.`);
  }

  // Découpe selon le manifest
  const outBase = join(racine, options.out || '.');
  const fichiersRestaures = [];
  let offset = 0;
  for (const entry of metadata.manifest) {
    if (typeof entry.path !== 'string' || entry.path.includes('..') || entry.path.startsWith('/')) {
      throw new Error(`Path traversal détecté dans manifest : "${entry.path}".`);
    }
    const dest = join(outBase, entry.path);
    if (existsSync(dest) && !options.force) {
      throw new Error(`Fichier déjà existant : ${entry.path} (utilise --force pour écraser).`);
    }
    if (!options.dryRun) {
      if (!existsSync(dirname(dest))) mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, plaintext.slice(offset, offset + entry.size));
    }
    fichiersRestaures.push(entry.path);
    offset += entry.size;
  }

  const resultat = {
    files: fichiersRestaures.length,
    out: options.out || '.',
    createdAt: metadata.createdAt,
  };
  if (options.json) {
    process.stdout.write(JSON.stringify({
      ...resultat,
      manifest: metadata.manifest,
      dryRun: Boolean(options.dryRun),
    }, null, 2) + '\n');
  }
  return resultat;
}

/**
 * Inspecte une archive (sans déchiffrer) — métadonnées + manifest.
 */
export function inspecter(racine, options = {}) {
  if (!options.archive) throw new Error('--archive <chemin> requis.');
  const archivePath = join(racine, options.archive);
  if (!existsSync(archivePath)) throw new Error(`Archive introuvable : ${options.archive}.`);
  const buffer = readFileSync(archivePath);
  const { metadata, ciphertext } = unpackArchive(buffer);
  return {
    version: metadata.version,
    createdAt: metadata.createdAt,
    kdf: metadata.kdf,
    kdfIter: metadata.kdfIter,
    files: metadata.manifest.length,
    plaintextSize: metadata.manifest.reduce((s, m) => s + m.size, 0),
    ciphertextSize: ciphertext.length,
    sousDir: metadata.sousDir,
  };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  listerFichiers as listFiles,
  deriverCle as deriveKey,
  construirePayload as buildPayload,
  chiffrer as encrypt,
  dechiffrer as decrypt,
  packArchive as pack,
  unpackArchive as unpack,
  inspecter as inspect,
};

export const CONSTANTS = {
  MAGIC,
  KDF,
  KDF_ITER,
  ALGO,
  SALT_LEN,
  IV_LEN,
  KEY_LEN,
  TAG_LEN,
};
