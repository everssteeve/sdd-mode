---
id: SPEC-007-1
title: Memory native — promotion from logs + auto-curation + anti dock rot (§3.8 SPEC-A + SPEC-B)
parent_intent: INTENT-007
status: archived
format: prose
sqs: 4.2
author: Steeve Evers
date: "2026-06-09"
archivedAt: "2026-06-24T07:31:15.541Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# SPEC-007-1 — Memory native

**Intent parent** : INTENT-007
**SQS** : 4.2 / 5
**Statut** : in-progress

## Objectif

Persister des Lessons Learned dans un store auto-curaté, alimenté « from logs » (récurrence), promu par un humain, et sortir du contexte chaud les artefacts livrés (anti dock rot).

## Implémentation

- **SPEC-A** `lib/memory.js` : `signatureObservation` (clé normalisée regroupant les paraphrases), `collecterObservations` (facts `.aiad/facts/*` + drifts `matrix.json`), `proposerPromotions` (récurrence ≥ `seuil` sur **sources distinctes**, jamais un cas isolé), `promouvoir` (fail-closed sans `auteur` — Human Authorship), `formatEntreeMemoire`, `curer` (> 200 lignes → éclatement par thème `##` + index), `cheminStore` (`.aiad/memory/MEMORY.md`). CLI `aiad-sdd memory <propose|promote|curate>` (flags `--auteur`, `--seuil`, `--lecon`, `--apply`, `--dry-run`).
- **SPEC-B** `lib/archive.js` : `listerLivrables` (artefacts `status: done` ; `safe: false` si une SPEC est encore référencée par `@spec` dans `lib/`). CLI `aiad-sdd archive --delivered [--apply]` (dry-run par défaut, n'archive que les `safe`). Rappel dock rot dans `/aiad health`.
- Dossier `.aiad/memory/` créé par `init` (+ README template). Mentions dans `/aiad retro` et `/sdd fact`.

## Critères d'acceptation

1. the system SHALL persister les Lessons promues dans un store versionné `.aiad/memory/MEMORY.md`.
2. WHEN un pattern apparaît dans ≥ `seuil` sources distinctes, the system SHALL le proposer ; un cas isolé SHALL NOT être proposé.
3. the system SHALL refuser toute promotion sans auteur humain (`--auteur`), exit 2 (JNSP).
4. IF le store dépasse 200 lignes, the system SHALL proposer son éclatement par thème + index.
5. WHEN un artefact est `status: done`, the system SHALL le proposer à l'archivage hors contexte chaud ; une SPEC encore référencée par du code SHALL être marquée non sûre.
6. Aucune régression : la suite complète passe (`npm test`).

## Vérification

- `test/memory.test.js` (16 ✓) + `test/archive.test.js` (livrables, 2 ✓ ajoutés).
- Suite complète `npm test` ; lint · esm · size verts.

## Hors périmètre

- Migration destructive des Lessons d'`AGENT-GUIDE.md` (additif).
- Collecte des hook-runs comme source de promotion (facts + drifts suffisent à ce stade).
