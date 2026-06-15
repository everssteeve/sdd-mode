# SPEC-014-2-sourcing-claims

**Intent parent** : INTENT-014
**Research** : RESEARCH-015 (CONDITIONAL GO, 2026-06-12) — périmètre réduit par R4 (sourcing seul)
**Auteur** : Steeve Evers
**Date** : 2026-06-15
**Statut** : validation
**Format** : prose
**SQS** : 5/5 — Gate OUVERTE (2026-06-15, Test de l'Étranger PASS)

---

## 1. Contexte

INTENT-014 exige que tout claim chiffré pilotant une décision soit sourcé, dérivé, ou
assumé explicitement. Le Discovery (RESEARCH-015) a tranché le périmètre (R4) : **sourcing
seul, pas de nouveau protocole `bench/` tokens**. Deux sous-trous : (a) les claims externes
« −41,7 % » (R2Code) et « −96 % » (AWS Strands) — déjà des citations datées à figer/vérifier ;
(b) le seuil **50K tokens** codé en dur dans 4 fichiers sans source ni dérivation (FACT-001),
à **requalifier en heuristique de sobriété assumée** (C-R3), jamais supprimé en silence.

## 2. Comportement Attendu

### Input
- **Claims externes déjà sourcés** (vérifiés le 2026-06-15) : `frameworkAIAD.md:114`,
  `templates/frameworkAIAD.md:114`, `templates/SDDMode.md:50,203`, `docs/archive/SDDMode.md:55,208`
  — tous portent « R2Code, arXiv avril 2026 » et « AWS Strands (2026) » inline.
- **Seuil 50K non sourcé** (FACT-001), codé en dur dans : `.claude/sdd/gate.md:74`,
  `.claude/sdd/exec.md:33,71`, `.claude/sdd/split.md:10,49`,
  `.claude/skills/context-budget/SKILL.md:129`.
- Donnée sourcée à préserver comme référence : le **60–70 % de fenêtre** (Addy Osmani janv.
  2026 + Anthropic mars 2026) — le 50K n'en dérive pas.

### Processing
1. **Requalifier le 50K** (C-R3) dans les 4 fichiers : remplacer la mention nue par une
   formulation explicite d'**heuristique de sobriété assumée, non sourcée et non dérivée**
   du 60–70 %, avec renvoi à FACT-001/SPEC-014-2. Formulation canonique homogène sur les
   4 fichiers (même phrase de qualification).
2. **Figer les claims externes** : vérifier que les 5 emplacements portent la source datée
   (R2Code arXiv avril 2026 ; AWS Strands 2026). Aucun changement de valeur. Si un emplacement
   manque la source → l'ajouter (jamais supprimer le claim).
3. **Clôturer FACT-001** : statut `ouvert` → `traité`, action retenue = option (c) heuristique
   assumée, lien vers SPEC-014-2.
4. **Rendre la règle active (gate)** : un guard zéro-dep `scripts/lint-claims.js` échoue si un
   50K nu réapparaît (sans requalification) ou si un claim externe perd sa source. Câblé dans
   la CI (`lint:claims`) et `prepublishOnly` — la règle de sourcing devient enforced, pas
   seulement documentée (cohérent avec l'objectif INTENT-014 « gates qualité actifs » et le
   critère de drift). Ancre aussi la SPEC dans du code tracé (`@spec SPEC-014-2`).

### Output
- 4 fichiers `.claude/` avec le 50K requalifié (formulation canonique).
- Vérification consignée des 5 emplacements de claims externes (déjà conformes).
- `FACT-001` clôturé.
- Index SPEC + Intent à jour.

### Cas limites
1. **Un emplacement de claim externe sans source** → ajouter la citation datée (pas de
   suppression silencieuse — contrainte Intent).
2. **Le 50K réapparaît ailleurs** (nouveau fichier) → la formulation canonique doit être
   réutilisable ; documenter la source unique de la qualification (FACT-001).
3. **Tension avec le 60–70 % sourcé** → la requalification doit dire explicitement que le
   50K n'est PAS dérivé du 60–70 %, pour ne pas créer un faux lien de causalité.
4. **emit-rules** : si la qualification touche un fichier synchronisé (AGENT-GUIDE), relancer
   `emit-rules` pour propager (les 4 fichiers ciblés ne sont pas des sources emit-rules — à vérifier).

## 3. Critères d'Acceptation

- [ ] Les 4 fichiers (`gate.md`, `exec.md`, `split.md`, `context-budget/SKILL.md`) qualifient
      le 50K comme « heuristique de sobriété assumée, non sourcée, non dérivée du 60–70 % »
      avec renvoi FACT-001 — vérifiable par `grep` de la formulation canonique.
- [ ] Aucune valeur de claim chiffré n'est modifiée ni supprimée (41,7 % / −96 % / 60–70 %
      intacts) — vérifiable par diff.
- [ ] Les 5 emplacements des claims externes portent leur source datée — vérifiable par `grep`.
- [ ] `FACT-001` est en statut `traité` avec l'action retenue et le lien SPEC-014-2.
- [ ] `npx aiad-sdd trace` ne régresse pas (pas de nouveau gap bloquant).
- [ ] `npm run lint:claims` échoue (exit 1) sur un 50K nu ou un claim sans source, et passe
      (exit 0) sur le repo réel — testable (`test/lint-claims.test.js`).
- [ ] Si un fichier source `emit-rules` est touché, les rendus régénérés sont synchronisés
      (`aiad-emit-rules-check` vert) ; sinon, mention explicite que les 4 fichiers n'en relèvent pas.

## 4. Interface / API

```
# Formulation canonique 50K (exemple cible)
≈ 50K tokens — heuristique de sobriété assumée (non sourcée, non dérivée du
seuil sourcé 60–70 % de la fenêtre ; cf. FACT-001 / SPEC-014-2).

# Vérification
grep -rn "heuristique de sobriété assumée" .claude/sdd/ .claude/skills/context-budget/
npx aiad-sdd trace
```

## 5. Dépendances

- FACT-001 (signal parent).
- `scripts/lint-claims.js` (guard zéro-dep) + `test/lint-claims.test.js` + câblage CI/`prepublishOnly`.
- Stackée sur SPEC-014-1 (réutilise la chaîne de gates de publication mise en place en 014-1).
- Hors périmètre (R4) : tout nouveau protocole `bench/` de mesure tokens.

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~500 tokens
- Cette SPEC : ~900 tokens
- Fichiers : 4 × `.claude/*` + FACT-001 + 5 emplacements de claims (lecture ciblée)
- **Total estimé** : ~5–7k tokens

## 7. Definition of Output Done (DoOD)

- [x] 50K requalifié (formulation canonique) sur les 4 fichiers (6 mentions)
- [x] Claims externes figés/vérifiés (5 emplacements), aucune valeur modifiée
- [x] FACT-001 clôturé (`traité`, option (c))
- [x] Guard `scripts/lint-claims.js` (zéro-dep) + 10 tests + câblage CI/`prepublishOnly`
- [x] `trace` sans régression (exit 0, gap SPEC-014-2 levé) ; `emit-rules-check` vert (régen sur PR #5)
- [x] SPEC ↔ artefacts synchronisés (Drift Lock)
- [ ] Code review passée (PR à ouvrir)
- [x] Gouvernance : **RGESN** (sobriété — aucune surface ajoutée). AI-ACT/RGPD/RGAA non applicables.
