import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { COLORS as COULEURS } from './term.js';
import { lireSanteDepuisDashboard, lirePublicationContextDepuisDashboard } from './doctor.js';
import { buildMeta } from './meta.js';

function check(condition) {
  return condition
    ? `${COULEURS.vert}OK${COULEURS.reset}`
    : `${COULEURS.rouge}--${COULEURS.reset}`;
}

function compterFichiersMd(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('_')).length;
}

const SENTINELLES = {
  'PRD.md': '[Titre fonctionnel court]',
  'ARCHITECTURE.md': '[max 5 principes]',
  'AGENT-GUIDE.md': '[Nom du projet]',
};

const NIVEAUX_MATURITE = [
  { score: 0, label: 'Non initialisé', couleur: COULEURS.rouge },
  { score: 1, label: 'Démarrage', couleur: COULEURS.jaune },
  { score: 2, label: 'Cadrage', couleur: COULEURS.jaune },
  { score: 3, label: 'Opérationnel', couleur: COULEURS.cyan },
  { score: 4, label: 'Actif', couleur: COULEURS.vert },
  { score: 5, label: 'Complet', couleur: COULEURS.vert },
];

/**
 * Collecte pure (pas d'I/O console). Retourne un modèle JSON-sérialisable
 * — utilisé par le rendu humain et par la sortie `--json`.
 */
export function collecterStatus(projetDir) {
  const aiadDir = join(projetDir, '.aiad');
  if (!existsSync(aiadDir)) {
    return { initialise: false, projetDir };
  }

  const fondamentaux = {};
  for (const nom of ['PRD.md', 'ARCHITECTURE.md', 'AGENT-GUIDE.md']) {
    const chemin = join(aiadDir, nom);
    const present = existsSync(chemin);
    let rempli = false;
    if (present) {
      const contenu = readFileSync(chemin, 'utf-8');
      const sentinelle = SENTINELLES[nom];
      rempli = sentinelle ? !contenu.includes(sentinelle) : true;
    }
    fondamentaux[nom] = { present, rempli };
  }

  const nbIntents = compterFichiersMd(join(aiadDir, 'intents'));
  const nbSpecs = compterFichiersMd(join(aiadDir, 'specs'));
  const nbGouv = compterFichiersMd(join(aiadDir, 'gouvernance'));

  const score = [
    fondamentaux['PRD.md'].rempli,
    fondamentaux['ARCHITECTURE.md'].rempli,
    fondamentaux['AGENT-GUIDE.md'].rempli,
    nbIntents > 0,
    nbSpecs > 0,
  ].filter(Boolean).length;

  return {
    initialise: true,
    projetDir,
    fondamentaux,
    cycle: { intents: nbIntents, specs: nbSpecs },
    infrastructure: {
      claudeMd: existsSync(join(projetDir, 'CLAUDE.md')),
      commands: existsSync(join(projetDir, '.claude', 'commands')),
      gouvernanceCount: nbGouv,
    },
    maturite: { score, total: 5, label: NIVEAUX_MATURITE[score].label },
  };
}

// (#302) Markdown rendering pour PR/Slack/Notion. Pattern cohérent avec
// brief --markdown (#269) et doctor --markdown (#301).
export function formatterStatusMarkdown(data) {
  const lignes = [];
  lignes.push('## 📋 AIAD SDD — Status');
  lignes.push('');
  if (!data.initialise) {
    lignes.push('> ⚠️ SDD Mode non initialisé. Lance `npx aiad-sdd init`.');
    return lignes.join('\n') + '\n';
  }
  // Table KPIs principaux
  lignes.push('| Métrique | Valeur |');
  lignes.push('|---|---|');
  const m = data.maturite;
  if (m?.score != null && m?.total != null) {
    lignes.push(`| 🎯 Maturité | **${m.score}/${m.total}** — ${m.label || ''} |`);
  }
  if (data.santeGlobale?.score != null) {
    const niveau = data.santeGlobale.niveau || 'n/a';
    const emoji = niveau === 'excellent' || niveau === 'sain' ? '🟢'
      : niveau === 'attention' ? '🟡' : '🔴';
    lignes.push(`| ${emoji} Santé | **${data.santeGlobale.score}/100** — ${niveau} |`);
  }
  lignes.push(`| 📥 Intents | ${data.cycle?.intents ?? 0} |`);
  lignes.push(`| 📋 SPECs | ${data.cycle?.specs ?? 0} |`);
  lignes.push(`| ⚖ Gouvernance Tier 1 | ${data.infrastructure?.gouvernanceCount ?? 0}/5 |`);
  lignes.push('');
  // Fondamentaux : statut par fichier
  const f = data.fondamentaux || {};
  const fondamentaux = ['PRD.md', 'ARCHITECTURE.md', 'AGENT-GUIDE.md']
    .filter((nom) => f[nom])
    .map((nom) => {
      const entry = f[nom];
      const emoji = entry.rempli ? '✅' : entry.present ? '⚠️' : '❌';
      const etat = entry.rempli ? 'rédigé' : entry.present ? 'template' : 'absent';
      return `${emoji} \`${nom}\` ${etat}`;
    });
  if (fondamentaux.length > 0) {
    lignes.push(`**Fondamentaux** : ${fondamentaux.join(' · ')}`);
    lignes.push('');
  }
  // (#347) Footer enrichi avec hyperlien dashboard si publicUrl publié
  // (symétrie #300 brief + #346 doctor). Réutilise publicationContext (#341).
  const url = data.publicationContext?.publicUrl
    ? String(data.publicationContext.publicUrl).replace(/\/+$/, '')
    : null;
  const dashCell = url ? `[dashboard](${url}/index.html)` : '`aiad-sdd dashboard --serve`';
  lignes.push(`_Projet : \`${data.projetDir || ''}\` · ${dashCell}_`);
  return lignes.join('\n') + '\n';
}

export async function showStatus(projetDir, options = {}) {
  const { json = false } = options;
  const data = collecterStatus(projetDir);

  // (#224) Score santé globale (#218) lu depuis dashboard/data.json.
  // Non-bloquant : null si dashboard pas encore généré. Import top-level
  // pour rester sync vis-à-vis des consommateurs qui font process.stdout.write
  // capture (cf #222 + bug introduit par dynamic import).
  data.santeGlobale = lireSanteDepuisDashboard(projetDir);

  // (#341) publicationContext exposé symétriquement à brief (#339) + doctor (#340).
  data.publicationContext = lirePublicationContextDepuisDashboard(projetDir);

  if (json) {
    // (#260) _meta cohérent avec dashboard/doctor/workspace/brief.
    const withMeta = { _meta: buildMeta({ schema: 'aiad-sdd-status' }), ...data };
    process.stdout.write(JSON.stringify(withMeta, null, 2) + '\n');
    return withMeta;
  }

  // (#302) Markdown mode : table pasteable PR/Slack/Notion.
  if (options.markdown) {
    process.stdout.write(formatterStatusMarkdown(data));
    return data;
  }

  if (!data.initialise) {
    console.log(`
${COULEURS.rouge}  SDD Mode non initialisé dans ce projet.${COULEURS.reset}
  Lancez : ${COULEURS.cyan}npx aiad-sdd init${COULEURS.reset}
`);
    return data;
  }

  const f = data.fondamentaux;
  const etiquette = (entry, present) => {
    if (entry.rempli) return COULEURS.vert + 'rédigé';
    if (entry.present) return COULEURS.jaune + 'template';
    return COULEURS.gris + 'absent';
  };

  const niveau = NIVEAUX_MATURITE[data.maturite.score];
  const barre = '█'.repeat(data.maturite.score) + '░'.repeat(5 - data.maturite.score);

  console.log(`
${COULEURS.cyan}${COULEURS.gras}  AIAD SDD Mode — État du projet${COULEURS.reset}
${COULEURS.gris}  ${data.projetDir}${COULEURS.reset}

${COULEURS.gras}  Artefacts fondamentaux${COULEURS.reset}

  ${check(f['PRD.md'].present)}  PRD.md              ${etiquette(f['PRD.md'])}${COULEURS.reset}
  ${check(f['ARCHITECTURE.md'].present)}  ARCHITECTURE.md     ${etiquette(f['ARCHITECTURE.md'])}${COULEURS.reset}
  ${check(f['AGENT-GUIDE.md'].present)}  AGENT-GUIDE.md      ${etiquette(f['AGENT-GUIDE.md'])}${COULEURS.reset}

${COULEURS.gras}  Cycle SDD${COULEURS.reset}

  Intent Statements    ${COULEURS.cyan}${data.cycle.intents}${COULEURS.reset} actif(s)
  SPECs                ${COULEURS.cyan}${data.cycle.specs}${COULEURS.reset} active(s)

${COULEURS.gras}  Infrastructure${COULEURS.reset}

  ${check(data.infrastructure.claudeMd)}  CLAUDE.md           ${data.infrastructure.claudeMd ? COULEURS.vert + 'configuré' : COULEURS.gris + 'absent'}${COULEURS.reset}
  ${check(data.infrastructure.commands)}  Commandes Claude    ${data.infrastructure.commands ? COULEURS.vert + 'installées' : COULEURS.gris + 'absentes'}${COULEURS.reset}
  ${check(data.infrastructure.gouvernanceCount >= 4)}  Gouvernance         ${COULEURS.cyan}${data.infrastructure.gouvernanceCount}${COULEURS.reset} agent(s) Tier 1

${COULEURS.gras}  Maturité SDD${COULEURS.reset}

  ${niveau.couleur}${barre} ${niveau.label}${COULEURS.reset} ${COULEURS.gris}(${data.maturite.score}/5)${COULEURS.reset}
`);
  // (#224) Score santé globale (#218) si dashboard généré
  if (data.santeGlobale) {
    const s = data.santeGlobale;
    const couleurSante = s.niveau === 'excellent' || s.niveau === 'sain'
      ? COULEURS.vert
      : s.niveau === 'attention'
      ? COULEURS.jaune
      : COULEURS.rouge;
    console.log(`${COULEURS.gras}  Santé projet${COULEURS.reset}\n`);
    console.log(`  ${couleurSante}${COULEURS.gras}${s.score}/100${COULEURS.reset} ${COULEURS.gris}— ${s.niveau || 'inconnu'} (${s.composantesDisponibles}/${s.breakdown?.length || 0} composantes)${COULEURS.reset}`);
    console.log(`  ${COULEURS.gris}Détail : aiad-sdd doctor${COULEURS.reset}\n`);
  } else {
    console.log(`${COULEURS.gris}  Santé projet — non calculée. Lance ${COULEURS.cyan}aiad-sdd dashboard${COULEURS.reset}${COULEURS.gris} pour activer le score #218.${COULEURS.reset}\n`);
  }
  return data;
}
