---
id: SPEC-013-2
title: Unification des docs racine + archivage de SDDMode.md
parent_intent: INTENT-013
status: review
format: prose
sqs: 4.0
author: Steeve Evers
date: 2026-06-11
governance: AIAD-RGESN
---

# SPEC-013-2 — Unification des docs racine + archivage de SDDMode.md

**Intent parent** : INTENT-013
**SQS** : 4.0 / 5 — Gate OUVERTE (réserve levée)
**Statut** : validation (VALIDÉ 2026-06-11 — triple validation PASS : technique
[lint + 3831 tests + 3 checks verts + tarball 4/4], fonctionnelle [4/4 critères §3],
drift [0 gap], gouvernance [RGESN PASS, sobriété documentaire]. Prêt pour `/sdd drift-check`.)
**Gouvernance** : AIAD-RGESN (sobriété documentaire — réduction de la redondance)

> ✅ **Réserve rétrécie (investigation 2026-06-11)** : le **bandeau CLAUDE.md
> existe déjà** — la zone `aiad-emit-rules:start…end` (lignes 1-11) porte déjà
> `DO NOT EDIT — regenerate via /aiad-emit-rules` + `generated-by` + `source-hash`
> (cf. `lib/emit-rules.js:328`). Le critère 3 (bandeau) est donc **déjà satisfait**.
>
> Reste à traiter (mécanique) :
> 1. **`SDDMode.md` → `docs/archive/`** + recenser/mettre à jour les **références
>    entrantes** à `SDDMode.md` dans le repo (liens internes).
> 2. **En-tête périmé du corps `CLAUDE.md`** : la ligne « Framework AIAD v1.12 —
>    SDD Mode v1.12 » (hors zone emit-rules, l.13) est obsolète vs package 1.17 —
>    à traiter via une **zone marquée** (cf. SPEC-013-3 C1), pas en dur.

## 1. Contexte

Trois fichiers (~1 800 lignes cumulées) décrivent le même workflow SDD avec des
divergences de version : `README.md` (v1.12), `GUIDE.md` (v1.14), `SDDMode.md`
(v1.6, soit 12 versions de retard). `CLAUDE.md` racine (v1.12) est supplanté par
`AGENTS.md` auto-généré mais n'est marqué nulle part comme tel. Cette redondance
contredit la valeur « Sobriété Intentionnelle » et entretient le drift.

## 2. Court-circuit Research (§3.5)

**Décision** : Research court-circuitée — décidée par Steeve Evers (PE / gardien), 2026-06-11.
**Justification** : pur réagencement éditorial de fichiers Markdown existants, sans
inconnue de faisabilité ni surface de code applicatif. Aucun risque « specs-to-code ».
**Proportionnalité** : garde-fou levé sciemment (§3.5, hook `discovery-gate.js` non
bloquant). Trace conservée ici.

## 3. Implémentation

- **README.md** → pitch seul (qu'est-ce que c'est, pourquoi, installation), **sans**
  call-out de version mineure ; renvoie vers `GUIDE.md` pour le détail.
- **GUIDE.md** → référence unique et complète, **version-agnostique** (« latest »).
- **SDDMode.md** (v1.6) → déplacé dans `docs/archive/` avec un en-tête « document
  historique v1.6 — voir GUIDE.md pour la version courante ».
- **CLAUDE.md racine** → bandeau de tête signalant qu'il est généré/maintenu via
  `emit-rules` (source unique `.aiad/AGENT-GUIDE.md`) et pointant `AGENTS.md`.

## 4. Critères d'acceptation

- [ ] Aucune version mineure codée en dur dans `README.md` et `GUIDE.md` hors zones
      explicitement gérées (cf. SPEC-013-3).
- [ ] `SDDMode.md` déplacé sous `docs/archive/` avec en-tête « historique v1.6 ».
- [ ] `CLAUDE.md` racine porte un bandeau clair (source unique = `AGENT-GUIDE`,
      régénération via `emit-rules`, voir `AGENTS.md`).
- [ ] Aucun lien interne cassé après réagencement (tous les renvois résolvent).

## 5. Dépendances

- Aucune dépendance dure (parallélisable avec SPEC-013-1, fichiers disjoints).
- **Dépendance douce** : SPEC-013-3 (sync auto) s'exécute après ce nettoyage pour
  stamper la version sur des docs déjà cohérentes.

## 6. Definition of Output Done (DoOD)

- [ ] Docs réagencées, redondance README/GUIDE/SDDMode supprimée.
- [ ] Vérification des liens (pas de 404 interne).
- [ ] SPEC mise à jour si écart (Drift Lock).
