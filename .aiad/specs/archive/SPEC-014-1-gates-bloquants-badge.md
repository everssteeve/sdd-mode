---
status: archived
archivedAt: "2026-06-24T09:49:36.942Z"
archivedBy: evers.steeve@gmail.com
archivedReason: FACT-008 — SPECs done sans frontmatter YAML détectées via fallback body
---
# SPEC-014-1-gates-bloquants-badge

**Intent parent** : INTENT-014
**Research** : RESEARCH-015 (CONDITIONAL GO, 2026-06-12)
**Auteur** : Steeve Evers
**Date** : 2026-06-15
**Statut** : done (PR #5 mergée 2026-06-16 — Drift Lock OK)
**Format** : prose
**SQS** : 5/5 — Gate OUVERTE (2026-06-15, Test de l'Étranger PASS)

---

## 1. Contexte

INTENT-014 (« Empirisme prouvé ») exige que les gates de qualité que nous prêchons
soient réellement bloquants pour nous-mêmes. Le Discovery (RESEARCH-015) a corrigé la
prémisse : `lint:size --strict` et `test:coverage:threshold` **tournent déjà en CI**,
mais ne sont invoqués **ni dans `prepublishOnly` ni dans `release.yml`** — une release
peut donc partir avec un gate rouge. De plus, **aucun badge de couverture** n'est publié.
Cette SPEC arme les gates au point de publication et publie un badge, en restant zéro-dep.

## 2. Comportement Attendu

### Input
- `package.json:51` — `prepublishOnly` actuel = `lint && lint:deps && test`.
- `.github/workflows/release.yml:34-35` — étape « Lint + Tests » = `lint` + `test` seuls.
- Scripts existants réutilisés tels quels : `scripts/coverage-threshold.js` (seuils
  lines 75 / branches 70 / funcs 65), `scripts/lint-size.js --strict` (exit 1 si > 700 LOC).
- Couverture réelle mesurée le 2026-06-15 (C-R1) : **lines 96,21 % · branches 83,68 % ·
  funcs 94,15 %** — très au-dessus des seuils → armer le gate ne casse pas la release.

### Processing
1. **`prepublishOnly`** intègre `lint:size` (déjà `--strict`) **et** `test:coverage:threshold`,
   en plus de l'existant — un gate rouge empêche `npm publish` en local et en CI release.
2. **`release.yml`** exécute la même chaîne de gates avant `npm publish` (parité avec
   `prepublishOnly`), pour que la publication par tag soit soumise aux mêmes barrières.
3. **Badge de couverture zéro-dep** : un script génère un fichier JSON au format
   *endpoint shields.io* (`schemaVersion: 1`, `label: coverage`, `message: "<n>%"`,
   `color`) à partir de la sortie de `coverage-threshold.js`, committé dans le repo.
   Le README référence le badge via `https://img.shields.io/endpoint?url=<raw>` — aucune
   dépendance runtime, aucune action tierce, aucun service codecov/coveralls (C-R2, C-R5).
4. **Job CI de fraîcheur du badge** : un job vérifie que le JSON committé correspond à la
   couverture courante (régénère + `git diff --exit-code`) et **échoue** sinon.

### Output
- `package.json` : `prepublishOnly` étendu.
- `.github/workflows/release.yml` : gates ajoutés avant publish.
- `scripts/` : générateur de badge (extension de `coverage-threshold.js` ou script dédié
  zéro-dep) + sortie JSON committée (ex. `.aiad/metrics/coverage/badge.json`).
- `README.md` : badge de couverture affiché.
- `.github/workflows/ci.yml` : job de fraîcheur du badge.

### Cas limites
1. **Couverture sous le seuil** → `coverage-threshold.js` exit 1 → `prepublishOnly` et
   `release.yml` échouent (publication bloquée). Comportement voulu.
2. **Module > 700 LOC hors whitelist** → `lint:size --strict` exit 1 → publication bloquée.
3. **Badge JSON obsolète** (couverture a bougé, badge non régénéré) → job CI de fraîcheur
   échoue, la PR ne merge pas.
4. **Réseau shields.io indisponible** → le badge ne s'affiche pas dans le README mais
   **aucun build ne casse** (le JSON est committé, le rendu seul est externe).
5. **`release:dry`** (`--skip-tests`) → ne doit pas être bloqué par les gates de test
   (chemin dry-run explicitement hors périmètre du gate bloquant).

## 3. Critères d'Acceptation

- [ ] `prepublishOnly` invoque `lint:size` ET `test:coverage:threshold` en plus de
      `lint`, `lint:deps`, `test` — vérifiable par lecture de `package.json`.
- [ ] Un `npm run prepublishOnly` échoue (exit ≠ 0) lorsque la couverture est forcée
      sous le seuil (ex. `coverage-threshold.js --lines 99`) — testable.
- [ ] `release.yml` exécute `lint:size` et `test:coverage:threshold` avant `npm publish`
      — vérifiable par lecture du workflow.
- [ ] Un fichier badge JSON valide (format endpoint shields, `schemaVersion: 1`) est
      committé et régénérable par un script zéro-dep (aucun ajout à `dependencies`).
- [ ] Le README affiche le badge de couverture via une URL `img.shields.io/endpoint`.
- [ ] Le job CI de fraîcheur échoue si le badge committé diverge de la couverture mesurée
      (régénération + `git diff --exit-code`).
- [ ] `npm run lint:deps` reste vert (zéro dépendance runtime ajoutée — RGESN, INTENT-015).
- [ ] La suite de tests existante reste verte avec la couverture actuelle (96/83/94 %).

## 4. Interface / API

```
# package.json (extrait cible)
"prepublishOnly": "npm run lint && npm run lint:deps && npm run lint:size && npm run test:coverage:threshold && npm test"

# badge endpoint shields.io (fichier committé)
{ "schemaVersion": 1, "label": "coverage", "message": "96%", "color": "brightgreen" }

# README
[![coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/<repo>/main/.aiad/metrics/coverage/badge.json)](...)

# génération (zéro-dep)
node scripts/coverage-badge.js   # ou flag --badge sur coverage-threshold.js
```

## 5. Dépendances

- Scripts existants `scripts/coverage-threshold.js`, `scripts/lint-size.js` (réutilisés).
- Aucune dépendance npm runtime (contrainte dure : `lint:deps` vert).
- Indépendante de SPEC-014-2 (fichiers disjoints : CI/package.json/scripts/README vs
  docs/.claude) → parallélisable.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~500 tokens
- Cette SPEC : ~900 tokens
- Fichiers source pertinents : `package.json`, `.github/workflows/{ci,release}.yml`,
  `scripts/coverage-threshold.js`, `scripts/lint-size.js`, `README.md`
- **Total estimé** : ~6–8k tokens

## 7. Definition of Output Done (DoOD)

- [x] Code + `npm run lint` / `lint:deps` / `lint:size` / `lint:esm` verts (2026-06-15)
- [x] `prepublishOnly` étendu et testé (échec sous seuil prouvé : `--lines 99` → exit 1)
- [x] Badge généré (`.aiad/metrics/coverage/badge.json`, 96 %), affiché au README ; job de fraîcheur ajouté
- [x] SPEC ↔ code synchronisés (Drift Lock) + annotations `@intent`/`@spec`/`@verified-by` ; `trace --fail-on-gap` exit 0
- [ ] Code review passée (PR à ouvrir)
- [x] Gouvernance : **RGESN** vérifiée (zéro-dep confirmé par `lint:deps`, un seul run
      de couverture, badge committé sans action tierce — C-R2/C-R5). AI-ACT/RGPD/RGAA non applicables.
