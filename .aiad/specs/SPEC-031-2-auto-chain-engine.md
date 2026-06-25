---
id: SPEC-031-2
title: "Moteur de chaînage automatique conditionnel du cycle SDD"
intent: INTENT-031
author: Steeve Evers
date: 2026-06-25
status: done
format: prose
sqs: 5/5
research: RESEARCH-031 (CONDITIONAL GO 85%, C1 — intégration via afterCommand lib/command-hooks.js)
depends-on: SPEC-031-3
---

# SPEC-031-2 — Moteur de chaînage automatique conditionnel du cycle SDD

**Intent parent** : INTENT-031  
**Auteur** : Steeve Evers  
**Date** : 2026-06-25  
**Statut** : ready  
**Format** : prose  
**SQS** : 5/5  

---

## 1. Contexte

Un cycle SDD complet (`spec→gate→exec→validate→drift-check`) requiert 5-7 interruptions manuelles (FACT-011). La plupart des transitions sont algorithmiquement déterminables : SQS ≥ 4/5, budget contexte < 40%, 0 veto gouvernance. Cette SPEC implémente un moteur zero-dep qui, après chaque commande réussie, évalue les conditions et déclenche la transition suivante ou remonte au PE.

Point d'intégration retenu (C1, RESEARCH-031) : `executerAfter` dans `lib/command-hooks.js` — branchement le moins intrusif, compatible hooks utilisateur existants.

---

## 2. Comportement Attendu

### Input

Contexte `afterCommand` d'une commande SDD réussie :
```js
ctx = {
  command: 'gate',       // nom de la commande qui vient de s'exécuter
  args: {},
  racine: '/path/to/project',
  exitCode: 0,
  durationMs: 1234,
}
```

### Processing

**Registre de transitions** (immuable, défini dans `lib/auto-chain.js`) :

| Commande source | Commande cible | Confirmation PE requise | Conditions supplémentaires |
|-----------------|---------------|------------------------|---------------------------|
| `spec`          | `gate`        | Non                    | —                         |
| `gate`          | `exec`        | **Oui**                | SQS ≥ 4/5 (exitCode 0)   |
| `exec`          | `validate`    | Non                    | —                         |
| `validate`      | `drift-check` | Non                    | —                         |
| `drift-check`   | `trace`       | Non                    | —                         |

**Conditions globales (vérifiées sur chaque transition)** :
1. `auto_chain.enabled === true` (lu via `lireConfigAutoChain` de SPEC-031-3)
2. `exitCode === 0` (commande source réussie)
3. Budget contexte < `auto_chain.max_context_pct` % (lu via `lib/context-budget.js`)
4. Aucun veto gouvernance actif (flag propagé via le contexte d'exécution)

**Flux d'exécution** :

```
afterCommand(ctx)
  ├─ auto_chain.enabled ? Non → return (pas de chaînage)
  ├─ ctx.exitCode ≠ 0 ? → return (commande échouée, pas de chaînage)
  ├─ transition = REGISTRE[ctx.command] ? Non → return (commande hors cycle)
  ├─ budget > max_context_pct ? → émettre warning PE + return
  ├─ veto gouvernance actif ? → émettre warning PE + return
  ├─ transition.confirmationRequise ?
  │   Oui → afficher prompt PE (stdout) + attendre input
  │           → PE confirme → déclencher commande cible
  │           → PE refuse   → return (fin de chaînage)
  └─ Non → déclencher commande cible directement
```

**Déclenchement de la commande cible** : appel à la même fonction de dispatch que le CLI (`dispatcherCommande` dans le bin ou `bin/aiad-sdd.js`), en passant les mêmes arguments que ceux reçus par la commande source. Si la fonction de dispatch n'est pas exportable, utiliser `child_process.execFile` en dernier recours.

**Veto gouvernance** : si un veto est retourné par un agent Tier 1 pendant une commande en cours de chaîne, le moteur s'arrête immédiatement et affiche le message de veto complet au PE — le chaînage ne reprend pas automatiquement.

### Output

```
[AIAD auto-chain] gate → exec : confirmation requise.
Conditions satisfaites : SQS ≥ 4/5, budget 23%, 0 veto.
Lancer exec maintenant ? [o/N] : o
[AIAD auto-chain] Démarrage de exec...
```

En cas d'arrêt :
```
[AIAD auto-chain] Chaînage suspendu — budget contexte 43% (seuil : 40%).
Relancez manuellement : npx aiad-sdd validate
```

### Cas limites

1. **`auto_chain.enabled = false`** → aucune transition, comportement manuel pré-v1.19 inchangé.
2. **Commande source hors registre** (ex. `fact`, `security`) → aucune transition, return silencieux.
3. **Budget dépasse le seuil** → warning stdout + arrêt propre (pas de chaînage). Pas d'erreur.
4. **Veto gouvernance actif** → arrêt immédiat + affichage du veto complet. Pas de chaînage.
5. **PE refuse la confirmation gate→exec** → arrêt propre, aucun effet de bord.
6. **Commande cible échoue** → le moteur ne re-tente pas ; l'erreur de la commande cible est affichée normalement.
7. **AIAD_COMMAND_HOOKS_DISABLED=1** → moteur désactivé (même variable que les user hooks).
8. **User hook afterCommand throw** → le moteur de chaînage est appelé **après** le user hook, uniquement si celui-ci n'a pas throwé (comportement safe existant dans `executerAfter`).

---

## 3. Critères d'Acceptation

- [ ] CA-1 : Un appel `npx aiad-sdd gate` réussi (exit 0, SQS ≥ 4/5) avec `auto_chain.enabled: true` et budget < 40% déclenche un prompt de confirmation avant `exec`. Si l'utilisateur répond `o`, `exec` démarre.
- [ ] CA-2 : Un appel `npx aiad-sdd spec` réussi avec `auto_chain.enabled: true` déclenche `gate` automatiquement sans prompt.
- [ ] CA-3 : Avec `auto_chain.enabled: false` dans `.aiad/config.yml`, aucune transition auto n'est déclenchée après `spec`, `gate`, `exec`, `validate` ou `drift-check`.
- [ ] CA-4 : Quand le budget contexte dépasse `max_context_pct`, le moteur émet un message d'avertissement sur stdout et n'exécute pas la commande suivante.
- [ ] CA-5 : `AIAD_COMMAND_HOOKS_DISABLED=1` désactive le moteur (aucune transition déclenchée).
- [ ] CA-6 : Les commandes hors registre (`fact`, `security`, `audit`, `context`) ne déclenchent aucune transition auto.
- [ ] CA-7 : `test/auto-chain.test.js` couvre CA-1 à CA-6 (mocks sur `dispatcherCommande` et `lireConfigAutoChain`).

---

## 4. Interface / API

```js
// lib/auto-chain.js

/**
 * Registre des transitions automatiques du cycle SDD.
 * Immuable — modifiable uniquement via une nouvelle SPEC.
 */
export const TRANSITIONS = Object.freeze({
  spec:        { next: 'gate',        confirmationRequise: false },
  gate:        { next: 'exec',        confirmationRequise: true  },
  exec:        { next: 'validate',    confirmationRequise: false },
  validate:    { next: 'drift-check', confirmationRequise: false },
  'drift-check': { next: 'trace',     confirmationRequise: false },
});

/**
 * Point d'entrée principal — appelé depuis executerAfter().
 *
 * @param {string} racine
 * @param {{ command: string, exitCode: number, args?: object }} ctx
 * @param {{ dispatcher: Function, stream?: object }} opts
 * @returns {Promise<void>}
 */
export async function evaluerChainage(racine, ctx, opts) { ... }

// Alias EN
export { evaluerChainage as evaluateChain, TRANSITIONS as CHAIN_TRANSITIONS };
```

**Intégration dans `lib/command-hooks.js`** (`executerAfter`) :

```js
// Après l'appel au user hook (best-effort existant), appel du moteur :
import { evaluerChainage } from './auto-chain.js';
// ... dans executerAfter, après hooks.afterCommand() :
await evaluerChainage(racine, ctx, { dispatcher });
```

---

## 5. Dépendances

- **SPEC-031-3** (bloquante) — `lireConfigAutoChain` doit exister avant l'implémentation
- `lib/command-hooks.js` — point d'intégration (modification minimale dans `executerAfter`)
- `lib/context-budget.js` — lecture du budget contexte courant
- `lib/auto-chain-config.js` (issu de SPEC-031-3) — lecture de `auto_chain.enabled` + `max_context_pct`
- `test/auto-chain.test.js` — nouveaux tests à créer

---

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~200 tokens
- Cette SPEC : ~600 tokens
- SPEC-031-3 (interface `lireConfigAutoChain`) : ~100 tokens
- `lib/command-hooks.js` (complet) : ~400 tokens
- `lib/context-budget.js` (signatures publiques) : ~100 tokens
- **Total estimé** : ~1 400 tokens — modéré (bien sous le seuil de 40% sur Sonnet 4.6)

---

## 7. Definition of Output Done (DoOD)

- [ ] `lib/auto-chain.js` créé : `TRANSITIONS` + `evaluerChainage` + alias EN
- [ ] `lib/command-hooks.js` : `executerAfter` modifié pour appeler `evaluerChainage` après le user hook
- [ ] `test/auto-chain.test.js` : CA-1 à CA-7 couverts (mocks dispatcher + config)
- [ ] Comportement manuel inchangé (toutes les commandes invocables individuellement)
- [ ] `AIAD_COMMAND_HOOKS_DISABLED=1` désactive le moteur (test inclus)
- [ ] Annotations `@intent INTENT-031 @spec SPEC-031-2-auto-chain-engine` posées dans les fichiers modifiés/créés
- [ ] `npm test` passe sans régression sur les tests `command-hooks` existants
- [ ] Gouvernance : non applicable (pas de données personnelles, pas d'UI, pas de composant IA décisionnel)

---

## Notes

Décision C1 (RESEARCH-031) : intégration via `afterCommand` dans `lib/command-hooks.js` — moins intrusif que l'intégration directe dans `.claude/sdd/`. Le moteur reste invisible si `AIAD_COMMAND_HOOKS_DISABLED=1`.

Le moteur ne lit pas le contexte Claude Code (fenêtre de conversation) — il opère au niveau CLI uniquement. L'estimation du budget contexte s'appuie sur `lib/context-budget.js` (R3 accepté : estimation statique suffisante pour v1).
