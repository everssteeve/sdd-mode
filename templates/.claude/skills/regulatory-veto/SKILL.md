---
name: regulatory-veto
description: Use when validating code, a SPEC or an Intent against the 4 Tier 1 governance agents (AI-ACT, RGPD, RGAA, RGESN). Emits PASS / WARN / VETO with structured remediation. Triggered by /sdd validate, /sdd security, /sdd exec, /aiad gouvernance.
---

# Skill — Regulatory Veto (Tier 1 Governance)

> Les 4 AGENT-GUIDEs Tier 1 ont droit de **veto** sur toute livraison non conforme.
> Cette skill applique ce veto de manière homogène, sans avoir à dupliquer la logique dans chaque commande.

## Quand l'utiliser

- Avant un merge (`/sdd validate`, `/sdd drift-check`)
- Pendant un audit sécurité (`/sdd security`)
- Lors de l'assemblage du contexte agent (`/sdd exec`)
- Sur demande explicite (`/aiad gouvernance`)

## Agents Tier 1 (droit de veto)

| Agent | Périmètre | Source |
|-------|-----------|--------|
| **AIAD-AI-ACT** | Composants IA (LLM, ML, scoring, génération) | `@.aiad/gouvernance/AIAD-AI-ACT.md` |
| **AIAD-RGPD** | Données personnelles (collecte, traitement, transfert) | `@.aiad/gouvernance/AIAD-RGPD.md` |
| **AIAD-RGAA** | Interface utilisateur accessible | `@.aiad/gouvernance/AIAD-RGAA.md` |
| **AIAD-RGESN** | Écoconception numérique | `@.aiad/gouvernance/AIAD-RGESN.md` |

## Procédure

### Étape 1 — Qualification d'applicabilité

Pour chaque agent, répondre OUI/NON :

| Agent | Question de qualification |
|-------|---------------------------|
| AI-ACT | Le code traite-t-il un composant IA générant prédictions, recommandations, décisions ou contenus ? |
| RGPD | Le code manipule-t-il des données personnelles (identifiant, comportement, biométrie, etc.) ? |
| RGAA | Le code rend-il une interface utilisateur (web, mobile, kiosque) ? |
| RGESN | Le code consomme-t-il des ressources serveur, réseau ou client significatives ? |

### Étape 2 — Application des règles Tier 1

Pour chaque agent **applicable** :
1. Lire le fichier source `.aiad/gouvernance/AIAD-<AGENT>.md` (outil `Read`).
2. Appliquer l'« Étape 0 — Qualification obligatoire » de chaque guide.
3. Identifier la catégorie de risque (interdit / haut / limité / minimal).
4. Vérifier les **JAMAIS** absolus du guide.

### Étape 3 — Verdict

| Niveau | Critère | Action |
|--------|---------|--------|
| 🚫 **VETO** | Pratique interdite (Art. 5 AI-ACT) OU exposition critique de données personnelles OU non-conformité bloquante RGAA niveau A | Stop merge + escalade direction |
| ⚠️ **WARN** | Risque haut/limité non bloquant OU obligation de transparence non implémentée | Documenter + plan de remédiation avant merge |
| ✅ **PASS** | Conforme ou non applicable | Continuer |

## Output

```
GOUVERNANCE TIER 1 — [SPEC-NNN ou changeset]
═══════════════════════════════════════════
| Agent     | Applicable | Verdict | Risques détectés                  |
|-----------|-----------|---------|-----------------------------------|
| AI-ACT    | OUI/NON   | ✅/⚠️/🚫 | [...]                             |
| RGPD      | OUI/NON   | ✅/⚠️/🚫 | [...]                             |
| RGAA      | OUI/NON   | ✅/⚠️/🚫 | [...]                             |
| RGESN     | OUI/NON   | ✅/⚠️/🚫 | [...]                             |

Verdict global : PASS / WARN / VETO

Plan de remédiation (si WARN ou VETO) :
1. [action — agent émetteur — sévérité]
2. ...
```

## Règles

- Un VETO est **absolu** : ne pas merger, ne pas livrer.
- WARN = remédiation avant merge, pas après.
- Si AI-ACT Art. 5 (pratique interdite) → escalade immédiate à la direction + conseil juridique.
- Persister le verdict dans `.aiad/metrics/security/` ou dans la SPEC pour traçabilité.
- Cette skill ne remplace pas un avis juridique — elle applique des garde-fous d'ingénierie.
