---
id: SPEC-032-1
title: /model actionnable — uniformisation 33 commandes /sdd et /aiad (FACT-015)
parent_intent: INTENT-032
status: done
format: prose
sqs: 5
author: Steeve Evers
date: "2026-06-25"
traceability: exempt
traceability_reason: "Livrable purement éditorial — 33 fichiers Markdown (.claude/sdd/*.md, .claude/aiad/*.md) sans code applicatif annoatable. Aucune extension .js/.ts/.py dans le scope. Vérification : grep -rL '/model ' .claude/sdd/ .claude/aiad/ → 0 fichier."
---

# SPEC-032-1-model-actionnable

**Intent parent** : INTENT-032
**Research** : RESEARCH-032 — GO 95 %
**Auteur** : Steeve Evers
**Date** : 2026-06-25
**Statut** : done
**Format** : prose
**SQS** : 5/5 — Gate OUVERTE (2026-06-25)

---

## 1. Contexte

FACT-015 (2026-06-25) constate que les 33 fichiers de commandes `/sdd` et `/aiad`
(`.claude/sdd/*.md` et `.claude/aiad/*.md`) documentent un modèle recommandé en
texte libre mais n'offrent pas d'instruction `/model <id>` copiable-collable.
L'utilisateur doit retrouver l'ID de modèle dans la documentation externe pour
le saisir manuellement. Quatre commandes présentent un double modèle sans critère
de choix explicite (`audit`, `security`, `gouvernance`, `research`).

## 2. Comportement Attendu

### Input

Les 33 fichiers de commandes existants (lus, non recréés) :

**Commandes `/sdd` (17 fichiers)** : `gate`, `prd`, `validate`, `split`,
`context`, `drift-check`, `init`, `resume`, `audit`, `research`, `intent`,
`trace`, `spec`, `arch`, `exec`, `security`, `fact`.

**Commandes `/aiad` (16 fichiers)** : `intention`, `dashboard`, `tech-review`,
`status`, `dashboard-html`, `standup`, `retro`, `demo`, `sync-strat`, `init`,
`emit-rules`, `dora`, `onboard`, `gouvernance`, `flow`, `health`.

### Processing

Pour chaque fichier, la ligne `**Recommandation modèle** : <texte>` (ou
`### Étape 0 — Recommandation modèle` suivi d'un `Affiche : *"…"*`) est
augmentée d'une ligne d'instruction actionnable immédiatement après :

```
👉 `/model <id-exact>` — <description courte de la tâche>
```

**Mapping modèle → ID exact** (source : `CLAUDE.md` session) :

| Modèle nommé | ID à écrire |
|---|---|
| Haiku 4.5 | `claude-haiku-4-5-20251001` |
| Sonnet 4.6 | `claude-sonnet-4-6` |
| Opus 4.8 | `claude-opus-4-8` |

**Résolution des 4 doubles modèles** (critères décidés en Research GO) :

| Fichier | Critère de choix | Instruction principale |
|---------|-----------------|----------------------|
| `audit.md` | Opus 4.8 si diff > 500 lignes ou dette structurelle, Sonnet 4.6 sinon | `👉 /model claude-sonnet-4-6` (Sonnet par défaut) + note Opus si audit profond |
| `security.md` | Opus 4.8 recommandé (haute précision, risque élevé) | `👉 /model claude-opus-4-8` |
| `gouvernance.md` | Opus 4.8 recommandé (conformité réglementaire) | `👉 /model claude-opus-4-8` |
| `research.md` | Sonnet 4.6 pour l'orchestration (principal), Haiku 4.5 optionnel pour l'agent Explore interne | `👉 /model claude-sonnet-4-6` (orchestration) |

### Output

33 fichiers Markdown mis à jour en place. Aucun nouveau fichier créé. Aucune
modification de logique métier.

### Cas limites

- **Fichier déjà conforme** : si une instruction `/model <id>` existe déjà,
  ne pas la dupliquer — vérifier et corriger l'ID si nécessaire, sinon ne
  pas toucher.
- **Étape 0 absente** (commandes `/aiad` sans mode guidé explicite) : ajouter
  la ligne actionnable directement sous la ligne `**Recommandation modèle**`
  dans l'en-tête, pas dans un bloc `### Étape 0` créé de toutes pièces.
- **Nouveau fichier ajouté dans le futur** : hors scope de cette SPEC — à traiter
  dans un check `emit-rules` ou un lint CI séparé (INTENT-032 ne couvre pas ce
  garde-fou futur).
- **ID de modèle périmé** : les IDs sont ceux en vigueur à la date de la SPEC
  (`claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-8`) — à
  mettre à jour manuellement si Claude Code introduit de nouveaux alias.

## 3. Critères d'Acceptation

- [ ] Chaque fichier dans `.claude/sdd/` et `.claude/aiad/` contient au moins
      une ligne commençant par `👉 \`/model ` suivie d'un ID de modèle valide.
- [ ] Les 4 commandes à double modèle (`audit`, `security`, `gouvernance`,
      `research`) ont un critère de choix explicite documenté dans leur fichier.
- [ ] `grep -rL '/model ' .claude/sdd/ .claude/aiad/` retourne 0 fichier.
- [ ] Aucune régression sur le cold-start : `npx aiad-sdd research RESEARCH-032`
      continue de sortir exit 0.
- [ ] Aucun `TODO-JNSP` ouvert dans les fichiers modifiés.

## 4. Interface / API

Pas d'interface programmatique — modification éditoriale pure.

**Commande de vérification post-merge** :
```bash
grep -rL '/model ' .claude/sdd/ .claude/aiad/
# → doit retourner 0 ligne (tous les fichiers couverts)
```

## 5. Dépendances

- RESEARCH-032 — GO 95 % (prérequis levé)
- FACT-015 (déclencheur)
- `.claude/sdd/*.md` + `.claude/aiad/*.md` (fichiers cibles)

Pas de dépendance sur un module JS ou une SPEC parente.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~500 tokens
- Cette SPEC : ~600 tokens
- 33 fichiers source (~50 lignes chacun en moyenne) : ~6 600 tokens (à charger par batch de 5-6)
- **Total estimé** : ~7 700 tokens — à exécuter en plusieurs passes pour rester sous 60-70 % du contexte Sonnet 4.6 (200k)

## 7. Definition of Output Done (DoOD)

- [ ] Les 33 fichiers modifiés (pas plus, pas moins)
- [ ] `grep -rL '/model ' .claude/sdd/ .claude/aiad/` → 0 résultat
- [ ] Les 4 critères de choix double-modèle documentés et cohérents avec la Research
- [ ] Aucun nouveau fichier créé
- [ ] Lint Markdown propre (pas de syntaxe cassée)
- [ ] Drift Lock : cette SPEC marquée `done` après merge
- [ ] FACT-015 mis à jour : `Statut : résolu` + lien SPEC-032-1
