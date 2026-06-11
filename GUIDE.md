# Guide SDD-Mode — Du code intentionnel, de la première ligne à la production

> **Framework AIAD SDD-Mode** — aiad.ovh *(référence courante, version-agnostique — la version exacte vit dans `package.json`)*  
> Ce guide est un parcours pratique. Vous allez construire une vraie application, étape par étape, en passant par chaque phase du cycle SDD-Mode. À la fin, vous aurez vu toutes les commandes essentielles dans leur contexte réel.

---

## L'application exemple : Expense Tracker

Nous allons construire un **gestionnaire de dépenses personnelles**. L'idée est simple : noter ses dépenses, les consulter par mois, comprendre où l'argent va. Tout le monde comprend le problème fonctionnel. C'est suffisamment concret pour justifier chaque étape du cycle, suffisamment simple pour ne pas se perdre dans la complexité métier.

**Stack technique :** Node.js + Express + SQLite (zéro infrastructure, tourne partout)

**Les trois fonctionnalités que nous allons spécifier :**

| # | Fonctionnalité | Ce que l'utilisateur veut faire |
|---|---|---|
| F1 | Ajouter une dépense | Saisir montant, catégorie, description, date |
| F2 | Lister les dépenses du mois | Voir ce qu'on a dépensé en cours de mois |
| F3 | Totaux par catégorie | Identifier ses postes de dépenses principaux |

Dans ce guide, nous allons implémenter F1 en entier et introduire F2/F3 là où les commandes avancées le justifient.

---

## Avant de commencer : trois principes en deux minutes

SDD-Mode repose sur trois idées. Comprendre ces trois idées, c'est comprendre pourquoi chaque commande existe.

**1. La SPEC est un invariant vivant.** Elle n'est pas un document qu'on rédige puis qu'on oublie. Elle reste synchronisée avec le code, avant, pendant et après l'implémentation. L'agent code depuis la SPEC. Quand le code change, la SPEC change dans la même PR.

**2. Le drift est un échec de processus.** Si le code évolue sans que les artefacts suivent, ce n'est pas une erreur de l'agent — c'est une erreur de processus. Une tâche dont le code est mergé mais la SPEC désynchronisée n'est pas terminée.

**3. Le Product Engineer est responsable du budget de contexte.** L'agent IA a une fenêtre de contexte limitée. La SPEC est ce qui permet de tenir dans ce budget : une session = un objectif = une SPEC. Pas de PRD complet injecté en développement. Pas de sessions de quatre heures.

Ces trois principes expliquent chaque friction apparente du cycle. Quand une étape semble ralentir, c'est qu'elle évite un coût caché qui aurait apparu en production.

---

## Étape 0 — Installation

```bash
npx aiad-sdd init
```

Une seule commande. Elle installe dans votre projet :

- La structure `.aiad/` (artefacts, gouvernance, specs, intents)
- 27 commandes slash pour Claude Code dans `.claude/commands/`
- Un `CLAUDE.md` configuré pour le mode SDD
- 4 agents de gouvernance Tier 1

```
mon-expense-tracker/
├── .aiad/
│   ├── PRD.md                  ← Vision produit (vide, à remplir)
│   ├── ARCHITECTURE.md         ← Standards techniques (vide, à remplir)
│   ├── AGENT-GUIDE.md          ← Contexte permanent de l'agent
│   ├── gouvernance/
│   │   ├── AIAD-AI-ACT.md     ← Conformité EU AI Act
│   │   ├── AIAD-RGPD.md       ← Privacy by Design, RGPD
│   │   ├── AIAD-RGAA.md       ← Accessibilité RGAA 4.1 / WCAG 2.1
│   │   └── AIAD-RGESN.md      ← Écoconception numérique
│   ├── intents/
│   ├── specs/
│   ├── facts/
│   └── metrics/
├── .claude/
│   └── commands/               ← 27 commandes slash
└── CLAUDE.md
```

**Options utiles :**

```bash
npx aiad-sdd init --sans-gouvernance  # Sans les agents réglementaires
npx aiad-sdd update                   # Met à jour les commandes, préserve vos fichiers
npx aiad-sdd status                   # Vérifie la maturité SDD du projet (score 0-5)
```

> **Note :** `npx aiad-sdd init` installe les fichiers. La commande `/sdd init` dans Claude Code initialise le contenu de ces fichiers en mode guidé. Les deux sont complémentaires.

---

## Étape 1 — Initialiser les artefacts du projet (`/sdd init`)

Ouvrez Claude Code dans votre projet et lancez :

```
/sdd init
```

Cette commande vous guide pour remplir les trois artefacts fondamentaux du projet. Répondez aux questions : elles définissent le contexte permanent que l'agent utilisera dans toutes les sessions futures.

### Ce que vous allez produire

**`.aiad/PRD.md`** — La vision produit. Injecté uniquement en phase de cadrage, jamais en développement.

```markdown
# PRD — Expense Tracker

## Vision
Permettre à un individu de suivre ses dépenses personnelles sans friction,
depuis n'importe quel appareil.

## Utilisateurs cibles
Particuliers souhaitant reprendre le contrôle de leurs finances sans
abonnement ni compte cloud.

## User stories prioritaires
- US-01 : En tant qu'utilisateur, je veux ajouter une dépense (montant,
  catégorie, description, date) pour ne rien oublier.
- US-02 : En tant qu'utilisateur, je veux voir mes dépenses du mois en cours.
- US-03 : En tant qu'utilisateur, je veux voir mes totaux par catégorie
  pour identifier mes postes principaux.

## Outcome Criteria
- Ajout d'une dépense < 10 secondes
- Temps de réponse de l'API < 200ms sur SQLite local
- 0 donnée stockée en dehors de la machine de l'utilisateur
```

**`.aiad/ARCHITECTURE.md`** — Les standards techniques. Injecté condensé (environ 500 tokens) dans chaque session agent.

```markdown
# ARCHITECTURE — Expense Tracker

## Stack
- Runtime : Node.js 20+ (ESM)
- Framework : Express 4
- Base de données : SQLite via better-sqlite3 (synchrone)
- Tests : Node.js test runner natif

## Conventions
- Modules ESM (import/export)
- Pas d'ORM — SQL direct avec better-sqlite3
- Validation des entrées : zod
- Pas d'authentification en v1 (donnée locale uniquement)

## Structure des fichiers
src/
  routes/       ← Handlers Express
  db/           ← Couche SQLite (migrations, requêtes)
  validators/   ← Schémas zod
tests/
```

**`.aiad/AGENT-GUIDE.md`** — Le contexte permanent de l'agent. La seule chose qui est toujours en mémoire.

```markdown
# AGENT-GUIDE — Expense Tracker

## Règles absolues
- SQL direct, pas d'ORM
- Toujours valider les entrées avec zod avant d'accéder à la DB
- Les montants sont stockés en centimes (entiers), jamais en décimaux flottants
- Chaque route doit avoir un test d'intégration

## Lessons Learned
(vide au démarrage — alimenté par /aiad retro)

## Human Learnings
(vide au démarrage — alimenté par les rétrospectives)
```

> **Pourquoi trois documents ?** Ils ont des cycles de vie différents. Le PRD change quand la vision produit change (rarement). L'ARCHITECTURE change quand un standard technique change (occasionnellement). L'AGENT-GUIDE s'enrichit à chaque sprint, des erreurs et apprentissages.

---

## Étape 2 — Capturer l'intention (`/sdd intent`)

Avant d'écrire la moindre SPEC, on capture l'intention derrière la fonctionnalité. Ce n'est pas une formalité : c'est la réponse à "pourquoi on fait ça maintenant ?".

```
/sdd intent
```

La commande pose cinq questions. Vous répondez. Elle génère et archive l'Intent Statement.

### Exemple — Intent Statement pour F1 (ajouter une dépense)

```markdown
# INTENT-001 — Saisie d'une dépense

**Auteur humain :** Steeve Evers
**Date :** 2026-05-21
**Statut :** Validé

## POURQUOI MAINTENANT
C'est la fonctionnalité centrale du produit. Sans elle, rien d'autre
n'a de sens. On démarre par là.

## POUR QUI
L'utilisateur qui veut noter une dépense au moment où elle se produit,
depuis un terminal ou une interface web légère.

## OBJECTIF
Permettre la saisie d'une dépense avec validation des données, persistance
en base et retour de confirmation immédiat.

## CONTRAINTES
- Montant en centimes côté serveur (pas de flottants)
- Catégories : liste fixe en v1 (alimentation, transport, logement,
  loisirs, santé, autre)
- Description optionnelle, max 200 caractères
- Date obligatoire, format ISO 8601

## CRITÈRE DE DRIFT
Une dépense saisie via l'API est retrouvable en base avec les données
exactes transmises. Aucun arrondi, aucune perte de catégorie.
```

Le fichier est créé automatiquement dans `.aiad/intents/INTENT-001-saisie-depense.md` et référencé dans `_index.md`.

### Le principe Human Authorship

Notez le champ **Auteur humain**. Il est obligatoire. L'agent ne peut pas inventer une intention. Si vous effacez ce champ ou si l'auteur est absent, `/sdd gate` bloquera. C'est intentionnel : l'intention appartient à l'humain, l'exécution appartient à l'agent.

> **Règle :** si l'agent dit `JNSP — intention non formulée par un humain identifiable`, c'est correct. Il attend que vous formuliez l'intention, pas qu'il la devine.

---

## Étape 3 — Rédiger la SPEC (`/sdd spec`)

L'Intent Statement dit *pourquoi*. La SPEC dit *comment*, avec assez de précision pour qu'un agent puisse coder sans vous demander de questions.

```
/sdd spec
```

La commande vérifie qu'un Intent Statement parent existe, puis vous guide dans la rédaction.

### Exemple — SPEC-001 pour la route `POST /expenses`

```markdown
# SPEC-001-1 — Route POST /expenses

**Intent parent :** INTENT-001
**Statut :** Draft
**SQS :** (calculé à /sdd gate)

## Scope
Implémenter la route Express `POST /expenses` avec validation zod,
persistance SQLite et réponse JSON conforme.

## Objectif
Permettre la création d'une dépense depuis un client HTTP. La route valide
les données entrantes, les persiste, et retourne la dépense créée avec son ID.

## Fichiers impactés
- src/routes/expenses.js      ← à créer
- src/db/expenses.js          ← à créer (requêtes SQLite)
- src/validators/expense.js   ← à créer (schéma zod)
- src/db/migrations/001-init.sql ← à créer (schéma table)
- tests/routes/expenses.test.js  ← à créer

## Interface attendue

### Requête
POST /expenses
Content-Type: application/json

{
  "amount_cents": 4250,
  "category": "alimentation",
  "description": "Courses semaine",
  "date": "2026-05-21"
}

### Réponse (201 Created)
{
  "id": 1,
  "amount_cents": 4250,
  "category": "alimentation",
  "description": "Courses semaine",
  "date": "2026-05-21",
  "created_at": "2026-05-21T14:32:00.000Z"
}

### Erreurs
- 400 : données invalides (montant négatif, catégorie inconnue, date malformée)
- 500 : erreur SQLite inattendue

## Comportement attendu
1. Le handler reçoit le corps JSON
2. Zod valide le schéma strict (pas de champs supplémentaires)
3. `amount_cents` doit être un entier > 0
4. `category` doit être dans la liste fixe v1
5. `date` doit être une date ISO 8601 valide (YYYY-MM-DD)
6. `description` : optionnel, string, max 200 chars
7. La dépense est insérée via better-sqlite3 (synchrone)
8. La réponse retourne l'enregistrement complet avec son `id` et `created_at`

## Cas limites
- `amount_cents` = 0 → 400
- `amount_cents` négatif → 400
- `category` absente → 400
- `date` future acceptable (dépense planifiée)
- `description` absente → null en base, non retourné dans la réponse

## Critères d'acceptation
1. POST avec données valides → 201 + corps JSON avec `id` généré
2. POST sans `amount_cents` → 400 avec message d'erreur lisible
3. POST avec `category: "autre-chose"` → 400
4. POST avec `amount_cents: -100` → 400
5. POST avec `date: "2026-13-01"` → 400 (mois invalide)
6. L'enregistrement est retrouvable en base après insertion

## Definition of Output Done (DoOD)
- [ ] Route enregistrée dans l'app Express
- [ ] Schéma zod couvrant tous les champs
- [ ] Migration SQL créée et exécutée au démarrage
- [ ] Tests d'intégration verts (6 cas ci-dessus)
- [ ] SPEC synchronisée avec le code (Drift Lock)
```

### Quand utiliser `/sdd split`

Si votre SPEC couvre plusieurs couches (route + migration + validation + tests) au point de dépasser une session confortable, utilisez `/sdd split` pour la décomposer.

```
/sdd split
```

La commande propose trois patterns de découpage :

- **Vertical** : par couche technique (validation → DB → route → tests)
- **Flux** : happy path d'abord, puis cas d'erreur, puis cas limites
- **Contrat** : l'interface d'abord (types, schéma, contrat API), puis l'implémentation

Pour notre SPEC-001, le découpage n'est pas nécessaire : la fonctionnalité est atomique. Mais si vous ajoutiez l'authentification ou l'export CSV dans la même SPEC, c'est le signal pour splitter.

---

## Étape 4 — Passer la Gate (`/sdd gate`)

La Gate est le point de non-retour entre la spécification et le code. Aucun agent ne code avant que la Gate soit ouverte.

```
/sdd gate
```

La commande évalue votre SPEC sur cinq critères — le **Spec Quality Score (SQS)** — et un sixième non-scorable.

### Les 5 critères SQS

| # | Critère | Ce qu'on évalue | Sur notre SPEC-001 |
|---|---|---|---|
| 1 | **Atomicité** | La SPEC décrit une seule chose testable indépendamment | ✓ Une route, un comportement |
| 2 | **Testabilité** | Chaque critère d'acceptation est vérifiable sans ambiguïté | ✓ 6 cas précis et mesurables |
| 3 | **Non-ambiguïté** | Pas de "gérer correctement", "si nécessaire", "selon le contexte" | ✓ Comportements explicites |
| 4 | **Précision du scope** | On sait exactement quels fichiers sont touchés | ✓ Liste exhaustive |
| 5 | **Contraintes définies** | Limites explicites (taille, format, liste de valeurs) | ✓ Catégories fixées, max 200 chars |

**Critère 6 — Test de l'Étranger (non-scorable) :** un développeur qui n'a jamais vu ce projet peut implémenter la SPEC sans poser de questions. C'est un signal qualitatif. La Gate peut être ouverte avec SQS 4/5 mais un avertissement sur ce critère.

### Résultat de Gate sur notre exemple

```
/sdd gate — Résultat

SPEC : SPEC-001-1 — Route POST /expenses
Intent parent : INTENT-001 ✓ trouvé et validé

Critère 1 — Atomicité    : 1/1 ✓
Critère 2 — Testabilité  : 1/1 ✓
Critère 3 — Non-ambiguïté: 1/1 ✓
Critère 4 — Précision scope: 1/1 ✓
Critère 5 — Contraintes  : 1/1 ✓

SQS : 5/5
Test de l'Étranger : PASS — comportements explicites, interface complète

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GATE OUVERTE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context Engineering Budget préparé :
- AGENT-GUIDE condensé : ~400 tokens
- ARCHITECTURE condensée : ~350 tokens
- SPEC-001-1 active : ~600 tokens
- Budget total injecté : ~1350 tokens
- Budget recommandé (60% de 200k) : 120 000 tokens
- Marge disponible : large ✓
```

### Quand la Gate est fermée

Si le SQS est inférieur à 4/5, la commande produit un plan de remédiation critère par critère :

```
Critère 2 — Testabilité : 0/1 ✗
  Problème : "La dépense doit être correctement enregistrée" n'est pas testable.
  Que signifie "correctement" ?
  Remédiation : spécifier les champs exact attendus en base et leur type.
```

Vous corrigez la SPEC, vous relancez `/sdd gate`. Pas de code avant.

### La variante EARS (optionnelle)

Si votre fonctionnalité a des enjeux de sécurité, de conformité ou de contrat d'API public, vous pouvez rédiger vos critères d'acceptation au format EARS (Easy Approach to Requirements Syntax) :

```
/sdd spec --ears
```

Le format EARS impose une syntaxe stricte avec des mots-clés (`WHEN`, `IF`, `WHERE`, `SHALL`) qui rendent les critères machine-vérifiables. À `/sdd gate`, le linter passe en mode strict : 0 violation donne un bonus de +1 sur le critère de testabilité. La Gate refuse si une violation est détectée.

Exemple d'un critère EARS :

```
WHEN the client sends a POST /expenses request with a negative amount_cents value,
the system SHALL return HTTP 400 with a JSON error body containing the field "amount_cents".
```

---

## Étape 5 — Développer avec l'agent (`/sdd exec`)

Gate ouverte. Context Engineering Budget préparé. On lance.

```
/sdd exec
```

La commande structure le prompt de lancement avec le bon contexte et exige un plan d'implémentation avant le code.

### Ce que la commande injecte dans le contexte

```
Contexte permanent :
  AGENT-GUIDE (condensé)
  ARCHITECTURE (condensée)

Contexte actif :
  SPEC-001-1 — Route POST /expenses (complet)

Pas injecté :
  PRD.md (cadrage uniquement)
  Autres SPECs (activation par tâche uniquement)
```

### Ce que l'agent produit en premier : un plan

Avant d'écrire une ligne de code, l'agent valide son plan d'implémentation :

```
Plan d'implémentation — SPEC-001-1

1. src/db/migrations/001-init.sql
   Créer la table `expenses` avec colonnes id, amount_cents, category,
   description, date, created_at

2. src/db/expenses.js
   Fonction createExpense(data) → better-sqlite3 synchrone

3. src/validators/expense.js
   Schéma zod : CATEGORIES enum, amount_cents positif, date ISO,
   description optionnelle max 200 chars

4. src/routes/expenses.js
   Handler POST /expenses : validate → insert → 201/400/500

5. tests/routes/expenses.test.js
   6 cas de test correspondant aux critères d'acceptation SPEC

Ordre d'exécution : 1 → 2 → 3 → 4 → 5 (dépendances linéaires)
```

Vous validez le plan, l'agent code.

### Les annotations machine-vérifiables

Depuis la v1.10, tout code applicatif doit porter des annotations `@spec`. Ce sont des métadonnées dans les commentaires qui permettent la traçabilité automatique.

```js
/**
 * @intent INTENT-001
 * @spec SPEC-001-1-route-post-expenses
 * @verified-by tests/routes/expenses.test.js
 * @governance AIAD-RGPD
 */
export async function createExpense(req, res) {
  const result = expenseSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }
  const expense = db.createExpense(result.data);
  return res.status(201).json(expense);
}
```

Ces annotations alimentent la matrice de traçabilité générée par `/sdd trace`. Un code applicatif sans `@spec` est signalé comme gap lors du Drift Check.

### Quand la session est interrompue (`/sdd resume`)

Les sessions longues ou les crashes de contexte arrivent. Si une session s'interrompt avant la fin, ne relancez pas depuis zéro :

```
/sdd resume
```

La commande reconstruit un contexte propre depuis le résumé de la session précédente. Elle reprend à l'étape exacte où l'agent s'est arrêté, sans réinjecter tout le contexte depuis le début. C'est ce qui permet de rester dans le budget de 60-70% même sur des tâches longues.

### Auditer le budget de contexte (`/sdd context`)

Après une session, pour améliorer les suivantes :

```
/sdd context
```

La commande compare l'estimation initiale du budget avec la réalité consommée, détecte les symptômes de context rot (réponses moins précises, oublis de contraintes), et produit des recommandations pour la prochaine session.

---

## Étape 6 — Valider le code livré (`/sdd validate`)

L'agent a codé. Avant de merger, on valide.

```
/sdd validate
```

La validation se fait sur trois axes simultanés.

### Axe 1 — Technique

```
Validation technique — SPEC-001-1

✓ ESM imports valides
✓ Pas de require() (convention projet)
✓ Tests : 6/6 verts
✓ better-sqlite3 utilisé correctement (API synchrone)
✓ Zod validation présente sur tous les inputs
✗ Description absente retourne undefined au lieu de null en base

→ 1 correction requise avant validation
```

### Axe 2 — Fonctionnel (conformité SPEC)

```
Validation fonctionnelle — SPEC-001-1

Critères d'acceptation :
✓ 1. POST valide → 201 + id généré
✓ 2. POST sans amount_cents → 400
✓ 3. POST category inconnue → 400
✓ 4. POST amount_cents négatif → 400
✓ 5. POST date invalide → 400
✓ 6. Enregistrement retrouvable en base

DoOD :
✓ Route enregistrée dans l'app
✓ Schéma zod couvrant tous les champs
✓ Migration SQL créée et exécutée
✓ Tests d'intégration verts
✗ SPEC non encore synchronisée (à faire dans Drift Lock)
```

### Axe 3 — Gouvernance Tier 1

C'est ici que les 4 agents réglementaires interviennent. Ils ont un **droit de veto** : si l'un d'eux émet un BLOQUANT, la PR ne peut pas merger.

Pour notre Expense Tracker, deux agents se déclenchent automatiquement :

**AIAD-RGPD** — parce que les dépenses sont des données financières personnelles :

```
AIAD-RGPD — Analyse SPEC-001-1

⚠️ ALERTE : La table `expenses` stocke des montants financiers
personnels sans aucun mécanisme de contrôle d'accès.

En v1 (donnée locale uniquement) : acceptable, mais documenter
explicitement la contrainte dans l'ARCHITECTURE.md.

Si une API publique ou un compte utilisateur est ajouté en v2 :
- Chiffrement des données at rest requis
- Durée de conservation à définir
- Droit à l'effacement à implémenter

Recommandation : ajouter une note dans ARCHITECTURE.md précisant
que les données sont locales et non partagées en v1.

Verdict : CONFORME (v1 locale) avec recommandation documentée.
```

**AIAD-RGESN** — parce que chaque décision technique est évaluée en écoconception :

```
AIAD-RGESN — Analyse SPEC-001-1

✓ SQLite local : aucune requête réseau, empreinte minimale
✓ better-sqlite3 synchrone : pas de pool de connexions inutile
✓ Pas de dépendance ORM : pas de chargement de modules non utilisés

Verdict : CONFORME
```

### Résultat global

```
VALIDATION — SPEC-001-1

Technique      : CORRECTIONS (1 point — description null)
Fonctionnel    : VALIDÉ
Gouvernance    : CONFORME avec recommandation RGPD documentée

→ Statut : CORRECTIONS MINEURES
→ Corriger le point technique, puis procéder au Drift Lock
```

---

## Étape 7 — Verrouiller le drift (`/sdd drift-check`)

Correction faite, tests verts. Avant d'ouvrir la PR :

```
/sdd drift-check
```

Cette commande compare chaque SPEC active avec le code modifié et détecte les écarts — le *drift*. Elle vérifie aussi le CRITÈRE DE DRIFT défini dans l'Intent Statement.

### Vérification sur notre exemple

```
Drift Check — diff de la PR en cours

SPEC-001-1 — Route POST /expenses
  Comportement attendu : couvert ✓
  Interface API : conforme ✓
  Cas limites : description null → corrigé ✓
  Annotations @spec : présentes ✓
  CRITÈRE DE DRIFT (INTENT-001) : "une dépense saisie est retrouvable
  avec les données exactes" → vérifié par test #6 ✓

Fichiers modifiés sans SPEC référencée :
  package.json (ajout better-sqlite3, zod) → dépendances, pas d'impact spec

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DRIFT LOCK : OK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mise à jour de SPEC-001-1 :
  Statut : Draft → Implemented
  Commit de synchronisation préparé.
```

La SPEC et le code sont mergés dans la **même PR**. C'est le Drift Lock. Pas de "je mettrai à jour la SPEC après" : ça n'arrive jamais.

### La matrice de traçabilité (`/sdd trace`)

Pour aller plus loin, `/sdd trace` génère une matrice machine-vérifiable qui relie Intent ↔ SPEC ↔ Code ↔ Tests :

```
/sdd trace
```

Sortie dans `.aiad/metrics/traceability/` :

```
INTENT-001 → SPEC-001-1 → src/routes/expenses.js → tests/routes/expenses.test.js
             ↓
             Couverture : 6/6 critères d'acceptation couverts par des tests
             Gaps : 0
             Annotations @spec : présentes sur 3/3 fonctions applicatives
```

La GitHub Action `.github/workflows/sdd-trace.yml` peut bloquer une PR si un gap est détecté (`--fail-on-gap`).

---

## Quand ça ne se passe pas comme prévu

### Capturer un écart constaté (`/sdd fact`)

La fonctionnalité est mergée. Une semaine plus tard, un utilisateur remarque que les dépenses du 31 décembre sont attribuées au mois de janvier dans le listing. Le bug est là.

Ce n'est pas grave. Ce n'est pas non plus un nouveau cycle Intent complet. C'est un Fait Technique.

```
/sdd fact
```

La commande capture l'écart, qualifie l'impact, et décide de l'action corrective parmi quatre options :

```
/sdd fact — FACT-001

Livré : les dépenses avec date=2026-12-31 apparaissent dans le
        listing de janvier 2027.
Désiré : elles apparaissent dans le listing de décembre 2026.

Qualification : bug fonctionnel — logique de filtrage par mois.
SPEC concernée : SPEC-002-1 (listing mensuel).

Action décidée : ajustement SPEC existante + patch immédiat.
Tracé dans .aiad/facts/FACT-001.md avec lien vers SPEC-002-1.
```

Le fichier est créé. La SPEC est mise à jour. Un correctif est développé avec `/sdd exec` en reprenant depuis la SPEC corrigée. Le Drift Lock garantit que tout reste synchronisé.

### Auditer la sécurité (`/sdd security`)

Avant de déployer une fonctionnalité qui touche des données utilisateur ou des secrets :

```
/sdd security
```

La commande parcourt le code sur les axes OWASP Top 10, gestion des secrets, permissions des agents, et conformité réglementaire. Elle recommande d'utiliser un modèle frontier (Opus 4.8) pour cet audit.

Pour notre Expense Tracker :

```
/sdd security — SPEC-001-1

OWASP A03 — Injection : ✓ (better-sqlite3 paramétré, pas de SQL concatené)
OWASP A05 — Misconfiguration : ✓ (SQLite local, pas d'exposition réseau)
OWASP A06 — Outdated components : ⚠️ better-sqlite3 à vérifier (version ?)
Secrets : ✓ (aucun secret dans le code ou l'env)

Rapport persisté : .aiad/metrics/security/2026-05-21-SPEC-001-1.md
```

### Auditer la qualité du code (`/sdd audit`)

Pour une revue approfondie après plusieurs itérations d'un même composant :

```
/sdd audit
```

La commande évalue la conformité code ↔ SPEC, la dette technique introduite (complexité, couplage, lisibilité), et la cohérence avec les conventions de l'AGENT-GUIDE. Rapport persisté dans `.aiad/metrics/audit/`.

---

## L'écosystème AIAD : rituels, métriques et synchronisations

Le cycle SDD (étapes 1 à 7) couvre le travail quotidien. Les commandes AIAD couvrent le travail d'équipe, la gouvernance et le pilotage.

### Le quotidien

**`/aiad standup`** — 15 minutes max, chaque matin. Trois questions SDD : quelle SPEC aujourd'hui ? Quel budget de contexte ? Y a-t-il un drift à signaler ? La commande affiche l'état des SPECs actives et les blockers.

**`/aiad status`** — L'état complet du projet à la demande : artefacts (statut, fraîcheur), SPECs actives, gouvernance, maturité globale. Utile en début de session ou en standup.

**`/aiad health`** — Diagnostic de santé des artefacts. Détecte les SPECs dont le statut n'a pas été mis à jour, les artefacts qui divergent, le score de maturité SDD (0 à 5).

### La fin de sprint

**`/aiad retro`** — Rétrospective SDD Mode. Collecte les Lessons Learned (erreurs récurrentes de l'agent) et les Human Learnings (écarts entre intention humaine et livraison). Calcule les métriques d'itération. Met à jour l'AGENT-GUIDE.

**`/aiad demo`** — Prépare la démo depuis les SPECs terminées. Structure la présentation autour des Intent Statements d'origine (pourquoi nous avons fait ça) puis de la livraison (ce que ça fait).

**`/aiad tech-review`** — Vérifie la cohérence entre ARCHITECTURE.md et le code réel. Identifie les dérives de patterns, les nouvelles dépendances non documentées.

### Le mensuel

**`/aiad intention`** — Prépare l'Atelier d'Intention mensuel. Compile les Intent Statements du mois, les métriques d'alignement, les Human Learnings. L'atelier lui-même est un espace humain pur, sans IA.

**`/aiad sync-strat`** — Synchronisation stratégique PM / PE / AE / Tech Lead. Aligne l'équipe sur la stratégie produit, vérifie la validité du PRD, ajuste les priorités.

### Les métriques

**`/aiad dashboard`** — Dashboard ASCII des métriques du projet : SQS moyen, taux de drift, first-time success rate, taux d'alignement intention/livraison.

**`/aiad dora`** — Les 4 indicateurs DORA : Deployment Frequency, Lead Time for Changes, Change Failure Rate, MTTR. Compare aux benchmarks industrie (Elite / High / Medium / Low).

**`/aiad flow`** — Les 5 indicateurs Flow : Cycle Time, Lead Time, Throughput, WIP, Flow Efficiency. Identifie les goulots d'étranglement du cycle SDD.

**`/aiad dashboard-html`** — Version HTML multi-pages du dashboard, dans `dashboard/`. Pour le pilotage continu.

### Adoption sur un projet existant

**`/aiad init`** — Pour adopter AIAD sur un projet qui a déjà du code. Bootstrap progressif : analyse le codebase existant, génère les artefacts depuis l'état réel. Pas besoin de repartir de zéro.

**`/aiad onboard`** — Génère un briefing contextualisé pour un nouveau membre, depuis les artefacts du projet (PRD, ARCHITECTURE, AGENT-GUIDE, SPECs actives, Lessons Learned).

---

## Les deux modes d'exécution

Toutes les commandes supportent deux modes :

| Mode | Flag | Comportement |
|---|---|---|
| **Guidé** | `--guided` | L'agent pose les questions une par une, explique les concepts, propose des exemples. Pour la première utilisation d'une commande. |
| **Expert** | `--fast` | L'agent attend les inputs en bloc, saute les explications, livre directement le rendu. |
| **Auto** | *(aucun)* | L'agent inspecte `.aiad/`. Structure absente → guidé. Structure présente → expert. |

Exemples :

```bash
/sdd intent --guided    # première fois, mode pédagogique
/sdd gate --fast        # vous savez ce que vous faites
/sdd spec               # auto-détection
```

---

## Référence rapide

### Index des commandes

#### Cycle SDD (`/sdd <sous-commande>`)

| Commande | Phase | Ce qu'elle fait |
|---|---|---|
| `/sdd init` | Initialisation | Rédiger PRD + ARCHITECTURE + AGENT-GUIDE guidé |
| `/sdd intent` | Intention | Capturer un Intent Statement |
| `/sdd spec` | Spécification | Rédiger une SPEC pour un Intent validé |
| `/sdd spec --ears` | Spécification | Variante EARS avec linter strict |
| `/sdd split` | Spécification | Découper une SPEC volumineuse |
| `/sdd gate` | Gate | Évaluer le SQS + ouvrir ou fermer la Gate |
| `/sdd exec` | Exécution | Lancer l'agent avec contexte optimisé |
| `/sdd resume` | Exécution | Reprendre une session interrompue |
| `/sdd context` | Exécution | Auditer et améliorer le budget de contexte |
| `/sdd validate` | Validation | Valider technique + fonctionnel + gouvernance |
| `/sdd drift-check` | Intégration | Vérifier la synchronisation SPEC ↔ code |
| `/sdd trace` | Intégration | Générer la matrice Intent ↔ SPEC ↔ Code ↔ Tests |
| `/sdd fact` | Correction | Capturer et qualifier un écart livré/désiré |
| `/sdd security` | Audit | Audit sécurité OWASP + conformité réglementaire |
| `/sdd audit` | Audit | Audit qualité code ↔ SPEC + dette technique |

#### Rituels et métriques AIAD (`/aiad <sous-commande>`)

| Commande | Cadence | Ce qu'elle fait |
|---|---|---|
| `/aiad standup` | Quotidien | Standup SDD structuré (15 min) |
| `/aiad status` | À la demande | État complet du projet |
| `/aiad health` | À la demande | Santé des artefacts + score maturité |
| `/aiad demo` | Bi-hebdo | Préparer la démo depuis les SPECs |
| `/aiad tech-review` | Bi-hebdo | Cohérence ARCHITECTURE ↔ code |
| `/aiad retro` | Sprint | Rétrospective + mise à jour AGENT-GUIDE |
| `/aiad dashboard` | Sprint | Dashboard métriques ASCII |
| `/aiad dora` | Sprint | Métriques DORA |
| `/aiad flow` | Sprint | Métriques Flow |
| `/aiad dashboard-html` | Sprint | Dashboard HTML dans `dashboard/` |
| `/aiad intention` | Mensuel | Préparer l'Atelier d'Intention |
| `/aiad sync-strat` | Mensuel | Synchronisation stratégique |
| `/aiad gouvernance` | PR critique | Conformité Tier 1 (AI-ACT, RGPD, RGAA, RGESN) |
| `/aiad init` | Adoption | Bootstrap sur projet existant |
| `/aiad onboard` | Onboarding | Briefing nouveau membre |

### Anti-patterns fréquents

| Ce qu'on fait | Ce qu'on devrait faire | Pourquoi |
|---|---|---|
| Coder sans SPEC | `/sdd spec` + `/sdd gate` | Sans SPEC, l'agent invente les contraintes |
| Merger la SPEC après le code | SPEC + code dans la même PR | Le drift s'installe avant qu'on s'en aperçoive |
| Injecter le PRD en développement | AGENT-GUIDE condensé + SPEC active seulement | Context rot — l'agent se perd dans un grand contexte |
| Laisser une session dépasser 35 min | `/compact` + `/sdd resume` | Dégradation mesurable au-delà de 60-70% du contexte |
| SQS 3/5 "ça ira" | Corriger et repasser la Gate | Une SPEC floue produit un code flou |
| Intent Statement sans auteur humain | Champ "Auteur humain" obligatoire | Human Authorship — l'intention ne se délègue pas |
| Ignorer un BLOQUANT gouvernance | Traiter le veto Tier 1 | La gouvernance a droit de veto. Point. |

### Glossaire

| Terme | Définition |
|---|---|
| **Intent Statement** | Artefact de premier ordre : 5 champs (POURQUOI MAINTENANT, POUR QUI, OBJECTIF, CONTRAINTES, CRITÈRE DE DRIFT). Archivé dans `.aiad/intents/`. |
| **SPEC** | Spécification technique détaillée pour une tâche atomique. Activation par tâche uniquement. |
| **SQS** | Spec Quality Score — 5 critères scorables + Critère 6 "Test de l'Étranger". Score ≥ 4/5 requis. |
| **Execution Gate** | Point de contrôle entre SPEC validée et lancement agent. Aucun code avant Gate ouverte. |
| **Drift Lock** | Politique de PR : code et SPEC synchronisés dans le même commit. |
| **Spec Drift** | Écart entre l'état d'une SPEC et l'état réel du code. Traité comme échec de processus, pas erreur d'agent. |
| **Spec-Anchored** | La spec reste l'ancre permanente, synchronisée avec le code à chaque PR. ≠ spec-first, ≠ spec-as-source. |
| **Context Engineering Budget** | Capacité d'absorption de contexte d'un agent. Règle : session unique, < 35 min, seuil opérationnel 60-70%. |
| **Context Rot** | Dégradation qualité LLM avant la limite théorique. Justifie la SPEC comme anchor point stable. |
| **Human Authorship** | La paternité de l'intention ne se délègue pas. Tout Intent Statement est rédigé par un humain identifiable. |
| **Human Learnings** | Section AGENT-GUIDE documentant les écarts entre intention humaine et livraison. |
| **Lessons Learned** | Section AGENT-GUIDE documentant les erreurs récurrentes de l'agent (≥ 2 occurrences). |
| **Atelier d'Intention** | Rituel mensuel (60 min max, humain pur, pas d'IA). |
| **DoOD** | Definition of Output Done — critères de complétion définis dans la SPEC. |
| **Harness Engineering** | Configuration, supervision et gouvernance des agents selon le principe de minimal necessary permissions. |
| **REASONS Canvas** | Outil SPDD optionnel (Kevlin Henney) pour structurer la justification d'une SPEC. |
| **JNSP** | Verdict de l'agent signifiant "je ne sais pas" — signal valide, décision humaine requise. |
| **DORA Metrics** | Deployment Frequency, Lead Time, Change Failure Rate, MTTR. |
| **Flow Metrics** | Cycle Time, Lead Time, Throughput, WIP, Flow Efficiency. |
| **Product Engineer (PE)** | Gardien de l'intention tout au long du cycle, orchestrant les agents sans trahir l'intention. |

---

## Ce que vous venez de parcourir

Sur notre Expense Tracker, vous avez traversé le cycle complet :

```
npx aiad-sdd init
    ↓
/sdd init          → PRD + ARCHITECTURE + AGENT-GUIDE
    ↓
/sdd intent        → INTENT-001 archivé
    ↓
/sdd spec          → SPEC-001-1 rédigée
    ↓
/sdd gate          → SQS 5/5 — Gate ouverte
    ↓
/sdd exec          → Code + tests + annotations @spec
    ↓
/sdd validate      → Technique ✓ — Fonctionnel ✓ — Gouvernance ✓
    ↓
/sdd drift-check   → SPEC synchronisée — PR mergeable
```

Vous avez aussi vu les commandes complémentaires : `/sdd split` pour découper, `/sdd resume` pour reprendre, `/sdd fact` pour corriger, `/sdd security` et `/sdd audit` pour la rigueur. Et les rituels AIAD pour tenir dans la durée.

Le framework complet, la référence opérationnelle et les dernières mises à jour sont sur **[aiad.ovh](https://aiad.ovh)**.
