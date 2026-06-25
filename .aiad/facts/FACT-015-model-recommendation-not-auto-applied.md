# FACT-015 — Recommandation modèle documentée mais non auto-appliquée

**Date** : 2026-06-25
**Auteur** : Steeve Evers
**SPEC concernée** : SPEC-032-1-model-actionnable
**Statut** : résolu (2026-06-25)

## Écart constaté

**Livré** : Chaque commande `/sdd` et `/aiad` documente une "Recommandation modèle" (ligne en entête + "Étape 0" en mode guidé). L'Étape 0 affiche un message textuel invitant l'utilisateur à choisir le bon modèle. Le modèle actif n'est cependant jamais changé automatiquement.

**Désiré** : À l'invocation d'une commande, le modèle préconisé devrait être soit (a) automatiquement switché, soit (b) le chemin pour le switcher devrait être uniformément proposé à l'utilisateur avant l'exécution — y compris dans les commandes sans "Étape 0" explicite (commandes `/aiad` en mode guidé absent).

## Observations complémentaires

1. **Couverture "Étape 0"** : seules les commandes `/sdd` ont une "Étape 0 — Recommandation modèle" dans leur mode guidé. Les commandes `/aiad` se limitent à une ligne d'entête sans étape guidée explicite.
2. **Faisabilité du switch automatique** : Claude Code ne fournit pas d'API agent pour changer de modèle programmatiquement — seul l'utilisateur peut faire `/model <id>` ou via l'UI. Un switch automatique à l'invocation est donc impossible sans support runtime.
3. **Inconsistance actuelle** : certaines commandes mentionnent deux modèles alternatifs (`Opus 4.8 ou Sonnet 4.6` pour `security`, `audit`, `gouvernance`) sans critère de choix explicite.

## Impact qualifié

- **Type** : fonctionnel (friction UX) + conformité spec (inconsistance entre commandes)
- **Sévérité** : mineur — la documentation existe, l'écart est une friction, pas un blocage fonctionnel

## Décision d'action

**Action choisie** : ajustement SPEC (améliorations dans les fichiers de commandes existants)

**Justification** : Le switch automatique n'étant pas possible sans support runtime, la remédiation passe par :
1. Uniformiser le prompt de recommandation modèle dans **toutes** les commandes (sdd + aiad) avec une formulation actionnable : `👉 Pour cette commande, tapez \`/model claude-haiku-4-5-20251001\` si ce n'est pas déjà le cas.`
2. Ajouter une "Étape 0 — Recommandation modèle" dans les commandes `/aiad` qui n'en ont pas (en mode guidé).
3. Préciser les critères de choix pour les commandes à double modèle (security, audit, gouvernance).

**Lien SPEC** : SPEC-032-1-model-actionnable (INTENT-032) — implémentée le 2026-06-25.
