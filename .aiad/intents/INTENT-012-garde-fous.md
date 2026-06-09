---
id: INTENT-012
title: Garde-fous de conception — doctrine + proportionnalité + grill-me + sunset (§4)
status: active
author: Steeve Evers
date: 2026-06-09
specs: SPEC-012-1
---

# INTENT-012 — Garde-fous de conception

## Pourquoi

Les §3.1→§3.13 sont des évolutions mécaniques. Les garde-fous §4 sont la **philosophie qui les borne** (convergence Karpathy/Dex/Matt/Boris) : sans eux, on risque de sur-ingénierer (contre « léger par défaut ») ou de construire un échafaudage que le prochain modèle rendra inutile. Ce ne sont pas des features mais des **critères de conception transverses** + leur ancrage.

## Intention

Inscrire dans la doctrine SDD et outiller cinq garde-fous : (GF1) SDD = agentic engineering formalisé (Human Authorship + Verifiability), (GF2) code en boucle (Discovery obligatoire, §3.5), (GF3) léger par défaut / lourd si l'ambiguïté coûte cher, (GF4) gate humain interactif « grill me » (une question + recommandation), (GF5) règles à durée de vie limitée (se relire à chaque montée de version).

## Périmètre

- **SPEC-A** — doctrine GF1/GF2 (README, CONTRIBUTING checklist) + skill `grill-me` (GF4) + helper `lib/grill.js`.
- **SPEC-B** — proportionnalité GF3 (`lib/proportionality.js` + CLI) + métadonnée d'obsolescence GF5 (`lib/sunset.js` + CLI + check `doctor`).

## Hors périmètre

- Câblage dur de la proportionnalité dans toutes les commandes (recommandation consommée par `/sdd research`/`exec` — l'humain garde l'override).
- Réécriture de `frameworkAIAD.md` (la doctrine GF1 est portée par README + CONTRIBUTING).
