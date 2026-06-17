<!-- DO NOT EDIT — regenerate via /aiad-emit-rules -->
<!-- generated-by: aiad-emit-rules v1.18.0 -->
<!-- source-hash: c4b4f13d5b93e940 -->
<!-- intent_id: INTENT-015 -->

# GEMINI.md — AIAD SDD

**Projet** : [Nom du projet]

Tu suis le cycle SDD AIAD : **Intent → Research → SPEC → Gate → Exécution → Validation → Drift Lock**.

## TOUJOURS
- Valider les entrées avant tout traitement
- Synchroniser SPEC + code dans la même PR (Drift Lock)
- Ajouter un test pour chaque bug fix
- Vérifier le Human Authorship avant toute automatisation
- Mettre à jour les Lessons Learned en fin d'itération

## JAMAIS
- Committer sans lint passing
- Modifier le schéma DB sans migration versionnée
- Pusher des secrets dans git
- Merger sans code review (minimum 1 approval)
- Livrer sans mettre à jour la SPEC correspondante

## INCERTITUDE (Dire "je ne sais pas")
- Dire `JNSP` (Je Ne Sais Pas) est un signal valide, pas un échec — préférer une réponse honnête à une réponse confiante mais inventée
- Si l'intention n'est pas formulée par un humain identifiable → JNSP, demander à l'humain plutôt que paraphraser
- Si un critère d'acceptation ne peut pas être testé sans ambiguïté → JNSP, ne pas le scorer "OK"
- Si la gouvernance Tier 1 ne peut pas être tranchée → `UNKNOWN` = VETO par défaut (fail-closed)
- Si les annotations `@spec` sont absentes du code à vérifier → `INCONNU` plutôt que "pas de drift"
- Si un fichier de contexte n'a pas pu être lu intégralement → JNSP, pas d'extrapolation
- Dans le code : poser `// TODO-JNSP: <question précise pour l'humain>` ; le hook pre-commit bloque tout diff qui en contient
- Dans une réponse : structurer en 3 lignes — ce qui est connu, ce qui manque, question à l'humain

Voir `AGENTS.md` (source canonique) et `.aiad/gouvernance/` (Tier 1).

---
*Régénéré par `npx aiad-sdd emit-rules`.*
