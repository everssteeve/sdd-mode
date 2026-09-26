---
id: SPEC-034-2
title: Contrôle de drift de la doctrine livrée — version et contenu, en CI et à la release
parent_intent: INTENT-034
status: ready
format: EARS
sqs: 5
author: Steeve Evers
date: "2026-09-25"
---

# SPEC-034-2-controle-drift-doctrine — variante EARS

**Intent parent** : INTENT-034
**Research** : RESEARCH-041 — GO (auteur) → CONDITIONAL GO (machine) ; condition traitée ici : « source lisible par le contrôle » ; décision de l'auteur : « la version de aiad » = **version de la doctrine et contenu**
**Auteur** : Steeve Evers *(rédaction : agent, 2026-09-25 — à valider à la Gate)*
**Date** : 2026-09-25
**Statut** : ready
**Format** : EARS
**SQS** : 5/5 — Execution Gate OUVERTE (2026-09-26), Test de l'Étranger PASS

---

## 1. Contexte

Critère de drift d'INTENT-034 (mots de l'auteur) : « la version de aiad lors d'une release est différente de celle présente sur le drive ». La CI s'exécute sur GitHub et ne peut pas lire le Drive : le contrôle se fait donc en deux temps. **En CI**, les fichiers livrés sont comparés à l'empreinte `templates/doctrine.lock.json` (écrite par SPEC-034-1a) — toute modification directe dans le package est détectée. **À la release**, exécutée localement par l'auteur, l'empreinte est comparée au Drive publié — une release dont la doctrine diffère du Drive est bloquée.

## 2. Comportement Attendu

### Input
`templates/doctrine.lock.json`, les fichiers qu'il référence, et en mode release la racine `published/md/` du Drive (`--source` ou `AIAD_DOCTRINE_SOURCE`).

### Processing
1. `scripts/check-doctrine.js` (mode CI, défaut) : recalcule le SHA-256 de chaque fichier listé dans le lock et le compare à l'empreinte enregistrée.
2. `scripts/check-doctrine.js --source <published/md>` (mode release) : applique la même réécriture de liens que SPEC-034-1a à chaque fichier source, puis compare son empreinte à celle du lock, et compare la version de doctrine lue dans le titre de `frameworkAIAD.md` source à `doctrineVersion`.
3. `scripts/release.js` exécute le mode release **en premier**, avant toute modification (bump de `package.json`), avec `--source` lu dans `AIAD_DOCTRINE_SOURCE` ; si la variable n'est pas définie ou si le contrôle échoue, la release s'arrête. (`release.js` ne publie pas lui-même : la publication npm est déclenchée par le tag poussé, via `.github/workflows/release.yml` ; bloquer avant le bump empêche le tag.)
4. `.github/workflows/ci.yml` exécute le mode CI.

### Output
Code de sortie 0 (conforme), 1 (drift, fichiers et écarts listés) ou 2 (indécidable).

### Cas limites
Chacun devient un critère « Unwanted behaviour » ci-dessous : lock absent ; fichier listé absent ; source Drive inaccessible en mode release ; version identique mais contenu différent.

## 3. Critères d'Acceptation (EARS)

### CA-001 — Conformité
> Pattern : Event-driven

`WHEN every file listed in doctrine.lock.json matches its recorded SHA-256, the check-doctrine script SHALL return exit code 0.`

- [ ] Implémenté

### CA-002 — Modification directe dans le package
> Pattern : Unwanted behaviour

`IF a file listed in doctrine.lock.json differs from its recorded SHA-256, THEN the check-doctrine script SHALL return exit code 1.`

- [ ] Implémenté

### CA-002b — Fichier en drift nommé
> Pattern : Unwanted behaviour

`IF a file listed in doctrine.lock.json differs from its recorded SHA-256, THEN the check-doctrine script SHALL print the path of that file.`

- [ ] Implémenté

### CA-003 — Version différente du Drive
> Pattern : Unwanted behaviour

`IF the doctrine version read in the source frameworkAIAD.md title differs from doctrineVersion in doctrine.lock.json, THEN the check-doctrine script in release mode SHALL return exit code 1.`

- [ ] Implémenté

### CA-004 — Même version, contenu différent
> Pattern : Unwanted behaviour

`IF a source file from published/md, after link rewriting, differs from its recorded SHA-256 while the doctrine version is identical, THEN the check-doctrine script in release mode SHALL return exit code 1.`

- [ ] Implémenté

### CA-005 — Lock absent
> Pattern : Unwanted behaviour

`IF templates/doctrine.lock.json does not exist, THEN the check-doctrine script SHALL return exit code 2.`

- [ ] Implémenté

### CA-006 — Source Drive inaccessible
> Pattern : Unwanted behaviour

`IF the --source path does not exist in release mode, THEN the check-doctrine script SHALL return exit code 2.`

- [ ] Implémenté

### CA-007 — Release bloquée
> Pattern : Unwanted behaviour

`IF the check-doctrine script in release mode returns a non-zero exit code, THEN the release script SHALL exit before modifying package.json.`

- [ ] Implémenté

### CA-007b — Source non configurée
> Pattern : Unwanted behaviour

`IF the AIAD_DOCTRINE_SOURCE environment variable is undefined, THEN the release script SHALL exit before modifying package.json.`

- [ ] Implémenté

### CA-008 — Exécution en CI
> Pattern : Ubiquitous

`The CI workflow SHALL run the check-doctrine script in CI mode on every pull request.`

- [ ] Implémenté

## 4. Interface / API

```
node scripts/check-doctrine.js                         # mode CI
node scripts/check-doctrine.js --source <published/md> # mode release
  exit 0 : conforme · exit 1 : drift (écarts listés) · exit 2 : indécidable
```

## 5. Dépendances

- SPEC-034-1a (écrit `doctrine.lock.json`, fournit la règle de réécriture des liens).
- Réutilise : motif de `lib/version-sync.js` (`--check`), `scripts/release.js`, `.github/workflows/ci.yml`.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~2 000 tokens
- Cette SPEC : ~2 000 tokens
- Fichiers source pertinents : `scripts/sync-doctrine.js` (SPEC-034-1a), `scripts/release.js`, `lib/version-sync.js`, `.github/workflows/ci.yml`
- **Total estimé** : ~12 000 tokens

## 7. Definition of Output Done (DoOD)

- [ ] Code + lint passing
- [ ] Tests CA-001 à CA-007b
- [ ] Étape CI active (CA-008)
- [ ] Annotations `@intent INTENT-034` / `@spec SPEC-034-2` / `@verified-by`
- [ ] SPEC mise à jour si écart (Drift Lock)
- [ ] Code review passée

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-09-25 | Gate (1er passage) : CA-002 découpé (R7) ; étape 3 et CA-007 alignés sur le fonctionnement réel de `release.js` (pas de publication npm locale — blocage avant le bump) ; CA-007b ajouté. | Linter EARS strict : 1 violation ; `release.js` ne contient aucun `npm publish`. |
| 2026-09-26 | Execution Gate OUVERTE — SQS 5/5, Test de l'Étranger PASS ; linter EARS strict : 0 violation. Statut → ready. | Scores validés par l'auteur. |
