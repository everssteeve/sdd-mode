# Changelog des Artefacts AIAD

> Ce fichier trace les mises à jour significatives des artefacts SDD Mode.
> Il permet de vérifier la synchronisation artefacts/code lors du Drift Check.

## Format

```
## [Date] — [Artefact] — [Type de changement]

**Auteur** : [Qui]
**Raison** : [Pourquoi cette mise à jour]
**Impact** : [SPECs ou code affectés]
```

---

<!-- Ajoutez vos entrées ci-dessous, les plus récentes en haut -->

## 2026-06-12 — INTENT-013 + SPEC-013-1a — done (site v1.18 publié)

**Auteur** : Steeve Evers
**Raison** : site aiad.ovh **déployé en v1.18** via `site-deploy.yml` (gh-pages
`df34283`, gate version OK, vérifié sur la branche live). Les 3 objectifs de
l'intention sont atteints (0 écart de version, site v1.18, valeurs unifiées).
Clôture décidée par le gardien.
**Impact** : SPEC-013-1a → `done` (audit RGAA AA délégué à 013-4b, non bloquant) ;
INTENT-013 → `done` (résidu : 013-4b gate RGAA, renforcement hors périmètre
original, conservé en `draft`).

## 2026-06-11 — SPEC-013-4a — Drift Lock OK (done)

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check` après VALIDÉ — workflow + SPEC synchronisés,
0 gap bloquant, `@spec SPEC-013-4a` tracé.
**Impact** : `.github/workflows/site-deploy.yml` (nouveau) — déploiement
`site/` → `gh-pages` sous gate `version-sync --check`. SPEC-013-4 découpée
(013-4a done · 013-4b draft RGAA). 1er run de publication = merge `main` (humain).

## 2026-06-11 — SPEC-013-2 — Drift Lock OK (done)

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check` après VALIDÉ — code/docs + SPEC synchronisés,
0 gap bloquant. SPEC documentaire (pas d'annotation `@spec` requise).
**Impact** : `SDDMode.md` → `docs/archive/SDDMode.md` (+ en-tête historique) ;
`GUIDE.md` et corps `CLAUDE.md` rendus version-agnostiques ; provenance historique
préservée. SPEC-013-2 → `done`.

## 2026-06-11 — SPEC-013-3 — Drift Lock OK (done)

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check` après validation — code + SPEC synchronisés dans
la même PR, 0 gap de traçabilité bloquant, `@spec SPEC-013-3` tracé, CI 7/7 verte.
**Impact** : `lib/version-sync.js` (nouveau), `bin/aiad-sdd.js` (handler
`version-sync`), `.github/workflows/aiad-version-check.yml` (nouveau),
`test/version-sync.test.js`, 57 pages `site/` (zones marquées), `package.json`
bumpé 1.17.0 → 1.18.0 + cascade emit-rules/docs. SPEC-013-3 → `done`.
