# RESEARCH-023 — Dashboard quotidien : Aujourd'hui, triage, digest (INTENT-017)

**Intent parent** : INTENT-017
**Auteur** : Steeve Evers
**Date** : 2026-06-22
**Statut** : tranché — /sdd spec autorisé (C1, C2)

---

## Résumé exécutif

INTENT-016 a livré plus qu'attendu : 4 des 6 fonctionnalités INTENT-017 sont déjà
en place (`intent-page.js`, polling live, standup script, patterns snapshot).
L'étendue réelle se réduit à **3 composants nouveaux + 1 extension** (SPEC pages).

## Discovery

**Ancrage code — zones impactées :**

Ancrages code (`chemin:ligne`) :

- `lib/dashboard/render.js:1-112` — Architecture 4 couches + PAGES constant (INTENT-016 ✅)
- `lib/dashboard/collect.js:1-498` — Collecte artefacts `.aiad/` (✅)
- `lib/dashboard/model/index.js:1-306` — Orchestrateur 150+ calculateurs (✅)
- `lib/dashboard/standup-script.js:1-136` — Script standup auto (intégré `model/index.js:270` ✅)
- `lib/dashboard/intent-page.js:1-220` — Pages détail Intent (#453 ✅)
- `lib/dashboard/assets.js:734-789` — Live polling 30s (#140 ✅, polling pas SSE)
- `lib/dashboard/pm-diff.js` — Pattern delta snapshot (réutilisable pour digest ✅)
- `lib/dashboard/health-timeline.js` — Sparkline tendance (réutilisable ✅)
- `.aiad/metrics/pm-snapshots/` — Pattern snapshots quotidiens établi (✅)
- `.aiad/metrics/sante-globale/` — Pattern snapshots santé établi (✅)
- `test/dashboard-pm-v12.test.js` — Tests intent-page (#453 ✅)
- `test/dashboard.test.js` — Tests live polling (#140 ✅)
- `test/dashboard-pm-v38.test.js` — Tests standup script (#533 ✅)

Absent (à créer) :
- `lib/dashboard/today-page.js` — Page "Aujourd'hui" (~150 LOC)
- `lib/dashboard/inbox-triage.js` — Inbox triage (~200 LOC)
- `lib/dashboard/digest-delta.js` — Digest delta (~120 LOC)
- `lib/dashboard/spec-page.js` — Pages détail SPEC (pattern `intent-page.js` à étendre)

**Tests existants :**
- `test/dashboard-pm-v12.test.js` — intent-page (#453)
- `test/dashboard.test.js` — live polling (#140)
- `test/dashboard-pm-v38.test.js` — standup script (#533)
- `test/standup-url.test.js` — CLI standup focus

## Faisabilité

Réalisable dans l'architecture 4 couches existante. Chaque composant suit le même
pattern : calcul pur dans `model/`, rendu dans `views/`, export depuis `render.js`.
Coût estimé : 470 LOC + 40-50 tests.

## Risques & Inconnues

**R1 — RGESN conflit polling vs SSE**
`assets.js:734` est documenté "Mode live SSE" mais implémente du polling 30s.
AIAD-RGESN interdit le polling quand SSE est faisable. Le dashboard est statique-généré
(contrainte INTENT-016) — SSE nécessiterait un backend.
→ **Résolu par C2** : polling confirmé, exception RGESN à documenter explicitement dans la SPEC.

**R2 — Inbox triage : persistance client**
Actions accept/defer sans backend = persistance côté client uniquement.
→ **Résolu par C1** : localStorage retenu (état local navigateur, non partageable entre sessions).

**R3 — `model/index.js` complexité (150+ calculateurs)**
Chaque composant ajoute une dépendance. Documenté, non bloquant.

**R4 — Dette SPEC-pages**
`intent-page.js` réutilisable mais non dédupliqué avec une future `spec-page.js`.
À traiter dans la SPEC correspondante.

## Conditions (si CONDITIONAL GO)

- **C1** — L'inbox triage utilise **localStorage** pour la persistance accept/defer (état local
  navigateur, non partageable entre sessions). La limitation doit être documentée explicitement
  dans la SPEC (lève R2).
- **C2** — Le mode live reste **polling 30s** (zéro dépendance, compatible file://). L'exception
  RGESN (polling vs SSE) est justifiée par la contrainte statique-généré d'INTENT-016 et doit
  être documentée en entête de SPEC-017-5 avec tag `@governance AIAD-RGESN` (lève R1).

## Verdict : CONDITIONAL GO (confidence: 90 %)

Tranché par : Steeve Evers — 2026-06-22

## Suite

`/sdd spec INTENT-017` autorisé — conditions C1 et C2 à lever en SPEC avant `/sdd exec`.

SPECs recommandées (4 au lieu de 6 — 2 fonctionnalités déjà livrées) :
- SPEC-017-1 — Page "Aujourd'hui" (radiator ≤ 4 sections)
- SPEC-017-2 — Inbox de triage facts/drifts (localStorage accept/defer)
- SPEC-017-3 — Digest delta + snapshots persistants
- SPEC-017-4 — Pages détail SPEC (extension pattern intent-page)
