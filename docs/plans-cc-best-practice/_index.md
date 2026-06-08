# Plans d'implémentation — Roadmap `claude-code-best-practice` → SDD Mode

> **Source** : `docs/analyse-claude-code-best-practice.md` (roadmap §3.1→§3.13 + garde-fous §4)
> **Nature** : plans détaillés **uniquement** — aucune modification du SDD Mode à ce stade.
> **Cible** : Claude Code v2.1.168 · Opus 4.8 · effort `low→max`
> **État du code analysé** : aiad-sdd v1.17.0 (`bin/aiad-sdd.js` + `lib/*.js` + `templates/.claude/`)

---

## Principe directeur unique

Tous les plans se rangent derrière l'axe n°1 de l'analyse (§1) :

> **Migrer chaque règle critique de « texte advisory » vers « primitive harness enforced ».**
> « le modèle *devrait* respecter le veto » → « le modèle *ne peut pas* le contourner ».

Corollaire transverse (§2.2, §3.4) : **computation off-context** — tout verdict (SQS, gate, veto, drift, trace) doit être produit par un **script CLI déterministe** (`lib/*.js`) avec **exit codes 0/1/2** et **sortie JSON validée par schéma**, jamais par le jugement libre du modèle.

---

## Architecture réelle ciblée (rappel)

| Couche | Emplacement | Rôle |
|--------|-------------|------|
| CLI déterministe | `bin/aiad-sdd.js` → `lib/*.js` | verdicts, calcul, émission |
| Templates Claude Code | `templates/.claude/{sdd,aiad,commands,skills}/` | corps de commandes + skills émis dans les projets |
| Settings émis | `templates/.claude/settings.json` | hooks harness (déjà : `SessionStart`) |
| Gouvernance source | `.aiad/AGENT-GUIDE.md` + `.aiad/gouvernance/` | source unique `emit-rules` |
| Enforced existant | `.aiad/hooks/pre-commit.sh`, `.aiad/hooks/session-start.js` | seuls mécanismes non contournables aujourd'hui |
| Synchro multi-runtime | `lib/emit-rules.js` | CLAUDE.md / AGENTS.md / .cursor / .codex / GEMINI.md |

---

## Index des plans

### P0 — Fondations : rendre la gouvernance *enforced*

| # | Plan | Recommandation | Impact / Effort |
|---|------|----------------|-----------------|
| 3.1 | [Vetos Tier 1 → primitives harness](./P0-3.1-vetos-tier1-enforced.md) | §3.1 | 🔴 / Moyen |
| 3.2 | [TODO-JNSP → hook `PreToolUse` natif](./P0-3.2-jnsp-pretooluse.md) | §3.2 | 🔴 / Faible |
| 3.3 | [Drift Lock → hook `Stop`/`PostToolBatch`](./P0-3.3-drift-lock-hook.md) | §3.3 | 🔴 / Faible |
| 3.4 | [Verdicts machine-vérifiables (JSON + exit codes)](./P0-3.4-verdicts-machine-verifiables.md) | §3.4 | 🔴 / Faible |

### P1 — Combler les 2 trous du cycle + alléger le contexte

| # | Plan | Recommandation | Impact / Effort |
|---|------|----------------|-----------------|
| 3.5 | [Phase Research + gate GO/NO-GO + Discovery](./P1-3.5-research-gate-discovery.md) | §3.5 | 🟠 / Moyen |
| 3.6 | [Exécution phasée + mini-gates + 3e verdict](./P1-3.6-execution-phasee-mini-gates.md) | §3.6 | 🟠 / Moyen |
| 3.7 | [Budget d'instructions : push → pull](./P1-3.7-budget-instructions-pull.md) | §3.7 | 🟠 / Faible |

### P2 — Capitalisation, robustesse, anti-bruit

| # | Plan | Recommandation | Impact / Effort |
|---|------|----------------|-----------------|
| 3.8 | [Memory native (agent `memory:`)](./P2-3.8-memory-native.md) | §3.8 | 🟡 / Moyen |
| 3.9 | [Cycle SDD comme graphe de Tasks](./P2-3.9-cycle-graphe-tasks.md) | §3.9 | 🟡 / Moyen |
| 3.10 | [Canary suite + alignement modèles](./P2-3.10-canary-alignement-modeles.md) | §3.10 | 🟡 / Faible |

### P3 — Confort, observabilité, distribution

| # | Plan | Recommandation | Impact / Effort |
|---|------|----------------|-----------------|
| 3.11 | [Observabilité native (OTel + statusLine)](./P3-3.11-observabilite-otel-statusline.md) | §3.11 | 🟢 / Variable |
| 3.12 | [Cross-model auteur/reviewer additive-only](./P3-3.12-cross-model-additive.md) | §3.12 | 🟢 / Moyen |
| 3.13 | [Distribution plugin/marketplace + boucles `/goal`](./P3-3.13-distribution-plugin-goal.md) | §3.13 | 🟢 / Variable |

### Transverse — Garde-fous de conception

| # | Plan | Recommandation | |
|---|------|----------------|---|
| GF | [Garde-fous de conception (§4)](./GF-garde-fous-conception.md) | §4 | Philosophie à inscrire |

---

## Convention commune des plans

Chaque fichier suit la structure :

1. **Intention** (le POURQUOI, paternité humaine)
2. **État actuel SDD Mode** (fichiers réels concernés)
3. **Cible enforced** (primitive harness visée)
4. **Conception détaillée**
5. **Étapes d'implémentation séquencées**
6. **Fichiers touchés / créés**
7. **Critères d'acceptation (EARS)**
8. **Tests & vérification**
9. **Risques, dépendances, rollback**
10. **Effort & découpage en SPECs**

---

## Suivi de complétude

- [x] §3.1 — Vetos Tier 1 enforced
- [x] §3.2 — TODO-JNSP PreToolUse
- [x] §3.3 — Drift Lock hook
- [x] §3.4 — Verdicts machine-vérifiables
- [x] §3.5 — Research gate + Discovery
- [x] §3.6 — Exécution phasée
- [x] §3.7 — Budget instructions pull
- [x] §3.8 — Memory native
- [x] §3.9 — Cycle graphe Tasks
- [x] §3.10 — Canary + alignement modèles
- [x] §3.11 — Observabilité native
- [x] §3.12 — Cross-model additive
- [x] §3.13 — Distribution plugin + goal
- [x] §4 — Garde-fous de conception
