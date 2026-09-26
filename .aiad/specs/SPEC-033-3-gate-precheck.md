---
id: SPEC-033-3
title: Pré-contrôle déterministe de la Gate — périmètre d'exécution, actions irréversibles, seuil d'arrêt
parent_intent: INTENT-033
status: ready
format: EARS
sqs: 5
author: Steeve Evers
date: "2026-09-25"
---

# SPEC-033-3-gate-precheck — variante EARS

**Intent parent** : INTENT-033
**Research** : RESEARCH-040 — GO (auteur) → CONDITIONAL GO (machine) ; conditions traitées ici : voie B (pré-contrôle déterministe) ; décision de l'auteur « seule une déclaration structurée ferme la Gate, les mots-clés alertent »
**Auteur** : Steeve Evers *(rédaction : agent, 2026-09-25 — à valider à la Gate)*
**Date** : 2026-09-25
**Statut** : ready
**Format** : EARS
**SQS** : 5/5 — Execution Gate OUVERTE (2026-09-26), Test de l'Étranger PASS

---

## 1. Contexte

La Gate SQS est jugée par le modèle (variance ±8-14 %, CANARY-010) ; la doctrine v1.9 lui demande de vérifier le périmètre d'exécution d'un agent et le seuil d'arrêt des actions irréversibles. Pour respecter la contrainte de l'auteur (« pas de régression sur les SPEC existantes ») et le principe « computation off-context » (`lib/verdict.js`), ces vérifications sont faites par une **commande CLI déterministe** exécutée avant le scoring SQS. Seule une déclaration structurée (section « Périmètre d'exécution de l'agent », format SPEC-033-2) peut fermer la Gate ; les mots-clés en prose ne produisent qu'un avertissement.

## 2. Comportement Attendu

### Input
Une SPEC (`SPEC-NNN-x` résolu dans `.aiad/specs/` puis `.aiad/specs/archive/`, ou chemin de fichier).

### Processing
1. Chercher la section dont le titre contient le libellé « Périmètre d'exécution de l'agent » (casse et numéro ignorés).
2. **Section absente** : rechercher dans le corps, en mots entiers et sans casse, les termes `credential`, `credentials`, `secret`, `token`, `clé API`, `API key`, `mot de passe`, `password`, `irréversible`, `paiement`, `suppression définitive`, `déploiement en production`. Chaque terme trouvé produit un avertissement. Verdict PASS.
3. **Section présente, contenu « Non applicable »** : verdict PASS.
4. **Section présente, déclarations** : lire les six lignes (format SPEC-033-2). Une valeur est « vide » si elle est vide ou encore entre crochets (`[…]`). Les règles s'appliquent **dans cet ordre**, la première qui s'applique donne le verdict :
   1. Si l'une des six lignes est absente du tableau → JNSP (un tableau partiel n'est pas jugeable, même si un manque y est visible).
   2. Si « Actions irréversibles possibles » n'est ni vide ni « aucune » et que « Seuil d'arrêt » est vide → FAIL.
   3. Si « Credentials présents » ou « Ressources partagées en écriture » n'est ni vide ni « aucun » / « aucune » et que « Isolation » ou « Sorties réseau autorisées » est vide → FAIL.
   4. Sinon → PASS.

   Les comparaisons à « aucun », « aucune » et « Non applicable » ignorent la casse, les espaces et le point final.
5. Émettre un verdict conforme à un nouveau schéma `gate-precheck.schema.json`, placé à côté des schémas de verdict existants.

### Output
Verdict `PASS` | `FAIL` | `JNSP`, avec `exitCode` 0 | 1 | 2, la liste des manques (FAIL), des lignes absentes (JNSP) et des avertissements.

### Cas limites
Chacun devient un critère « Unwanted behaviour » ci-dessous : SPEC introuvable ; section présente mais tableau illisible ; mots-clés présents sans section ; SPEC archivée sans aucune des sections v1.9.

## 3. Critères d'Acceptation (EARS)

### CA-001 — Non-régression sur les SPEC existantes
> Pattern : Ubiquitous

`The gate-precheck command SHALL return exit code 0 for each of the 67 SPEC files present in .aiad/specs/archive/ on 2026-09-25.`

- [x] Implémenté

### CA-002 — Mots-clés sans section
> Pattern : Unwanted behaviour

`IF a SPEC contains a listed keyword AND has no "Périmètre d'exécution de l'agent" section, THEN the gate-precheck command SHALL return exit code 0 with one warning per keyword found.`

- [x] Implémenté

### CA-003 — Action irréversible sans seuil d'arrêt
> Pattern : Unwanted behaviour

`IF the "Actions irréversibles possibles" row declares at least one action AND the "Seuil d'arrêt" row is empty, THEN the gate-precheck command SHALL return exit code 1.`

- [x] Implémenté

### CA-004 — Credentials ou ressource partagée sans isolation
> Pattern : Unwanted behaviour

`IF the "Credentials présents" row or the "Ressources partagées en écriture" row declares at least one item AND the "Isolation" row or the "Sorties réseau autorisées" row is empty, THEN the gate-precheck command SHALL return exit code 1.`

- [x] Implémenté

### CA-005 — Section non applicable
> Pattern : Event-driven

`WHEN the "Périmètre d'exécution de l'agent" section contains only "Non applicable", the gate-precheck command SHALL return exit code 0.`

- [x] Implémenté

### CA-006 — Tableau incomplet
> Pattern : Unwanted behaviour

`IF the "Périmètre d'exécution de l'agent" section lacks at least one of the six rows defined in SPEC-033-2, THEN the gate-precheck command SHALL return exit code 2.`

- [x] Implémenté

### CA-006b — Tableau incomplet prioritaire sur un manque
> Pattern : Unwanted behaviour

`IF the "Périmètre d'exécution de l'agent" section lacks at least one of the six rows AND declares an irreversible action with an empty "Seuil d'arrêt" row, THEN the gate-precheck command SHALL return exit code 2.`

- [x] Implémenté

### CA-007 — SPEC introuvable
> Pattern : Unwanted behaviour

`IF the SPEC identifier resolves to no file, THEN the gate-precheck command SHALL return exit code 2.`

- [x] Implémenté

### CA-008 — Sortie validée par schéma
> Pattern : Event-driven

`WHEN the --json flag is passed, the gate-precheck command SHALL print a JSON verdict that validates against gate-precheck.schema.json.`

- [x] Implémenté

### CA-009 — Intégration à la Gate
> Pattern : Ubiquitous

`The /sdd gate command file SHALL instruct running "npx aiad-sdd gate-precheck <SPEC-id>" before the SQS scoring step.`

- [x] Implémenté

### CA-009b — Gate fermée sur FAIL
> Pattern : Ubiquitous

`The /sdd gate command file SHALL state that a gate-precheck FAIL verdict closes the Gate.`

- [x] Implémenté

### CA-009c — Gate inconnue sur JNSP
> Pattern : Ubiquitous

`The /sdd gate command file SHALL state that a gate-precheck JNSP verdict sets the Gate to INCONNUE.`

- [x] Implémenté

### CA-010 — Cas canary déterministe
> Pattern : Ubiquitous

`The canary suite SHALL contain one deterministic case that expects exit code 1 from gate-precheck on a fixture SPEC declaring an irreversible action without a stop threshold.`

- [x] Implémenté

## 4. Interface / API

```
npx aiad-sdd gate-precheck <SPEC-id|chemin> [--json]
  exit 0 : PASS  (avertissements éventuels)
  exit 1 : FAIL  (manques listés)
  exit 2 : JNSP  (SPEC introuvable ou tableau incomplet)

JSON : { verdict, exitCode, spec, section: "absente"|"non-applicable"|"declaree",
         manques: string[], lignesAbsentes: string[], avertissements: string[] }
```

## 5. Dépendances

- SPEC-033-1 (parité des commandes : `gate.md` modifié dans les deux exemplaires), SPEC-033-2 (format de la section).
- Réutilise : `lib/verdict.js` (contrat de sortie), `lib/frontmatter.js`, mécanisme de chargement des schémas (`chargerSchemaVerdict`), `lib/canary.js`.
- Enregistrement de la commande : `bin/aiad-sdd.js`, `lib/cli-schema.js` (même motif que `research`).

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~2 000 tokens
- Cette SPEC : ~2 500 tokens
- Fichiers source pertinents : `lib/research.js` (motif), `lib/verdict.js`, `lib/canary.js`, `bin/aiad-sdd.js` (section `research`), `.claude/sdd/gate.md`, tests existants de verdict
- **Total estimé** : ~20 000 tokens

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing
- [x] Tests unitaires couvrant CA-001 à CA-008 (dont le rejeu sur les 67 SPEC archivées)
- [x] Cas canary ajouté (CA-010)
- [x] Annotations `@intent INTENT-033` / `@spec SPEC-033-3` / `@verified-by`
- [x] SPEC mise à jour si écart (Drift Lock)
- [ ] Code review passée
- [x] Gouvernance vérifiée (RGESN : zéro dépendance)

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-09-25 | Gate (1er passage) : CA-009 découpé en CA-009, 009b, 009c (R2) ; CA-010 reformulé (R7). | Linter EARS strict : 2 violations. |
| 2026-09-26 | Gate : ordre d'évaluation explicite, JNSP (tableau incomplet) avant FAIL ; CA-006b ajouté ; normalisation des comparaisons précisée. | Décision de l'auteur — la priorité entre JNSP et FAIL n'était pas définie. |
| 2026-09-26 | Execution Gate OUVERTE — SQS 5/5, Test de l'Étranger PASS ; linter EARS strict : 0 violation. Statut → ready. | Scores validés par l'auteur. |
| 2026-09-26 | Implémentation (précisions, pas d'écart de comportement) : `section: null` dans le JSON quand la SPEC est introuvable ; appel sans argument → JNSP (exit 2) ; titres situés dans un bloc de code clôturé ignorés ; emphase et guillemets tolérés autour de « Non applicable » ; cas canary CANARY-011 + fixture `.aiad/canary/fixtures/` (livrés aussi dans `templates/.aiad/canary/`) ; entrée `gate-precheck` ajoutée au catalogue `lib/cli-schema.js`. Rejeu CA-001 : 67/67 SPEC archivées en exit 0, dont 6 avec avertissements mots-clés. | Cas non couverts par l'interface §4 ni par les critères. |
