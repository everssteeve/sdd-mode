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
| ❓ **UNKNOWN** | Applicabilité ou conformité **non décidable** dans le contexte courant | **Traité comme VETO** (fail-closed) — décision humaine requise |
| ✅ **PASS** | Conforme ou non applicable | Continuer |

## Output

```
GOUVERNANCE TIER 1 — [SPEC-NNN ou changeset]
═══════════════════════════════════════════
| Agent     | Applicable | Verdict   | Risques détectés                |
|-----------|-----------|-----------|---------------------------------|
| AI-ACT    | OUI/NON/? | ✅/⚠️/🚫/❓ | [...]                           |
| RGPD      | OUI/NON/? | ✅/⚠️/🚫/❓ | [...]                           |
| RGAA      | OUI/NON/? | ✅/⚠️/🚫/❓ | [...]                           |
| RGESN     | OUI/NON/? | ✅/⚠️/🚫/❓ | [...]                           |

Verdict global : PASS / WARN / VETO / UNKNOWN

Plan de remédiation (si WARN, VETO ou UNKNOWN) :
1. [action — agent émetteur — sévérité]
2. ...
```

## Verdict UNKNOWN — fail-closed obligatoire

`UNKNOWN` est émis quand un référentiel ne peut pas être tranché —
**jamais** par défaut « non applicable ». Déclencheurs :

- Étape 1 de qualification : le code touche un module flou (ex. couche
  data sans annotation des champs personnels) → impossible d'affirmer
  OUI ou NON pour RGPD sans relire le module.
- Étape 2 : le fichier `.aiad/gouvernance/AIAD-<AGENT>.md` est absent
  ou n'a pas pu être lu — la skill ne sait pas quelles règles appliquer.
- Le scope du changeset déborde du périmètre lu dans cette session
  (commits non chargés, fichiers binaires, sous-modules).

Format JSON canonique (cf. `JnspVerdict` dans `lib/cli-schema.js`) :

```json
{
  "agent": "AIAD-RGPD",
  "verdict": "unknown",
  "motif": "Champs du nouveau schéma users non documentés (PII ou pas ?)",
  "question": "Confirmer si users.metadata.json contient des données personnelles ?"
}
```

**Règle d'or** : `UNKNOWN` = VETO par défaut. Documenter dans
`.aiad/gouvernance/_index.md` (section Politique d'incertitude).

## Règles

- Un VETO est **absolu** : ne pas merger, ne pas livrer.
- WARN = remédiation avant merge, pas après.
- UNKNOWN = VETO par défaut (fail-closed) jusqu'à arbitrage humain.
- Si AI-ACT Art. 5 (pratique interdite) → escalade immédiate à la direction + conseil juridique.
- Persister le verdict dans `.aiad/metrics/security/` ou dans la SPEC pour traçabilité.
- Cette skill ne remplace pas un avis juridique — elle applique des garde-fous d'ingénierie.
- Ne JAMAIS dégrader UNKNOWN en PASS pour « ne pas bloquer » — c'est précisément ce que UNKNOWN empêche.
