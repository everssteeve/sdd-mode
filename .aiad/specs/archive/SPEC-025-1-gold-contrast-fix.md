---
id: SPEC-025-1
title: Correction du contraste --gold-600 (.kicker + .pill.gold)
parent_intent: INTENT-025
status: archived
format: EARS
sqs: 5
author: Steeve Evers
date: "2026-06-22"
traceability: exempt
traceability_reason: "Livrable CSS/JSON uniquement (site/assets/css/main.css, .pa11yci.json) — extensions non scannées par EXTENSIONS_CODE. Ratios vérifiés par calcul WCAG (6.72:1 blanc, 5.83:1 #fbeecd). Gate CI validera à la PR."
archivedAt: "2026-06-24T07:17:03.728Z"
archivedBy: evers.steeve@gmail.com
archivedReason: archive done
---
# SPEC-025-1 — Correction du contraste `--gold-600` (`.kicker` + `.pill.gold`)

**Intent parent** : INTENT-025
**Auteur** : Steeve Evers
**Date** : 2026-06-22
**Statut** : done (trace-exempt)
**Format** : EARS
**SQS** : 5/5

---

> **Proportionnalité §3.5** : La phase Research formelle est court-circuitée. Le Discovery est
> assuré par FACT-005 (ancrage `site/assets/css/main.css:17` + `.pa11yci.json`), la candidate
> `#7e5300` est validée par calcul de ratio (6.0:1 / 5.3:1), et la portée se réduit à 2 lignes.
> Décision tracée ici conformément à la doctrine de proportionnalité.

---

## 1. Contexte

Le gate RGAA AA (SPEC-013-4b, pa11y-ci v4) signale que `--gold-600: #c5860f` viole WCAG 1.4.3
(ratio 4.5:1 requis pour texte < 18pt) dans deux contextes : `.kicker` (~2.9:1 sur blanc) et
`.pill.gold` (~2.6:1 sur `#fbeecd`). La violation est en allowlist temporaire depuis FACT-005.
L'objectif est de substituer la variable par `#7e5300` (6.0:1 / 5.3:1) et de vider l'allowlist.

## 2. Comportement Attendu

### Input

- `site/assets/css/main.css:17` — déclaration `--gold-600`
- `.pa11yci.json` — tableau `defaults.ignore`

### Processing

1. Remplacer la valeur de `--gold-600` : `#c5860f` → `#7e5300`.
2. Retirer l'entrée `"WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail"` du tableau `defaults.ignore`.
3. Laisser `defaults.ignore` vide (tableau `[]` ou clé absente).

### Output

- `main.css` : une seule ligne modifiée (`:17`).
- `.pa11yci.json` : `defaults.ignore` vide.
- Gate RGAA (CI / `npm run a11y`) : 0 violation sur les 57 pages.

### Cas limites

- **Autres usages de `--gold-600`** : aucun — la variable n'est référencée que sur `:356`
  (`.kicker`) et `:574` (`.pill.gold`). Risque de régression nul sur les autres règles.
- **`--gold-500` (`#e8a020`)** : non concerné par cette SPEC — usages distincts (bordures,
  boutons `btn-primary` sur fond `--navy-900`). Ne pas toucher.
- **Fond non-blanc d'un `.kicker`** : tous les `.kicker` recensés dans les 57 pages sont sur
  fond blanc (`background: #fff` ou hérité). Un `.kicker` sur fond coloré serait hors-scope ;
  signaler en PR review si découvert.

## 3. Critères d'Acceptation (EARS)

### CA-001 — Valeur de la variable CSS

> Pattern : Ubiquitous

`The CSS file \`site/assets/css/main.css\` SHALL define \`--gold-600\` with the value \`#7e5300\`.`

- [ ] Implémenté
- [ ] Testé : grep `--gold-600: #7e5300` dans `main.css`

### CA-002 — Ratio de contraste `.kicker` sur fond blanc

> Pattern : Ubiquitous

`The \`.kicker\` element SHALL display foreground text with a contrast ratio ≥ 4.5:1 against a white (\`#ffffff\`) background, as computed by the WCAG relative luminance formula.`

- [ ] Implémenté
- [ ] Testé : pa11y-ci audit `site/fr/index.html` — 0 violation 1.4.3

### CA-003 — Ratio de contraste `.pill.gold` sur fond `#fbeecd`

> Pattern : Ubiquitous

`The \`.pill.gold\` element SHALL display foreground text with a contrast ratio ≥ 4.5:1 against background \`#fbeecd\`, as computed by the WCAG relative luminance formula.`

- [ ] Implémenté
- [ ] Testé : pa11y-ci audit `site/fr/index.html` — 0 violation 1.4.3

### CA-004 — Gate RGAA CI sans allowlist

> Pattern : Event-driven

`WHEN pa11y-ci audits all 57 site pages with standard WCAG2AA and an empty \`defaults.ignore\`, the gate SHALL report 0 failures for criterion \`WCAG2AA.Principle1.Guideline1_4.1_4_3\`.`

- [ ] Implémenté
- [ ] Testé : `npm run a11y` exit 0 en CI

### CA-005 — Tableau `defaults.ignore` vide

> Pattern : Ubiquitous

`The \`.pa11yci.json\` configuration file SHALL define \`defaults.ignore\` as an empty JSON array (\`[]\`).`

- [ ] Implémenté
- [ ] Testé : `jq '.defaults.ignore | length == 0' .pa11yci.json` retourne `true`

## 4. Interface / API

```
Fichiers modifiés :
  site/assets/css/main.css       ligne 17  --gold-600: #7e5300;
  .pa11yci.json                  defaults.ignore: []

Aucun endpoint ni API exposé.
```

## 5. Dépendances

- SPEC-013-4b (gate RGAA opérationnel — prérequis satisfait)
- FACT-005 (Discovery source, ancrage fichier:ligne)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- Cette SPEC : ~400 tokens
- `site/assets/css/main.css` (extrait lignes 1-30 + 350-360 + 570-580) : ~150 tokens
- `.pa11yci.json` : ~50 tokens
- **Total estimé** : ~900 tokens

## 7. Definition of Output Done (DoOD)

- [ ] `main.css:17` : `--gold-600: #7e5300`
- [ ] `.pa11yci.json` : `defaults.ignore` vide
- [ ] `npm run a11y` exit 0 — 0 violation sur les 57 pages
- [ ] Vérification visuelle : `.kicker` et `.pill.gold` conservent une teinte ambrée/dorée
- [ ] **EARS lint : 0 violation** (skill `ears-validator`)
- [ ] `@spec SPEC-025-1-gold-contrast-fix` posé sur les lignes CSS modifiées
- [ ] `_index.md` + INTENT-025 mis à jour (statut → active, SPEC liée)
- [ ] Code review passée
- [ ] Gouvernance AIAD-RGAA vérifiée (veto levé si gate passe)
