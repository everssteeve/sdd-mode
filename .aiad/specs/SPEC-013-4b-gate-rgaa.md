---
id: SPEC-013-4b
title: Gate RGAA AA avant publication du site
parent_intent: INTENT-013
parent_spec: SPEC-013-4
research: RESEARCH-014
status: draft
format: prose
sqs: À évaluer via /sdd gate
author: Steeve Evers
date: 2026-06-11
governance: AIAD-RGAA, AIAD-RGESN
---

# SPEC-013-4b — Gate RGAA AA avant publication

**SPEC parent** : SPEC-013-4 (découpée)
**Intent parent** : INTENT-013 · **Research** : RESEARCH-014 (CONDITIONAL GO)
**Ordre d'exécution** : 2 sur 2 (**dépend de SPEC-013-4a** — insère un gate dans le
workflow `site-deploy.yml` créé par 4a)
**Statut** : draft
**Gouvernance** : AIAD-RGAA (dogfooding du veto accessibilité), AIAD-RGESN (poids de la dépendance)

> ⚠ **Réserve héritée de la Gate 013-4 (Non-ambiguïté)** — à trancher en
> `/sdd research`/`/sdd gate` avant exec :
> 1. **Outil + config** : pa11y-ci vs axe-core, ruleset RGAA AA, stratégie de
>    baseline (un « 0 violation » strict sur 64 pages peut exiger un allowlist initial).
> 2. **Dépendance lourde** : pa11y/axe tirent **Chromium** — tension avec
>    « zero runtime dependency » et AIAD-RGESN. À assumer en **devDependency
>    CI-only** (jamais en dépendance runtime) ou à alléger.
>
> Cette SPEC reste `draft` tant que ces points ne sont pas tranchés — possible
> `/sdd research` dédié (faisabilité AA-zéro + choix d'outil) avant de la gater.

## 1. Contexte

013-4a publie `site/` → `gh-pages` sous gate version. RESEARCH-014 (C-R3) exige
aussi un **gate accessibilité** : ne jamais publier une page non conforme RGAA AA.
C'est du **dogfooding** — le framework s'applique le veto AIAD-RGAA qu'il impose au
code des utilisateurs. Le gate accessibilité est isolé ici car il introduit une
dépendance lourde et une incertitude de faisabilité absentes de 4a.

## 2. Comportement attendu

### Input
- Le workflow `site-deploy.yml` (013-4a) + les pages `site/**/*.html`.

### Processing
1. Step d'audit **RGAA AA** inséré **avant** la publication dans `site-deploy.yml`.
2. Outil retenu (cf. réserve) exécuté sur les pages de `site/`.
3. **≥ 1 violation bloquante** → échec du job → **pas de publication**.

### Output
- Rapport d'accessibilité (artefact CI). Publication uniquement si 0 violation bloquante.

### Cas limites (≥ 3)
1. **Violation AA détectée** → publication bloquée (veto RGAA).
2. **Baseline/allowlist** : violations historiques connues non régressives →
   tolérées via allowlist explicite et tracée (sinon AA-zéro irréaliste d'emblée).
3. **Indisponibilité de l'outil** (Chromium absent en CI) → échec **explicite**
   du gate (jamais un faux PASS silencieux — fail-closed, cohérent AIAD-RGAA).
4. **Page ajoutée sans audit** → le glob `site/**/*.html` couvre les nouvelles pages.

## 3. Critères d'acceptation

- [ ] Un step d'audit RGAA AA s'exécute dans `site-deploy.yml` **avant** la
      publication (push `gh-pages`).
- [ ] **≥ 1 violation AA bloquante** fait échouer le job et **empêche** la publication.
- [ ] L'outil d'accessibilité est une **devDependency CI-only** (pas une dépendance
      runtime — préserve « zero runtime dependency » / RGESN).
- [ ] Toute tolérance (allowlist de violations historiques) est **explicite et tracée**.
- [ ] Indisponibilité de l'outil → échec **fail-closed** (pas de publication, pas de faux PASS).

## 4. Interface / API

```yaml
# step inséré dans site-deploy.yml (avant peaceiris/actions-gh-pages)
- run: npx <pa11y-ci|axe-core> site/**/*.html   # outil tranché en réserve
```

## 5. Dépendances

- **SPEC-013-4a** (le workflow `site-deploy.yml` doit exister).
- `.aiad/gouvernance/AIAD-RGAA.md` (référentiel du veto).
- Outil d'accessibilité (devDependency CI-only — à choisir, cf. réserve).

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE condensé ~0,5K · SPEC ~1,2K · AIAD-RGAA (extrait) ~1K → **~2,7K** ✅

## 7. Definition of Output Done (DoOD)

- [ ] Step RGAA ajouté à `site-deploy.yml`, annoté `@spec SPEC-013-4b-...`.
- [ ] Gate RGAA vérifié rouge→vert (page non conforme simulée → blocage).
- [ ] Outil en devDependency CI-only confirmé (RGESN).
- [ ] Allowlist initiale (si nécessaire) documentée et justifiée.
- [ ] SPEC mise à jour si écart (Drift Lock).
