# FACT-017 — `backlog-health-score` implémenté mais jamais câblé au cockpit PM

**Date** : 2026-07-02
**Auteur** : Steeve Evers
**SPEC concernée** : N/A — détecté par le système de test exhaustif SDD Mode (`scripts/sdd-mode-coverage.js`), aucune SPEC ne référence ce module
**Statut** : résolu

## Écart constaté

**Livré** : `lib/dashboard/backlog-health-score.js` (#561) implémente un score
composite /100 sur 10 dimensions (freshness, hygiene, outcomes, risques,
décisions, hypothèses, annotations, vélocité SLA, maturité, alignement) avec
son rendu HTML (`blocBacklogHealthScore`) — complet et testé isolément, mais
**jamais importé** par `lib/dashboard/model/index.js` (donc `donnees.backlogHealthScore`
n'était jamais calculé) ni par `lib/dashboard/pm.js` (donc jamais rendu dans
le cockpit PM). Détecté comme seul orphelin `lib/**/*.js` par le système de
couverture SDD Mode construit le 2026-07-02.

**Désiré** : le score composite doit apparaître dans le Cockpit PM, à côté
des blocs backlog existants (freshness, pyramid, hygiene) qu'il synthétise.

## Impact qualifié

- **Type** : fonctionnel (fonctionnalité livrée mais invisible pour l'utilisateur final)
- **Sévérité** : mineur — aucune régression, juste une valeur non exposée

## Décision d'action

**Action choisie** : patch immédiat
**Justification** : les 10 dépendances (`donnees.backlogFreshness`, `backlogHygiene`,
`outcomeCompletion`, `riskTransparency`, `decisionVelocity`, `hypothesisLifecycle`,
`specAnnotationCoverage`, `velocitySla`, `intentMaturity`, `goalAlignment`) étaient
déjà toutes calculées dans `lib/dashboard/model/index.js` — il ne manquait que
l'appel à `calculerBacklogHealthScore` et le rendu du bloc. Portée < 20 lignes,
aucune ambiguïté de conception : pas de nouvel Intent nécessaire.
**Lien SPEC** : N/A

## Correctifs appliqués

1. `lib/dashboard/model/index.js` — ajout de l'import `calculerBacklogHealthScore`
   et de `donnees.backlogHealthScore = calculerBacklogHealthScore(donnees)`,
   placé après le calcul de ses 10 dépendances.
2. `lib/dashboard/pm.js` — import de `blocBacklogHealthScore` + insertion du
   bloc juste avant `blocBacklogFreshness` (résumé composite avant le détail
   par dimension).
3. `test/dashboard-backlog-health-score.test.js` (ajouté le 2026-07-02, avant
   ce FACT) — couvre déjà le comportement de l'export public.
4. Vérifié par génération réelle du dashboard du dépôt (`npx aiad-sdd dashboard`) :
   le bloc « Score santé backlog » apparaît dans `dashboard/pm.html`.

## Vérification

- `npm run sdd-mode:coverage` → COUVERT, 312/312 fichiers `lib/` couverts (0 orphelin).
- `npm test` → 4206/4206 tests verts (aucune régression).
- `npm run lint && npm run lint:size && npm run lint:esm` → verts.
