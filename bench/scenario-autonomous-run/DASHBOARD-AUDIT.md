# DASHBOARD-AUDIT — SDD framework dashboard

**Date** : 2026-05-13
**Cible** : dashboard généré par `aiad-sdd dashboard` (10 pages HTML + data.json), version v1.14.0
**Méthode** : pour chaque persona, je liste (a) ce qui répond à son besoin métier, (b) ce qui manque ou est trompeur, (c) un verdict pondéré.

## Légende verdicts

- 🟢 **Suffisant** — la persona peut piloter son activité depuis le dashboard
- 🟡 **Partiel** — les données existent mais ne sont pas mises en scène pour cette persona
- 🟠 **Friction** — fonctionne mais avec angles morts qui forcent à sortir du dashboard
- 🔴 **Manquant** — la persona ne peut pas faire son job depuis le dashboard

## Récap par persona

| Persona | Verdict | Pages utiles aujourd'hui | Pages manquantes / vides |
|---------|---------|--------------------------|--------------------------|
| Product Manager | 🟡 | intents, index | filtres Intent zombie/draft, alignement intent↔delivery, Outcome Criteria, queue "à valider" |
| Product Engineer | 🟡 | specs, traceability, drifts, index/alertes | Gate queue, sessions agent actives, Context Budget, conflit parallélisme, Kanban |
| Agents Engineer | 🔴 | governance (description seule) | violations actives, agent timeline, AIAD-CRA absent, audit log, skill activations |
| QA Engineer | 🔴 | traceability backward | SPECs ready sans tests, coverage %, validation reports, EARS lint status, regression alerts |
| Tech Lead | 🟠 | fondamentaux (lien ARCHI), metrics (page vide) | ADR registry, DORA alimentée, ARCHI↔code drift, dépendances/SBOM, tech debt |
| **Supporters** |  |  |  |
| DPO | 🔴 | — | DPIA absente du dashboard, retention violations, RGPD coverage |
| Security | 🟡 | metrics > security (listing brut) | SBOM, sovereignty score, OWASP top 10 rollup |
| SRE / Ops | 🔴 | DORA page (vide) | health/SLO, hook-stats, alerting |
| Legal / Compliance | 🔴 | — | AI Act audit, rapports rollup, pack-juridiction status |
| Executive sponsors | 🟡 | maturité, KPIs | leadership metrics (Human Authorship %), outcome alignment |
| Onboarding | 🔴 | — | guided tour, "comment lire ce dashboard", glossaire AIAD |

---

## Détail par persona

### 1. Product Manager (PM) 🟡

**Job-to-be-done** : valider les Intent Statements, mesurer l'alignement intention↔livraison, préparer l'Atelier d'Intention mensuel, garantir la traçabilité produit→métriques outcome.

**✅ Ce qui marche**
- `intents.html` liste l'inventaire complet avec auteur, date, statut, SPECs liées — utile pour scanner l'activité du mois.
- `index.html` montre les compteurs "Intents actifs 14/14".
- Alerte "SQS faible" remontée en page d'accueil (bien que ce soit du territoire PE).

**❌ Ce qui manque**
- **Intent zombie detection absente** — un Intent `active` sans activité depuis >30 jours doit être signalé (cf. `intents/_index.md` ligne 24 mentionne explicitement cette règle). Pas implémenté côté dashboard.
- **Pas de filtre rapide** — pas de bouton "ne voir que les draft >14j" ou "les zombies".
- **Outcome Criteria du PRD non trackés** — la section §4 du PRD définit baseline + cible mesurable. Le dashboard ne montre nulle part où en est chaque outcome.
- **Pas d'alignement intent ↔ livraison** — le "Critère de Drift" de chaque Intent est rédigé mais jamais vérifié visuellement (or c'est exactement ce que demande l'Atelier d'Intention).
- **Pas de demo readiness** — combien de SPECs `done` depuis la dernière démo bi-hebdo ? Pas calculé.
- **Pas de PRD coverage** — quelles user stories du PRD ont au moins un Intent ? Pas mappé.

**Quick wins**
- Badge "🧟 Zombie 32j" sur les Intents `active` sans SPEC modifiée depuis >30j.
- Section "À valider cette semaine" sur index.html (Intents `draft` >14j, SPECs `done` non démontrées).
- Onglet "Outcome tracking" qui lit la table PRD §4 et permet la saisie manuelle des mesures (humain pur, pas auto).

---

### 2. Product Engineer (PE) 🟡

**Job-to-be-done** : rédiger SPECs, ouvrir Execution Gate, orchestrer les sessions agent, faire le Drift Lock, capturer les facts.

**✅ Ce qui marche**
- `specs.html` est la page la plus complète : ID, Intent parent, Format prose/EARS, SQS, statut, date.
- Alerte SQS faible sur `index.html` (SPEC-007-3 → 3.0/5, lien direct).
- `traceability.html` matrice forward et backward fonctionnelles (après fix `sdd-trace`).
- `drifts.html` liste les facts (1 FACT-001 capturé).

**❌ Ce qui manque**
- **Pas de "Gate à ouvrir" queue** — quelles SPECs sont en statut `review` avec SQS ≥ 4/5 (prêtes à passer la Gate) ? Pas exposé.
- **Pas de Context Engineering Budget visualisé** — chaque session devrait afficher son budget (M1-M5 de la skill `context-budget`). Le dashboard ne le sait pas.
- **Pas de sessions agent actives** — qui code quelle SPEC en ce moment, depuis combien de temps ?
- **Pas de plan de remédiation SQS** — la skill `sqs-scoring` produit un plan par critère, jamais affiché.
- **Pas de conflit parallélisme** — cf. backlog #131, attendu par décision UX Option A.
- **Pas de filtre "Mes SPECs"** — le dashboard est mono-utilisateur, pas multi-PE.
- **Test de l'Étranger (critère 6 non-scorable) jamais visualisé**.

**Quick wins**
- Colonne "Gate ouvrable ?" sur `specs.html` (statut review + SQS ≥ 4/5).
- Mini-widget "Mes 3 SPECs prioritaires" sur `index.html` (filtre par `author:` du frontmatter).
- Tooltip SQS qui montre les 5 critères + plan de remédiation depuis `.aiad/metrics/sqs/`.

---

### 3. Agents Engineer (AE) 🔴

**Job-to-be-done** : configurer les agents IA, gérer les permissions (Harness Engineering), maintenir l'AGENT-GUIDE, superviser la gouvernance Tier 1, capturer les Lessons Learned.

**✅ Ce qui marche**
- `governance.html` liste les agents Tier 1 (4 vus : AI-ACT, RGPD, RGAA, RGESN) avec leur description et déclencheur.

**❌ Ce qui manque (gros)**
- **AIAD-CRA absent de la page** — la page `governance.html` n'affiche que 4 agents. Pourtant `.aiad/gouvernance/AIAD-CRA.md` existe (cf. F-005 REPORT initial). Le dashboard ignore le 5ᵉ Tier 1. **🔴 Bug confirmé sur l'app vivante.**
- **Pas de violations actives** — la page est purement documentaire. Aucune SPEC avec veto/warn n'est listée, aucun compteur "X violations RGPD ouvertes".
- **Pas d'agent activity timeline** — quel agent a fait quoi sur quelle SPEC, et quand ?
- **Pas de skill activations** — combien de fois `ears-validator` a fait fail un gate ce mois ? `regulatory-veto` ?
- **Pas d'Audit Trail** — `aiad-sdd audit log` existe (signature crypto append-only), pas exposé dans le dashboard.
- **Lessons Learned counter absent** — combien d'entrées AGENT-GUIDE > Lessons Learned ce sprint ?
- **Harness config absent** — quelles permissions agents (minimal necessary) sont actives ?
- **Packs Tier 2/3 invisibles** — `.aiad/gouvernance-packs/` (fr-anssi, de-bsi, etc.) installés mais zéro affichage.
- **SBOM / DPIA / AI-Act audit** non remontés (générés par CLI, jamais exposés).

**Quick wins critiques**
- Inclure AIAD-CRA dans la liste (fix simple : `lib/dashboard/collect.js` parcourt probablement les 4 fichiers en hardcoded — étendre).
- Section "Violations ouvertes" qui agrège les `@governance` annotations vs. SPECs en `done` (un fichier marqué `@governance AIAD-RGPD` doit avoir un Audit log).
- Onglet "Packs juridictionnels" listant ce qui est installé + score sovereignty.

---

### 4. QA Engineer 🔴

**Job-to-be-done** : valider les sorties (`/sdd validate`), couvrir les SPECs de tests, détecter les régressions, garantir la testabilité (EARS).

**✅ Ce qui marche**
- `traceability.html` matrice backward `Tests → Code → SPEC → Intent` est la SEULE vue QA-friendly.

**❌ Ce qui manque (énorme)**
- **Pas de "SPECs ready sans tests"** — la commande `aiad-sdd trace` rapporte "Code annoté sans tests" mais le dashboard n'en fait rien.
- **Pas de test coverage %** par SPEC.
- **Pas de validation reports** — `/sdd validate` produit `.aiad/metrics/audit/*.md`. La page `metrics.html > audit` les liste mais sans agréger (par exemple "8 PASS / 1 CORRECTIONS / 0 REJET").
- **Pas de failed/passed run history** — chaque exécution `node --test` devrait laisser une trace.
- **Pas de EARS lint status** — le linter `ears-validator` peut produire des warnings R1-R7. Jamais affiché.
- **Pas d'edge case tracking** — la SPEC liste les cas limites, le dashboard ne montre pas lesquels sont couverts.
- **Pas de regression alerts** — un test qui passait à `pass` et bascule `fail` doit alerter.
- **Pas de cumul "tests ajoutés cette semaine"**.

**Quick wins**
- Page dédiée `qa.html` (ou widget sur `traceability.html`) : "SPECs sans test → action QA".
- Compteur "VALIDÉ / CORRECTIONS / REJET" agrégé depuis `.aiad/metrics/audit/`.
- Highlight rouge sur les SPECs `done` SANS tests liés (gap critique).

---

### 5. Tech Lead (TL) 🟠

**Job-to-be-done** : cohérence architecture, ADRs, performance, dette technique, DORA metrics, revue technique bi-hebdomadaire.

**✅ Ce qui marche**
- Lien direct vers ARCHITECTURE.md sur `index.html > Artefacts fondamentaux`.
- `metrics.html` a deux sections `DORA` et `Flow & Qualité`.

**❌ Ce qui manque**
- **DORA page totalement vide** — "Déploiements 0", "Cycle Time —", "Lead Time —", "Change Failure Rate —", "MTTR —". La page existe mais aucune source de données ne l'alimente. **🟠 Trompeur : on croit avoir des DORA, on n'en a pas.**
- **Flow & Qualité idem vide** — "WIP moyen —", "SQS moyen —".
- **Pas d'ADR registry** — pas de page qui liste les ADR-001, ADR-002, etc. (mes ADRs sont in-line dans ARCHITECTURE.md, jamais extraits).
- **Pas d'ARCHITECTURE vs code drift** — `/sdd drift-check` voit le code, pas l'ARCHITECTURE.md. Le dashboard non plus.
- **Pas de SBOM / dépendances** — généré (`sbom.cdx.json`), invisible.
- **Pas de tech debt counter** — `TODO-JNSP` markers, SPECs > 200 LOC, modules circulaires : aucun rollup.
- **Pas d'historique `/aiad tech-review`** — ce rituel bi-hebdo devrait laisser une trace dashboardée.
- **Pas de performance budgets** — bundle size, hot paths.

**Quick wins**
- Bandeau "DORA données absentes" si zéro deploy log ingéré, avec lien vers la doc d'alimentation.
- Section "ADRs in-line" qui parse ARCHITECTURE.md à la recherche du pattern `**ADR-NNN**` (je l'ai utilisé dans mon ARCHITECTURE.md, c'est extractible).
- Tile "Dette" : nombre de TODO-JNSP non résolus + SPECs > 200 LOC.

---

### 6. Supporters

#### 6a. DPO (Data Protection Officer) 🔴

**Job-to-be-done** : valider les DPIA, garantir la conformité RGPD, suivre la rétention.

**Manquant à 100 %**
- DPIA générée (`aiad-sdd dpia`) — produit `.aiad/metrics/rgpd/DPIA-2026-05-13.md`. **Non exposé dans le dashboard.**
- Aucune surface "Données personnelles inventory" (quelle SPEC traite quelle catégorie de PII).
- Aucune "Retention violations" vue (cf. SPEC-008-1 : rétention 13 mois CNIL).
- Aucun rollup RGPD coverage (combien de fichiers `@governance AIAD-RGPD` parmi ceux qui touchent des données utilisateur).

**Quick win** : page `dpo.html` qui (1) liste les DPIA générées, (2) compte les fichiers `@governance AIAD-RGPD`, (3) signale les SPECs touchant données personnelles SANS annotation.

#### 6b. Security 🟡

**Ce qui marche**
- `metrics.html > security` liste les rapports `/sdd security` bruts.

**Ce qui manque**
- Pas de gravité par rapport (combien de "Critique" / "Moyen" / "Confirmé") — affichage brut.
- SBOM (`sbom.cdx.json`) non affiché.
- Sovereignty score (`aiad-sdd sovereignty`) non affiché — pourtant produit `Score 40/100, niveau Silver`.
- OWASP Top 10 rollup invisible.
- Pas de "issues sécurité ouvertes" (ce qui était en `Risques moyens` du dernier rapport).

**Quick win** : KPI sovereignty en haut, compteurs `critique / moyen / bonne pratique` agrégés depuis les rapports security.

#### 6c. SRE / Ops 🔴

**Manquant à 100 %**
- DORA page existe mais vide — devrait pouvoir consommer des deploy logs (ex : `.aiad/metrics/deploys.jsonl`).
- Pas de health/SLO/uptime.
- Pas de hook-stats (latence pre-commit) — pourtant `aiad-sdd hook-stats` existe.
- Pas d'alerting sur les seuils franchis.
- Pas d'audit operationnel (mode offline, ratelimit drops, etc.).

**Quick win** : page `sre.html` agrégeant `hook-stats`, deploys (si présents), `metrics.security/audit` par sévérité.

#### 6d. Legal / Compliance 🔴

**Manquant à 100 %**
- AI Act audit (`aiad-sdd ai-act audit`) → `.aiad/metrics/ai-act/AUDIT-*.md` jamais exposé.
- Pas de status par juridiction (FR/DE/ES/IT/UK/NL/BE/CH/EU…) qui devrait remonter depuis les packs `gouvernance-packs/`.
- Pas de "compliance gaps" rollup.

**Quick win** : page `legal.html` qui agrège AI-Act + DPIA + sovereignty + packs installés en un seul cockpit.

#### 6e. Executive Sponsors 🟡

**Ce qui marche**
- KPIs hauts (intents/specs/maturité) sur `index.html`.

**Ce qui manque**
- **Maturité 5/5 trompeuse** — F-031 du REPORT-RUN2 : on n'a ni git, ni hooks, ni tests sur 100 % des specs, et pourtant le score dit "Complet". Crédibilité endommagée si la C-Suite le voit.
- Leadership metrics (Human Authorship %, Governance Coverage, Trace Completeness) sont calculés par `doctor --json` mais jamais exposés en dashboard.
- Pas de "Outcome → Business value" rollup.

**Quick win** : raffiner le scoring (pondérer par tests/git/hooks) + ajouter une ligne "Leadership metrics" sur `index.html`.

#### 6f. Onboarding / nouveau membre 🔴

**Manquant à 100 %**
- Pas de "comment lire ce dashboard".
- `storybook.html` (commandes slash) est bien mais c'est de la doc de référence, pas un onboarding.
- Pas de guided tour (le CLI a `aiad-sdd tour`, jamais surfacé en HTML).
- Pas de glossaire AIAD inline (Intent, SPEC, SQS, Drift Lock — les nouveaux doivent ouvrir un autre doc).

**Quick win** : tooltip sur les termes techniques + un bouton "🎓 Onboarding" en haut qui démarre une visite guidée par persona.

---

## Findings transverses

### F-A 🔴 Beaucoup de données existent côté CLI mais ne sont pas remontées au dashboard

Le pattern est récurrent : `aiad-sdd <command>` produit un rapport markdown dans `.aiad/metrics/<sub>/` ou un JSON, mais le dashboard ne le consomme pas. Liste partielle des commandes "orphelines de dashboard" :

- `aiad-sdd dpia` → `.aiad/metrics/rgpd/`
- `aiad-sdd ai-act audit` → `.aiad/metrics/ai-act/`
- `aiad-sdd sovereignty` → score Silver 40/100
- `aiad-sdd sbom` → `sbom.cdx.json`
- `aiad-sdd hook-stats` → métriques pre-commit
- `aiad-sdd audit log` → log signé append-only
- `aiad-sdd gouvernance-packs` (installés) → invisibles

**Suggestion** : un module `lib/dashboard/collect-supplementary.js` qui découvre ces artefacts et les agrège dans `data.json` sous des clés dédiées (`dpia`, `aiAct`, `sovereignty`, `sbom`, `hookStats`).

### F-B 🟠 Le dashboard est mono-persona (PE-centric) par construction

Toutes les pages sont structurées pour le PE qui orchestre. Les autres personas doivent traduire mentalement (PM lit `intents.html` mais doit deviner les zombies). C'est exactement le besoin couvert par le backlog **#131 — dashboard role-aware**, dont la décision UX Option A est déjà figée.

### F-C 🟠 La métrique "Maturité 5/5" est calculée trop tôt et ne reflète pas la réalité

Sur ce projet : `5/5 Complet` alors que `Trace Completeness: —` et `Governance Coverage: —` (cf. F-027/F-028 du REPORT-RUN2). Trompeur dès la page d'accueil. **À pondérer** : tant que 2 des 3 leadership metrics sont indéfinies, plafonner à 3/5.

### F-D 🟡 Le `storybook.html` (30 commandes) est riche mais isolé

Pas de lien depuis les pages principales. Un nouveau membre ne le trouve pas. À promouvoir dans la nav globale.

### F-E 🟠 Pas de mode "live" sur le dashboard

Le `dashboard --serve --watch` existe (item #19), mais quand on utilise les fichiers HTML statiques (cas par défaut), il faut re-lancer `aiad-sdd dashboard` à chaque changement. Pas de signal "données à 5 min" affiché.

### F-F 🟡 Aucune intégration avec les rituels temporels

Les rituels AIAD (standup, sync-strat, demo, retro, intention) produisent des artefacts qui devraient peupler le dashboard. Pour l'instant : aucune trace. Idée : un fil "Activité rituelle" qui montre "Standup du 13/05 — 3 SPECs en cours" / "Demo du 11/05 — 4 SPECs présentées".

---

## Priorisation suggérée (backlog dashboard)

| Prio | Action | Rationale | Effort |
|------|--------|-----------|--------|
| P0 | Inclure AIAD-CRA dans `governance.html` | Bug visible, 5ᵉ agent Tier 1 absent | XS |
| P0 | Pondérer le score Maturité par tests/git/hooks | F-C trompeur en page d'accueil | S |
| P0 | Backlog #131 (UX Option A — Kanban + filtres rôle) | Adresse 60 % des manques personas | L |
| P1 | Module `collect-supplementary.js` (dpia/ai-act/sovereignty/sbom/hook-stats) | F-A — débloque DPO/Legal/Security/SRE | M |
| P1 | Section "À valider cette semaine" sur index (zombies, drafts >14j) | Quick win PM | S |
| P1 | Page `qa.html` : SPECs ready sans tests + EARS lint status | Persona QA quasi inexistante | M |
| P2 | Alimenter DORA (consommer `.aiad/metrics/deploys.jsonl` si présent) | F-page vide trompeuse | M |
| P2 | Extraire ADRs in-line depuis ARCHITECTURE.md | TL pas servi | S |
| P2 | Page `legal.html` rollup AI-Act + DPIA + sovereignty | Persona Compliance absente | M |
| P3 | Mode live (websocket ou polling 30s) | Confort PE en mobilité | M |
| P3 | Guided onboarding intégré (porter `aiad-sdd tour`) | Nouveaux membres | M |

---

## Verdict global

Le dashboard SDD est **un excellent socle de référence (catalogue, traçabilité, alertes)** mais reste **largement orienté Product Engineer**. Sur 11 personas auditées : 1 servie correctement (PE en 🟡 fort), 2 partielles (PM, Exec 🟡 faible), 8 avec gaps majeurs (🔴/🟠).

Le **backlog #131** (Kanban + lens) couvre déjà ~60 % des manques principaux. Les 40 % restants tiennent essentiellement à 3 chantiers :
1. **Remonter ce qui existe déjà côté CLI** (DPIA, AI-Act, sovereignty, SBOM, hook-stats) — pur problème d'agrégation.
2. **Ajouter une vue QA dédiée** — actuellement quasi-absente.
3. **Honorer la promesse DORA** (page vide qui décrédibilise).

Si tu veux, je peux préparer une suite d'iterations (style des 20 précédentes) pour livrer ces chantiers, ou les ajouter au backlog comme items #132 à #135.
