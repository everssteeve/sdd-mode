import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { C, logHeader } from './term.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

const AGENTS = [
  { fichier: 'AIAD-AI-ACT.md', nom: 'EU AI Act', description: 'Conformité Règlement (UE) 2024/1689' },
  { fichier: 'AIAD-RGPD.md', nom: 'RGPD', description: 'Privacy by Design, conformité RGPD' },
  { fichier: 'AIAD-RGAA.md', nom: 'RGAA', description: 'Accessibilité numérique RGAA 4.1 / WCAG 2.1' },
  { fichier: 'AIAD-RGESN.md', nom: 'RGESN', description: 'Écoconception de services numériques' },
  { fichier: 'AIAD-CRA.md', nom: 'CRA', description: 'Cyber Resilience Act — Règlement (UE) 2024/2847 (application 2027)' },
];

export async function addGovernance(projetDir, options = {}) {
  const { force = false, silencieux = false } = options;

  if (!silencieux) {
    logHeader('AIAD — Agents de Gouvernance');
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
      console.log(`  ${C.jaune}?${C.reset} ${agent.fichier} — template non trouvé`);
      continue;
    }

    if (existsSync(dest) && !force) {
      console.log(`  ${C.jaune}~${C.reset} ${agent.nom} ${C.gris}(existe déjà, ignoré)${C.reset}`);
    } else {
      const contenu = readFileSync(source, 'utf-8');
      writeFileSync(dest, contenu, 'utf-8');
      console.log(`  ${C.vert}+${C.reset} ${agent.nom} — ${agent.description}`);
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
       ├── AIAD-RGESN     → Toute décision technique
       └── AIAD-CRA       → Tout produit logiciel mis sur le marché EU (2027)
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
    console.log(`\n  ${C.vert}+${C.reset} Index de gouvernance créé`);
    console.log(`\n  ${C.gris}${AGENTS.length} agents Tier 1 installés — droit de veto actif${C.reset}\n`);
  }
}
