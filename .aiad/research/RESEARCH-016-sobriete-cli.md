# RESEARCH-016 — Sobriété du CLI (noyau assumé, longue traîne extraite)

**Intent parent** : INTENT-015
**Auteur** : Steeve Evers
**Date** : 2026-06-16
**Statut** : tranché — /sdd spec autorisé (C1, C2, C3)

---

## Discovery (ancrage code obligatoire)

> Cartographie produite par un agent Explore read-only le 2026-06-16. Ancrages `chemin:ligne` réels.

**Inventaire des commandes CLI**

- Registre unique : `bin/aiad-sdd.js` (switch de **85 cases**, `bin/aiad-sdd.js:589-3599`).
- Liste de validité : `bin/aiad-sdd.js:3585-3593` (`COMMANDES_VALIDES`).
- Aide concaténée en string (≈69 commandes « publiques ») : `bin/aiad-sdd.js:318-495` — **pas** de structure `{core, extended, experimental}`.
- Longue traîne citée par l'intent — **toutes existantes et testées**, hardcodées inline :
  - `obsidian` (`bin/aiad-sdd.js:888`, `test/obsidian-export.test.js`)
  - `storybook` (`bin/aiad-sdd.js:1614`, `test/storybook.test.js`)
  - `cert` (`bin/aiad-sdd.js:1493`)
  - `marketplace` (`bin/aiad-sdd.js:1470`)
  - `tour` (`bin/aiad-sdd.js:2425`)
  - `repl` (`bin/aiad-sdd.js:809`, `test/repl.test.js`)

**Slash-commands Claude Code**

- `/sdd` : 17 sous-commandes (`.claude/sdd/*.md`).
- `/aiad` : 16 sous-commandes (`.claude/aiad/*.md`).
- Chaque corps porte un rôle explicite → catégorisation core/extended directement mappable.

**Télémétrie d'usage existante (enabler majeur)**

- `lib/telemetry.js` : **opt-in explicite**, anonyme (UUID v4 local), données minimales `{command, version, runtimes}`, fail-safe, réversible. Désactivée par défaut.
- Stockage : `~/.aiad-sdd/telemetry.json` (état) + `~/.aiad-sdd/events.jsonl` (log local).
- Hook d'appel : `bin/aiad-sdd.js:576-586` — `telemetryTrack('command_run', …)` à chaque commande sauf `telemetry`.
- `lib/feedback.js` : consentement distinct, feedback qualitatif (GitHub Issues).
- **Limite** : l'event log ne distingue pas encore l'agrégat per-command (heavy vs rare) — c'est l'extension à spécifier, pas une infra à créer.

**Garde-fous enforced vs advisory (dispersés, non documentés en matrice)**

- Hooks `.aiad/hooks/` : `veto.js` (**enforced**, fail-closed Tier 1), `drift-lock.js` (**enforced**), `discovery-gate.js` (**advisory**, strict opt-in `AIAD_DISCOVERY_STRICT=1`), `jnsp-scan.js` / `session-start.js` / `skill-usage.js` / `statusline.js` (**advisory**).
- Bypass : `AIAD_HOOK_SILENT=1` **tue TOUS les hooks** (pas de granularité par hook).
- CI `.github/workflows/` : `ci.yml`, `aiad-emit-rules-check.yml`, `aiad-version-check.yml`, `aiad-docs-check.yml`, reproducibility, release = **enforced** ; `aiad-pr-review.yml`, `sdd-trace.yml`, `bun-smoke.yml` = **advisory**.
- **Aucun document `MATRICE.md`** : la cartographie enforced/advisory existe seulement implicitement dans le code.

**Tiering / packs déjà présents (à réutiliser)**

- Profils d'init : `lib/init.js` — `--minimal` (template `templates/minimal/`) vs `standard` vs `--upgrade <module>`.
- Packs gouvernance : `lib/governance-packs.js` (11 packs).
- Plugin system : `lib/plugins.js` (manifest `aiad-plugin.json`, discovery npm + local, install/uninstall).

**Surface de test**

- 244 fichiers `test/*.test.js`. Couvrent CLI parsing (`test/cli-parsing.test.js`), schema OpenAPI (`test/cli-schema.test.js`), command-hooks (`test/command-hooks.test.js`), profils (`test/init.test.js`), télémétrie (`test/telemetry.test.js`), plugins (`test/plugins.test.js`).
- **Gap** : pas de test « registre » garantissant que les 85 cases ↔ doc ↔ alias legacy restent cohérents.

---

## Faisabilité

**Verdict de faisabilité : élevée sur base existante.** L'intention ne demande pas de greenfield mais une réorganisation + extension d'infrastructures déjà fonctionnelles.

- **SPEC-015-1 (télémétrie d'usage)** : coût *faible-moyen*. L'infra opt-in RGPD existe (`lib/telemetry.js`) ; il s'agit d'ajouter un agrégat per-command lisible localement (`aiad-sdd telemetry usage` ?) à partir de `events.jsonl`. Pas de nouvel endpoint requis pour décider.
- **SPEC-015-2 (tiering core/extended/plugin + dépréciation)** : coût *moyen*. Le plugin system et les profils existent mais les 85 commandes sont inline dans un seul switch — extraire la longue traîne en lazy/plugin est un refactor non trivial (dépendances skills/hooks/gouvernance). Soft-deprecation (annonce + retrait v2) plutôt que rupture, conformément à la contrainte de l'intent.
- **SPEC-015-3 (matrice enforced/advisory)** : coût *faible*. Les faits sont déjà cartographiés ci-dessus ; il s'agit de les formaliser (table versionnée) et éventuellement de resserrer le bypass global `AIAD_HOOK_SILENT` en bypass granulaire.

**Dépendance entre SPECs** : 015-1 (données) → 015-2 (décision de tiering ancrée sur données). 015-3 est largement indépendante (documentation + resserrage bypass).

---

## Risques & inconnues

- **R1 — Définition du noyau « ~25 commandes » non tranchée.** Quelles commandes exactement ? L'intent veut une décision *par la donnée d'usage* — or la donnée per-command n'existe pas encore (SPEC-015-1 la produit). Risque circulaire si on veut figer le noyau avant d'avoir collecté de l'usage. **Résolu par C1** : le noyau initial est arrêté à dire d'expert comme provisoire et révisable, la télémétrie confirme/ajuste sans blocage circulaire.
- **R2 — Extraction de la longue traîne = refactor à risque de cascade.** `obsidian`/`cert`/`marketplace`/`tour` ont des dépendances (skills, hooks, gouvernance). Sortie naïve = casse. Atténuation : soft-deprecation tracée, retrait v2, tests de non-régression sur le registre.
- **R3 — Donnée d'usage = base installée faible + opt-in.** La télémétrie est désactivée par défaut et opt-in ; le volume d'événements pourrait être trop faible pour trancher statistiquement le tiering. La décision restera donc en partie au jugement humain assumé (ce qui est acceptable, mais à dire).
- **R4 — Bypass granulaire des hooks = surface de contournement.** Remplacer `AIAD_HOOK_SILENT=1` global par `--skip-veto` per-commande pourrait *affaiblir* l'enforced Tier 1 si mal cadré. La matrice (015-3) doit traiter le veto comme non-bypassable.
- **Gouvernance** : RGPD applicable à SPEC-015-1 (télémétrie, même anonyme) → réutiliser le consentement opt-in existant, pas de PII, pas de path projet. RGESN applicable (sobriété = moins de code chargé = écoconception, aligné). Pas de composant IA, pas d'UI → AI-ACT / RGAA non déclenchés à ce stade.

---

## Conditions (si CONDITIONAL GO)

- **C1** — Le noyau initial est arrêté à dire d'expert comme **provisoire et révisable**, explicitement marqué comme tel ; la donnée télémétrie (SPEC-015-1) sert à *confirmer/ajuster*, pas de blocage circulaire (lève R1).
- **C2** — Toute extraction de la longue traîne passe par **soft-deprecation tracée** (annonce + retrait planifié v2), jamais de rupture brutale, avec test de non-régression du registre (lève R2).
- **C3** — La matrice enforced/advisory (SPEC-015-3) traite le **veto Tier 1 comme non-bypassable** ; tout bypass granulaire introduit reste interdit sur l'enforced fail-closed (lève R4).

---

## Verdict : CONDITIONAL GO (confidence: 85 %)

> Tranché par Steeve Evers le 2026-06-16 (Human Authorship). Conditions C1, C2, C3 à lever en SPEC. `/sdd spec` autorisé.
