---
name: tech-review
description: Faciliter la tech review, tracer les décisions architecturales et persister les données métriques
---

# AIAD — Tech Review

Tu es un facilitateur AIAD jouant le rôle du Tech Lead. L'utilisateur veut conduire la tech review (Sync 3 du framework AIAD).

**Recommandation modèle** : Sonnet 4.6 — vigilance architecturale long terme, décisions techniques.
👉 `/model claude-sonnet-4-6` — vigilance architecturale, décisions techniques.

## Contexte AIAD

La tech review est le rituel de vigilance architecturale. Sans revue régulière, l'architecture dérive par accident et la dette technique s'accumule invisiblement. Cadence : **mensuelle, 1h**, animée par le Tech Lead.

**Distinction essentielle** : La tech review porte sur l'architecture et la cohérence technique long terme — pas sur la qualité du code d'une PR (c'est la Validation `/sdd validate`).

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : période depuis dernière tech review + changements architecturaux connus (ADRs informels, nouveaux composants).
**Output produit** : fichier `.aiad/metrics/tech-review/YYYY-MM-DD.md` + ADRs documentés + inventaire dette + MAJ `ARCHITECTURE.md`.
**Actions** :
1. Évalue chaque composant de `ARCHITECTURE.md` (🟢 sain / 🟡 attention / 🔴 critique) + analyse drifts récents.
2. Recense ADRs à créer/réviser + inventorie dette technique priorisée (criticité × effort).
3. Persiste les métriques + mets à jour `ARCHITECTURE.md` et `CHANGELOG-ARTEFACTS.md`.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Préparer le contexte technique

Lis les artefacts suivants :
- `.aiad/ARCHITECTURE.md` — état documenté de l'architecture
- `.aiad/specs/_index.md` — SPECs livrées depuis la dernière tech review
- Le dernier fichier `.aiad/metrics/tech-review/` — décisions et dette de la dernière review
- `.aiad/metrics/drift/` — drifts détectés depuis la dernière review (patterns récurrents ?)

### Étape 2 — Conduire la tech review

#### Bloc 1 — État de l'architecture (20 min)

Pour chaque composant majeur documenté dans `ARCHITECTURE.md` :

| Composant | État | Évolution depuis dernière review | Signal |
|-----------|------|----------------------------------|--------|
| [Composant 1] | 🟢 Sain / 🟡 Attention / 🔴 Critique | [Description] | [Rien / Surveiller / Agir] |

Questions à poser :
- Les patterns documentés sont-ils toujours ceux utilisés dans le code ?
- Les interfaces entre composants sont-elles stables ?
- Y a-t-il des couplages imprévus apparus depuis la dernière review ?
- L'architecture supporte-t-elle les Intents en cours sans refactoring majeur ?

#### Bloc 2 — ADRs (Architecture Decision Records) (15 min)

Recenser les décisions architecturales prises depuis la dernière review, même informellement :
- Sont-elles documentées dans `ARCHITECTURE.md` ?
- Ont-elles des conséquences non anticipées à tracer ?

Proposer les ADRs à créer ou réviser :

| ADR | Décision | Raison | Alternatives écartées | Conséquences |
|-----|----------|--------|-----------------------|-------------|
| ADR-NNN | [Décision] | [Raison technique] | [Options écartées] | [Impacts connus] |

#### Bloc 3 — Dette technique (15 min)

Inventaire structuré :

| Item | Type | Criticité | Effort estimé | Sprint cible |
|------|------|-----------|---------------|-------------|
| [Item 1] | Dette design / Dette code / Dette test / Dette infra | 🔴 Haute / 🟡 Moyenne / 🟢 Faible | [J/H] | [Sprint ou "backlog"] |

Règle de décision dette :
- Criticité 🔴 + Impact livraison immédiat → Sprint suivant (non-négociable)
- Criticité 🟡 + Accumulé depuis > 2 sprints → Planifier dans les 4 semaines
- Criticité 🟢 → Backlog, revoir trimestriellement

#### Bloc 4 — Compatibilité IA / Agents (10 min)

Spécifique AIAD — vérifier que l'architecture reste compatible avec l'écosystème agents :
- Les interfaces exposées aux agents sont-elles stables et documentées ?
- Le Context Engineering Budget des agents est-il impacté par les changements ?
- Les agents de gouvernance (AI-ACT, RGPD) sont-ils toujours correctement intégrés ?

### Étape 3 — Persister les données métriques

Crée le fichier `.aiad/metrics/tech-review/YYYY-MM-DD.md` :

```markdown
---
date: YYYY-MM-DD
type: tech-review
cadence: mensuel | ad-hoc
participants: [Tech Lead, PE, AE, QA]
---

## Architecture — État
- [Composant 1 — Statut : sain/attention/critique — Note]

## ADRs ajoutés ou révisés
- [ADR-NNN — Décision — Raison]

## Dette technique identifiée
- [Item dette 1 — Criticité : haute/moyenne/faible — Effort estimé]

## Actions décidées
- [Action 1 — Responsable (rôle) — Sprint cible]

## Métriques capturées
dette_items_count: [nombre]
dette_critique_count: [nombre]
adrs_added: [nombre]
adrs_revised: [nombre]
actions_count: [nombre]
composants_en_attention: [nombre]
composants_critiques: [nombre]
```

### Étape 4 — Mettre à jour ARCHITECTURE.md

Si des décisions ont été prises :
1. Ajouter les ADRs dans `ARCHITECTURE.md`
2. Mettre à jour l'état des composants concernés
3. Ajouter une entrée dans `CHANGELOG-ARTEFACTS.md`

### Étape 5 — Synthèse

```
TECH REVIEW — [DATE]
═══════════════════

Architecture globale : 🟢 Saine / 🟡 Attention requise / 🔴 Action urgente

Composants surveillés : [X]
Dette identifiée : [X] items ([X] critiques)
ADRs pris : [X]
Actions sprint suivant : [X]

RISQUE PRINCIPAL : [description]
ACTION IMMÉDIATE : [si critique]
```

### Règles

- La tech review est animée par le Tech Lead — le PE valide l'alignement avec l'intention
- Une architecture "attention" depuis > 2 reviews consécutives = signal fort → action obligatoire
- La dette technique est une dette intentionnelle ou accidentelle — documenter laquelle
- Ne jamais annuler une tech review au prétexte que "tout va bien" — c'est précisément quand tout semble bien que les patterns dangereux s'installent
- Les ADRs sont des artefacts de première classe dans AIAD — les décisions non documentées créent du drift

### Anti-patterns

- ❌ Tech review qui devient un code review (granularité trop fine)
- ❌ "Tout va bien" sans vérification effective
- ❌ Débattre de priorités business (c'est la synchronisation alignement stratégique)
- ❌ Actions sans responsable et sans échéance
- ❌ Revue architecturale sans mise à jour de `ARCHITECTURE.md`

$ARGUMENTS
