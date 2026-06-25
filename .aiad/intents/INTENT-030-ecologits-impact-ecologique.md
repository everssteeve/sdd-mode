# INTENT-030-ecologits-impact-ecologique

**Auteur** : Steeve Evers
**Date** : 2026-06-24
**Statut** : done

---

## POURQUOI MAINTENANT

L'engagement RGESN est au cœur d'AIAD SDD Mode. Mesurer et réduire l'empreinte écologique des cycles de développement IA n'est pas une option cosmétique — c'est une cohérence avec les valeurs fondatrices du framework (Sobriété Intentionnelle, Responsabilité Partagée). EcoLogits fournit aujourd'hui une bibliothèque mature pour instrumenter les appels LLM et produire des estimations kgCO₂eq exploitables.

## POUR QUI

Les utilisateurs de SDD Mode — Product Engineers, équipes de développement IA — qui veulent aligner leurs pratiques de développement avec leur engagement RGESN et disposer de données concrètes sur l'impact de leurs cycles SDD.

## OBJECTIF

Réduire de **10 %** l'impact écologique d'un cycle SDD complet dans les **6 mois** suivant la mise en œuvre, en rendant l'empreinte mesurable (kgCO₂eq) à chaque commande et visible dans les rapports et dashboards AIAD.

## CONTRAINTES

- EcoLogits doit être intégré de façon **non-intrusive** : opt-in ou activation transparente, aucune régression sur les commandes existantes.
- Compatibilité avec les runtimes déjà supportés (Claude Code, Cursor, Codex, Gemini).
- L'estimation CO₂ doit rester **indicative** (pas certifiée Bilan Carbone) — le libellé doit l'exprimer clairement pour éviter le greenwashing (AIAD-AI-ACT, AIAD-RGPD).
- Pas de dépendance réseau obligatoire : EcoLogits doit pouvoir fonctionner hors-ligne (calcul local).

## CRITÈRE DE DRIFT

L'implémentation a dérivé si l'un de ces signaux est absent :
- EcoLogits **absent** du rapport `/sdd validate`
- Aucun **badge CO₂** dans le dashboard AIAD (`/aiad dashboard` et `/aiad dashboard-html`)
- Les commandes SDD ne retournent **pas** les impacts en kgCO₂eq à la fin de leur exécution

---

## SPECs liées

| SPEC | Titre | Statut |
|------|-------|--------|
| SPEC-030-1 | eco-estimator — algorithme JS natif + eco-models.json | done |
| SPEC-030-2 | hook-stop — capture harness Stop → hook-runs.jsonl | done |
| SPEC-030-3 | validate-badge — badge CO₂ dans /sdd validate | done |
| SPEC-030-4 | dashboard-eco — page eco.html + widget metrics.html | done |
