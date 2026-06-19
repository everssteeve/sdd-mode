# RESEARCH-018 — Matrice enforced/advisory + resserrage des bypass (SPEC-015-3)

**Intent parent** : INTENT-015
**Research amont** : RESEARCH-016 (inventaire grossier des garde-fous + condition C3)
**Auteur** : Steeve Evers
**Date** : 2026-06-19
**Statut** : tranché — /sdd spec autorisé (C3, C-MATRICE, C-SCOPE)

---

## Discovery (ancrage code obligatoire)

> Discovery ciblé sur la mécanique du bypass et la non-bypassabilité du veto (condition C3). Agent Explore read-only, 2026-06-19. Ancrages `chemin:ligne` réels.

**Constat central — le veto Tier 1 est bypassable aujourd'hui**

- `.aiad/hooks/veto.js:28` : `if (process.env.AIAD_HOOK_SILENT === '1') return 0;` — le veto gouvernance fail-closed s'auto-désactive sur ce bypass global. **C3 (« veto non-bypassable ») n'est PAS satisfaite dans le code.**
- Le même early-return est présent dans tous les hooks : `drift-lock.js:47`, `jnsp-scan.js:74`, `discovery-gate.js:54`, `skill-usage.js:28`. `AIAD_HOOK_SILENT=1` coupe donc **tout indistinctement**, veto compris.
- Aucun test ne vérifie que le veto reste bloquant malgré `AIAD_HOOK_SILENT=1` (cf. surface de test ci-dessous) — le trou n'est pas gardé.

**Autres bypass recensés**

- `git commit --no-verify` : contourne le pre-commit `.aiad/hooks/pre-commit.sh` (hors-harness, last resort documenté `pre-commit.sh`).
- `AIAD_SKIP_DRIFT_CHECK=1` : branche de `.aiad/hooks/pre-commit.sh` (drift-lock côté git).
- `.aiad/hook-bypass.yml` : whitelist de patterns lue par `jnsp-scan.js` et `pre-commit.sh` (exemption de fichiers documentaires).
- `.aiad/hooks-config.json` toggles via `lib/hooks-config.js:30-44` (`TOGGLES`) ; `lib/hooks-config.js:43-44` `HOOKS_GOUVERNANCE = new Set(['veto'])` protège le veto contre `disablePreToolUseHook` — mais **pas** contre `AIAD_HOOK_SILENT`.

**Points de sortie/blocage des hooks**

- `veto.js:62` : `return 2;` (deny, bloquant). `drift-lock.js:79` : `return 2;`. `jnsp-scan.js:124` : `return 2;`. `discovery-gate.js:100` : `return 0;` (additif, sauf mode strict `AIAD_DISCOVERY_STRICT=1`).
- Déclaration des hooks : `templates/.claude/settings.json` (clé `hooks` par événement PreToolUse/Stop/UserPromptSubmit/SessionStart). **Aucune métadonnée `type: enforced|advisory`** n'existe.

**CI : gates bloquants vs informatifs**

- Bloquants (`exit 1` → PR rouge) : `ci.yml` (test, lint, coverage badge `git diff --exit-code`, pack, reproducibility), `sdd-trace.yml:47` (`trace --fail-on-gap`), `aiad-emit-rules-check.yml:51` (`emit-rules --check`), `aiad-version-check.yml`, `aiad-docs-check.yml`.
- Advisory (publication sans échec) : `aiad-pr-review.yml`, `canary.yml`, Bun smoke.
- **Aucune déclaration centralisée** (`REQUIRED_CHECKS`/branch protection) : la sévérité est dispersée en `exit 1` par script.

**Absence de matrice et de test anti-régression**

- Aucun fichier `MATRICE*.md` ; les 38 occurrences `enforced|advisory` sont en prose narrative. Aucune **table machine-vérifiable**.
- `test/hooks-config.test.js:64-92` vérifie que le veto est protégé de `disablePreToolUseHook`, mais **aucun test** que `AIAD_HOOK_SILENT=1` ne le contourne pas.
- `test/veto.test.js` teste `lib/veto.js` (calcul du verdict), **pas** l'exécution du hook `.aiad/hooks/veto.js`. Le hook lui-même n'a aucun test.
- `test/discovery-gate.test.js` teste au contraire que `AIAD_HOOK_SILENT=1` **fonctionne** (advisory) — comportement correct pour un advisory, à conserver.

---

## Faisabilité

**Élevée — et le besoin est réel, pas cosmétique.** La matrice formalise un état déjà cartographié ; le cœur de valeur est la **fermeture du trou C3** + le test anti-régression.

- **Correctif veto (petit, ciblé)** : `.aiad/hooks/veto.js:28` ne doit plus honorer `AIAD_HOOK_SILENT` (le veto est Tier 1 fail-closed). `drift-lock.js` aussi est enforced → même traitement à décider. Les advisory (discovery-gate, skill-usage, session-start) **gardent** le bypass.
- **Matrice machine-vérifiable** : une structure de données (ex. `lib/guardrails.js` : `{guardrail, event, type, blocking, bypassable, test}`) + un rendu Markdown + un **test d'audit** qui confronte la matrice déclarée à la réalité du code (présence/absence du early-return `AIAD_HOOK_SILENT` par hook selon son type).
- **Test anti-régression** : `test/veto-hook.test.js` — spawn `.aiad/hooks/veto.js` avec `AIAD_HOOK_SILENT=1` sur un diff en infraction → exit 2 (deny) attendu. Garantit que le trou ne se rouvre pas.

## Risques & inconnues

- **R-VETO (central) — le veto est bypassable aujourd'hui.** `AIAD_HOOK_SILENT=1` le neutralise (`veto.js:28`). **Résolu par C3** : retirer le bypass du veto + test anti-régression obligatoire.
- **R-DRIFT-MATRICE — une matrice en prose dérive du code.** Une table Markdown non testée redeviendrait fausse au premier refactor de hook. **Résolu par C-MATRICE** : la matrice est adossée à un test d'audit qui échoue si le code et la déclaration divergent.
- **R-HORS-HARNESS — `git commit --no-verify` contourne le pre-commit.** Irréductible au niveau git (last resort légitime). La non-bypassabilité visée est celle du **veto au niveau harness** (PreToolUse) ; le `--no-verify` reste documenté comme dernier recours tracé, hors périmètre du correctif.
- **Inconnue — drift-lock enforced doit-il aussi perdre le bypass ?** Le veto (gouvernance) est clairement non-bypassable (C3). Le drift-lock est enforced mais opérationnel (pas réglementaire) ; garder un bypass pour lui peut être légitime (urgence). **Résolu par C-SCOPE** : 015-3 ferme le bypass du **veto seul** ; le sort du drift-lock est tranché dans la matrice (déclaré `bypassable: toggle` assumé) sans changement de code, décision documentée.
- **Hors périmètre (différé, non bloquant)** : suppression totale de `AIAD_HOOK_SILENT` au profit de flags nommés par hook ; `managed-settings.json` org (évoqué SPEC-002-1) pour interdire les toggles en CI. Renvoyés à une décision/SPEC ultérieure.
- **Gouvernance** : touche directement le **veto Tier 1** (méta-gouvernance) — l'enjeu EST la robustesse de AI-ACT/RGPD/RGAA/RGESN. RGESN aligné (matrice = lisibilité). Pas de données perso, pas d'IA, pas d'UI.

## Conditions (si CONDITIONAL GO)

- **C3** (report de RESEARCH-016, désormais concret) — `.aiad/hooks/veto.js` **cesse d'honorer `AIAD_HOOK_SILENT`** ; un test anti-régression (`test/veto-hook.test.js`) vérifie que le veto reste bloquant (exit 2) malgré le bypass. Non négociable.
- **C-MATRICE** (nouveau) — La matrice enforced/advisory est **machine-vérifiable** : une structure de données source + un test d'audit qui échoue si la sévérité déclarée diverge du code réel (pas une simple table en prose).
- **C-SCOPE** — 015-3 se borne à : matrice + correctif bypass du **veto seul** + tests anti-régression. La suppression de `AIAD_HOOK_SILENT`, les flags par-hook et `managed-settings.json` org sont différés. Le bypass du drift-lock est documenté dans la matrice sans changement de code.

---

## Verdict : CONDITIONAL GO (confidence: 85 %)

> Tranché par Steeve Evers le 2026-06-19 (Human Authorship). Conditions C3, C-MATRICE, C-SCOPE. Bypass `AIAD_HOOK_SILENT` retiré du **veto seul** ; le drift-lock conserve sa soupape (urgence opérationnelle), documentée comme `bypassable: toggle` dans la matrice. `/sdd spec` autorisé.
