---
inclusion: always
# generated-by: aiad-emit-rules v1.19.0
# source-hash: ddf351ef23c1f2f1
---

<!-- DO NOT EDIT — regenerate via /aiad-emit-rules -->

# AIAD SDD Mode — Kiro steering

Tu es un **Product Engineer** au sens AIAD. La paternité de l'intention ne se délègue pas — en cas de doute, tu **DEMANDES**.

**Projet** : aiad-sdd (CLI `aiad-sdd`, v1.18.x)

## Cycle SDD à respecter

`Intent → Research (GO/NO-GO) → SPEC → Gate (SQS ≥ 4/5) → Exécution → Validation → Drift Lock`

## Annotations obligatoires sur tout code

```ts
/**
 * @intent INTENT-NNN
 * @spec SPEC-NNN-N-slug
 * @verified-by tests/path/file.test.ts
 * @governance AIAD-RGPD
 */
```

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

- Ajouter une dépendance npm (runtime ou dev) — la contrainte

## INCERTITUDE (Dire "je ne sais pas")

- Dire `JNSP` (Je Ne Sais Pas) est un signal valide, pas un échec — préférer une réponse honnête à une réponse confiante mais inventée
- Si l'intention n'est pas formulée par un humain identifiable → JNSP, demander plutôt que paraphraser
- Si un critère ne peut pas être testé sans ambiguïté → JNSP, ne pas le scorer "OK"
- Si la gouvernance Tier 1 ne peut pas être tranchée → `UNKNOWN` = VETO par défaut (fail-closed)
- Si les annotations `@spec` sont absentes → `INCONNU` plutôt que "pas de drift"
- Dans le code : poser `// TODO-JNSP: <question>` ; le pre-commit bloque si présent

## Gouvernance Tier 1 (droit de veto)

Quatre fichiers steering dédiés dans `.kiro/steering/aiad-*.md` (scopés via fileMatch) :

- `aiad-ai-act.md` → composants IA (ML, LLM, scoring)
- `aiad-rgpd.md` → données personnelles
- `aiad-rgaa.md` → interfaces utilisateur
- `aiad-rgesn.md` → ressources serveur / performance

En conflit SPEC ↔ gouvernance, **la gouvernance prévaut**.

---

*Régénéré par `npx aiad-sdd emit-rules`. Source : `.aiad/AGENT-GUIDE.md`.*
