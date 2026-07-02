# Système de test exhaustif — SDD Mode

> Généré en réponse au goal : « chaque élément de `docs/PRD-retro-engineering.md`
> et chaque élément de la codebase doivent être couverts par un jeu de tests
> rejouable et évolutif. »

## Ce que ce système ajoute (et ce qu'il ne duplique pas)

La codebase avait déjà ~280 fichiers `test/*.test.js` (4200+ tests) qui
couvrent `lib/**/*.js` en profondeur, fonction par fonction. Ce qui manquait
n'était pas *plus de tests unitaires*, mais deux choses :

1. **Une preuve traçable** que chaque élément du PRD rétro-ingénierié a bien
   une contrepartie testée — ou une raison honnête si ce n'est pas le cas.
2. **Des scénarios d'intégration** qui chaînent plusieurs modules comme le
   fait réellement le cycle SDD (Research → Gate → Exec → Validate → Drift),
   au lieu de les valider un par un en isolation.

## Architecture

```
scripts/sdd-mode-coverage.js       ← matrice de couverture (PRD + codebase)
test/sdd-mode-e2e/
  coverage-tool.test.js            ← tests de l'outil de couverture lui-même
  coverage-overrides.json          ← curation manuelle honnête (covered/exempt)
  full-cycle-integration.test.js   ← intégration du backbone déterministe du cycle
  session-start-hook.test.js       ← hook SessionStart (budget de tokens, fail-open)
docs/sdd-mode-test-system.md       ← ce document
```

### 1. `scripts/sdd-mode-coverage.js` — la matrice de couverture

Parse `docs/PRD-retro-engineering.md` (lignes de tableau + puces de premier
niveau, section par section) en éléments atomiques, puis croise chacun avec
le corpus `test/*.test.js` :

- si le texte de l'élément contient une ancre `` `code` `` (nom de commande,
  fichier, script), on cherche un test dont le nom ou le contenu la
  mentionne → `covered` ;
- si rien ne matche automatiquement → `gap`, sauf override manuel ;
- les sections narratives/stratégiques du PRD (§1 Vision, §6 Outcome
  Criteria, §7 Trajectoire, §8 Annexe) sont `exempt` par défaut — un
  objectif business n'est pas mécaniquement testable par CI, exactement
  comme `traceability: exempt` (INTENT-024) le fait déjà pour la
  traçabilité code.

Il fait la même chose côté codebase : chaque fichier `lib/**/*.js` doit être
importé par au moins un test, sinon il est `orphan`.

**Philosophie JNSP** : un gap n'est jamais maquillé en couverture. Si le
matching automatique échoue (prose sans ancre `code`, ré-export indirect via
un module pivot comme `lib/dashboard/render.js`), on ajoute une entrée dans
`coverage-overrides.json` — mais seulement après avoir vérifié à la main que
le test cité exerce réellement le comportement. Le format y oblige :
`reason` documente la preuve.

### 2. `test/sdd-mode-e2e/` — scénarios de bout en bout

Deux gaps réels ont été comblés lors de la construction de ce système :

- **`session-start-hook.test.js`** : le hook `.aiad/hooks/session-start.js`
  (rappel Intent actif + gouvernance + garde-fou JNSP à l'ouverture de
  session, budget ≤ 300 tokens) n'avait aucun test. Ajouté : fail-open sans
  `.aiad/`, bypass `AIAD_HOOK_SILENT=1`, contenu attendu, budget de tokens
  mesuré, résilience à un fichier corrompu.
- **`full-cycle-integration.test.js`** : chaîne `cycle-graph.js` (le graphe
  d'étapes) avec les modules de verdict réels (`research.js`, `mini-gate.js`,
  `cross-model.js`, `drift-verdict.js`, `verdict.js`) sur quatre scénarios —
  chemin nominal jusqu'à `cycleComplet`, blocage GATE fermée qui empêche EXEC
  de démarrer, RESEARCH JNSP fail-closed, DRIFT-LOCK JNSP qui bloque la
  clôture même après un VALIDATE PASS. Ça prouve la composition, pas
  seulement chaque brique isolément.

`test/dashboard-backlog-health-score.test.js` (dans `test/`, pas
`sdd-mode-e2e/`, car c'est un test unitaire classique comme les autres) a
été ajouté pour combler le seul vrai orphelin détecté : `lib/dashboard/
backlog-health-score.js` n'est importé nulle part ailleurs dans la codebase
— c'est une fonctionnalité écrite mais jamais câblée dans le dashboard généré.
Le test couvre le comportement documenté de l'export public ; **le câblage
(ou le retrait) reste une décision produit distincte**, hors périmètre d'un
système de test — c'est un candidat FACT à trancher par un humain.

## Usage

```bash
npm run test:sdd-mode           # rejoue les scénarios d'intégration/UX
npm run sdd-mode:coverage       # matrice de couverture, exit 0 (COUVERT) / 1 (GAP)
npm run sdd-mode:coverage:write # + persiste le rapport sous .aiad/metrics/sdd-mode-coverage/
```

Câblé en CI (`.github/workflows/ci.yml`, job `test`) : chaque push/PR rejoue
les deux commandes ci-dessus.

## Faire évoluer le système (le SDD Mode change, ce système doit suivre)

- **Le PRD grossit** (nouvelle ligne de tableau, nouvelle puce) → relancer
  `npm run sdd-mode:coverage`. Le parseur détecte l'élément automatiquement ;
  s'il n'a pas d'ancre `code` claire ou que le matching échoue, ajouter une
  entrée dans `test/sdd-mode-e2e/coverage-overrides.json` (`covered` avec
  test(s) réel(s) + raison vérifiée, ou `exempt` avec justification).
- **Un nouveau fichier `lib/`** apparaît → il doit être importé par au moins
  un test existant ou nouveau, sinon `sdd-mode:coverage` le liste en
  orphelin et échoue (exit 1).
- **Une nouvelle étape/comportement UX** (nouveau hook, nouvelle transition
  de cycle) → ajouter un fichier dans `test/sdd-mode-e2e/` suivant le même
  principe : tester le comportement réellement exercé par un
  agent/utilisateur (spawn du hook/CLI, ou chaînage de modules de verdict),
  pas une réimplémentation de la logique interne.
- Ne jamais transformer un `gap` en `covered` sans avoir lu le test cité et
  vérifié qu'il exerce vraiment l'élément — le système perd toute valeur le
  jour où il ment.
