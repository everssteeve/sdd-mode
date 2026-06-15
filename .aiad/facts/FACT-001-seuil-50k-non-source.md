# FACT-001 — Seuil 50K tokens (context rot) non sourcé

**Date** : 2026-06-11
**Auteur** : Steeve Evers
**SPEC concernée** : SPEC-014-2 (sourcing seul — requalification du 50K)
**Statut** : traité (2026-06-15)

## Écart constaté

**Livré** : un seuil fixe de **50K tokens** est utilisé comme plafond de
context rot pour le budget d'une tâche (1 SPEC active). Il apparaît, codé en
dur et à l'identique, dans :
- `.claude/sdd/gate.md` — « Vérifier < 50K tokens (seuil context rot) »
- `.claude/sdd/exec.md` — « Si > 50K tokens : condenser AVANT de lancer l'agent »
- `.claude/sdd/split.md` — « budget > 50K → découper la SPEC »
- `.claude/skills/context-budget/SKILL.md` — « Au-dessus de 50K tokens projetés → réduire »

**Désiré** : tout claim chiffré qui pilote une décision doit être adossé à une
source ou à une dérivation explicite (valeur n°5 « Empirisme sans Concession »,
cf. INTENT-014).

## Impact qualifié

- **Type** : conformité (cohérence interne / sourcing des claims)
- **Sévérité** : mineur

Le **60–70 %** de la fenêtre modèle (`frameworkAIAD.md:68`, `CLAUDE.md:193`)
EST sourcé (Addy Osmani janv. 2026 + Anthropic mars 2026). Le **50K**, lui,
est un nombre rond :
- aucun fichier ne l'explique ni ne le relie à une étude ;
- il n'est pas dérivé du 60–70 % (35 % d'un budget tâche de 130k ne tombe pas
  sur 50k) ;
- il n'est pas instrumenté : la valeur comparée est une **estimation manuelle**
  remplie en SPEC §6, pas un compteur de tokens machine (skill `context-budget`,
  métrique M3 → JNSP `?/5` si §6 vide).

On prêche la mesure (50K = discipline de sobriété) sans la sourcer sur
nous-mêmes — exactement le pattern visé par INTENT-014.

## Décision d'action

**Action choisie** : signal versé à INTENT-014 (pas de patch immédiat).
**Justification** : ce n'est pas un bug comportemental mais un défaut de
sourcing/dérivation ; deux options à trancher par l'humain en phase SPEC —
(a) adosser le 50K à une source/un protocole `bench/`, ou (b) le requalifier en
dérivation explicite du seuil 60–70 %, ou (c) l'assumer comme heuristique de
sobriété en le documentant comme tel (jamais supprimé en silence).
**Lien SPEC** : INTENT-014 (candidat SPEC-014-2 — sourcing/requalification des claims).

## Résolution (2026-06-15 — SPEC-014-2)

**Option retenue : (c)** — le 50K est **requalifié en heuristique de sobriété assumée**,
non sourcée et non dérivée du 60–70 %, documentée comme telle (jamais supprimée). Tranché
par Steeve Evers via RESEARCH-015 §R3. La formulation canonique est posée dans les 4
fichiers (`.claude/sdd/gate.md`, `exec.md`, `split.md`, `.claude/skills/context-budget/SKILL.md`).
Les claims externes 41,7 % (R2Code, arXiv avril 2026) et −96 % (AWS Strands 2026) sont déjà
des citations datées (vérifiées, inchangées). Pas de protocole `bench/` tokens (R4).
