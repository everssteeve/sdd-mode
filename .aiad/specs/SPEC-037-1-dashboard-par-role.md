---
id: SPEC-037-1
title: Dashboard par responsabilité — vue d'ensemble, cinq onglets de rôle, nouveau design system
parent_intent: INTENT-037
status: ready
format: prose
sqs: 4
author: Steeve Evers
date: "2026-11-15"
---

# SPEC-037-1-dashboard-par-role

**Intent parent** : INTENT-037
**Research** : non conduite (voir INTENT-037)
**Auteur** : Steeve Evers *(rédaction : agent, 2026-11-15)*
**Date** : 2026-11-15
**Statut** : ready — implémentée sur demande explicite de l'auteur, puis validée par lui le 2026-11-15
**Format** : prose
**SQS** : 4/5 — évalué par l'agent, **validé par l'auteur le 2026-11-15** (point faible assumé : Atomicité)

---

## 1. Contexte

Le dashboard HTML (`aiad-sdd dashboard`) présentait 20 pages à plat dans une barre latérale. Depuis INTENT-036, chaque responsabilité AIAD a son assistant ; le dashboard doit suivre la même organisation et donner d'abord une vision globale de l'application en cours de développement.

### Contexte pour un lecteur extérieur

Le dashboard est un site statique généré dans `dashboard/` : `lib/dashboard.js` collecte les données de `.aiad/`, chaque page est rendue par une fonction, puis enveloppée par `layout()` (`lib/dashboard/render.js`). Le style vient d'une feuille unique `assets/style.css`. Aucune dépendance, aucune ressource externe.

## 2. Comportement Attendu

### Input

- Les données collectées (`collecterDonnees`) ; le registre des agents (`lib/agents-registry.js`).

### Processing

1. **Navigation** (`lib/dashboard/navigation.js`) : six onglets — « Vue d'ensemble », puis Product Manager, Product Engineer, Agents Engineer, QA Engineer, Tech Lead. Chaque page appartient à un seul onglet ; les pages d'un onglet forment sa sous-navigation.

   | Onglet | Pages |
   |--------|-------|
   | Vue d'ensemble | index, today, inbox, changelog, onboarding |
   | Product Manager | pm, intents |
   | Product Engineer | pe *(nouveau)*, specs, kanban, traceability, drifts |
   | Agents Engineer | ae *(nouveau)*, governance, eco |
   | QA Engineer | qa, legal, dpo |
   | Tech Lead | tl *(nouveau)*, adrs, metrics, sre, graph |

2. **Coquille** (`layout()`) : barre supérieure (marque, onglets avec pastille du nombre de signaux à traiter, fraîcheur, bascule de thème), sous-navigation de l'onglet courant avec le nom de l'assistant, en-tête de page, contenu, pied. Une page de détail (`intent-…`, `spec-…`) est rattachée à l'onglet de sa liste.
3. **Vue d'ensemble** (`index.html`) : héros (nom, version, maturité, santé globale, nombre de signaux), cycle SDD en six étapes chiffrées, cinq cartes de responsabilité (trois chiffres, signaux à traiter, lien vers le cockpit), alertes, puis les sections existantes.
4. **Cockpits** : `pe.html`, `ae.html`, `tl.html` créés ; `pm.html` et `qa.html` conservés. Chaque cockpit s'ouvre sur la carte « Votre assistant » (agent de rôle, commande `claude --agent`, sous-agents) et liste les signaux de son périmètre.
5. **Ventilation des alertes** : une alerte appartient à l'onglet de la page vers laquelle elle renvoie.
6. **Design system** (`design-tokens.js`, `design-components.js`) : tokens clair / sombre, une couleur par responsabilité, typographie système, cartes à ombre douce, pastilles, héros en dégradé. Les sélecteurs et variables CSS historiques sont conservés : les blocs existants changent d'apparence sans changer de balisage.
7. **Honnêteté des chiffres** : une donnée absente s'affiche « — ». Un SQS absent n'est pas compté comme 0 ; un gabarit de SPEC n'est pas compté comme une SPEC.

### Output

- 23 pages principales (20 conservées + 3 cockpits), pages de détail inchangées, `style.css` réécrit.

### Cas limites

1. Données partielles ou vides → aucune exception ; cockpits rendus avec des tirets.
2. Équipe d'agents non installée dans le projet → cockpit AE : « équipe non installée », conformité « — ».
3. Page inconnue (404) → onglet « Vue d'ensemble ».
4. Nom de projet contenant du HTML → échappé partout.
5. Thème sombre par réglage système ou bascule manuelle ; `prefers-reduced-motion` respecté ; impression sans navigation.

## 3. Critères d'Acceptation

- [x] CA-001 — Six onglets : vue d'ensemble puis un par rôle, alignés sur le registre des agents (test).
- [x] CA-002 — Chaque page appartient à un seul onglet ; les 20 pages historiques sont conservées (test).
- [x] CA-003 — Rattachement des pages de détail et des liens d'alerte à leur onglet (test).
- [x] CA-004 — `layout()` rend les onglets, la sous-navigation du seul onglet courant, l'état actif, le lien d'évitement (test).
- [x] CA-005 — Contenu échappé ; données partielles tolérées (test).
- [x] CA-006 — Feuille unique sans ressource externe ; une couleur par responsabilité dans les deux thèmes (test).
- [x] CA-007 — Contrastes AA (≥ 4,5:1) des couples texte / fond dans les deux thèmes (test calculé).
- [x] CA-008 — Sélecteurs et variables CSS historiques conservés (test).
- [x] CA-009 — Focus visible, mouvement réduit, impression, thème sombre (test).
- [x] CA-010 — Carte assistant : agent, commande, sous-agents du seul rôle concerné (test).
- [x] CA-011 — `resumeRoles` : cinq rôles, trois chiffres, alertes ventilées ; non mesuré = tiret (test).
- [x] CA-012 à CA-014 — Cockpits PE, AE, Tech Lead : chiffres dérivés des données (tests).
- [x] CA-015 — Vue d'ensemble : héros, cycle, cinq cartes liées à leur cockpit, sections historiques présentes (test).
- [x] CA-016 — `npm test` et les lints passent.

## 4. Points d'arrêt de l'agent

- Supprimer une page ou un bloc existant : hors périmètre, à décider par l'auteur.
- « Donner envie de l'utiliser » : jugement de l'auteur, sur captures et sur le dashboard généré.

## 5. Limites connues

- **Contrôle visuel partiel.** Vue d'ensemble, cockpits PE / AE / Tech Lead et PM regardés dans un navigateur (bureau clair et sombre, mobile). Les 17 autres pages héritent du style sans avoir été relues une à une.
- **Accessibilité.** Contrastes des tokens calculés par test ; l'audit pa11y de la CI n'a pas été rejoué en local.
- **Cockpit AE.** L'utilité réelle des agents (usage, corrections, faux positifs) n'y figure pas : ce n'est pas collecté.
- **Usage.** Le critère de drift de l'Intent est « le dashboard n'est pas utilisé ». Sa mesure est traitée par SPEC-037-2 (serveur local uniquement).
- **Couleurs en ligne.** Certains blocs anciens posent des couleurs en style inline ; ils n'ont pas été repris.

## 6. Dépendances

- `lib/agents-registry.js`, `lib/agents.js` (INTENT-036) ; blocs existants de `lib/dashboard/`.

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing
- [x] Tests CA-001 à CA-015
- [x] Annotations `@intent INTENT-037` / `@spec SPEC-037-1-dashboard-par-role`
- [x] SPEC et code dans le même changement (Drift Lock)
- [x] SPEC validée par l'auteur (2026-11-15, après implémentation)
- [ ] Audit pa11y rejoué
- [x] Gouvernance : RGAA (contrastes, focus, lien d'évitement, mouvement réduit) ; RGESN (zéro ressource externe, polices système)

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-11-15 | Création et implémentation dans la même session. SQS auto-évalué 4/5 (Atomicité 0 : navigation, coquille, trois cockpits et design system dans une seule SPEC). Correctif associé : un SQS absent n'est plus traité comme 0 dans les alertes. | Consigne de l'auteur du 2026-11-15. |
| 2026-11-15 | Validation par l'auteur (« je valide »), en l'état, sans découpage. Statut → ready. | Réponse de l'auteur, conditionnée à la mise en place de la mesure d'usage (SPEC-037-2). |
