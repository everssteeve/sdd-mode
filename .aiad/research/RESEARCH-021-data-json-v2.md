---
id: RESEARCH-021
intent: INTENT-016
spec: SPEC-016-3
author: Steeve Evers
date: 2026-06-22
status: done
verdict: CONDITIONAL GO
confidence: 100
---

# RESEARCH-021 — data.json v2 versionné — Discovery post SPEC-016-1/2  (← SPEC-016-3 / INTENT-016)

> Research ciblée SPEC-016-3, ancrée dans le codebase **post-SPEC-016-1** (4-layer architecture)
> et **post-SPEC-016-2** (design system RGAA). RESEARCH-020 couvrait INTENT-016 globalement
> avec un ancrage pré-refactor ; cet artefact réancre les points d'implémentation réels.
> La Research informe ; **l'humain tranche le GO/NO-GO**.

---

## Discovery (ancrage code — agent Explore, read-only)

**Point d'injection `_meta` — ÉCART avec la SPEC**

SPEC-016-3 § Processing citait `collecterEnrichi()` / `model/index.js` comme point d'injection. Le Discovery post-SPEC-016-1 révèle le vrai chemin :

- `lib/dashboard/model/index.js:141-305` — `enrichir()` assemble les champs calculés mais ne construit pas `_meta`.
- `lib/dashboard.js:340-373` — `serializerDonnees()` : point réel d'injection de `_meta` (appel `buildMeta()` ligne 343).
- `lib/meta.js:28-35` — `buildMeta()` : source unique `_meta` pour dashboard, doctor, brief.

**Structure actuelle de `_meta` dans `dashboard/data.json:2-7` :**

- `schema: "aiad-sdd-dashboard"`, `version: "1.18.0"`, `generated`, `slim: true` — ni `schema_version` ni `_schema`.

**Fichiers à créer (absents) :**

- `lib/dashboard/schema/data-v2.schema.json` — dossier `schema/` inexistant.
- `scripts/validate-data-schema.js` — absent.
- Job `validate-schema` dans `.github/workflows/ci.yml` — absent.

**Clés racine `data.json` (154 au total) :** `_meta`, `projet`, `intents`, `specs`, `gouvernance`, `facts`, `changelog`, `metrics`, `maturite`, `santeGlobale` + 144 clés calculées — toutes conservées (rétrocompatibilité garantie par `additionalProperties: true`).

**Consommateurs de `data.json` :**

- `lib/badge.js:48-53` — `lireData()` — `santeGlobale`, `maturite`, `violations`.
- `lib/brief.js` — `lireData()` — `santeGlobale`, `_meta`, `projet`, `intents`, `specs`.
- `lib/doctor.js:291-310` — `lireSanteGlobale()` / `lireSourceBasePublicUrl()` — `santeGlobale`, `sourceBase`, `publicUrl`.
- `lib/status.js:137` — `santeGlobale`.
- `lib/dashboard/views/*.js` — objet `donnees.*` en mémoire (pas de lecture disque directe).

Aucun consommateur ne lit `_meta.schema_version` — l'ajout est rétrocompatible.

**Pipeline CI (`.github/workflows/ci.yml`) :** jobs `test` → `coverage` → `pack` → `a11y` → `reproducibility` → `reproducibility-verify`. Insertion `validate-schema` après `test`, avant `coverage`.

**Contraintes non négociables :**

- `lib/meta.js:28-35` = source unique `_meta` — ne pas dupliquer.
- Zéro dépendance runtime — validation inline (JSON.parse + checks manuels).
- ESM-only — `scripts/validate-data-schema.js` en `import`/`export`.
- Mode `slim: true` actif → schéma doit valider slim et full.

---

## Faisabilité

**Réalisable avec l'architecture actuelle ?** Oui, faible complexité.

Les 4 actions sont claires et bornées :
1. Modifier l'appel `buildMeta()` dans `lib/dashboard.js:343-347` (+2 champs).
2. Créer `lib/dashboard/schema/data-v2.schema.json` (JSON Schema draft 2020-12, ~50 lignes).
3. Créer `scripts/validate-data-schema.js` (validation inline, ~40 lignes).
4. Ajouter job `validate-schema` dans `.github/workflows/ci.yml` (~15 lignes).

Aucune migration de consommateurs requise. Les tests existants ne sont pas impactés (les assertions sur `_meta` vérifieront de nouvelles clés en plus).

**Alternatives écartées :**
- Injecter `schema_version` dans `buildMeta()` directement : briefe les autres sorties CLI (doctor, brief) qui ne suivent pas le schéma dashboard — non.
- Utiliser `ajv` comme dépendance runtime : interdit (zero-dep) — non.

---

## Risques & inconnues

- R1 — Écart SPEC § Processing : référence `collecterEnrichi()` / `model/index.js` — point réel = `serializerDonnees()` / `lib/dashboard.js:343` + `buildMeta()` / `lib/meta.js:28`. Levé par C1 (correction SPEC incluse dans ce Research).
- R2 — Mode slim actif (`slim: true`) : lister les clés absentes en slim avant de les marquer `nullable` dans le schéma — décidable à l'exécution, pas bloquant.
- R3 — Tests : assertions sur `_meta` dans `test/dashboard.test.js` à compléter pour `schema_version` — non bloquant (existantes ne cassent pas).

Aucun `TODO-JNSP` — tous les risques sont bornés et décidables.

---

## Verdict : CONDITIONAL GO (confidence: 100 %)

> Tranché par **Steeve Evers** — 2026-06-22.
> Verdict machine : CONDITIONAL (exit 0) — `/sdd exec` autorisé après levée de C1.

## Conditions

- C1 : Corriger SPEC-016-3 § Processing — remplacer la référence à `collecterEnrichi()` / `model/index.js` par `serializerDonnees()` / `lib/dashboard.js:343-347` + `buildMeta()` / `lib/meta.js:28-35`. Correction incluse dans ce Research (Drift Lock). ✓ Levée.

---

*Verdict machine : `npx aiad-sdd research RESEARCH-021` (exit 0/1/2)*
