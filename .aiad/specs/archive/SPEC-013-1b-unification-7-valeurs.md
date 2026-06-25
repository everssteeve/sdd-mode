---
id: SPEC-013-1b
title: Unification à 7 valeurs sur Constitution / Vision / AGENT-GUIDE / site
parent_intent: INTENT-013
parent_spec: SPEC-013-1
status: archived
format: prose
sqs: 4.0
author: Steeve Evers
date: 2026-06-11
governance: AIAD-RGESN
---

# SPEC-013-1b — Unification à 7 valeurs sur les 4 sources

**SPEC parent** : SPEC-013-1 (découpée)
**Intent parent** : INTENT-013
**Ordre d'exécution** : 2 sur 2 (indépendante de 013-1a — fichiers disjoints)
**Dépendances intra-split** : aucune (parallélisable avec 013-1a)
**Statut** : **ARCHIVÉE** (2026-06-11) — clôturée sans implémentation, décision gardien.
**Gouvernance** : AIAD-RGESN

> ⛔ **ARCHIVÉE — prémisse inexistante (investigation 2026-06-11).**
>
> La contradiction « 6 vs 7 valeurs » qui motivait cette SPEC **n'existe pas
> dans le code** :
> - **Constitution** (`frameworkAIAD.md:72-95`) : « les **sept** valeurs
>   fondatrices », Human Authorship = n°7. Déjà 7.
> - **`CLAUDE.md:285-293`** : 7 valeurs. **`site/{fr,en}/valeurs.html`** : « sept
>   valeurs ». Déjà 7.
> - Le seul « 6 valeurs » littéral du repo est dans `productbacklog.md` et désigne
>   les **6 forges CI** (`forge.enum`), **sans rapport** avec les valeurs AIAD.
>
> De plus, le **critère 3 était faux** : la section Valeurs de `CLAUDE.md` est
> **hors zone `emit-rules`** (zone gérée = lignes 1-11 seulement, cf.
> `lib/emit-rules.js:341`), l'AGENT-GUIDE ne liste pas les valeurs, et emit-rules
> n'en produit aucune. Aucune propagation via emit-rules n'était possible ni
> nécessaire.
>
> **Conclusion** : aucune action requise — l'état désiré (7 valeurs cohérentes
> partout) est déjà atteint. Signal empirique versé à [[FACT-001]]/INTENT-014
> (un claim — la contradiction — non vérifié contre le code). Le contenu
> ci-dessous est conservé pour traçabilité historique.

## 1. Contexte

Deux sources internes se contredisent sur le nombre de valeurs AIAD :
**Constitution Art. II = 6 valeurs** (Human Authorship replié dans la valeur n°1)
vs **page Vision & Philosophie = 7 valeurs** (Human Authorship en n°7, forme
reprise par `CLAUDE.md`/`AGENT-GUIDE.md` et le site v1.18). Cette incohérence
contredit la valeur n°2 « Drift = Échec de Processus » sur le framework lui-même.

## 2. Décision gardien — TRANCHÉE (héritée de SPEC-013-1 §7)

> **Décision** : **7 valeurs partout** (option A) — tranchée par Steeve Evers
> (gardien), 2026-06-11. Human Authorship est explicité comme **7e valeur
> autonome** ; la Constitution Art. II est alignée sur l'usage de fait.
>
> Conséquence : N = 7 est figé, le critère est spécifiable sans ambiguïté.
> Toute clarification ultérieure reste soumise à l'accord du gardien
> (Constitution Art. VI — sphère des Valeurs).

## 3. Court-circuit Research (§3.5)

**Décision** : Research court-circuitée — Steeve Evers (PE / gardien), 2026-06-11.
**Justification** : pur alignement éditorial (contenu), décision déjà tranchée,
aucune inconnue de faisabilité ni surface de code applicatif. Hérité de SPEC-013-1.

## 4. Implémentation

Propager **N = 7 valeurs** (Human Authorship = 7e) sur les **4 sources** :

1. **Constitution Art. II** — passer de 6 à 7 valeurs (Human Authorship extrait
   de la valeur n°1 et explicité en n°7). Modification soumise à l'accord du
   gardien (déjà obtenu, §2).
2. **Page Vision & Philosophie** — déjà à 7 : vérifier la cohérence d'intitulés
   avec la Constitution (mêmes libellés, même ordre).
3. **Source AGENT-GUIDE** (`.aiad/AGENT-GUIDE.md` + `.aiad/gouvernance/`) — aligner
   la liste, puis **régénérer** `CLAUDE.md`/`AGENTS.md` via `npx aiad-sdd emit-rules`.
4. **`site/`** — vérifier que les 7 valeurs et leurs libellés concordent.

## 5. Critères d'acceptation

- [ ] Le **nombre de valeurs = 7** sur les 4 sources (Constitution Art. II, page
      Vision & Philosophie, AGENT-GUIDE/`CLAUDE.md`, `site/`), Human Authorship
      explicité comme **7e valeur** autonome.
- [ ] Les **libellés et l'ordre** des 7 valeurs sont **identiques** entre la
      Constitution et la page Vision & Philosophie (pas seulement le compte).
- [ ] `CLAUDE.md` racine reflète les 7 valeurs **via régénération `emit-rules`**
      (modification dans la source `AGENT-GUIDE`, **jamais éditée à la main** —
      sinon écrasée à la prochaine régénération).
- [ ] `npx aiad-sdd emit-rules --check` **passe** après propagation (parité
      multi-runtime préservée).

## 6. Cas limites (≥ 3)

1. **CLAUDE.md régénéré** : éditer `CLAUDE.md` directement serait écrasé par
   `emit-rules` → la source est `AGENT-GUIDE`/`gouvernance` (cf. critère 3).
2. **Divergence de libellés** : un compte de 7 mais des intitulés différents
   entre Constitution et Vision laisserait un drift sémantique → critère 2.
3. **Occurrences résiduelles « 6 valeurs »** : du texte ailleurs dans le repo/site
   peut encore dire « 6 valeurs » → recenser (`grep`) et corriger toutes les
   mentions chiffrées.
4. **Gouvernance Constitution** : modifier Art. II touche la sphère des Valeurs →
   accord gardien requis (obtenu, §2) et tracé.

## 7. Dépendances

- **Décision gardien** « 6 vs 7 » — satisfaite (§2).
- Aucune dépendance dure vis-à-vis de 013-1a (fichiers disjoints, parallélisable).

## 8. Definition of Output Done (DoOD)

- [ ] 7 valeurs cohérentes (compte + libellés + ordre) sur les 4 sources.
- [ ] `emit-rules --check` vert.
- [ ] Aucune mention résiduelle « 6 valeurs » dans le repo/site.
- [ ] SPEC mise à jour si écart constaté (Drift Lock).
