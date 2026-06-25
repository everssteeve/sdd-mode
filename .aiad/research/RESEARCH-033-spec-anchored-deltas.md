---
id: RESEARCH-033
intent: INTENT-020
author: Steeve Evers
date: 2026-06-25
status: done
verdict: CONDITIONAL GO
confidence: 85
---

# RESEARCH-033 — Spec-anchored par construction : deltas et redevabilité bidirectionnelle (← INTENT-020)

> Phase Research (§3.5) — entre l'Intent et la SPEC. Elle ne score PAS la
> qualité d'une SPEC (c'est le rôle du SQS) mais la **viabilité de l'intention**,
> ancrée dans le code réel. La Research informe ; **l'humain tranche le GO/NO-GO**.
> Verdict machine : `npx aiad-sdd research RESEARCH-033`.

---

## ⚠ Alerte Human Authorship

INTENT-020 est en `status: draft` avec la note :
> "Draft issu de l'analyse du 2026-06-11. POURQUOI à approprier par un humain avant passage en `active`."

La procédure Research peut être conduite (Discovery informationnel), mais **le verdict ne peut être posé que par Steeve Evers** et vaut appropriation implicite de l'Intent. Si tu souhaites d'abord amender l'Intent avant de trancher, c'est le bon moment.

---

## Discovery (ancrage code — agent Explore, read-only)

Zones clés cartographiées (ancrages `chemin:ligne`) :

- `.aiad/specs/_index.md:1-74` — 50+ SPECs, statuts draft→archived, aucun delta-history interne
- `lib/dashboard/digest-delta.js:1-170` — pattern snapshot+diff existant (métriques projet, pas SPEC individuelle)
- `lib/archive.js:112-118` — archivage par déplacement entier + patch frontmatter (`archivedAt/By/Reason`)
- `.claude/sdd/fact.md:1-94` — pipeline FACT : lien SPEC obligatoire, 16 FACTs tracés
- `.claude/sdd/drift-check.md:1-103` — Drift Lock : heuristique git + matrice `@spec` machine-vérifiable
- `lib/sdd-trace.js:39-68` — annotations `@spec/@intent/@verified-by/@governance`, ~50 fichiers annotés
- `bin/aiad-sdd.js:2550-2620` — CLI `archive done`, extensible pour `spec update`
- `.aiad/CHANGELOG-ARTEFACTS.md:1-100+` — raisons d'archivage horodatées, pas de deltas intra-SPEC
- `test/archive.test.js:1-300+` — 45+ tests archive/restaurer/listerLivrables (réutilisable pour deltas)
- `.aiad/facts/FACT-001-seuil-50k-non-source.md:1-58` — exemple FACT → Intent → SPEC → Code

### 1. SPECs actuelles — structure et format

- `.aiad/specs/_index.md:1-74` — index complet, colonnes : ID, Titre, Intent parent, Format (prose|EARS), SQS, Statut, PR. Statuts observés : draft → review → ready → in-progress → validation → done → archived.
- `.aiad/specs/archive/SPEC-001-1-feedback-qualitatif.md:1-13` — exemple frontmatter archivé : champs `archivedAt`, `archivedBy`, `archivedReason`. Pas de delta-history interne.
- `.aiad/specs/archive/SPEC-032-1-model-actionnable.md:1-10` — champ `traceability: exempt` avec raison. Format émergent non standardisé.
- `.aiad/specs/archive/SPEC-026-1-archive-done.md:25-106` — format EARS, sections Input/Processing/Output/CA ; archivage par déplacement entier, aucune version intermédiaire conservée.
- **50+ SPECs** dans l'archive, ratio EARS ~30 %, ratio archivé ~70 %.

### 2. Modèle de deltas existant

- `lib/dashboard/digest-delta.js:1-170` — snapshots horodatés append-only en `.aiad/metrics/digest/YYYY-MM-DD-HHmm.json`. Diff courant vs précédent (comptes agrégés). **Deltas sur métriques projet, pas sur contenu SPEC individuelle.**
- `lib/dashboard/tech-debt-history.js:1-16` et `lib/dashboard/sante-globale-history.js:1-100` — même pattern snapshot+diff pour d'autres métriques.
- `lib/archive.js:112-118` — archivage par **déplacement entier** + patch frontmatter (`status: archived`, `archivedAt`, `archivedBy`, `archivedReason`). Pas de modèle OpenSpec (deltas archivés ≠ déplacement entier).
- `.aiad/CHANGELOG-ARTEFACTS.md:1-100+` — entrées horodatées par SPEC livrée (raison, impact, FACT déclencheur, verdict). Aucun enregistrement des edits intermédiaires intra-SPEC.

### 3. `/sdd fact` — capture d'écarts

- `.claude/sdd/fact.md:1-94` — pipeline : livré vs désiré + SPEC concernée (obligatoire) + impact qualifié + décision d'action (patch / Intent / SPEC update / dette). Template `FACT-NNN.md` ; lien SPEC obligatoire.
- `.aiad/facts/` — 16 FACTs tracés (FACT-001 à FACT-016). Boucle validée : FACT → Intent → SPEC → Code → drift-check → CHANGELOG-ARTEFACTS.
- **Gap clé** : le FACT crée un signal, mais **aucun formulaire automatisé de mise à jour SPEC** n'existe. L'agent peut proposer une mise à jour SPEC via le FACT, mais le PE doit l'exécuter manuellement.

### 4. Drift Lock et traçabilité machine-vérifiable

- `.claude/sdd/drift-check.md:1-103` — Drift Lock = heuristique git (code modifié sans SPEC MAJ dans même PR) + matrice machine-vérifiable (`@spec/@intent/@verified-by/@governance`). Verdict : OK / DRIFT / INCONNU (fail-closed).
- `.claude/skills/drift-detection/SKILL.md:1-110` — types drift : code-ahead-of-spec, spec-ahead-of-code, orphan-change, architecture-drift.
- `lib/sdd-trace.js:1-1200+` — annotations `@spec SPEC-NNN-N-slug` strictes. ~50 fichiers annotés. Exit 0 (OK) / 1 (gap bloquant) / 2 (JNSP).
- **Gap INTENT-020** : critère de drift déclaré dans l'Intent ("contrainte violée sans mise à jour SPEC ni fact associé") = nouveau type de drift non encore modélisé dans `drift-detection`.

### 5. Redevabilité actuelle (unidirectionnelle)

- **PE → Code** : SPECs prescrivent → code implémente → drift-check valide. Bien établi.
- **Agent → PE** : agent découvre violation → crée FACT → PE décide. FACT création requiert PE ; agent ne fait que signaler.
- **Gap INTENT-020** : aucun mécanisme de **redevabilité bidirectionnelle agent → SPEC** :
  - Pas de "proposition de delta SPEC" autogénérée par l'agent.
  - Pas de workflow "détection violation → diff SPEC → merge (avec validation humaine)".
  - Pas d'annotation ni d'event pour "contrainte violée découverte en exécution".

### 6. Annotations et extensibilité

- `lib/sdd-trace.js:39-68` — format annotations fixe. Pas de champ pour "contrainte-violée" ou "delta-proposé".
- `bin/aiad-sdd.js:2550-2620` — CLI `archive done` + `lib/archive.js`. Extensible pour une commande `aiad-sdd spec update <SPEC-ID>`.

### 7. Tests existants

- `test/archive.test.js:1-300+` — 45+ tests (archiver, restaurer, listerLivrables, listerOrphelins). Pattern réutilisable pour deltas.
- `test/drift-verdict.test.js` — couverture OK/DRIFT/INCONNU.
- `test/trace*.test.js` — gap detection @spec / @intent. Extensible pour nouveau type de drift "contrainte violée".
- `test/dashboard-digest.test.js` — pattern snapshot+diff déjà prouvé, réutilisable pour deltas SPEC.

---

## Faisabilité

**Réalisable avec l'architecture actuelle ?** Oui, partiellement — les briques existent mais doivent être composées différemment.

Le projet dispose déjà de :
- Un pattern **snapshot + diff** prouvé (digest-delta, tech-debt-history, velocity-comparison).
- Un système d'**archivage avec audit trail** complet (archivedAt/By/Reason + HMAC audit.jsonl).
- Un cycle **FACT → SPEC → Code → drift-check** fonctionnel.
- Un CLI `aiad-sdd archive` extensible pour une sous-commande `spec update`.

L'intention couvre **deux périmètres distincts** qui ont chacun leur propre complexité :

**Périmètre A — Modèle deltas/archive (specs = état courant)** :
Implémentable via `aiad-sdd spec update <ID> --patch <fichier-diff>` + entrée dans CHANGELOG-ARTEFACTS. Coût : 1 SPEC de taille moyenne. Risque faible.

**Périmètre B — Redevabilité bidirectionnelle agent → SPEC** :
Beaucoup plus complexe car il touche au principe fondamental d'Human Authorship : *qui peut modifier une SPEC ?* Si l'agent peut proposer des mises à jour SPEC, le workflow doit garantir validation humaine avant merge. Coût : 1-2 SPECs + nouveau type drift. Risque : tension conceptuelle AIAD non résolue (voir R3 ci-dessous).

**Alternatives** :
- Périmètre A seul : quick win, valeur immédiate sans risque conceptuel.
- Périmètre B via FACT enrichi : au lieu d'un nouveau workflow, enrichir le FACT avec un champ `spec-patch-proposal: <diff>` + intégrer dans `/sdd fact` → coût plus faible, même valeur.

---

## Risques & inconnues

- R1 — Frontière delta/archivage non définie : quand un changement SPEC est-il un "delta" (typo, seuil) vs une refonte nécessitant une nouvelle version archivée ? Critère manquant → ambiguïté en exécution. À décider avant SPEC-020-1.
- R2 — Proportionnalité non bornée : "ne pas alourdir pour les petits changements" sans définition de "petit". À préciser en CA mesurable (ex. : < N lignes = delta léger, sinon workflow complet).
- R3 — Tension Human Authorship / agent co-auteur SPEC : si l'agent peut proposer des mises à jour SPEC, il devient co-auteur — tension avec le principe fondamental AIAD. Garde-fou explicite requis (agent peut signaler via FACT uniquement, jamais écrire directement dans une SPEC sans instruction PE).
- R4 — Nouveau type de drift non implémenté : "contrainte violée sans SPEC update ni fact" = type `constraint-violated-without-fact` absent de `drift-detection` et `sdd-trace.js`. À ajouter ou rester implicite ?
- R5 — Boucle Drift Lock : si l'agent met à jour une SPEC, le hook pre-commit déclenchera un drift-check sur la SPEC modifiée — le workflow "agent update SPEC" doit lui-même être spec-anchored pour ne pas générer le drift qu'il corrige.

---

## Verdict

> **Tranche ici, Steeve.**
>
> Vu le Discovery et les risques, quel est ton verdict ?
>
> - **GO** : on spécifie les deux périmètres (A + B), pas d'inconnue bloquante.
> - **CONDITIONAL GO** : on spécifie, mais avec des conditions (ex. : périmètre B limité au signalement via FACT enrichi, R3 neutralisé).
> - **DEFER** : on attend d'avoir plus de recul sur l'usage réel (cycle trop court pour voir le pattern).
> - **NO-GO** : le coût/risque conceptuel est trop élevé par rapport à la valeur.
>
> Confiance (0-100 %) ?
>
> Note : ta réponse vaut appropriation implicite de l'Intent INTENT-020 (passage `draft` → `active`).

## Verdict : CONDITIONAL GO (confidence: 85 %)

> Tranché par **Steeve Evers** — 2026-06-25.
> Verdict machine : CONDITIONAL (exit 0) — `/sdd spec` autorisé (conditions C1 + C2 à lever).
> Note : ce verdict vaut appropriation de INTENT-020 (draft → active).

## Conditions (si CONDITIONAL GO)

- C1 — Human Authorship préservé (R3) : périmètre B limité au signalement via FACT enrichi. L'agent ne peut jamais écrire directement dans une SPEC sans instruction PE explicite. Toute proposition transite par un FACT avec champ `spec-patch-proposal`, validé par le PE avant application.
- C2 — Critère "petit changement" quantifié (R1) : SPEC-020-1 DOIT définir une frontière delta/archivage mesurable (ex. : changement < N lignes = delta léger, sinon workflow complet avec entrée CHANGELOG-ARTEFACTS). Ce critère est un CA testable de SPEC-020-1.
