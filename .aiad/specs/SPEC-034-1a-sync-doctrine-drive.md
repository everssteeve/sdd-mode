---
id: SPEC-034-1a
title: Synchroniser agents de gouvernance, guides et dossiers de légitimation depuis le Drive publié
parent_intent: INTENT-034
status: ready
format: prose
sqs: 5
author: Steeve Evers
date: "2026-09-25"
---

# SPEC-034-1a-sync-doctrine-drive

**Intent parent** : INTENT-034
**Research** : RESEARCH-041 — GO (auteur) → CONDITIONAL GO (machine) ; conditions traitées ici : « écrasement chez les utilisateurs », « source lisible » ; décisions de l'auteur : synchroniser **agents + guides** ; liens vers les dossiers de légitimation publiés sur le dépôt GitHub public (option d, 2026-09-25)
**Auteur** : Steeve Evers *(rédaction : agent, 2026-09-25 — à valider à la Gate)*
**Date** : 2026-09-25
**Statut** : ready
**Format** : prose
**SQS** : 5/5 — Execution Gate OUVERTE (2026-09-26), Test de l'Étranger PASS

---

## 1. Contexte

Le Drive fait foi (INTENT-034). Le package livre aujourd'hui le Framework et le guide SDD Mode en v1.6, et des agents AIAD-AI-ACT et AIAD-RGPD périmés (Omnibus « PAS encore adopté »). Cette SPEC ajoute un script de synchronisation depuis la version **publiée** du Drive (`published/md/`, produite par le pipeline de publication) et enregistre une empreinte (`doctrine.lock.json`) que SPEC-034-2 contrôlera. Le comportement de `update` chez les utilisateurs relève de SPEC-034-1b.

## 2. Comportement Attendu

### Input

- Source : racine `published/md/` du Drive, fournie par `--source <chemin>` ou la variable `AIAD_DOCTRINE_SOURCE`.
- Correspondances (source → cible) :

| Source (`published/md/…`) | Cibles |
|---|---|
| `20_conception/gouvernance/AIAD-AI-ACT.md`, `AIAD-RGPD.md`, `AIAD-RGAA.md`, `AIAD-RGESN.md` | `templates/.aiad/gouvernance/` **et** `.aiad/gouvernance/` |
| `20_conception/framework/frameworkAIAD.md` | `templates/frameworkAIAD.md` |
| `20_conception/sdd-mode/SDDMode.md` | `templates/SDDMode.md` |
| `20_conception/framework/legitimation/conformite-cas-2026.md`, `execution-gate-evidence.md`, `responsabilite-evidence.md`, `verification-evidence.md` | `docs/legitimation/` |

### Processing

1. `scripts/sync-doctrine.js --source <chemin>` copie chaque fichier source vers ses cibles.
2. **Chemins relatifs** : tout chemin commençant par `../` — ainsi que tout chemin relatif relevant de la règle 1 (même sans `../`) — qu'il soit la cible d'un lien Markdown `[…](../…)` ou cité entre accents graves `` `../…` `` (forme utilisée par les agents v1.9, ex. `` `../framework/legitimation/conformite-cas-2026.md` ``) — est réécrit dans **tous** les fichiers cibles, selon la première règle qui s'applique (base `B` = `https://github.com/everssteeve/sdd-mode/blob/main/`) :

   | Cible du chemin | Réécriture |
   |---|---|
   | 1. tout chemin relatif dont les deux derniers segments sont `legitimation/<f>.md`, `<f>` étant l'un des quatre dossiers synchronisés — avec ou sans préfixe `../`, avec ou sans dossiers de tête (ex. `framework/legitimation/conformite-cas-2026.md`, `legitimation/verification-evidence.md`) | `B` + `docs/legitimation/<f>.md` |
   | 2. `../…/gouvernance/AIAD-<X>.md` | `B` + `templates/.aiad/gouvernance/AIAD-<X>.md` |
   | 1b. chemin `../…` dont le nom de fichier existe dans `docs/legitimation/` du dépôt cible (ex. `dette-maintenance-agentique.md`) ; liste lue dans le dépôt cible au moment de la synchronisation, avant toute écriture, unie aux quatre dossiers synchronisés | `B` + `docs/legitimation/<nom>` |
   | 3. toute autre cible `../…` (argumentaires, comparatif, `intention.md`…) | mention textuelle : un lien Markdown `[texte](../…)` devient `texte` ; un chemin entre accents graves devient `` `<nom-du-fichier>` (document publié avec le framework AIAD) `` |

   Restent inchangés : les noms nus (argumentaires cités par leur seul nom, `GLOSSAIRE-AIAD.md`, `intention.md`), les liens `./voisin.md` internes à `docs/legitimation/`, les mentions de fichiers projet (`CLAUDE.md`, `AGENTS.md`, `.aiad/…`) et les URL. Sur un lien Markdown ou entre accents graves, les règles 1, 1b et 2 remplacent le chemin en place (ancre `#…` conservée).

   Les URL pointent vers des fichiers du dépôt public ; elles ne sont pas résolues au moment de la synchronisation (aucun appel réseau).
3. **Agent CRA** : `AIAD-CRA.md` n'existe pas au Drive ; il n'est **ni supprimé ni modifié** (décision de l'auteur : « le CRA reste dans le package »).
4. Écrit `templates/doctrine.lock.json` : version de la doctrine (lue dans le titre H1 de `frameworkAIAD.md`, motif `Framework v<X.Y>`), date de synchronisation, et empreinte SHA-256 de chacun des 14 fichiers cibles **après** réécriture des liens.
5. Régénère les règles émises (`npx aiad-sdd emit-rules`), dont `.aiad/gouvernance/` est la source.

### Output

- Agents, guides et dossiers de légitimation à jour dans `templates/`, `.aiad/gouvernance/` et `docs/legitimation/` (14 fichiers cibles) ; `templates/doctrine.lock.json` ; règles émises régénérées.

### Cas limites

1. `--source` absent ou chemin inexistant → le script sort en erreur (code 2) sans rien écrire.
2. Un fichier source manquant → erreur (code 2), aucune écriture partielle (écriture après vérification de tous les fichiers).
3. Titre de `frameworkAIAD.md` sans motif `Framework v<X.Y>` → erreur (code 2).
4. `--dry-run` → liste des fichiers qui seraient écrits et des chemins réécrits, aucune écriture.

## 3. Critères d'Acceptation

- [x] CA-001 — Après `sync-doctrine --source <published/md>`, les quatre agents, les deux guides et les quatre dossiers de légitimation des cibles sont identiques à la source, aux chemins réécrits près.
- [x] CA-002 — `templates/.aiad/gouvernance/AIAD-AI-ACT.md` contient « 2026/1744 » et ne contient plus « PAS encore adopté ».
- [x] CA-003 — `templates/frameworkAIAD.md` a pour titre « Guide AIAD — Framework v1.9 ».
- [x] CA-004 — `templates/.aiad/gouvernance/AIAD-CRA.md` est inchangé (empreinte identique avant / après).
- [x] CA-005 — Aucun chemin commençant par `../` (lien Markdown ou entre accents graves) ne subsiste dans les 14 fichiers cibles.
- [x] CA-005b — Dans `templates/.aiad/gouvernance/AIAD-AI-ACT.md`, chaque référence au dossier « conformite-cas-2026 » est l'URL `https://github.com/everssteeve/sdd-mode/blob/main/docs/legitimation/conformite-cas-2026.md`, et ce fichier existe dans le dépôt (test sur fixture : toutes les règles de réécriture, dont la règle 1 étendue et le sous-cas 1b). *(2026-09-26, après extension de la règle 1 : PASS sur fixture et sur données réelles — les 6 références de AIAD-AI-ACT sont l'URL.)*
- [x] CA-006 — `templates/doctrine.lock.json` contient `doctrineVersion: "v1.9"` et une empreinte pour chacun des 14 fichiers cibles.
- [x] CA-007 — `--dry-run` ne modifie aucun fichier (test : empreintes identiques avant / après).
- [x] CA-008 — Cas limites 1 à 3 : sortie code 2, aucun fichier modifié (test).
- [x] CA-009 — Le contrôle CI `aiad-emit-rules-check` et `npm test` passent.

## 4. Interface / API

```
node scripts/sync-doctrine.js --source <chemin published/md> [--dry-run]
  exit 0 : synchronisé (liste des fichiers écrits)
  exit 2 : source invalide / fichier manquant / version illisible (rien d'écrit)

templates/doctrine.lock.json :
  { "doctrineVersion": "v1.9", "syncedAt": "<ISO>", "files": { "<cible>": "<sha256>" } }
```

## 5. Dépendances

- Aucune SPEC préalable. Bloque SPEC-034-2 (lit `doctrine.lock.json`) et INTENT-035. Indépendante de SPEC-034-1b.
- Réutilise : `lib/emit-rules.js`, `lib/fs-ops.js` ; motif de `lib/version-sync.js`.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~2 000 tokens
- Cette SPEC : ~2 200 tokens
- Fichiers source pertinents : `lib/version-sync.js` (motif), `lib/emit-rules.js` (appel), `scripts/`
- **Total estimé** : ~11 000 tokens

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing
- [x] Tests (CA-001 à CA-008)
- [x] `docs/legitimation/dette-maintenance-agentique.md` (absent du Drive) conservé tel quel
- [x] Synchronisation exécutée une fois depuis le Drive publié du 2026-09-25 ; lock commité
- [x] Annotations `@intent INTENT-034` / `@spec SPEC-034-1` / `@verified-by`
- [x] SPEC mise à jour si écart (Drift Lock)
- [ ] Code review passée
- [x] Gouvernance vérifiée (RGPD : aucune donnée personnelle ; RGESN : zéro dépendance)

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-09-25 | Question ouverte « cible des liens relatifs » tranchée par l'auteur : option (d). Ajout des quatre dossiers de légitimation aux cibles (`docs/legitimation/`), table de réécriture à trois règles, CA-005b. | Le dépôt est public ; l'inventaire du Drive publié montre des chemins `../` vers la légitimation, les agents, les argumentaires et `intention.md` — seuls les deux premiers ont un équivalent dans le dépôt. |
| 2026-09-26 | Gate : SPEC-034-1 découpée (Atomicité 0) ; cette partie = synchronisation + lock (mainteneur). Le comportement de `update` passe en SPEC-034-1b. Cibles comptées explicitement (14). | Décision de l'auteur. |
| 2026-09-26 | Execution Gate OUVERTE — SQS 5/5, Test de l'Étranger PASS. Statut → ready. | Scores validés par l'auteur. |
| 2026-09-26 | Exécution (agent) : `scripts/sync-doctrine.js` + `test/sync-doctrine.test.js` (20 tests) ; sync réelle depuis `published/md` (doctrine v1.9 : 12 cibles écrites, 2 déjà à jour ; réécritures sur les 14 cibles, règle 1/2/3 : 19/4/6) ; lock + règles émises régénérées. CA-001 à CA-009 cochés ; CA-005b coché sur fixture seulement. | Drift Lock. |
| 2026-09-26 | Écarts d'interprétation : (a) règles 1–2 sur un chemin entre accents graves : l'URL remplace le chemin **à l'intérieur** des accents graves ; ancre `#…` conservée ; (b) régénération via `emitRules()` de `lib/emit-rules.js` (équivalent de `npx aiad-sdd emit-rules`, cf. §5) ; (c) annotation `@spec SPEC-034-1a-sync-doctrine-drive` (la DoOD cite `SPEC-034-1`, antérieur au découpage) ; (d) compteurs de réécriture = occurrences dans les 14 cibles (un agent compte deux fois). | Précision non tranchée par la SPEC ; choix minimal. |
| 2026-09-26 | **Question ouverte (auteur)** : les chemins relatifs **sans** `../` ne sont pas couverts par §2 et restent tels quels : `framework/legitimation/conformite-cas-2026.md` (AIAD-AI-ACT l. 1146, AIAD-RGPD l. 1064 — lignes d'historique), `legitimation/*.md`, `GLOSSAIRE-AIAD.md`, argumentaires nommés seuls (frameworkAIAD.md). CA-005b « chaque référence » n'est donc pas satisfait à la lettre sur les données réelles. Étendre la réécriture ? | Non deviné par l'agent (Test de l'Étranger). |
| 2026-09-26 | Constat : `emit-rules --check` divergeait déjà avant la sync (22 fichiers, Intent actif INTENT-033) ; la régénération du script les remet en parité. | Information. |
| 2026-09-26 | Règle 1 étendue (décision de l'auteur, réponse à la question ouverte ci-dessus) : tout chemin relatif `[…/]legitimation/<f>.md` (4 dossiers synchronisés) → URL, avec ou sans `../` ; nouveau sous-cas 1b : chemin `../` dont le nom existe dans `docs/legitimation/` du dépôt cible → URL (ex. `dette-maintenance-agentique.md`). Noms nus, `./voisin.md`, fichiers projet inchangés. Resync réelle : 6 cibles réécrites ; réécritures règle 1/1b/2/3 : 27/1/4/5 ; 0 référence de légitimation hors URL (hors liens `./voisin.md`). CA-005b coché. | Liens de légitimation cohérents avec le dépôt public ; aucune référence résiduelle non résolue. |
| 2026-09-26 | Resynchronisation après correction de la source publiée (AIAD-AI-ACT : nom de client retiré de l'avertissement final ; SDDMode.md passé en v1.20) ; `doctrine.lock.json` mis à jour. | Audit pré-publication npm (INTENT-035). |
