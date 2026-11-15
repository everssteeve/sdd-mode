# INTENT-037-dashboard-par-role

**Auteur** : Steeve Evers
**Date** : 2026-11-15
**Statut** : active

> Transcription des mots de l'auteur, recueillis le 2026-11-15 en deux temps : la consigne initiale (OBJECTIF, POUR QUI, CONTRAINTES), puis sa réponse (POURQUOI MAINTENANT, CRITÈRE DE DRIFT). Aucun champ n'a été rédigé par l'agent.

**Titre** : Refondre le dashboard — une vision globale et un onglet par rôle, avec un design system moderne

---

## POURQUOI MAINTENANT

« car je veux rendre opérationnel ce dashboard, à date il n'est pas utilisé » *(réponse de l'auteur du 2026-11-15 ; fautes de frappe corrigées, mots inchangés)*

## POUR QUI

« 5 onglets principaux (1 par role) »

## OBJECTIF

« modifie entièrement le dashboard qui doit maintenant comporter 5 onglets principaux (1 par role) et une page principale permettant d'avoir une vision globale sur l'application en cours de dev. »

## CONTRAINTES

- « Le design system du dashboard doit être moderne et donner envie de l'utiliser. »

## CRITÈRE DE DRIFT

« le dashboard n'est pas utilisé » *(réponse de l'auteur du 2026-11-15)*

---

## Contexte factuel (relevé par l'agent — ne fait pas partie de l'intention)

- Avant ce changement : 20 pages à plat dans une barre latérale, dont un cockpit PM et une page QA ; aucun cockpit pour le Product Engineer, l'Agents Engineer ni le Tech Lead.
- Le balisage des blocs existants (≈ 180 modules) repose sur un vocabulaire de classes et de variables CSS partagé.
- La consigne est donnée dans le prolongement d'INTENT-036 (agents de rôle) : les onglets reprennent les cinq responsabilités et leurs assistants.

## Cycle SDD — ce qui a été fait et ce qui ne l'a pas été

- **Research** : non conduite comme phase séparée ; conception et implémentation demandées dans la même consigne.
- **Execution Gate** : SPEC-037-1 implémentée avant validation, puis **validée par l'auteur le 2026-11-15** (« je valide »).
- « Donner envie de l'utiliser » n'est pas vérifiable par un test : seul l'auteur peut en juger, sur pièces.
- **Critère de drift mesuré par SPEC-037-2** : le serveur local compte les consultations ; au-delà de 14 jours sans consultation mesurée, une alerte est levée. Un dashboard ouvert en fichier statique ou publié n'est pas compté.

## Contrôle Human Authorship (skill `human-authorship-check`, 2026-11-15)

```
✅ HUMAN AUTHORSHIP — validé
Auteur : Steeve Evers
Intent : INTENT-037
Note : les cinq champs sont les mots de l'auteur (consigne puis réponse du 2026-11-15).
Historique : premier contrôle partiel — POURQUOI MAINTENANT et CRITÈRE DE DRIFT absents, laissés vides par l'agent,
puis fournis par l'auteur.
```
