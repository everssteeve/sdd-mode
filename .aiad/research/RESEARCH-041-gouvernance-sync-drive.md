---
id: RESEARCH-041
intent: INTENT-034
author: Steeve Evers
date: 2026-09-25
status: go
---

# RESEARCH-041 — Synchroniser la doctrine livrée par le package sur le Drive, qui fait foi  (← INTENT-034)

> Phase Research (§3.5). Discovery réalisée par l'agent en lecture seule le 2026-09-25 ; **le verdict appartient à l'auteur** (ligne « Verdict » ci-dessous, non remplie par l'agent).

## Discovery (ancrage code — agent Explore, read-only)

- **Fichiers / zones impactés** :
  - `templates/.aiad/gouvernance/` — agents installés chez les utilisateurs. Comparaison avec le corpus Drive (`01_ENTITIES/aiad-produits/20_conception/gouvernance/`, v1.9, 2026-09-25) :

    | Agent | Package | Drive | État |
    |---|---|---|---|
    | AIAD-AI-ACT | 7 932 mots | 10 716 mots | **périmé** — annonce l'Omnibus « PAS encore adopté », sans le Règlement (UE) 2026/1744 |
    | AIAD-RGPD | 7 016 mots | 7 838 mots | **périmé** — sans l'Art. 22 (cas Uber), ni la grille CNIL / CIANum |
    | AIAD-RGAA | 5 212 mots | 5 212 mots | identique au Drive |
    | AIAD-RGESN | 4 345 mots | 4 345 mots | identique au Drive |
    | AIAD-CRA | 3 240 mots | absent | propre au package (Règlement (UE) 2024/2847 ; signalement des vulnérabilités exploitées depuis le 11 septembre 2026) |

  - `templates/frameworkAIAD.md:1` — **« Guide AIAD — Framework v1.6 », mai 2026** ; `templates/SDDMode.md:1` — **« AIAD SDD Mode — v1.6 »**. Le Drive est en Framework v1.9 : le package livre une doctrine en retard de trois cycles.
  - `.aiad/gouvernance/` (dépôt) : identique octet pour octet à `templates/.aiad/gouvernance/` pour les cinq agents.
  - `lib/update.js:85-100` — « Gouvernance (**TOUJOURS écrasée** — vient du package) » : `update` remplace les cinq agents chez l'utilisateur (`addGovernance(…, { force: true, silencieux: true })`) ; le mode `--check` liste les divergences sans écrire.
  - `lib/emit-rules.js:11` — source de vérité des règles émises (CLAUDE.md, AGENTS.md…) : `.aiad/gouvernance/*.md` → toute synchronisation régénère ces fichiers.
  - `lib/version-sync.js:1-20` (INTENT-013) — mécanisme existant qui garantit que les zones `<!--VERSION:START-->…<!--VERSION:END-->` restent égales à la version de `package.json` (mode `--check` pour la CI). Réutilisable.
- **Contraintes existantes** :
  - `evidence:` **deux numérotations coexistent** : version du logiciel (`package.json` : 1.19.0) et version de la doctrine (Framework AIAD : v1.9 au Drive, v1.6 dans le package).
  - `evidence:` les agents v1.9 du Drive contiennent des **liens relatifs vers les dossiers de légitimation** (`../framework/legitimation/…` : 6 dans AIAD-AI-ACT, 3 dans AIAD-RGPD). Ces chemins n'existent pas dans un projet utilisateur : copiés tels quels, ils seraient cassés.
  - Le corpus Drive n'est pas versionné dans git ; le dépôt l'est.
- **Surface de test existante** : `test/version-sync.test.js`, tests de `lib/update.js` et `lib/emit-rules.js` (`test/*update*`, `test/*emit*`), mode `update --check`.

## Faisabilité

Réalisable. La synchronisation proprement dite est simple (copie de AIAD-AI-ACT et AIAD-RGPD depuis le Drive, réécriture des liens relatifs vers des URL publiques aiad.ovh). Le point structurant est le **contrôle de drift** demandé par ton critère : un contrôle automatique, sur le modèle de `version-sync --check`, qui compare à chaque release ce que livre le package à ce que publie le Drive, et échoue en cas d'écart. Le Drive n'étant pas dans git, ce contrôle doit lire une source publiée et stable (le dossier `published/md/` généré par `publish-aiad`, ou le site aiad.ovh).

## Décisions de l'auteur (2026-09-25)

- **« la version de aiad »** : la **version de la doctrine** (Framework vX) **et le contenu** des fichiers livrés doivent être identiques à ceux publiés depuis le Drive.
- **périmètre** : les **agents de gouvernance et les guides livrés** (`templates/frameworkAIAD.md`, `templates/SDDMode.md`).

## Risques & inconnues

- **Écrasement chez les utilisateurs** : `update` écrase toujours les agents de gouvernance. Diffuser la v1.9 passera par là ; un utilisateur qui aurait adapté un agent perdra ses modifications. (Contrainte proposée puis retirée de l'Intent : à arbitrer en SPEC comme choix de conception.)
- **Source lisible par le contrôle** : le Drive n'est pas versionné ; le contrôle doit s'appuyer sur `published/` ou sur le site.
- **Context packs** (internes, mars 2026) : troisième source, hors du dépôt — hors périmètre de cette Research, mais elle subsiste.

## Verdict : GO

*Tranché par l'auteur, Steeve Evers, le 2026-09-25 : « GO pour les deux ».*

> Recommandation de l'agent (non contraignante) : **GO**, sur le modèle de `version-sync --check`. Les inconnues ont été tranchées par l'auteur le 2026-09-25 ; la Discovery est ancrée ; aucun obstacle technique.

