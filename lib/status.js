import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const COULEURS = {
  vert: '\x1b[32m',
  rouge: '\x1b[31m',
  jaune: '\x1b[33m',
  cyan: '\x1b[36m',
  gris: '\x1b[90m',
  gras: '\x1b[1m',
  reset: '\x1b[0m',
};

function check(condition) {
  return condition
    ? `${COULEURS.vert}OK${COULEURS.reset}`
    : `${COULEURS.rouge}--${COULEURS.reset}`;
}

function compterFichiersMd(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('_')).length;
}

export async function showStatus(projetDir) {
  const aiadDir = join(projetDir, '.aiad');

  if (!existsSync(aiadDir)) {
    console.log(`
${COULEURS.rouge}  SDD Mode non initialisé dans ce projet.${COULEURS.reset}
  Lancez : ${COULEURS.cyan}npx aiad-sdd init${COULEURS.reset}
`);
    return;
  }

  const hasPrd = existsSync(join(aiadDir, 'PRD.md'));
  const hasArchi = existsSync(join(aiadDir, 'ARCHITECTURE.md'));
  const hasGuide = existsSync(join(aiadDir, 'AGENT-GUIDE.md'));
  const hasClaude = existsSync(join(projetDir, 'CLAUDE.md'));
  const hasCommands = existsSync(join(projetDir, '.claude', 'commands'));

  const nbIntents = compterFichiersMd(join(aiadDir, 'intents'));
  const nbSpecs = compterFichiersMd(join(aiadDir, 'specs'));
  const nbGouv = compterFichiersMd(join(aiadDir, 'gouvernance'));

  // Vérifier le contenu du PRD (non-template)
  let prdRempli = false;
  if (hasPrd) {
    const contenu = readFileSync(join(aiadDir, 'PRD.md'), 'utf-8');
    prdRempli = !contenu.includes('[Titre fonctionnel court]');
  }

  let archiRempli = false;
  if (hasArchi) {
    const contenu = readFileSync(join(aiadDir, 'ARCHITECTURE.md'), 'utf-8');
    archiRempli = !contenu.includes('[max 5 principes]');
  }

  let guideRempli = false;
  if (hasGuide) {
    const contenu = readFileSync(join(aiadDir, 'AGENT-GUIDE.md'), 'utf-8');
    guideRempli = !contenu.includes('[Nom du projet]');
  }

  console.log(`
${COULEURS.cyan}${COULEURS.gras}  AIAD SDD Mode — État du projet${COULEURS.reset}
${COULEURS.gris}  ${projetDir}${COULEURS.reset}

${COULEURS.gras}  Artefacts fondamentaux${COULEURS.reset}

  ${check(hasPrd)}  PRD.md              ${prdRempli ? COULEURS.vert + 'rédigé' : hasPrd ? COULEURS.jaune + 'template' : COULEURS.gris + 'absent'}${COULEURS.reset}
  ${check(hasArchi)}  ARCHITECTURE.md     ${archiRempli ? COULEURS.vert + 'rédigé' : hasArchi ? COULEURS.jaune + 'template' : COULEURS.gris + 'absent'}${COULEURS.reset}
  ${check(hasGuide)}  AGENT-GUIDE.md      ${guideRempli ? COULEURS.vert + 'rédigé' : hasGuide ? COULEURS.jaune + 'template' : COULEURS.gris + 'absent'}${COULEURS.reset}

${COULEURS.gras}  Cycle SDD${COULEURS.reset}

  Intent Statements    ${COULEURS.cyan}${nbIntents}${COULEURS.reset} actif(s)
  SPECs                ${COULEURS.cyan}${nbSpecs}${COULEURS.reset} active(s)

${COULEURS.gras}  Infrastructure${COULEURS.reset}

  ${check(hasClaude)}  CLAUDE.md           ${hasClaude ? COULEURS.vert + 'configuré' : COULEURS.gris + 'absent'}${COULEURS.reset}
  ${check(hasCommands)}  Commandes Claude    ${hasCommands ? COULEURS.vert + 'installées' : COULEURS.gris + 'absentes'}${COULEURS.reset}
  ${check(nbGouv >= 4)}  Gouvernance         ${COULEURS.cyan}${nbGouv}${COULEURS.reset} agent(s) Tier 1

${COULEURS.gras}  Maturité SDD${COULEURS.reset}

  ${getMaturite(hasPrd, prdRempli, hasArchi, archiRempli, hasGuide, guideRempli, nbIntents, nbSpecs)}
`);
}

function getMaturite(hasPrd, prdRempli, hasArchi, archiRempli, hasGuide, guideRempli, nbIntents, nbSpecs) {
  const score = [prdRempli, archiRempli, guideRempli, nbIntents > 0, nbSpecs > 0]
    .filter(Boolean).length;

  const niveaux = [
    { seuil: 0, label: 'Non initialisé', couleur: COULEURS.rouge },
    { seuil: 1, label: 'Démarrage', couleur: COULEURS.jaune },
    { seuil: 2, label: 'Cadrage', couleur: COULEURS.jaune },
    { seuil: 3, label: 'Opérationnel', couleur: COULEURS.cyan },
    { seuil: 4, label: 'Actif', couleur: COULEURS.vert },
    { seuil: 5, label: 'Complet', couleur: COULEURS.vert },
  ];

  const niveau = niveaux[score];
  const barre = '█'.repeat(score) + '░'.repeat(5 - score);

  return `${niveau.couleur}${barre} ${niveau.label}${COULEURS.reset} ${COULEURS.gris}(${score}/5)${COULEURS.reset}`;
}
