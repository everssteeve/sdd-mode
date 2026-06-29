---
traceability: exempt
traceability_reason: "Documentation seule — modification de .aiad/AGENT-GUIDE.md, non scanné par EXTENSIONS_CODE (DOSSIERS_IGNORES inclut .aiad). Contenu vérifié par grep CA-1/CA-5."
---
# SPEC-028-2 — AGENT-GUIDE : section « Consommateurs de construireMatrice() »

**Intent parent** : INTENT-028
**Research** : RESEARCH-038 (GO 90 %)
**Auteur** : Steeve Evers
**Date** : 2026-06-29
**Statut** : done
**validated_at** : 2026-06-29
**Format** : prose
**SQS** : 5/5

---

## 1. Contexte

INTENT-028 (LL-2026-06-24-b) : la garde `safe: false` dans `lib/archive.js` est devenue caduque après le patch `78d3b9b` de `construireMatrice()` parce que les consommateurs de cette fonction n'étaient pas documentés. Le Discovery (RESEARCH-038) a identifié 8 modules de production appelant `construireMatrice()` — aucune section centralisée dans l'AGENT-GUIDE ne les liste. Une modification de l'invariant de retour se propage aujourd'hui silencieusement. Cette SPEC ajoute la documentation sans modifier l'API.

## 2. Comportement Attendu

### Input

Toute session où un agent modifie `lib/sdd-trace.js` (`construireMatrice`), un consommateur, ou l'invariant de la structure de retour.

### Processing

L'agent **lit** la section « Consommateurs de `construireMatrice()` » en AGENT-GUIDE avant d'éditer tout fichier lié. Il y trouve :

1. La liste exhaustive des consommateurs (module + ligne d'appel).
2. Les invariants de la structure de retour (`gaps.codeSansSpec` = objet `{bloquant, non_bloquant, total, items}`, pas tableau).
3. La règle d'audit : tout changement de `construireMatrice()` ou de ses invariants impose un `grep -rn construireMatrice lib/ test/` pour identifier les appelants affectés.

### Output

Une nouvelle sous-section `### Consommateurs de construireMatrice()` insérée dans `## PATTERNS DE DÉVELOPPEMENT` de `.aiad/AGENT-GUIDE.md`, avec le contenu exact défini en §4.

### Cas limites

- Un nouveau consommateur est ajouté dans le futur → la section doit être mise à jour dans la même PR que le nouveau consommateur (Drift Lock).
- Un consommateur est supprimé → le retirer de la liste dans la même PR.
- La structure de retour évolue → mettre à jour les invariants documentés dans la même PR que le changement de `construireMatrice()`.

## 3. Critères d'Acceptation

- [ ] **CA-1** : `.aiad/AGENT-GUIDE.md` contient une section dont le titre exact est `### Consommateurs de construireMatrice()`, placée dans `## PATTERNS DE DÉVELOPPEMENT`.
- [ ] **CA-2** : La section liste les 8 consommateurs production identifiés au Discovery, avec pour chacun le fichier et la ligne d'appel (`fichier:ligne`).
- [ ] **CA-3** : La section documente l'invariant `gaps.codeSansSpec` = objet `{bloquant, non_bloquant, total, items}` (pas tableau) avec la règle d'accès (`.total` pour le compte, `.items` pour l'itération).
- [ ] **CA-4** : La section inclut une règle explicite : « Tout changement de `construireMatrice()` ou de son invariant de retour → lancer `grep -rn construireMatrice lib/ test/` et auditer chaque appelant. »
- [ ] **CA-5** : `grep "Consommateurs de" .aiad/AGENT-GUIDE.md` retourne exactement 1 ligne (pas de doublon).

## 4. Interface / API

Contenu exact de la nouvelle sous-section à insérer dans `## PATTERNS DE DÉVELOPPEMENT` (après `### Pattern 2`) :

```markdown
### Consommateurs de construireMatrice()

> **Règle** : tout changement de `construireMatrice()` (lib/sdd-trace.js) ou de son invariant de retour impose de lancer `grep -rn construireMatrice lib/ test/` et d'auditer chaque appelant dans la même PR.

**Définition** : `lib/sdd-trace.js:486` — `export function construireMatrice(racineProjet)`

**Invariant de retour (à jour au 2026-06-29)** :
- `gaps.codeSansSpec` : objet `{ bloquant, non_bloquant, total, items }` — **pas un tableau**. Utiliser `.total` pour le compte, `.items` pour l'itération.
- Archive/ est inclus dans `specsConnus` depuis le patch `78d3b9b` — un fichier archivé n'est plus considéré comme gap.

**Consommateurs production (8 modules)** :

| Module | Ligne d'appel | Usage | Criticité |
|--------|--------------|-------|-----------|
| `lib/sdd-trace.js` | 703, 731 | `trace()`, `watchTrace()` — rendus md/json/sarif | CRITIQUE |
| `lib/drift-verdict.js` | 99 | `emitDriftVerdict()` — accède `gaps.codeSansSpec` | CRITIQUE |
| `lib/ai-act-audit.js` | 35 | `auditAiAct()` — try/catch (optionnel) | MEDIUM |
| `lib/leadership-metrics.js` | 37 | `computeLeadershipMetrics()` — try/catch (optionnel) | MEDIUM |
| `lib/dpia.js` | 53 | `dpia()` — try/catch (optionnel) | MEDIUM |
| `lib/repl.js` | 60 | commande `repl` — `compterGaps(m)` | MEDIUM |
| `lib/workspace.js` | 71 | `runWorkspace()` — agrégation multi-projet | MEDIUM |
| `lib/dashboard/collect.js` | 12 | collecte data dashboard | LOW |

**Checklist quand on modifie construireMatrice() ou un invariant** :
1. `grep -rn construireMatrice lib/ test/` — identifier tous les appelants
2. Vérifier que chaque consommateur CRITIQUE fonctionne encore (`npm test`)
3. Mettre à jour ce tableau si un consommateur est ajouté ou supprimé
```

## 5. Dépendances

- `.aiad/AGENT-GUIDE.md` — unique fichier modifié
- SPEC-028-1 (indépendante — parallélisable)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE condensé : ~300 tokens
- Cette SPEC : ~350 tokens
- Fichiers source pertinents : `.aiad/AGENT-GUIDE.md` (lecture + écriture)
- **Total estimé** : ~700 tokens (tâche documentaire pure)

## 7. Definition of Output Done (DoOD)

- [ ] Section `### Consommateurs de construireMatrice()` présente dans AGENT-GUIDE
- [ ] CA-1 à CA-5 vérifiés
- [ ] `grep "Consommateurs de" .aiad/AGENT-GUIDE.md` → 1 ligne exactement
- [ ] SPEC statut → `done` à la même PR (documentation seule — pas de Drift Check code requis)
