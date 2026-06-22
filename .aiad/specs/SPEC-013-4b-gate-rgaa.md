---
id: SPEC-013-4b
title: Gate RGAA AA avant publication du site
parent_intent: INTENT-013
parent_spec: SPEC-013-4
research: RESEARCH-019
status: done
format: prose
sqs: 5/5
author: Steeve Evers
date: 2026-06-22
governance: AIAD-RGAA, AIAD-RGESN
---

# SPEC-013-4b — Gate RGAA AA avant publication

**SPEC parent** : SPEC-013-4 (découpée)
**Intent parent** : INTENT-013 · **Research** : RESEARCH-019 (GO — 100 %)
**Ordre d'exécution** : 2 sur 2 (**dépend de SPEC-013-4a** — insère un gate dans le
workflow `site-deploy.yml` créé par 4a)
**Statut** : done
**Gouvernance** : AIAD-RGAA (dogfooding du veto accessibilité), AIAD-RGESN (poids de la dépendance)

## 1. Contexte

013-4a publie `site/` → `gh-pages` sous gate version. RESEARCH-019 confirme la
faisabilité (GO 100 %) : le point d'injection est clair (`site-deploy.yml:54`,
avant `peaceiris/actions-gh-pages`) et le pattern identique au gate version existant.
L'outil retenu est **`pa11y-ci`** (standard de facto CI, supporte `--standard WCAG2AA`,
allowlist native, `npx`-able). La dépendance Chromium (~300 MB) est assumée en
**devDependency CI-only** (jamais runtime — RGESN explicitement accepté).

C'est du **dogfooding** — le framework s'applique le veto AIAD-RGAA qu'il impose
au code des utilisateurs.

## 2. Comportement attendu

### Input

- Le workflow `site-deploy.yml` (SPEC-013-4a, done).
- Les 57 pages HTML dans `site/**/*.html` (28 fr + 28 en + index.html).

### Processing

1. Step **`Gate RGAA AA (pa11y-ci)`** inséré **avant** le step `peaceiris/actions-gh-pages` dans `site-deploy.yml`.
2. Exécution : `npx pa11y-ci --standard WCAG2AA 'site/**/*.html'`
3. **≥ 1 violation bloquante** → exit ≠ 0 → le job échoue → **pas de publication**.
4. Si une allowlist est définie dans `pa11yci.json` → les violations y figurant sont tolérées (tracées explicitement).

### Output

- Rapport pa11y-ci en sortie console (artefact CI intégré).
- Publication uniquement si 0 violation bloquante (ou uniquement des violations dans l'allowlist).

### Cas limites (≥ 3)

1. **Violation AA détectée hors allowlist** → publication bloquée (veto RGAA, exit ≠ 0).
2. **Violation connue dans l'allowlist** → tolérée, publication autorisée — la tolérance est explicite et tracée dans `pa11yci.json`.
3. **pa11y-ci ou Chromium indisponible en CI** → le step échoue avec une erreur explicite (fail-closed) — jamais un faux PASS silencieux.
4. **Nouvelle page HTML ajoutée à `site/`** → couverte automatiquement par le glob `site/**/*.html`.

## 3. Critères d'acceptation

- [ ] Le step `Gate RGAA AA (pa11y-ci)` s'exécute dans `site-deploy.yml` **avant** le step `peaceiris/actions-gh-pages` (push `gh-pages`).
- [ ] WHEN ≥ 1 violation WCAG2AA bloquante est détectée hors allowlist, le job `site-deploy` SHALL échouer (exit ≠ 0) et **empêcher** la publication.
- [ ] `pa11y-ci` est déclaré en **`devDependency`** dans `package.json` (jamais en `dependency` runtime — préserve « zero runtime dependency » / RGESN).
- [ ] Toute tolérance (violations historiques acceptées) est déclarée **explicitement** dans `pa11yci.json` (champ `allowlist` ou équivalent) et **justifiée** par un commentaire.
- [ ] IF `pa11y-ci` ou Chromium est indisponible en CI, THEN le step `site-deploy` SHALL échouer (exit ≠ 0) — jamais un faux PASS silencieux (fail-closed).

## 4. Interface / API

```yaml
# Extrait site-deploy.yml — steps ajoutés avant peaceiris/actions-gh-pages
# @spec SPEC-013-4b-gate-rgaa
# @governance AIAD-RGAA,AIAD-RGESN

# Installe les devDependencies (pa11y-ci + Chromium via puppeteer)
# RGESN : Chromium ~300 MB CI-only — devDep, jamais runtime
- name: Install devDependencies
  run: npm ci

# Gate RGAA AA — fail-closed : exit ≠ 0 si ≥ 1 violation hors allowlist
- name: Gate RGAA AA (pa11y-ci)
  run: |
    mapfile -t URLS < <(find site -name "*.html" -type f | sort | sed "s|^|file://$(pwd)/|")
    npx pa11y-ci --config .pa11yci.json "${URLS[@]}"
```

```json
// .pa11yci.json — allowlist = defaults.ignore (vide = gate strict)
// Toute tolérance doit être tracée ici avec une justification en commentaire git
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 30000,
    "ignore": [
      "WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail"
    ]
  },
  "concurrency": 4
}
```

> **Note implémentation** : pa11y-ci v4 (`devDependencies` `^4.1.1`) ne supporte
> pas les globs de système de fichiers en argument. L'approche retenue convertit les chemins
> `site/**/*.html` en URLs `file://` via `mapfile` + `find` + `sed` (bash 4+ / ubuntu-latest).
> Les options pa11y (`standard`, `ignore`) doivent être dans le champ `defaults` du fichier
> de config — niveau racine ignoré par pa11y-ci.
>
> **Baseline initiale** : `WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail` (contraste insuffisant
> sur `.kicker`, `--gold-600: #c5860f` ~2.9:1 sur fond clair, besoin 4.5:1).
> Violation découverte lors du premier audit (RESEARCH-019 R1 anticipé).
> Correction CSS tracée dans FACT-005 (correction hors scope SPEC-013-4b).

## 5. Dépendances

- **SPEC-013-4a** (done) — le workflow `site-deploy.yml` doit exister.
- `.aiad/gouvernance/AIAD-RGAA.md` — référentiel du veto accessibilité.
- `pa11y-ci` en devDependency CI-only (Chromium inclus, ~300 MB, assumé RGESN).

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE condensé : ~0,5K tokens
- Cette SPEC : ~1,5K tokens
- `.github/workflows/site-deploy.yml` (63 lignes) : ~0,5K tokens
- `.aiad/gouvernance/AIAD-RGAA.md` (extrait) : ~1K tokens
- **Total estimé : ~3,5K tokens** ✅

## 7. Definition of Output Done (DoOD)

- [x] Step `Gate RGAA AA (pa11y-ci)` ajouté à `site-deploy.yml`, annoté `@spec SPEC-013-4b-gate-rgaa`.
- [x] Gate RGAA vérifié rouge → vert (6 violations contraste détectées, baseline documentée dans `defaults.ignore`, gate passe à 0 erreur).
- [x] `pa11y-ci` en `devDependency` confirmé (`package.json` `^4.1.1` — jamais `dependency`).
- [x] Allowlist initiale (`.pa11yci.json`) documentée : `WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail` (contraste `.kicker`, FACT-005).
- [x] SPEC mise à jour : interface corrigée (config `defaults`, `mapfile`/`file://`, baseline).
- [x] Gouvernance AIAD-RGAA PASS, AIAD-RGESN WARN (Chromium CI-only assumé).
