---
id: SPEC-023-1
title: Page comparative publique honnête
parent_intent: INTENT-023
status: done
format: prose
sqs: 5
author: Steeve Evers
date: "2026-06-29"
traceability: exempt
traceability_reason: Livrable = page HTML statique site/fr/comparaison.html + bench/comparison.md. Les fichiers .html et .md ne sont pas dans EXTENSIONS_CODE par design (SPEC-024-1 / FACT-004). Validé via axe-core 0 violation + 16/16 tests bench-comparison.test.js.
---

# SPEC-023-1 — Page comparative publique honnête

**Intent parent** : INTENT-023
**Auteur** : Steeve Evers
**Date** : 2026-06-29
**Statut** : done
**Format** : prose
**SQS** : 5/5
**Research** : RESEARCH-037 (GO 80 %)

---

## 1. Contexte

INTENT-023 impose un comparatif factuel AIAD vs concurrents centré sur la moat gouvernance + traçabilité, avec les faiblesses assumées (valeur « Honnêteté sur les Contradictions »). Le fichier `bench/comparison.md` contient déjà les métriques AIAD mesurées mais est isolé du site — aucune page `comparaison.html` n'existe. OpenSpec et BMAD sont absents du comparatif actuel.

## 2. Comportement Attendu

### Input

- Données existantes : `bench/comparison.md` (métriques AIAD mesurées via `scripts/bench-comparison.js`)
- Nouvelles entrées à documenter : OpenSpec, BMAD (données publiquement disponibles, collectées à la date de rédaction)
- Template HTML : pattern `site/fr/artefacts.html` (CSS commun `site/assets/css/main.css`)

### Processing

1. Enrichir `bench/comparison.md` avec deux colonnes supplémentaires : OpenSpec et BMAD. Si les données d'un concurrent sont partiellement inconnues, indiquer explicitement `N/D (date)` — jamais laisser vide ni inventer.
2. Régénérer le tableau via `scripts/bench-comparison.js` si la structure du script le permet, sinon enrichir manuellement.
3. Créer `site/fr/comparaison.html` reprenant le tableau comparatif avec :
   - Distinction visuelle **mesuré** (🔬 icône) vs **documenté** (📄 icône) — jamais présenté comme équivalent
   - Section dédiée à la moat AIAD (gouvernance enforced + traçabilité machine-vérifiable)
   - Section « Où AIAD est plus faible » : couverture runtimes (5 vs 30+ Spec Kit), maturité des intégrations IDE
   - Date de collecte affichée dans chaque cellule de données concurrentes
4. Ajouter un lien depuis `site/fr/a-propos.html` et/ou depuis la nav principale.

### Output

- `bench/comparison.md` — enrichi (OpenSpec + BMAD, date de collecte sur chaque ligne)
- `site/fr/comparaison.html` — page HTML intégrée au site (RGAA AA)
- Nav mise à jour pour pointer vers la page

### Cas limites

- **Données concurrentes indisponibles** : noter `N/D (2026-06-29)` avec lien vers la source la plus proche — ne pas inventer ni extrapoler.
- **Concurrent qui évolue post-publication** : la page affiche la date de collecte globale en entête ; les contributeurs peuvent ouvrir une PR de mise à jour.
- **BMAD / OpenSpec sans agent IA configurable** : la colonne « Support runtime IA » indique « framework méthodologique » plutôt que d'énumérer des runtimes inexistants.
- **Métriques AIAD non-reproductibles sur l'environnement CI** : les benchmarks existants sont conservés tels quels (horodatés) ; pas de refactoring du script hors périmètre.

## 3. Critères d'Acceptation

- [x] CA-1 : `site/fr/comparaison.html` existe et est accessible via un lien dans `site/fr/a-propos.html` **et** dans la nav principale
- [x] CA-2 : Le tableau comparatif inclut au minimum 5 concurrents (Spec Kit, Kiro, OpenSpec, BMAD, Amazon Q) avec date de collecte affichée
- [x] CA-3 : Toute donnée non mesurée par AIAD est marquée « documenté » (📄) — aucune cellule ne mélange mesure et déclaratif sans distinction
- [x] CA-4 : Une section « Où AIAD est plus faible » est présente et nomme explicitement la couverture runtimes (5 vs concurrents)
- [x] CA-5 : La page passe axe-core (0 violation WCAG 2.1 AA) — même gate que les autres pages site/
- [x] CA-6 : `bench/comparison.md` contient les colonnes OpenSpec et BMAD (même partielles, avec N/D horodaté)
- [x] CA-7 : Chaque affirmation sur un concurrent référence une URL de source publique en note ou colonne dédiée — sans source citée, la cellule affiche N/D (YYYY-MM-DD)

## 4. Interface / API

Pas d'API nouvelle. Fichiers produits :

```
site/fr/comparaison.html          ← page publique
bench/comparison.md               ← données source enrichies
```

Pattern HTML à suivre : `site/fr/artefacts.html` (structure, CSS, nav).

Icônes à utiliser (cohérence avec le design system existant) :
- 🔬 Mesuré par AIAD via `bench-comparison.js`
- 📄 Documenté / déclaratif (source citée)
- ❌ Absent / non supporté
- N/D (YYYY-MM-DD) Donnée non disponible à la date

## 5. Dépendances

- `bench/comparison.md` — source enrichie
- `scripts/bench-comparison.js` — script de régénération existant (lecture seule si non modifié)
- `site/assets/css/main.css` — styles communs
- `site/fr/a-propos.html` — page de liaison (ajout lien)
- RESEARCH-037 — Discovery ancré confirmant l'absence de `comparaison.html`
- Agents gouvernance : AIAD-RGAA (page publique, WCAG AA obligatoire)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE condensé : ~500 tokens
- Cette SPEC : ~600 tokens
- `bench/comparison.md` (lecture) : ~400 tokens
- `site/fr/artefacts.html` (template) : ~500 tokens
- `site/assets/css/main.css` (référence) : ~300 tokens
- **Total estimé** : ~2 300 tokens (< 10 % de 200k Sonnet 4.6)

## 7. Definition of Output Done (DoOD)

- [x] `site/fr/comparaison.html` créé, lié depuis la nav
- [x] `bench/comparison.md` enrichi avec OpenSpec + BMAD + dates
- [x] axe-core 0 violation (WCAG 2.1 AA) — vérifié 2026-06-29 via axe-core 4.9.1 / WCAG2A+AA (26 passes, 0 violations)
- [x] `npm run lint` passing (602 fichiers — bench-comparison.js non modifié)
- [x] Tests unitaires `bench-comparison.test.js` passants (16/16)
- [x] SPEC mise à jour si écart lors de l'exécution (Drift Lock)
- [x] Gouvernance vérifiée : AIAD-RGAA (accessibilité page publique) — PASS
