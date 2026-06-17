# SPEC-015-2-1-registre-commandes — Registre catégorisé des commandes CLI (core/extended/experimental)

**Intent parent** : INTENT-015
**Research** : RESEARCH-017 (CONDITIONAL GO 80 % — conditions C1, C2, C-DATA, C-SCOPE)
**Auteur** : Steeve Evers
**Date** : 2026-06-17
**Statut** : in-progress
**Format** : EARS
**SQS** : 5/5 — Gate OUVERTE (2026-06-17, EARS strict 0 violation, Étranger PASS)
**Implémentation** : `lib/commands-registry.js` (COMMANDS_REGISTRY 81 entrées · tierOf/listByTier/showCommands) + `bin/aiad-sdd.js` (commande `commands [--tier] [--json]`) · tests `test/commands-registry.test.js` (8/8) · trace 0 gap bloquant. Répartition : 25 core / 48 extended / 8 experimental.

---

## 1. Contexte

INTENT-015 veut un **noyau assumé** et une longue traîne identifiée. Aujourd'hui les 85 commandes vivent dans un switch inline (`bin/aiad-sdd.js:589-3599`) et une liste plate `COMMANDES_VALIDES` (`bin/aiad-sdd.js:3586-3594`), sans aucune métadonnée de tier. Cette SPEC crée le **registre catégorisé** — source unique de vérité tier/catégorie/statut par commande — et le rend **anti-régression par un snapshot test** (= critère de drift de l'intent rendu exécutoire, condition C2). Le tiering est posé à **dire d'expert provisoire** (C1) ; aucune dépendance à la donnée d'usage (C-DATA). Périmètre borné au registre + surface de lecture + tests (C-SCOPE) ; dépréciation = SPEC-015-2-2, lazy-loading hors périmètre.

## 2. Comportement Attendu

### Input

- Liste canonique existante : `COMMANDES_VALIDES` (`bin/aiad-sdd.js:3586-3594`), ~85 entrées.
- Nouveau module `lib/commands-registry.js` exportant `COMMANDS_REGISTRY` : un enregistrement par commande de premier niveau.
- Invocation utilisateur : `aiad-sdd commands [--tier core|extended|experimental] [--json]` (nouvelle commande de premier niveau, lecture seule).

### Processing

1. Déclarer `COMMANDS_REGISTRY` : pour chaque commande, `{ command, tier, category, status }` avec `tier ∈ {core, extended, experimental}`, `status ∈ {active, deprecated}`, `category` libre (chaîne courte non vide).
2. Le tiering est arrêté à dire d'expert (provisoire, révisable) — pas dérivé de la télémétrie.
3. `commands` : lit le registre, filtre par `--tier` si fourni, trie par tier puis alphabétiquement, rend en texte (groupé par tier) ou en JSON.
4. Un helper exporté expose le tier d'une commande pour réutilisation (SPEC-015-2-2).

### Output

- Texte (défaut) : commandes groupées par tier (`core`, puis `extended`, puis `experimental`), chaque ligne `command — category [status]`.
- JSON (`--json`) : `{ total, tiers: { core: [...], extended: [...], experimental: [...] }, commands: [{ command, tier, category, status }] }` sur stdout, rien d'autre.
- Exit 0 sur rendu réussi ; exit 1 sur valeur `--tier` invalide.

### Cas limites

1. **`--tier` inconnu** (ex. `--tier legacy`) : message d'erreur listant les tiers valides, exit 1.
2. **`--tier` valide mais vide** (aucune commande dans ce tier) : rend une liste vide sans erreur, exit 0.
3. **Commande présente dans `COMMANDES_VALIDES` sans entrée registre** (ou l'inverse) : détecté par un test de cohérence bidirectionnelle qui échoue (drift guard) — interdit de merger.
4. **Tier ou status hors énumération** dans une entrée registre : rejeté par un test de validation du schéma.
5. **`--json` combiné à `--tier`** : l'objet JSON ne contient que les commandes du tier filtré, structure inchangée.

## 3. Critères d'Acceptation (EARS)

### CA-001 — Registre exhaustif et cohérent avec la liste canonique

> Pattern : Ubiquitous

`The Commands Registry SHALL expose exactly one entry for each command listed in COMMANDES_VALIDES, with no entry absent and no extra entry.`

- [ ] Implémenté
- [ ] Testé : `test/commands-registry.test.js::registry matches COMMANDES_VALIDES bidirectionally`

### CA-002 — Schéma de chaque entrée

> Pattern : Ubiquitous

`The Commands Registry SHALL define for every entry a tier in {core, extended, experimental}, a status in {active, deprecated}, and a non-empty category string.`

- [ ] Implémenté
- [ ] Testé : `test/commands-registry.test.js::every entry has valid tier status category`

### CA-003 — Listing groupé par tier

> Pattern : Event-driven

`WHEN the operator runs "aiad-sdd commands" without a tier filter, the Commands command SHALL display every command grouped by tier in the order core, extended, experimental, sorted alphabetically within each tier.`

- [ ] Implémenté
- [ ] Testé : `test/commands-registry.test.js::lists grouped by tier`

### CA-004 — Filtre par tier

> Pattern : Event-driven

`WHEN the operator passes --tier with a value in {core, extended, experimental}, the Commands command SHALL display only the commands whose tier equals that value.`

- [ ] Implémenté
- [ ] Testé : `test/commands-registry.test.js::filters by tier`

### CA-005 — Sortie JSON stable

> Pattern : Event-driven

`WHEN the operator passes the --json flag, the Commands command SHALL emit on stdout exactly one JSON object { total, tiers, commands } and no other text.`

- [ ] Implémenté
- [ ] Testé : `test/commands-registry.test.js::json shape`

### CA-006 — Tier invalide rejeté

> Pattern : Unwanted behaviour

`IF the operator passes a --tier value outside {core, extended, experimental}, THEN the Commands command SHALL reject the invocation with exit code 1 and an error message listing the valid tiers.`

- [ ] Implémenté
- [ ] Testé : `test/commands-registry.test.js::invalid tier exits 1`

### CA-007 — Snapshot de tiering figé (anti-drift)

> Pattern : Ubiquitous

`The Commands Registry test suite SHALL assert the full command-to-tier mapping against a committed snapshot, so that adding, removing, or re-tiering a command without updating the snapshot fails the suite.`

- [ ] Implémenté
- [ ] Testé : `test/commands-registry.test.js::tier mapping snapshot`

### CA-008 — Lecture seule

> Pattern : Ubiquitous

`The Commands command SHALL read only the in-memory registry, writing no file and opening no network connection.`

- [ ] Implémenté
- [ ] Testé : `test/commands-registry.test.js::no write no network`

## 4. Interface / API

```
CLI :  aiad-sdd commands [--tier core|extended|experimental] [--json]

lib/commands-registry.js (ESM, zéro-dep) :
  export const COMMANDS_REGISTRY = [
    { command: 'init',     tier: 'core',         category: 'cadrage',     status: 'active' },
    { command: 'obsidian', tier: 'extended',     category: 'export',      status: 'active' },
    { command: 'canary',   tier: 'experimental', category: 'qualité',     status: 'active' },
    // … une entrée par commande de COMMANDES_VALIDES
  ];
  export function tierOf(command): 'core'|'extended'|'experimental'|null;
  export function listByTier(tier?): COMMANDS_REGISTRY[];

bin/aiad-sdd.js :
  - case 'commands' : dispatch (parse --tier / --json, rendu via lib/term.js), exit 0/1.
  - 'commands' ajouté à COMMANDES_VALIDES + ligne d'AIDE.

Schéma JSON de sortie :
  { total: number,
    tiers: { core: string[], extended: string[], experimental: string[] },
    commands: [{ command, tier, category, status }] }
```

## 5. Dépendances

- `bin/aiad-sdd.js` (`COMMANDES_VALIDES` comme liste canonique de référence du test de cohérence).
- `lib/term.js` (rendu cohérent).
- Aucune dépendance externe (zéro-dep).
- **Aval** : SPEC-015-2-2 (dépréciation) consomme `status` + `tierOf()` de ce registre.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~1 100 tokens
- Fichiers source pertinents : `bin/aiad-sdd.js:318-495` (AIDE) + `:3586-3594` (COMMANDES_VALIDES) + dispatch, `lib/term.js`, nouveau `lib/commands-registry.js`, nouveau `test/commands-registry.test.js`
- **Total estimé** : ~8k tokens (sous le seuil 60-70 %)

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing (lints node/deps/size/esm/claims verts)
- [x] Tests unitaires sur les 8 critères + cas limites (`test/commands-registry.test.js` — 8/8)
- [x] **EARS lint : 0 violation** (skill `ears-validator`)
- [x] `DOCUMENTATION.md` régénéré (`aiad-sdd docs`) + badge couverture (`coverage:badge`) — gotcha CI nouvelle commande
- [x] SPEC mise à jour si écart (Drift Lock — trace 0 gap bloquant)
- [x] Annotations machine-vérifiables posées (`@intent INTENT-015`, `@spec SPEC-015-2-1-registre-commandes`, `@verified-by`)
- [ ] Code review passée
- [ ] Gouvernance vérifiée : **RGESN** (sobriété : registre statique zéro-dep, rend la longue traîne visible et donc réductible). Pas de données personnelles (RGPD n/a), pas d'IA (AI-ACT n/a), pas d'UI web (RGAA n/a).
