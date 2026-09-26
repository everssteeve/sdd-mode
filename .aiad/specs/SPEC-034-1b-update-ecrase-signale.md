---
id: SPEC-034-1b
title: update — écraser les agents de gouvernance mais signaler, avec sauvegarde des modifications locales
parent_intent: INTENT-034
status: ready
format: prose
sqs: 5
author: Steeve Evers
date: "2026-09-26"
---

# SPEC-034-1b-update-ecrase-signale

**Intent parent** : INTENT-034
**Research** : RESEARCH-041 — GO (auteur) → CONDITIONAL GO (machine) ; condition traitée ici : « écrasement chez les utilisateurs » ; décision de l'auteur : `update` **écrase mais signale** (sauvegarde)
**Auteur** : Steeve Evers *(rédaction : agent, 2026-09-26 — issue du découpage de SPEC-034-1 à la Gate)*
**Date** : 2026-09-26
**Statut** : ready
**Format** : prose
**SQS** : 5/5 — Execution Gate OUVERTE (2026-09-26), Test de l'Étranger PASS

---

## 1. Contexte

`update` réécrit aujourd'hui les agents de gouvernance (`.aiad/gouvernance/AIAD-*.md`) sans condition : une adaptation locale faite par un utilisateur est perdue sans avertissement. Avec la resynchronisation de la doctrine (SPEC-034-1a), la prochaine version livrera des agents très modifiés. Cette SPEC rend l'écrasement **visible et réversible**, sans renoncer à livrer la doctrine à jour.

## 2. Comportement Attendu

### Input

- Les agents livrés (`templates/.aiad/gouvernance/AIAD-*.md`) et ceux du projet utilisateur (`.aiad/gouvernance/AIAD-*.md`).
- Le manifeste `.aiad/gouvernance/.aiad-shipped.json` du projet, s'il existe.

### Processing

1. `init` et `update` écrivent `.aiad/gouvernance/.aiad-shipped.json` : empreinte SHA-256 de chaque agent **tel que livré**.
2. Avant d'écraser un agent, `update` détermine s'il a été modifié localement :
   - manifeste présent → le fichier local diffère de l'empreinte enregistrée pour ce fichier ;
   - manifeste absent (projet installé avant cette version) → le fichier local diffère du nouveau gabarit livré.
3. Agent modifié localement → copie du fichier local en `AIAD-<X>.md.bak-<AAAA-MM-JJ>` dans le même dossier, **puis** écrasement. Si ce nom existe déjà, suffixe `-2`, `-3`… (aucune sauvegarde n'est écrasée).
4. En fin de bloc « Gouvernance », `update` affiche la liste des agents sauvegardés avec le chemin de chaque sauvegarde, et une ligne invitant à reporter les adaptations locales.
5. Un agent présent localement mais absent du package (ex. agent ajouté par l'utilisateur) n'est ni modifié ni sauvegardé.

### Output

- Agents à jour ; sauvegardes `.bak-<date>` des agents modifiés localement ; manifeste réécrit ; message listant les sauvegardes.

### Cas limites

1. Agent local identique à l'empreinte livrée → écrasé sans sauvegarde ni message.
2. `update --check` → comportement inchangé (liste des divergences, aucune écriture, aucun manifeste).
3. Deux `update` le même jour sur un agent modifié → deux sauvegardes distinctes (`.bak-<date>`, `.bak-<date>-2`).
4. Manifeste illisible (JSON invalide) → traité comme absent (règle du point 2, second tiret), et réécrit.

## 3. Critères d'Acceptation

- [x] CA-001 — Après `init`, `.aiad/gouvernance/.aiad-shipped.json` contient une empreinte pour chaque agent installé (test).
- [x] CA-002 — Un agent modifié localement est copié en `.bak-<date>` avec son contenu local exact, puis remplacé par le gabarit (test).
- [x] CA-003 — Un agent non modifié est remplacé sans création de sauvegarde (test).
- [x] CA-004 — La sortie de `update` contient le nom de chaque agent sauvegardé et le chemin de sa sauvegarde (test sur stdout).
- [x] CA-005 — Sans manifeste, un agent différent du nouveau gabarit est sauvegardé ; un agent identique ne l'est pas (test).
- [x] CA-006 — Deux exécutions le même jour produisent deux sauvegardes distinctes (test).
- [x] CA-007 — `update --check` n'écrit aucun fichier (test : empreintes du dossier identiques avant / après).
- [x] CA-008 — Un agent absent du package (ex. `AIAD-CUSTOM.md`) est inchangé et non sauvegardé (test).
- [x] CA-009 — `npm test` passe sans régression.

## 4. Interface / API

```
.aiad/gouvernance/.aiad-shipped.json (projet utilisateur) :
  { "<AIAD-X.md>": "<sha256 livré>" }

Sortie update (bloc Gouvernance), si ≥ 1 sauvegarde :
  ⚠ N agent(s) modifié(s) localement — sauvegardé(s) avant mise à jour :
      AIAD-<X>.md → .aiad/gouvernance/AIAD-<X>.md.bak-<AAAA-MM-JJ>
    Reportez vos adaptations dans les agents mis à jour.
```

## 5. Dépendances

- Aucune SPEC préalable ; indépendante de SPEC-034-1a. Doit être livrée avant la réactivation npm (INTENT-035), puisque la première version réactivée écrasera les agents.
- Réutilise : `lib/update.js` (bloc « Gouvernance »), `lib/init.js` (installation gouvernance), `lib/fs-ops.js`, `node:crypto`.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~2 000 tokens
- Cette SPEC : ~1 500 tokens
- Fichiers source pertinents : `lib/update.js` (bloc gouvernance), `lib/init.js` (bloc gouvernance), tests existants de `update`
- **Total estimé** : ~10 000 tokens

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing
- [x] Tests CA-001 à CA-008
- [x] Annotations `@intent INTENT-034` / `@spec SPEC-034-1b` / `@verified-by`
- [x] SPEC mise à jour si écart (Drift Lock)
- [ ] Code review passée
- [x] Gouvernance vérifiée (RGPD : aucune donnée personnelle ; RGESN : zéro dépendance)

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-09-26 | Création par découpage de SPEC-034-1 (point 6 et cas limites 4-5 d'origine) ; ajouts : suffixe anti-écrasement des sauvegardes, agent absent du package, manifeste illisible. | Décision de l'auteur à la Gate (Atomicité 0 sur SPEC-034-1). |
| 2026-09-26 | Execution Gate OUVERTE — SQS 5/5, Test de l'Étranger PASS. Statut → ready. | Scores validés par l'auteur. |
| 2026-09-26 | Implémentation (`lib/governance-shipped.js`, `lib/update.js`, `lib/init.js`, `test/governance-shipped.test.js`). Précisions : (a) manifeste présent mais sans entrée pour un agent livré → règle « manifeste absent » (comparaison au nouveau gabarit) pour cet agent ; (b) date des sauvegardes = date UTC du jour, injectable via `update(dir, { date })` ; (c) `update` renvoie aussi `stats.backups` (chemins relatifs). | Cas non couvert explicitement par le point 2 ; choix conservateur (aucune adaptation perdue). À valider par l'auteur. |
