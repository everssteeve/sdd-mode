---
id: SPEC-031-3
title: "Paramètre auto_chain dans .aiad/config.yml + parser"
intent: INTENT-031
author: Steeve Evers
date: 2026-06-25
status: done
format: prose
sqs: 5/5
research: RESEARCH-031 (CONDITIONAL GO 85%, R4 accepté — clé absente = defaults hardcodés)
---

# SPEC-031-3 — Paramètre `auto_chain` dans `.aiad/config.yml` + parser

**Intent parent** : INTENT-031  
**Auteur** : Steeve Evers  
**Date** : 2026-06-25  
**Statut** : done  
**Format** : prose  
**SQS** : 5/5  

---

## 1. Contexte

Le moteur de chaînage automatique (SPEC-031-2) doit être activable/désactivable par projet sans toucher au code. La clé `auto_chain` est absente du schéma actuel `.aiad/config.yml`. Cette SPEC ajoute la clé dans les templates et expose un parser zero-dep pour la lire — elle est un prérequis bloquant pour SPEC-031-2.

Compatibilité descendante garantie : clé absente → defaults hardcodés `{ enabled: true, max_context_pct: 40 }` (R4, RESEARCH-031).

---

## 2. Comportement Attendu

### Input

Fichier `.aiad/config.yml` existant (ou absent) avec éventuellement la section `auto_chain`.

### Processing

**Schéma YAML ajouté** dans `.aiad/config.yml` et `templates/.aiad/config.yml` :

```yaml
auto_chain:
  # Chaînage automatique conditionnel du cycle SDD (INTENT-031).
  # true  : les transitions automatiques (spec→gate, exec→validate, …) se
  #         déclenchent sans prompt si les conditions sont satisfaites.
  # false : comportement manuel pré-v1.19, aucune transition auto.
  enabled: true

  # Seuil max du budget contexte (%) pour autoriser la prochaine étape.
  # Si le budget dépasse ce seuil, le chaînage s'arrête et remonte au PE.
  max_context_pct: 40
```

**Nouveau module** `lib/auto-chain-config.js` — zero-dep :

```js
lireConfigAutoChain(racine) → { enabled: boolean, max_context_pct: number }
```

Logique :
1. Lire `.aiad/config.yml` via `fs.readFileSync` + parseur YAML minimal (ou `js-yaml` si déjà dépendance).
2. Extraire `config.auto_chain` ; si absent → defaults.
3. Valider les types (boolean + entier 1–100) ; valeur invalide → default + warning stderr.
4. Retourner l'objet normalisé.

### Output

```js
// Exemple : config présente avec enabled: false
{ enabled: false, max_context_pct: 40 }

// Exemple : clé auto_chain absente
{ enabled: true, max_context_pct: 40 }

// Exemple : max_context_pct invalide (string)
// → warning stderr + default 40
{ enabled: true, max_context_pct: 40 }
```

### Cas limites

1. **`.aiad/config.yml` absent** → defaults silencieux (aucune erreur).
2. **Section `auto_chain` absente** → defaults silencieux.
3. **`enabled` non-booléen** → default `true` + avertissement stderr `[AIAD] auto_chain.enabled invalide, défaut true`.
4. **`max_context_pct` hors [1, 100]** → default 40 + avertissement stderr.
5. **Fichier YAML malformé** → defaults silencieux (même comportement que `lib/hooks.js:ecrireConfigSiAbsente`).

---

## 3. Critères d'Acceptation

- [ ] CA-1 : `lireConfigAutoChain(racine)` retourne `{ enabled: true, max_context_pct: 40 }` quand `.aiad/config.yml` est absent ou que la section `auto_chain` est absente.
- [ ] CA-2 : `lireConfigAutoChain(racine)` retourne `{ enabled: false, max_context_pct: 60 }` quand le fichier contient `auto_chain: { enabled: false, max_context_pct: 60 }`.
- [ ] CA-3 : Une valeur `max_context_pct: "invalid"` retourne 40 ET émet un warning sur stderr (sans throw).
- [ ] CA-4 : Le template `templates/.aiad/config.yml` contient la section `auto_chain` avec commentaires.
- [ ] CA-5 : Le `.aiad/config.yml` du projet de référence (ce repo) contient la section `auto_chain` avec `enabled: true`.
- [ ] CA-6 : `lib/auto-chain-config.js` n'introduit aucune dépendance npm nouvelle (zero-dep ou `js-yaml` si déjà présent).

---

## 4. Interface / API

```js
// lib/auto-chain-config.js
/**
 * @param {string} racine — chemin absolu du projet
 * @returns {{ enabled: boolean, max_context_pct: number }}
 */
export function lireConfigAutoChain(racine) { ... }

// Alias EN
export { lireConfigAutoChain as readAutoChainConfig };
```

---

## 5. Dépendances

- `.aiad/config.yml` — fichier projet à modifier
- `templates/.aiad/config.yml` — template source de vérité à modifier
- `lib/auto-chain-config.js` — nouveau module à créer
- `test/auto-chain-config.test.js` — nouveaux tests à créer
- Vérifier si `js-yaml` est déjà une dépendance (sinon parser YAML minimal)

SPEC-031-2 dépend de cette SPEC (ne peut pas être développée avant que `lireConfigAutoChain` existe).

---

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~200 tokens
- Cette SPEC : ~400 tokens
- `.aiad/config.yml` (complet) : ~100 tokens
- `lib/hooks.js` (zone ecrireConfigSiAbsente) : ~80 tokens
- **Total estimé** : ~780 tokens — faible

---

## 7. Definition of Output Done (DoOD)

- [ ] `lib/auto-chain-config.js` créé avec `lireConfigAutoChain` + alias EN + zero-dep
- [ ] `templates/.aiad/config.yml` : section `auto_chain` ajoutée avec commentaires
- [ ] `.aiad/config.yml` (ce repo) : section `auto_chain: { enabled: true, max_context_pct: 40 }` ajoutée
- [ ] `test/auto-chain-config.test.js` : couvre CA-1 à CA-4 (absent, présent, invalide, template)
- [ ] `npm test` passe sans régression
- [ ] Annotations `@intent INTENT-031 @spec SPEC-031-3-auto-chain-config` posées dans les fichiers modifiés/créés
- [ ] Gouvernance : non applicable (pas de données personnelles, pas d'UI, pas de composant IA)
