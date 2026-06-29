---
id: RESEARCH-039
intent: INTENT-029
status: go
---

# RESEARCH-039 — Archivage automatique des FACTs résolus

**Intent parent** : INTENT-029
**Auteur** : Steeve Evers
**Date** : 2026-06-29
**Statut** : go

---

## Discovery

Zones cartographiées par agent Explore (read-only, ancrages `chemin:ligne`) :

- `lib/archive.js:46` — `TYPES_ARTEFACTS` : liste `[intents, specs]` uniquement. Toute commande `archive FACT-NNN` aboutit à `"ID inconnu"` dans `detecterSousDossier()`.
- `lib/archive.js:51` — `detecterSousDossier(id)` : fail-fast sur préfixe inconnu. Auto-fixé dès que `TYPES_ARTEFACTS` inclut `facts`.
- `lib/archive.js:66` — `localiserArtefact(racine, id)` : cherche dans `dirOuvert` puis `dirArchive`. Correct par construction.
- `lib/archive.js:321` — `SOUS_DOSSIERS_LIVRABLES = ['intents', 'specs', 'research']` : `facts` absent → `listerLivrables()` ne scanne jamais `.aiad/facts/`.
- `lib/archive.js:326` — `STATUTS_LIVRES` : `'résolu'` absent → FACTs résolus non éligibles même si `facts/` était scanné.
- `lib/archive.js:368` — `listerLivrables()` : parcoure `SOUS_DOSSIERS_LIVRABLES`, filtre sur `STATUTS_LIVRES`. Extension : ajouter `'facts'` + `'résolu'`.
- `lib/archive.js:142` — `archiver()` : patche frontmatter (`archivedAt`, `archivedBy`, `archivedReason`), crée `dirArchive` si absent, déplace via `renameSync()`. Entièrement réutilisable pour FACTs sans modification.
- `lib/archive.js:464` — `archiverTous()` : boucle sur `listerLivrables()` candidats `safe: true`. Auto-couvre les FACTs une fois les constantes mises à jour.
- `bin/aiad-sdd.js:2733` — commande `archive <ID>` générique : appelle `archiver()` directement. Auto-fixé par la mise à jour de `detecterSousDossier()`.
- `lib/sdd-trace.js:249` — `lireIntents()` : filtre `if (nom === 'archive')` — pattern établi pour l'exclusion des archives de la matrice.
- `lib/sdd-trace.js:275` — `lireSpecs()` : même filtre. Pas de `lireFacts()` équivalent — `facts/archive/` non ignoré actuellement.
- `lib/sdd-trace.js:628` — scan `archiveDir` pour `intentsConnus`/`specsConnus` : `facts/archive/` non scanné → annotations `@fact` vers FACTs archivés pourraient créer des gaps.
- `lib/memory.js:82` — `collecterObservations()` : scanne `.aiad/facts/` sans filtre `archive/`. Bug pré-existant : les FACTs archivés remonteraient dans le contexte agent.
- `test/archive.test.js:40` — tests `detecterSousDossier()` : couvrent INTENT/SPEC, rejettent FOO. FACT non testé.
- `test/archive.test.js:295` — tests `listerLivrables()` / `archiverTous()` : helpers `ecrireSpec()`, `ecrireIntent()` disponibles. `ecrireFact()` à ajouter.

FACTs éligibles actuellement dans `.aiad/facts/` (status done) : FACT-006, FACT-008, FACT-009, FACT-014. Aucun dossier `facts/archive/` n'existe encore.

---

## Faisabilité

**Réalisable avec l'architecture actuelle, coût faible.**

L'extension est strictement additive : 3 constantes à modifier + 1 filtre à ajouter dans 2 fichiers. Le pipeline `archiver()` / `archiverTous()` est entièrement réutilisable sans refactoring.

| Changement | Fichier | Nature |
|---|---|---|
| Ajouter `facts` dans `TYPES_ARTEFACTS` | `lib/archive.js:46-49` | additive |
| Ajouter `'facts'` dans `SOUS_DOSSIERS_LIVRABLES` | `lib/archive.js:321` | additive |
| Ajouter `'résolu'` dans `STATUTS_LIVRES` | `lib/archive.js:326-330` | additive |
| Filtre `archive/` dans `collecterObservations()` | `lib/memory.js:85-86` | correctif (1 ligne) |
| Filtre `facts/archive/` dans `sdd-trace.js` | `lib/sdd-trace.js` | additive symétrique |
| Tests FACT dans archive.test.js | `test/archive.test.js` | nouveaux tests |

**Alternatives** : aucune alternative pertinente — le pattern est déjà en place pour Intents et SPECs.

---

## Risques & inconnues

| # | Risque | Probabilité | Impact | Mitigation |
|---|--------|-------------|--------|------------|
| R1 | Statuts éligibles incomplets (`résolu` vs `done` vs autres) | Moyen | Faible | L'Intent-029 précise `résolu` et `done` — les deux seront ajoutés |
| R2 | `facts/archive/` crée un gap de traçabilité dans `sdd-trace.js` | Faible | Moyen | Filtre symétrique à ajouter (pattern établi, 3 lignes) |
| R3 | `collecterObservations()` remonte les FACTs archivés en contexte agent | Certain (si non corrigé) | Faible | Correctif 1 ligne dans memory.js:86 |
| R4 | Webhook `fact.deleted` manquant | Faible | Négligeable | À ajouter dans `archiver()` si souhaité — non bloquant |

**Aucune inconnue bloquante non résoluble par l'humain.**

---

## Verdict

> **À trancher par l'humain (Human Authorship obligatoire).**

Vu le Discovery et les risques :
- **GO** : intention réalisable, aucune inconnue bloquante, pattern en place.
- **CONDITIONAL GO** : GO mais avec condition explicite (ex. : statuts éligibles à préciser).
- **DEFER** : reporter (dépendance externe, timing).
- **NO-GO** : coût/risque trop élevé.

```
## Verdict : GO (confidence: 95 %)
Auteur : Steeve Evers
Date : 2026-06-29
```
