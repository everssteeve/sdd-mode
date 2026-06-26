---
id: RESEARCH-035
title: Dogfooding complet — le CLI sous SPEC
intent: INTENT-022
author: Steeve Evers
date: 2026-06-26
verdict: GO
confidence: 90
status: tranché
---

# RESEARCH-035 — Dogfooding complet — le CLI sous SPEC

> Research pré-SPEC pour INTENT-022. Discovery ancré dans le code réel.
> L'humain tranche le GO/NO-GO — ce document informe, ne décide pas.

## Discovery

Zones clés cartographiées (ancrages `chemin:ligne`, agent Explore read-only) :

- `lib/sdd-trace.js:1-15` — scanner d'annotations, déjà annoté (`@intent INTENT-024`, `@spec SPEC-024-1`) ; c'est l'outil de mesure de INTENT-022
- `lib/emit-rules.js:187-190` — annoté partiellement (`@spec SPEC-005-1-context-pull`) sur une seule sous-fonction ; le reste du fichier (~1 000 lignes) n'est pas couvert
- `lib/init.js:1-384` — aucune annotation ; module cœur (init projet AIAD), 384 lignes, tests `test/init.test.js` (4 415 lignes)
- `bin/aiad-sdd.js:1` — aucune annotation ; orchestrateur principal 2 900 lignes, 60+ imports, dispatche toutes les commandes
- `lib/governance.js:1-95` — aucune annotation ; SPEC-002-1 existante dans `.aiad/specs/archive/` disponible pour mapping
- `lib/hooks.js:1-209` — aucune annotation ; SPEC-011-1 existante disponible pour mapping
- `lib/fs-ops.js:1-208` — aucune annotation ; module utilitaire filesystem
- `lib/frontmatter.js:1-163` — aucune annotation ; parser frontmatter YAML partagé par trace + spec
- `lib/doctor.js:1-492` — aucune annotation ; SPEC-004-1 existante disponible pour mapping
- `lib/cli-schema.js:1-2400` — aucune annotation ; schéma CLI 2 400 lignes, surface large
- `.aiad/hooks/drift-lock.js:1` — aucune annotation ; hook stop enforce drift check
- `.aiad/hooks/veto.js:1` — aucune annotation ; hook stop gouvernance veto
- `.aiad/metrics/traceability/trace.json:1` — snapshot actuel : 321 entrées `code_without_spec`, 41/117 fichiers `lib/` annotés (35 %)

**Totaux snapshot `trace.json` (2026-06-26)** :
- `lib/` : 117 fichiers — 41 annotés (35 %), **76 sans annotation (65 %)**
- `code_without_spec` bloquant : **321 entrées**
- SPECs archivées disponibles pour mapping rétroactif : **56 SPECs** dans `.aiad/specs/archive/`

### Contraintes existantes

- Le scanner `lib/sdd-trace.js` est fonctionnel et lit déjà les annotations `@spec`/`@intent`/`@verified-by` — l'outillage existe.
- 56 SPECs archivées couvrent déjà une partie des modules (`SPEC-002-1` gouvernance, `SPEC-005-1` emit-rules, `SPEC-011-1` hooks, `SPEC-024-1` trace). L'annotation peut mapper vers ces SPECs sans créer de nouvelles SPECs.
- L'Intent prescrit une approche **progressive par module touché** — pas de big bang.
- `bin/aiad-sdd.js` est le fichier le plus volumeux (172 KB, ~2 900 lignes) et concentre l'orchestration de 60+ commandes — une SPEC unique ne serait pas réaliste.

### Surface de test existante

- Tests des modules cœur : excellente couverture brute
  - `test/init.test.js` (4 415 lignes), `test/emit-rules.test.js` (8 433 lignes), `test/trace.test.js` (10 649 lignes)
- 273 fichiers de test au total — 51 annotés (18 %)
- La question n'est pas la couverture test (elle est bonne) mais l'annotation `@verified-by` manquante sur la majorité

---

## Faisabilité

**Réalisable avec l'architecture actuelle.** Le scanner de traçabilité (`lib/sdd-trace.js`) est déjà opérationnel et mesure les gaps. L'outillage complet est en place ; le travail est principalement :

1. **Annotation rétroactive** : ajouter `@spec SPEC-XXX-Y` sur les modules cœur en pointant vers les 56 SPECs archivées existantes (pas de nouvelle SPEC nécessaire pour la majorité).
2. **SPECs nouvelles** uniquement pour les modules sans SPEC existante (`lib/init.js`, `lib/fs-ops.js`, `lib/frontmatter.js`, `lib/cli-schema.js`, `bin/aiad-sdd.js`).
3. **Campagne d'annotation progressive** : à chaque PR touchant un module non annoté, obligation d'annoter avant merge.

**Coût estimé** :
- Phase 1 (modules cœur) : ~1-2 sessions SDD pour créer SPEC-022-1 (init) + mapper les annotations vers SPECs archivées existantes.
- Phase 2 (campagne progressive) : intégré au workflow normal — chaque PR annotera les fichiers qu'elle touche.

---

## Risques & inconnues

| # | Risque | Probabilité | Impact | Mitigation |
|---|--------|-------------|--------|-----------|
| R1 | Les 56 SPECs archivées ne correspondent plus exactement au code actuel (drift historique) | Probable | Moyen | Vérifier SPEC ↔ code avant d'annoter ; marquer `@spec SPEC-XXX-Y (legacy)` si dépassée |
| R2 | `lib/cli-schema.js` (2 400 lignes) et `bin/aiad-sdd.js` (2 900 lignes) sont trop volumeux pour une seule SPEC | Certain | Faible | Découper en sous-SPECs par groupe fonctionnel (déjà prévu dans INTENT-022) |
| R3 | La campagne progressive ralentit les PRs si le pre-commit bloque sur absence d'annotation | Possible | Moyen | Le pre-commit ne bloque que sur les marqueurs JNSP ouverts — pas sur l'absence d'annotation ; le drift-lock est avertissement non-bloquant pour les fichiers existants |
| R4 | Scope creep : vouloir annoter les 76 fichiers en une seule session | Probable | Élevé | Contrainte INTENT-022 explicite : progressif par module touché, pas de big bang |

> Aucune inconnue bloquante ne requiert une décision humaine préalable.

---

## Gouvernance

Périmètre : modifications de `lib/` et `bin/` (code applicatif JS, pas d'UI, pas de données personnelles).

| Agent | Déclenché ? | Verdict préliminaire |
|-------|-------------|---------------------|
| AIAD-RGESN | Oui (dépendances, annotations) | Annotations légères — impact négligeable |
| AIAD-AI-ACT | Non (pas de composant IA dans les annotations) | N/A |
| AIAD-RGPD | Non (pas de données personnelles) | N/A |
| AIAD-RGAA | Non (pas d'UI) | N/A |

---

## Verdict

> **Verdict : GO (confidence: 90 %)** — Steeve Evers, 2026-06-26

`/sdd spec` autorisé. Pas de condition bloquante.
