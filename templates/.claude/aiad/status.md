---
name: status
description: État des lieux complet du projet en mode SDD
---

# AIAD — État du Projet SDD

Tu es un Product Engineer AIAD. L'utilisateur veut un état des lieux complet du projet en mode SDD.

## Mode d'exécution

Cette commande supporte deux modes :

- **`--guided`** → mode débutant : questions posées une par une, concepts expliqués, exemples proposés.
- **`--fast`** → mode expert : input attendu en bloc, explications sautées, livrable direct.
- *(aucun flag)* → auto-détection : **guided** si `.aiad/` est absent ou quasi vide, **fast** sinon.

Inspecte `$ARGUMENTS` pour détecter le flag ; à défaut, inspecte `.aiad/` avant de trancher.

## 🚀 Fast path (expert)

**Input attendu** : aucun.
**Output produit** : rapport macro structuré (artefacts / cycle SDD / gouvernance / maturité [X]/5) + 3 prochaines actions.
**Actions** :
1. Scanne `.aiad/` + `CLAUDE.md` + `.claude/commands/`.
2. Produis le tableau synthétique + niveau de maturité.
3. Recommande les 3 actions selon le niveau détecté.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 1 — Scanner les artefacts

Lis les fichiers suivants et évalue leur état :

**Artefacts fondamentaux :**
- `.aiad/PRD.md` — Existe ? Rempli (non-template) ? À jour ?
- `.aiad/ARCHITECTURE.md` — Existe ? Rempli ? Cohérent avec le code ?
- `.aiad/AGENT-GUIDE.md` — Existe ? Lessons Learned à jour ?

**Cycle SDD :**
- `.aiad/intents/_index.md` — Combien d'Intent Statements ? Statuts ?
- `.aiad/specs/_index.md` — Combien de SPECs ? Statuts ? SQS moyens ?
- `.aiad/CHANGELOG-ARTEFACTS.md` — Dernière entrée ?

**Gouvernance :**
- `.aiad/gouvernance/` — Quels agents installés ?

**Infrastructure :**
- `CLAUDE.md` — Section SDD Mode présente ?
- `.claude/commands/` — Commandes installées ?

### Étape 2 — Produire le rapport

Présente un rapport structuré :

```
AIAD SDD Mode — État du projet
═══════════════════════════════

Artefacts fondamentaux
  PRD.md              [OK/Template/Absent]
  ARCHITECTURE.md     [OK/Template/Absent]
  AGENT-GUIDE.md      [OK/Template/Absent]

Cycle SDD
  Intent Statements   [X] actif(s) / [Y] total
  SPECs               [X] active(s) / [Y] total
  SQS moyen           [X]/5
  Dernière activité   [date]

Gouvernance
  AI-ACT              [Installé/Absent]
  RGPD                [Installé/Absent]
  RGAA                [Installé/Absent]
  RGESN               [Installé/Absent]

Maturité SDD          [█░░░░] Démarrage (1/5)
```

### Étape 3 — Recommandations

Propose les 3 prochaines actions prioritaires selon le niveau de maturité :

**Niveau 0 (Non initialisé)** → Lancer `/sdd init`
**Niveau 1 (Démarrage)** → Rédiger PRD et ARCHITECTURE
**Niveau 2 (Cadrage)** → Configurer AGENT-GUIDE, créer premier Intent
**Niveau 3 (Opérationnel)** → Rédiger premières SPECs, passer l'Execution Gate
**Niveau 4 (Actif)** → Conduire une rétro (`/aiad retro`)
**Niveau 5 (Complet)** → Planifier l'Atelier d'Intention (`/aiad intention`)

$ARGUMENTS
