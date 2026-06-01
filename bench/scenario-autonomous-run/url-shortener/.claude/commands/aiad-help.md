---
name: aiad-help
description: Aide contextuelle AIAD/SDD — vue d'ensemble, parcours type, recherche d'une commande
---

# AIAD — Aide contextuelle

Tu es un facilitateur AIAD. L'utilisateur cherche à s'orienter parmi les commandes des routers `/sdd` et `/aiad`.

## Routage

1. Lis `$ARGUMENTS`.
   - **Vide** → affiche la **vue d'ensemble** ci-dessous (carte des deux routers + parcours types).
   - `sdd` → liste détaillée des 14 sous-commandes SDD (depuis le router `/sdd`).
   - `aiad` → liste détaillée des 14 sous-commandes AIAD (depuis le router `/aiad`).
   - **Toute autre chaîne** → cherche la commande concordante (par nom partiel ou intention) dans les fichiers de `.claude/sdd/` et `.claude/aiad/` ; pour la meilleure correspondance, lis le fichier puis résume :
     - Quoi : 1 phrase
     - Quand l'utiliser : 1 phrase
     - Usage typique : `/sdd <cmd> <args>` ou `/aiad <cmd> <args>`

## Vue d'ensemble (si `$ARGUMENTS` vide)

Affiche dans cet ordre :

### 1. Les deux routers

- **`/sdd <sous-commande>`** — cycle de développement spec-driven : capture d'intention, rédaction de SPEC, validation Gate, exécution agent, contrôles drift / sécurité / audit.
- **`/aiad <sous-commande>`** — rituels d'équipe et métriques : standup, démo, rétro, atelier d'intention, DORA, Flow Metrics, dashboard.

### 2. Parcours types

- **Découverte d'un nouveau besoin** :
  `/sdd intent` → `/sdd spec` → `/sdd gate` → `/sdd exec` → `/sdd validate` → `/sdd drift-check` → `/sdd trace`
- **Bootstrap d'un projet** :
  `/sdd init` (cadrage tech) puis `/aiad init` (rituels) puis `/aiad onboard` (équipe)
- **Pilotage d'itération** :
  `/aiad sync-strat` → `/aiad standup` (quotidien) → `/aiad tech-review` → `/aiad demo` → `/aiad retro`
- **Mesure & santé** :
  `/aiad status` (vue macro), `/aiad health` (artefacts), `/aiad dora`, `/aiad flow`, `/aiad dashboard`
- **Quand ça dérape** :
  `/sdd fact` (capturer l'écart) → `/sdd drift-check` → si SPEC trop grosse `/sdd split`, si session interrompue `/sdd resume`

### 3. Compatibilité rétro (transition)

- Les anciens alias plats (`/sdd-spec`, `/aiad-retro`, …) fonctionnent encore mais sont **dépréciés** et seront retirés à la prochaine version majeure. Ils affichent un avertissement de migration vers la forme `/sdd <cmd>` ou `/aiad <cmd>`.

## Notes

- Cette commande lit les fichiers `.claude/sdd/*.md` et `.claude/aiad/*.md` à la demande pour résoudre les recherches — elle ne précharge rien.
- Reste sobre : 1 écran maximum par défaut. L'utilisateur peut toujours invoquer la sous-commande ciblée pour la doc complète.

$ARGUMENTS
