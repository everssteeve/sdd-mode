# RESEARCH-017 — Tiering CLI core/extended/plugin + plan de dépréciation (SPEC-015-2)

**Intent parent** : INTENT-015
**Research amont** : RESEARCH-016 (inventaire global + verdict CONDITIONAL GO sur l'intent)
**Auteur** : Steeve Evers
**Date** : 2026-06-17
**Statut** : tranché — /sdd spec autorisé (C1, C2, C-DATA, C-SCOPE)

---

## Discovery (ancrage code obligatoire)

> Discovery ciblé sur la faisabilité **structurelle** du tiering et de la dépréciation (l'inventaire global est dans RESEARCH-016). Agent Explore read-only, 2026-06-17. Complété par la donnée d'usage réelle produite par SPEC-015-1.

**Donnée d'usage réelle — et sa limite (Empirisme sans Concession)**

- `aiad-sdd telemetry usage --json` sur la machine du mainteneur : 47 977 événements, fenêtre `2026-05-18 → 2026-06-17`, 34 « core » / 76 « longue-traîne » par l'algo ≤ 20 %.
- **La donnée est polluée par des runs automatisés**, evidence : distribution anormalement plate (commande #1 `statusline` à 7,1 % seulement) et surtout des comptes **identiques** (746 exact pour `adrs`, `dpia`, `hook-stats`, `provenance`, `skills`…) — signature de boucles CI/tests/bench, pas de frappe humaine. `statusline`/`standup`/`brief` en tête = hooks/benchmarks.
- Cause racine ancrée : le payload `track('command_run', …)` (`bin/aiad-sdd.js:579-583`) ne capture **que** `command`/`version`/`runtimes` — **aucun champ `context` humain/CI**, et `lib/telemetry.js` n'a pas de garde désactivant la collecte en CI/test. Le bruit n'est donc filtrable **ni à la source ni a posteriori** en l'état.

**Structure de catégorisation existante**

- Le bloc `AIDE` (`bin/aiad-sdd.js:318-495`) est une string concaténée, groupée informellement, **non exploitable comme structure de données**.
- `COMMANDES_VALIDES` (`bin/aiad-sdd.js:3586-3593`) : array plat sans attribut.
- **Aucun registre de métadonnées par commande.** Pattern réutilisable : `lib/governance-packs.js:24-100` (objet `PACKS` avec `{id, titre, description, …}`) → copiable en `COMMANDS_REGISTRY { tier, cat, status }`.

**Infra de dépréciation (`sunset`)**

- `lib/sunset.js` (≈128 l.) : scanne skills/rules/gouvernance, lit le frontmatter `sunset_when:` / `review_at:`, classe les candidats via `estCandidate()` (`lib/sunset.js:61-71`). **Détection seulement, pas de cycle annonce→warning→retrait.**
- Pas de mécanisme de message de dépréciation câblé au dispatch (les alias legacy `/sdd-spec` sont documentaires, pas wirés). À construire : warning au dispatch + politique multi-version.

**Couplage des candidats à extraction (risque cascade)**

- `obsidian` (`lib/obsidian-export.js`) : `node:fs`/`node:path` seuls → couplage **bas**.
- `cert` (`lib/cert.js`) : `node:crypto` seul → **très bas**.
- `marketplace` (`lib/marketplace.js`) : builtins + `lib/term.js` → **bas**.
- `tour` (`lib/tour.js`) : `node:readline` + `lib/term.js` → **bas**.
- Aucune ne dépend d'une autre commande, d'un skill, d'un hook ou d'un agent de gouvernance. **Risque de cascade : minimal.**

**Lazy-loading**

- Imports **mixtes** : ~80 imports statiques en tête (`bin/aiad-sdd.js:8-126`, chargés à froid quelle que soit la commande) + déjà des `await import()` dynamiques (`bin/aiad-sdd.js:785` doctor-fix, `:922` workspace-analytics, bench/research/veto…). Pattern d'extraction sans cascade donc **déjà éprouvé** dans le repo.

**Surface de test**

- Aucun test ne fige le registre des commandes. `test/docs.test.js` scrape l'`AIDE` (parité doc). Un nouveau `test/commands-registry.test.js` (snapshot tier/cat) serait le garde anti-régression du critère de drift de l'intent.

---

## Faisabilité

**Élevée, sans révolution architecturale.** Le tiering structurel réutilise : pattern `PACKS` pour le registre, `lib/sunset.js` pour la signalisation de dépréciation, le lazy-loading déjà pratiqué, et la télémétrie de SPEC-015-1.

- **Registre catégorisé** (`lib/commands-registry.js`) : nouveau, ~300-500 l., source unique tier/cat/status par commande, branché sur l'`AIDE` et un test snapshot.
- **Cycle de dépréciation** : étendre `sunset` (détection) d'un message au dispatch + politique `v1.x = warning / v2 = retrait` (soft, conforme C2).
- **Lazy-loading** : déplacer 10-15 imports statiques (candidats longue-traîne) vers `await import()` — gain cold-start, risque minimal.

## Risques & inconnues

- **R-DATA — La donnée d'usage actuelle ne peut PAS fonder le noyau.** Polluée par l'automatisation, non filtrable en l'état (pas de champ `context`). C'est le risque central : prétendre « décider par la donnée » sur ce jeu serait malhonnête. **Résolu par C-DATA.**
- **R2 — Cascade d'extraction.** Confirmé **minimal** par le Discovery (candidats découplés). **Résolu par C2** (soft-deprecation + snapshot test).
- **R5 — Périmètre du noyau non tranché** (quelles 25 commandes : `trace` core ou extended ? `obsidian`/`repl` dehors ?). Décision de gouvernance métier, pas d'infra. **Résolu par C1.**
- **Profondeur du plugin** : réutiliser `lib/plugins.js` (manifest complet) ou extraction légère deprecation-only ? **Résolu par C-SCOPE** : 015-2 se borne au registre + dépréciation + lazy-loading ; l'extraction-plugin réelle est renvoyée à une SPEC ultérieure.
- **Gouvernance** : RGESN (sobriété : moins de code chargé à froid via lazy-loading = aligné). RGPD si C-DATA touche la télémétrie (ajout d'un champ `context` non-personnel : OK, pas de PII). Pas d'IA, pas d'UI.

## Conditions (si CONDITIONAL GO)

- **C1** (report de RESEARCH-016) — Le noyau est arrêté à **dire d'expert, provisoire et révisable**, marqué comme tel ; il n'attend pas un jeu de données propre pour exister.
- **C2** (report) — Tiering/extraction par **soft-deprecation tracée** (annonce → warning → retrait v2), jamais de rupture, avec **test snapshot du registre** comme garde anti-régression (= critère de drift de l'intent rendu exécutoire).
- **C-DATA** (nouveau, issu du Discovery — tranché : *tiering à dire d'expert d'abord*) — 015-2 borne le tiering au **jugement d'expert provisoire (C1)** et **diffère** la validation empirique. La SPEC **n'invoque pas le classement d'usage actuel comme preuve** (jeu pollué par l'automatisation). L'assainissement de la télémétrie (discriminant `context` humain/CI) est noté comme travail amont à une future re-validation du noyau, hors périmètre 015-2.
- **C-SCOPE** — 015-2 se borne au **registre catégorisé + cycle de dépréciation + lazy-loading des candidats découplés** ; l'extraction réelle en plugin npm (manifest complet) est renvoyée à une SPEC ultérieure si elle s'avère nécessaire (atomicité — éviter une SPEC > 200 l.).

---

## Verdict : CONDITIONAL GO (confidence: 80 %)

> Tranché par Steeve Evers le 2026-06-17 (Human Authorship). Conditions C1, C2, C-DATA, C-SCOPE. C-DATA résolue par « tiering à dire d'expert d'abord » : la donnée d'usage polluée n'est pas invoquée comme preuve, la validation empirique est différée. `/sdd spec` autorisé.
