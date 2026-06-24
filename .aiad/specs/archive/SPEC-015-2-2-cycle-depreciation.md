---
status: archived
archivedAt: "2026-06-24T09:49:36.959Z"
archivedBy: evers.steeve@gmail.com
archivedReason: FACT-008 — SPECs done sans frontmatter YAML détectées via fallback body
---
# SPEC-015-2-2-cycle-depreciation — Cycle de dépréciation soft (mécanisme)

**Intent parent** : INTENT-015
**Research** : RESEARCH-017 (CONDITIONAL GO 80 % — conditions C1, C2, C-DATA, C-SCOPE)
**Auteur** : Steeve Evers
**Date** : 2026-06-19
**Statut** : done
**Format** : EARS
**SQS** : 5/5 — Gate OUVERTE (2026-06-19, EARS strict 0 violation, Étranger PASS)
**Implémentation** : `lib/deprecation.js` (formatDeprecationNotice/deprecationNotice/emitDeprecation/validateDeprecation) + `bin/aiad-sdd.js` (émission au dispatch) + `lib/commands-registry.js` (rendu deprecated) · tests `test/deprecation.test.js` (8/8) · trace 0 gap. Mécanisme livré dormant (0 commande dépréciée).

---

## 1. Contexte

INTENT-015 veut un **plan de dépréciation** sans rupture (condition C2 : annonce → warning → retrait v2). SPEC-015-2-1 a livré le registre catégorisé avec un champ `status ∈ {active, deprecated}` (`lib/commands-registry.js`). Cette SPEC livre le **mécanisme** qui exploite ce statut : métadonnées de dépréciation, avertissement non bloquant au dispatch (`bin/aiad-sdd.js:593`), visibilité dans `commands`. **Aucune commande réelle n'est dépréciée ici** : le mécanisme est livré *dormant*, la première dépréciation concrète est une décision humaine séparée (Human Authorship ; cohérent avec C-DATA — pas de dépréciation guidée par la donnée d'usage polluée). Périmètre borné au mécanisme (C-SCOPE).

## 2. Comportement Attendu

### Input

- Registre `COMMANDS_REGISTRY` (`lib/commands-registry.js`) : chaque entrée porte `status`, et — quand `status === 'deprecated'` — les champs `deprecatedSince` (version), `removeIn` (version) et optionnellement `replacement` (commande de remplacement).
- Au dispatch : la commande de premier niveau résolue (`bin/aiad-sdd.js`, variable `command`).

### Processing

1. Nouveau module `lib/deprecation.js` :
   - `formatDeprecationNotice(entry)` : construit le message d'avertissement à partir d'une entrée dépréciée.
   - `deprecationNotice(command)` : résout l'entrée du registre ; renvoie le message si la commande est `deprecated`, sinon `null`.
   - `emitDeprecation(notice, write)` : écrit le message (suivi d'un retour ligne) si non `null` ; ne fait rien sinon.
   - `validateDeprecation(entry)` : vérifie qu'une entrée `deprecated` porte `deprecatedSince` et `removeIn` non vides.
2. Au dispatch, **avant** d'exécuter la commande : `emitDeprecation(deprecationNotice(command))` sur stderr.
3. La commande dépréciée **s'exécute normalement** (phase warning v1.x — pas de rupture, C2).
4. `commands` affiche, pour une entrée dépréciée, la cible de retrait (`deprecatedSince → removeIn`).

### Output

- Avertissement de dépréciation sur **stderr** (jamais stdout) : `⚠ <command> est dépréciée depuis <deprecatedSince>, retrait prévu en <removeIn>.[ Utilise <replacement>.]`
- Code de sortie de la commande **inchangé** par le mécanisme.

### Cas limites

1. **Commande active** : `deprecationNotice` renvoie `null`, aucun avertissement, exécution normale.
2. **Commande absente du registre** : `deprecationNotice` renvoie `null` (pas de fabrication d'avertissement).
3. **Entrée `deprecated` sans `replacement`** : message sans la phrase « Utilise … ».
4. **Entrée `deprecated` sans `deprecatedSince`/`removeIn`** : rejetée par `validateDeprecation` (test de cohérence), interdit de merger.
5. **Registre livré sans aucune commande dépréciée** : mécanisme dormant, vérifié par un test (statut `active` partout).

## 3. Critères d'Acceptation (EARS)

### CA-001 — Pas d'avertissement pour une commande active ou absente

> Pattern : Ubiquitous

`The Deprecation module SHALL return a null notice for any command whose registry status is active or which is absent from the registry.`

- [ ] Implémenté
- [ ] Testé : `test/deprecation.test.js::active or absent returns null`

### CA-002 — Message de dépréciation complet

> Pattern : Event-driven

`WHEN formatDeprecationNotice receives a deprecated entry, the Deprecation module SHALL return a message containing the command name, the deprecatedSince version, and the removeIn version.`

- [ ] Implémenté
- [ ] Testé : `test/deprecation.test.js::notice contains name since removeIn`

### CA-003 — Remplacement mentionné si présent

> Pattern : Event-driven

`WHEN a deprecated entry carries a non-empty replacement, the Deprecation module SHALL include that replacement command in the notice message.`

- [ ] Implémenté
- [ ] Testé : `test/deprecation.test.js::notice includes replacement when present`

### CA-004 — Émission au dispatch

> Pattern : Event-driven

`WHEN emitDeprecation receives a non-null notice, the Deprecation module SHALL write that notice followed by a newline to the provided write target.`

- [ ] Implémenté
- [ ] Testé : `test/deprecation.test.js::emit writes non-null notice`

### CA-005 — Exécution non bloquée (soft deprecation)

> Pattern : Unwanted behaviour

`IF a command is deprecated, THEN the CLI SHALL execute it normally with its exit code left unchanged by the deprecation mechanism.`

- [ ] Implémenté
- [ ] Testé : `test/deprecation.test.js::emit null is a no-op (no interference)`

### CA-006 — Avertissement sur stderr uniquement

> Pattern : Ubiquitous

`The Deprecation mechanism SHALL write notices to stderr only, keeping stdout free of deprecation text so that --json output stays clean.`

- [ ] Implémenté
- [ ] Testé : `test/deprecation.test.js::notice goes to stderr not stdout`

### CA-007 — Champs requis sur une entrée dépréciée

> Pattern : Unwanted behaviour

`IF a registry entry declares status deprecated without a non-empty deprecatedSince or removeIn, THEN validateDeprecation SHALL report it as invalid.`

- [ ] Implémenté
- [ ] Testé : `test/deprecation.test.js::deprecated entry requires since and removeIn`

### CA-008 — Mécanisme livré dormant

> Pattern : Ubiquitous

`The shipped COMMANDS_REGISTRY SHALL contain zero entries with status deprecated, the first concrete deprecation being a separate human-authored decision.`

- [ ] Implémenté
- [ ] Testé : `test/deprecation.test.js::registry ships with no deprecated command`

## 4. Interface / API

```
lib/deprecation.js (ESM, zéro-dep) :
  export function formatDeprecationNotice(entry): string;
    // entry = { command, deprecatedSince, removeIn, replacement? }
  export function deprecationNotice(command): string | null;
  export function emitDeprecation(notice, write = process.stderr.write.bind(process.stderr)): boolean;
    // écrit `notice + '\n'` si notice non-null ; renvoie true si émis.
  export function validateDeprecation(entry): { valid: boolean, reason?: string };

bin/aiad-sdd.js (avant `switch (command)`, ~ligne 593) :
  emitDeprecation(deprecationNotice(command));   // no-op si active/absente

lib/commands-registry.js :
  Schéma d'entrée étendu (optionnel) : { …, deprecatedSince?, removeIn?, replacement? }
  présents uniquement quand status === 'deprecated'.

lib/commands-registry.js (showCommands) :
  Pour une entrée dépréciée, afficher `deprecatedSince → removeIn`.
```

## 5. Dépendances

- **Amont** : SPEC-015-2-1 (`COMMANDS_REGISTRY`, champ `status`) — `done` (PR #10).
- `lib/commands-registry.js` (entrées + rendu `commands`).
- `lib/term.js` (rendu cohérent du warning).
- Aucune dépendance externe (zéro-dep).

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~400 tokens
- Cette SPEC : ~1 000 tokens
- Fichiers source pertinents : `lib/commands-registry.js`, `bin/aiad-sdd.js:585-595` (dispatch), `lib/term.js`, nouveau `lib/deprecation.js`, nouveau `test/deprecation.test.js`
- **Total estimé** : ~7k tokens (sous le seuil 60-70 %)

## 7. Definition of Output Done (DoOD)

- [x] Code + lint passing (lints node/deps/size/esm/claims verts)
- [x] Tests unitaires sur les 8 critères + cas limites (`test/deprecation.test.js` — 8/8)
- [x] **EARS lint : 0 violation** (skill `ears-validator`)
- [x] `DOCUMENTATION.md` à jour + badge couverture régénéré (pas de nouvelle commande, surface CLI inchangée)
- [x] SPEC mise à jour si écart (Drift Lock — trace 0 gap bloquant)
- [x] Annotations machine-vérifiables posées (`@intent INTENT-015`, `@spec SPEC-015-2-2-cycle-depreciation`, `@verified-by`)
- [x] Code review passée (PR #12)
- [ ] Gouvernance vérifiée : **RGESN** (mécanisme léger zéro-dep, sert la réduction de surface). RGPD / AI-ACT / RGAA non déclenchés.
