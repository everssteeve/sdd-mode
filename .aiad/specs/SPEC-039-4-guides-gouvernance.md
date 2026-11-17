---
id: SPEC-039-4
title: Guides de gouvernance — corrections vérifiées sur sources primaires
parent_intent: INTENT-039
status: draft
format: prose
author: Steeve Evers
date: "2026-11-17"
---

# SPEC-039-4-guides-gouvernance

**Intent parent** : INTENT-039
**Auteur** : Steeve Evers *(rédaction : agent, 2026-11-17)*
**Statut** : draft — Gate non tenue par un humain
**Format** : prose

## 1. Contexte

Les quatre guides de gouvernance livrés (RGAA, RGESN, AI Act, RGPD) ont un droit de veto sur le code. L'audit du 2026-11-17 y a relevé des erreurs réglementaires, confirmées le même jour sur les textes officiels (Journal officiel de l'UE, Légifrance, accessibilite.numerique.gouv.fr, arcep.fr, cnil.fr). Un outil utilisé en production ne peut pas opposer un veto fondé sur une référence fausse.

Par ailleurs, la version condensée de ces guides, émise pour Cursor, Kiro et Codex, était tronquée : l'expression régulière utilisait `\Z`, qui n'existe pas en JavaScript et vaut la lettre « Z ». Chaque section s'arrêtait à la première majuscule Z.

Le Drive fait foi (INTENT-034) : les corrections sont faites dans le corpus du Drive, publiées, puis synchronisées par `scripts/sync-doctrine.js`.

## 2. Comportement Attendu

1. Les 28 corrections vérifiées sont appliquées aux quatre guides du Drive, versions précédentes archivées, chaque correction tracée dans le journal « Évolutions du document » du guide avec la mention des sources consultées.
2. Les guides publiés sont synchronisés dans `templates/.aiad/gouvernance/` et `.aiad/gouvernance/`, et les règles émises régénérées.
3. La condensation d'un guide extrait chaque section jusqu'au titre suivant, quel que soit son contenu.
4. Le mapping AI Act ne présente plus `.aiad/metrics/` comme réponse aux articles 12 et 26(6) : ces obligations portent sur le système d'IA livré, pas sur le cycle de développement.

### Cas limites

1. Référence que la vérification n'a pas pu confirmer (texte lu par résumé, document non consulté) → le guide le dit explicitement et renvoie au texte consolidé.
2. Journal d'évolution d'un guide → l'historique n'est pas réécrit : les anciennes entrées gardent leur texte, la correction est une nouvelle entrée.

## 3. Critères d'Acceptation

- [x] CA-001 — Les erreurs relevées n'apparaissent plus dans le corps des guides livrés ; les références corrigées y figurent (test).
- [x] CA-002 — Une section contenant une majuscule Z est émise en entier (test).
- [x] CA-003 — `emit-rules --check` et le contrôle de doctrine du dépôt sont verts après synchronisation.

## 4. Limites connues

- Les guides n'ont pas été relus en entier sous l'angle juridique : seuls les passages signalés par l'audit l'ont été. Une relecture par un juriste reste nécessaire avant de présenter ces guides comme une référence.
- Références non revérifiées, signalées dans les guides : texte exact de l'article 47-1 de la loi 2005-102, loi REEN art. 28-29, décret 2022-1084, ordonnance 2023-1142.
- La séparation « ce que le produit doit implémenter » / « ce que le processus documente » et la matrice exigence → contrôle → preuve restent à faire pour l'ensemble des guides (lot 1.7 du plan).
