---
status: archived
archivedAt: "2026-06-24T09:49:36.974Z"
archivedBy: evers.steeve@gmail.com
archivedReason: FACT-008 — SPECs done sans frontmatter YAML détectées via fallback body
---
# SPEC-016-3 — data.json v2 versionné (JSON schema publié)

**Intent parent** : INTENT-016
**Research** : RESEARCH-020 — GO (100 %) · RESEARCH-021 — CONDITIONAL GO (100 %, C1 levée)
**Auteur** : Steeve Evers
**Date** : 2026-06-22
**Statut** : done
**Format** : prose
**SQS** : 5/5 — Gate OUVERTE (2026-06-22)

---

## 1. Contexte

`dashboard/data.json` (4 144 lignes, 95 KB) mélange données brutes et calculées au même niveau racine sans schéma publié ni contrat d'API déclaré. La clé `_meta.version` suit `package.json` mais ne distingue pas la version du schéma de la version du logiciel. Aucun consommateur externe ne peut valider le fichier programmatiquement. La v2 introduit un champ `_meta.schema_version`, sépare les métadonnées de schéma, et publie un JSON Schema machine-lisible — sans casser les 30+ consommateurs existants.

## 2. Comportement Attendu

### Input

La commande `npx aiad-sdd dashboard` (ou `dashboard --slim`) génère `dashboard/data.json`. Aucun changement de déclencheur.

### Processing

**Point d'injection réel (post SPEC-016-1) — `lib/dashboard.js:343-347` :**

`_meta` est construit dans `serializerDonnees()` via `buildMeta()` (`lib/meta.js:28-35`),
**pas** dans `model/index.js`. Modifier l'appel `buildMeta()` dans `lib/dashboard.js:343` :

```js
// lib/dashboard.js:343-347 — avant
const _meta = buildMeta({
  schema: 'aiad-sdd-dashboard',
  slim: !options.full,
  generated: d.projet?.genere,
});

// lib/dashboard.js:343-349 — après (SPEC-016-3)
const _meta = buildMeta({
  schema: 'aiad-sdd-dashboard',
  schema_version: '2.0',
  slim: !options.full,
  generated: d.projet?.genere,
});
const _schema = {
  url: 'https://aiad.ovh/schema/data-v2.schema.json',
  local: 'lib/dashboard/schema/data-v2.schema.json',
};
const out = { _meta, _schema, ...d };
```

Résultat dans `data.json` :
   ```json
   "_meta": {
     "schema": "aiad-sdd-dashboard",
     "schema_version": "2.0",
     "version": "1.18.x",
     "generated": "…",
     "slim": false
   }
   ```
2. Publier le schéma JSON dans `lib/dashboard/schema/data-v2.schema.json` (validation inline via `JSON.parse` + vérification manuelle — zéro dep runtime).
3. Ajouter une section `_schema` à la racine de `data.json` (voir ci-dessus) :
   ```json
   "_schema": {
     "url": "https://aiad.ovh/schema/data-v2.schema.json",
     "local": "lib/dashboard/schema/data-v2.schema.json"
   }
   ```
4. Toutes les clés existantes au niveau racine (`projet`, `fondamentaux`, `intents`, `specs`, `gouvernance`, `facts`, `changelog`, `metrics`, `qa`, `pm`, `velocity`, …) sont conservées à l'identique — rétrocompatibilité totale.

**Schéma publié (`lib/dashboard/schema/data-v2.schema.json`) :**
- `$schema: "https://json-schema.org/draft/2020-12/schema"`
- Décrit `_meta`, `_schema`, `projet`, `fondamentaux`, `intents`, `specs`, `gouvernance` — les 7 entités structurantes.
- Les champs calculés (`qa`, `pm`, `velocity`, etc.) sont déclarés `additionalProperties: true` au niveau racine pour ne pas bloquer l'évolution.
- `required: ["_meta", "projet", "intents", "specs"]`

**Validation en CI :**
- Nouveau script `scripts/validate-data-schema.js` : lit `dashboard/data.json`, valide contre `lib/dashboard/schema/data-v2.schema.json` via `JSON.parse` + validation inline (zéro dep runtime).
- Ajout d'un job `validate-schema` dans `.github/workflows/ci.yml` après le job `test`.

### Output

- `dashboard/data.json` — inchangé structurellement, `_meta.schema_version: "2.0"` ajouté.
- `lib/dashboard/schema/data-v2.schema.json` — nouveau fichier.
- `scripts/validate-data-schema.js` — nouveau script CI.

### Cas limites

- **Mode `--slim`** : le flag slim produit un sous-ensemble des champs. Le schéma v2 marque les champs slim-exclus comme `nullable: true`. Le script de validation accepte les deux modes.
- **Champs calculés inconnus** : si `collecterEnrichi()` ajoute un champ non déclaré dans le schéma, la validation ne doit pas échouer (les champs non listés dans le schéma sont permis au niveau racine via `additionalProperties: true`).
- **Données vides** : si `.aiad/intents/` est vide, `intents` vaut `[]` — le schéma doit l'accepter (array, minItems non contraint).
- **Génération hors-ligne** : `schema_version` est écrit sans appel réseau — la valeur est hardcodée dans l'appel `buildMeta()` de `serializerDonnees()` / `lib/dashboard.js:343`.

## 3. Critères d'Acceptation

- [x] `dashboard/data.json` contient `_meta.schema_version: "2.0"` après `npx aiad-sdd dashboard`.
- [x] `dashboard/data.json` contient `_schema.local: "lib/dashboard/schema/data-v2.schema.json"`.
- [x] `lib/dashboard/schema/data-v2.schema.json` existe et est un JSON Schema draft 2020-12 valide.
- [x] `node scripts/validate-data-schema.js` exit 0 sur le `data.json` généré.
- [x] `node scripts/validate-data-schema.js` exit 1 si `_meta` est absent ou `intents` n'est pas un array.
- [x] Toutes les clés racine présentes dans la v1 sont présentes dans la v2 (aucune régression de consommateur).
- [x] `npm test` passe sans modification des assertions de test existantes.
- [ ] Le job CI `validate-schema` passe sur la branche.
- [x] `npm run lint:deps` passe — zéro nouvelle dépendance runtime (validation inline, pas d'`ajv` en prod).

## 4. Interface / API

```js
// lib/dashboard/schema/data-v2.schema.json (extrait)
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://aiad.ovh/schema/data-v2.schema.json",
  "title": "AIAD SDD Dashboard Data v2",
  "type": "object",
  "required": ["_meta", "projet", "intents", "specs"],
  "additionalProperties": true,
  "properties": {
    "_meta": {
      "type": "object",
      "required": ["schema", "schema_version", "version", "generated"],
      "properties": {
        "schema": { "type": "string", "const": "aiad-sdd-dashboard" },
        "schema_version": { "type": "string", "pattern": "^\\d+\\.\\d+$" },
        "version": { "type": "string" },
        "generated": { "type": "string", "format": "date-time" },
        "slim": { "type": "boolean" }
      }
    },
    "intents": { "type": "array" },
    "specs": { "type": "array" },
    "projet": { "type": "object" }
  }
}

// scripts/validate-data-schema.js
// node scripts/validate-data-schema.js [path/to/data.json]
// exit 0 → valide, exit 1 → erreur de schéma
```

## 5. Dépendances

- `lib/dashboard.js:343-349` — `serializerDonnees()` / appel `buildMeta()` (point d'injection `_meta` + `_schema`)
- `lib/meta.js:28-35` — `buildMeta()` (source unique `_meta` pour tout le CLI)
- `.github/workflows/ci.yml` — ajout job `validate-schema`
- Zéro nouvelle dépendance runtime

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- Cette SPEC : ~500 tokens
- Fichiers source pertinents : `lib/dashboard.js:340-373` (serializerDonnees), `lib/meta.js:28-35` (buildMeta), `dashboard/data.json` (structure _meta existante)
- **Total estimé** : ~1 800 tokens

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing
- [x] `npm test` passe
- [x] `node scripts/validate-data-schema.js` exit 0
- [x] `lib/dashboard/schema/data-v2.schema.json` commité
- [x] Annotations `@spec SPEC-016-3` posées sur `lib/dashboard.js` (serializerDonnees) et `scripts/validate-data-schema.js`
- [x] SPEC mise à jour si écart (Drift Lock)
- [x] Gouvernance RGPD vérifiée — `data.json` ne contient pas de données personnelles (le schéma confirme l'absence de PII)
