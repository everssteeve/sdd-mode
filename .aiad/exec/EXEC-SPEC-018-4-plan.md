# EXEC-SPEC-018-4 — Plan d'exécution phasé

> Marqueurs : `[ ]` à faire · `[~]` en cours · `[x]` validé · `[!]` bloqué · `[-]` hors-scope

**SPEC** : SPEC-018-4-bilan-humains-agents
**Intent** : INTENT-018
**Gouvernance** : AIAD-RGPD (noms personnes — local only) + AIAD-RGAA (tableau HTML)
**Mode phasé** : activé

---

## Phase 1 — collect.js + calculerBilanHumainsAgents() + tests  [x]

- Objectif : étendre le parser frontmatter Intent (executor/validator), ajouter governanceTags dans lireSpecs, et implémenter la fonction de calcul pure
- Fichiers : `lib/dashboard/collect.js` (extension), `lib/dashboard/intent-humans-agents.js` (création)
- Tests : `test/dashboard-intent-humans-agents.test.js` — 3 Intents (auteur humain + executor agent, auteur humain + executor null, tout null), classification Claude→agent, null→inconnu
- Done : `node --test test/dashboard-intent-humans-agents.test.js` vert
- Conditions : —

## Phase 2 — blocBilanHumainsAgents() HTML + injection + schéma  [x]

- Objectif : rendu HTML tableau accessible RGAA, injection dans model/index.js, schéma étendu
- Fichiers : `lib/dashboard/intent-humans-agents.js` (compléter), `lib/dashboard/model/index.js` (injection), `lib/dashboard/schema/data-v2.schema.json` (bilanHumainsAgents)
- Tests : structure HTML (caption, thead, th scope="col"), cellule —, badge Humain/Agent IA
- Done : tous tests verts + @spec @governance posés
- Conditions : —
