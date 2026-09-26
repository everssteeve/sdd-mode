---
id: RESEARCH-040
intent: INTENT-033
author: Steeve Evers
date: 2026-09-25
status: go
---

# RESEARCH-040 — Aligner /sdd gate et /sdd context sur la doctrine v1.9  (← INTENT-033)

> Phase Research (§3.5). Discovery réalisée par l'agent en lecture seule le 2026-09-25 ; **le verdict appartient à l'auteur** (ligne « Verdict » ci-dessous, non remplie par l'agent).

## Discovery (ancrage code — agent Explore, read-only)

- **Fichiers / zones impactés** :
  - `.claude/sdd/gate.md:36` — fast path de la Gate (EARS → `sqs-scoring` → OUVERTE/FERMÉE) ; `:69-76` — étape 5, préparation du Context Engineering Budget. Aucune vérification de credentials, de ressource partagée, d'action irréversible ni de points d'arrêt.
  - `.claude/skills/sqs-scoring/SKILL.md:18-26` — les 5 critères SQS ; `:46-54` — table de décision. Le scoring est **jugé par le modèle**.
  - `lib/verdict.js:1-20` — principe « computation off-context » : le verdict final d'une gate ne doit **jamais** venir du jugement libre du modèle. `evidence: .aiad/schema/verdicts/gate.schema.json` existe, mais `bin/aiad-sdd.js` n'a **aucune commande `gate`** (seuls `mini-gate`, `research`, `score`… existent) → la Gate SQS n'a pas aujourd'hui de verdict déterministe.
  - `.claude/sdd/context.md:28-34` et `.claude/skills/context-budget/SKILL.md:17-55` — métriques M1–M5 ; **aucune mention** de sous-agent, de délégation ni de contexte hérité.
  - `.aiad/specs/spec-template.md:52` — §6 « Estimation Context Engineering Budget » (pas de ligne pour le contexte hérité) ; `.claude/sdd/spec.md:25` — le gabarit prose est « implicite » : `templates/.aiad/specs/` ne livre que `spec-ears-template.md`.
- **Contraintes existantes** :
  - `evidence:` **67 SPEC archivées ; 0 déclare des credentials, une ressource partagée en écriture ou une action irréversible** (recherche par mots-clés, 2026-09-25). Des vérifications **conditionnelles** ne s'appliqueraient à aucune d'elles.
  - `evidence:` **chaque commande existe en deux exemplaires qui ont divergé** : `.claude/sdd/*.md` (dépôt) et `templates/.claude/sdd/*.md` (livré aux utilisateurs). Gate : 3 lignes d'écart ; context : 8 lignes. Les exemplaires livrés **n'ont pas reçu** la recommandation de modèle actionnable (INTENT-032, marqué done) ni l'étape « Empreinte mesurée » (SPEC-021-2, marquée done). Aucun script de synchronisation (`scripts/`).
  - `evidence:` 118 références de modèles **non datées** dans `.claude/` et `templates/.claude/` (« Sonnet 4.6 » ×62, « Opus 4.8 » ×32, « Haiku 4.5 » ×24).
- **Surface de test existante** : `test/verdict.test.js`, `test/mini-gate.test.js`, `test/canary.test.js`, `test/research.test.js`, `test/footprint-*.test.js` ; canary suite `.aiad/canary/cases/` (CANARY-010 : dispersion du score SQS, volet **génératif**, tolérance ±14 %).

## Faisabilité

Réalisable avec l'architecture actuelle. Deux voies pour la Gate :

- **Voie A — enrichir la skill `sqs-scoring`** (jugement du modèle). Coût faible, mais la non-régression ne peut pas être garantie : un jugement de modèle varie de ±8 à 14 % (CANARY-010). Contraire au principe « computation off-context ».
- **Voie B — pré-contrôle déterministe** avant le SQS (nouveau module `lib/`, commande CLI, verdict validé par schéma, cas canary *deterministic*). Il ne s'active que si la SPEC **déclare** explicitement credentials, ressource partagée ou action irréversible. La non-régression est **testable** : rejouer le pré-contrôle sur les 67 SPEC archivées doit donner « non applicable » pour toutes. Coût moyen (module + tests + cas canary).

Pour `/sdd context` : ajout d'une composante « contexte hérité au point de fork » à l'estimation §6 et à la métrique M3 (ratio estimé / réel), plus la recommandation « déléguer tôt ». Coût faible.

Pour les points d'arrêt : section optionnelle dans le gabarit de SPEC et dans `/sdd spec` ; la Gate ne la rend jamais bloquante.

## Décisions de l'auteur (2026-09-25)

- **« déclarer »** : seule une déclaration **structurée** (section « Périmètre d'exécution de l'agent ») peut fermer la Gate ; une détection par **mots-clés** dans la prose produit un **avertissement non bloquant**.
- **datation des références de modèles** : **hors périmètre** d'INTENT-033 ; consignée comme signal pour le cycle d'octobre.

## Risques & inconnues

- **Divergence des deux exemplaires de commandes** (préexistante) : toute évolution doit toucher les deux ; sans synchronisation, le livrable risque de ne pas atteindre les utilisateurs — comme INTENT-032 et SPEC-021-2 avant lui. À traiter dans la SPEC (ou par un Intent dédié).
- **Voie A** : non-régression non démontrable (jugement du modèle).

## Verdict : GO

*Tranché par l'auteur, Steeve Evers, le 2026-09-25 : « GO pour les deux ».*

> Recommandation de l'agent (non contraignante) : **GO**, voie B (pré-contrôle déterministe). Les inconnues ont été tranchées par l'auteur le 2026-09-25 ; la Discovery est ancrée ; aucun obstacle technique.

