---
id: SPEC-022-2
title: Campagne d'annotation progressive — enforcement new modules lib/
intent: INTENT-022
research: RESEARCH-035
author: Steeve Evers
date: 2026-06-26
status: in-progress
format: prose
sqs: 5/5
---

# SPEC-022-2 — Campagne d'annotation progressive — enforcement new modules `lib/`

**Intent parent** : INTENT-022 — Dogfooding complet (le CLI sous SPEC)
**Research** : RESEARCH-035 — GO (90 %)
**Auteur** : Steeve Evers
**Date** : 2026-06-26
**Statut** : draft
**Format** : prose
**SQS** : 5/5 — Gate OUVERTE (2026-06-26, après correction §4)

---

## 1. Contexte

INTENT-022 pose un critère de drift explicite : « un nouveau module applicatif de `lib/` mergé sans annotation `@spec` → drift de dogfooding ». Aujourd'hui, `aiad-sdd trace --fail-on-gap` traite les fichiers existants non-annotés comme des gaps non-bloquants (pour ne pas bloquer le développement courant). Cette SPEC spécifie un mécanisme d'enforcement qui :

1. Détecte automatiquement les **nouveaux** fichiers `lib/*.js` ajoutés dans un diff git sans annotation `@spec`.
2. Les déclare **bloquants** dans le verdict Drift Lock — empêchant le commit (hook Stop) et le merge (CI).
3. Laisse les fichiers existants non-annotés en **non-bloquants** pour préserver la vélocité courante.

## 2. Comportement Attendu

### Input

```
aiad-sdd trace [--fail-on-gap] [--new-files-only]
```

Nouveau flag `--new-files-only` : restreint l'analyse aux fichiers ajoutés (`git diff --name-only --diff-filter=A HEAD`) pour le reporting ciblé. Pas un prérequis pour le comportement décrit ci-dessous.

Le changement principal est dans la logique de classification des gaps dans `lib/sdd-trace.js` :

```js
// Nouveau champ dans un gap
gap.isNewFile: boolean  // true si le fichier a été ajouté dans le diff courant
gap.severity: 'bloquant' | 'non-bloquant'
// Règle : severity = 'bloquant' si isNewFile && !hasSpecAnnotation
```

### Processing

**Détection des nouveaux fichiers** (dans `lib/sdd-trace.js`) :

1. Exécuter `git diff --name-only --diff-filter=A HEAD -- lib/` (ou `git diff --cached` pour les fichiers stagés).
2. Croiser la liste avec les fichiers `lib/*.js` sans annotation `@spec`.
3. Pour chaque nouveau fichier sans `@spec` : marquer le gap `severity: 'bloquant'`.
4. Les fichiers existants sans `@spec` restent `severity: 'non-bloquant'`.

**Verdict Drift Lock** (dans `lib/sdd-trace.js` + `.aiad/hooks/drift-lock.js`) :

- `--fail-on-gap` échoue (exit 1) si au moins un gap `severity: 'bloquant'` est présent.
- Le message de blocage liste les nouveaux fichiers concernés avec la question : « Quelle SPEC couvre ce module ? Ajoute `@spec SPEC-XXX-Y` en tête de fichier. »

**Compatibilité rétroactive** :

- Les 76 fichiers existants non-annotés conservent `severity: 'non-bloquant'` → pas de régression sur les PRs en cours.
- Le décompte `non_bloquant` décroît naturellement au fil des annotations progressives.

**Métriques dashboard** :

- La page `dashboard/trace.html` (ou équivalent) expose :
  - `code_without_spec.bloquant` : compte de nouveaux fichiers non-annotés (cible = 0 permanent)
  - `code_without_spec.non_bloquant` : compte des fichiers hérités (tendance décroissante)

### Output

```json
// trace.json — nouveaux champs
{
  "gaps": {
    "codeSansSpec": {
      "bloquant": 0,
      "non_bloquant": 76,
      "total": 76
    }
  }
}
```

### Cas limites

- **Pas de dépôt git** (ex. : CI sans historique) : `git diff` échoue → tous les nouveaux fichiers détectés par absence d'annotation sont traités comme `non-bloquants`. Un warning est émis.
- **Fichier renommé** (`--diff-filter=R`) : traité comme fichier existant (non-bloquant) — le renommage n'est pas une création.
- **Fichier dans `lib/` mais pas applicatif** (ex. : `lib/*.test.js` si mal placé) : hors périmètre — la règle s'applique uniquement aux fichiers `lib/*.js` sans suffixe `.test.`.
- **Fichier hors `lib/`** (ex. : `bin/`, `scripts/`, `templates/`) : hors périmètre — seuls les modules applicatifs `lib/` sont concernés.
- **`git diff` lent ou indisponible** : délai timeout de 2 s ; en cas de timeout, classification `non-bloquant` par défaut (fail-open sur cette vérification spécifique, pas sur le drift global).

## 3. Critères d'Acceptation

- [ ] Ajouter un fichier `lib/nouveau-module.js` sans `@spec` dans un commit : `npx aiad-sdd trace --fail-on-gap` retourne exit 1 avec un message listant `lib/nouveau-module.js` comme gap bloquant.
- [ ] Ajouter `@spec SPEC-022-1-retro-annotations-core` en tête de `lib/nouveau-module.js` : `npx aiad-sdd trace --fail-on-gap` retourne exit 0.
- [ ] Les 76 fichiers hérités sans `@spec` ne font pas échouer `--fail-on-gap` (gaps non-bloquants).
- [ ] `trace.json` expose `gaps.codeSansSpec.bloquant` et `gaps.codeSansSpec.non_bloquant` séparément.
- [ ] Renommer `lib/module-a.js` → `lib/module-b.js` sans ajouter de `@spec` : `--fail-on-gap` retourne exit 0 (renommage ≠ création).
- [ ] En l'absence de dépôt git : `--fail-on-gap` ne fait pas crash et log un avertissement.

## 4. Interface / API

**Point d'ancrage** : `lib/sdd-trace.js:566` — ligne actuelle :
```js
codeSansSpec: codeFiles.filter((f) => f.annotations.specs.length === 0),
```

Remplacer par une structure enrichie qui distingue nouveaux fichiers et fichiers hérités :

```js
// lib/sdd-trace.js:566 — remplacement de la ligne existante
const newFiles = detecterNouveauxFichiers('lib/');  // git diff --diff-filter=A
codeSansSpec: codeFiles
  .filter((f) => f.annotations.specs.length === 0)
  .map((f) => ({
    ...f,
    isNewFile: newFiles.has(f.path),                 // NOUVEAU
    severity: newFiles.has(f.path) ? 'bloquant' : 'non-bloquant',  // NOUVEAU
  })),
```

Structure résultante d'un item `codeSansSpec` :
```js
{
  path: string,           // existant — chemin relatif du fichier
  annotations: object,    // existant — { specs: [], intents: [], ... }
  isNewFile: boolean,     // NOUVEAU
  severity: 'bloquant' | 'non-bloquant',  // NOUVEAU
}
```

Nouveaux champs dans le résumé `trace.json` :
```js
// Remplace gaps.codeSansSpec: number
gaps.codeSansSpec = {
  bloquant: number,      // NOUVEAU — nouveaux fichiers sans @spec
  non_bloquant: number,  // NOUVEAU — fichiers hérités sans @spec
  total: number,         // NOUVEAU — = bloquant + non_bloquant
}
```

```
CLI : aiad-sdd trace [--fail-on-gap] [--new-files-only]
  --new-files-only   N'affiche que les gaps sur les fichiers nouvellement ajoutés
```

```
CLI : aiad-sdd trace [--fail-on-gap] [--new-files-only]
  --new-files-only   N'affiche que les gaps sur les fichiers nouvellement ajoutés
```

## 5. Dépendances

- `lib/sdd-trace.js` — moteur de traçabilité (modification principale)
- `.aiad/hooks/drift-lock.js` — consomme le verdict trace (pas de modification si `trace.json` expose correctement `bloquant`)
- `lib/verdict.js` — verdict déterministe (inchangé)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~500 tokens
- Cette SPEC : ~500 tokens
- `lib/sdd-trace.js` (relevé des zones à modifier) : ~800 tokens
- `.aiad/hooks/drift-lock.js` (vérification compatibilité) : ~400 tokens
- **Total estimé** : ~2 200 tokens

## 7. Definition of Output Done (DoOD)

- [ ] `lib/sdd-trace.js` annoté `@intent INTENT-022 @spec SPEC-022-2-campagne-annotation-progressive @verified-by test/trace.test.js`
- [ ] Critères §3 couverts par des tests `node --test` (test unitaire sur la détection `--diff-filter=A` + test d'intégration sur exit code)
- [ ] `trace.json` expose `gaps.codeSansSpec.bloquant` / `non_bloquant` / `total`
- [ ] `npx aiad-sdd lint:deps` — zéro dépendance runtime ajoutée
- [ ] Drift Lock : SPEC + code dans la même PR
- [ ] AGENT-GUIDE mis à jour avec la règle « nouveau module `lib/` sans `@spec` = drift bloquant »
