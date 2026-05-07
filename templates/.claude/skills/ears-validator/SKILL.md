---
name: ears-validator
description: Use when linting requirements or acceptance criteria for EARS syntax (Easy Approach to Requirements Syntax). Detects vague modal verbs, compound requirements, missing subjects and untestable assertions. Triggered by /sdd spec, /sdd gate, /sdd validate, /sdd audit.
---

# Skill — EARS Validator (Easy Approach to Requirements Syntax)

> Une SPEC ne doit JAMAIS contenir d'ambiguïté sur le comportement attendu.
> EARS est un cadre minimal et éprouvé pour exprimer des exigences testables.

## Quand l'utiliser

- À la rédaction d'une SPEC, sur les critères d'acceptation (`/sdd spec`)
- Avant l'Execution Gate (`/sdd gate`) — alimente le critère SQS Testabilité
- Pendant la validation (`/sdd validate`)
- Pendant un audit qualité (`/sdd audit`)

## Les 5 patterns EARS

| Pattern | Forme canonique | Exemple |
|---------|----------------|---------|
| **Ubiquitous** | The `<system>` shall `<response>`. | `The API shall log every request.` |
| **Event-driven** | When `<trigger>`, the `<system>` shall `<response>`. | `When the user clicks login, the system shall redirect to /home.` |
| **State-driven** | While `<state>`, the `<system>` shall `<response>`. | `While the cache is warming, the proxy shall return 503.` |
| **Optional feature** | Where `<feature>`, the `<system>` shall `<response>`. | `Where SSO is enabled, the system shall hide the password field.` |
| **Unwanted behaviour** | If `<condition>`, then the `<system>` shall `<response>`. | `If the token is expired, then the system shall return 401.` |

## Violations courantes

| Violation | Détection | Correction |
|-----------|-----------|------------|
| Modal verbe vague (`could`, `may`, `might`, `should`) | Recherche regex sur les modaux | Remplacer par `shall` |
| Sujet implicite (pas de `system`, `service`, `API`…) | Phrase commence par un verbe | Ajouter sujet explicite |
| Verbe non observable (`understand`, `know`, `consider`) | Liste noire | Verbe observable (`return`, `log`, `reject`, `display`) |
| Critère composé (`shall do X and Y`) | Conjonction `and` au sein d'un même critère | Découper en deux critères |
| Quantification absente (`fast`, `quickly`) | Adjectifs vagues | Seuil chiffré (`within 200ms p95`) |
| Conditionnelle ambiguë (`will eventually`) | Mots-clés temporels flous | Qualificatif temporel précis |

## Procédure

1. Extraire la liste des critères d'acceptation (SPEC §3) — y compris les `[ ]` non cochés.
2. Pour chaque critère :
   - Identifier le pattern EARS (ou `NONE` si aucun).
   - Repérer les violations (cf. tableau ci-dessus).
   - Proposer une reformulation conforme.
3. Vérifier que chaque critère est **testable** (assertion observable + seuil mesurable).

## Output

```
EARS LINT — SPEC-NNN
════════════════════
Critère 1 : "When the user clicks login, the system shall redirect to /home."
  → ✅ Event-driven OK · testable

Critère 2 : "Should be fast."
  → ❌ NONE · violations: pas de sujet, modal vague, pas de seuil
  → Reformuler : "The system shall respond to /api/login within 200ms (p95)."

Critère 3 : "The user understands the error message."
  → ❌ Ubiquitous · verbe non observable
  → Reformuler : "When validation fails, the system shall display an error message containing the failed field name."

────────────────────
Score EARS : X / Y critères conformes
Score testabilité : X / Y critères testables
```

## Règles

- EARS-conforme ≠ testable : vérifier les deux.
- Une SPEC n'est pas obligée d'utiliser EARS pour TOUTES ses sections — focus sur §3 Critères d'Acceptation.
- Un critère qui ne peut pas être lint-é EARS et reformulé = signal de SPEC ambiguë → impacte le SQS Non-ambiguïté.
- Les critères non-fonctionnels (performance, sécurité) bénéficient particulièrement d'EARS + seuil chiffré.
