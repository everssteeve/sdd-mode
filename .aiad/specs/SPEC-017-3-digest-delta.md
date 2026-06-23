# SPEC-017-3 — Digest delta + snapshots persistants

**Intent parent** : INTENT-017
**Auteur** : Steeve Evers
**Date** : 2026-06-22
**Statut** : validation
**Format** : EARS
**SQS** : 5/5 — Gate OUVERTE (2026-06-22) — exécuté 2026-06-22

---

## 1. Contexte

Le dashboard est régénéré manuellement ou en CI. INTENT-017 veut afficher les
changements survenus "depuis la dernière génération" : SPECs livrées, Intents
archivés, nouveaux zombies, évolution du score santé. Le pattern de snapshot
est déjà établi par `pm-diff.js` et `health-timeline.js` — cette SPEC l'étend
avec un fichier digest horodaté en `.aiad/metrics/digest/`.

## 2. Comportement Attendu

### Input

- `donnees` — objet enrichi par `model/index.js` (état courant)
- `.aiad/metrics/digest/YYYY-MM-DD-HH.json` — snapshot précédent (optionnel)

Structure d'un snapshot digest :
```json
{
  "generatedAt": "<ISO8601>",
  "specsCount": { "done": N, "draft": N, "active": N },
  "intentsCount": { "done": N, "active": N, "archived": N },
  "zombiesCount": N,
  "santeScore": N
}
```

### Processing

1. `lireDernierSnapshotDigest(racineProjet)` — lit le fichier `.json` le plus récent
   dans `.aiad/metrics/digest/` (trié chronologiquement par nom de fichier). Retourne
   `null` si aucun fichier.
2. `calculerDigestDelta(donnees, snapshotPrecedent)` :
   - Si `snapshotPrecedent === null` → delta = `null`, message "Première génération"
   - Sinon → calcule les deltas (specs done, intents archivés, zombies, score santé)
3. `ecrireSnapshotDigest(racineProjet, donnees)` — écrit `.aiad/metrics/digest/YYYY-MM-DD-HHmm.json`
   avec l'état courant. Appelé depuis le runner `dashboard()` après génération.
4. `blocDigestDelta(donnees)` — rendu HTML de la section digest (intégrable dans `today.html` et `overview.html`).

### Output

- Section HTML `<section aria-label="Digest delta">` avec compteurs delta et badge tendance
- Fichier `.aiad/metrics/digest/YYYY-MM-DD-HHmm.json` écrit à chaque run

### Cas limites

- **Aucun snapshot précédent** : affiche "Première génération — aucun delta disponible."
- **Snapshot précédent illisible** (JSON invalide / champs manquants) : traité comme "Première génération", warning émis en console
- **Aucun delta** (rien n'a changé) : affiche "Aucun changement depuis la dernière génération."
- **Répertoire `.aiad/metrics/digest/` absent** : créé automatiquement au premier run

## 3. Critères d'Acceptation (EARS)

### CA-001 — Écriture snapshot à chaque run

> Pattern : Ubiquitous

`The dashboard generator SHALL write a file \`.aiad/metrics/digest/YYYY-MM-DD-HHmm.json\` containing \`{ generatedAt, specsCount, intentsCount, zombiesCount, santeScore }\` on every successful dashboard run.`

- [x] Implémenté
- [x] Testé : `test/dashboard-digest.test.js::CA-001`

### CA-002 — Contenu du delta affiché

> Pattern : Ubiquitous

`The digest renderer SHALL display the following 4 delta values: number of SPECs moved to "done", number of Intents moved to "archived", change in zombie count, and score santé delta (current minus previous), since the previous snapshot.`

- [x] Implémenté
- [x] Testé : `test/dashboard-digest.test.js::CA-002`

### CA-003a — Message première génération

> Pattern : Unwanted behaviour

`IF no previous digest snapshot exists, THEN the digest renderer SHALL display "Première génération — aucun delta disponible." in the digest section.`

- [x] Implémenté
- [x] Testé : `test/dashboard-digest.test.js::CA-003a`

### CA-003b — Aucun delta numérique en première génération

> Pattern : Unwanted behaviour

`IF no previous digest snapshot exists, THEN the digest renderer SHALL omit all numeric delta values from the rendered output.`

- [x] Implémenté
- [x] Testé : `test/dashboard-digest.test.js::CA-003b`

### CA-004a — Warning si snapshot illisible

> Pattern : Unwanted behaviour

`IF the most recent digest snapshot file fails JSON.parse, THEN the digest calculator SHALL emit a \`console.warn\` message containing the file path.`

- [x] Implémenté
- [x] Testé : `test/dashboard-digest.test.js::CA-004a`

### CA-004b — Repli première génération si snapshot illisible

> Pattern : Unwanted behaviour

`IF the most recent digest snapshot file fails JSON.parse, THEN the digest calculator SHALL proceed as a first-run, discarding the malformed file.`

- [x] Implémenté
- [x] Testé : `test/dashboard-digest.test.js::CA-004b`

### CA-005 — Aucun delta

> Pattern : Unwanted behaviour

`IF all 4 delta values equal 0, THEN the digest renderer SHALL display "Aucun changement depuis la dernière génération." instead of a list of zero values.`

- [x] Implémenté
- [x] Testé : `test/dashboard-digest.test.js::CA-005`

### CA-006a — Répertoire créé automatiquement

> Pattern : Unwanted behaviour

`IF the directory \`.aiad/metrics/digest/\` does not exist, THEN the snapshot writer SHALL create it before writing the snapshot file.`

- [x] Implémenté
- [x] Testé : `test/dashboard-digest.test.js::CA-006a`

### CA-006b — Pas d'erreur si répertoire absent

> Pattern : Unwanted behaviour

`IF the directory \`.aiad/metrics/digest/\` does not exist, THEN the snapshot writer SHALL complete the write operation without throwing an uncaught error.`

- [x] Implémenté
- [x] Testé : `test/dashboard-digest.test.js::CA-006b`

### CA-007 — Déltas calculés sur état réel

> Pattern : Ubiquitous

`The digest calculator SHALL compute delta values by comparing the current \`donnees\` state to the most recent snapshot, using only items whose \`statut\` transitioned after the snapshot's \`generatedAt\` timestamp.`

- [x] Implémenté
- [x] Testé : `test/dashboard-digest.test.js::CA-007`

## 4. Interface / API

```js
// lib/dashboard/digest-delta.js
export function lireDernierSnapshotDigest(racineProjet)        // → object | null
export function calculerDigestDelta(donnees, snapshotPrecedent) // → { delta, depuis, message }
export function ecrireSnapshotDigest(racineProjet, donnees)    // → void (side effect)
export function blocDigestDelta(donnees)                        // → string HTML
```

Format snapshot :
```json
{
  "generatedAt": "2026-06-22T14:30:00.000Z",
  "specsCount": { "done": 42, "draft": 3, "active": 1 },
  "intentsCount": { "done": 18, "active": 2, "archived": 5 },
  "zombiesCount": 1,
  "santeScore": 87
}
```

## 5. Dépendances

- `lib/dashboard/model/index.js` — intégration `calculerDigestDelta` + appel `ecrireSnapshotDigest`
- `lib/dashboard/pm-diff.js` — pattern `lireSnapshots()` à réutiliser (ne pas dupliquer)
- `lib/dashboard/health-timeline.js` — `santeScore` source
- `lib/dashboard/render.js` — appel `ecrireSnapshotDigest` post-génération
- SPEC-016-1 (architecture 4 couches) — prérequis livré

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- Cette SPEC : ~450 tokens
- Fichiers source pertinents : `pm-diff.js`, `health-timeline.js`, `model/index.js` (306 LOC)
- **Total estimé** : ~1 800 tokens

## 7. Definition of Output Done (DoOD)

- [x] `lib/dashboard/digest-delta.js` créé (≤ 150 LOC)
- [x] `model/index.js` — appel `calculerDigestDelta` ajouté dans le pipeline
- [x] `dashboard.js` — appel `ecrireSnapshotDigest` post-génération
- [x] `test/dashboard-digest.test.js` — 7 cas CA-001 à CA-007 (10 assertions, 10/10 ✔)
- [x] **EARS lint : 0 violation** (skill `ears-validator`)
- [x] lint + tests passing (npm test — fail 0)
- [x] Annotations `@spec SPEC-017-3` + `@verified-by` posées
- [x] Gouvernance vérifiée : RGESN (1 fichier JSON par run — taille négligeable)
