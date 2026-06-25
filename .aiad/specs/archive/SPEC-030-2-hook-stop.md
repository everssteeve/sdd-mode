---
status: archived
archivedAt: "2026-06-25T07:45:25.825Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# SPEC-030-2-hook-stop

**Intent parent** : INTENT-030
**Auteur** : Steeve Evers
**Date** : 2026-06-24
**Statut** : done
**Format** : prose
**SQS** : 5/5 — Gate OUVERTE (2026-06-25)

---

## 1. Contexte

SPEC-030-1 expose `estimerImpact()`. Cette SPEC instrumente le **hook `Stop` du harness Claude Code** pour capturer tokens + modèle à chaque fin de session agent, estimer le CO₂ via `estimerImpact()`, et persister le résultat dans `.aiad/metrics/hook-runs.jsonl`. C'est le point de collecte principal (périmètre B tranché en RESEARCH-028).

## 2. Comportement Attendu

### Input

Le hook `Stop` de Claude Code est déclenché en fin de session agent. Le harness passe sur `stdin` un payload JSON contenant au minimum :

```json
{
  "session_id": "...",
  "stop_hook_active": true,
  "usage": {
    "input_tokens": 12000,
    "output_tokens": 3500
  }
}
```

Le modèle actif est lu depuis la variable d'environnement `CLAUDE_MODEL` (mise à disposition par le harness) ou déduit de `ANTHROPIC_MODEL` en fallback. Si aucune variable n'est présente → `model: 'unknown'`.

### Processing

1. Lire `stdin` JSON (payload Stop hook).
2. Extraire `usage.input_tokens`, `usage.output_tokens`, `session_id`.
3. Résoudre le modèle actif (`CLAUDE_MODEL` → `ANTHROPIC_MODEL` → `'unknown'`).
4. Appeler `estimerImpact({ model, inputTokens, outputTokens })` depuis `lib/eco-estimator.js`.
5. Construire l'entrée JSONL :
   ```json
   {
     "ts": "<ISO-8601>",
     "event": "session-stop",
     "sessionId": "...",
     "model": "claude-sonnet-4-6",
     "ecoMetrics": {
       "co2g": 0.042,
       "energyWh": 8.8e-5,
       "totalTokens": 15500,
       "method": "estimated",
       "co2Label": "estimation indicative (non certifiée)"
     }
   }
   ```
6. Appender la ligne dans `.aiad/metrics/hook-runs.jsonl` (créer le fichier si absent).
7. Sortir exit 0 — le hook ne bloque jamais la session (fail-open).

### Output

- Ligne JSONL ajoutée dans `.aiad/metrics/hook-runs.jsonl`.
- Rien sur stdout (le harness ignore la sortie du hook `Stop`).
- Erreurs non fatales → `process.stderr` uniquement, exit 0.

### Cas limites

- **Payload stdin vide ou non-JSON** : exit 0 silencieux (pas de crash).
- **`usage` absent du payload** : `inputTokens: 0, outputTokens: 0` → ligne enregistrée avec `co2g: 0`.
- **`eco-models.json` absent** : `EcoModelsNotFoundError` capturée, ligne enregistrée avec `method: 'unknown'`, `co2g: null`.
- **`.aiad/metrics/` absent** : créer le répertoire récursivement avant écriture.
- **Écriture disque impossible** : erreur sur stderr, exit 0 (pas de blocage session).
- **Hook `Stop` non configuré** : aucun effet — la collecte est opt-in via la configuration `.claude/settings.json`.

## 3. Critères d'Acceptation

- [ ] Après une session agent terminée, une ligne JSONL avec `event: "session-stop"` et `ecoMetrics.co2g > 0` est présente dans `.aiad/metrics/hook-runs.jsonl`.
- [ ] `ecoMetrics.co2Label` vaut `"estimation indicative (non certifiée)"` dans chaque entrée.
- [ ] Payload stdin non-JSON → exit 0, aucun crash, aucune ligne erronée en base.
- [ ] `CLAUDE_MODEL` absent → `model: 'unknown'`, `method: 'unknown'`, `co2g: null` — ligne quand même persistée.
- [ ] `.aiad/metrics/` absent → répertoire créé automatiquement, ligne persistée.
- [ ] Le hook s'enregistre dans `.claude/settings.json` sous la clé `hooks.Stop` avec le chemin absolu vers `lib/eco-hook.js`.
- [ ] Zéro dépendance de production ajoutée à `package.json`.

## 4. Interface / API

```js
// lib/eco-hook.js — exécutable Node.js (shebang #!/usr/bin/env node)
// Invoqué par le harness comme script Stop hook.
// Lecture stdin → calcul → écriture JSONL → exit 0.
```

```json
// .claude/settings.json — ajout requis
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "node /chemin/absolu/lib/eco-hook.js" }
        ]
      }
    ]
  }
}
```

## 5. Dépendances

- **SPEC-030-1** — `lib/eco-estimator.js` + `lib/eco-models.json` (format de sortie `EcoResult`).
- Node 18+ ESM, `node:fs`, `node:path`, `node:process` — aucune dépendance externe.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- SPEC-030-1 (interface `EcoResult`) : ~150 tokens
- Cette SPEC : ~450 tokens
- Fichiers source à lire : `lib/eco-estimator.js`, `.claude/settings.json`
- **Total estimé** : ~1 100 tokens

## 7. Definition of Output Done (DoOD)

- [ ] `lib/eco-hook.js` — script Stop hook, ESM, shebang, exit 0 garanti
- [ ] `.claude/settings.json` mis à jour avec l'entrée `hooks.Stop`
- [ ] `test/eco-hook.test.js` — couverture des 7 critères d'acceptation avec `node:test`
- [ ] `@spec SPEC-030-2-hook-stop` posé sur `eco-hook.js`
- [ ] `@intent INTENT-030` posé sur `eco-hook.js`
- [ ] Lint passing
- [ ] SPEC mise à jour si écart (Drift Lock)
- [ ] Gouvernance : fail-open vérifié (AIAD-RGESN — pas de surcharge session)
