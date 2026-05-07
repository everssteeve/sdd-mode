---
name: traceability
description: Use when generating, auditing or repairing the machine-verifiable traceability matrix Intent ↔ SPEC ↔ Code ↔ Tests. Reads code annotations (@intent, @spec, @verified-by, @governance), cross-references with .aiad/intents/ and .aiad/specs/, and emits orphan / unimplemented / untraced gaps. Triggered by /sdd trace, /sdd drift-check, /sdd validate, /sdd audit, the pre-commit hook, and the sdd-trace GitHub Action.
---

# Skill — Traceability (matrice machine-vérifiable)

> Évolution #6 du framework : transformer le Drift Lock du **rituel humain** à la **mesure algorithmique**.
> Cette skill standardise la convention d'annotations et la lecture des matrices Forward / Backward.

## Quand l'utiliser

- Avant de merger (`/sdd drift-check` invoque cette skill — gap = échec).
- À la rédaction d'une SPEC ou de code (`/sdd spec`, `/sdd validate`) pour s'assurer que les annotations sont posées.
- Pendant un audit qualité (`/sdd audit`).
- En CI via la GitHub Action `sdd-trace.yml`.
- À la demande explicite via `/sdd trace`.

## Convention d'annotations

Quatre tags reconnus dans **JSDoc**, **commentaires** (`//`, `#`) et **docstrings Python** :

| Tag | Format attendu | Cardinalité |
|-----|----------------|-------------|
| `@intent` | `INTENT-NNN[-slug]` | 0..1 par fichier (rappel d'intention) |
| `@spec` | `SPEC-NNN[-N][-slug]` | 1..n (un fichier peut servir plusieurs SPECs) |
| `@verified-by` | chemin relatif vers un test | 0..n |
| `@governance` | liste séparée par virgules : `AIAD-RGPD,AIAD-AI-ACT,AIAD-RGAA,AIAD-RGESN` | 0..1 |

### Exemples

**TypeScript / JavaScript (JSDoc) :**

```ts
/**
 * Vérifie la signature OIDC d'un token.
 *
 * @intent INTENT-042
 * @spec SPEC-042-1-flow-auth
 * @verified-by tests/auth/oidc.test.ts
 * @governance AIAD-RGPD
 */
export function verifyOidcToken(token: string): TokenClaims { ... }
```

**Python (docstring) :**

```python
def verify_oidc_token(token: str) -> TokenClaims:
    """Vérifie la signature OIDC d'un token.

    @intent INTENT-042
    @spec SPEC-042-1-flow-auth
    @verified-by tests/auth/test_oidc.py
    @governance AIAD-RGPD
    """
```

**Commentaire en ligne (acceptable mais moins lisible) :**

```js
// @spec SPEC-042-1-flow-auth
function _internal() { ... }
```

## Procédure

### Étape 1 — Lancer le scan

```bash
npx aiad-sdd trace                  # Markdown + JSON + HTML dans .aiad/metrics/traceability/
npx aiad-sdd trace --json           # JSON brut sur stdout (CI)
npx aiad-sdd trace --fail-on-gap    # Exit 1 si gap bloquant détecté (CI)
```

### Étape 2 — Lire la matrice Forward

Intent → SPEC → Code → Tests. Une ligne par SPEC. Verdicts :

| Verdict | Condition |
|---------|-----------|
| ✅ | Au moins un fichier code annoté + au moins un test couvrant la SPEC |
| ⚠ non-implémentée | SPEC ready/in-progress/done sans aucun fichier code `@spec` |
| ⚠ non-testée | Code annoté présent mais aucun test `@spec` ni `@verified-by` |
| ❌ orphelin | Intent sans aucune SPEC liée |

### Étape 3 — Lire la matrice Backward

Tests → Code → SPEC → Intent. Une ligne par test. Un test sans SPEC parent = test "non-tracé" — soit on l'annote, soit on documente pourquoi (test exploratoire, perf benchmark, etc.).

### Étape 4 — Classer les gaps

| Catégorie | Gap | Sévérité par défaut |
|-----------|-----|---------------------|
| **Orphelins** | Intent sans SPEC | Haute |
| **Orphelins** | SPEC référencée par le code mais absente de `.aiad/specs/` | **Bloquante** |
| **Orphelins** | Intent référencé par le code mais absent de `.aiad/intents/` | **Bloquante** |
| **Non-implémentés** | SPEC ready/in-progress/done sans code annoté | **Bloquante** |
| **Non-tracés** | Code applicatif sans `@spec` | Moyenne (dépend du périmètre) |
| **Non-tracés** | Code annoté sans tests | Haute |

Les gaps **bloquants** font échouer `/sdd drift-check` et la GitHub Action `sdd-trace.yml`.

### Étape 5 — Remédiation

| Gap | Remédiation |
|-----|-------------|
| Intent sans SPEC | `/sdd spec` ou archiver l'Intent |
| SPEC validée sans code | Implémenter (et annoter `@spec`) ou repasser la SPEC en `draft` |
| Code orphelin (`@spec` inconnu) | Soit créer la SPEC manquante (`/sdd spec`) soit corriger l'ID |
| Code sans `@spec` | Ajouter l'annotation ou documenter dans `.aiad/hook-bypass.yml` (rare) |
| Code annoté sans tests | Ajouter test annoté `@spec SPEC-…` ou `@verified-by tests/…` |

## Output

```
SDD TRACE — snapshot YYYY-MM-DD
═══════════════════════════════
Intents       : N
SPECs         : M
Code annoté   : a / b   (X%)
Tests annotés : c / d   (Y%)

Gaps bloquants  : K
Gaps moyens     : L

Verdict global : OK / GAP
```

## Règles

- L'absence d'annotation est un **drift latent**, pas un détail cosmétique.
- 100 % des fichiers de **code applicatif** doivent porter au moins `@spec` (les fichiers d'infrastructure pure peuvent être whitelistés explicitement).
- Un test peut être lié à une SPEC via deux mécanismes (au choix) : annotation `@spec` côté test, ou annotation `@verified-by` côté code.
- Snapshot persistant dans `.aiad/metrics/traceability/` → mesure de l'adoption dans le temps (critère d'évolution #6).
- La skill `drift-detection` invoque cette skill ; ne pas dupliquer la logique côté drift-check.
