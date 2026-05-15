# {{name}}

> {{description}}
>
> Bootstrap depuis `aiad-sdd new node-aiad` — Node.js 18+ ESM, zero-dep, AIAD SDD préinstallé (agents Tier 1 EU, Drift Lock, traçabilité, multi-runtime AGENTS.md).

## Démarrage

```bash
npm install        # rien à installer (zero-dep) — placeholder pour vos futures deps
npm test           # exécute les tests Node natifs
npm start          # lance src/index.js
```

## AIAD SDD

```bash
npx aiad-sdd doctor                # diagnostic santé du projet
npx aiad-sdd trace --fail-on-gap   # matrice de traçabilité Intent ↔ SPEC ↔ Code ↔ Tests
npx aiad-sdd dashboard --serve     # dashboard HTML local
npm run aiad:trace                 # alias direct
```

## Structure

```
.aiad/                      ← Intents, SPECs, gouvernance Tier 1, hooks
.claude/                    ← commandes /sdd, /aiad, /aiad-help, skills
src/index.js                ← point d'entrée (annotations @intent / @spec / @verified-by)
test/index.test.js          ← tests Node natifs (zero-dep)
AGENTS.md / CLAUDE.md       ← entrée multi-runtime générée par `aiad-sdd emit-rules`
```

## Cycle SDD recommandé

1. Capture l'intention : `/sdd intent` (Claude Code) ou `npx aiad-sdd repl` puis `intent`.
2. Rédige la SPEC : `/sdd spec` (depuis l'Intent).
3. Valide la SPEC : `/sdd gate` (SQS ≥ 4/5).
4. Implémente avec annotations `@spec SPEC-NNN-N-slug`.
5. `npm run aiad:trace` — vérifie zéro gap.

## Licence

{{license}}
