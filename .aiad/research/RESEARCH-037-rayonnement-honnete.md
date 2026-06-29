---
id: RESEARCH-037
title: Rayonnement honnête — comparatif public et runtimes élargis
intent: INTENT-023
author: Steeve Evers
date: 2026-06-29
verdict: GO (80 %)
confidence: 80
status: tranché
---

# RESEARCH-037 — Rayonnement honnête

**Intent parent** : INTENT-023
**Auteur** : Steeve Evers
**Date** : 2026-06-29
**Statut** : tranché — GO (80 %)

---

## Discovery

Zones cartographiées par agent Explore (read-only, ancrages `chemin:ligne`) :

**Zone 1 — Core emit-rules (runtimes)**
- `lib/emit-rules.js:39` — `RUNTIMES_VALIDES = ['claude-code', 'cursor', 'codex', 'copilot', 'gemini', 'all']` — 5 runtimes réels + pseudo `all`
- `lib/emit-rules.js:788-871` — Pipeline `_emitRulesImpl()` : boucle `wants(runtime)` → séquence claude-code, cursor, codex, copilot, gemini ; point d'intégration pour nouveaux runtimes
- `lib/emit-rules.js:364-423` — `genererCursorAiadMdc()` : patron canonique MDC (frontmatter + alwaysApply) à copier pour un nouveau runtime
- `lib/emit-rules.js:450-476` — `genererCursorTier1Mdc()` : 4 fichiers Tier 1 scopés par globs (RGPD/RGAA/AI-ACT/RGESN)
- `lib/emit-rules.js:492-532` — `genererClaudeAgent()` : subagents read-only, `paths:` scopés — fail-closed
- `lib/emit-rules.js:577-609` — `genererCodexAgent()` : `.codex/AGENT.md` optionnel (condensé)
- `lib/emit-rules.js:612-635` — `genererGeminiMd()` : `GEMINI.md` optionnel (condensé)
- `lib/emit-rules.js:169-203` — `GLOBS_TIER1` + `GLOBS_RULES` : mappings scope par zone de risque — à étendre si nouveau runtime a des zones différentes

**Zone 2 — CLI**
- `bin/aiad-sdd.js:1902-1939` — Commande CLI `emit-rules` : validation runtimes, `--check`, exit 1 si drift, JSON mode
- `bin/aiad-sdd.js:17` — Import `emitRules, EMIT_RUNTIMES` depuis `lib/emit-rules.js`
- `lib/commands-registry.js:54` — `emit-rules` = `tier: core`, `category: administration`, `status: active`

**Zone 3 — Comparatif public existant**
- `bench/comparison.md` — Tableau comparatif : métriques AIAD mesurées + Spec Kit/Kiro documentés ; OpenSpec et BMAD absents
- `scripts/bench-comparison.js` — Régénération comparatif : 4 métriques mesurées (cold-start, init, trace, doctor)
- `test/bench-comparison.test.js` — Tests fonctions pures (`statistiques`, `formatStat`, `genererTableauComparatif`)

**Zone 4 — Site public**
- `site/fr/index.html` — Hero + sections principales ; aucun lien vers comparatif
- `site/fr/` — 20+ pages HTML (demarrer.html, artefacts.html, metriques.html…) ; aucune page `comparaison.html`

**Zone 5 — Tests emit-rules existants**
- `test/emit-rules.test.js:37-223` — Idempotence, parité, drift, JNSP/INCERTITUDE, hash source
- `test/emit-rules-agents.test.js:23-75` — Subagents Tier 1 claude-code (génération, read-only, paths)
- `test/emit-rules-pull.test.js:32-88` — Rules pull `.claude/rules/*.md`, paths différentiels
- `test/emit-rules-concurrent.test.js:24-77` — Concurrence & lock

**Runtimes absents identifiés** :
- Kiro (AWS) : cité dans docs, export `.kiro/` inexistant
- Amazon Q : cité dans `bench/comparison.md`, aucun export
- OpenSpec / BMAD : cités dans INTENT-023, nature à préciser (runtime IA ou framework méthodologique ?)

---

## Faisabilité

**Objectif 1 — Page comparative publique** : faisable avec l'architecture existante. `bench/comparison.md` contient les métriques mesurées ; la page HTML suit le pattern `site/fr/*.html`. Coût estimé : 1 SPEC (SPEC-023-1), 2-4 jours agent. Contrainte non négociable : afficher explicitement les faiblesses AIAD (5 runtimes vs 30+ Spec Kit) en vertu de la valeur Honnêteté sur les Contradictions.

**Objectif 2 — Extension emit-rules** : faisable, pattern établi. Ajouter un runtime = `RUNTIMES_VALIDES` + nouvelle fonction `generer<Runtime>*()` + case dans `_emitRulesImpl()` + tests. Kiro est le candidat le mieux justifié (déjà cité dans la doc). Nature BMAD/OpenSpec à préciser avant SPEC-023-2.

---

## Risques & inconnues

- R1 : Données Spec Kit / Kiro / OpenSpec / BMAD potentiellement obsolètes (outils qui évoluent vite) → indiquer la date de collecte dans chaque cellule ; inviter les projets à corriger via PR
- R2 : Métriques concurrents non mesurées (vs AIAD mesurée) → distinguer « mesuré » vs « documenté » avec indicateur visuel
- R3 : Format de configuration Kiro non spécifié publiquement (YAML ? Markdown ?) → à investiguer avant SPEC-023-2
- R4 : Nature de BMAD/OpenSpec non tranchée (runtime IA configurables ou frameworks méthodologiques ?) → impact périmètre SPEC-023-2
- R5 : INTENT-023 est en statut `draft` — à activer avant passage en SPEC

---

## Verdict

Verdict : GO
Auteur du verdict : Steeve Evers
Confidence : 80 %

## Conditions

*(aucune — GO franc)*
