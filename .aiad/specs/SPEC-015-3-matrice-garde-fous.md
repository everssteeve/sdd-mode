# SPEC-015-3-matrice-garde-fous — Matrice enforced/advisory machine-vérifiable + veto non-bypassable

**Intent parent** : INTENT-015
**Research** : RESEARCH-018 (CONDITIONAL GO 85 % — conditions C3, C-MATRICE, C-SCOPE)
**Auteur** : Steeve Evers
**Date** : 2026-06-19
**Statut** : in-progress
**Format** : EARS
**SQS** : 5/5 — Gate OUVERTE (2026-06-19, EARS strict 0 violation, Étranger PASS)
**Implémentation** : `.aiad/hooks/veto.js` (bypass AIAD_HOOK_SILENT retiré, C3) + `lib/guardrails.js` (matrice 17 garde-fous + audit) + `aiad-sdd guardrails [--json]` + `test/guardrails.test.js` (8/8) + `guardrails` ajoutée au registre (snapshot SPEC-015-2-1 à jour). 11 enforced / 6 advisory. trace 0 gap.

---

## 1. Contexte

INTENT-015 veut **publier la matrice enforced/advisory des garde-fous** et **resserrer les bypass**. RESEARCH-018 a révélé que le veto Tier 1 fail-closed est aujourd'hui **bypassable** : `.aiad/hooks/veto.js:28` honore `AIAD_HOOK_SILENT=1` (early-return `0`), et aucun test ne garde ce trou. Cette SPEC : (1) **ferme le bypass du veto** (C3), (2) publie une **matrice machine-vérifiable** des garde-fous adossée à un test d'audit qui échoue si la sévérité déclarée diverge du code (C-MATRICE), (3) se borne au veto pour le resserrage — le drift-lock garde sa soupape, documentée (C-SCOPE).

## 2. Comportement Attendu

### Input

- Hooks réels : fichiers `.aiad/hooks/*.js` (`veto`, `drift-lock`, `jnsp-scan`, `discovery-gate`, `skill-usage`, `session-start`, `statusline`).
- Garde-fous CI : workflows `.github/workflows/` bloquants vs advisory.
- Nouveau module `lib/guardrails.js` : `GUARDRAILS`, source de vérité déclarative.
- Invocation : `aiad-sdd guardrails [--json]` (commande de premier niveau, lecture seule).

### Processing

1. `lib/guardrails.js` déclare `GUARDRAILS` : un enregistrement par garde-fou `{ id, layer, event, type, blocking, bypassable, bypass, test }` avec `layer ∈ {hook, ci}`, `type ∈ {enforced, advisory}`.
2. Le veto est déclaré `type: enforced, bypassable: false`. Les advisory (`discovery-gate`, `skill-usage`, `session-start`, `statusline`) sont `bypassable: true` (`AIAD_HOOK_SILENT`). Le drift-lock est `enforced, bypassable: true` avec `bypass: 'disableStopHook | AIAD_HOOK_SILENT'` (soupape assumée, C-SCOPE).
3. `.aiad/hooks/veto.js` : **suppression** de l'early-return `AIAD_HOOK_SILENT` ; l'en-tête est corrigé (le veto ne se silence pas ; dernier recours = `git commit --no-verify`, hors-harness).
4. Test d'audit : confronte chaque entrée `GUARDRAILS` de `layer: hook` à la source du hook — un garde-fou `bypassable: false` ne doit contenir aucun early-return `AIAD_HOOK_SILENT` ; tout hook de `.aiad/hooks/` doit avoir une entrée.
5. `guardrails` : rend la matrice (texte groupé enforced/advisory, ou JSON).

### Output

- Texte (défaut) : matrice groupée par `type`, chaque ligne `id — layer/event [bloquant] bypass=<…>`.
- JSON (`--json`) : `{ total, enforced: [...], advisory: [...], guardrails: [...] }` sur stdout, rien d'autre.
- Exit 0 sur rendu réussi.

### Cas limites

1. **Hook présent dans `.aiad/hooks/` sans entrée matrice** : l'audit échoue (matrice incomplète).
2. **Entrée `bypassable: false` dont la source contient le bypass `AIAD_HOOK_SILENT`** : l'audit échoue (régression de sévérité) — c'est le garde anti-rouverture du trou veto.
3. **`type` ou `layer` hors énumération** : rejeté par la validation de schéma.
4. **Garde-fou CI** (`layer: ci`, pas de fichier hook) : exclu de l'audit source des hooks (pas de faux négatif).
5. **`--json` sans donnée bloquante** : structure stable, listes éventuellement vides.

## 3. Critères d'Acceptation (EARS)

### CA-001 — Veto non-bypassable par AIAD_HOOK_SILENT

> Pattern : Ubiquitous

`The veto Tier 1 hook SHALL run the governance veto irrespective of the AIAD_HOOK_SILENT environment variable, containing no AIAD_HOOK_SILENT early-return in its source.`

- [ ] Implémenté
- [ ] Testé : `test/guardrails.test.js::veto hook has no AIAD_HOOK_SILENT bypass`

### CA-002 — Garde-fous advisory conservent leur bypass

> Pattern : Optional feature

`WHERE a guardrail is declared advisory, the guardrail SHALL keep honouring the AIAD_HOOK_SILENT bypass.`

- [ ] Implémenté
- [ ] Testé : `test/guardrails.test.js::advisory hooks still honour AIAD_HOOK_SILENT`

### CA-003 — Matrice exhaustive sur les hooks réels

> Pattern : Ubiquitous

`The guardrails matrix SHALL declare one entry for every hook file present in .aiad/hooks/.`

- [ ] Implémenté
- [ ] Testé : `test/guardrails.test.js::matrix covers every hook file`

### CA-004 — Audit de cohérence sévérité ↔ code

> Pattern : Unwanted behaviour

`IF a guardrail declared bypassable false contains an AIAD_HOOK_SILENT early-return in its hook source, THEN the audit SHALL report the matrix as inconsistent.`

- [ ] Implémenté
- [ ] Testé : `test/guardrails.test.js::audit fails on severity regression`

### CA-005 — Listing de la matrice

> Pattern : Event-driven

`WHEN the operator runs "aiad-sdd guardrails", the Guardrails command SHALL display each guardrail grouped by type with its layer, blocking flag, and bypassable flag.`

- [ ] Implémenté
- [ ] Testé : `test/guardrails.test.js::lists guardrails grouped by type`

### CA-006 — Sortie JSON stable

> Pattern : Event-driven

`WHEN the operator passes the --json flag, the Guardrails command SHALL emit on stdout exactly one JSON object { total, enforced, advisory, guardrails } and no other text.`

- [ ] Implémenté
- [ ] Testé : `test/guardrails.test.js::json shape`

### CA-007 — Schéma de chaque entrée

> Pattern : Ubiquitous

`The guardrails matrix SHALL define for every entry an id, a layer in {hook, ci}, a type in {enforced, advisory}, a boolean blocking, and a boolean bypassable.`

- [ ] Implémenté
- [ ] Testé : `test/guardrails.test.js::every entry has valid schema`

### CA-008 — Lecture seule

> Pattern : Ubiquitous

`The Guardrails command SHALL read only the in-memory matrix and the hook source files, writing no file and opening no network connection.`

- [ ] Implémenté
- [ ] Testé : `test/guardrails.test.js::no write no network`

## 4. Interface / API

```
CLI :  aiad-sdd guardrails [--json]

lib/guardrails.js (ESM, zéro-dep) :
  export const GUARDRAILS = [
    { id: 'veto', layer: 'hook', event: 'PreToolUse', type: 'enforced',
      blocking: true, bypassable: false, bypass: null, test: 'test/guardrails.test.js' },
    { id: 'drift-lock', layer: 'hook', event: 'Stop', type: 'enforced',
      blocking: true, bypassable: true, bypass: 'disableStopHook | AIAD_HOOK_SILENT', test: 'test/pre-commit.test.js' },
    { id: 'discovery-gate', layer: 'hook', event: 'UserPromptSubmit', type: 'advisory',
      blocking: false, bypassable: true, bypass: 'AIAD_HOOK_SILENT', test: 'test/discovery-gate.test.js' },
    { id: 'sdd-trace', layer: 'ci', event: 'pull_request', type: 'enforced',
      blocking: true, bypassable: false, bypass: null, test: '.github/workflows/sdd-trace.yml' },
    // … un enregistrement par hook .aiad/hooks/*.js + chaque gate CI bloquant
  ];
  export function auditGuardrails(readHookSource): { ok: boolean, violations: [...] };
    // confronte bypassable:false ↔ absence de AIAD_HOOK_SILENT dans la source du hook,
    // et exhaustivité (tout hook de .aiad/hooks/ a une entrée).
  export function showGuardrails(options?): ...;   // rendu texte/JSON, exit 0.

.aiad/hooks/veto.js :
  - Suppression de `if (process.env.AIAD_HOOK_SILENT === '1') return 0;` (ligne ~28).
  - En-tête mis à jour : veto non silençable ; dernier recours `git commit --no-verify` (hors-harness, tracé).

bin/aiad-sdd.js :
  - case 'guardrails' : dispatch (parse --json), exit 0.
  - 'guardrails' ajouté à COMMANDES_VALIDES + AIDE + COMMANDS_REGISTRY (tier core, catégorie gouvernance).
```

## 5. Dépendances

- `.aiad/hooks/veto.js` (correctif bypass).
- `lib/hooks-config.js` (`HOOKS_GOUVERNANCE` — cohérence : le veto reste protégé des toggles ET de `AIAD_HOOK_SILENT`).
- `lib/commands-registry.js` (ajouter `guardrails` au registre — cohérence snapshot SPEC-015-2-1).
- `lib/term.js` (rendu). Aucune dépendance externe (zéro-dep).
- **Amont** : RESEARCH-018. Clôt INTENT-015 (dernière SPEC).

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~1 200 tokens
- Fichiers source pertinents : `.aiad/hooks/veto.js`, `lib/hooks-config.js`, `lib/commands-registry.js`, `bin/aiad-sdd.js` (dispatch), nouveau `lib/guardrails.js`, nouveau `test/guardrails.test.js`
- **Total estimé** : ~9k tokens (sous le seuil 60-70 %)

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing (lints node/deps/size/esm/claims verts)
- [x] Tests unitaires sur les 8 critères + audit anti-régression (`test/guardrails.test.js` — 8/8)
- [x] **EARS lint : 0 violation** (skill `ears-validator`)
- [x] Snapshot registre (SPEC-015-2-1) mis à jour : `guardrails` ajoutée (core/gouvernance)
- [x] `DOCUMENTATION.md` + badge couverture régénérés (nouvelle commande)
- [x] SPEC mise à jour si écart (Drift Lock — trace 0 gap bloquant)
- [x] Annotations machine-vérifiables posées (`@intent INTENT-015`, `@spec SPEC-015-3-matrice-garde-fous`, `@governance` sur le correctif veto)
- [ ] Code review passée
- [ ] Gouvernance vérifiée : **méta-gouvernance** — le correctif renforce la robustesse du veto Tier 1 (AI-ACT/RGPD/RGAA). RGESN aligné (matrice = lisibilité). Pas de données perso / IA / UI.
