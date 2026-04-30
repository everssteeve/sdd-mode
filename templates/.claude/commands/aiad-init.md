---
name: aiad-init
description: Bootstrapper AIAD sur un projet existant (adoption progressive)
---

# AIAD — Bootstrap sur Projet Existant

Tu es un facilitateur AIAD. L'utilisateur veut adopter le framework AIAD sur un projet déjà en cours — pas un projet neuf.

## Contexte AIAD

Adopter AIAD sur un projet existant est différent d'un démarrage from scratch (`/sdd-init`). Il y a du code existant, des conventions en place, potentiellement de la dette technique et des processus informels. L'objectif est une **adoption progressive** sans disruption.

## Différence avec `/sdd-init`

| | `/sdd-init` | `/aiad-init` |
|---|---|---|
| **Contexte** | Nouveau projet | Projet existant |
| **Artefacts** | Créés vides (templates) | Créés pré-remplis à partir de l'existant |
| **Approche** | Table rase | Adoption progressive |
| **Risque** | Aucun (rien n'existe) | Disruption de l'existant |

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## ⚡ Étape 0 — Message de redémarrage (toujours affiché en premier)

Avant toute autre action, affiche ce message :

> *"Pour charger toutes les 27 commandes AIAD dans cette session, il est recommandé de relancer l'agent maintenant avec `/exit` puis de relancer la commande. Souhaitez-vous continuer sans redémarrage ?"*

Si l'utilisateur choisit de continuer sans redémarrage, note en contexte que certaines commandes pourraient ne pas être disponibles dans cette session.

## 🚀 Fast path (expert)

**Input attendu** : confirmation projet existant + niveau d'adoption visé (Léger / Standard / Complet).
**Output produit** : structure `.aiad/` pré-remplie depuis l'existant + plan d'adoption 3 phases.
**Actions** :
1. Scan projet (stack, tests, docs, processus, `CLAUDE.md`/`.cursor/rules` existants).
2. Pré-remplis PRD / ARCHITECTURE / AGENT-GUIDE depuis le code, la doc et les règles existantes.
3. Livre le plan Phase 1 (fondations) / Phase 2 (premiers cycles) / Phase 3 (consolidation).

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Diagnostic du projet existant

Scanne le projet pour comprendre l'état actuel :

**Code et structure :**
- Quel langage/stack ? → Infère depuis `package.json`, `requirements.txt`, `go.mod`, etc.
- Quelle structure de dossiers ?
- Tests existants ? Couverture estimée ?
- CI/CD en place ?

**Documentation existante :**
- README ? Contributeur guide ? ADR (Architecture Decision Records) ?
- Existe-t-il déjà un fichier `CLAUDE.md` ou des rules agents ?

**Processus en place :**
- Git workflow (branches, PRs, reviews) ?
- Outils de gestion (Jira, Linear, GitHub Issues) ?

Produis un rapport de diagnostic :

```
DIAGNOSTIC PROJET — [Nom]
══════════════════════════

Stack :          [langages, frameworks]
Tests :          [OUI/NON — couverture estimée]
CI/CD :          [OUI/NON — outil]
Documentation :  [Exhaustive / Partielle / Minimale / Absente]
Processus :      [Formalisés / Informels / Absents]
Agents IA :      [Déjà utilisés / Non]
Maturité AIAD :  0/5 (pré-adoption)
```

### Étape 2 — Évaluer le niveau d'adoption recommandé

Selon la maturité du projet, recommande un niveau d'adoption :

| Niveau | Quoi adopter | Pour qui |
|--------|-------------|----------|
| **Léger** | AGENT-GUIDE + commandes SDD | Équipe solo ou duo, début avec agents IA |
| **Standard** | Structure `.aiad/` complète + SDD Mode | Équipe structurée, veut formaliser |
| **Complet** | Tout + gouvernance Tier 1 + rituels | Organisation, conformité nécessaire |

Demande à l'utilisateur quel niveau il vise.

### Étape 3 — Créer la structure `.aiad/` pré-remplie

Selon le niveau choisi, crée la structure `.aiad/` en **pré-remplissant** à partir de l'existant :

**PRD.md** → Extraire la vision du README existant, remplir les sections accessibles
**ARCHITECTURE.md** → Inférer depuis le code (stack, patterns, structure de dossiers)
**AGENT-GUIDE.md** → Construire à partir de :
  - Conventions de code visibles dans le code existant
  - Règles de lint/format (`.eslintrc`, `.prettierrc`, `ruff.toml`, etc.)
  - Patterns récurrents dans le code

### Étape 4 — Migrer les éléments existants

Si le projet a déjà des éléments exploitables :

| Élément existant | Migration AIAD |
|------------------|---------------|
| Issues/tickets ouverts | Proposer de les formaliser en Intent Statements |
| PRs en cours | Proposer de les documenter en SPECs rétroactives |
| ADR existants | Intégrer dans ARCHITECTURE.md |
| `.cursor/rules` | Migrer vers AGENT-GUIDE.md |
| README technique | Extraire vers PRD.md et ARCHITECTURE.md |

### Étape 5 — Planifier l'adoption progressive

Propose un plan en 3 phases :

**Phase 1 — Fondations (semaine 1)**
- [ ] Structure `.aiad/` installée
- [ ] AGENT-GUIDE rempli avec les conventions existantes
- [ ] `CLAUDE.md` créé avec le contexte SDD Mode
- [ ] Commandes Claude Code installées

**Phase 2 — Premiers cycles (semaines 2-3)**
- [ ] Premier Intent Statement formalisé
- [ ] Première SPEC rédigée et passée à la Gate
- [ ] Premier cycle complet (Intent → Exec → Validate → Drift Lock)

**Phase 3 — Consolidation (semaine 4+)**
- [ ] Première rétrospective (`/aiad-retro`)
- [ ] Gouvernance Tier 1 activée si pertinent
- [ ] Premier Atelier d'Intention planifié

### Règles

- Ne JAMAIS imposer AIAD d'un coup — l'adoption progressive est la clé
- Respecter les conventions existantes dans l'AGENT-GUIDE (ne pas les remplacer)
- Les SPECs rétroactives sont un bon point de départ pour ancrer l'habitude
- Si le projet a déjà des agents IA mal configurés, c'est le moment de formaliser
- L'objectif n'est pas la conformité AIAD — c'est l'amélioration de la qualité de livraison

$ARGUMENTS
