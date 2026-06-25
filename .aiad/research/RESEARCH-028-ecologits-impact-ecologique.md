# RESEARCH-028-ecologits-impact-ecologique

**Intent parent** : INTENT-030
**Auteur** : Steeve Evers
**Date** : 2026-06-24
**Statut** : tranché — CONDITIONAL GO (80 %)

---

## Discovery

Ancrages principaux : `lib/score.js:172`, `lib/command-hooks.js:90`, `lib/dashboard.js:60`, `.aiad/metrics/hook-runs.jsonl`, `lib/telemetry.js:1`.

### Zone 1 — Appels LLM via Ollama (code Node.js mesurable)

`lib/score.js:172-190` — fonction `appelerOllama(prompt, options)` — appel HTTP direct à `http://127.0.0.1:11434/api/generate`.  
Consommateurs : `scorerArtefact`, `reflect`, `refactor-spec`, `suggest-annotations`, `negotiate`.

```js
// lib/score.js:172-190
export async function appelerOllama(prompt, options = {}) {
  const reponse = await fetchFn(`${url}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({ model, prompt, stream: false })
  });
  // ← point d'injection EcoLogits (tokens in/out connus ici)
}
```

Surface de test : `test/score.test.js` (45+ assertions, mock `fetchFn` injectable).

### Zone 2 — Appels LLM via Claude Code harness (hors codebase Node.js)

Les commandes SDD principales (`/sdd intent`, `/sdd spec`, `/sdd gate`, `/sdd validate`, etc.) sont des **directives agent** dans `.claude/sdd/*.md`. Les appels Claude API sont émis par le harness Claude Code, **opaque au projet** — le code Node.js n'y a pas accès.

**Conséquence directe** : EcoLogits ne peut pas instrumenter ces appels via le code Node.js. Une instrumentation à ce niveau nécessiterait une intégration côté harness (hook Claude Code `PostToolUse` ou `Stop`) ou une estimation post-hoc par session.

### Zone 3 — Middleware hooks CLI

`lib/command-hooks.js:90-125` — contrat `afterCommand(ctx)` exécuté après chaque commande SDD.  
Contexte disponible : `{ command, args, racine, exitCode, durationMs }`.  
Fichier de configuration : `.aiad/hooks/aiad-hooks.js` (ESM local, opt-in utilisateur).  
**Point d'injection** : enrichir `ctx` avec `ecoMetrics` avant persistence.

### Zone 4 — Métriques (stockage)

`.aiad/metrics/hook-runs.jsonl` — JSONL line-based, zéro tokens/CO₂ aujourd'hui.  
`lib/telemetry.js` — events JSONL dans `~/.aiad-sdd/events.jsonl` (optIn, anonymousId).  
Extensible sans breaking change : ajout d'un champ `ecoMetrics: { co2g, energyWh, tokens }`.

### Zone 5 — Dashboard AIAD

`lib/dashboard.js:60-84` — 8 renderers HTML (`RENDERERS` map).  
`lib/dashboard.js` génère `dashboard/metrics.html` à partir des données `.aiad/metrics/`.  
**Point d'injection** : ajouter renderer `eco` → page `dashboard/eco.html` + widget CO₂ dans `metrics.html`.

### Zone 6 — Rapport /sdd validate

`.claude/sdd/validate.md` — directive agent (prompt Claude Code), pas un binaire Node.js.  
Le rapport est produit en stdout par les skills. **Un badge CO₂ ne peut pas être injecté par le code Node.js** — il doit être émis par une skill `/sdd validate` enrichie ou par un hook post-commande.

### Zone 7 — Dépendances et runtime

`package.json` : zéro dépendance de production, Node 18+ natif (ESM, fetch natif).  
**EcoLogits est une bibliothèque Python** (`pip install ecologits`). Il n'existe pas de port JS officiel.  
Options de bridge :
- **Option A — subprocess Python** : `child_process.spawn('python3', ['-m', 'ecologits', ...])` — requiert Python + ecologits dans l'env utilisateur.
- **Option B — ré-implémentation JS** : porter la base de modèles EcoLogits (JSON) et l'algorithme d'estimation en Node.js — pas de dépendance externe, offline-first, mais coût de maintenance.
- **Option C — sidecar HTTP** : exposer EcoLogits via un micro-serveur Python local — complexité opérationnelle.

---

## Faisabilité

**Réalisable** pour les appels Ollama (Zone 1) et le dashboard (Zone 5) avec l'architecture actuelle.  
**Non réalisable directement** pour les appels Claude Code harness (Zone 2) via le code Node.js — un hook harness (`Stop` ou `PostToolUse`) est la seule voie.

**Coût estimé** :
- Option B (ré-implémentation JS) : 2–3 SPECs, surface de test conséquente.
- Option A (subprocess Python) : 1 SPEC, mais crée une dépendance Python non déclarée.
- Hook harness pour Claude API : 1 SPEC + enrichissement `.claude/sdd/validate.md`.

---

## Risques & Inconnues

| # | Risque | Probabilité | Impact | Mitigation possible |
|---|--------|-------------|--------|---------------------|
| R1 | Scope flou : Ollama seulement vs harness Claude aussi | Élevée | Élevé | Décision humaine requise avant la SPEC |
| R2 | EcoLogits Python → bridge fragile (subprocess) | Moyenne | Moyen | Option B (JS) élimine la dépendance |
| R3 | Appels harness Claude non accessibles | Certaine | Moyen | Hook `Stop` + estimation post-session par token count |
| R4 | Estimation CO₂ indicative mal comprise → greenwashing | Faible | Élevé | Libellé explicite "estimation indicative" (AIAD-AI-ACT) |
| R5 | Badge CO₂ dans `/sdd validate` impossible sans skill enrichie | Certaine | Faible | Enrichir `.claude/sdd/validate.md` + `regulatory-veto` skill |

**Inconnues levées (tranché par Steeve Evers — 2026-06-24) :**

- TRANCHÉ — Périmètre : (B) harness Claude Code via hook `Stop` en phase 1, Ollama en phase 2.
- TRANCHÉ — Stratégie bridge : (B) ré-implémentation JS native, base de modèles EcoLogits portée en JSON.

---

## Verdict : CONDITIONAL GO (80 %)

Décision : Steeve Evers — 2026-06-24

---

## Conditions (CONDITIONAL GO)

- [x] C1 — Périmètre B : instrumenter le harness Claude Code via hook `Stop` (tokens + modèle → estimation CO₂ post-session). Ollama en phase 2 si confirmé par les métriques.
- [x] C2 — Stratégie B : ré-implémentation JS native de l'algorithme EcoLogits (tokens × énergie × intensité carbone), base de modèles portée en JSON versionné. Zéro dépendance Python.

---

## Suite

- `GO` / `CONDITIONAL GO` → `/sdd spec INTENT-030` autorisé
- `DEFER` / `NO-GO` → nouvelle Research requise
