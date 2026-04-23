import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

const COULEURS = {
  vert: '\x1b[32m',
  jaune: '\x1b[33m',
  cyan: '\x1b[36m',
  gris: '\x1b[90m',
  gras: '\x1b[1m',
  reset: '\x1b[0m',
};

const AGENTS = [
  { fichier: 'AIAD-AI-ACT.md', nom: 'EU AI Act', description: 'Conformité Règlement (UE) 2024/1689' },
  { fichier: 'AIAD-RGPD.md', nom: 'RGPD', description: 'Privacy by Design, conformité RGPD' },
  { fichier: 'AIAD-RGAA.md', nom: 'RGAA', description: 'Accessibilité numérique RGAA 4.1 / WCAG 2.1' },
  { fichier: 'AIAD-RGESN.md', nom: 'RGESN', description: 'Écoconception de services numériques' },
];

export async function addGovernance(projetDir, options = {}) {
  const { force = false, silencieux = false } = options;

  if (!silencieux) {
    console.log(`\n${COULEURS.cyan}${COULEURS.gras}  AIAD — Agents de Gouvernance${COULEURS.reset}\n`);
  }

  const gouvernanceDir = join(projetDir, '.aiad', 'gouvernance');
  if (!existsSync(gouvernanceDir)) {
    mkdirSync(gouvernanceDir, { recursive: true });
  }

  const sourceDir = join(TEMPLATES_DIR, '.aiad', 'gouvernance');

  for (const agent of AGENTS) {
    const source = join(sourceDir, agent.fichier);
    const dest = join(gouvernanceDir, agent.fichier);

    if (!existsSync(source)) {
      console.log(`  ${COULEURS.jaune}?${COULEURS.reset} ${agent.fichier} — template non trouvé`);
      continue;
    }

    if (existsSync(dest) && !force) {
      console.log(`  ${COULEURS.jaune}~${COULEURS.reset} ${agent.nom} ${COULEURS.gris}(existe déjà, ignoré)${COULEURS.reset}`);
    } else {
      const contenu = readFileSync(source, 'utf-8');
      writeFileSync(dest, contenu, 'utf-8');
      console.log(`  ${COULEURS.vert}+${COULEURS.reset} ${agent.nom} — ${agent.description}`);
    }
  }

  // Créer l'index des agents de gouvernance
  const indexContenu = `# Agents de Gouvernance AIAD — Tier 1

> Ces agents ont un **droit de veto** sur toute implémentation non conforme.
> Ils sont injectés dans chaque session de développement via le CLAUDE.md.

## Agents installés

| Agent | Fichier | Périmètre |
|-------|---------|-----------|
${AGENTS.map(a => `| **${a.nom}** | \`${a.fichier}\` | ${a.description} |`).join('\n')}

## Activation

Les agents de gouvernance sont activés par défaut dans le CLAUDE.md.
Pour désactiver temporairement un agent, commentez la ligne correspondante dans CLAUDE.md.

## Hiérarchie

\`\`\`
Constitution AIAD (valeurs immuables)
  └── Agents de Gouvernance Tier 1 (droit de veto)
       ├── AIAD-AI-ACT    → Tout composant IA
       ├── AIAD-RGPD      → Toute donnée personnelle
       ├── AIAD-RGAA      → Toute interface utilisateur
       └── AIAD-RGESN     → Toute décision technique
            └── AGENT-GUIDE projet (contexte permanent)
                 └── SPEC (activation par tâche)
\`\`\`

## Mise à jour

Les agents de gouvernance suivent le cycle ALIS (mise à jour à chaque pleine lune).
Pour mettre à jour : \`npx aiad-sdd gouvernance --force\`
`;

  const indexDest = join(gouvernanceDir, '_index.md');
  writeFileSync(indexDest, indexContenu, 'utf-8');

  if (!silencieux) {
    console.log(`\n  ${COULEURS.vert}+${COULEURS.reset} Index de gouvernance créé`);
    console.log(`\n  ${COULEURS.gris}4 agents Tier 1 installés — droit de veto actif${COULEURS.reset}\n`);
  }
}
