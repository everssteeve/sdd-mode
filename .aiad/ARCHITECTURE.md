# ARCHITECTURE

> Ce fichier est le contexte technique permanent. Un résumé condensé (max 500 tokens) est injecté dans chaque session agent.
> Mainteneur : Tech Lead

## 1. Principes Architecturaux [max 5 principes]

1. **[Principe 1]** : [Explication courte]
2. **[Principe 2]** : [Explication courte]
3. **[Principe 3]** : [Explication courte]

## 2. Vue d'Ensemble

```
[Diagramme ASCII de l'architecture — tracer une requête du client à la DB]
```

## 3. Stack Technique

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Runtime** | [Ex: Node.js 20 LTS] | [Pourquoi] |
| **Framework** | [Ex: Next.js 15] | [Pourquoi] |
| **Language** | [Ex: TypeScript strict] | [Pourquoi] |
| **Database** | [Ex: PostgreSQL 16] | [Pourquoi] |
| **Tests** | [Ex: Jest + Cypress] | [Pourquoi] |

## 4. Structure du Projet

```
.
├── .aiad/              ← Artefacts SDD Mode
├── src/
│   ├── [modules...]
│   └── ...
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── ...
```

## 5. Conventions de Code

### Nommage
- **Variables** : [convention + exemple]
- **Fichiers** : [convention + exemple]
- **Database** : [convention + exemple]

### Formatting
- **Indentation** : [X espaces]
- **Line length** : [max X chars]

### Imports
```
[Exemple d'ordre d'imports]
```

## 6. Patterns Utilisés

### [Pattern 1]
```
[Exemple de code]
```

### [Pattern 2]
```
[Exemple de code]
```

## 7. Gestion des Erreurs

```
[Exemple de code — pattern standard de gestion d'erreur]
```

## 8. Sécurité

- **Authentification** : [méthode]
- **Autorisation** : [méthode]
- **Secrets** : [stockage]
- **Input validation** : [méthode]

## 9. Performance (Budgets)

| Métrique | Budget | Monitoring |
|----------|--------|-----------|
| **Response time p95** | [cible] | [outil] |
| **Error rate** | [cible] | [outil] |

## 10. ADRs (Architecture Decision Records)

> Les ADRs sont stockés dans `.aiad/adrs/` au format :
> `ADR-NNN-[titre].md`

[Aucun ADR pour l'instant — documentez chaque décision technique significative]
