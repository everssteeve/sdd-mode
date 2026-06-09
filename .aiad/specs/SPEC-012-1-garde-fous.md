---
id: SPEC-012-1
title: Garde-fous de conception — doctrine + proportionnalité + grill-me + sunset (§4)
parent_intent: INTENT-012
status: in-progress
format: prose
sqs: 4.0
author: Steeve Evers
date: 2026-06-09
---

# SPEC-012-1 — Garde-fous de conception

**Intent parent** : INTENT-012
**SQS** : 4.0 / 5
**Statut** : in-progress

## Objectif

Inscrire et outiller les 5 garde-fous transverses qui bornent la roadmap (anti sur-ingénierie, alignement sur l'évolution des modèles).

## Implémentation

- **GF1/GF2 (doctrine)** — section « SDD = agentic engineering formalisé » dans `README.md` (Human Authorship + Verifiability) ; checklist de revue GF1–GF5 dans `CONTRIBUTING.md` (dont GF2 : aucun code sans Discovery préalable).
- **GF3 (proportionnalité)** — `lib/proportionality.js` : `evaluerPoids` (light par défaut ; heavy sur signaux de risque sécurité/paiement/RGPD/conformité ; `weight:` humain prime), `evaluerIntent`. CLI `aiad-sdd proportionality <INTENT-id>`. Référencé dans `/sdd research`.
- **GF4 (grill-me)** — skill `templates/.claude/skills/grill-me/SKILL.md` (une question/tour + recommandation, paternité humaine) + helper pur `lib/grill.js` (`prochaineQuestion`, `grillComplet`, `rendreQuestion`). Référencé dans `/sdd gate --guided` + `/sdd research --guided`.
- **GF5 (sunset)** — `lib/sunset.js` : `comparerVersions`, `estCandidate`, `scannerSunset` (skills + rules + gouvernance avec `sunset_when`/`review_at`). CLI `aiad-sdd sunset [--at vX.Y.Z]` + check `info` dans `lib/doctor.js`. La skill grill-me porte elle-même `review_at`/`sunset_when` (auto-référence).

## Critères d'acceptation

1. the system SHALL documenter le positionnement « agentic engineering » (GF1) et la checklist GF1–GF5 (GF2).
2. WHERE un Intent touche un domaine à risque, the system SHALL recommander le chemin lourd ; WHERE il est simple/réversible, le chemin léger (GF3). Un `weight:` humain SHALL primer.
3. WHEN un gate s'exécute en `--guided`, the system SHALL poser une question à la fois en proposant une réponse recommandée (GF4, via `lib/grill.js`).
4. the system SHALL marquer les règles/skills d'une métadonnée d'obsolescence et signaler les candidates (`aiad-sdd sunset`, `doctor`) (GF5).
5. Aucune régression : la suite complète passe (`npm test`).

## Vérification

- `test/proportionality.test.js` (9 ✓) + `test/sunset.test.js` (8 ✓) + `test/grill.test.js` (8 ✓). Suite complète `npm test` ; lint · esm · size verts.

## Hors périmètre

- Câblage dur de la proportionnalité dans toutes les commandes (recommandation + override humain).
- Réécriture de `frameworkAIAD.md`.
