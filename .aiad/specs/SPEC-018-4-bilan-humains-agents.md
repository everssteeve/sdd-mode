# SPEC-018-4 — Bilan humains/agents par Intent

**Intent parent** : INTENT-018
**Auteur** : Steeve Evers
**Date** : 2026-06-23
**Statut** : done
**Format** : prose
**SQS** : 5/5
**Dépend de** : SPEC-018-1

---

## 1. Contexte

AIAD positionne l'IA comme exécutant et l'humain comme gardien de l'intention. Pourtant le dashboard ne rend pas visible *qui* fait *quoi* sur chaque Intent. SPEC-018-4 ajoute deux champs optionnels au frontmatter des Intents (`executor` et `validator`) et produit un tableau de bilan humains/agents. Choix de design retenu (R1 de RESEARCH-024) : **Option A — champs frontmatter explicites**, nullable, rétrocompatibles.

## 2. Comportement Attendu

### Input

- Frontmatter de chaque Intent `.aiad/intents/INTENT-*.md` — champs nouveaux (optionnels) :
  - `executor: string | null` — qui exécute (ex. `"Claude Sonnet 4.6"`, `"Steeve Evers"`, `null`)
  - `validator: string | null` — qui valide (ex. `"Steeve Evers"`, `null`)
- Champs existants lus : `id`, `titre`, `auteur` (formulateur), `statut`
- `donnees.intents` — tableau enrichi par `collect.js`
- Données de gouvernance (optional) : si un SPEC liée contient `@governance AIAD-*` → le(s) agent(s) gouvernance ayant émis un veto ou PASS

### Processing

1. **Parsing** : étendre `collect.js` pour lire `executor` et `validator` depuis le frontmatter (même pattern `extraireChamp`). Valeur par défaut : `null`.
2. **Classification** : pour chaque rôle (auteur/executor/validator), détecter si c'est un humain ou un agent IA :
   - Si contient `Claude`, `GPT`, `Gemini`, `Copilot`, ou un ID modèle → `type: 'agent'`
   - Sinon (nom propre, email, `null`) → `type: 'human'` (ou `type: 'inconnu'` si null)
3. **Bilan gouvernance** : pour chaque Intent, lire les annotations `@governance` de ses SPECs liées. Si une SPEC liée contient `@governance`, ajouter les agents concernés dans `agentsGouvernance[]`.
4. Produire `donnees.bilanHumainsAgents` : tableau trié par `statut` (active/in-progress en premier).

### Output

```js
donnees.bilanHumainsAgents = [
  {
    id: string,
    titre: string,
    statut: string,
    formulateur:  { nom: string | null, type: 'human'|'agent'|'inconnu' },
    executor:     { nom: string | null, type: 'human'|'agent'|'inconnu' },
    validator:    { nom: string | null, type: 'human'|'agent'|'inconnu' },
    agentsGouvernance: string[],  // ex. ['AIAD-RGPD', 'AIAD-RGAA']
  }
]
```

**Rendu HTML** `blocBilanHumainsAgents(donnees)` :
- Tableau HTML avec colonnes : Intent | Formule par | Exécuté par | Validé par | Gouvernance
- `<table>` avec `<caption>Bilan humains / agents par Intent</caption>`, `<thead>`, `<th scope="col">`, `<tbody>`
- Cellule vide (`—`) si champ null (pas d'info inventée)
- Badge textuel `Humain` / `Agent IA` / `—` dans chaque cellule rôle — pas de couleur seule

### Cas limites

- **Champ `executor` absent du frontmatter** : `executor.nom = null`, `executor.type = 'inconnu'` — cellule `—` sans erreur.
- **Tous les Intents sans `executor`** : tableau affiché normalement, colonnes toutes à `—`.
- **Nom ambigu** (ni humain ni agent identifiable) : `type: 'inconnu'`, affiché tel quel.
- **Intent sans SPECs liées** : `agentsGouvernance = []`, cellule `—`.
- **Intents archivés** : exclus du tableau par défaut (filtre `statut != archived`).

## 3. Critères d'Acceptation

- [ ] `collect.js` lit les champs `executor` et `validator` du frontmatter sans erreur pour un Intent qui ne les déclare pas (valeur `null`).
- [ ] `calculerBilanHumainsAgents(donnees)` retourne un item par Intent non archivé, avec `formulateur`, `executor`, `validator` chacun avec `nom` et `type`.
- [ ] Un nom contenant `"Claude"` est classé `type: 'agent'` ; un nom humain est classé `type: 'human'`.
- [ ] Un champ absent du frontmatter donne `{ nom: null, type: 'inconnu' }`.
- [ ] `blocBilanHumainsAgents(donnees)` produit un `<table>` avec `<caption>`, `<thead>`, `<th scope="col">`.
- [ ] axe-core 0 violation RGAA AA sur le bloc rendu.
- [ ] Test unitaire : 3 Intents (auteur humain + executor agent, auteur humain + executor null, tout null).

## 4. Interface / API

```js
// lib/dashboard/intent-humans-agents.js (nouveau fichier)

/**
 * @intent INTENT-018
 * @spec SPEC-018-4-bilan-humains-agents
 * @governance AIAD-RGPD,AIAD-RGAA
 */
export function calculerBilanHumainsAgents(donnees) { /* … */ }
export function blocBilanHumainsAgents(donnees) { /* → string HTML */ }
```

Extension `collect.js` :
```js
// Après ligne 264 (fin bloc champs Intent)
intent.executor  = extraireChamp(fm, ['executor'])  ?? null;
intent.validator = extraireChamp(fm, ['validator']) ?? null;
```

Injection dans `model/index.js` :
```js
donnees.bilanHumainsAgents = calculerBilanHumainsAgents(donnees);
```

## 5. Dépendances

- **SPEC-018-1** — modèle Intent enrichi stabilisé avant cette extension
- `lib/dashboard/collect.js:264` — extension du parser frontmatter
- `lib/dashboard/model/index.js` — injection
- `lib/dashboard/schema/data-v2.schema.json` — déclarer `bilanHumainsAgents`
- Gouvernance : AIAD-RGPD (noms de personnes = données personnelles — stockées localement, jamais transmises)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~600 tokens
- Fichiers source : `collect.js:243-280` (~40 lignes), `model/index.js:177-200` (~25 lignes), exemples frontmatter Intents existants
- **Total estimé** : ~1 600 tokens

## 7. Definition of Output Done (DoOD)

- [x] `lib/dashboard/intent-humans-agents.js` créé avec `calculerBilanHumainsAgents()` + `blocBilanHumainsAgents()`
- [x] `collect.js` étendu : lecture `executor` + `validator` (nullable, rétrocompat)
- [x] Injection dans `model/index.js`
- [x] Schéma `data-v2.schema.json` étendu (`bilanHumainsAgents`)
- [x] Test unitaire `test/dashboard-intent-humans-agents.test.js`
- [x] axe-core 0 violation sur le tableau rendu (pa11y WCAG2AA — 0 issues)
- [x] `@spec SPEC-018-4` + `@governance AIAD-RGPD` posés dans les fichiers touchés
- [x] `_index.md` mis à jour
- [x] `npx aiad-sdd drift-check` OK (0 gap bloquant)

## Note RGPD

Les champs `executor` et `validator` peuvent contenir des noms de personnes physiques. Règles :
- Traitement local uniquement — aucune transmission à un service tiers.
- Champs purement facultatifs — aucune obligation de renseignement.
- Pas de champ `email` ni identifiant permettant une identification indirecte au-delà du nom de rôle.
