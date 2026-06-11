---
id: SPEC-013-3
title: Synchronisation automatique des versions sur zones marquées + check CI
parent_intent: INTENT-013
research: RESEARCH-013
status: review
format: prose
sqs: 5.0
author: Steeve Evers
date: 2026-06-11
governance: AIAD-RGESN
---

# SPEC-013-3 — Sync auto des versions (zones marquées) + check CI

**Intent parent** : INTENT-013 — Zéro drift sur soi-même
**Research** : RESEARCH-013 — verdict **CONDITIONAL GO** (80 %), conditions C1/C2
**SQS** : 5/5 (Complétude · Testabilité · Atomicité · Non-ambiguïté · Traçabilité)
— Gate **OUVERTE** (2026-06-11), Test de l'Étranger PASS
**Statut** : review (Gate ouverte ; passe `in-progress` au lancement de `/sdd exec`
— cf. [[FACT-002]], on évite `ready` tant qu'aucun code annoté `@spec` n'existe)
**Gouvernance** : AIAD-RGESN (outillage sobre, réutilise un motif existant)

> Conditions du verdict Research (contraignantes) :
> **C1** — le stamping est restreint aux **zones explicitement marquées**
> (frontmatter, titres, footers de site) ; la **prose narrative est exclue** et
> documentée comme « contexte historique, pas une promesse de version ».
> **C2** — le check CI compare **uniquement ces zones marquées** à `package.json`
> (exit 1 sur écart) ; il **n'analyse jamais la prose**.

## 1. Contexte

`package.json:3` est la source unique de version, déjà lue par
`lib/emit-rules.js:35` (`lirePackageVersion()`) et `lib/docs.js:29`. Les headers
`CLAUDE.md`/`AGENTS.md` (emit-rules) et le frontmatter `DOCUMENTATION.md` (docs)
sont déjà stampés et vérifiés en CI. **Le gap** (RESEARCH-013 §Surface) : aucune
garantie mécanique que les **footers de site** et autres zones de version non
auto-générées restent égaux à `package.json`. Cette SPEC comble ce gap **sans**
toucher à la prose narrative (~546 occurrences, deux tiers : stampable vs prose).

## 2. Comportement attendu

### Input
- `package.json.version` (source unique).
- Les fichiers du repo contenant ≥ 1 zone marquée `<!--VERSION:START-->…<!--VERSION:END-->`
  (commentaire HTML valable en Markdown **et** HTML).

### Processing
- `aiad-sdd version-sync` lit la version, découvre toutes les zones marquées,
  et **remplace uniquement le contenu entre les sentinelles** par la version.
- `--check` : compare sans écrire → exit 1 au premier écart, 0 si tout concorde.
- `--dry-run` : affiche le diff par fichier:zone, n'écrit rien.
- Opération **idempotente** (relancer ne produit aucun diff).
- Réutilise le motif éprouvé `lib/emit-rules.js`/`lib/docs.js` (lecture version +
  `--check` + auto-commentaire PR), dans un nouveau `lib/version-sync.js`.

### Output
- Fichiers à zones marquées synchronisés (hors `--check`/`--dry-run`).
- Code de sortie CLI : `0` conforme · `1` écart ou marqueur mal formé.
- Récapitulatif : nombre de fichiers / zones traités (jamais silencieux, cf. C1).

### Cas limites (≥ 3)
1. **Prose hors marqueur** : un n° de version dans une phrase narrative (ex.
   `README.md:155`) n'est **jamais** modifié ni signalé (C1). Vérifié par un test
   dédié contenant une vieille version hors sentinelles.
2. **Marqueur mal formé** (`START` sans `END`, imbriqué) → erreur explicite,
   exit 1, **aucune écriture partielle** (pas de corruption de fichier).
3. **Fichier sans zone marquée** → ignoré silencieusement pour l'écriture, mais
   compté `0 zone` dans le récap (pas une erreur).
4. **Version pré-release** (`1.18.0-rc.1`) → injectée telle quelle, sans reformat.
5. **Zones multiples dans un même fichier** → toutes synchronisées.

## 3. Critères d'acceptation

- [ ] `aiad-sdd version-sync` remplace le contenu de **toutes** les zones
      `<!--VERSION:START-->…<!--VERSION:END-->` par `package.json.version`, et est
      **idempotent** (2e exécution → 0 diff).
- [ ] `aiad-sdd version-sync --check` sort **1** dès qu'une zone marquée diffère de
      `package.json.version`, **0** sinon, et **n'écrit aucun fichier**.
- [ ] **Aucun caractère hors des sentinelles n'est modifié** — un test avec un
      fichier contenant une version obsolète en prose (hors marqueurs) montre 0 diff
      après `version-sync` (garantie C1).
- [ ] Un **marqueur mal formé** fait sortir la commande en **1** sans écrire le
      fichier concerné.
- [ ] Un **workflow CI** exécute `version-sync --check` sur chaque PR et **échoue**
      sur écart (garantie C2) ; il n'analyse pas la prose.

## 4. Interface / API

```
aiad-sdd version-sync [--check] [--dry-run]
  (sans flag) : injecte package.json.version dans chaque zone marquée
  --check     : exit 1 si une zone ≠ version ; 0 sinon ; aucune écriture
  --dry-run   : affiche le diff (fichier:zone), aucune écriture

Syntaxe de zone (Markdown + HTML) :
  <!--VERSION:START-->v1.18.0<!--VERSION:END-->
```

- Nouveau module : `lib/version-sync.js` (pur, testable ; réutilise
  `lirePackageVersion()` et le motif sentinelle de `lib/emit-rules.js`).
- Handler CLI dans `bin/aiad-sdd.js` (à côté de `docs`/`emit-rules`).
- Workflow CI : extension de `.github/workflows/aiad-docs-check.yml` **ou** nouveau
  `aiad-version-check.yml` (au choix de l'implémenteur — même motif que docs-check).

## 5. Dépendances

- `package.json` (source de version) — lecture seule.
- `lib/emit-rules.js` (`lirePackageVersion`, motif sentinelle/`source-hash`) — réutilisé.
- `lib/docs.js` — modèle de référence (`--check`, frontmatter, sentinelle).
- Modèles de test : `test/docs.test.js:43`, `test/emit-rules.test.js:37`.
- **Hors périmètre** (R4) : titres de sections du CHANGELOG gérés par
  `scripts/release.js` — ne pas y toucher.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~0,5K
- Cette SPEC : ~1,4K
- `lib/docs.js` + `lib/emit-rules.js` (sections version/sentinelle) : ~3K
- **Total estimé** : ~5K tokens ✅ (< 50K — pas de risque de context rot)

## 7. Definition of Output Done (DoOD)

- [ ] `lib/version-sync.js` + handler CLI + lint passant, annotés `@spec SPEC-013-3-...`.
- [ ] Tests unitaires couvrant les 5 cas limites (notamment « prose hors marqueur
      intacte » et « marqueur mal formé »).
- [ ] Zones `<!--VERSION:START/END-->` ajoutées aux footers de `site/` (et docs
      concernées), `version-sync --check` **vert** en local et en CI.
- [ ] Workflow CI ajouté/étendu et vérifié rouge→vert sur un écart simulé.
- [ ] Gouvernance AIAD-RGESN vérifiée (outil sobre, zéro dépendance ajoutée).
- [ ] SPEC mise à jour si écart (Drift Lock).
