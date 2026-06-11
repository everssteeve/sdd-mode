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

## 2026-06-11 — SPEC-013-3 — Drift Lock OK (done)

**Auteur** : Steeve Evers
**Raison** : `/sdd drift-check` après validation — code + SPEC synchronisés dans
la même PR, 0 gap de traçabilité bloquant, `@spec SPEC-013-3` tracé, CI 7/7 verte.
**Impact** : `lib/version-sync.js` (nouveau), `bin/aiad-sdd.js` (handler
`version-sync`), `.github/workflows/aiad-version-check.yml` (nouveau),
`test/version-sync.test.js`, 57 pages `site/` (zones marquées), `package.json`
bumpé 1.17.0 → 1.18.0 + cascade emit-rules/docs. SPEC-013-3 → `done`.
