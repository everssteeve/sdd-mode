<!-- DO NOT EDIT — regenerate via /aiad-emit-rules -->
---
generated-by: aiad-emit-rules v1.19.0
source-hash: ddf351ef23c1f2f1
---

# Codex Agent — AIAD SDD

**Projet** : aiad-sdd (CLI `aiad-sdd`, v1.18.x)
**Cycle** : Intent → Research → SPEC → Gate → Exécution → Validation → Drift Lock

## Règles absolues

### TOUJOURS
- Lire l'AGENT-GUIDE + la SPEC active en tête de contexte avant de coder
- Annoter tout code applicatif avec `@intent` / `@spec` (+ `@verified-by`, `@governance` si pertinent)
- Synchroniser SPEC + code dans la même PR (Drift Lock)
- Ajouter / mettre à jour un test `node --test` pour chaque feature et chaque bug fix
- Faire dériver le verdict d'une gate/validation d'un **script CLI déterministe** (jamais du jugement libre du modèle) — cf. `lib/verdict.js`
- Vérifier le Human Authorship avant toute automatisation d'une décision
- Après tout changement CLI touchant l'aide ou la couverture des commandes : régénérer `aiad-sdd docs` + `coverage:badge` (sinon CI rouge)
- Après activation d'un Intent : régénérer les rendus multi-runtime (`emit-rules`) — l'Intent actif y est embarqué

### JAMAIS
- Ajouter une dépendance npm (runtime ou dev) — la contrainte

### INCERTITUDE (Dire "je ne sais pas")
- Dire `JNSP` (Je Ne Sais Pas) est un signal valide, pas un échec — préférer une réponse honnête à une réponse confiante mais inventée
- Si l'intention n'est pas formulée par un humain identifiable → JNSP, demander plutôt que paraphraser
- Si un critère ne peut pas être testé sans ambiguïté → JNSP, ne pas le scorer "OK"
- Si la gouvernance Tier 1 ne peut pas être tranchée → `UNKNOWN` = VETO par défaut (fail-closed)
- Si les annotations `@spec` sont absentes → `INCONNU` plutôt que "pas de drift"
- Dans le code : poser `// TODO-JNSP: <question>` ; le pre-commit bloque si présent

## Annotations obligatoires

`@intent`, `@spec` (1..n), `@verified-by`, `@governance` — voir `AGENTS.md`.

## Gouvernance Tier 1

Voir `.aiad/gouvernance/` — droit de veto en cas de conflit.

---
*Régénéré par `npx aiad-sdd emit-rules`.*
