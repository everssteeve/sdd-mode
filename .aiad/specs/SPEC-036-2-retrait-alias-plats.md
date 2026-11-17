---
id: SPEC-036-2
title: Retrait des alias plats en v2.0
parent_intent: INTENT-036
status: ready
format: prose
sqs: 5
author: Steeve Evers
date: "2026-11-15"
---

# SPEC-036-2-retrait-alias-plats

**Intent parent** : INTENT-036
**Auteur** : Steeve Evers *(rédaction : agent, 2026-11-15)*
**Statut** : ready — décision de l'auteur du 2026-11-15 : « alias plats à retirer »
**Format** : prose
**SQS** : 5/5 — auto-évaluation de l'agent ; la décision de retrait est celle de l'auteur

## 1. Contexte

Depuis la v1.7, chaque sous-commande des routers `/sdd` et `/aiad` avait un alias plat (`/sdd-spec`, `/aiad-status`…) annoncé comme retiré à la v2. La prochaine release est la 2.0.

## 2. Comportement Attendu

1. Le package ne livre plus, dans `.claude/commands/`, que `sdd.md`, `aiad.md` et `aiad-help.md`.
2. `aiad-sdd update` retire des projets installés les alias livrés en v1.x, et synchronise désormais les corps des sous-commandes (`.claude/sdd/`, `.claude/aiad/`). En `--check`, chaque alias restant est un drift, sans suppression.
3. `aiad-sdd upgrade <module>` ne copie plus d'alias et retire ceux qui restent ; le module `gouvernance` livre le router `/aiad`.
4. Un fichier n'est supprimé que s'il est reconnaissable comme livré : marqueur « alias rétro-compatible », ou contenu identique à la commande du profil minimal alors que le router la remplace.
5. Le profil `--minimal` garde ses quatre commandes plates : ce sont des commandes complètes, pas des alias.

### Cas limites

1. Commande `sdd-*.md` écrite ou modifiée par le projet → conservée.
2. Fichier portant le marqueur mais hors préfixe `sdd-` / `aiad-` → jamais touché.
3. Projet minimal sans router → rien n'est retiré.

## 3. Critères d'Acceptation

- [x] CA-001 — Seuls les routers et l'aide sont livrés (test).
- [x] CA-002 — Un alias livré est retiré ; routers et aide conservés (test).
- [x] CA-003 — Une commande du projet n'est jamais supprimée (test).
- [x] CA-004 — Commande minimale : conservée seule, retirée quand le router la remplace, conservée si modifiée (test).
- [x] CA-005 — Mode check : liste sans supprimer (test) ; `update` signale puis retire (test).

## 4. Limites connues

- Le marqueur de régénération `regenerate via /aiad-emit-rules` des fichiers générés est conservé tel quel : c'est une signature de détection, pas une commande.

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-11-15 | Création et implémentation. | Décision de l'auteur. |
