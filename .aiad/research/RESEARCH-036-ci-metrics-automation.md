# RESEARCH-036 — Automatisation CI de la collecte de métriques DORA/Flow

**Intent parent** : INTENT-027
**Auteur** : Steeve Evers
**Date** : 2026-06-29
**Statut** : tranché — CONDITIONAL GO (85 %) · C-strict validated_at · backfill hors-périmètre

---

## Discovery

Zones cartographiées par agent Explore (read-only, ancrages `chemin:ligne`) :

- `lib/dora-record.js:27-62` — `recordDeployment()` : écrit `- cycle_time_days: N` si `input.cycleTimeDays` est fourni. API déjà compatible, aucune modification requise.
- `lib/dora-record.js:50-52` — écriture effective du champ `cycle_time_days` dans le fichier Markdown déploiement.
- `lib/dora-record.js:141-143` — calcul existant `(tagN - tagN-1) / 86400000` dans `importDeploysFromGit()` — même logique à adapter pour la stratégie C.
- `lib/dashboard/collect.js:418-432` — `parserKv()` : regex tolérante `^\s*-?\s*KEY:\s*VALUE` — compatible avec le format écrit par `recordDeployment()`.
- `lib/dashboard/collect.js:480-481` — agrégation `cycle_time_days` : `deps.map(d => Number(d.cycle_time_days)).filter(x => !isNaN(x))` — dès que les fichiers auront le champ, Cycle Time et Flow Efficiency sont calculés automatiquement.
- `bin/aiad-sdd.js:3597` — dispatch CLI `dora --record` : flag `--cycle` optionnel, `values.cycle → cycleTimeDays`.
- `.github/workflows/site-deploy.yml:71` — condition `if: github.event_name == 'push'` : déploiement gh-pages sur push `main` + `site/**`. Aucune étape DORA record aujourd'hui.
- `.github/workflows/release.yml:47` — `npm publish --provenance` sur push tag `v*`. Aucune étape DORA record aujourd'hui.
- `test/dora-record.test.js:39-58` — test unitaire `recordDeployment({ cycleTimeDays: 4.5 })` — passe. Calcul automatique non couvert.
- `scripts/lint-deps.js:41-59` — enforcement zero-dep runtime : bloque tout `dependencies` non vide.
- `.aiad/metrics/deployments/2026-06-23-site-valeur-outcomes.md:1-12` — exemple des 7 fichiers existants : YAML frontmatter, `lead_time_days: 12`, `cycle_time_days` absent.

**Champ `validated_at`** : absent du frontmatter SPEC actuel (seul `archivedAt` est présent — `lib/frontmatter.js:1-163`). Stratégie C-strict requiert de le stamper lors de `/sdd validate`.

---

## Faisabilité

Très haute. Toute l'infrastructure est en place : API write, CLI, parser, agrégation, deux triggers CI identifiés. Code à écrire :
1. Fonction `calculateCycleTimeDaysFromSpec()` dans `lib/` (≈ 30 lignes `node:child_process` + `node:fs`)
2. Stamp `validated_at` dans `/sdd validate` (frontmatter SPEC)
3. Step post-deploy dans `site-deploy.yml` et `release.yml` (≈ 5 lignes YAML chacun)
4. Test unitaire pour la fonction de calcul

Coût estimé : faible (1 SPEC, ~2h d'exécution agent).

---

## Risques & inconnues

- R1 : `validated_at` absent des SPECs actuelles → sous-objectif à inclure explicitement dans la SPEC-027 (C-strict)
- R2 : Format hétérogène des 7 fichiers existants (YAML frontmatter sans `cycle_time_days`) → hors-périmètre, pas de backfill
- R3 : `site-deploy.yml` ne pousse pas de tag Git → le calcul doit lire `validated_at` depuis la SPEC active, pas depuis les tags

---

## Verdict

Verdict : CONDITIONAL GO
Auteur du verdict : Steeve Evers
Confidence : 85 %

## Conditions

- [x] C1 — Stratégie choisie : C (`validated_at` SPEC active → deploy)
- [x] C2 — Variante C-strict : `/sdd validate` stampe `validated_at` dans le frontmatter SPEC
- [x] C3 — Backfill des 7 fichiers existants : hors-périmètre
