# SPEC-[NNN]-[nom-court] — variante EARS

> Cette variante de SPEC est **optionnelle** — elle force l'expression des critères d'acceptation au format **EARS** (Easy Approach to Requirements Syntax). Activable via `/sdd spec --ears`.
>
> Pourquoi ? EARS élimine 95 % des ambiguïtés courantes (modaux flous, sujets implicites, critères composés) et augmente directement le score SQS critère 2 (Testabilité). Le linter `ears-validator` est exécuté automatiquement à `/sdd gate` quand cette variante est utilisée.
>
> Cohabitation : tu peux livrer une SPEC standard (prose) ou EARS — les deux sont reconnues par toutes les commandes du cycle SDD. EARS reste une variante d'élévation, pas une obligation.

---

**Intent parent** : INTENT-[NNN]
**Auteur** : [PE]
**Date** : [YYYY-MM-DD]
**Statut** : draft
**Format** : EARS
**SQS** : [À évaluer via /sdd gate]

---

## 1. Contexte

[Résumé Intent parent — 2-3 phrases max]

## 2. Comportement Attendu

### Input
[Schéma / type / source]

### Processing
[Étapes du traitement]

### Output
[Schéma / format / destination]

### Cas limites
[≥ 3 edge cases explicites — chacun deviendra un critère d'acceptation EARS de type `Unwanted behaviour` (IF/THEN)]

## 3. Critères d'Acceptation (EARS)

> Format obligatoire pour chaque critère :
> - **Ubiquitous** : `The <system> SHALL <response>.`
> - **Event-driven** : `WHEN <trigger>, the <system> SHALL <response>.`
> - **State-driven** : `WHILE <state>, the <system> SHALL <response>.`
> - **Optional feature** : `WHERE <feature>, the <system> SHALL <response>.`
> - **Unwanted behaviour** : `IF <condition>, THEN the <system> SHALL <response>.`
>
> Règles :
> 1. **Un seul SHALL** par critère (sinon → découper).
> 2. **Sujet explicite** (`the Auth Service`, `the API`, …) — jamais une phrase qui commence par un verbe.
> 3. **Verbe observable** : `return`, `log`, `reject`, `display`, `persist`, `emit` — pas `understand`, `know`, `consider`.
> 4. **Quantification chiffrée** quand applicable (`within 200ms p95`, `up to 100 items`) — pas `fast`, `quickly`, `user-friendly`.
> 5. **Mots interdits** détectés par le linter : `should`, `might`, `may`, `could`, `as appropriate`, `user-friendly`, `fast`, `intuitive`, `easy`, `seamless`, `robust`.

### CA-001 — [Titre court]

> Pattern : Event-driven

`WHEN <user submits valid credentials>, the <Auth Service> SHALL <return a JWT signed with HS256 valid for 24h>.`

- [ ] Implémenté
- [ ] Testé : `tests/[chemin].test.ts::[nom]`

### CA-002 — [Titre court]

> Pattern : Unwanted behaviour

`IF <credentials are invalid>, THEN the <Auth Service> SHALL <return HTTP 401 with body { code: "INVALID_CREDENTIALS" }>.`

- [ ] Implémenté
- [ ] Testé : `tests/[chemin].test.ts::[nom]`

### CA-003 — [Titre court]

> Pattern : State-driven

`WHILE <the OIDC provider is unavailable>, the <Auth Service> SHALL <fall back to local credential validation and emit a degraded-mode log entry every 30s>.`

- [ ] Implémenté
- [ ] Testé : `tests/[chemin].test.ts::[nom]`

<!-- Ajoute autant de critères que nécessaire — un par ligne `### CA-NNN`. -->

## 4. Interface / API

```
[Signature, endpoint, schéma — précis, pas indicatif]
```

## 5. Dépendances

- [Module / service / SPEC parente]

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~X tokens
- Cette SPEC : ~X tokens
- Fichiers source pertinents : [liste]
- **Total estimé** : ~X tokens

## 7. Definition of Output Done (DoOD)

- [ ] Code + lint passing
- [ ] Tests unitaires sur cas limites
- [ ] **EARS lint : 0 violation** (skill `ears-validator`)
- [ ] SPEC mise à jour si écart (Drift Lock)
- [ ] Annotations machine-vérifiables posées (`@spec`, `@verified-by`, …)
- [ ] Code review passée
- [ ] Gouvernance vérifiée (AI-ACT / RGPD / RGAA / RGESN si applicable)

---

## Anti-patterns EARS (à corriger avant `/sdd gate`)

| Anti-pattern | Exemple | Correction |
|---|---|---|
| Modal vague | `The system should return 200.` | `The API SHALL return HTTP 200.` |
| Pas de sujet | `Returns the user profile.` | `The Profile Service SHALL return the user profile.` |
| Verbe non observable | `The user understands the error.` | `WHEN validation fails, the system SHALL display the failed field name in the error response.` |
| Multi-SHALL | `The system SHALL log AND SHALL retry.` | Découper en CA-NNN + CA-NNN+1. |
| Ambiguïté quantitative | `… within a reasonable time.` | `… within 200ms (p95).` |
| Mot interdit | `The UI must be intuitive and fast.` | `The UI SHALL render the dashboard within 1.5s on a 3G connection (p95).` |
