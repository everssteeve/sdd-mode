# RESEARCH-032 — Recommandation modèle actionnable dans toutes les commandes

**Intent parent** : INTENT-032
**Date** : 2026-06-25
**Auteur** : Steeve Evers
**Statut** : en attente de verdict humain

---

## Discovery

Agent Explore (read-only) — cartographie de `claude/sdd/*.md` et `claude/aiad/*.md`. Ancrages `chemin:ligne` réels (2026-06-25).

**Commandes `/sdd`** — ligne `Recommandation modèle` :
- `claude/sdd/gate.md:12` — Sonnet 4.6, pas d'instruction `/model`
- `claude/sdd/prd.md:12` — Sonnet 4.6, pas d'instruction `/model`
- `claude/sdd/validate.md:12` — Sonnet 4.6, pas d'instruction `/model`
- `claude/sdd/split.md:12` — Sonnet 4.6, pas d'instruction `/model`
- `claude/sdd/context.md:12` — Haiku 4.5, pas d'instruction `/model`
- `claude/sdd/drift-check.md:16` — Haiku 4.5, pas d'instruction `/model`
- `claude/sdd/init.md:15` — Sonnet 4.6, pas d'instruction `/model`
- `claude/sdd/resume.md:12` — Haiku 4.5, pas d'instruction `/model`
- `claude/sdd/audit.md:12` — ⚠️ double modèle : `Opus 4.8 ou Sonnet 4.6` sans critère de choix
- `claude/sdd/research.md:14` — ⚠️ double modèle : `Sonnet 4.6 + Haiku` sans commande d'activation
- `claude/sdd/intent.md:12` — Sonnet 4.6, pas d'instruction `/model`
- `claude/sdd/trace.md:12` — Haiku 4.5, pas d'instruction `/model`
- `claude/sdd/spec.md:12` — Sonnet 4.6, pas d'instruction `/model`
- `claude/sdd/arch.md:12` — Sonnet 4.6, pas d'instruction `/model`
- `claude/sdd/exec.md:12` — Sonnet 4.6, pas d'instruction `/model`
- `claude/sdd/security.md:12` — ⚠️ double modèle : `Opus 4.8 ou équivalent frontier` sans critère
- `claude/sdd/fact.md:12` — Haiku 4.5, pas d'instruction `/model`

**Commandes `/aiad`** — ligne `Recommandation modèle` :
- `claude/aiad/intention.md:10` — Sonnet 4.6, pas d'instruction `/model`
- `claude/aiad/dashboard.md:10` — Haiku 4.5, pas d'instruction `/model`
- `claude/aiad/tech-review.md:10` — Sonnet 4.6, pas d'instruction `/model`
- `claude/aiad/status.md:10` — Haiku 4.5, pas d'instruction `/model`
- `claude/aiad/dashboard-html.md:10` — Haiku 4.5, pas d'instruction `/model`
- `claude/aiad/standup.md:10` — Haiku 4.5, pas d'instruction `/model`
- `claude/aiad/retro.md:10` — Sonnet 4.6, pas d'instruction `/model`
- `claude/aiad/demo.md:10` — Sonnet 4.6, pas d'instruction `/model`
- `claude/aiad/sync-strat.md:10` — Sonnet 4.6, pas d'instruction `/model`
- `claude/aiad/init.md:10` — Sonnet 4.6, pas d'instruction `/model`
- `claude/aiad/emit-rules.md:10` — Haiku 4.5, pas d'instruction `/model`
- `claude/aiad/dora.md:10` — Haiku 4.5, pas d'instruction `/model`
- `claude/aiad/onboard.md:11` — Sonnet 4.6, pas d'instruction `/model`
- `claude/aiad/gouvernance.md:10` — ⚠️ double modèle : `Opus 4.8 ou Sonnet 4.6` sans critère
- `claude/aiad/flow.md:10` — Haiku 4.5, pas d'instruction `/model`
- `claude/aiad/health.md:10` — Sonnet 4.6, pas d'instruction `/model`

**Total** : 33 fichiers · 0/33 avec instruction `/model` actionnable · 4 doubles modèles sans critère de choix.

### Constat principal

Tous les fichiers utilisent le même pattern texte libre :
```markdown
**Recommandation modèle** : Sonnet 4.6 — description de la tâche.
```
ou en mode guidé :
```markdown
### Étape 0 — Recommandation modèle
Affiche : *"Sonnet 4.6 est suffisant pour capturer un Intent Statement…"*
```

Aucun ne fournit l'instruction copiable `/model claude-sonnet-4-6` que l'utilisateur peut exécuter directement dans Claude Code.

---

## Faisabilité

**Réalisable** : OUI. Modification purement éditoriale de 33 fichiers Markdown. Pas de changement de logique métier, pas d'impact sur le build ou les tests.

**Coût estimé** : faible à moyen — 33 fichiers à éditer avec un pattern uniforme. La SPEC peut se décomposer en 2 sous-tâches :
1. Résolution des 4 doubles modèles (critères de choix à définir).
2. Ajout de l'instruction `/model <id>` dans les 33 fichiers (dont 29 simples, 4 à double modèle).

**Contrainte rappelée** : le switch automatique de modèle est impossible sans support runtime Claude Code — la remédiation est uniquement éditoriale (proposer, pas forcer).

**Impact sur le cold-start** : nul — les fichiers ne sont chargés qu'à la demande par les routers `/sdd` et `/aiad`.

---

## Risques & inconnues

| # | Risque | Sévérité | Mitigation |
|---|--------|----------|------------|
| R1 | Les IDs de modèle dans les fichiers vieillissent (ex. Haiku 4.5 renommé) | mineur | Documenter le pattern `claude-haiku-4-5-20251001` vs alias court |
| R2 | Divergence future si un nouveau fichier est ajouté sans le pattern | mineur | Ajouter un check dans `emit-rules` ou le lint CI |
| R3 | Les 4 doubles modèles nécessitent une décision humaine sur le critère de choix | faible | Proposer des critères par défaut dans la SPEC (voir ci-dessous) |

**Proposition de résolution pour les 4 doubles modèles** (à valider par l'humain) :

| Fichier | Proposition |
|---------|-------------|
| `audit.md` | Opus 4.8 **si audit complet** (>500 lignes diff ou dette structurelle), Sonnet 4.6 sinon |
| `security.md` | Opus 4.8 **recommandé** (audit de sécurité = tâche haute précision) |
| `gouvernance.md` | Opus 4.8 **recommandé** (conformité réglementaire = haute précision) |
| `research.md` | Sonnet 4.6 pour l'orchestration, Haiku 4.5 optionnel pour le Discovery agent |

---

## Verdict

> ⚠️ **Ce champ doit être rempli par Steeve Evers — jamais par l'agent.**

Verdict : GO — 95 % (Steeve Evers, 2026-06-25)
