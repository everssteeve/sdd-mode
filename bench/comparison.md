---
layout: default
title: Benchmarks comparatifs
---

# Benchmarks comparatifs

> Mesures **AIAD SDD v1.14.0** au 2026-05-10 · Node v24.15.0 · darwin arm64
>
> Régénéré à chaque release via `node scripts/bench-comparison.js`. Méthodologie reproductible : voir section *Méthodologie* en fin de page.
>
> **Date de collecte des données concurrentes** : 2026-06-29. Les colonnes « documenté » renseignent ce qui est publiquement documenté par chaque outil à cette date — aucun benchmark n'a été exécuté localement pour ces outils. Un concurrent peut évoluer : ouvrir une PR de mise à jour en citant la source.

## Synthèse

Les métriques AIAD-SDD sont **mesurées** 🔬 sur la machine de release. Les colonnes concurrentes renseignent les caractéristiques **publiquement documentées** 📄 par leurs auteurs respectifs.

| Métrique | AIAD SDD 🔬 mesuré | Spec Kit 📄 documenté | Kiro 📄 documenté | OpenSpec 📄 documenté | BMAD 📄 documenté | Cursor Memory Bank |
|----------|-------------------|----------------------|------------------|-----------------------|-------------------|-------------------|
| Cold-start CLI | **41.1 ms / 41.8 ms / 42.0 ms / 42.0 ms (3 runs)** | *non publié* | *non publié* | N/A — framework méthodologique sans CLI autonome (2026-06-29) | N/A — framework méthodologique sans CLI autonome (2026-06-29) | N/A (in-IDE) |
| Init projet (zero-dep) | **54.1 ms / 54.5 ms / 55.6 ms / 55.6 ms (3 runs)** | install requis (Python uv) | install Amazon Q + IDE | N/D (2026-06-29) — pas d'init CLI identifié | N/D (2026-06-29) — pas d'init CLI identifié | configuration manuelle |
| Scan trace 1k fichiers | **41.9 ms / 42.8 ms / 44.9 ms / 44.9 ms (3 runs)** | pas de scan trace natif | pas de scan trace natif | N/D (2026-06-29) | N/D (2026-06-29) | N/A |
| Doctor (--json) | **38.6 ms / 39.6 ms / 39.9 ms / 39.9 ms (3 runs)** | pas de commande doctor | pas de commande doctor | N/D (2026-06-29) | N/D (2026-06-29) | N/A |

Format des cellules AIAD : **min / médiane / p95 / max** sur N runs.

## Caractéristiques différenciantes (au-delà du temps)

| Capacité | AIAD SDD | Spec Kit | Kiro | OpenSpec | BMAD | Cursor MB |
|----------|:--------:|:--------:|:----:|:--------:|:----:|:---------:|
| Zero-dep runtime | ✅ | ❌ (Python) | ❌ (Amazon Q) | N/A — framework méthodologique | N/A — framework méthodologique | N/A |
| Multi-runtime AGENTS.md/CLAUDE.md/.cursor/.codex/GEMINI | ✅ | ❌ | ❌ | N/D (2026-06-29) | N/D (2026-06-29) | ❌ |
| Drift Lock pre-commit hook | ✅ | ❌ | ❌ | N/D (2026-06-29) | ❌ (2026-06-29) | ❌ |
| Matrice traçabilité Intent ↔ SPEC ↔ Code ↔ Tests | ✅ | ❌ | ❌ | N/D (2026-06-29) | ❌ (2026-06-29) | ❌ |
| Format SARIF CodeQL natif | ✅ | ❌ | ❌ | N/D (2026-06-29) | N/D (2026-06-29) | ❌ |
| Agents gouvernance EU (RGPD/AI-ACT/CRA/RGAA/RGESN) | ✅ | ❌ | ❌ | ❌ (2026-06-29) | ❌ (2026-06-29) | ❌ |
| Audit AI Act (Annexe IV pré-rempli) | ✅ | ❌ | ❌ | ❌ (2026-06-29) | ❌ (2026-06-29) | ❌ |
| AIPD Article 35 RGPD pré-rempli | ✅ | ❌ | ❌ | ❌ (2026-06-29) | ❌ (2026-06-29) | ❌ |
| SBOM CycloneDX v1.5 généré | ✅ | ❌ | ❌ | ❌ (2026-06-29) | ❌ (2026-06-29) | ❌ |
| Reproducible build verification | ✅ | ❌ | ❌ | N/D (2026-06-29) | N/D (2026-06-29) | ❌ |
| Pack gouvernance sectoriel (DORA finance) | ✅ | ❌ | ❌ | ❌ (2026-06-29) | ❌ (2026-06-29) | ❌ |
| TUI interactive zero-dep | ✅ | ❌ | ✅ | ❌ (2026-06-29) | ❌ (2026-06-29) | ❌ |
| Migration auto Spec Kit / Kiro → .aiad/ | ✅ | N/A | N/A | N/D (2026-06-29) | N/D (2026-06-29) | N/A |
| Tests automatisés du framework | ✅ 540+ | partial | inconnu | N/D (2026-06-29) | N/D (2026-06-29) | N/A |
| Couverture runtimes IA | 5 (Claude Code, Cursor, Codex, Copilot, Gemini) | 30+ runtimes | Amazon Q uniquement | N/D (2026-06-29) | N/D (2026-06-29) | Cursor uniquement |

## Sources des données concurrentes (2026-06-29)

| Concurrent | Source principale |
|-----------|------------------|
| Spec Kit | https://github.com/githubnext/spec-kit |
| Kiro | https://kiro.dev / documentation officielle Amazon |
| OpenSpec | https://github.com/openspec — nature : framework de spécification méthodologique |
| BMAD | https://github.com/bmadcode/BMAD-METHOD — nature : framework méthodologique pour développement agentique |
| Cursor Memory Bank | https://cursor.directory/memory-bank |

## Méthodologie

### Mesures AIAD

Chaque métrique est exécutée **N fois** (configurable, défaut 5) avec des fixtures reproductibles :

- **Cold-start CLI** : `node bin/aiad-sdd.js --version` (lecture package.json + parsing CLI).
- **Init projet** : `aiad-sdd init` sur un dossier temporaire vierge (création `.aiad/`, `.claude/`, agents Tier 1, multi-runtime).
- **Scan trace** : `aiad-sdd trace --quiet` sur un projet synthétique de 1000 fichiers TypeScript (~33% annotés).
- **Doctor** : `aiad-sdd doctor --json` après init complet.

Toutes les fixtures sont créées en `tmpdir()` et nettoyées après chaque run. La génération des fichiers utilise un slug déterministe pour stabiliser les mesures inter-runs.

### Caveats

- Les chiffres dépendent du **disque** (SSD vs HDD), de la **CPU** et de la **version Node** (≥ 18).
- Les colonnes Spec Kit / Kiro listent ce qui est **publiquement documenté** par leurs auteurs ; aucune mesure n'a été exécutée localement (environnements et dépendances incompatibles avec le cap zero-dep d'AIAD).
- OpenSpec et BMAD sont des **frameworks méthodologiques** — ils ne proposent pas de CLI mesurable. La colonne « Support runtime IA » leur est non applicable (N/A), pas absente (❌).
- Les *✅ / ❌* sont vérifiables ligne par ligne dans la documentation officielle de chaque outil au 2026-05-10 pour AIAD, et au 2026-06-29 pour les concurrents.
- Les cellules **N/D (YYYY-MM-DD)** indiquent une donnée non disponible à la date indiquée, non une absence de fonctionnalité.

### Reproduire localement

```bash
git clone https://github.com/everssteeve/sdd-mode
cd sdd-mode
node scripts/bench-comparison.js --runs 10 --files 1000
# → bench/comparison.md régénéré (métriques AIAD uniquement — colonnes concurrentes préservées manuellement)
```

---

*Document régénéré le 2026-05-10 (métriques AIAD) par `scripts/bench-comparison.js`. Colonnes concurrentes mises à jour manuellement le 2026-06-29 (OpenSpec, BMAD ajoutés — SPEC-023-1).*
