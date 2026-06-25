---
id: RESEARCH-034
intent: INTENT-021
author: Steeve Evers
date: 2026-06-25
status: done
verdict: CONDITIONAL GO
confidence: 85
---

# RESEARCH-034 — Empreinte mesurée : tokens et coût par fonctionnalité (← INTENT-021)

> Phase Research (§3.5) — entre l'Intent et la SPEC. Elle ne score PAS la
> qualité d'une SPEC (c'est le rôle du SQS) mais la **viabilité de l'intention**,
> ancrée dans le code réel. La Research informe ; **l'humain tranche le GO/NO-GO**.
> Verdict machine : `npx aiad-sdd research RESEARCH-034`.

---

## ⚠ Alerte Human Authorship

INTENT-021 est en `status: draft` avec la note :
> "Draft issu de l'analyse du 2026-06-11. POURQUOI à approprier par un humain avant passage en `active`."

Le Discovery est informationnel ; **le verdict ne peut être posé que par Steeve Evers** et vaut appropriation implicite de l'Intent (draft → active).

---

## Discovery (ancrage code — agent Explore, read-only)

Constat central : **l'infrastructure de capture des tokens existe déjà** (livrée par INTENT-030/EcoLogits). Elle agrège **par session harness**, jamais **par Intent/SPEC**. INTENT-021 est donc majoritairement un travail d'**attribution + restitution**, pas de mesure brute.

Zones clés cartographiées (ancrages `chemin:ligne`) :

- `lib/eco-estimator.js:60` — comptage tokens réel + estimation CO₂ (`estimerImpact`)
- `lib/eco-hook.js:27` — hook Stop : capture sessionId/model/tokens → `hook-runs.jsonl`
- `lib/eco-dashboard.js:39` — agrégat 30 dernières sessions (global, pas par artefact)
- `.claude/skills/context-budget/SKILL.md:1` — M1–M5 estimés (heuristique, non persistés)
- `.claude/sdd/context.md:1` — rapport temporaire, zéro série historique
- `lib/telemetry.js:65` — télémétrie opt-in locale (commandes, pas tokens) — INTENT-009
- `.aiad/hooks/skill-usage.js:42` — log skill/session, pas de lien Intent/SPEC
- `lib/dashboard.js:60` — 20 renderers, aucune page `valeur`/`value`
- `.aiad/intents/archive/INTENT-018-valeur-boussole.md:1` — page « Valeur » archivée, jamais livrée
- `.claude/sdd/exec.md:79` — prompt assemblé sans injection SPEC-ID/INTENT-ID (chaînon manquant)
- `.aiad/metrics/traceability/trace.md:20` — INTENT-021 `❌ orphelin`

### 1. Comptage de tokens — DÉJÀ livré (INTENT-030)

- `lib/eco-estimator.js:60-96` — `estimerImpact({ model, inputTokens, outputTokens })` → `{ co2g, energyWh, totalTokens, method }`. Comptage de tokens réel + estimation CO₂.
- `lib/eco-hook.js:27-63` — hook Stop du harness : capture `session_id`, `model`, `input_tokens`/`output_tokens` du payload, persiste dans `.aiad/metrics/hook-runs.jsonl`.
- `.aiad/metrics/hook-runs.jsonl` — schéma : `{ ts, event, sessionId, model, ecoMetrics: { co2g, energyWh, totalTokens, method } }`. **Aucun champ `intentId`/`specId`.**
- `lib/eco-dashboard.js:39-220` — lecture + agrégat des 30 dernières sessions (co2Total, tokensTotal, tendance) ; page `dashboard/eco.html`. Agrégat **global**, pas par artefact.
- Tests : `test/eco-estimator.test.js` (8 CA), `test/eco-hook.test.js`, `test/eco-dashboard.test.js`.

### 2. `/sdd context` — estimation heuristique, pas mesure réelle

- `.claude/skills/context-budget/SKILL.md` — calcule M1–M5. M3 = ratio estimé/réel. Estimation = taille fichier × facteur token/char ; le « réel » est fourni **manuellement** par l'utilisateur. **Zéro persistance**, recalcul à chaque audit.
- `.claude/sdd/context.md:1-68` — rapport temporaire, aucune série historique par Intent/SPEC.

### 3. Observabilité usage — DÉJÀ livré (INTENT-009)

- `lib/telemetry.js:65-164` — télémétrie opt-in locale (RGPD), agrège l'usage par commande depuis `~/.aiad-sdd/events.jsonl`. Mesure des **commandes**, pas des tokens.
- `.aiad/hooks/skill-usage.js:42-47` — log `{ ts, skill, tool, session }` dans `.aiad/metrics/skill-usage.jsonl`. Pas de lien Intent/SPEC.

### 4. Dashboard — page « Valeur » INEXISTANTE

- `lib/dashboard.js:60-84` — 20 renderers (`today`, `intents`, `specs`, `eco`, …). **Aucune page `valeur`/`value`.**
- `lib/dashboard/model/index.js` & `lib/dashboard/collect.js` — agrégation centralisée ; recherche `tokens`/`cost`/`footprint` = 0 hit ; aucun champ tokens/coût dans la collecte frontmatter Intent/SPEC.
- `.aiad/intents/archive/INTENT-018-valeur-boussole.md` — **archivé 2026-06-24** ; 5 SPECs (018-1/5) toutes archivées. La page « Valeur » visée par INTENT-021 **n'a jamais été livrée** et son Intent porteur est clos.

### 5. Métriques persistées — aucune dimension par artefact

- `.aiad/metrics/` — `hook-runs.jsonl` (tokens globaux/session), `skill-usage.jsonl`, `digest/`, `coverage/`, … **Aucun** `tokens-per-spec`, `cost-by-intent`, `footprint-per-artifact`.
- `.aiad/metrics/traceability/trace.md:20` — `INTENT-021 | _(aucune SPEC)_ | ❌ orphelin`. Pas de colonne tokens/coût.

### 6. Chaînon manquant — contexte Intent/SPEC → hook Stop

- `.claude/sdd/exec.md:79-97` — le prompt assemblé n'injecte **ni** SPEC-ID **ni** INTENT-ID comme variable d'environnement / marker.
- `.aiad/hooks-config.json` + `lib/hooks-config.js` — aucun mécanisme de passage `AIAD_CURRENT_SPEC`/`AIAD_CURRENT_INTENT` au hook Stop.
- Conséquence : pour attribuer les tokens à un artefact, il faut **enrichir le chaînon exec → hook** (env var ou marker), seul point d'architecture réellement nouveau.

---

## Faisabilité

**Réalisable avec l'architecture actuelle ?** Oui pour le cœur (attribution), partiellement pour la restitution dashboard.

Briques déjà en place : comptage de tokens réel (`eco-estimator`), capture hook Stop + persistance JSONL append-only (`eco-hook`), agrégation dashboard (`eco-dashboard`), télémétrie opt-in locale (`telemetry`). INTENT-021 **compose** ces briques plutôt qu'il ne les crée.

Découpage pressenti (3 SPECs atomiques) :

- **A — Attribution tokens ↔ Intent/SPEC** : injecter `AIAD_CURRENT_SPEC`/`AIAD_CURRENT_INTENT` au lancement (`exec.md`), enrichir `eco-hook.js` d'un champ optionnel `specId`/`intentId` dans `hook-runs.jsonl` (rétro-compatible). Coût moyen, risque faible.
- **B — Restitution `/sdd context`** : agrégat tokens/coût réels par Intent/SPEC depuis `hook-runs.jsonl`, affiché dans `/sdd context`. Coût moyen.
- **C — Restitution dashboard** : nouvelle card/page d'empreinte par artefact. **Dépend de la décision sur INTENT-018** (page « Valeur » archivée).

**Alternative sobre** : se limiter à A + B (attribution + `/sdd context`), et reporter C tant que la page « Valeur » n'est pas relancée — évite de rouvrir INTENT-018.

---

## Risques & inconnues

- R1 — **Recouvrement avec INTENT-030** : le comptage brut de tokens est déjà livré. Le risque est de re-spécifier de l'existant. À cadrer : INTENT-021 = *attribution + restitution*, INTENT-030 = *mesure + CO₂*. Frontière à acter.
- R2 — **Dépendance INTENT-018 archivé** : la « page Valeur » objectif d'INTENT-021 n'existe pas et son Intent est clos. Faut-il rouvrir INTENT-018, créer une page autonome, ou se rabattre sur la page `eco` existante ? Décision humaine.
- R3 — **Granularité** : session entière (comme 030) vs SPEC vs tranche verticale phasée (exec.md §3.6). Le hook Stop ne voit que la session. Comptage intra-session (par tranche) exigerait un état stateful — surcoût notable.
- R4 — **Fiabilité de l'attribution** : une session peut toucher plusieurs SPECs ; l'env var fige *une* SPEC active. Risque d'attribution approximative à documenter (best-effort, pas exact).
- R5 — **Coût (€) vs tokens** : l'Intent dit « tokens et coût ». Le coût € dépend d'une grille de prix par modèle (volatile, externe). `eco-estimator` modélise l'énergie/CO₂, pas le prix. Inclure le € = nouvelle dette de données externes (cf. garde-fou « claims sourcés » FACT-001). À trancher : tokens seuls (sobre) vs tokens + coût € (grille à sourcer).
- R6 — **Opt-in / RGPD** : la contrainte « locale, opt-in » est déjà respectée par l'infra (hook-runs local, telemetry opt-in). À ne pas régresser — pas d'envoi réseau.

---

## Verdict

> **Tranche ici, Steeve.**
>
> Vu le Discovery, l'intention est techniquement portée à 70 % par l'existant (INTENT-030). Le vrai travail neuf = attribution par artefact + restitution. Deux inconnues structurantes pèsent : la dépendance à la page « Valeur » (INTENT-018 archivé, R2) et le périmètre « coût € » (grille à sourcer, R5).
>
> - **GO** : on spécifie A + B + C, page « Valeur » incluse (implique de statuer sur INTENT-018).
> - **CONDITIONAL GO** : on spécifie, sous conditions — p. ex. périmètre A + B seulement (attribution + `/sdd context`), tokens sans coût €, page dashboard reportée jusqu'à décision INTENT-018.
> - **DEFER** : on attend (cycle trop court, ou on veut d'abord relancer INTENT-018 pour la page Valeur).
> - **NO-GO** : recouvrement INTENT-030 trop fort, valeur marginale insuffisante.
>
> Confiance (0-100 %) ?
>
> Note : ta réponse vaut appropriation implicite de l'Intent INTENT-021 (draft → active).

## Verdict : CONDITIONAL GO (confidence: 85 %)

> Tranché par **Steeve Evers** — 2026-06-25.
> Verdict machine : CONDITIONAL (exit 0) — `/sdd spec` autorisé (conditions C1 + C2 + C3 à lever).
> Note : ce verdict vaut appropriation de INTENT-021 (draft → active).

## Conditions (si CONDITIONAL GO)

- C1 — **Périmètre borné A + B (R2 neutralisé)** : INTENT-021 se limite à (A) l'attribution tokens ↔ Intent/SPEC et (B) la restitution dans `/sdd context`. La page dashboard « Valeur » (périmètre C) est **reportée** tant que la décision sur INTENT-018 (archivé) n'est pas prise — elle ne fait pas partie de cette vague de SPECs. La checklist de l'Intent doit refléter ce recentrage (SPEC-021-2 = restitution `/sdd context`, sans dashboard).
- C2 — **Tokens seuls, pas de coût € (R5 neutralisé)** : la mesure porte sur les tokens (et l'énergie/CO₂ déjà fournie par `eco-estimator`). Aucune grille de prix € externe n'est introduite — pas de nouvelle dette de sourcing (cf. FACT-001). Le terme « coût » de l'Intent se lit comme empreinte tokens/énergie, pas prix monétaire.
- C3 — **Rétro-compatibilité + attribution best-effort (R1/R4)** : l'enrichissement de `hook-runs.jsonl` ajoute des champs `intentId`/`specId` **optionnels** ; les entrées existantes sans ces champs restent valides. L'attribution est documentée comme *best-effort* (une session figeant une SPEC active ; sessions multi-SPEC approximées) — pas un comptage exact par tranche. La frontière avec INTENT-030 (mesure brute + CO₂) est actée : INTENT-021 = attribution + restitution, sans re-spécifier le comptage.

