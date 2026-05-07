import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const COULEURS = {
  vert: '\x1b[32m',
  jaune: '\x1b[33m',
  rouge: '\x1b[31m',
  cyan: '\x1b[36m',
  gris: '\x1b[90m',
  gras: '\x1b[1m',
  reset: '\x1b[0m',
};

// ~4 chars/token (estimation conservatrice pour Claude tokenizer sur du français)
const CHARS_PER_TOKEN = 4;

function extraireFrontmatter(contenu) {
  if (!contenu.startsWith('---')) return null;
  const fin = contenu.indexOf('\n---', 3);
  if (fin === -1) return null;
  return contenu.slice(0, fin + 4);
}

function lireCommandes(dossier) {
  if (!existsSync(dossier)) return [];
  const resultats = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    const stat = statSync(chemin);
    if (stat.isDirectory()) {
      resultats.push(...lireCommandes(chemin));
    } else if (nom.endsWith('.md')) {
      const contenu = readFileSync(chemin, 'utf-8');
      const fm = extraireFrontmatter(contenu);
      resultats.push({
        chemin,
        nom: nom.replace(/\.md$/, ''),
        frontmatterBytes: fm ? Buffer.byteLength(fm, 'utf-8') : 0,
        totalBytes: Buffer.byteLength(contenu, 'utf-8'),
      });
    }
  }
  return resultats;
}

export function bench(projetDir = process.cwd()) {
  const commandsDir = join(projetDir, '.claude', 'commands');
  if (!existsSync(commandsDir)) {
    console.log(`${COULEURS.rouge}✗ Aucun dossier .claude/commands/ trouvé dans ${projetDir}${COULEURS.reset}`);
    process.exit(1);
  }

  const commandes = lireCommandes(commandsDir);

  // Tri : routers d'abord (sdd, aiad, aiad-help), puis alias
  const routers = commandes.filter((c) => ['sdd', 'aiad', 'aiad-help'].includes(c.nom));
  const alias = commandes.filter((c) => !routers.includes(c));

  const totalFrontmatterBytes = commandes.reduce((s, c) => s + c.frontmatterBytes, 0);
  const totalTokensApprox = Math.ceil(totalFrontmatterBytes / CHARS_PER_TOKEN);

  // Estimation "avant" : on simule l'état pré-router (frontmatter moyen pré-refactor)
  // On lit aussi .claude/sdd/ et .claude/aiad/ s'ils existent, qui représentent
  // ce qui SERAIT chargé si tout était dans commands/ (état "avant").
  const sddDir = join(projetDir, '.claude', 'sdd');
  const aiadDir = join(projetDir, '.claude', 'aiad');
  const subSdd = lireCommandes(sddDir);
  const subAiad = lireCommandes(aiadDir);

  // Avant : alias + sub-sdd + sub-aiad (tous dans commands/ équivalent)
  const avantBytes = alias.reduce((s, c) => s + c.frontmatterBytes, 0)
    + subSdd.reduce((s, c) => s + c.frontmatterBytes, 0)
    + subAiad.reduce((s, c) => s + c.frontmatterBytes, 0);
  const avantTokens = Math.ceil(avantBytes / CHARS_PER_TOKEN);

  // Après transition (alias supprimés) : seuls les routers restent dans commands/
  const apresBytes = routers.reduce((s, c) => s + c.frontmatterBytes, 0);
  const apresTokens = Math.ceil(apresBytes / CHARS_PER_TOKEN);

  // Phase transition (alias + routers en commands/)
  const transitionBytes = totalFrontmatterBytes;
  const transitionTokens = totalTokensApprox;

  const reductionFinalePct = avantBytes ? Math.round(((avantBytes - apresBytes) / avantBytes) * 100) : 0;
  const reductionTransitionPct = avantBytes ? Math.round(((avantBytes - transitionBytes) / avantBytes) * 100) : 0;

  console.log(`
${COULEURS.cyan}${COULEURS.gras}  Cold-start system prompt — frontmatter weight${COULEURS.reset}
${COULEURS.gris}  Estimation : 1 token ≈ ${CHARS_PER_TOKEN} caractères${COULEURS.reset}
`);

  console.log(`${COULEURS.gras}  État courant (.claude/commands/)${COULEURS.reset}`);
  console.log(`    Routers (${routers.length})            : ${COULEURS.cyan}${routers.reduce((s, c) => s + c.frontmatterBytes, 0)} B${COULEURS.reset}`);
  console.log(`    Alias rétro-compat (${alias.length})    : ${COULEURS.jaune}${alias.reduce((s, c) => s + c.frontmatterBytes, 0)} B${COULEURS.reset}`);
  console.log(`    Total chargé à froid       : ${COULEURS.gras}${transitionBytes} B (~${transitionTokens} tokens)${COULEURS.reset}\n`);

  console.log(`${COULEURS.gras}  Comparatif${COULEURS.reset}`);
  console.log(`    AVANT (27 cmds plates)     : ${avantBytes} B (~${avantTokens} tokens)`);
  console.log(`    PENDANT transition         : ${transitionBytes} B (~${transitionTokens} tokens) — ${reductionTransitionPct >= 0 ? COULEURS.vert : COULEURS.rouge}${reductionTransitionPct >= 0 ? '−' : '+'}${Math.abs(reductionTransitionPct)}%${COULEURS.reset}`);
  console.log(`    APRÈS retrait alias (v2)   : ${apresBytes} B (~${apresTokens} tokens) — ${COULEURS.vert}−${reductionFinalePct}%${COULEURS.reset}`);

  const cible = 70;
  if (reductionFinalePct >= cible) {
    console.log(`\n${COULEURS.vert}✓ Cible -${cible}% atteinte (réduction finale : -${reductionFinalePct}%)${COULEURS.reset}`);
  } else if (reductionFinalePct >= 50) {
    console.log(`\n${COULEURS.jaune}~ Cible -50% atteinte (réduction finale : -${reductionFinalePct}%) ; cible -${cible}% non atteinte${COULEURS.reset}`);
  } else {
    console.log(`\n${COULEURS.rouge}✗ Cible -50% non atteinte (réduction finale : -${reductionFinalePct}%)${COULEURS.reset}`);
  }

  console.log(`\n${COULEURS.gris}  Sub-commandes (corps chargés à la demande, hors system prompt) :${COULEURS.reset}`);
  console.log(`    .claude/sdd/  : ${subSdd.length} commandes, ${subSdd.reduce((s, c) => s + c.totalBytes, 0)} B au total`);
  console.log(`    .claude/aiad/ : ${subAiad.length} commandes, ${subAiad.reduce((s, c) => s + c.totalBytes, 0)} B au total`);
  console.log('');

  return { avantBytes, transitionBytes, apresBytes, reductionFinalePct, reductionTransitionPct };
}
