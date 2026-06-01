---
name: reasons-canvas
description: Use when structuring a SPEC via the REASONS Canvas (SPDD — Kevlin Henney). Facilitates the capture of intent justification before the standard AIAD SPEC format. Triggered by /sdd spec when the Intent is complex/ambiguous, or on explicit user request.
---

# Skill — REASONS Canvas (SPDD)

> Approche complémentaire au format SPEC AIAD : le REASONS Canvas (Specification-Driven Development de Kevlin Henney) enrichit la justification de l'intention sans remplacer la SPEC technique.

## Quand l'utiliser

- Quand l'Intent Statement est complexe, ambigu, ou multi-acteurs
- Avant de basculer vers la rédaction SPEC AIAD standard (`/sdd spec`)
- Sur demande explicite ("REASONS", "SPDD", "canvas")

## Les 7 dimensions REASONS

| Lettre | Dimension | Question clé |
|--------|-----------|--------------|
| **R** | **Requirements** | Que doit faire le système (fonctionnel + non-fonctionnel) ? |
| **E** | **Expected outcome** | Quel résultat mesurable est visé ? |
| **A** | **Assumptions** | Quelles hypothèses sous-tendent la solution ? |
| **S** | **Stakeholders** | Qui est concerné, qui décide, qui subit ? |
| **O** | **Out of scope** | Ce qui n'est PAS dans cette SPEC (et pourquoi) |
| **N** | **Negative scenarios** | Cas d'erreur, refus, comportements indésirables |
| **S** | **Success criteria** | Comment on mesure objectivement la réussite |

## Procédure

1. Pour chaque dimension, poser une question ciblée à l'utilisateur (ou extraire de l'Intent Statement parent).
2. Si une dimension est vide (sauf **Out of scope** qui peut rester minimal), ne pas inventer — **bloquer et demander**.
3. Convertir le canvas en SPEC AIAD :
   - **R** → §2 Comportement Attendu (Input/Processing/Output)
   - **E** → §3 Critères d'Acceptation (mesurables)
   - **A** → §1 Contexte (hypothèses explicites)
   - **S** → métadonnées + § Dépendances
   - **O** → §1 Contexte (limites)
   - **N** → §2.4 Cas limites
   - **S** (Success) → §3 Critères d'Acceptation (testables)

## Output

Bloc Markdown REASONS structuré, prêt à être intégré dans la SPEC AIAD :

```markdown
## REASONS Canvas

**R — Requirements**
- [...]

**E — Expected outcome**
- [...]

**A — Assumptions**
- [...]

**S — Stakeholders**
- [...]

**O — Out of scope**
- [...]

**N — Negative scenarios**
- [...]

**S — Success criteria**
- [...]
```

## Règles

- Le canvas est un outil de **cadrage**, pas un livrable final.
- Le format SPEC AIAD reste la source de vérité technique.
- Si le canvas révèle des ambiguïtés majeures (assumptions floues, success criteria non mesurables) → remonter à `/sdd intent`.
- Une fois converti en SPEC AIAD, archiver le canvas dans `.aiad/specs/<SPEC-NNN>-canvas.md` pour traçabilité (optionnel mais recommandé).
