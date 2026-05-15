# PRD : tinr.ly — URL shortener souverain

> Ce fichier est la source de vérité produit. Il est injecté en contexte agent lors des phases de cadrage uniquement.
> Mainteneur : Product Manager

## 1. Contexte et Problème

**Situation actuelle** : les équipes SMB EU utilisent bit.ly / TinyURL, services US-centric posant un risque RGPD (transferts hors EU, retention ≠ CNIL) et zéro contrôle souverain sur les liens et logs.

**Qui ressent le problème** : équipes marketing SMB, RSSI, DPO de TPE/PME.

**Impact business** : 38 % des leads marketing perdus à cause des bloqueurs sécurité ; 12 audits CNIL ouverts au Q1 sur les fournisseurs URL shortener.

## 2. North Star / Product Goal

Devenir le raccourcisseur d'URL européen de référence : 10 000 utilisateurs actifs / mois en 12 mois, 100 % hébergement EU, RGPD by design.

## 3. Personas et Use Cases

| Persona | Besoin | Résultat attendu |
|---------|--------|------------------|
| Marketing EU | Raccourcir un lien tracker pour campagne email | URL courte créée en moins de 3 s, analytics 30j conformes RGPD |
| RSSI | Auditer l'usage de URL shorteners dans l'entreprise | Tableau de bord conformité avec logs souverains |
| Acheteur SMB | Acheter un plan annuel | Facture conforme EU, paiement SEPA, support FR |
| Dev API consumer | Intégrer le shortener à son outil maison | API REST documentée OpenAPI 3.1 |

## 4. Outcome Criteria (Mesurables)

| Critère | Baseline | Cible | Méthode |
|---------|----------|-------|---------|
| Latence p95 redirect | 180 ms | < 50 ms | sondes synthétiques |
| Conversion checkout | 62 % | > 70 % | analytics interne |
| Rétention J+30 | 38-52 % | >= 55 % stable | cohortes hebdo |
| Drop-off onboarding mobile | 38 % | < 20 % | analytics funnel |

## 5. Périmètre

### In Scope
- Création / redirect / analytics 30j
- Plans payants SMB SEPA
- API REST + SDK JS

### Out of Scope
- Plan enterprise (multi-tenant) — v2
- Plan gratuit illimité — bridé à 100 liens/mois

## 6. User Stories (Prioritaires)

```
US-001 | MUST   | Marketing EU peut créer une URL courte en moins de 3 s → Outcome : Latence p95 < 50 ms
US-002 | MUST   | Acheteur SMB peut payer son plan annuel SEPA → Outcome : Conversion checkout > 70 %
US-003 | MUST   | Utilisateur mobile peut s'inscrire en moins de 30 s → Outcome : Drop-off onboarding < 20 %
US-004 | SHOULD | Marketing EU peut consulter analytics 30j → Outcome : Rétention J+30 >= 55 %
US-005 | SHOULD | Dev peut intégrer via API REST documentée → Outcome : 100 % endpoints couverts OpenAPI
US-006 | COULD  | RSSI peut auditer les liens créés → Outcome : Logs exportables CSV/JSON
```

## 7. Trade-offs et Décisions Clés

| Décision | Raison | Coût / Bénéfice |
|----------|--------|-----------------|
| Hébergement OVH FR uniquement | Souveraineté EU stricte | -20 % perf APAC / +0 risque RGPD |

## 8. Dépendances et Risques

**Dépendances externes** : OVH Cloud (hébergement), Stripe (paiement SEPA)

**Risques** : Concurrence bit.ly EU edition — Mitigation : positionnement souverain + audit CNIL pré-monté

## 9. Évolution Prévue (v2)

Multi-tenant enterprise + plans agence + custom domains 100 €/mois.
