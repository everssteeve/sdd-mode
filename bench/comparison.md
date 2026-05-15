---
layout: default
title: Benchmarks comparatifs
---

# Benchmarks comparatifs

> Mesures **AIAD SDD v1.14.0** au 2026-05-10 · Node v24.15.0 · darwin arm64
>
> Régénéré à chaque release via `node scripts/bench-comparison.js`. Méthodologie reproductible : voir section *Méthodologie* en fin de page.

## Synthèse

Les métriques AIAD-SDD sont **mesurées** sur la machine de release. Les colonnes *Spec Kit (documenté)* et *Kiro (documenté)* renseignent les caractéristiques **publiquement documentées** par leurs auteurs respectifs (sans benchmark exécuté ici — environnements et stacks différents).

| Métrique | AIAD SDD (mesuré) | Spec Kit (documenté) | Kiro (documenté) | Cursor Memory Bank |
|----------|-------------------|----------------------|------------------|--------------------|
| Cold-start CLI | **41.1 ms / 41.8 ms / 42.0 ms / 42.0 ms (3 runs)** | *non publié* | *non publié* | N/A (in-IDE) |
| Init projet (zero-dep) | **54.1 ms / 54.5 ms / 55.6 ms / 55.6 ms (3 runs)** | install requis (Python uv) | install Amazon Q + IDE | configuration manuelle |
| Scan trace 1k fichiers | **41.9 ms / 42.8 ms / 44.9 ms / 44.9 ms (3 runs)** | pas de scan trace natif | pas de scan trace natif | N/A |
| Doctor (--json) | **38.6 ms / 39.6 ms / 39.9 ms / 39.9 ms (3 runs)** | pas de commande doctor | pas de commande doctor | N/A |

Format des cellules AIAD : **min / médiane / p95 / max** sur N runs.

## Caractéristiques différenciantes (au-delà du temps)

| Capacité | AIAD SDD | Spec Kit | Kiro | Cursor MB |
|----------|:--------:|:--------:|:----:|:---------:|
| Zero-dep runtime | ✅ | ❌ (Python) | ❌ (Amazon Q) | N/A |
| Multi-runtime AGENTS.md/CLAUDE.md/.cursor/.codex/GEMINI | ✅ | ❌ | ❌ | ❌ |
| Drift Lock pre-commit hook | ✅ | ❌ | ❌ | ❌ |
| Matrice traçabilité Intent ↔ SPEC ↔ Code ↔ Tests | ✅ | ❌ | ❌ | ❌ |
| Format SARIF CodeQL natif | ✅ | ❌ | ❌ | ❌ |
| Agents gouvernance EU (RGPD/AI-ACT/CRA/RGAA/RGESN) | ✅ | ❌ | ❌ | ❌ |
| Audit AI Act (Annexe IV pré-rempli) | ✅ | ❌ | ❌ | ❌ |
| AIPD Article 35 RGPD pré-rempli | ✅ | ❌ | ❌ | ❌ |
| SBOM CycloneDX v1.5 généré | ✅ | ❌ | ❌ | ❌ |
| Reproducible build verification | ✅ | ❌ | ❌ | ❌ |
| Pack gouvernance sectoriel (DORA finance) | ✅ | ❌ | ❌ | ❌ |
| TUI interactive zero-dep | ✅ | ❌ | ✅ | ❌ |
| Migration auto Spec Kit / Kiro → .aiad/ | ✅ | N/A | N/A | N/A |
| Tests automatisés du framework | ✅ 540+ | partial | inconnu | N/A |

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
- Les *X* ✅ sont vérifiables ligne par ligne dans la documentation officielle de chaque outil au 2026-05-10.

### Reproduire localement

```bash
git clone https://github.com/everssteeve/sdd-mode
cd sdd-mode
node scripts/bench-comparison.js --runs 10 --files 1000
# → bench/comparison.md régénéré
```

---

*Document régénéré le 2026-05-10 par `scripts/bench-comparison.js`. Modifications hors mesures préservées en 
section "Caractéristiques différenciantes" (à éditer manuellement entre releases).*
