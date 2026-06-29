# RESEARCH-038 — Fiabilité CI bin/ + cartographie consommateurs traçabilité

**Intent parent** : INTENT-028
**Auteur** : Steeve Evers
**Date** : 2026-06-29
**Statut** : GO (90 %) — /sdd spec autorisé

---

## Discovery

Zones cartographiées par agent Explore (read-only, ancrages `chemin:ligne`) :

- `bin/aiad-sdd.js:1-60` — 50+ imports ESM nommés depuis `../lib/` ; aucun smoke test d'import pur dans `package.json` ni dans les workflows.
- `bin/aiad-sdd.js:52-58` — import multi-lignes `lib/cert.js` (CERT_NIVEAUX, CERT_AXES, construirePayload, etc.).
- `package.json:37-54` — scripts `test`, `lint` ; absence de script `smoke` ou `import-check`.
- `lib/sdd-trace.js:486` — `export function construireMatrice(racineProjet)` — définition principale ; retourne `{intents[], specs[], forward[], backward[], gaps{}, summary{}}`.
- `lib/sdd-trace.js:703` — `const modele = construireMatrice(projetDir)` (fonction `trace()`).
- `lib/sdd-trace.js:731` — `const m = construireMatrice(projetDir)` (watcher `watchTrace()`).
- `lib/drift-verdict.js:26` — `import { construireMatrice } from './sdd-trace.js'`
- `lib/drift-verdict.js:99` — `const modele = construireMatrice(projetDir)` → accède `gaps.codeSansSpec` (ligne 100). **CRITIQUE**.
- `lib/ai-act-audit.js:32` — `import { construireMatrice, scanCode } from './sdd-trace.js'`
- `lib/ai-act-audit.js:35` — `try { matrice = construireMatrice(racine); } catch { matrice = null; }` — optionnel.
- `lib/leadership-metrics.js:25` — `import { construireMatrice, scanCode } from './sdd-trace.js'`
- `lib/leadership-metrics.js:37` — `try { return construireMatrice(racine); } catch { return null; }` — optionnel.
- `lib/dpia.js:36` — `import { construireMatrice, scanCode } from './sdd-trace.js'`
- `lib/dpia.js:53` — `try { matrice = construireMatrice(racine); }` — optionnel.
- `lib/repl.js:22` — `import { construireMatrice } from './sdd-trace.js'`
- `lib/repl.js:60` — `const m = construireMatrice(ctx.racine)` → `compterGaps(m)` ligne 61.
- `lib/workspace.js:30` — `import { construireMatrice } from './sdd-trace.js'`
- `lib/workspace.js:71` — `const matrix = construireMatrice(projetDir)` — agrégation multi-projet.
- `lib/dashboard/collect.js:12` — `import { construireMatrice } from '../sdd-trace.js'`.
- `lib/archive.js:413` — `safe: archivable` où `archivable = (sousDossier !== 'research')` — garde caduque depuis patch `78d3b9b` ; commentaire ligne 404 documente la dépendance.
- `.aiad/AGENT-GUIDE.md:198-213` — mentions éparses (`listerLivrables`, `drift-check`) ; aucune section centralisée « Consommateurs de `construireMatrice()` ».
- `.github/workflows/ci.yml:140` — `node bin/aiad-sdd.js dashboard --serve` — smoke shell indirect.
- `.github/workflows/bun-smoke.yml:35-92` — 10 appels `node/bun bin/aiad-sdd.js <cmd>` — smoke shell indirect.

### Zone 1 — `bin/aiad-sdd.js` : imports (ancrage `bin/aiad-sdd.js:1-60`)

- Package `"type": "module"` — syntaxe ESM (`import … from`), pas CJS.
- 50+ imports nommés depuis `../lib/` (lignes 8–58), dont un bloc multi-lignes `lib/cert.js` à la ligne 52.
- **ABSENCE CRITIQUE** : aucun smoke test d'import pur (`node -e "import('./bin/aiad-sdd.js')"`) dans `package.json` ni dans les workflows.
- Tous les workflows exécutent le bin via shell (`node bin/aiad-sdd.js <cmd>`) — détection indirecte des ReferenceError, mais pas garantie si la commande n'atteint pas le code fautif.
- **Risque immédiat** : la syntaxe `node -e "require('./bin/aiad-sdd')"` mentionnée dans l'Intent est **incompatible ESM** (ERR_REQUIRE_ESM). La SPEC doit utiliser `node -e "import('./bin/aiad-sdd.js')"`.

### Zone 2 — `lib/sdd-trace.js` : définition `construireMatrice()` (`lib/sdd-trace.js:486`)

```js
export function construireMatrice(racineProjet)   // sdd-trace.js:486
```

Retour : objet de traçabilité avec clés `intents[]`, `specs[]`, `forward[]`, `backward[]`, `gaps{}`, `summary{}`.

Invariants documentés :
- Archive/ **inclus** dans `specsConnus` depuis patch `78d3b9b`.
- `gaps.codeSansSpec` : objet `{bloquant, non_bloquant, total, items}` (ex-tableau depuis SPEC-022-2).
- IDs normalisés via `shortSpecId()` : accepte `SPEC-NNN-N` et `SPEC-NNN-N-slug`.

Appels internes : `sdd-trace.js:703` (fonction `trace`) et `sdd-trace.js:731` (watcher).

### Zone 3 — `lib/archive.js` : invariant `safe` (`lib/archive.js:413`)

```js
safe: archivable,   // archive.js:413
// archivable = (sousDossier !== 'research')
```

Commentaire ligne 404 : *"since construireMatrice() includes archive/ in specsConnus (fix 78d3b9b), archiving a referenced spec…"* — confirme que la garde était initialement liée à un comportement de `construireMatrice()` qui a changé sans mise à jour de la documentation des consommateurs.

### Zone 4 — Consommateurs de `construireMatrice()` — 8 modules en production

| Fichier | Ligne import | Ligne appel | Usage | Criticité |
|---------|-------------|-------------|-------|-----------|
| `lib/sdd-trace.js` | 486 (def) | 703, 731 | `trace()`, `watchTrace()` → rendus md/json/sarif | CRITIQUE |
| `lib/drift-verdict.js` | 26 | 99 | `emitDriftVerdict()` → accède `gaps.codeSansSpec` | CRITIQUE |
| `lib/ai-act-audit.js` | 32 | 35 | `auditAiAct()` → try/catch | MEDIUM |
| `lib/leadership-metrics.js` | 25 | 37 | `computeLeadershipMetrics()` → try/catch | MEDIUM |
| `lib/dpia.js` | 36 | 53 | `dpia()` → try/catch | MEDIUM |
| `lib/repl.js` | 22 | 60 | commande `repl` → `compterGaps(m)` | MEDIUM |
| `lib/workspace.js` | 30 | 71 | `runWorkspace()` → agrégation multi-projet | MEDIUM |
| `lib/dashboard/collect.js` | 12 | (intern) | collecte data dashboard | LOW |

15 fichiers de tests couvrent `construireMatrice()` (75+ occurrences).

### Zone 5 — `package.json` scripts (`package.json:37-54`)

```json
"test": "node --test --test-reporter=spec test/*.test.js"
```

Aucun script `smoke`, `import-check`, ou équivalent.

### Zone 6 — `.github/workflows/` (13 workflows)

Smoke tests indirects via shell : `ci.yml:140`, `bun-smoke.yml:35-92`, `aiad-emit-rules-check.yml:51`, `release.yml:80`, `site-deploy.yml:56`. Aucun test d'import statique pur.

### Zone 7 — `.aiad/AGENT-GUIDE.md` consommateurs (`AGENT-GUIDE.md:198-213`)

Mentions éparses (lessons learned 2026-06-24, 2026-06-26) : `listerLivrables` et `drift-check` implicitement mentionnés. **Aucune section centralisée** « Consommateurs de `construireMatrice()` ».

---

## Faisabilité & risques

### Faisabilité

**HAUTE** — Les deux livrables sont bornés et sans ambiguïté :
1. Smoke test d'import ESM (script `package.json` + step workflow) — ~10 lignes.
2. Section AGENT-GUIDE « Consommateurs de `construireMatrice()` » — ~20 lignes de Markdown.

Aucune modification de l'API publique requise. Aucune migration de fichiers. Impact CI < 2 s (contrainte INTENT-028 respectée).

### Risques & inconnues

| ID | Risque | Sévérité | Décision requise |
|----|--------|----------|-----------------|
| R1 | La syntaxe `require()` de l'Intent est incompatible ESM. Le smoke test doit utiliser `node -e "import('./bin/aiad-sdd.js').catch(e=>{console.error(e.message);process.exit(1)})"` | BLOQUANT pour la SPEC | La SPEC doit corriger la syntaxe |
| R2 | `node -e "import()"` charge toutes les transitive deps (peut dépasser 2 s sur CI cold) — à mesurer | MEDIUM | Condition à vérifier avant merge |
| R3 | La liste des consommateurs dans AGENT-GUIDE peut devenir stale si non maintenue (pas de vérification automatique) | FAIBLE | Décision scope : doc + convention suffit, pas de lint automatique |

Aucun `TODO-JNSP` ouvert — R1 est une correction de syntaxe, pas une inconnue bloquant la décision.

---

## Verdict

> **L'humain tranche — ne pas remplir par l'agent.**

```
## Verdict : GO (confidence: 90 %)
Auteur : Steeve Evers
Date   : 2026-06-29
```

---

## Suite

| Verdict | Action |
|---------|--------|
| GO / CONDITIONAL GO | `/sdd spec INTENT-028` autorisé |
| DEFER / NO-GO | Nouvelle Research après levée des inconnues |
| JNSP | Compléter Discovery / lever inconnues / faire trancher |
