// AIAD SDD Mode — Registre des packs de gouvernance par juridiction.
//
// Le pack par défaut reste **eu-baseline** (4 agents : AI-ACT, RGPD, RGAA,
// RGESN). Les packs `us-baseline` et `uk-baseline` sont des extensions
// optionnelles pour étendre l'adressabilité aux marchés US et UK sans
// renier le positionnement leader EU/FR du framework.
//
// Cap stratégique : le défaut sans `--pack` reste eu-baseline. Les autres
// packs s'installent en *plus* des artefacts du projet, jamais en
// remplacement automatique.
//
// Documentation : https://aiad.ovh

import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C, log, logHeader } from './term.js';
import { copyFile as copierFichier, ensureDir } from './fs-ops.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

export const PACKS = {
  'eu-baseline': {
    titre: 'EU Baseline (défaut, leader)',
    description: 'AI-ACT · RGPD · RGAA · RGESN · CRA — référentiel européen complet',
    juridiction: 'Union européenne',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance'),
    defaut: true,
  },
  'us-baseline': {
    titre: 'US Baseline (extension)',
    description: 'SOC 2 · HIPAA · ADA · NIST AI RMF — couvre sécurité, santé, accessibilité, IA',
    juridiction: 'États-Unis',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'us-baseline'),
    defaut: false,
  },
  'uk-baseline': {
    titre: 'UK Baseline (extension)',
    description: 'UK DPA · UK Equality · UK AI Principles · UK SECR — pendant britannique',
    juridiction: 'Royaume-Uni',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'uk-baseline'),
    defaut: false,
  },
  'eu-financial': {
    titre: 'EU Financial (sectoriel)',
    description: 'DORA · PSD2 · MiCA · SFDR — banques, assurances, fintechs, CASP crypto',
    juridiction: 'Union européenne — secteur financier',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'eu-financial'),
    defaut: false,
  },
  'de-bsi': {
    titre: 'Deutschland — BSI / BDSG (extension)',
    description: 'BSI IT-Grundschutz · BSI C5 · BDSG · BfDI Employee — marché allemand exigeant',
    juridiction: 'Allemagne',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'de-bsi'),
    defaut: false,
  },
  'es-aepd': {
    titre: 'España — AEPD / ENS (extension)',
    description: 'AEPD · LOPDGDD · ENS · CCN-STIC — marché espagnol public et privé',
    juridiction: 'Espagne',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'es-aepd'),
    defaut: false,
  },
  'eu-platforms': {
    titre: 'EU Platforms (sectoriel)',
    description: 'DSA — plateformes en ligne, marketplaces, hébergeurs, VLOP/VLOSE (Règlement UE 2022/2065)',
    juridiction: 'Union européenne — plateformes intermédiaires',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'eu-platforms'),
    defaut: false,
  },
  'iso-standards': {
    titre: 'ISO Standards (certification)',
    description: 'ISO/IEC 42001 — système de management IA certifiable (complément de l\'AI Act réglementaire)',
    juridiction: 'International (certification)',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'iso-standards'),
    defaut: false,
  },
  'ch-fadp': {
    titre: 'Suisse — nLPD / FADP révisée (extension)',
    description: 'nLPD / FADP révisée (1er sept 2023) — décision adéquation UE↔CH, sanctions personnelles pénales CHF 250 000',
    juridiction: 'Suisse',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'ch-fadp'),
    defaut: false,
  },
  'it-agid': {
    titre: 'Italia — AGID (extension)',
    description: 'AGID + CAD + Linee Guida AI 2024 + PagoPA + SPID/CIE — PA italienne et services publics',
    juridiction: 'Italie',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'it-agid'),
    defaut: false,
  },
  'nl-ap': {
    titre: 'Nederland — AP / BIO / Algoritmeregister (extension)',
    description: 'Autoriteit Persoonsgegevens + UAVG + BIO + Algorithm Register — précurseur EU sur les algorithmes publics',
    juridiction: 'Pays-Bas',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'nl-ap'),
    defaut: false,
  },
  'be-apd': {
    titre: 'Belgique — APD / GBA (extension)',
    description: 'APD/GBA + Loi 30 juillet 2018 + CCT 81 — trilinguisme FR/NL/DE, doctrine cookies stricte',
    juridiction: 'Belgique',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'be-apd'),
    defaut: false,
  },
  'fr-anssi': {
    titre: 'France — ANSSI / PASSI / SecNumCloud (extension)',
    description: 'RGS v2.0 + PASSI + SecNumCloud + Homologation — souveraineté FR, ESN, banques, marchés publics',
    juridiction: 'France',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'fr-anssi'),
    defaut: false,
  },
  'apac-baseline': {
    titre: 'APAC Baseline — JP-APPI / SG-PDPA / AU-Privacy (extension)',
    description: 'Japon APPI 2022 + Singapour PDPA 2020 + Australie Privacy Act + APPs — SaaS EU à activité APAC',
    juridiction: 'Asie-Pacifique (JP/SG/AU)',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'apac-baseline'),
    defaut: false,
  },
  'latam-baseline': {
    titre: 'LATAM Baseline — BR-LGPD / MX-LFPDPPP (extension)',
    description: 'Brésil LGPD 2018 + Mexique LFPDPPP 2010 + Reglamento — SaaS EU à activité Amérique latine',
    juridiction: 'Amérique latine (BR/MX)',
    sourceDir: join(TEMPLATES_DIR, '.aiad', 'gouvernance-packs', 'latam-baseline'),
    defaut: false,
  },
};

export function listerPacks() {
  return Object.entries(PACKS).map(([id, meta]) => ({ id, ...meta }));
}

export function packExiste(id) {
  return Object.prototype.hasOwnProperty.call(PACKS, id);
}

/**
 * Installe un pack de gouvernance dans le projet.
 *
 * @param {string} racine
 * @param {string} packId — clé valide de PACKS
 * @param {{ force?: boolean, dryRun?: boolean, silencieux?: boolean }} [options]
 * @returns {Promise<{ pack: string, agents: string[], created: number, updated: number, preserved: number }>}
 */
export async function installerPack(racine, packId, options = {}) {
  const { force = false, dryRun = false, silencieux = false } = options;
  const pack = PACKS[packId];
  if (!pack) throw new Error(`Pack inconnu : "${packId}". Disponibles : ${Object.keys(PACKS).join(', ')}`);

  if (!silencieux) {
    logHeader(`Pack gouvernance — ${pack.titre}`, `${pack.description}\n  Juridiction : ${pack.juridiction}`);
  }

  if (!existsSync(pack.sourceDir)) {
    throw new Error(`Templates du pack introuvables : ${pack.sourceDir}`);
  }

  const destDir = join(racine, '.aiad', 'gouvernance');
  ensureDir(destDir, { dryRun });

  const stats = { created: 0, updated: 0, preserved: 0, unchanged: 0 };
  const agents = [];

  for (const f of readdirSync(pack.sourceDir)) {
    if (!f.endsWith('.md') || f.startsWith('_')) continue;
    const src = join(pack.sourceDir, f);
    const dst = join(destDir, f);
    const result = copierFichier(src, dst, { force, preserve: !force, dryRun });
    stats[result] = (stats[result] || 0) + 1;
    agents.push(f.replace(/\.md$/, ''));
    if (!silencieux) {
      const sym = result === 'created'
        ? `${C.vert}+${C.reset}`
        : result === 'updated'
          ? `${C.cyan}↑${C.reset}`
          : result === 'preserved'
            ? `${C.jaune}~${C.reset}`
            : `${C.vert}✓${C.reset}`;
      const suffixe = dryRun ? ` ${C.gris}(dry-run)${C.reset}` : '';
      log(sym, `${f}${suffixe} ${C.gris}(${result})${C.reset}`);
    }
  }

  if (!silencieux) {
    console.log(`
${C.gras}  Pack ${packId} ${dryRun ? 'aperçu' : 'installé'}${C.reset}
  ${C.vert}+${C.reset} ${stats.created}    ${C.cyan}↑${C.reset} ${stats.updated}    ${C.jaune}~${C.reset} ${stats.preserved} préservé(s)
`);
  }

  return { pack: packId, agents, ...stats };
}

// ─── Alias EN canoniques (item #42) ─────────────────────────────────────────
export {
  installerPack as installPack,
  listerPacks as listPacks,
  packExiste as packExists,
};
