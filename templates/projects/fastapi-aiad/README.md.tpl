# {{name}}

> {{description}}
>
> Bootstrap depuis `aiad-sdd new fastapi-aiad` — Python 3.11+ · FastAPI 0.115+ · uv pour les deps · ruff + black · pytest. AIAD SDD préinstallé (agents Tier 1 EU, Drift Lock, traçabilité).

## Démarrage

```bash
uv sync                          # installe les deps via uv (recommandé)
uv run uvicorn app.main:app --reload
# → http://127.0.0.1:8000
```

## Tests

```bash
uv run pytest                    # tests
uv run ruff check .              # lint
uv run black --check .           # format
```

## AIAD SDD

```bash
npx aiad-sdd doctor              # diagnostic santé du projet
npx aiad-sdd trace --fail-on-gap # matrice de traçabilité Intent ↔ SPEC ↔ Code ↔ Tests
npx aiad-sdd dashboard --serve   # dashboard HTML local
```

## Structure

```
.aiad/                      ← Intents, SPECs, gouvernance Tier 1, hooks
.claude/                    ← commandes /sdd, /aiad, /aiad-help, skills
app/main.py                 ← endpoints FastAPI (annotations @intent / @spec / @verified-by)
tests/test_main.py          ← tests pytest + httpx TestClient
pyproject.toml              ← métadonnées + deps (uv-compatible)
AGENTS.md / CLAUDE.md       ← entrée multi-runtime générée par `aiad-sdd emit-rules`
```

## Cycle SDD recommandé

1. Capture l'intention : `/sdd intent` (Claude Code) ou `npx aiad-sdd repl` puis `intent`.
2. Rédige la SPEC : `/sdd spec` (depuis l'Intent).
3. Valide la SPEC : `/sdd gate` (SQS ≥ 4/5).
4. Implémente avec annotations `@spec SPEC-NNN-N-slug` dans le code Python.
5. `npx aiad-sdd trace --fail-on-gap` — vérifie zéro gap.

## Licence

{{license}}
