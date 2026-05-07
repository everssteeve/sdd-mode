---
name: ears-validator
description: Use when linting requirements or acceptance criteria for EARS syntax (Easy Approach to Requirements Syntax). Detects forbidden vague words (should, might, fast, user-friendly, intuitive…), multiple SHALL in a single requirement, missing trigger keywords, missing subjects, non-observable verbs and untestable assertions. Triggered by /sdd spec, /sdd gate, /sdd validate, /sdd audit. Mode strict activé pour les SPECs au format EARS (entête `Format : EARS`).
---

# Skill — EARS Validator (Easy Approach to Requirements Syntax)

> Une SPEC ne doit JAMAIS contenir d'ambiguïté sur le comportement attendu.
> EARS est un cadre minimal et éprouvé pour exprimer des exigences testables.
>
> Cette skill cohabite avec le format prose : tu peux l'invoquer sur n'importe quelle §3 — strict si la SPEC déclare `Format : EARS`, indicatif sinon.

## Quand l'utiliser

- À la rédaction d'une SPEC, sur les critères d'acceptation (`/sdd spec` — surtout `--ears`)
- Avant l'Execution Gate (`/sdd gate`) — alimente le critère SQS Testabilité (+1 bonus si EARS strict + 0 violation)
- Pendant la validation (`/sdd validate`)
- Pendant un audit qualité (`/sdd audit`)

## Détection du mode

| Signal dans la SPEC | Mode | Conséquence |
|---|---|---|
| Entête `Format : EARS` **ou** chemin contenant `spec-ears-template` **ou** flag `--ears` passé à `/sdd spec` | **Strict** | Toute violation = bloquant. Score testabilité SQS = 0 si ≥ 1 violation. Bonus +1 si 0 violation. |
| Aucun signal | **Indicatif** | Violations signalées en suggestion. N'altère pas le SQS. |

## Les 5 patterns EARS

| Pattern | Forme canonique | Exemple |
|---------|----------------|---------|
| **Ubiquitous** | The `<system>` SHALL `<response>`. | `The API SHALL log every request.` |
| **Event-driven** | WHEN `<trigger>`, the `<system>` SHALL `<response>`. | `WHEN the user clicks login, the system SHALL redirect to /home.` |
| **State-driven** | WHILE `<state>`, the `<system>` SHALL `<response>`. | `WHILE the cache is warming, the proxy SHALL return 503.` |
| **Optional feature** | WHERE `<feature>`, the `<system>` SHALL `<response>`. | `WHERE SSO is enabled, the system SHALL hide the password field.` |
| **Unwanted behaviour** | IF `<condition>`, THEN the `<system>` SHALL `<response>`. | `IF the token is expired, THEN the system SHALL return 401.` |

## Règles de détection (linter)

### R1 — Mots interdits (vague-words blacklist)

| Catégorie | Mots détectés (case-insensitive, regex `\b…\b`) |
|---|---|
| Modaux flous | `should`, `shouldn't`, `might`, `may`, `could`, `would`, `can` (sauf dans `IF … can …` → réécrire) |
| Adjectifs subjectifs | `fast`, `slow`, `quick`, `quickly`, `intuitive`, `user-friendly`, `easy`, `simple`, `seamless`, `robust`, `reliable`, `efficient`, `scalable`, `clean` |
| Locutions vagues | `as appropriate`, `if necessary`, `where applicable`, `etc.`, `and so on`, `reasonable`, `acceptable`, `optimal`, `best practice` |
| Temporels flous | `eventually`, `at some point`, `shortly`, `soon`, `whenever possible` |

→ Toute occurrence dans un critère est une violation.

### R2 — Multi-SHALL (compound requirement)

Un critère contient plus d'une occurrence du mot `SHALL` (case-insensitive).
→ Découper en plusieurs CA-NNN.

```
❌ The Auth Service SHALL return 200 AND SHALL log the event.
✅ The Auth Service SHALL return HTTP 200.
✅ The Auth Service SHALL emit an audit log entry containing user_id and timestamp.
```

### R3 — Déclencheur manquant (sauf Ubiquitous)

Un critère qui n'est pas Ubiquitous DOIT commencer par un déclencheur reconnu :

| Pattern | Déclencheur regex (début, case-insensitive) |
|---|---|
| Event-driven | `^WHEN\b` |
| State-driven | `^WHILE\b` |
| Optional feature | `^WHERE\b` |
| Unwanted behaviour | `^IF\b\s+.+,\s*THEN\b` |
| Ubiquitous | `^The\s+\w+` (sujet explicite suivi de `SHALL`) |

→ Si aucun pattern ne matche, violation `NO_TRIGGER`.

### R4 — Sujet implicite

Le critère ne contient pas de groupe nominal explicite (`the API`, `the Auth Service`, `the system`, `the UI`…) avant `SHALL`.

```
❌ SHALL return HTTP 200.
✅ The Auth Service SHALL return HTTP 200.
```

### R5 — Verbe non observable

Liste noire des verbes après `SHALL` : `understand`, `know`, `consider`, `realize`, `respect`, `appreciate`, `feel`, `believe`, `think`.

→ Reformuler avec un verbe observable : `return`, `log`, `reject`, `display`, `persist`, `emit`, `redirect`, `validate`, `compute`, `expose`.

### R6 — Quantification absente

Présence d'un adjectif quantitatif sans seuil chiffré (`fast`, `quickly`, `large`, `small`).
→ Toujours préciser une métrique (`within 200ms p95`, `up to 100 items`, `≤ 5 MB`).

### R7 — Conjonction `and`/`or` au sein d'un critère

Une conjonction `AND` / `OR` reliant deux verbes d'action (≥ 1 SHALL implicite des deux côtés).
→ Découper en deux critères.

## Procédure

1. **Extraire** la liste des critères d'acceptation (SPEC §3) — y compris les `[ ]` non cochés.
2. **Détecter le mode** (strict / indicatif) à partir de l'entête de la SPEC ou du flag.
3. Pour chaque critère, appliquer les règles R1–R7 dans l'ordre :
   - Identifier le pattern EARS (ou `NONE` si aucun).
   - Repérer les violations (cf. tableau ci-dessus).
   - Proposer une reformulation conforme.
4. **Calculer** :
   - `total` = nombre de critères
   - `conformes` = critères sans violation
   - `violations_par_règle` = compteur R1…R7
5. **Vérifier** que chaque critère est **testable** (assertion observable + seuil mesurable).

## Output (Markdown structuré)

```
EARS LINT — SPEC-NNN
════════════════════
Mode : STRICT (format=EARS) | INDICATIF
Critères : Y au total

CA-001 : "WHEN the user clicks login, the system SHALL redirect to /home."
  → ✅ Event-driven · 0 violation · testable

CA-002 : "Should be fast."
  → ❌ NONE
     R1 (mot interdit)        : "should", "fast"
     R3 (déclencheur manquant): aucun WHEN/WHILE/IF/WHERE
     R4 (sujet implicite)     : pas de "the <system>"
     R6 (quantification)      : "fast" sans seuil
  → Reformuler : "The API SHALL respond to /api/login within 200ms (p95)."

CA-003 : "The user understands the error message."
  → ❌ Ubiquitous
     R5 (verbe non observable): "understands"
  → Reformuler : "WHEN validation fails, the system SHALL display an error message containing the failed field name."

CA-004 : "The system SHALL return 200 AND SHALL log the event."
  → ❌ Ubiquitous
     R2 (multi-SHALL)         : 2 occurrences de SHALL
  → Découper :
       CA-004a : "The API SHALL return HTTP 200."
       CA-004b : "The API SHALL emit an audit log entry containing user_id and timestamp."

────────────────────
Score EARS         : C / Y critères conformes  (X %)
Score testabilité  : T / Y critères testables  (X %)
Violations totales : N (R1=a, R2=b, R3=c, R4=d, R5=e, R6=f, R7=g)
```

## Décision (mode strict uniquement)

| Conformité | Effet sur SQS critère 2 (Testabilité) |
|---|---|
| 100 % critères conformes | **+1 bonus** appliqué au score critère 2 (plafonné à 1/1) |
| < 100 % conformes | Critère 2 = **0** quel que soit le contenu hors EARS — bloquant pour la Gate |

En mode indicatif, le résultat est purement informatif et n'altère pas le score SQS.

## Règles transverses

- EARS-conforme ≠ testable : vérifier les deux (un critère EARS valide peut rester non vérifiable s'il n'expose pas d'oracle).
- Une SPEC n'est pas obligée d'utiliser EARS pour TOUTES ses sections — focus sur §3 Critères d'Acceptation.
- Un critère qui ne peut pas être lint-é EARS et reformulé = signal de SPEC ambiguë → impacte le SQS Non-ambiguïté.
- Les critères non-fonctionnels (performance, sécurité) bénéficient particulièrement d'EARS + seuil chiffré.
- En mode indicatif, ne pas pousser l'EARS si la prose existante est déjà testable : le but est l'élévation, pas le formalisme.

## Anti-patterns

- **Reformuler en EARS sans demander** quand la SPEC est en prose et que le PE n'a pas demandé `--ears` : signaler en suggestion, ne pas réécrire.
- **Compter les violations sans les nommer** : la valeur de la skill, c'est la liste R1…R7 par critère.
- **Bloquer sur le mode indicatif** : l'effet bloquant n'existe que si la SPEC déclare explicitement `Format : EARS`.
