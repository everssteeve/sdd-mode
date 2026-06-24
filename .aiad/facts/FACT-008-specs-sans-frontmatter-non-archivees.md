---
id: FACT-008
title: SPECs "done" non archivées + INTENT-016 non archivé
date: 2026-06-24
author: Steeve Evers
specs: SPEC-026-1-archive-done
status: résolu
---

# FACT-008 — SPECs "done" non archivées + INTENT-016 non archivé

**Date** : 2026-06-24
**Auteur** : Steeve Evers
**SPEC concernée** : SPEC-026-1-archive-done
**Statut** : résolu

## Écart constaté

**Livré** :
- INTENT-016 (`status: active` en frontmatter YAML) n'a pas été archivé lors du batch d'archivage du 2026-06-24.
- 16 SPECs avec `**Statut** : done` dans le body markdown ne sont pas archivées :
  SPEC-014-1, SPEC-014-2, SPEC-015-1, SPEC-015-2-1, SPEC-015-2-2, SPEC-015-3,
  SPEC-016-1, SPEC-016-2, SPEC-016-3, SPEC-016-4,
  SPEC-017-1, SPEC-017-2, SPEC-017-4,
  SPEC-018-1, SPEC-018-2, SPEC-018-3, SPEC-018-4, SPEC-018-5,
  SPEC-019-1, SPEC-019-2.

**Désiré** :
- INTENT-016 et toutes les SPECs ci-dessus devraient être archivés (leur contenu est livré et leurs intents parents sont archivés).

## Causes racines identifiées

### Cause A — INTENT-016 : frontmatter non mis à jour
INTENT-016 a `status: active` en frontmatter YAML. `listerLivrables()` filtre sur `STATUTS_LIVRES` (`done`, `delivered`, etc.). Jamais mis à jour après livraison des SPEC-016-*.

### Cause B — SPECs sans frontmatter YAML : fallback manquant
Les SPECs utilisent `**Statut** : done` comme champ en **body markdown** (pas de bloc `---` YAML). `parseFrontmatter()` retourne `data.status = undefined` → non détectées par `listerLivrables()`.

Les intents, eux, ont un frontmatter YAML complet (voir INTENT-016 : `status: active`). Deux conventions coexistent sans que le script gère les deux.

## Impact qualifié

- **Type** : conformité spec (drift archivage)
- **Sévérité** : majeur — la traçabilité est polluée ; `aiad-sdd trace` voit ces SPECs comme « actives » alors qu'elles sont livrées. Risque de faux positifs en drift-check.

## Décision d'action

### Action 1 (patch immédiat) — INTENT-016
Mettre `status: done` dans le frontmatter YAML de INTENT-016 puis lancer `aiad-sdd archive INTENT-016`.

### Action 2 (patch immédiat) — listerLivrables fallback body
Dans `lib/archive.js`, étendre `listerLivrables` : quand `data.status` est absent ou ne matche pas `STATUTS_LIVRES`, tenter un fallback en parsant la première occurrence de `/^\*\*Statut\*\*\s*:\s*(\S+)/m` dans le body. Si le résultat matche `STATUTS_LIVRES` → candidat archivable.

**Justification** : les SPECs sont rédigées dans un format markdown sans frontmatter YAML (convention historique). Modifier les ~20 fichiers serait du bruit sans valeur ajoutée. Le fallback est conservateur (lecture seule, aucun déplacement) et préserve la compatibilité.

**Lien SPEC** : SPEC-026-1-archive-done
