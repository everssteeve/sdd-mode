# SPEC-023-2 — Extension emit-rules : runtime Kiro (+ Amazon Q)

**Intent parent** : INTENT-023
**Auteur** : Steeve Evers
**Date** : 2026-06-29
**Statut** : draft
**Format** : prose
**SQS** : [À évaluer via /sdd gate]
**Research** : RESEARCH-037 (GO 80 %)

> **Condition à lever avant exec (R3)** : le format de configuration des steering rules Kiro
> (YAML ? Markdown ? `.kiro/steering/`) doit être investigué et documenté dans cette SPEC
> avant le passage en Gate. Ajouter le format retenu dans § 4 Interface/API.

---

## 1. Contexte

INTENT-023 vise à élargir la couverture runtime de `emit-rules` au-delà des 5 runtimes actuels (`claude-code`, `cursor`, `codex`, `copilot`, `gemini`). Le Discovery (RESEARCH-037) a identifié **Kiro** (AWS Bedrock AI IDE) comme candidat prioritaire — déjà cité dans la documentation, direct concurrent de Claude Code. **Amazon Q** est le second candidat si le format est compatible. Le pattern d'extension est établi dans `lib/emit-rules.js`.

## 2. Comportement Attendu

### Input

- `aiad-sdd emit-rules --runtime kiro` (ou `--runtime all`)
- Source : `.aiad/AGENT-GUIDE.md` + fichiers gouvernance `.aiad/gouvernance/AIAD-*.md`
- Même contrainte zéro-dépendance npm que le reste du codebase

### Processing

**Étape 1 — Ajout à la liste officielle**

Ajouter `'kiro'` (et `'amazon-q'` si format compatible) dans `RUNTIMES_VALIDES` (`lib/emit-rules.js:39`).

**Étape 2 — Fonctions de génération**

Créer dans `lib/emit-rules.js` :

```
genererKiroSteering(opts)        ← fichier(s) steering principal Kiro
genererKiroTier1(opts)           ← 4 fichiers Tier 1 scopés (si le format Kiro le supporte)
```

Pattern à suivre : `genererCursorAiadMdc()` (l. 364) + `genererCursorTier1Mdc()` (l. 450).

Contenu condensé : même logique que Gemini/Codex (règles TOUJOURS/JAMAIS/INCERTITUDE extraites de AGENT-GUIDE, gouvernance condensée via `condenserGouvernance()`).

**Étape 3 — Intégration dans le pipeline**

Ajouter le case `wants('kiro')` dans `_emitRulesImpl()` (l. 788-871) après le bloc `gemini`.

**Étape 4 — CLI**

Mettre à jour le texte d'aide `emit-rules --help` dans `bin/aiad-sdd.js:449-452` pour lister `kiro` comme runtime valide.

**Étape 5 — Init**

Mettre à jour `lib/init.js` si `emit-rules` est appelé automatiquement après `aiad-sdd init` et que le runtime `kiro` doit être détecté/proposé.

### Output

Fichiers générés dans le projet cible (selon le format Kiro — à préciser post-R3) :

```
.kiro/steering/aiad.md           ← règles AIAD (TOUJOURS/JAMAIS/INCERTITUDE)
.kiro/steering/aiad-rgpd.md      ← gouvernance RGPD condensée   (si Kiro supporte le scopage)
.kiro/steering/aiad-rgaa.md      ← gouvernance RGAA condensée
.kiro/steering/aiad-ai-act.md    ← gouvernance AI-ACT condensée
.kiro/steering/aiad-rgesn.md     ← gouvernance RGESN condensée
```

> TODO-JNSP: le format exact des steering files Kiro (chemin, extension, frontmatter) doit être
> confirmé avant Gate. Si Kiro ne supporte pas le scopage par globs, les 4 fichiers Tier 1
> sont fusionnés dans `aiad.md` avec des sections dédiées.

### Cas limites

- **Format Kiro inconnu au moment de la Gate** → Gate fermée jusqu'à levée de R3 (condition RESEARCH-037)
- **Amazon Q format incompatible** → périmètre réduit à Kiro seul, Amazon Q reporté à une SPEC ultérieure
- **`--runtime all` inclut kiro** → comportement automatique dès l'ajout dans `RUNTIMES_VALIDES`
- **Projet cible sans `.kiro/`** → `emit-rules` crée le répertoire (pattern identique à `.cursor/rules/`)
- **Idempotence** : source-hash SHA-256 sur le contenu amont, même mécanique que les autres runtimes (l. 251-341)

## 3. Critères d'Acceptation

- [ ] CA-1 : `aiad-sdd emit-rules --runtime kiro` génère au moins un fichier dans `.kiro/` sans erreur
- [ ] CA-2 : `aiad-sdd emit-rules --runtime all` inclut la génération Kiro
- [ ] CA-3 : Le fichier steering principal contient les sections TOUJOURS / JAMAIS / INCERTITUDE extraites de AGENT-GUIDE
- [ ] CA-4 : `aiad-sdd emit-rules --check --runtime kiro` retourne exit 0 si les fichiers sont à jour, exit 1 si drift
- [ ] CA-5 : L'idempotence est garantie — deux exécutions successives sans changement de source ne modifient pas les fichiers
- [ ] CA-6 : `aiad-sdd emit-rules runtimes` liste `kiro` parmi les runtimes disponibles
- [ ] CA-7 : Les tests `test/emit-rules.test.js` (ou `test/emit-rules-kiro.test.js`) couvrent CA-1, CA-4, CA-5
- [ ] CA-8 : `npm run lint` passing — zéro dépendance npm ajoutée

## 4. Interface / API

**CLI**

```
aiad-sdd emit-rules [--runtime claude-code|cursor|codex|copilot|gemini|kiro|all]
```

**Format Kiro attendu (à confirmer post-R3)**

```
.kiro/steering/aiad.md
---
inclusion: always
---
# AIAD SDD Mode

## TOUJOURS
…
## JAMAIS
…
## INCERTITUDE
…
```

*Si le frontmatter `inclusion:` n'est pas le bon champ Kiro, mettre à jour lors de la levée de R3.*

**Fonctions dans lib/emit-rules.js**

```js
// @spec SPEC-023-2-emit-rules-nouveaux-runtimes
async function genererKiroSteering(opts) { … }
async function genererKiroTier1(opts) { … }   // optionnel selon format
```

## 5. Dépendances

- `lib/emit-rules.js` — ajout `RUNTIMES_VALIDES`, nouvelles fonctions, pipeline
- `bin/aiad-sdd.js` — aide CLI mise à jour
- `lib/init.js` — câblage init si applicable
- `test/emit-rules.test.js` ou `test/emit-rules-kiro.test.js` — nouveaux tests
- RESEARCH-037 condition R3 levée (format Kiro) — prérequis Gate
- Agents gouvernance : AIAD-RGESN (tout ajout de dépendance/fichier généré est soumis au budget)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE condensé : ~500 tokens
- Cette SPEC : ~700 tokens
- `lib/emit-rules.js` (sections 39, 364-635, 788-871) : ~1 500 tokens
- `bin/aiad-sdd.js:1902-1939` (CLI) : ~200 tokens
- `test/emit-rules.test.js` (référence) : ~500 tokens
- **Total estimé** : ~3 400 tokens (< 20 % de 200k Sonnet 4.6)

## 7. Definition of Output Done (DoOD)

- [ ] `RUNTIMES_VALIDES` mis à jour avec `'kiro'`
- [ ] `genererKiroSteering()` implémentée et intégrée dans le pipeline
- [ ] `aiad-sdd emit-rules --runtime kiro` génère les fichiers attendus
- [ ] `aiad-sdd emit-rules --check --runtime kiro` fonctionne (exit 0/1)
- [ ] Tests CA-1, CA-4, CA-5, CA-7, CA-8 passants
- [ ] `npm run lint` passing (zéro-dep maintenu)
- [ ] Aide CLI `emit-rules --help` listant `kiro`
- [ ] SPEC mise à jour si format Kiro diffère de l'hypothèse (Drift Lock)
- [ ] Gouvernance vérifiée : AIAD-RGESN (pas de fichiers inutiles générés)
