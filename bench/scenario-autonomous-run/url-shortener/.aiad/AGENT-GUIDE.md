# AGENT-GUIDE — [Nom du projet]

> Ce fichier est le **contexte permanent** de l'agent IA.
> Il est injecté dans CHAQUE session de développement.
> Le maintenir à jour est une responsabilité de l'Agents Engineer (AE).
> Framework : AIAD SDD Mode v1.3

---

## IDENTITÉ DU PROJET

**Nom** : [Nom du projet]
**Description** : [1-2 phrases — ce que fait le produit]
**Domaine métier** : [Ex: e-commerce B2B, fintech, santé...]
**Mission** : [Ce que l'équipe s'engage à livrer]

---

## DOCUMENTATION DE RÉFÉRENCE

| Document | Chemin | Mode d'injection |
|----------|--------|-----------------|
| PRD | @.aiad/PRD.md | Cadrage uniquement |
| Architecture | @.aiad/ARCHITECTURE.md | Condensé permanent |
| SPEC active | @.aiad/specs/[SPEC-XXX].md | Par tâche uniquement |
| Index SPECs | @.aiad/specs/_index.md | Planification |
| Gouvernance | @.aiad/gouvernance/ | Permanent (Tier 1, veto) |

---

## STACK TECHNIQUE (Référence Rapide)

[Résumé de la stack — 10 lignes max. Reprend les éléments clés de ARCHITECTURE.md.]

---

## RÈGLES ABSOLUES

### TOUJOURS
- Valider les entrées avant tout traitement
- Synchroniser SPEC + code dans la même PR (Drift Lock)
- Ajouter un test pour chaque bug fix
- Vérifier le Human Authorship avant toute automatisation
- Mettre à jour les Lessons Learned en fin d'itération

### JAMAIS
- Committer sans lint passing
- Modifier le schéma DB sans migration versionnée
- Pusher des secrets dans git
- Merger sans code review (minimum 1 approval)
- Livrer sans mettre à jour la SPEC correspondante

### INCERTITUDE — Dire "je ne sais pas"
- Dire `JNSP` (Je Ne Sais Pas) est un signal valide, pas un échec — préférer une réponse honnête à une réponse confiante mais inventée
- Si l'intention n'est pas formulée par un humain identifiable → JNSP, demander à l'humain plutôt que paraphraser
- Si un critère d'acceptation ne peut pas être testé sans ambiguïté → JNSP, ne pas le scorer "OK"
- Si la gouvernance Tier 1 ne peut pas être tranchée → `UNKNOWN` = VETO par défaut (fail-closed)
- Si les annotations `@spec` sont absentes du code à vérifier → `INCONNU` plutôt que "pas de drift"
- Si un fichier de contexte n'a pas pu être lu intégralement → JNSP, pas d'extrapolation
- Dans le code : poser `// TODO-JNSP: <question précise pour l'humain>` ; le hook pre-commit bloque tout diff qui en contient
- Dans une réponse : structurer en 3 lignes — ce qui est connu, ce qui manque, question à l'humain

---

## CONVENTIONS DE CODE

### Nommage
[Exemples concrets selon la stack du projet]

### Structure des composants
```
[Template d'un composant standard]
```

### Gestion des erreurs
```
[Pattern standard de gestion d'erreur]
```

---

## VOCABULAIRE MÉTIER

| Terme métier | Définition | Terme à éviter |
|--------------|------------|----------------|
| [Terme 1] | [Définition] | [Terme incorrect] |

---

## PATTERNS DE DÉVELOPPEMENT

### Pattern 1 — [Nom]
[Description + exemple de code]

### Pattern 2 — [Nom]
[Description + exemple de code]

---

## ANTI-PATTERNS

| Anti-pattern | Pourquoi éviter | Alternative |
|--------------|-----------------|-------------|
| [Anti-pattern 1] | [Raison] | [Solution] |

---

## LESSONS LEARNED

> Section mise à jour à chaque fin d'itération (commande `/aiad-retro`).
> Documentez ici les erreurs récurrentes de l'agent ET les corrections appliquées.

| Date | Erreur agent | Correction | Impact |
|------|-------------|------------|--------|
| | | | |

---

## HUMAN LEARNINGS

> Section v1.1 — Documentez ici les écarts entre l'intention humaine et la livraison.
> Ces learnings ne sont PAS des erreurs de l'agent — ce sont des défaillances de l'expression humaine.

| Date | Intention exprimée | Résultat obtenu | Apprentissage |
|------|--------------------|-----------------|---------------|
| | | | |
