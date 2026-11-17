<!-- DO NOT EDIT — regenerate via /aiad-emit-rules -->
<!-- generated-by: aiad-emit-rules v1.21.0 -->
<!-- source-hash: d2be4814c73b1607 -->
<!-- intent_id: INTENT-033 -->

# GEMINI.md — AIAD SDD

**Projet** : aiad-sdd (CLI `aiad-sdd`, v1.18.x)

Tu suis le cycle SDD AIAD : **Intent → Research → SPEC → Gate → Exécution → Validation → Drift Lock**.

## TOUJOURS
- Lire l'AGENT-GUIDE + la SPEC active en tête de contexte avant de coder
- Annoter tout code applicatif avec `@intent` / `@spec` (+ `@verified-by`, `@governance` si pertinent)
- Synchroniser SPEC + code dans la même PR (Drift Lock)
- Ajouter / mettre à jour un test `node --test` pour chaque feature et chaque bug fix
- Faire dériver le verdict d'une gate/validation d'un **script CLI déterministe** (jamais du jugement libre du modèle) — cf. `lib/verdict.js`
- Vérifier le Human Authorship avant toute automatisation d'une décision
- Après tout changement CLI touchant l'aide ou la couverture des commandes : régénérer `aiad-sdd docs` + `coverage:badge` (sinon CI rouge)
- Après activation d'un Intent : régénérer les rendus multi-runtime (`emit-rules`) — l'Intent actif y est embarqué

## JAMAIS
- Ajouter une dépendance npm (runtime ou dev) — la contrainte zéro-dep est non négociable
- Coder une feature sans SPEC validée (SQS ≥ 4/5)
- Inventer une intention — toujours demander à l'humain
- Introduire du TypeScript ou une étape de build
- Committer sans `npm run lint` + tests passants
- Pusher des secrets dans git (`.env` + `.env.example`)
- Merger une PR sans Drift Check
- Ignorer un veto d'un agent de gouvernance Tier 1

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
