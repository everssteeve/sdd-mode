// AIAD SDD Mode — Commande `uninstall`.
//
// Retire proprement les artefacts générés par aiad-sdd d'un projet, sans
// jamais toucher au contenu créé par l'humain (Intent Statements, SPECs
// rédigées, PRD/ARCHITECTURE/AGENT-GUIDE personnalisés, facts capturés,
// metrics).
//
// Politique de sécurité (destructive — il faut être explicite) :
//   - Sans flag → mode aperçu (--dry-run implicite). Affiche ce qui serait
//     supprimé, n'écrit rien.
//   - --force → exécute la désinstallation framework (commandes slash,
//     skills, gouvernance, AGENTS.md, GEMINI.md, fichiers Cursor/Codex,
//     hooks AIAD, header CLAUDE.md). Préserve les artefacts métier.
//   - --purge --force → supprime AUSSI `.aiad/` complet (incluant artefacts
//     métier). Demande explicite et irréversible.
//
// Documentation : https://aiad.ovh

import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { C, log, logHeader } from './term.js';
import { ROLE_SKILLS, fichiersAgents } from './agents-registry.js';
import { COMMANDES_CONSERVEES, listerAliasPlats } from './alias-retirement.js';
import { retirerHooksAiad, scriptsHooksCables } from './claude-settings.js';
import { BLOC_DEBUT, retirerSectionSdd } from './claude-md.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

// Marqueurs de fichiers générés par aiad-sdd. On ne touche que ce qui porte
// l'une de ces signatures côté contenu (idempotence forte).
const HEADER_REGEN = '<!-- DO NOT EDIT — regenerate via /aiad-emit-rules -->';
const HEADER_HASH_REGEN = '# DO NOT EDIT — regenerate via /aiad-emit-rules';
const CLAUDE_HEADER_START = '<!-- aiad-emit-rules:start -->';
const CLAUDE_HEADER_END = '<!-- aiad-emit-rules:end -->';

const SKILLS_AIAD = [
  'human-authorship-check', 'regulatory-veto', 'drift-detection',
  'sqs-scoring', 'context-budget', 'reasons-canvas', 'ears-validator',
  'traceability', 'grill-me',
  ...ROLE_SKILLS,
];
// Workflows livrés : la liste suit le gabarit, elle n'est pas recopiée ici.
function workflowsLivres() {
  const dir = join(TEMPLATES_DIR, '.github', 'workflows');
  try { return readdirSync(dir).filter((f) => f.endsWith('.yml')); } catch { return []; }
}

// Un fichier de `.github/` n'est retiré que s'il est identique à celui livré :
// un workflow adapté par l'équipe lui appartient.
function identiqueAuGabarit(racine, relatif) {
  try {
    return readFileSync(join(racine, relatif), 'utf-8') === readFileSync(join(TEMPLATES_DIR, relatif), 'utf-8');
  } catch { return false; }
}

function rel(racine, p) { return relative(racine, p); }

function fichierGenereParEmit(path) {
  if (!existsSync(path)) return false;
  try {
    const c = readFileSync(path, 'utf-8');
    return c.includes(HEADER_REGEN) || c.includes(HEADER_HASH_REGEN);
  } catch { return false; }
}

/**
 * Énumère les opérations de suppression à effectuer sans rien toucher.
 * Retourne un tableau d'actions `{ type, path, raison }`.
 */
export function planifier(racine, options = {}) {
  const { purge = false } = options;
  const actions = [];

  const ajouter = (type, path, raison) => actions.push({ type, path, raison });

  // 1. Commandes slash AIAD/SDD dans .claude/commands/
  const cmdDir = join(racine, '.claude', 'commands');
  if (existsSync(cmdDir)) {
    // Routers et aide : livrés sous ces noms exacts. Alias plats v1.x : seuls
    // ceux reconnaissables comme livrés. Une commande du projet nommée
    // `sdd-*.md` ou `aiad-*.md` n'est jamais supprimée.
    for (const f of COMMANDES_CONSERVEES) {
      if (existsSync(join(cmdDir, f))) ajouter('file', join(cmdDir, f), 'commande slash AIAD/SDD');
    }
    for (const a of listerAliasPlats(racine)) {
      ajouter('file', join(racine, a.fichier), 'alias plat v1.x');
    }
  }

  // 2. Sous-commandes routers : .claude/sdd/ et .claude/aiad/
  for (const d of ['.claude/sdd', '.claude/aiad']) {
    const p = join(racine, d);
    if (existsSync(p)) ajouter('dir', p, 'sous-commandes routers');
  }

  // 3. Skills AIAD
  const skillsDir = join(racine, '.claude', 'skills');
  if (existsSync(skillsDir)) {
    for (const s of SKILLS_AIAD) {
      const p = join(skillsDir, s);
      if (existsSync(p)) ajouter('dir', p, `skill AIAD : ${s}`);
    }
  }

  // 3.bis Agents de rôle et sous-agents (registre) — les agents ajoutés par le
  //       projet et les agents de gouvernance générés ne sont pas touchés ici.
  for (const f of fichiersAgents()) {
    const p = join(racine, f);
    if (existsSync(p)) ajouter('file', p, 'agent de rôle / sous-agent AIAD');
  }

  // 3.ter Agents de gouvernance, règles et steering générés par emit-rules
  //       (reconnus à leur en-tête de génération, jamais à leur seul nom).
  for (const [dossier, filtre] of [
    ['.claude/agents', (f) => f.startsWith('AIAD-') && f.endsWith('.md')],
    ['.claude/rules', (f) => f.endsWith('.md')],
    ['.kiro/steering', (f) => f.startsWith('aiad') && f.endsWith('.md')],
  ]) {
    const d = join(racine, dossier);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      if (filtre(f) && fichierGenereParEmit(p)) ajouter('file', p, 'fichier généré par emit-rules');
    }
  }

  // 3.quater Hooks AIAD câblés dans .claude/settings.json : retirés, les
  //          réglages de l'utilisateur restent.
  const settings = join(racine, '.claude', 'settings.json');
  if (existsSync(settings)) {
    try {
      const contenu = JSON.parse(readFileSync(settings, 'utf-8'));
      if (scriptsHooksCables(contenu).length > 0) {
        ajouter('settings', settings, 'hooks AIAD de .claude/settings.json (réglages utilisateur conservés)');
      }
    } catch { /* JSON illisible : on ne touche pas au fichier de l'utilisateur */ }
  }

  // 4. Fichiers générés multi-runtime (AGENTS.md / GEMINI.md / .cursor/ / .codex/)
  for (const f of ['AGENTS.md', 'GEMINI.md']) {
    const p = join(racine, f);
    if (fichierGenereParEmit(p)) ajouter('file', p, 'fichier généré par emit-rules');
  }
  const cursorRules = join(racine, '.cursor', 'rules');
  if (existsSync(cursorRules)) {
    for (const f of readdirSync(cursorRules)) {
      if (f.startsWith('aiad') && f.endsWith('.mdc')) {
        ajouter('file', join(cursorRules, f), 'règle Cursor AIAD');
      }
    }
  }
  const codexAgent = join(racine, '.codex', 'AGENT.md');
  if (fichierGenereParEmit(codexAgent)) ajouter('file', codexAgent, 'agent Codex AIAD');

  // 5. Hooks AIAD (.git/hooks/pre-commit & .husky/pre-commit qui contiennent
  //    notre marqueur). Les scripts sources dans .aiad/hooks/ partent avec le
  //    purge ou via la suppression du dossier .aiad/ ; en mode framework, on
  //    laisse .aiad/hooks/ pour ne pas casser un hook installé via husky qui
  //    pointerait dessus, mais on retire le wrapper Git.
  for (const candidat of [
    join(racine, '.git', 'hooks', 'pre-commit'),
    join(racine, '.husky', 'pre-commit'),
  ]) {
    if (existsSync(candidat)) {
      try {
        if (readFileSync(candidat, 'utf-8').includes('AIAD SDD Mode')) {
          ajouter('file', candidat, 'wrapper hook pre-commit AIAD');
        }
      } catch { /* ignore */ }
    }
  }

  // 6. Workflows GitHub déployés par aiad-sdd init.
  const wfDir = join(racine, '.github', 'workflows');
  if (existsSync(wfDir)) {
    for (const w of workflowsLivres()) {
      const p = join(wfDir, w);
      if (existsSync(p) && identiqueAuGabarit(racine, join('.github', 'workflows', w))) {
        ajouter('file', p, 'workflow CI AIAD');
      }
    }
  }
  const manifesteApp = join('.github', 'aiad-app-manifest.yml');
  if (existsSync(join(racine, manifesteApp)) && identiqueAuGabarit(racine, manifesteApp)) {
    ajouter('file', join(racine, manifesteApp), 'manifeste GitHub App AIAD');
  }

  // 7. Header CLAUDE.md (entre sentinels) — on l'efface mais on conserve le
  // reste du fichier, qui peut contenir des règles utilisateur.
  const claudeMd = join(racine, 'CLAUDE.md');
  if (existsSync(claudeMd)) {
    const c = readFileSync(claudeMd, 'utf-8');
    const re = new RegExp(`${CLAUDE_HEADER_START}[\\s\\S]*?${CLAUDE_HEADER_END}\\n*`, 'm');
    if (re.test(c) || c.includes(BLOC_DEBUT) || /^# SDD Mode/m.test(c)) {
      ajouter('claude-md', claudeMd, 'header / section SDD Mode du CLAUDE.md');
    }
  }

  // 8. Avec --purge : supprime aussi .aiad/ complet (artefacts métier inclus).
  if (purge) {
    const aiadDir = join(racine, '.aiad');
    if (existsSync(aiadDir)) ajouter('dir', aiadDir, 'PURGE — incluant artefacts métier (.aiad/)');
  }

  return actions;
}

function appliquer(action, dryRun) {
  if (dryRun) return;
  if (action.type === 'file') {
    rmSync(action.path, { force: true });
  } else if (action.type === 'dir') {
    rmSync(action.path, { recursive: true, force: true });
  } else if (action.type === 'claude-md') {
    const c = readFileSync(action.path, 'utf-8');
    let nouveau = c.replace(
      new RegExp(`${CLAUDE_HEADER_START}[\\s\\S]*?${CLAUDE_HEADER_END}\\n*`, 'm'),
      '',
    );
    // Section SDD Mode : seul le bloc posé par l'outil part. Le texte de
    // l'équipe, avant comme après, est conservé.
    let gabarit = '';
    try { gabarit = readFileSync(join(TEMPLATES_DIR, 'CLAUDE.md'), 'utf-8'); } catch { /* gabarit absent */ }
    const r = retirerSectionSdd(nouveau, gabarit);
    nouveau = r.contenu;
    if (!r.retire && /^# SDD Mode/m.test(nouveau)) action.nonRetire = true;
    if (nouveau.trim() === '') rmSync(action.path, { force: true });
    else writeFileSync(action.path, nouveau, 'utf-8');
  } else if (action.type === 'settings') {
    const nettoye = retirerHooksAiad(JSON.parse(readFileSync(action.path, 'utf-8')));
    // Fichier posé tel quel par `init` (aucun réglage de l'utilisateur) :
    // ce qui reste est le gabarit sans ses hooks → le fichier part en entier.
    let resteGabarit = null;
    try {
      resteGabarit = retirerHooksAiad(JSON.parse(readFileSync(join(TEMPLATES_DIR, '.claude', 'settings.json'), 'utf-8')));
    } catch { /* gabarit illisible : on garde le fichier nettoyé */ }
    const identique = resteGabarit && JSON.stringify(nettoye) === JSON.stringify(resteGabarit);
    if (Object.keys(nettoye).length === 0 || identique) rmSync(action.path, { force: true });
    else writeFileSync(action.path, JSON.stringify(nettoye, null, 2) + '\n', 'utf-8');
  }
}

/**
 * Désinstalle aiad-sdd d'un projet.
 *
 * @param {string} racine
 * @param {{ force?: boolean, purge?: boolean, dryRun?: boolean }} [options]
 * @returns {Promise<{ actions: object[], appliquees: number }>}
 */
export async function uninstall(racine, options = {}) {
  const { force = false, purge = false, dryRun = false } = options;
  const apercu = !force || dryRun;

  logHeader(
    `AIAD SDD Mode — Désinstallation${purge ? ' (PURGE complète)' : ''}`,
    apercu ? 'Mode aperçu — aucune écriture' : 'Mode exécution — destructif',
  );

  const actions = planifier(racine, { purge });
  if (actions.length === 0) {
    console.log(`  ${C.gris}Rien à supprimer — aiad-sdd n'est pas installé dans ce projet.${C.reset}\n`);
    return { actions, appliquees: 0 };
  }

  for (const a of actions) {
    const sym = apercu ? `${C.gris}-${C.reset}` : `${C.rouge}✗${C.reset}`;
    log(sym, `${C.gras}${rel(racine, a.path)}${C.reset} ${C.gris}— ${a.raison}${C.reset}`);
  }

  if (apercu) {
    console.log(`
${C.jaune}${C.gras}  ${actions.length} action(s) prévue(s) — aucun changement appliqué.${C.reset}
${C.gris}  Pour exécuter : ${C.reset}${C.cyan}npx aiad-sdd uninstall --force${C.reset}${purge ? '' : `\n${C.gris}  Pour supprimer aussi .aiad/ (artefacts métier) : ${C.reset}${C.cyan}npx aiad-sdd uninstall --purge --force${C.reset}`}
`);
    return { actions, appliquees: 0 };
  }

  let appliquees = 0;
  for (const a of actions) {
    appliquer(a, false);
    appliquees++;
  }
  for (const a of actions.filter((x) => x.nonRetire)) {
    console.log(`  ${C.jaune}⚠${C.reset} ${rel(racine, a.path)} : la section « # SDD Mode » a été modifiée et n'a pas pu être isolée — elle est laissée en place, à retirer à la main.`);
  }

  console.log(`
${C.vert}${C.gras}  ✓ Désinstallation terminée (${appliquees} action(s)).${C.reset}
${C.gris}  ${purge ? '.aiad/ retiré — artefacts métier supprimés.' : '.aiad/ conservé — artefacts métier intacts.'}${C.reset}
`);

  return { actions, appliquees };
}

// ─── Alias EN canoniques (item #42) ─────────────────────────────────────────
export {
  planifier as planUninstall,
};
