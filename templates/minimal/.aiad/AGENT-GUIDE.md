# AGENT-GUIDE — [Nom du projet]

> Contexte permanent de l'agent IA — injecté dans CHAQUE session.
> Profil AIAD-Lean (sans gouvernance Tier 1).

---

## IDENTITÉ DU PROJET

**Nom** : [Nom du projet]
**Description** : [1-2 phrases — ce que fait le produit]
**Mission** : [Ce que l'équipe s'engage à livrer]

---

## DOCUMENTATION DE RÉFÉRENCE

| Document | Chemin | Mode d'injection |
|----------|--------|------------------|
| AGENT-GUIDE | @.aiad/AGENT-GUIDE.md | Permanent (condensé) |
| Intent actif | @.aiad/intents/[INTENT-XXX].md | Par tâche |
| SPEC active | @.aiad/specs/[SPEC-XXX].md | Par tâche |

---

## STACK TECHNIQUE

[Résumé de la stack — 10 lignes max.]

---

## RÈGLES ABSOLUES

### TOUJOURS

- Vérifier qu'une SPEC validée (SQS ≥ 4/5) existe avant de coder.
- Synchroniser SPEC + code dans la même PR (Drift Lock).
- Ajouter un test pour chaque bug fix.
- Demander à l'humain quand l'intention est ambiguë.

### JAMAIS

- Coder sans SPEC.
- Inventer une intention.
- Pousser des secrets dans git.
- Merger sans Drift Check.

---

## CONVENTIONS DE CODE

### Nommage
[Exemples concrets selon la stack du projet]

### Gestion des erreurs
[Pattern standard de gestion d'erreur]

---

## VOCABULAIRE MÉTIER

| Terme | Définition | À éviter |
|-------|------------|----------|
| | | |

---

## LESSONS LEARNED

> Mises à jour à chaque retour d'expérience — erreurs récurrentes de l'agent et corrections.

| Date | Erreur | Correction | Impact |
|------|--------|------------|--------|
| | | | |

---

## HUMAN LEARNINGS

> Écarts entre l'intention exprimée et la livraison — ce ne sont pas des bugs, ce sont des défaillances d'expression.
> Les documenter prévient la *cognitive debt* (Fowler/Joshi, 2026) : ce qui n'a pas été compris une fois se répète.

| Date | Intention exprimée | Résultat obtenu | Apprentissage |
|------|--------------------|-----------------|---------------|
| | | | |
