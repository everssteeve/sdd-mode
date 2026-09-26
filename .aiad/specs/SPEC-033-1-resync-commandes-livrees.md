---
id: SPEC-033-1
title: Resynchroniser les commandes livrées sur celles du dépôt + contrôle anti-divergence
parent_intent: INTENT-033
status: ready
format: prose
sqs: 5
author: Steeve Evers
date: "2026-09-25"
---

# SPEC-033-1-resync-commandes-livrees

**Intent parent** : INTENT-033
**Research** : RESEARCH-040 — GO (auteur) → CONDITIONAL GO (machine) ; condition traitée ici : « divergence des deux exemplaires de commandes »
**Auteur** : Steeve Evers *(rédaction : agent, 2026-09-25 — à valider à la Gate)*
**Date** : 2026-09-25
**Statut** : ready
**Format** : prose
**SQS** : 5/5 — Execution Gate OUVERTE (2026-09-26), Test de l'Étranger PASS

---

## 1. Contexte

Chaque commande et skill existe en deux exemplaires : `.claude/` (utilisé dans le dépôt) et `templates/.claude/` (livré aux utilisateurs par `init` et `update`). Ils ont divergé sur 35 fichiers (116 lignes, dans les deux sens) : les utilisateurs n'ont jamais reçu INTENT-032 (recommandation `/model` actionnable) ni SPEC-021-2 (empreinte mesurée), marqués done. Tant que cette divergence existe, les évolutions d'INTENT-033 (SPEC-033-2 à 033-4) n'atteindraient pas les utilisateurs. Cette SPEC fait de `templates/.claude/` la source unique et interdit toute nouvelle divergence.

## 2. Comportement Attendu

### Input

- `.claude/{sdd,aiad,skills}/**/*.md` et `templates/.claude/{sdd,aiad,skills}/**/*.md` (état au 2026-09-25 : 35 fichiers divergents).

### Processing

1. Pour chaque fichier divergent, **fusion à trois voies** : conserver dans `templates/.claude/` toute amélioration présente d'un seul côté (ex. lignes `👉 /model …` d'INTENT-032, étape « Empreinte mesurée » de SPEC-021-2 côté dépôt ; lignes « Budget > 50K » et estimation pré-session côté templates).
2. **Généraliser** les références internes au dépôt introduites côté `.claude/` avant de les livrer : une référence à `.aiad/facts/FACT-NNN`, `INTENT-NNN`, `SPEC-NNN` ou `RESEARCH-NNN` **de ce dépôt** est remplacée par sa substance (ex. « heuristique de sobriété assumée, non sourcée »).
3. Copier le résultat fusionné dans `.claude/` : les deux arbres deviennent **identiques octet pour octet**.
4. Ajouter un script `scripts/check-commands-parity.js` et une étape dans `.github/workflows/ci.yml` qui échoue si `.claude/{sdd,aiad,skills}` et `templates/.claude/{sdd,aiad,skills}` diffèrent.

### Output

- `templates/.claude/` fusionné (source unique) ; `.claude/` identique ; script de parité ; étape CI.

### Cas limites

1. Fichier présent d'un seul côté → ajouté de l'autre (sauf fichier propre au dépôt listé explicitement dans une liste d'exclusion du script, vide par défaut).
2. Conflit réel (même ligne modifiée différemment des deux côtés) → **point d'arrêt humain** : l'agent n'en résout aucun ; il s'arrête et présente la liste des conflits (fichier, ligne, les deux versions). L'auteur tranche ; chaque choix est noté dans l'Historique de cette SPEC avant la reprise.
3. Les références de modèles non datées (118) **ne sont pas modifiées** ici (hors périmètre, suivi séparément).
4. Les exemples d'identifiants déjà présents dans `templates/` (`SPEC-042`, `INTENT-042`, utilisés comme exemples pédagogiques) sont conservés.

## 3. Critères d'Acceptation

- [ ] CA-001 — `node scripts/check-commands-parity.js` sort avec le code 0 et `diff -rq .claude/sdd templates/.claude/sdd`, `…/aiad`, `…/skills` ne renvoie aucune ligne.
- [ ] CA-002 — Les 33 commandes `/sdd` et `/aiad` de `templates/.claude/` contiennent une ligne `/model <id>` (grep : 0 fichier sans `/model `), comme exigé par SPEC-032-1.
- [ ] CA-003 — `templates/.claude/sdd/context.md` contient l'étape « Empreinte mesurée » (`aiad-sdd footprint`).
- [ ] CA-004 — `grep -rE '\.aiad/facts/FACT-' templates/.claude` ne renvoie aucune ligne.
- [ ] CA-005 — Modifier un seul des deux exemplaires fait échouer le script de parité (code 1) — test automatisé.
- [ ] CA-006 — `npm test` passe sans régression.
- [ ] CA-007 — Chaque conflit réel rencontré figure dans l'Historique de cette SPEC avec le choix de l'auteur (0 conflit → mention « aucun conflit réel »).

## 4. Interface / API

```
node scripts/check-commands-parity.js [--json]
  exit 0 : arbres identiques
  exit 1 : divergence — liste des fichiers divergents sur stdout
```

## 5. Dépendances

- Aucune SPEC préalable. Bloque SPEC-033-2, 033-3, 033-4.
- Modèle de contrôle CI : `.github/workflows/aiad-emit-rules-check.yml`.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~2 000 tokens
- Cette SPEC : ~1 500 tokens
- Fichiers source pertinents : les 35 fichiers divergents (diff seulement, ~116 lignes), `scripts/`, `.github/workflows/ci.yml`
- **Total estimé** : ~12 000 tokens

## 7. Definition of Output Done (DoOD)

- [ ] Code + lint passing
- [ ] Test du script de parité (cas identique / cas divergent)
- [ ] SPEC mise à jour si écart (Drift Lock)
- [ ] Annotations `@intent INTENT-033` / `@spec SPEC-033-1` / `@verified-by` sur le script
- [ ] Code review passée
- [ ] Gouvernance vérifiée (RGESN : aucune dépendance ajoutée)

## Historique des modifications

| Date | Changement | Raison |
|------|------------|--------|
| 2026-09-26 | Gate : cas limite 2 remplacé par un point d'arrêt humain ; CA-007 ajouté. | Décision de l'auteur — l'ancienne règle (« version la plus récente fonctionnellement ») n'était pas décidable par un agent. |
| 2026-09-26 | Execution Gate OUVERTE — SQS 5/5, Test de l'Étranger PASS. Statut → ready. | Scores validés par l'auteur. |
