---
id: RESEARCH-019
title: Gate RGAA AA avant publication du site aiad.ovh
intent: INTENT-013
spec: SPEC-013-4b
author: Steeve Evers
date: 2026-06-22
verdict: GO
confidence: 100
status: tranché — /sdd spec autorisé
---

# RESEARCH-019 — Gate RGAA AA avant publication

**Intent parent** : INTENT-013 · **SPEC cible** : SPEC-013-4b (draft)
**Contexte** : levée des réserves héritées de la gate 013-4 (outil + Chromium)

---

## Discovery (ancrages code obligatoires)

### Zone 1 — Workflow de déploiement existant (cible de modification)

| Ancrage | Fait |
|---------|------|
| `.github/workflows/site-deploy.yml:49-50` | Gate version actuelle : `node bin/aiad-sdd.js version-sync --check` — bloque la publication si écart de version. **Modèle à reproduire pour le gate RGAA.** |
| `.github/workflows/site-deploy.yml:54-62` | Publication gh-pages (`peaceiris/actions-gh-pages@v4`), conditionnée à `push` ou `workflow_dispatch`. **Point d'injection du gate RGAA : entre ligne 50 et 54.** |
| `.github/workflows/site-deploy.yml:8` | Commentaire doc : *"Le gate RGAA AA est ajouté par SPEC-013-4b"* — l'intention est déjà tracée dans le code. |
| `.github/workflows/site-deploy.yml:28-29` | Permissions : `contents: write` uniquement. L'outil a11y ne requiert que la lecture — aucune permission supplémentaire nécessaire. |
| `.github/workflows/site-deploy.yml:44` | Node 22 — tous les outils d'audit a11y courants sont compatibles. |

### Zone 2 — Absence totale d'outillage a11y

| Ancrage | Fait |
|---------|------|
| `package.json:36-54` | Zéro dépendance a11y (`pa11y`, `axe`, `lighthouse`, `accessibility` — aucune). |
| Dépôt entier | Aucun fichier `.pa11yrc*`, `pa11y.config.*`, `axe.config.*`, `.lighthouse*` trouvé. |

### Zone 3 — Site cible de l'audit

| Ancrage | Fait |
|---------|------|
| `site/index.html:1-36` | Entrée du site (redirection FR/EN). |
| `site/fr/*.html` | 28 pages HTML (fr + sous-dossiers `commandes/`, `concepts/`, `equipe/`, `gouvernance/`). |
| `site/en/*.html` | 28 pages HTML (structure identique). |
| Total | **57 fichiers HTML** couverts par le glob `site/**/*.html`. |

### Zone 4 — Gouvernance (référentiel veto)

| Ancrage | Fait |
|---------|------|
| `.aiad/gouvernance/AIAD-RGAA.md:1-30` | Contexte légal RGAA 4.1.2 / EAA (applicable depuis 28 juin 2025). Règles absolues : HTML sémantique, ARIA, contraste AA, navigation clavier, alternatives textuelles. |
| `.aiad/specs/SPEC-013-4b-gate-rgaa.md:64-72` | Critères d'acceptation déjà rédigés dans le draft (fail-closed, devDep CI-only, allowlist explicite). |

### Zone 5 — Dépendance SPEC-013-4a (résolue)

| Ancrage | Fait |
|---------|------|
| `.github/workflows/site-deploy.yml` | SPEC-013-4a est **done** : le workflow existe et fonctionne en production. La dépendance est levée. |

---

## Faisabilité

**Faisable avec l'architecture actuelle.** Le pattern est identique au gate version : un step `run:` inséré avant la publication, qui retourne exit ≠ 0 si violation détectée. La structure du workflow est simple (1 job, 4 steps).

**Coût estimé** : 1 step YAML + 1 config d'outil (~20 lignes) + mise à jour `package.json` (devDep CI-only). Effort : demi-journée.

**Alternatives architecturales évaluées :**

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| **pa11y-ci** (recommandé) | Standard de facto CI, supporte `--standard WCAG2AA` (mapping RGAA 4.1), sortie JSON/HTML, allowlist native, npx-able | Chromium ~300 MB (Puppeteer) |
| **@axe-core/cli** | Plus léger, axe-core bien maintenu | Requiert aussi Chromium pour les pages HTML statiques |
| **htmlcs (HTML_CodeSniffer)** | Zéro Chromium (headless Node) | Maintenance ralentie, couverture WCAG plus ancienne |
| **Lighthouse CI** | Rapport riche, intégration GitHub | Sur-spécifié pour ce besoin, plus lourd à configurer |

**Recommandation outil** : `pa11y-ci` — standard le plus utilisé pour CI/static HTML, supporte `WCAG2AA` (standard le plus proche du RGAA 4.1 en détection automatique, ~50-60 % des critères RGAA 4.1 sont mécaniquement vérifiables).

---

## Risques & inconnues

| # | Risque | Probabilité | Impact | Mitigation |
|---|--------|-------------|--------|------------|
| R1 | **Violations AA initiales** sur les 57 pages (jamais auditées) — le gate bloque d'emblée si strict à 0 | Moyen | Bloquant (gate rouge dès le départ) | Lancer l'audit une fois manuellement avant d'activer le gate ; documenter les violations dans une allowlist initiale tracée |
| R2 | **Dépendance Chromium** (~300 MB) en CI — tension RGESN (écoconception) | Certain | Acceptable (CI-only, pas runtime) | Assumer explicitement en tant que devDep CI-only et documenter le trade-off dans la SPEC |
| R3 | **RGAA 4.1 ≠ WCAG 2.1 AA** — pa11y audite WCAG, pas le référentiel RGAA directement | Faible | Partiel | Accepter que l'automatisation couvre ~50-60 % des critères RGAA 4.1 ; les 40 % restants (ex. simplification du langage) restent humains |
| R4 | **57 pages × Chromium** = temps CI non négligeable (potentiellement 3-5 min) | Faible | Acceptable | pa11y-ci parallélise par défaut (`--concurrency` réglable) |

**Inconnues qui nécessitent une décision humaine :**

```
TODO-JNSP: Quel niveau de rigueur initial ?
  (A) Gate strict à 0 violation (exige audit préalable + allowlist initiale si nécessaire)
  (B) Gate avec seuil tolérant (ex. 0 violation de niveau CRITICAL uniquement)
  (C) Gate en mode warn-only d'abord (rapport sans blocage), puis passer en fail-closed après baseline
```

---

## Verdict humain requis

Vu le Discovery et les risques :

> **GO** : la faisabilité est confirmée, le point d'injection est clair (`.github/workflows/site-deploy.yml:54`), la dépendance 4a est résolue. La seule inconnue ouverte est le niveau de rigueur initial du gate (R1). On peut gater quand même et gérer l'allowlist à l'exec.
>
> **CONDITIONAL GO** : on spécifie, mais ces conditions doivent être levées avant exec :
> - C1 : outil retenu (pa11y-ci recommandé ou alternative)
> - C2 : niveau de rigueur initial tranché (strict 0 / CRITICAL uniquement / warn-only)
> - C3 : acceptation explicite Chromium CI-only (RGESN)
>
> **DEFER** : reporter à une iteration ultérieure (INTENT-013 est déjà `done` — cette SPEC est un renforcement non bloquant).
>
> **NO-GO** : abandonner — le gain accessibilité ne justifie pas l'effort (Chromium, maintenance, false positives).

**Quel est ton verdict ? (GO / CONDITIONAL GO / DEFER / NO-GO) et ta confiance (0-100 %) ?**

Pour CONDITIONAL GO, confirme les conditions C1/C2/C3 ci-dessus ou modifie-les.

---

## Conditions (à renseigner si CONDITIONAL GO)

<!-- L'humain remplit cette section -->

## Verdict final (Human Authorship)

Verdict : GO (confidence: 100 %)
Auteur : Steeve Evers — 2026-06-22
