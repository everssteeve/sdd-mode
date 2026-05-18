# Changelog `aiad-sdd`

> Changements visibles côté **utilisateur** du paquet npm. Pour l'historique
> des artefacts internes au framework (templates, skills, gouvernance),
> voir [`templates/.aiad/CHANGELOG-ARTEFACTS.md`](templates/.aiad/CHANGELOG-ARTEFACTS.md).
>
> Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
> Versionnage : [SemVer 2.0.0](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté — Dashboard PM initiative-cards/spec-lifecycle-time/quick-filters (#558-#560, loop 47)

**47ᵉ boucle d'audit PM** (2026-05-16) — pm.html monte à 131 sections h2,
gagne des cartes d'initiatives par thème, un lifecycle SPEC médian et
des filtres rapides.

- **Cartes d'initiatives par thème** (#558) —
  `lib/dashboard/initiative-cards.js` groupe Intents par tag top 8,
  agrège SPECs liées, calcule ratio livraison.
- **Temps médian par statut SPEC** (#559) —
  `lib/dashboard/spec-lifecycle-time.js` lit pm-snapshots et calcule
  durée médiane que les SPECs passent dans chaque statut.
- **Filtres rapides** (#560) —
  `lib/dashboard/quick-filters.js` barre 5 chips pré-fabriqués qui
  filtrent la table d'alignement Intent ↔ Livraison.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**47 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM sponsor-scorecard/outcome-north-star/activity-feed (#555-#557, loop 46)

**46ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 128 sections h2,
gagne un scorecard composite sponsor, un alignement outcome ↔ NS et un
feed activité 7j.

- **Scorecard sponsors** (#555) —
  `lib/dashboard/sponsor-scorecard.js` score composite /5 par sponsor
  sur 5 dimensions (throughput / engagement / couverture risque /
  pas zombie / review ≤ 14j). 4 états avec chips ok/ko par dimension.
- **Alignement Outcome ↔ North Star** (#556) —
  `lib/dashboard/outcome-north-star.js` Jaccard sur tokens (22
  stopwords) entre chaque outcome PRD §4 et NS §2. Identifie les
  outcomes isolés de la vision produit.
- **Feed activité 7j** (#557) —
  `lib/dashboard/activity-feed.js` agrège 5 sources (Intents, SPECs,
  journal, facts, demos) sur 7j, tri date desc, dates relatives
  ("il y a X min/h/j").

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**46 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM section-visibility/quarterly-decisions/spec-quality-score (#552-#554, loop 45)

**45ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 125 sections h2,
gagne un gestionnaire de visibilité par section, un audit log
trimestriel des décisions et un score qualité SPEC composite.

- **Visibilité des sections** (#552) —
  `lib/dashboard/section-visibility.js` injecte une barre sticky avec
  mode édition (bouton "masquer" sur chaque section) + persistance
  `localStorage.aiad-pm-sections-hidden`. Permet au PM de personnaliser
  son cockpit (125 sections).
- **Décisions & facts par trimestre** (#553) —
  `lib/dashboard/quarterly-decisions.js` scan `pm-journal/*.md` (bullets
  sous `## Décisions`) + `facts/*.md`, groupe par trimestre. Cards par
  trimestre avec listes décisions + facts.
- **Score qualité SPEC** (#554) —
  `lib/dashboard/spec-quality-score.js` score composite /5 sur 5
  dimensions (SQS ≥ 4, taille ≤ M, ≥ 1 AC, ≥ 1 annotation v1.10,
  stable). 4 états excellent/bon/partiel/faible. Identifie SPECs à
  raffiner avant `/sdd exec`.

`.aiad-size-budget.json` étendu pour `lib/dashboard/pm.js`
(orchestrateur PM cockpit qui importe 130+ modules — marge 800 LOC
justifiée).

Zéro modification de `render.js` (toujours 849/850 LOC) —
**45 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM newcomer-checklist/pending-decisions/stakeholder-map (#549-#551, loop 44)

**44ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 123 sections h2,
gagne une reading list onboarding, une queue de décisions PM et une
carte stakeholder.

- **Onboarding nouveau membre** (#549) —
  `lib/dashboard/newcomer-checklist.js` génère reading list ordonnée :
  cadrage PRD/ARCHITECTURE/AGENT-GUIDE, top 5 Intents P0-P1, SPECs
  en cours, gouvernance Tier 1, cheatsheet. Marque incontournable /
  recommandé avec temps estimé.
- **Décisions en attente** (#550) —
  `lib/dashboard/pending-decisions.js` agrège 4 types de décisions PM
  en attente : SPECs review/validation, Intents draft > 14j,
  hypothèses untested > 30j, risques élevés non-couverts. Tri urgent
  d'abord.
- **Carte stakeholder × Intent** (#551) —
  `lib/dashboard/stakeholder-map.js` vue compacte par stakeholder
  unique (sponsor + owner) avec Intents associés par rôle. Détecte
  doubles rôles (signal conflit/surcharge).

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**44 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM bus-factor/sentiment-trend/rituals-calendar (#546-#548, loop 43)

**43ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 120 sections h2,
gagne un bus factor analyzer, une tendance sentiment client et un
calendrier rituels.

- **Bus factor analyzer** (#546) —
  `lib/dashboard/bus-factor.js` compte owners distincts par Intent
  actif. 4 états : pas-downer (0) / single-owner (1) / duo (2) /
  sain (≥ 3). Identifie le risque single-point-of-failure RH.
- **Évolution sentiment client** (#547) —
  `lib/dashboard/sentiment-trend.js` distribue feedbacks (#496) par
  semaine sur 8 sem, SVG bars groupées (vert/rouge/bleu), détecte
  tendance moitié récente vs ancienne.
- **Calendrier rituels AIAD** (#548) —
  `lib/dashboard/rituals-calendar.js` calcule prochain rituel attendu
  pour 6 rituels (standup 1j / demo 7j / tech-review 7j / sync-strat
  30j / retro 90j / intention 30j) basé sur dernier mtime dans
  `.aiad/metrics/`. 5 états (retard/imminent/proche/planifie/jamais).

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**43 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM acceptance-criteria/action-items/okr-progress (#543-#545, loop 42)

**42ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 117 sections h2,
gagne un extracteur de critères d'acceptation, un tracker d'action items
et une progression OKR par KR.

- **Critères d'acceptation SPEC** (#543) —
  `lib/dashboard/acceptance-criteria.js` détecte 3 patterns dans le
  body : section `## Critères d'acceptation`, critères EARS
  (`WHEN/IF/WHILE/WHERE … SHALL …`), checkboxes `- [ ]`/`- [x]`.
  Progression checkboxes mesure l'avancement testable.
- **Action items journaux** (#544) —
  `lib/dashboard/action-items.js` scan `pm-journal/` + `facts/` +
  `metrics/retro/` pour extraire `- [ ]` / `- [x]`. Détecte référence
  INTENT-NNN auto. Tri date desc.
- **Progression OKR par KR** (#545) —
  `lib/dashboard/okr-progress.js` calcule % par Key Result = SPECs
  livrées / totales via Intents rattachés (#444). 5 états (atteint /
  on-track / risque / en-peril / sans-data). Moyenne par objectif.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**42 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM velocity-by-tag/auto-archive-candidates/sprint-recap (#540-#542, loop 41)

**41ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 114 sections h2,
gagne une vélocité par tag, un détecteur de candidats à l'archivage et
un recap sprint.

- **Vélocité par tag** (#540) —
  `lib/dashboard/velocity-by-tag.js` compte SPECs livrées (done/
  archived) groupées par tag d'Intent parent. Identifie les thèmes
  productifs vs stagnants.
- **Candidats archivage automatique** (#541) —
  `lib/dashboard/auto-archive-candidates.js` détecte 3 anti-patterns :
  done > 60j, draft > 120j sans bascule, active > 365j sans SPEC done.
  Empty-clean si backlog propre.
- **Recap sprint 14j** (#542) —
  `lib/dashboard/sprint-recap.js` partitionne SPECs : existantes au
  début / livrées pendant / ajoutées en cours. Taux complétion =
  livrées / engagées. Banner narratif + 3 buckets.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**41 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM portfolio-diversity/dow-heatmap/pr-template (#537-#539, loop 40 🎉 MILESTONE 40 boucles)

**40ᵉ boucle d'audit PM** (2026-05-15) — MILESTONE 40 itérations
consécutives · pm.html monte à 111 sections h2 · render.js stable
849/850 LOC sur 40 boucles.

- **Diversité du portefeuille actif** (#537) —
  `lib/dashboard/portfolio-diversity.js` calcule entropie de Shannon
  normalisée sur 3 axes (tags / owners / sponsors) du portefeuille
  actif. 4 états (uniforme / diversifié / concentré / mono-axe).
  Détecte les single-points-of-failure.
- **Heatmap activité par jour** (#538) —
  `lib/dashboard/dow-heatmap.js` distribue mtime (Intents+SPECs) sur
  7 buckets ISO (Lun→Dim), warning si > 25 % weekend (pression
  équipe).
- **Templates PR par Intent** (#539) —
  `lib/dashboard/pr-template.js` génère description Markdown PR
  pré-remplie : Summary + Changes (SPECs) + Test plan + Conformité
  Tier 1 + Drift Lock avec annotations v1.10. Bouton 📋 Copier
  individuel par Intent.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

**40 boucles consécutives** sans toucher au cœur du rendu
(`render.js` stable 849/850 LOC) — milestone PM cockpit.

### Ajouté — Dashboard PM quarterly-retro-draft/prd-coverage-gaps/spec-annotation-coverage (#534-#536, loop 39)

**39ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 108 sections h2,
gagne un brouillon rétro trimestrielle, un détecteur de trous de
couverture PRD et un mesureur d'annotations SPEC.

- **Brouillon rétro trimestrielle** (#534) —
  `lib/dashboard/quarterly-retro-draft.js` compose Markdown 5 sections
  (livraisons 90j / métriques / hypothèses / risques / 3 questions
  atelier). Détecte trimestre courant Q1-Q4. Bouton 📋 Copier.
- **Trous de couverture PRD** (#535) —
  `lib/dashboard/prd-coverage-gaps.js` croise PRD (outcomes §4,
  personas §3, user-stories §6) avec Intents. Identifie cibles PRD
  sans Intent rattaché. Empty-clean vert si couverture complète.
- **Couverture annotations SPEC** (#536) —
  `lib/dashboard/spec-annotation-coverage.js` mesure présence des 4
  tags AIAD v1.10 (`@intent` / `@spec` / `@verified-by` / `@governance`)
  dans le body des SPECs. 5 états (complet 4/4 → vide 0/4). Requis
  pour le Drift Lock machine-vérifiable.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**39 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM risk-transparency/cumulative-achievements/standup-script (#531-#533, loop 38)

**38ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 105 sections h2,
gagne un score de transparence risque, un compteur cumulé projet et un
script standup auto.

- **Transparence du registre de risque** (#531) —
  `lib/dashboard/risk-transparency.js` mesure % d'Intents à risque
  critical/high avec mitigation explicite (`risks_mitigation:`) OU
  acceptation formelle (#508). 5 états (parfait/bon/partiel/faible/
  sans-data). Tri découverts d'abord.
- **Cumul des achievements** (#532) —
  `lib/dashboard/cumulative-achievements.js` calcule compteurs cumulés
  depuis le jour 1 (mtime le plus ancien) : Intents livrés/actifs/
  draft, SPECs livrées/en cours, vitesse moyenne SPECs/mois, taux
  livraison.
- **Script standup auto** (#533) —
  `lib/dashboard/standup-script.js` génère un Markdown 4 sections
  (🎉 Hier 24h livrés / 🚀 Top 3 P0-P1 / ⛔ Blockers zombies+risques
  découverts / 🎯 SPECs en review). Bouton 📋 Copier via
  `navigator.clipboard`.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**38 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM done-timeline/prd-sections-coverage/outcome-completion (#528-#530, loop 37 🎯 100 sections atteintes)

**37ᵉ boucle d'audit PM** (2026-05-15) — **pm.html dépasse 100 sections
h2 (102)** — milestone PM cockpit. Gagne une timeline mensuelle, une
couverture PRD section par section et un % de complétion par outcome.

- **Timeline des livraisons** (#528) —
  `lib/dashboard/done-timeline.js` regroupe Intents + SPECs done/
  archived par bucket mensuel sur N mois (défaut 6). Bar chart + cards
  mensuelles avec listes typées. Identifie le mois le plus actif.
- **Couverture sections PRD** (#529) —
  `lib/dashboard/prd-sections-coverage.js` parse les `## ` headings du
  PRD, compte mots par section, classe (vide / squelette / léger /
  fourni). Détecte présence des 6 sections AIAD canoniques (§1
  Contexte, §2 North Star, §3 Personas, §4 Outcomes, §6 User Stories,
  §7 Décisions).
- **Complétion des outcomes** (#530) —
  `lib/dashboard/outcome-completion.js` calcule % par outcome =
  SPECs livrées / SPECs attendues via Intents rattachés. 5 états
  (complet 100 % / avancé ≥ 60 % / progresse 25-60 % / début < 25 % /
  sans-data). Barre de progression + tri pct desc.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**37 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM spec-scope/goal-alignment/velocity-sla (#525-#527, loop 36)

**36ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 99 sections h2,
gagne un T-shirt size SPEC, un score d'alignement North Star et un
tracker SLA vélocité.

- **Taille SPEC T-shirt size** (#525) —
  `lib/dashboard/spec-scope.js` classe chaque SPEC en XS/S/M/L/XL
  selon le nb de mots du body (≤100/≤300/≤700/≤1500/>1500). Marque
  `aDecouper` pour XL. Signal de découpage à faire via `/sdd split`.
- **Alignement Intent ↔ North Star** (#526) —
  `lib/dashboard/goal-alignment.js` calcule similarité Jaccard
  (tokens > 3 chars, 20 stopwords FR/EN supprimés) entre chaque
  Intent (titre + POURQUOI + OBJECTIF) et le North Star du PRD §2.
  Classes : aligné ≥ 0.15, partiel 0.05-0.15, isolé < 0.05.
- **Vélocité vs SLA** (#527) —
  `lib/dashboard/velocity-sla.js` compare la vélocité actuelle (#479
  forecast) à un target_velocity configurable (frontmatter ou défaut
  1.5 SPECs/sem). 4 états : tenu / proche / sous-rythme / critique
  avec barre de progression colorée.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**36 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM discovery-to-delivery/owner-workload/reading-time (#522-#524, loop 35)

**35ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 96 sections h2,
gagne un cycle-time discovery→delivery, une heatmap workload par owner
et un estimateur de temps de lecture.

- **Discovery → Delivery cycle time** (#522) —
  `lib/dashboard/discovery-to-delivery.js` mesure le délai entre
  création Intent `kind: discovery|experiment` et sa première SPEC
  livrée. 5 buckets (très-court ≤ 14j → très-long > 120j) + cycle
  moyen + médian.
- **Charge par owner** (#523) —
  `lib/dashboard/owner-workload.js` distribue les Intents actifs par
  owner, compare à `capacity:` frontmatter (défaut 3). 5 états
  (libre / léger / optimal / limite / surcharge). Barre colorée +
  sample d'IDs.
- **Temps de lecture artefacts** (#524) —
  `lib/dashboard/reading-time.js` estime mots+minutes pour chaque
  Intent et SPEC (vitesse 220 mots/min). Marque `trop_long` si > 8
  min. Aide à planifier les revues.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**35 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM persona-outcome-matrix/throughput-trend/risk-concentration (#519-#521, loop 34)

**34ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 93 sections h2,
gagne une heatmap persona×outcome, un throughput backlog et une
concentration des risques par sponsor.

- **Matrice persona × outcome** (#519) —
  `lib/dashboard/persona-outcome-matrix.js` croise personas PRD §3 ×
  outcomes PRD §4. Cellules colorées par densité (0/1/2/many).
  Identifie les zones blanches (persona sans outcome servi).
- **Throughput backlog** (#520) —
  `lib/dashboard/throughput-trend.js` compare intake (Intents créés)
  vs delivery (Intents done/archived) par semaine sur 6 sem. SVG
  barres groupées bleu/vert. Direction `gonfle`/`reduit`/`equilibre`
  sur 3 dernières semaines. Warning rouge si gonfle.
- **Concentration des risques par sponsor** (#521) —
  `lib/dashboard/risk-concentration.js` groupe les Intents à risque
  critical/high par sponsor (5 alias + multi-valued). Identifie le
  hotspot. Empty-clean vert si zéro risque élevé.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**34 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM backlog-pyramid/spec-cross-intent/blocker-reminders (#516-#518, loop 33)

**33ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 90 sections h2,
gagne une pyramide d'âge, un détecteur SPECs transverses et un
générateur de relances prêtes à copier.

- **Pyramide d'âge backlog** (#516) —
  `lib/dashboard/backlog-pyramid.js` répartit les Intents non-archived
  dans 5 buckets (neuf 0-7j / récent 8-30j / mature 31-90j / ancien
  91-180j / héritage > 180j). Barre empilée colorée + détails top-5
  par bucket + âge moyen global.
- **SPECs transverses** (#517) —
  `lib/dashboard/spec-cross-intent.js` détecte les SPECs qui
  référencent ≥ 2 Intents (via parentIntent + frontmatter
  `intents: [...]`). Cards avec bordure orange si ≥ 3 Intents
  (potentiel découpage). Empty-clean si scoping propre.
- **Relances blockers** (#518) —
  `lib/dashboard/blocker-reminders.js` agrège 3 types de blockers
  (sponsor silencieux, SPEC bloquée, risque non-accepté) en snippets
  prêts à copier. Bouton 📋 Copier via navigator.clipboard. Templates
  contextuels en français.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**33 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM spec-stuck/tag-clusters/cost-of-delay (#513-#515, loop 32)

**32ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 87 sections h2,
gagne un détecteur SPECs stagnantes (large), des clusters tags et un
cost-of-delay scorer.

- **SPECs bloquées** (#513) —
  `lib/dashboard/spec-stuck.js` étend #507 review-queue à TOUS les
  statuts non-terminaux avec seuils configurables (draft 45j, ready
  30j, in-progress 21j, review/validation 14j). Tri par dépassement
  desc.
- **Clusters thématiques** (#514) —
  `lib/dashboard/tag-clusters.js` détecte les paires de tags
  co-occurentes sur ≥ 2 Intents pour identifier les vrais thèmes
  produit (paiement+sepa, onboarding+mobile…). Top tags + clusters.
- **Cost-of-delay scorer** (#515) —
  `lib/dashboard/cost-of-delay.js` score chaque Intent par
  CoD = poidsPrio (P0=50…P4=2) × urgenceMult (retard×3 / urgent×2 /
  proche×1.3 / distant×1) × statutMult (active×1.2 / draft×0.6). Tri
  CoD desc avec tiers critical/élevé/standard. Informe les arbitrages.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**32 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM state-transitions/orphan-deps/demo-agenda (#510-#512, loop 31)

**31ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 84 sections h2,
gagne une timeline transitions d'état, un détecteur de deps orphelines
et un agenda demo auto.

- **Transitions d'état Intent** (#510) —
  `lib/dashboard/state-transitions.js` reconstitue depuis les snapshots
  `pm-snapshots/*.json` la timeline de statut par Intent (draft → active
  → done…). Détecte les **régressions** (ex. done → active) via
  ranking. Cards avec flow coloré + warning rouge si régression.
- **Dépendances orphelines** (#511) —
  `lib/dashboard/orphan-deps.js` détecte les références
  `depends_on:`/`blocked_by:` pointant vers un Intent inexistant
  (typos, oublis post-archivage) + les self-loops. Empty-clean vert
  si graphe propre.
- **Agenda demo auto** (#512) —
  `lib/dashboard/demo-agenda.js` génère un brouillon d'agenda à partir
  des SPECs done non démontrées (#137), groupage par Intent parent,
  tri priorité, budget temps configurable (cible 30 min par défaut,
  2 min intro + 3 min/SPEC). Coupe les items hors fenêtre. Bouton
  🖨 Imprimer.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**31 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM review-queue/accepted-risks/wins-wall (#507-#509, loop 30 🎉)

**30ᵉ boucle d'audit PM** (2026-05-15) — MILESTONE 30 itérations
consécutives · pm.html monte à 81 sections h2 · render.js stable 849/850
LOC depuis 30 boucles.

- **File de revue SPECs** (#507) —
  `lib/dashboard/review-queue.js` surface les SPECs `review`/`validation`
  triées par âge desc (plus ancienne en tête). Classes frais/tiède/
  bloqué selon ancienneté (7j/14j). Warning si SPEC > 14j en review.
- **Registre des risques acceptés** (#508) —
  `lib/dashboard/accepted-risks.js` lit `risks_accepted: [...]` ou
  `risk_status: accepted` du frontmatter (6 alias FR/EN). Gouvernance
  lisible : "voici ce qu'on a CHOISI de NE PAS adresser, et pourquoi".
  Bordure rouge si acceptation globale.
- **Wins récents** (#509) —
  `lib/dashboard/wins-wall.js` rend un mur des SPECs livrées + Intents
  archivés des 30 derniers jours. Cards avec icônes 🚀 / 🎯, date
  relative ("hier", "il y a 2sem") + banner cumulé. Maintient la
  dynamique d'équipe — un dashboard qui ne montre que ce qui reste à
  faire démotive.

`collect.js` : spread étendu pour 6 nouveaux champs frontmatter risques
(risks_accepted, risksAccepted, accepted_risks, acceptedRisks,
risk_status, riskStatus). `SECTION_TO_TABS` (#480) étendu pour les 3
nouveaux slugs.

**30 boucles consécutives** sans toucher au cœur du rendu (`render.js`
stable 849/850 LOC).

### Ajouté — Dashboard PM ttfs/voice-wall/quarterly-delivery (#504-#506, loop 29)

**29ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 78 sections h2,
gagne un tracker de discovery velocity, un mur de voix client et un
suivi planifié-vs-livré par trimestre.

- **Time-to-first-SPEC** (#504) —
  `lib/dashboard/time-to-first-spec.js` mesure pour chaque Intent
  le délai entre création (mtime) et première SPEC liée. 5 buckets :
  rapide / normal / lent / très-lent / non-décomposé. TTFS moyen
  calculé. Signal-clé de la discovery velocity.
- **Mur de la voix client** (#505) —
  `lib/dashboard/customer-voice-wall.js` sélectionne les extraits
  les plus impactants depuis `customerFeedback` (3 négatifs +
  2 questions + 1 positif), nettoie l'extrait (180 chars max),
  rend wall de citations avec `« … »` CSS et chips meta.
- **Livraison par trimestre** (#506) —
  `lib/dashboard/quarterly-delivery.js` croise planifié (Intents avec
  `target_date` ou `target: Q1-2026`) vs livré (SPECs done/archived
  par trimestre). Table + mini-bars empilées + écart coloré.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**29 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM intent-compare/sponsor-prep/backlog-hygiene (#501-#503, loop 28)

**28ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 75 sections h2,
gagne une comparaison Intent side-by-side, une prep 1:1 sponsor et un
détecteur d'hygiène backlog.

- **Compare Intents** (#501) —
  `lib/dashboard/intent-compare.js` rend une grille CSS 11 critères ×
  N colonnes (priorité, sponsor, échéance, SQS readiness, avancement,
  hypothèse, risque, dépendances…). Sélection par défaut : top 3
  priorité. Override via URL `#compare=INTENT-101,INTENT-103` avec
  écoute `hashchange` — pas de regen serveur nécessaire.
- **Prep 1:1 sponsor** (#502) —
  `lib/dashboard/sponsor-prep.js` agrège par sponsor unique : Intents
  portés (counts), SPECs livrées (dernier livrable), risques élevés,
  échéances proches, dernier contact tracé. Brief 30s pour préparer
  un 1:1 sans pivoter entre 5 sections.
- **Hygiène backlog** (#503) —
  `lib/dashboard/backlog-hygiene.js` détecte 4 anti-patterns :
  drafts > 90j, active > 60j sans SPEC, done > 180j non-archivés,
  doublons potentiels (Jaccard ≥ 0.6 sur tokens titre normalisés
  NFD). Chaque suggestion porte une action explicite ("descoper",
  "décomposer via /sdd spec", "archiver", "fusionner").

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**28 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM hypothesis-lifecycle/roadmap-timeline/pm-scorecard (#498-#500, loop 27)

**27ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 72 sections h2,
gagne une dynamique d'hypothèses, une roadmap Gantt et un scorecard PM
personnel.

- **Cycle de vie des hypothèses** (#498) —
  `lib/dashboard/hypothesis-lifecycle.js` normalise 14 alias FR/EN
  d'état (`untested`/`testing`/`validated`/`invalidated`/`partial`),
  calcule taux de validation + mean time to resolution + détecte les
  hypothèses qui stagnent (non-terminale > 30j). Warning rouge si
  stagnation détectée.
- **Roadmap timeline Gantt-light** (#499) —
  `lib/dashboard/roadmap-timeline.js` parse ISO `YYYY-MM-DD` ou
  `Q1-2026` (fin trimestre), rend SVG Gantt-light 760px avec barres
  colorées selon proximité (retard/urgent/proche/distant) + ticks
  mensuels + trait pointillé "maintenant". Visualisation rapide
  d'un coup d'œil.
- **Scorecard PM personnel** (#500) —
  `lib/dashboard/pm-scorecard.js` mesure 6 KPIs sur 30j glissants
  vs 30j précédents : Intents capturés, SPECs livrées, journal,
  facts, demos, sync stratégiques. Direction (up/down/flat) selon
  delta > ±10 %. Permet au PM de mesurer son rythme d'activité.

`SECTION_TO_TABS` (#480) étendu pour les 3 nouveaux slugs.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**27 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM prd-freshness/customer-feedback/whats-new (#495-#497, loop 26)

**26ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 69 sections h2,
gagne une surveillance de la fraîcheur cadrage, une inbox feedback et
un "what's new" persistant.

- **Fraîcheur cadrage** (#495) —
  `lib/dashboard/prd-freshness.js` surveille les mtimes de PRD /
  ARCHITECTURE / AGENT-GUIDE avec seuils différenciés (PRD 30/90j,
  archi+guide 60/180j). 4 états frais/tiède/périmée/absent + nb h2.
  Détecte la dérive silencieuse de la vision documentaire.
- **Inbox feedback utilisateur** (#496) —
  `lib/dashboard/customer-feedback.js` scan
  `.aiad/feedback/*.md` (et `customer-feedback/`) avec classification
  sentiment heuristique (10 mots positifs / 12 négatifs / 6 questions,
  négatif l'emporte sur positif). Frontmatter `source/author/intent/
  date` reconnu. Cards par sentiment 👍👎❓·.
- **Nouveautés depuis votre dernière visite** (#497) —
  `lib/dashboard/whats-new.js` hybride serveur+client. Le HTML embarque
  les 60 artefacts récents (Intents+SPECs) en JSON, le script client
  filtre selon `localStorage.aiad-pm-last-visit` et affiche uniquement
  les items modifiés depuis. Bouton "✓ Marquer tout lu" reset le
  timestamp. Anti-XSS : escape `<>&` dans le JSON embarqué.

`SECTION_TO_TABS` (#480) étendu : les 3 nouvelles sections sont
rattachées aux axes strategique/tactique/communication/rituels.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**26 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM outcome-attribution/dd-balance/velocity-by-sponsor (#492-#494, loop 25)

**25ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 66 sections h2,
gagne un rollup contribution outcome, un équilibre discovery/delivery
et une vélocité par sponsor.

- **Attribution outcomes** (#492) —
  `lib/dashboard/outcome-attribution.js` croise PRD outcomes (#428)
  avec SPECs livrées (done/archived) via Intent parent. Anti-vanity :
  surface les outcomes à 0 contribution (prématurés ou en danger).
  Cards colorées par ratio (vert ≥ 60% / orange) + chips SPECs
  attribuées.
- **Discovery / Delivery balance** (#493) —
  `lib/dashboard/discovery-delivery-balance.js` classe les Intents
  via `kind` (12 alias FR/EN) ou heuristique (hypothèse non validée
  → discovery / active + SPECs ≥ 1 → delivery). Stacked bar + verdict
  santé selon cibles standard PM 65/25/10 % (delivery/discovery/
  enabler). Détecte déséquilibres > 25%.
- **Vélocité par sponsor** (#494) —
  `lib/dashboard/velocity-by-sponsor.js` agrège par sponsor unique
  (5 alias FR/EN + multi-valued) : nb Intents portés, nb SPECs
  livrées, throughput, cycle-time moyen. Table avec médailles
  🥇🥈🥉 pour préparer les 1:1 sponsor.

`SECTION_TO_TABS` (#480) étendu : les 3 nouvelles sections sont
rattachées aux axes strategique/communication/tactique.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**25 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM stakeholder-comms/decision-velocity/weekly-checklist (#489-#491, loop 24)

**24ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 63 sections h2,
gagne un tracker de silence stakeholder, une vélocité décisionnelle, et
une checklist hebdomadaire SDD-Mode-aware.

- **Stakeholder communication tracker** (#489) —
  `lib/dashboard/stakeholder-comms.js` calcule pour chaque Intent
  actif la dernière trace de communication (mtime demo / sync-strat,
  scan mentions `INTENT-NNN` dans `pm-journal/`). Classe en
  recent ≤ 7j / tiède ≤ 30j / silencieux > 30j. Identifie les
  Intents où sponsor n'a pas été informé.
- **Vélocité décisionnelle** (#490) —
  `lib/dashboard/decision-velocity.js` compte les décisions
  documentées par semaine (sections `## Décisions` dans
  `pm-journal/` + fichiers dans `.aiad/facts/`). Bars chart SVG
  520×160 sur 8 semaines, régression linéaire pour tendance
  (accélération / décélération / stable), détection inertie
  (0 décision sur 2 dernières semaines = warning rouge).
- **Checklist hebdomadaire PM** (#491) —
  `lib/dashboard/pm-weekly-checklist.js` rend 9 tâches récurrentes
  SDD-Mode-aware (5 hebdo + 2 mensuel + 1 trimestriel + 1 cross-day)
  avec persistance `localStorage.aiad-pm-checklist-{YYYY-Www}` —
  reset auto chaque lundi (semaine ISO nouvelle). Boutons "Tout
  cocher" et "Reset semaine". Caché à l'impression.

`SECTION_TO_TABS` (#480) étendu : les 3 nouvelles sections sont
rattachées aux axes communication/tactique/rituels/stratégique.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**24 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM maturity/narrative/sprint-planner (#486-#488, loop 23)

**23ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 60 sections h2,
gagne une métrique de complétude doc, un résumé factuel et un auto-prioritizer.

- **Maturité documentaire des Intents** (#486) —
  `lib/dashboard/intent-maturity.js` score chaque Intent sur ses 5
  sections canoniques (POURQUOI / POUR QUI / OBJECTIF / CONTRAINTES /
  CRITÈRE DE DRIFT) après nettoyage des placeholders bracketés.
  3 niveaux par section (mature ≥ 50 chars / squelette < 50 / absent)
  → score /100 et 4 états (complete / structured / skeleton /
  incomplete). Identifie en amont les Intents squelettiques qui
  généreront du drift en SPEC.
- **Narratif stratégique** (#487) —
  `lib/dashboard/strategic-narrative.js` compose un paragraphe factuel
  de 4-6 phrases (counts, top priorité, risque majeur, vélocité,
  santé, AI Act si pertinent) prêt à copier dans PR description,
  Slack daily ou email exec. Bouton 📋 Copier via
  `navigator.clipboard.writeText` (texte brut sans markdown).
- **Sprint planner — commit horizon** (#488) —
  `lib/dashboard/sprint-planner.js` croise SQS readiness (#484) +
  priorité frontmatter + capacité trimestre courant (#443). 3 buckets :
  Commit (P0-P1 ready/partial dans la capacité), Stretch
  (P0-P2 ready si capacité supplémentaire), Defer (priorité basse ou
  SQS faible). Auto-priorisation actionnable pour la prochaine demo.

`SECTION_TO_TABS` (#480) étendu : les 3 nouvelles sections sont
rattachées à des axes spécifiques pour filtrage cohérent.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**23 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM notif-center/sqs-readiness/health-timeline (#483-#485, loop 22)

**22ᵉ boucle d'audit PM** (2026-05-15) — pm.html monte à 57 sections h2,
gagne un agrégateur d'urgence, un rollup SQS et une timeline de santé.

- **Centre de notifications** (#483) —
  `lib/dashboard/notification-center.js` agrège 6 sources de signal
  (retard target / risques critical-high / AI Act élevé-interdit /
  zombies / backlog abandonné / drafts vieux) en une pile de cartes
  triées par criticité (critique/élevé/attention). Chaque carte a un
  deep-link `Voir →` vers la section détail. Empty state encourageant.
  Inséré en TÊTE de la page PM, avant sticky alerts.
- **SQS readiness scorecard** (#484) —
  `lib/dashboard/sqs-readiness.js` lit `spec.sqs` du frontmatter,
  agrège par Intent et classe en 5 états : `ready` (toutes ≥ 4),
  `partial` (mix), `needs-work` (toutes < 4), `to-score` (SPECs sans
  score), `no-spec` (aucune SPEC). Highlight des SPECs faibles par
  Intent. Permet d'identifier le maillon faible avant `/sdd exec`.
- **Timeline du score santé** (#485) —
  `lib/dashboard/health-timeline.js` lit
  `.aiad/metrics/sante-globale/*.json` (persisté par
  `aiad-sdd health --persist`), trace une sparkline SVG 560×140 avec
  seuils 80/50, cercles colorés selon niveau. Calcule la tendance
  (up/down/flat/unknown) sur moitiés récente vs ancienne pour
  répondre : "ça s'améliore ou ça se dégrade ?"

`SECTION_TO_TABS` (#480) étendu : les 3 nouvelles sections sont
rattachées à des axes spécifiques pour filtrage cohérent.

Zéro modification de `render.js` (toujours 849/850 LOC) —
**22 boucles consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM cockpit tabs/md-export/ai-act (#480-#482, loop 21)

**21ᵉ boucle d'audit PM** (2026-05-15) — pm.html à 54 sections gagne
un filtre cognitif, un export complet et une classification réglementaire.

- **Cockpit tabs** (#480) — `lib/dashboard/cockpit-tabs.js` ajoute une
  barre sticky 5 onglets (Tout / Tactique / Stratégique / Communication
  / Rituels) qui masque ou affiche les sections selon l'axe choisi.
  Mapping de 60+ slugs h2 vers 1..n axes. Persisté dans
  `localStorage.aiad-pm-tab`. Caché en recherche globale (#449) et
  en `@media print`. Vérifié Playwright : tab `tactique` → 21 sections
  visibles / 33 masquées.
- **Export Markdown complet** (#481) —
  `lib/dashboard/pm-md-export.js` génère un snapshot Markdown
  structuré (9 sections : état général, échéances, top 5 priorités,
  capacity, leaderboard #478, forecast #479, OKR #444, hypothèses
  #438, risques #439). Bouton `⬇ Télécharger pm-cockpit-YYYY-MM-DD.md`
  via `Blob`. Pour archivage Notion / PR description / wiki.
- **Conformité EU AI Act** (#482) —
  `lib/dashboard/ai-act-compliance.js` classe chaque Intent selon le
  Règlement (UE) 2024/1689 : interdit / élevé Annexe III / transparence
  / minimal. Frontmatter `ai_risk:` prioritaire, sinon heuristique sur
  19 keywords (chatbot/llm/gpt/biométrie/recrutement/credit scoring/
  recommandation/…). Warning rouge si pratique interdite ou risque
  élevé détecté : "solliciter le DPO et l'agent gouvernance
  AIAD-AI-ACT, documentation Annexe IV obligatoire avant mise sur le
  marché EU".

Zéro modification de `render.js` (toujours 849/850 LOC) — **21 boucles
consécutives** sans toucher au cœur du rendu.

### Ajouté — Dashboard PM cockpit theme/leaderboard/forecast (#477-#479, loop 20)

**20ᵉ boucle d'audit PM** (2026-05-15) — le cockpit gagne 3 vues
d'ergonomie + analyse stratégique + prédiction.

- **Theme switcher PM-friendly** (#477) — `lib/dashboard/pm-theme.js`
  expose 3 thèmes (default PE bleu / pm-warm chaud orange / pm-focus
  haute densité). Persisté dans `localStorage.aiad-pm-theme`. CSS
  overrides scopés via `body.pm-theme-{nom}`.
- **Outcome contribution leaderboard** (#478) —
  `lib/dashboard/outcome-leaderboard.js` calcule un score composite
  `outcomesServis × poids_priorité` (P0=5, P1=3…) + bonus (+1 SPEC
  done, +0.5 active). Table top 10 avec médailles 🥇🥈🥉. Aide à
  protéger les contributeurs majeurs dans les arbitrages capacité.
- **Velocity forecast** (#479) — `lib/dashboard/velocity-forecast.js`
  applique une régression linéaire OLS sur les 6 dernières semaines
  de SPECs done, projette 6 semaines en avant avec intervalle de
  confiance ±1σ. Détecte accélération/décélération + ETA backlog
  actuel. SVG historique + projection pointillée + zone de confiance.

Zéro modification de `render.js` (toujours 849/850 LOC). pm.html monte
à **56 sections** maintenant — **20 boucles consécutives** sans toucher
au cœur du rendu.

### Ajouté — Dashboard PM cockpit goal-tree/ab-test/risk-burndown (#474-#476, loop 19)

19ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues axées
stratégie + expérimentation + évolution temporelle des risques.

- **Goal tree** (#474) — `lib/dashboard/goal-tree.js` extrait la North
  Star (PRD §2) et rend l'arbre hiérarchique North Star → Outcomes
  (PRD §4) → Intents (#428) → SPECs (#421) avec connecteurs ASCII
  `├─ └─`. Bannière orange pour Intents orphelins (sans outcome).
- **A/B test tracker** (#475) — `lib/dashboard/ab-test-tracker.js`
  détecte les Intents avec `kind: experiment` ou frontmatter
  `experiment:` (hypothesis/metric/variants/status/sample_size/winner/
  result_summary). Statuts FR/EN. Cards triées par actionnabilité
  (running > validés > inconcluants > invalidés). Variant gagnant
  mis en évidence en vert.
- **Risk burndown** (#476) — `lib/dashboard/risk-burndown.js` consomme
  les snapshots PM (#433) pour tracer une sparkline du nombre de
  risques (#439) encore ouverts à chaque date. Tendance up/down/flat
  comparant moitié récente à moitié ancienne.

Zéro modification de `render.js` (toujours 849/850 LOC). pm.html monte
à **53 sections** maintenant.

### Ajouté — Dashboard PM cockpit freshness/standup/retro (#471-#473, loop 18)

18ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues axées
rituels et hygiène : fraîcheur du backlog, timer de standup intégré,
rétrospective trimestrielle pré-remplie.

- **Backlog freshness** (#471) — `lib/dashboard/backlog-freshness.js`
  classe les Intents/SPECs actifs en 4 paliers temporels (frais ≤ 14j /
  tiède / stale / abandonné > 60j). Stats colorées + conseil
  "rafraîchir, ré-évaluer ou archiver".
- **Stand-up timer** (#472) — `lib/dashboard/standup-timer.js` rend un
  widget timer 10/15/30 min directement intégré au cockpit. Démarrer /
  Pause / Reset + Notification Web API à 0 s + beep audio. Animation
  pulse quand timer terminé.
- **Rétrospective trimestrielle** (#473) —
  `lib/dashboard/quarterly-retro.js` génère un Markdown structuré avec
  Intents livrés du quarter + hypothèses validées/invalidées (#440) +
  outcomes ✓/✗ (#208) + métriques lead time (#438) + placeholders
  apprentissages humains. Prêt à coller dans Notion / rétro doc.

Zéro modification de `render.js` (toujours 849/850 LOC). pm.html monte
à **50 sections** maintenant.

### Ajouté — Dashboard PM cockpit newsletter/velocity/wip (#468-#470, loop 17)

17ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues : partage
hebdo automatique, mesure delta, protection contre surcharge.

- **Newsletter PM hebdo** (#468) — `lib/dashboard/weekly-newsletter.js`
  compose un Markdown ~40 lignes (livré / décisions / risques / top 3
  priorités) prêt à coller dans Slack / email / Notion. Réutilise les
  données de pmDiff (#433), decisionLog (#443), intentDeps (#434),
  confidenceTracker (#459).
- **Velocity comparison** (#469) — `lib/dashboard/velocity-comparison.js`
  compare semaine courante (lundi UTC → dimanche UTC) à la précédente.
  Grille 2 cards avec sparkline 3 semaines + delta coloré ↗/↘/→.
- **WIP limit detection** (#470) — `lib/dashboard/wip-limit.js` lit
  `wip_limit:` du frontmatter PRD (uniforme ou {intents, specs}),
  fallback `team_capacity_per_quarter / 4` ou défaut 5/8. Compte les
  items WIP simultanés, classifie en 4 états (critique/dépassée/
  proche/sain). Message d'alerte si dépassée.

Zéro modification de `render.js` (toujours 849/850 LOC). pm.html monte
à **47 sections** maintenant.

### Ajouté — Dashboard PM cockpit focus/filters/links (#465-#467, loop 16)

16ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues d'usage
quotidien : signal unique en haut, persistance des filtres, hub d'outils.

- **Daily focus / north star widget** (#465) —
  `lib/dashboard/daily-focus.js` extrait LA pire alerte parmi 6 sources
  (cycle, fact critique, retard, goulot, pari, urgent ≤ 14j) et la rend
  en bannière full-width gradient coloré avec emoji + action concrète +
  lien d'ancre. Message "Pas de feu" si tout calme.
- **Saved filters localStorage** (#466) —
  `lib/dashboard/saved-filters.js` persiste `aiad-pm-search` (recherche
  globale #456) et `aiad-pm-chips` (chips intents.html #421) entre
  sessions. Widget UI avec indicator + bouton Reset.
- **Quick links hub** (#467) — `lib/dashboard/quick-links.js` lit
  `.aiad/pm-links.yml` (parser YAML inline custom) ou fallback PRD
  frontmatter, rend une grille de cartes pour Notion / Slack / Jira /
  Calendar / Figma. Allowlist URL strict (https/http/mailto) anti-XSS,
  rejet `javascript:`.

Zéro modification de `render.js` (toujours 849/850 LOC). pm.html monte
à **44 sections** maintenant.

### Ajouté — Dashboard PM cockpit onboarding/suggestions/heatmap (#462-#464, loop 15)

15ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues : guide
nouvel utilisateur, détection de clusters, et rythme d'activité.

- **Onboarding tour 5 étapes** (#462) —
  `lib/dashboard/onboarding-tour.js` injecte un overlay HTML caché +
  script localStorage qui lance le tour au premier chargement. 5 étapes
  (Bienvenue / Échéances / Top priorités / Roadmap & Capacity / Brief PM
  & Wizard). Skip/Esc + bouton "🎓 Rejouer le tour" en bas de pm.html.
- **Smart suggestions de rapprochement** (#463) —
  `lib/dashboard/smart-suggestions.js` détecte 4 types de clusters
  (OKR partagé, persona partagé, tags communs ≥ 2 / ≥ 3 Intents,
  doublons potentiels via tokens ≥ 5 chars partagés). Tri par actionn-
  abilité (doublons d'abord). Bug latent corrigé : dangling-else dans
  `if (Array) for if (v) ... else if (string)` → helper `extraireSet`.
- **Heatmap activité PM 60 jours** (#464) —
  `lib/dashboard/activity-heatmap.js` rend une grille GitHub-style
  (7 lignes × N/7 colonnes) avec opacité graduée sur 5 niveaux selon
  ratio count/max. Compte les mtimes Intents+SPECs+facts. Stats
  cumulées + streak depuis aujourd'hui.

Zéro modification de `render.js` (toujours 849/850 LOC). pm.html monte
à **42 sections** maintenant.

### Ajouté — Dashboard PM cockpit confidence/journal/markdown (#459-#461, loop 14)

14ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues : risque
des paris, journaling décisions, et un coup de polish typographique.

- **Confidence tracker** (#459) — `lib/dashboard/confidence-tracker.js`
  lit `confidence: 75` (0-100 ou 0-1) ou `confidence_level:
  high|medium|low` (mapped 90/60/30) du frontmatter. Classe en 4 bandes
  (solide ≥ 80, raisonnable, faible, très-faible). Détecte les **paris
  risqués** (active + faible/très-faible confidence) et les met en tête.
- **Journal PM quotidien** (#460) — `lib/dashboard/pm-journal.js` lit
  `.aiad/metrics/pm-journal/YYYY-MM-DD.md` (un fichier par jour), agrège
  les 7 derniers jours avec compteur d'entrées atomiques. Génère la
  **commande shell de capture rapide** prête à coller dans le terminal.
- **Markdown render léger** (#461) — `lib/dashboard/markdown-light.js`
  remplace les `<pre>` plain text des sections d'Intent par un rendu
  HTML léger (gras, italic, code inline, liens avec allowlist URL,
  listes, refs AIAD `INTENT-NNN`/`SPEC-NNN-N`/`KR-N.N` auto-wrappées
  en `<code>`). **Anti-XSS strict** : escape HTML d'abord, `javascript:`
  refusé. Appliqué à `intent-page.js` (#453) ET `pm.js#sectionsDetails`.

`lireIntents` étendu pour spread 4 nouveaux champs frontmatter
(`confidence`/`Confidence`/`confidence_level`/`confidenceLevel`). Zéro
modification de `render.js` (toujours 849/850 LOC). pm.html monte à
**39 sections** maintenant.

### Ajouté — Dashboard PM cockpit search/permalink/capacity (#456-#458, loop 13)

13ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues
d'ergonomie + d'analyse trimestrielle qui scellent l'usage quotidien.

- **Recherche globale Cmd+K** (#456) — `lib/dashboard/global-search.js`
  indexe ~80 items (18 sélecteurs : tables, cards, chips, links) et
  filtre en live au keystroke avec compteur visible + masquage des
  sections vides. Raccourci `Cmd+K` / `Ctrl+K` pour focus, `Esc` pour
  reset. Sticky top 3rem avec backdrop-filter.
- **Permalinks par section** (#457) —
  `lib/dashboard/section-permalinks.js` ajoute un bouton 🔗 sur chaque
  `<h2[id]>` (35 sur le bench) qui copie l'URL complète avec ancre via
  `navigator.clipboard`. Toast feedback "Lien copié : {id}". Auto-scroll
  vers l'ancre si présente au chargement.
- **Capacity planner trimestriel** (#458) —
  `lib/dashboard/capacity-planner.js` lit `team_capacity_per_quarter`
  du PRD ou fallback `intents_per_pe × team_size` ou défaut 10, classe
  chaque trimestre en 4 paliers (saturé/plein/sain/sous-utilisé) avec
  barres de progression + chips Intents. Signale les Intents actifs
  sans target.

Zéro modification de `render.js` (toujours 849/850 LOC). pm.html monte
à **37 sections** maintenant.

### Ajouté — Dashboard PM cockpit deep-dive/progression (#453-#455, loop 12)

12ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues qui
complètent le deep-dive et la mesure de progression.

- **Pages individuelles par Intent** (#453) —
  `lib/dashboard/intent-page.js` génère 1 fichier HTML autonome par
  Intent (`intent-INTENT-XXX-slug.html`) avec body 2 colonnes (sections
  canoniques + SPECs + risques + hypothèse + dépendances à gauche,
  sidebar méta complète à droite). Section sur pm.html avec grille de
  liens. Échec non-bloquant pour la génération du dashboard.
- **Burnup chart cumulatif** (#454) —
  `lib/dashboard/burnup-chart.js` consomme les snapshots PM (#433) pour
  tracer 2 polylines (scope total bleu + complete vert) sur SVG 640×240
  avec extrapolation linéaire ETA. Vue burnup canonique Lean/Agile,
  complémentaire au CFD (#449).
- **Backlog refinement detector** (#455) —
  `lib/dashboard/refinement.js` applique 5 heuristiques actionnables
  (spec-missing ≥ 7j, objectif > 200 chars, bloqué actif, no-target,
  no-owner) et propose **l'action concrète** copy-paste pour chaque
  signal. Cards triées par gravité.

`dashboard.js` orchestre désormais aussi `genererPagesIntents()` après
la boucle PAGES (best-effort). Zéro modification de `render.js`
(toujours 849/850 LOC). pm.html monte à **35 sections** maintenant +
**N fichiers HTML individuels** (1 par Intent).

### Ajouté — Dashboard PM cockpit OKR/discovery/tags (#450-#452, loop 11)

11ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues qui
complètent le dictionnaire PM canonique : alignement OKR, dual-track
Agile, slicing transversal.

- **Alignement OKR** (#450) — `lib/dashboard/okr-mapping.js` parse
  `.aiad/OKR.md` (format `## O-N — Description` + `### KR-N.N : ...`)
  et croise avec les Intents (frontmatter `okr:` / `okrs:`). Détecte les
  références orphelines (KR cités par Intent mais absents d'OKR.md).
- **Discovery board / dual-track Agile** (#451) —
  `lib/dashboard/discovery-board.js` lit `kind:` du frontmatter et
  bucketise en 6 modes (discovery/experiment/spike/research/prototype/
  delivery). Distingue exploration vs exécution. Affiche
  `hypothesisStatus` en badge sur chaque carte.
- **Tag cloud transversal** (#452) — `lib/dashboard/tag-cloud.js` lit
  `tags:` / `labels:` frontmatter, normalise (lowercase + tirets),
  rend un cloud avec 4 tailles graduées + drill-down interactif côté
  client (click → liste des Intents porteurs).

`lireIntents` étendu pour spread 14 nouveaux champs frontmatter (8 OKR
+ 2 kind/track + 5 tag aliases). Zéro modification de `render.js`
(toujours 849/850 LOC). pm.html monte à **31 sections** maintenant.

### Ajouté — Dashboard PM cockpit print/capture/flow (#447-#449, loop 10)

10ᵉ boucle d'audit PM (2026-05-15) — le cockpit ferme la boucle entrée
(capture) → suivi (CFD) → sortie (print PDF). Le PM peut désormais
travailler 100 % via le dashboard.

- **Mode impression / PDF COMEX** (#447) — `lib/dashboard/print-mode.js`
  injecte `@media print` qui masque TOC + sticky + boutons + couleurs,
  resserre typo 11pt, force `page-break-inside: avoid`. Query string
  `?print=1` déclenche `window.print()` côté client, `?pdf=1` preview
  sans dialog. Bouton "🖨 Imprimer / Exporter en PDF — {projet}".
- **Wizard de capture d'Intent** (#448) —
  `lib/dashboard/quick-capture.js` rend un formulaire 12 champs (id
  suggéré auto + titre + 5 sections canoniques + meta priority/owner/
  target) qui génère **live** un Markdown valide + une commande shell
  `cat > … <<EOF` prête à coller dans le terminal. Boutons "Copier
  Markdown" / "Copier commande shell" via `navigator.clipboard`.
- **Cumulative Flow Diagram** (#449) —
  `lib/dashboard/cumulative-flow.js` consomme les snapshots PM (#433)
  pour rendre un SVG empilé 720×280 par statut + table 5 dernières
  mesures. Vue Kanban classique : WIP qui gonfle / plateau done /
  backpressure draft.

Zéro modification de `render.js` (toujours 849/850 LOC). pm.html monte
à **28 sections** maintenant — couvre l'intégralité du workflow PM SDD.

### Ajouté — Dashboard PM cockpit export/notifs/activité (#444-#446, loop 9)

9ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues axées
partage stakeholders + signaux temps réel.

- **Export CSV des Intents** (#444) — `lib/dashboard/intents-csv.js`
  génère un CSV RFC 4180 inline 15 colonnes (id/titre/statut/priority/
  owner/sponsor/target/avancement/risk_level/…) avec escape strict +
  bouton "⬇ Télécharger" qui déclenche un download Blob côté client.
  Pour partager le catalogue avec stakeholders non-tech.
- **Sticky alert bar** (#445) — `lib/dashboard/sticky-alerts.js` agrège
  6 sources critiques (cycles deps + facts critiques + retards + urgents
  + zombies + drafts vieux) en un bandeau `position: sticky; top: 0`
  avec backdrop-filter. Préfixe `document.title` avec `(N)` quand N
  critiques > 0 pour faciliter le pinning d'onglet.
- **Activité récente** (#446) — `lib/dashboard/recent-activity.js`
  fusionne Intents+SPECs+facts par mtime desc avec format humain
  ("il y a 5 min" / "il y a 2 h" / "il y a 3 j"). Vue temporelle
  continue complémentaire au diff hebdo #433.

Zéro modification de `render.js` (toujours 849/850 LOC). pm.html monte à
**25 sections** maintenant (avec le bandeau sticky + activité récente +
export CSV ajoutés à l'orchestration de pagePm).

### Ajouté — Dashboard PM cockpit ergonomie/décision (#441-#443, loop 8)

8ᵉ boucle d'audit PM (2026-05-15) — pm.html ayant atteint 21 sections,
l'enjeu devient l'ergonomie. Le cockpit gagne 3 vues : navigation TOC,
arbitrage RICE, journal de décisions.

- **Sommaire latéral sticky** (#441) — `lib/dashboard/pm-toc.js` wrappe
  `pagePm` dans une grille 2 colonnes (responsive ≥ 1280px), génère un
  `<nav>` qui auto-tag les `<h2>` côté client (slugify + ids uniques) et
  highlight l'entrée visible via `IntersectionObserver`. **23 entrées
  TOC** sur le bench.
- **Matrice RICE / Impact × Effort** (#442) — `lib/dashboard/rice-matrix.js`
  score impact (priority/RICE/WSJF) et effort (SPECs liées + bonus
  contraintes lourdes RGPD/PCI). Classifie en 4 quadrants : quick-wins,
  big-bets, fill-ins, time-sinks. SVG 480×320 avec quadrants colorés,
  points cliquables vers fichier source, table compagnon.
- **Journal de décisions** (#443) — `lib/dashboard/decision-log.js`
  parse `## 7. Trade-offs et Décisions Clés` du PRD (look-ahead de
  séparatrice pour détecter l'en-tête peu importe ses cellules) et
  consolide les facts `/sdd fact`. Cards facts bordées par gravité.

Zéro modification de `render.js` (toujours 849/850 LOC). pm.html monte
à **23 sections** maintenant. Le `<nav>` TOC est généré côté client à
partir du DOM — pas de coupling serveur/client sur la liste.

### Ajouté — Dashboard PM cockpit lean product (#438-#440, loop 7)

7ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues lean product
(vitesse + risques + hypothèses), trinité canonique du PM Lean.

- **Vitesse de livraison / cycle time** (#438) — `lib/dashboard/cycle-time.js`
  consomme les snapshots PM (#433) pour calculer p50/p95/moyenne/min/max
  du lead time Intent capture → done. Grille KPI 6 colonnes + top 3 plus
  lents + top 3 en cours par âge.
- **Registre des risques** (#439) — `lib/dashboard/risks.js` combine
  frontmatter `risks:` / `risk_level:` (explicite) avec heuristique sur la
  section CONTRAINTES (15 mots-clés FR/EN classés en 6 catégories :
  Réglementaire/Accessibilité/Sécurité/Dépendance/Performance/Ressources).
  Niveau global = pire des niveaux. Cartes colorées par niveau.
- **Suivi des hypothèses produit** (#440) — `lib/dashboard/hypotheses.js`
  lit `hypothesis:` frontmatter (prime) ou section `## HYPOTHÈSE` du
  body. Statut `validated/invalidated/untested/partial` (aliases FR).
  Tri par priorité d'action : invalidées et partielles d'abord (à
  retraiter), puis non-testées, puis validées.

`lireIntents` étendu pour spread 15 nouveaux champs frontmatter (8 risk
+ 7 hypothesis). Zéro modification de `render.js` (toujours 849/850 LOC).
pm.html monte à **21 sections** maintenant.

### Ajouté — Dashboard PM cockpit ownership/bottlenecks (#435-#437, loop 6)

6ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues axées
sur les responsabilités humaines et la fluidité du pipeline.

- **Portefeuille par owner** (#435) — `lib/dashboard/ownership.js` lit
  9 alias frontmatter (`owner/pm/assignee/responsable/…`), construit map
  owner → portefeuille avec stats actifs/livrés. Cartes responsive avec
  bucket virtuel `_unassigned` orange pour les Intents sans owner.
- **Détection de goulots** (#436) — `lib/dashboard/bottlenecks.js`
  applique heuristique double : un statut est goulot SI compteur ≥ seuil
  ET au moins 1 item plus ancien que seuilAge (jours). Seuils par défaut
  adaptés Product Engineering (spec.review ≥ 3/7j, intent.draft ≥ 5/14j,
  etc.). Cartes orange par goulot avec liste des items les plus vieux.
- **Portefeuille par sponsor** (#437) — `lib/dashboard/sponsors.js` lit
  8 alias frontmatter (`sponsor/stakeholder/business_owner/…`), groupe
  par sponsor avec stats actifs/drafts/livrés colorées. Différencie un
  sponsor (exec finance/oriente) d'un owner (PM exécute) — cohérent
  RACI. Utile pour préparer 1:1 sponsor / COMEX.

`lireIntents` étendu pour spread 16 nouveaux champs frontmatter (9
ownership + 7 sponsor). Zéro modification de `render.js` (toujours 849/
850 LOC) — tout passe par `pm.js → pagePm` qui monte à 18 sections.

### Ajouté — Dashboard PM cockpit communication/temps (#432-#434, loop 5)

5ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues qui le
rendent **communicant** (brief export) et **temporel** (diff hebdo + deps).

- **Brief PM exportable** (#432) — `lib/dashboard/brief-pm.js` compose
  un Markdown ~30 lignes (état + alertes + top 3 + échéances + démo)
  rendu dans un `<pre user-select:all>` sur pm.html — 1 clic + Cmd+C
  copie dans Slack/email/Notion.
- **Diff "what changed this week"** (#433) — `lib/dashboard/pm-diff.js`
  persiste un snapshot `{intents/specs avec statut}` dans
  `.aiad/metrics/pm-snapshots/YYYY-MM-DD.json` à chaque génération du
  dashboard, puis compare avec celui d'il y a ~7 jours (tolérance ±2j).
  Sections "Intents capturés / Transitions Intent / SPECs créées /
  Transitions SPEC" avec badges `de → vers`.
- **Dépendances Intent** (#434) — `lib/dashboard/intent-deps.js` lit
  `depends_on:` / `blocked_by:` du frontmatter, construit le graphe
  inverse `bloque/bloquePar`, détecte les cycles A→B→A. Cartes
  Intents avec border-left coloré rouge cycle / orange bloqué actif
  (≥ 1 dépendance non livrée).

`lireIntents` étendu pour spread `depends_on/dependsOn/depends/
blocked_by/blockedBy` du frontmatter (cohérent avec extension #426/#427/
#428 de loop 3). Zéro modification de `render.js` (toujours 849/850 LOC).

### Ajouté — Dashboard PM cockpit rituels (#429-#431, loop 4)

4ᵉ boucle d'audit PM (2026-05-15) — le cockpit gagne 3 vues rituelles/
tactiques qui complètent les 3 vues stratégiques de la loop 3.

- **Préparer la démo** (#429) — nouveau `lib/dashboard/demo-readiness.js`
  qui lit la dernière démo (`/aiad demo` → `.aiad/metrics/demo/`) et rend
  une checklist Intents + SPECs livrés depuis + un script Markdown
  copy-paste prêt-à-coller dans la session démo (titre + sections livrées
  + bullet par item).
- **Drill-down par persona** (#430) — nouveau
  `lib/dashboard/persona-drill.js` qui group les Intents par statut
  (draft/active/done/archived) pour chaque persona PRD et calcule un état
  agrégé `orphelin/sous-servi/couvert/saturé` (≥3 actifs = WIP excessif).
  Cartes responsive sur pm.html avec border-left colorée.
- **Échéances Intent** (#431) — nouveau `lib/dashboard/deadlines.js` qui
  calcule `joursRestants` depuis `target_date` (ISO) ou fallback fin de
  quarter (`target: Q3-2026`). 6 buckets (retard/urgent/proche/planifié/
  sans-cible/livré). Sections actionnables sur pm.html avec format
  `J-N` ou `J+N en retard`.

### Ajouté — Dashboard PM cockpit stratégique (#426-#428, loop 3)

3ᵉ boucle d'audit PM (2026-05-15) — le cockpit passe de tactique
(loop 1+2) à stratégique : un PM peut prioriser, planifier la roadmap et
vérifier l'alignement Intent ↔ Outcome PRD entièrement depuis pm.html.

- **Priorisation Intent** (#426) — `lib/dashboard/intent-priority.js` avec
  4 schémas supportés (priority P0..P4, RICE, WSJF, wave) et comparateur
  canonique. Nouvelle section "Top priorités à travailler" sur pm.html +
  colonne "Prio" sortable sur intents.html. `lireIntents` étendu pour
  exposer le frontmatter pertinent (priority/target/personas/etc.) sur
  l'objet Intent.
- **Roadmap par trimestre** (#427) — `lib/dashboard/roadmap.js` parse
  `target` / `target_date` (formats `Q3-2026`, `2026-09-30`, etc.),
  bucketise sur 5 trimestres (1 passé / actuel / 3 à venir), rend une
  grille CSS responsive avec colonne actuelle mise en évidence + bannière
  "Intents sans cible".
- **Intent → Outcome mapping** (#428) — extension de `prd-coverage.js`
  avec une 3ᵉ dimension PRD : heuristique frontmatter `outcomes:` explicite
  + tokens significatifs (≥ 4 chars) + valeur cible numérique. Bug latent
  corrigé en chemin : la regex `PATTERN_SECTION` de `outcomes.js` ne
  tolérait pas le suffixe `(Mesurables)` du template officiel — étendue
  pour accepter parenthèses optionnelles.

### Ajouté — Dashboard PM cockpit étendu (#423-#425, loop 2)

Trio livré dans la 2ᵉ boucle d'audit PM (2026-05-15) — le cockpit PM gagne
3 vues qui rendent le dashboard utilisable comme **outil PM standalone**.

- **Couverture PRD** (#423) — nouveau parser `lib/dashboard/prd-coverage.js`
  qui lit `## Personas` et `## User Stories` du PRD et croise avec les
  Intents (frontmatter `personas:` / `user_stories:` explicite + heuristique
  multi-token sur le corpus Intent). Rendu : 2 tables sur `pm.html` montrant
  quelle promesse PRD est servie vs. orpheline.
- **Vélocité** (#424) — nouveau module `lib/dashboard/velocity.js` avec
  buckets Intents done par mois (6) et SPECs done par semaine (12), tendance
  up/down/flat calculée par split moitié récente / moitié ancienne, rendu
  2 mini bar charts SVG sur `pm.html`. Source : mtime filesystem (pas de
  snapshot historique nécessaire).
- **Recherche full-text Intent body** (#425) — la barre `qIntents` scanne
  désormais aussi le corpus des 5 sections (POURQUOI / POUR QUI / OBJECTIF /
  CONTRAINTES / CRITÈRE DE DRIFT) via un `data-search-blob` ajouté côté
  serveur + extension de `bindFilter` côté client.

### Ajouté — Dashboard PM cockpit (#420-#422)

Trio livré dans la boucle d'audit PM (2026-05-15) — un Product Manager peut
désormais piloter le SDD entièrement depuis le dashboard, sans ouvrir
manuellement les fichiers `.md`.

- **Parser sections d'Intent** (#420) — `lireIntents` expose désormais
  `sections: { pourquoi, pourQui, objectif, contraintes, critereDrift }`
  parsées depuis le corps Markdown (5 sections canoniques définies par
  `/sdd intent`). Insensible casse + accents, strip HTML comments du
  template, fail-safe (null si aucune section reconnue).
- **`intents.html` enrichi** (#421) — nouvelle colonne **Avancement** (barre
  de progression `done/total` colorée vert/orange/rouge), 5 chips de filtre
  rapide (Tous · Zombies · Drafts >14j · Sans SPEC · Sans livraison), et un
  `<details>` par row qui déroule les 5 sections de l'Intent. Bannière
  d'alerte PM en tête liant `pm.html`.
- **Page dédiée `pm.html`** (#422) — cockpit PM consolidé : à valider cette
  semaine + funnel Intent 5 étapes (Idea / Validated / In delivery / Done /
  Archived) + table alignement Intent ↔ Livraison + cheatsheet CLI 6
  commandes copy-paste. Lien `◑ PM Cockpit` ajouté à la nav latérale.

### Ajouté — Chaîne de publication dashboard (#228-#267)

Au-delà du cycle SDD, AIAD propose désormais une **chaîne complète de
publication** projet → README + GitHub Pages + Slack/Teams previews :

- **`brief` one-pager** (#228, #229) — consolide santé + maturité + top 3
  alertes focus + 3 derniers rituels en 1 écran ; `--strict=N` exit 1 si
  santé < N (CI gate).
- **`badge` SVG style shields.io** (#230-#232, #242) —
  `aiad-sdd badge [--type=...] [--all]` produit des badges README (santé,
  maturité, violations Tier 1). Auto-générés à chaque `dashboard` ;
  affichés dans `index.html` avec snippet markdown copy-paste.
- **GitHub Actions complet** (#233, #245, #251) — `ci-template github`
  installe 3 jobs : matrix 5-checks PR + quality gate `brief --strict=70`
  + commit badges + deploy GitHub Pages automatique.
- **6 forges CI/CD** (#235, #236) — github, gitlab (+ SARIF), jenkins,
  drone, bitbucket, azure (matrix 5-checks PR).
- **Publication artifacts** dans `dashboard/` : favicon SVG (#237),
  OG/Twitter meta + theme-color (#238), sitemap.xml + robots.txt (#239),
  og:url/og:image absolus (#240), PWA manifest (#241), `.nojekyll` (#243),
  CSP meta-tag (#244, #246), page 404.html stylisée (#249).
- **CI rapide** (#250, #251) — `dashboard --check` valide collect+render
  sans écrire de fichier ; intégré dans le matrix PR des 4 templates.
- **`data.json` slim** (#252) — troncature `matrice.gaps.codeSansSpec` à
  100 entrées (-85% de taille, ~860 KB → 137 KB). Sidecar `_total`.
  `--full` pour audit.
- **Bloc `_meta` partagé** (#253, #258, #259-#266) — `lib/meta.js`
  exporte `buildMeta({ schema, ... })` réutilisé par 9 commandes.
  Schémas distincts : `aiad-sdd-{dashboard, brief, doctor, status,
  workspace, trace, sovereignty, dora, hook-stats}` pour discrimination
  consumers génériques (Slack-bot, Notion sync, CI).
- **`standup --public-url`** (#256) — URLs Kanban Slack/Teams par lens.
- **MIME types serveur** (#257) — `.webmanifest`/`.xml` corrigés (PWA
  install Chrome strict + parsing sitemap conforme).
- **`brief --markdown`** (#269) — sortie Markdown pasteable Slack/Teams/
  Notion/PR avec table emojis 🟢🟡🔴, sections Focus + Rituels, callout
  strict fail. Précédence : `--json` > `--markdown` > texte.
- **`standup --all --markdown`** (#270) — bloc Markdown 5 rôles (PM/PE/
  AE/QA/TL) nommés en clair, table cliquable. Préfère `publicUrl` si
  défini (#256).
- **Dashboard footer + meta version** (#271, #272) — footer affiche
  "Framework AIAD v1.14.0" + lien aiad.ovh cliquable. `<meta name="aiad-version">`
  symétrique avec `aiad-generated-at` pour discovery DOM programmatique.
- **OpenAPI `AiadMeta` + wrap routes** (#273, #274) — schema `AiadMeta`
  ajouté à `components.schemas` avec enum strict des 9 sous-namespaces.
  Les 16 routes du catalogue wrap leur réponse via `allOf` pour requérir
  `_meta` → codegen consumers (openapi-generator, redoc, prism)
  génèrent des types qui valident `_meta` à la runtime.
- **Kanban search box** (#279) — input filtrant les SPECs par ID/titre
  (Cmd+F focus auto, ARIA dynamique), parité avec graph.html.
- **Brief enrichi** (#280-#283, #287, #288, #292, #293) — `counts.tests`
  (somme via qa.coverage), `counts.specsSansTests` (alerte CI), `sante.
  breakdown` (5 dimensions pour Slack-bot), `_meta.stale + ageHours`
  (consumer-friendly freshness check), markdown enrichi : footer date
  génération + callout `Focus dimension` (plus faible) + warning stale
  si âge > TTL (env `AIAD_DASHBOARD_TTL_HOURS`).
- **`badge --shields-endpoint`** (#284, #285) — JSON conforme spec
  shields.io pour live badge README via gist (sans re-commit). Mode
  `--all` produit un tableau de 3 endpoints (sante+maturité+violations).
- **Dashboard `--serve --port=0`** (#282) — port éphémère pour CI
  parallèles ; lit `server.address().port` après listen. Bug fondateur
  fixé : `Number(opts.port) || 8765` confondait 0 (legit) avec absent.
- **Dashboard auto-écrit `shields-endpoints.json`** (#289) — alongside
  les 3 SVG, prêt à push sur gist via CI workflow.
- **Templates CI commit-back shields-endpoints.json** (#290, #291) —
  GitHub Actions + Azure Pipelines commitent désormais les endpoints
  régénérés → chaîne live-badge end-to-end automatique.
- **Standup `--all --markdown`** (#270) — bloc Markdown 5 rôles
  pasteable Slack/Teams ; combinable avec `--public-url` (#256).
- **`brief --diff=<file>`** (#295) — comparaison vs snapshot précédent
  pour weekly trend ; markdown affiche arrows ↑↓→ par métrique.
- **`brief --strict-tests=N`** (#299) — CI gate sur nombre minimum de
  tests (parallèle à `--strict=N` santé). Cumulables.
- **`brief --markdown --public-url`** (#300) — footer Markdown hyperlien
  cliquable vers dashboard publié au lieu de backtick code.
- **`brief.counts.tests`** (#280) + **`counts.specsSansTests`** (#281) +
  **`sante.breakdown`** (#283) + **`_meta.stale + ageHours`** (#293) +
  footer date génération (#287) + callout Focus dimension (#288) +
  warning data stale TTL (#292) — brief désormais infographie one-shot
  signal-not-silence pour standup PM/Slack.
- **Pattern markdown étendu à 5 commandes** : `doctor --markdown` (#301),
  `status --markdown` (#302), `workspace --markdown` (#303) — tables
  pasteables PR/Slack/Notion avec emoji conditionnel par sévérité.
- **`_meta` étendu** (#296, #297, #298) — dashboard-check, standup,
  adrs, ci-template ajoutés à l'enum AiadMeta. Désormais **13 schémas
  distincts** discriminables par consumer générique.
- **Pattern `--quiet` étendu à 4 commandes** : `brief --quiet` (#306),
  `doctor --quiet` (#307), `workspace --quiet` (#308),
  `dashboard --serve --quiet` (#310) — Unix-conventional
  *quiet on success, loud on failure* : succès silencieux, exit code seul ;
  fail → stderr compact + exit 1.
- **Hyperliens `#LNN` sur les pages dashboard** (#309, #311, #314) —
  helper `lienSourceLigne(file, ligne)` + `lienSource(file, texte?)`
  partagent maintenant `hrefSource(file, ligne?)` (#313, DRY). Liens
  vers la ligne exacte appliqués à : ADRs (`L24` → `ARCHITECTURE.md#L24`),
  Drift ADR, Lessons/Human Learnings (AGENT-GUIDE.md#LNN),
  Tech-Debt JNSP markers (code source), Violations Tier 1, Edge-Cases QA
  (SPEC source). Tooltip hover, target=`_blank`.
- **Chaîne `--source-base` complète** (#312, #313, #315, #316, #317, #323) —
  CLI flag explicite (`--source-base https://github.com/o/r/blob/main`)
  ou valeur `auto` qui parse `git remote.origin.url` (github/gitlab/
  bitbucket reconnus), forme `auto:<branche>` pour cibler `main` /
  `develop` / un SHA précis au lieu de `HEAD`, ou fallback env
  `AIAD_SOURCE_BASE`. Le template GitHub Actions auto-câble l'env pour
  le job Pages deploy
  (`https://github.com/${{ github.repository }}/blob/${{ github.sha }}`).
  Audit complet : **0** `href="../FILE"` hardcoded restant dans
  `lib/dashboard/*.js` après #313 — tous les liens vers fichiers
  sources passent par `lienSource/lienSourceLigne/hrefSource`.
- **Dashboard 100% hypertextuelle** (#324, #325, #326, #327, #330, #331,
  #332, #333, #334, #335, #336) — chaîne `#309-#311` étendue de 5 à
  16+ pages : "Source : `<code>FILE</code>`" mentions hyperliées (ADRs
  KPI, Outcomes intro, Audit-trail intro, Learnings intro, Changelog
  header) ; traceability matrix (forward + backward) avec Intent/SPEC
  IDs + code/test paths cliquables vers la ligne exacte (`#L42`) ;
  catalogues intents.html + specs.html avec ID + cross-refs ("SPECs
  liées", "Intent parent") hyperliés ; pageOverview recentSpecs ; kanban
  cards `⤴ INTENT-N` + conflits filesShared ; governance Tier 1 agent
  IDs ; QA queue/coverage/EARS tables ; PM section "À valider cette
  semaine" via `idLien()` consolidé. Bench moyen : ~90 hyperliens.
  **Audit cumulatif `grep '<a href="../\${.*\.file' lib/dashboard/`** :
  0 occurrence hardcoded restante — tous les liens passent par
  `lienSource/lienSourceLigne/hrefSource` respectant `--source-base`.
- **`data.json` expose `sourceBase` + `publicUrl`** (#320) — consumers
  Slack-bot / Notion sync / audit scripts peuvent reconstruire les
  URLs hors HTML scraping. Symétrie complète avec `publicUrl` qui
  était déjà exposé depuis #240.
- **Verbose log unifié [origine]** (#321, #322) — lignes `Public URL …
  [CLI|env]` et `Source base … [CLI|env|auto]` dans le bloc verbose
  du dashboard pour diagnostiquer immédiatement la configuration des
  liens publication ; `--quiet` les supprime.
- **`--source-base` validé** (#337) — warning stderr si format non-URL
  absolue (`github.com/o/r/blob/main` sans `https://` → message
  actionnable avec hint `auto`).
- **Shell completion étendue** (#329) — `STRUCTURE_CMD` enrichi avec
  brief/standup/badge (absentes auparavant) + flags publication chain
  sur dashboard/doctor/workspace/status. `aiad-sdd brief --<TAB>`
  révèle désormais `--json --markdown --quiet --strict --strict-tests
  --diff --public-url --out`.
- **`publicationContext` exposé sur 4 sorties `--json`** (#339, #340,
  #341, #342) — `brief`, `doctor`, `status`, `workspace doctor`
  exposent uniformément `publicationContext: { sourceBase, publicUrl }`
  au top-level. Permet à un Slack-bot / Notion sync / audit script de
  reconstruire les URLs vers fichiers source sans re-lire `data.json`.
  Pour `workspace doctor`, publicationContext est exposé **par projet**
  dans `reports[]` (chaque sous-repo a son propre sourceBase).
- **`PublicationContext` documenté dans OpenAPI** (#343, #344, #345) —
  nouveau composant dans `COMPONENT_SCHEMAS` (sourceBase + publicUrl
  required, strings). CATALOGUE enrichi : nouvelles routes `/cli/brief`
  + `/cli/workspace/doctor` (manquaient depuis l'origine), $ref vers
  PublicationContext ajouté à `/cli/status` + `/cli/doctor` + brief +
  workspace doctor. Codegen TypeScript via `openapi-typescript` produit
  désormais types complets pour les 4 commandes consumer publication
  chain. 18 routes OpenAPI documentées au total (vs. 16 avant).
- **Pattern footer hyperlien dashboard** (#346, #347) — `doctor
  --markdown` et `status --markdown` ajoutent `[dashboard](URL/index.html)`
  au footer quand `publicationContext.publicUrl` est set (symétrie
  `brief --markdown` depuis #300). Fallback `\`aiad-sdd dashboard
  --serve\`` sinon. PR description / Slack post : reviewer 1 clic
  vers dashboard publié sans clone du repo.
- **Audit OpenAPI complet — 13/13 enum AiadMeta documentés** (#355-#367) —
  Audit systématique des schemas `lib/cli-schema.js` vs runtime réel.
  2 bugs majeurs corrigés : `dpia` et `status` routes avaient des schemas
  **complètement faux** (stubs initiaux jamais sync — fields déclarés
  n'existaient pas runtime). 13 items livrés : (a) TraceabilityMatrix
  shape complète (#355) ; (b) SovereigntyScore levelColor enum
  cyan/jaune/gris/rouge (#356) ; (c) AuditEvent required 3→7 fields +
  sig non-nullable (#357) ; (d) HookStats recent array (#358) ;
  (e) reflect raison field (#359) ; (f) SlaMatrix politique object
  + patchWindows type fix (#360) ; (g) LeadershipMetrics 4 sub-shapes
  détaillées (#361) ; (h) dpia refactor 6 props réelles (#362) ;
  (i) status refactor 8 props réelles (#363) ; (j) doctor compléter
  7 props (#364) ; (k) ajout routes dora record + import-git (#365) ;
  (l) ajout routes standup + standup-all (#366) ; (m) ajout route
  ci-template list (#367). 22 routes OpenAPI documentées au total.
  Pattern dual-validation : (1) unit test asserts schema shape ;
  (2) bench iter1 confirme runtime matches via `diff missing/extra`.
- **Dashboard 100% hypertextuelle — phase finale** (#349-#354) —
  6 derniers sites hyperliens livrés : (a) metrics.html tableauCats
  fichiers cliquables (#349) ; (b) dpo.html 2 tables SPEC IDs (#350) ;
  (c) adrs.html ID col + details summary (#351) ; (d) legal.html
  agents Tier 1 lookup (#352) ; (e) audit-trail Artifact path-like
  hyperlié (#353) ; (f) kanban conflits SPEC IDs + intent (#354).
  Bilan #309-#354 : 33 items hyperliens, ~95 hyperliens/bench moyen.
- **OpenAPI conformity test — boucle protectrice mature** (#373-#377,
  #379-#384, #387) — Test automatique `test/openapi-conformity.test.js`
  qui invoque chaque route du CATALOGUE en `--json` et applique
  **4 assertions** : (a) **subset** — `runtime keys ⊆ schema keys`
  (drift forward) ; (b) **required** — `schema.required ⊆ runtime keys`
  (drift backward) ; (c) **nested depth 1** — sub-keys d'objets imbriqués
  également contrôlés ; (d) **meta enum** — `_meta.schema` ∈ enum
  AiadMeta. Couverture complète via $ref resolution (#374),
  routes supplémentaires lecture-seule (#375 trace/audit verify/archive
  list, #382 audit log/pii-scan), fixtures tmpdir (#376 workspace doctor,
  #379 dora record, #380 dora import-git + schema enriched, #386
  workspace analytics), env override (#381 offline status), sbom inclus
  (#383). Pattern bench-driven validation : audits manuels #355-#372
  désormais auto-testés. Drift forward/backward/nested/meta impossible
  à introduire sans casser au moins 1 assertion.
- **🎉🎉 MILESTONE 300 boucles + 14 types-catalog convergent + 124 routes**
  (#479-#488, milestone boucle **300**) — Bond progressif **114 → 124
  routes** en 10 boucles + cap LOC 850 maintenu intégralement. **Types
  catalog 14× convergent** (devient un meta-pattern stable et reproductible-
  à-l'échelle) : archive types (#479), cert niveaux (#480), dinum
  criteria (#481), emit-rules runtimes (#482), sla policy (#483),
  gouvernance lint rules (#484), dora metrics (#485), bench metrics
  (#486), bench flow (#487), **cert valeurs (#488 — boucle 300, les 7
  valeurs fondamentales AIAD)**. Observabilité Dev complète sous
  OpenAPI : DORA (4 métriques) + Flow (5 métriques) + bench cold-start
  (6 métriques). Stack `cert` étendue à 7 routes : matrix + exam +
  badge + verify + axes + niveaux + valeurs — couvre 100% de
  l'enseignable AIAD (5 niveaux × 6 axes + 7 valeurs). Stack `bench`
  étendue à 5 routes. Stack `dora` étendue à 5 routes. Stack `dinum`
  étendue à 4 routes. **60+ boucles consécutives à 1 route/boucle
  sans rupture** depuis boucle 240. Bug-fix collatéral 4ᵉ source
  archive `detecterSousDossier` (INTENT-NNN). Refactorings DRY libs :
  archive.js TYPES_ARTEFACTS exportée, dinum.js COMMUN_NUMERIQUE_
  CRITERES exportée, emit-rules.js RUNTIMES_VALIDES exportée.
  Compactages systématiques : workspace doctor, refactor-spec,
  marketplace list, archive, ci-template, bench compare, cert badge,
  ai-act audit, rbac whoami, migrate-v2, dinum check — file maintenue
  842-849 LOC.
- **Pattern discovery-info convergé + types-catalog convergé — 10 routes
  ajoutées en 10 boucles** (#469-#478, milestone boucle **290**) — Deux
  patterns systémiques apparaissent et convergent simultanément : (a)
  **discovery info** (sous-verbe positionnel `info <id>` retournant
  `{ id, found, available[], <entity>: {...} }`) appliqué à **8 routes
  consécutives** : plugin info, marketplace info, gouvernance info,
  template info, new info, ci-template info, tutorial info, github-app
  info ; (b) **types catalog** (sous-verbe positionnel `types`
  retournant un enum strict + total) appliqué à **4 routes** :
  webhooks types (10 events), audit types (5 actions), dora types (3
  statuses), cert axes (6 axes). Une 14ᵉ route conserve la forme types
  via `--list` legacy (`completion --list`). Stack `cert` étendue à 5
  routes (matrix/exam/badge/verify/axes), stack `audit` complète à 4
  (log/verify/append/types), stack `dora` complète à 4
  (list/record/import-git/types). LOC effective 842-849 sur 114 routes
  vs 850 cap = **×9.5 garanties** depuis baseline 175. Refactorings
  lib mineurs (DRY) : `audit.js` extrait `ACTIONS_VALIDES`, `dora-
  record.js` extrait `STATUTS_VALIDES`, `score.js` extrait `VERDICTS`.
  **Aucune rupture de cadence depuis boucle 240** (50+ boucles
  consécutives à 1 route/boucle).
- **🎉 MILESTONE 100 ROUTES CATALOGUE + multi-forge complet + bug-fix
  INTENT-NNN tri-source** (#458-#468, milestone boucle **280**) — Bond
  spectaculaire de 94 → 104 routes en 10 boucles consécutives. **3
  stacks multi-forge entièrement sous OpenAPI** : (a) **GitLab** review
  + issue --dry-run + wiki --dry-run (3 routes) ; (b) **Bitbucket** pr
  + issue --dry-run (2 routes) ; (c) **Azure DevOps** pr + work-item
  --dry-run + wiki --dry-run (3 routes). **Bug-fix tri-source** :
  `intentVersIssue` / `intentVersWorkItem` rejetaient le format AIAD
  canonique `INTENT-NNN` (3 emplacements distincts : gitlab.js,
  bitbucket.js, azure-devops.js) — regex unifiée à
  `/^(INTENT|INT)-\d+/i` partout, débloque l'export depuis les fichiers
  bench standards. **Stack `cert` complète** : exam + matrix + badge +
  verify = 4 routes. **Stack `org` complète** : show + check + init
  --dry-run = 3 routes. **🎯 MILESTONE 100 atteinte boucle 276** (route
  #464 cert matrix). **2 nouveaux patterns ad-hoc** : (d) **collision
  flag → sous-verbe positionnel** (#466 hooks status — `--status`
  collidait avec flag dora) ; (e) **discovery avec variant
  found/not-found + agents** (#468 gouvernance info — pattern réutilisé
  de plugin info/marketplace info). Compactages systématiques : ~12
  schemas (workspace doctor, badge, dpia, adrs, audit log, audit
  verify, standup all, archive --list, sla update, spec-version
  check/bump, restore, pii-scan, ci-template list, standup, plugin
  list, telemetry status, dora record/import-git, backup, marketplace
  info, github-app setup/install, workspace analytics ×12→3 — biggest
  win). LOC effective 841-849 sur 104 routes vs 850 cap = ×8.7
  garanties depuis baseline 175.
- **Pattern feature-then-route — 14 applications consécutives**
  (#441-#458, milestones boucles 260 + **270**) — Le modèle inédit de la
  boucle 260 (#441-#447, 7 applications) s'est étendu sans rupture sur
  les boucles 261-270 : **+7 nouvelles applications consécutives** —
  #448 bench history, #449 offline log, #450 plugin info, #451 emit-
  rules --check, #452 docs --check, #453 update --check, #454 migrate,
  #455 completion --list, #456 provenance sigstore, #457 gitlab issue
  --dry-run. Total **14 applications consécutives** sans exception du
  modèle "ajoute la feature `--json` manquante + documente la même
  boucle". 3 sous-patterns émergent : (a) **monkey-patch console.log**
  pour wrappers à 10+ console.log internes non-refactorables (emit-
  rules, docs, update — 3 occurrences) ; (b) **filtrage sérialisation**
  pour fonctions retournant des objets avec callbacks (migrate, #454) ;
  (c) **mode list ad-hoc** pour commandes générant des artefacts non-
  JSON (completion --list, provenance sigstore avec script-as-JSON).
  **Modèle reproductible-à-l'échelle confirmé sur 14 itérations** : la
  cadence reste à 1 route/boucle ininterrompue depuis la boucle 240.
- **Pattern feature-then-route inédit — 7 applications consécutives**
  (#441-#447, milestone boucle 260) — Évolution majeure du modèle boucle
  agentic : au lieu de simplement documenter des features `--json`
  existantes, la boucle **ajoute la feature `--json` manquante** puis la
  documente immédiatement (modif `lib/` + `bin/` + CATALOGUE + test
  conformity dans la même boucle). 7 applications consécutives sans
  exception : #441 marketplace list, #442 marketplace info, #443
  gouvernance --list, #444 template --list, #445 new --list, #446
  hooks-init (4ᵉ utilisateur DryRunPathResult), #447 dora --list
  (création d'une nouvelle sous-action). **9 catalogues de discovery**
  désormais sous contrat OpenAPI : marketplace list/info, gouvernance
  --list (15 packs), template --list (9 templates SPEC), new --list
  (2 templates projets), tutorial (4 tutoriels), plugin list, skills
  validate, ci-template list, storybook (32 commandes slash). **Modèle
  reproductible-à-l'échelle validé** : tant qu'il existe une commande
  CLI sans `--json`, elle peut être ajoutée + documentée en 1 boucle.
- **Élargissement CATALOGUE — github-app + archive lifecycle complet +
  pattern feature-then-route systémique** (#439-#447, milestone boucle
  260) — 9 items numérotés, **+10 routes effectifs** (#439 ajoute 2
  routes) : (a) **#439 GitHub App** — github-app setup (discovery) +
  install (writer idempotent) avec double enum strict (artefact ×2 +
  action ×3) ; (b) **#440 archive --restore** — complète la stack
  archive (archive --list reader + archive writer + archive --restore
  un-archive), 4ᵉ chain test crypto round-trip ; (c) **#441-#447
  pattern feature-then-route** (cf. puce précédente) — 7 nouvelles
  features `--json` ajoutées au CLI et documentées en 7 boucles
  consécutives. **Couverture CATALOGUE** : 74 → **84 routes** (+14% en
  10 boucles, +163% depuis boucle 200 où on était à ~32 routes).
- **MILESTONE 90 ROUTES franchie** (#454 boucle 266, **94 routes**
  boucle 270) — Surface protectrice à 90 × 4 = 360 garanties (boucle
  266), puis 94 × 4 = **376 garanties** anti-drift (boucle 270). Facteur
  ×7.8 depuis boucle 175 (48 garanties initiales). Bug-fix collatéral
  boucle 270 (#458) : `intentVersIssue` (gitlab.js + bitbucket.js)
  acceptait uniquement `INT-NNN` alors que la convention AIAD canonique
  est `INTENT-NNN` — regex élargie à `/^(INTENT|INT)-\d+/i`, débloque
  l'export Issue/PR depuis Intents au format standard. Compactage
  parallèle systématique poursuivi sur ~6 schemas supplémentaires
  (workspace doctor, badge, dpia, adrs, audit log, standup all, archive
  --list, sla update, spec-version check, restore, plugin info). File
  maintenue 847-849 LOC effectives au cap exact malgré +10 routes.
- **MILESTONE 80 ROUTES franchie** (#443 boucle 255) — Surface
  protectrice à 80 × 4 = 320 garanties (boucle 255), puis 84 × 4 =
  **336 garanties** anti-drift (boucle 259). Facteur ×7.0 depuis boucle
  175 (48 garanties initiales). Compactage parallèle systématique
  poursuivi sur ~10 schemas supplémentaires (storybook, verify-
  reproducibility, obsidian, restore, plugin list, dora ×2, status,
  doctor, dpia, adrs, reflect, dashboard check, bench, ci-template list,
  marketplace list/info, gouvernance --list, template --list, new --list,
  webhooks list, offline status, archive --restore, etc.). File maintenue
  ~845-850 LOC effectives au cap exact.
- **DryRunPathResult composant le plus partagé** (#446) — 4 routes
  utilisent désormais ce composant via `$ref` : rbac init (#431),
  dinum publiccode (#436), dinum franceconnect (#436), **hooks-init
  (#446)**. Pattern factorisation $ref optimal — 1 drift composant = 4
  fails simultanés (signal univoque, économie ~12 LOC vs 4 schemas
  inline). Le composant le plus partagé désormais après ReviewCommentPayload
  (#433, 3 routes) et FileDiff (#432, 2 routes).
- **Stacks complètes sous contrat OpenAPI** (#447) — Plusieurs stacks
  ont franchi la complétude 100% sous contrat : **DORA** (record +
  import-git + list), **marketplace** (list + info), **gouvernance**
  (--list + lint), **archive** (--list + writer + --restore), **github-
  app** (setup + install). Stack toolkit AIAD désormais quasi-exhaustive
  sous OpenAPI.
- **Élargissement CATALOGUE — interop multi-cible + PR-bot multi-forge +
  CI/CD + DINUM FR + lifecycle artefact + factorisation $ref systémique**
  (#429-#437, milestone boucle 250) — **+10 routes effectifs en 9 boucles**
  (certaines #IDs ajoutent plusieurs routes — pattern multi-add inédit) :
  (a) **interop multi-cible export** (#429 export confluence, ajout du
  2ᵉ format export après openapi #427) — couvre désormais OpenAPI 3.1
  (machine codegen) + Confluence (wiki entreprise) + Obsidian (knowledge-
  base personal) + GitHub Pages (publication HTML) ; (b) **PR-bot
  multi-forge complet** (#432 review source + #433 gitlab review +
  bitbucket pr + azure pr posters) — pattern factorisation $ref appliqué
  rétroactivement avec composant **ReviewCommentPayload** (16ᵉ schema
  réutilisable partagé par 3 routes — 1 drift = 3 fails simultanés) ;
  (c) **CI/CD complet** (#434 bench compare régression perf + #435
  ci-template install workflow forge avec enum 6×3) ; (d) **stack DINUM
  FR complète** (#436 dinum publiccode + dinum franceconnect rejoignent
  dinum check #393) — composant **DryRunPathResult** (17ᵉ) factorisé
  rétroactivement avec rbac init #431 → 3 routes partagent le même
  payload `{path, dryRun}` ; (e) **lifecycle artefact** (#437 archive
  writer rejoint archive --list #372 reader) ; (f) **RGPD complète**
  (#430 anonymize k-anonymity/Laplace DP rejoint dpia + pii-scan +
  ai-act audit + dinum check). **Couverture CATALOGUE** : 64 → **74
  routes** (+16% en 10 boucles, +131% depuis boucle 200 où on était à
  ~32 routes). **Composants réutilisables** : 14 → **17 schemas** (+3
  components en 10 boucles : FileDiff #432, ReviewCommentPayload #433,
  DryRunPathResult #436).
- **Pattern factorisation $ref systémique** (#432/#433/#436) — 3
  nouveaux composants partagés en 10 boucles, dont **3 routes** chacun
  pour ReviewCommentPayload et DryRunPathResult. Le pattern devient
  systémique : dès que ≥ 2 routes ont la même shape, extraction
  immédiate. **Refactor rétroactif rbac init** (#436) prouve que les
  routes inline peuvent être migrées au pattern $ref sans casser le
  contract (drift assertion détecte la régression si shape diverge).
  Pattern multi-ajout boucle (#433 ajoute 3 routes en 1 boucle, #436
  ajoute 2 routes + 1 refactor) — efficacité boucle agentic ×3.
- **MILESTONE 70 ROUTES franchie** (#434 boucle 246) — Surface
  protectrice à 70 × 4 = 280 garanties (boucle 246), puis 74 × 4 =
  **296 garanties** anti-drift (boucle 249). Facteur ×6.2 depuis boucle
  175 (48 garanties initiales). Compactage parallèle systématique
  poursuivi sur ~15 schemas supplémentaires cette période (status,
  doctor, dpia, adrs, sla×3, audit ×3, webhooks list, offline status,
  dashboard check, bench, ci-template list, standup ×2, dora ×2,
  Leadership-Metrics, JnspVerdict, WebhooksEmission, etc.) — file
  maintenue ~846-850 LOC effectives au cap exact malgré +10 routes
  ajoutées.
- **Fixture pattern étendu — 18 routes** (#430, #432, #437 entre
  autres) — workspace doctor/trace/analytics, dora record/import-git,
  tour, audit append, spec-version check/bump, restore, provenance
  generate/verify, cert badge/verify, refactor-spec, anonymize, review,
  gitlab review, bitbucket pr, azure pr, **archive**. **3 chain tests
  crypto round-trip** (backup→restore #416, provenance generate→verify
  #420, cert badge→verify #422) + **2 chain tests git fixture** (dora
  import-git #380, review #432, gitlab/bitbucket/azure review #433).
- **Élargissement CATALOGUE — supply chain + certification +
  qualité SPEC + knowledge-base interop + dual OpenAPI** (#419-#427,
  milestone boucle 240) — 9 nouvelles routes en 9 boucles, élargissement
  thématique 5 piliers : (a) **stack supply chain security complète
  100% sous contrat OpenAPI** — #419 provenance generate (SLSA Provenance
  v1.0 signée HMAC-SHA256, AIAD_PROVENANCE_SECRET env), #420 provenance
  verify (chain test #2 generate→verify, signature + digests sha256),
  #425 verify-reproducibility (content hash sha256 déterministe
  cross-Node/cross-OS pour npm pack reproductible) — combinée avec
  `sbom` (#383 CycloneDx) + `audit append/log/verify` = supply chain
  niveau SLSA Level 3 attestable bout-en-bout ; (b) **stack certification
  écosystème ouvert** — #421 cert badge (JWS HMAC-SHA256, enum 5 niveaux
  Découvreur/Praticien/Confirmé/Expert/Architecte, 6 axes, valide 3 ans),
  #422 cert verify (chain test #3 badge→verify, vérifiable hors-ligne
  par tout HR/marketplace) — pattern verifiable credentials sans
  blockchain ; (c) **stack qualité SPEC complète** — #423 refactor-spec
  (détection oversize + propose découpage structurel/sémantique) +
  spec-version check/bump (déjà livrés #413/#414) = qualité SPEC 100%
  automatisable ; (d) **interop knowledge-base** — #424 obsidian
  (export `.aiad/` vers Obsidian Vault avec wiki-links + MOC + README,
  multi-variant dry-run/apply/aiad-absent) ; (e) **dual OpenAPI** —
  #427 export openapi (export OpenAPI 3.1 depuis SPECs marquées api:true)
  rejoint #404 schema (méta-route OpenAPI du CLI lui-même) = 2 facettes
  OpenAPI complémentaires sous contrat. **Bonus** : #426 storybook
  (inventaire 32 commandes slash sdd+aiad) complète la stack discovery
  écosystème. **Couverture CATALOGUE** : 53 → **62 routes** (+17% en
  10 boucles, +91% depuis boucle 200 où on était à ~32 routes).
- **MILESTONE 60 ROUTES franchie** (#425 boucle 237) — Surface protectrice
  passée de 50 × 4 = 200 garanties (boucle 226) à 60 × 4 = 240 garanties
  anti-drift (boucle 237), puis 62 × 4 = **248 garanties** (boucle 239).
  Facteur ×5.2 depuis boucle 175 (48 garanties initiales). Compactage
  parallèle systématique poursuivi sur ~10+ schemas supplémentaires
  cette période (adrs, plugin list, restore, badge, sla update, tour,
  doctor --fix, ai-act audit, self-update, migrate-v2, dinum check) —
  file maintenue ~850 LOC effectives au cap exact malgré +9 routes
  ajoutées.
- **3 chain tests crypto round-trip** (#416/#420/#422) — pattern
  fixture chain `writer → reader` validé sur 3 stacks indépendants :
  **backup→restore** (#416, 1ʳᵉ), **provenance generate→verify** (#420),
  **cert badge→verify** (#422). Chaque test orchestre 2 commandes
  successives dans le même tmpdir avec env override (ou même secret)
  pour valider qu'un payload émis par le writer est correctement
  consommé par le reader (round-trip cryptographique testable
  bout-en-bout — preuve concrète que la paire signée tient).
- **Fixture pattern étendu — 15 routes** (#421, #422, #423 entre
  autres) — workspace doctor/trace/analytics, dora record/import-git,
  tour, audit append, spec-version check/bump, restore, provenance
  generate/verify, cert badge/verify, refactor-spec. **4 routes
  utilisent env override** (offline status, provenance generate/verify,
  cert badge) — pattern stable pour les routes nécessitant un secret
  partagé entre commandes successives.
- **Élargissement CATALOGUE — release-lifecycle + disaster recovery +
  écosystème pédagogique + factorisation components** (#409-#417,
  milestone boucle 230) — 9 nouvelles routes en 9 boucles, élargissement
  thématique 4 piliers : (a) **stack release-lifecycle complète** —
  #409 sla check (validation matrice SLA, $ref SlaMatrix), #410 sla update
  (writer SECURITY.md, enum action created/updated/appended), #413
  spec-version check (semver validation multi-variant neuf/existant),
  #414 spec-version bump (writer frontmatter avec enum kind major/minor/
  patch) — versioning sémantique 100% automatisable du gate CI au commit
  auto ; (b) **stack disaster recovery testable round-trip** — #415 backup
  (archive .aiad-backup chiffrée AES-256-GCM, 5 props), #416 restore
  (decrypt + extract, fixture chain backup→restore — **1ʳᵉ chain test
  orchestrant 2 commandes**) ; (c) **écosystème pédagogique + branding** —
  #411 badge (SVG README santé/maturité/violations, type enum 3 valeurs),
  #412 tutorial (catalogue 4 tutoriels auth-oidc/payment-pci/rag-llm/
  gdpr-data-export) ; (d) **factorisation $ref components** — #417
  webhooks emit nouveau + extraction component **WebhooksEmission (14ᵉ
  composant réutilisable)** partagé avec webhooks test — 1 drift dans le
  shape webhook = 2 fails simultanés (signal univoque). **Couverture
  CATALOGUE** : 44 → **53 routes** (+20% en 10 boucles, +51% depuis
  boucle 210). **Composants réutilisables** : 13 → **14 schemas** (1ʳᵉ
  nouveau component depuis #383 CycloneDxSbom).
- **MILESTONE 50 ROUTES franchie** (#414 boucle 226) — Surface protectrice
  passée de 16 routes × 3 = 48 garanties (boucle 175) à 50 × 4 = 200
  garanties anti-drift (boucle 226) — **facteur ×4.2 en 50 boucles**.
  Compactage parallèle systématique sur 10+ schemas (status, doctor,
  workspace ×3, AuditEvent, ArchivedArtifact, ReflectAxis,
  WebhookSubscription, PublicationContext, TraceabilityMatrix, SlaMatrix,
  SovereigntyScore, JnspVerdict, LeadershipMetrics, AiadMeta, brief,
  reflect, webhooks list, offline status, dashboard check, bench,
  ci-template list, dpia, ai-act audit, schema, doctor --fix, dinum check,
  rbac whoami/check, skills validate, gouvernance lint, org show/check,
  standup, dora ×2, telemetry status, plugin list, tutorial — **~40
  schemas compactés**) — file maintenue ~822-850 LOC effectives malgré
  +18 routes ajoutées.
- **Fixture pattern systématisé — 10 routes** (#413, #414, #416 entre
  autres) — workspace doctor/trace/analytics, dora record/import-git,
  tour, audit append, spec-version check, spec-version bump, restore. La
  fixture chain `backup → restore` (#416) est **inédite** : 1ʳᵉ fois
  qu'un test conformity orchestre 2 commandes successives dans 2
  tmpdirs distincts pour valider un round-trip bout-en-bout.
- **Drift réel détecté par la boucle conformity** (#407, milestone boucle
  220) — l'ancienne déclaration `AuditEvent.properties.sig = { type:
  'string' }` (commentée "absent si non signé") était fausse :
  `lib/audit.js#L199` émet **TOUJOURS** `event.sig = null` quand pas de
  secret HMAC. La boucle conformity sur `audit append` (route nouvellement
  ajoutée) a fait remonter la divergence runtime ↔ schema. Fix : `sig`
  corrigé à `['string', 'null']`, test #357 mis à jour avec commentaire
  explicatif. **Preuve concrète du bénéfice de la boucle protectrice** :
  44 routes × 4 assertions attrapent les divergences source-vérité ↔ doc
  même quand elles vivent depuis plusieurs releases (sig était documenté
  ainsi depuis #357, boucle ~169).
- **Élargissement CATALOGUE — stack multi-tenant ESN + extensibilité +
  méta-routes + fixtures** (#399-#407, milestone boucle 220) — 9 nouvelles
  routes en 9 boucles, élargissement thématique 4 piliers : (a) **stack
  RBAC + multi-tenant** complète — #399 rbac check (gardien pre-commit
  owner/reviewers), #401 org show (lecteur config org-wide), #402 org check
  (vérification conformité projet vs policies) ; (b) **extensibilité
  écosystème** — #400 skills validate (.claude/skills/ frontmatter + body),
  #407 audit append (writer audit-trail crypto-signé) ; (c) **méta-routes
  auto-descriptives** — #403 doctor --fix (pattern flag-based comme
  archive --list, kind enum 3 valeurs), #404 schema (route OpenAPI generator
  qui se documente elle-même — paradoxe self-reference résolu) ; (d)
  **fixture pattern systématisé** — #405 tour (créé .aiad-tour/), #407
  audit append (créé .aiad/audit/audit.jsonl). **7 routes utilisent
  désormais le fixture pattern tmpdir** : workspace doctor/trace/analytics,
  dora record/import-git, tour, audit append. **Couverture CATALOGUE** :
  35 → **44 routes** (+26% en 10 boucles). **Stack multi-tenant ESN/grand
  groupe 100% sous contrat OpenAPI** : `org show/check` + `workspace
  doctor/trace/analytics` + `rbac whoami/check` + `gouvernance lint`.
- **Conformity coverage 100% — 44 × 4 = 176 garanties anti-drift**
  (#399-#407) — passage de 35 routes (boucle 210) à 44 routes (boucle 220)
  en 10 boucles. **MILESTONE 40 routes franchie** à boucle 215 (#403).
  Compactage parallèle systématique à chaque ajout (status+doctor #400,
  workspace doctor/trace/analytics #402, AuditEvent+ArchivedArtifact+
  ReflectAxis+WebhookSubscription #403, PublicationContext+
  TraceabilityMatrix #404, SlaMatrix #406) — total ~50 LOC libérés sur la
  période, file maintenue sous cap 850 LOC effectives.
- **Élargissement CATALOGUE — pattern multi-verbe systématisé** (#389-
  #397, milestone boucle 210) — 9 nouvelles routes ajoutées en cadence
  1 par boucle : (a) **#389 workspace trace** — matrice cumulée
  cross-projet avec $ref vers TraceabilityMatrix (3 sous-verbes
  workspace désormais : doctor/trace/analytics) ; (b) **#390 gouvernance
  lint** — cohérence des références agents AIAD (conflits, doublons,
  manquants) ; (c) **#391 telemetry status** — config opt-in RGPD-
  compliant (anonymousId, endpoint, localLog) ; (d) **#392 self-update** —
  comparaison registry npm vs locale (enum status 4 valeurs : up-to-date/
  update-available/ahead/unknown) ; (e) **#393 dinum check** — score
  Commun Numérique de l'État FR (9 critères code.gouv.fr, sub-shape
  criteres.items {critere,label,ok}) ; (f) **#394 migrate-v2** —
  squelette migration AIAD v1 → v2 (dry-run + apply, sub-shapes
  detection/plan/appliquees/erreurs) ; (g) **#395 ai-act audit** —
  Annexe IV Règlement (UE) 2024/1689 EU AI Act (sub-shapes specs/code/
  summary) ; (h) **#396 rbac whoami** — identité git + équipes RBAC ;
  (i) **#397 plugin list** — plugins AIAD installés (sub-shape items
  6 props). **Couverture CATALOGUE** : 26 → **35 routes** (+34%).
  **Stack compliance EU Tier 1 100% sous contrat OpenAPI** :
  `ai-act audit` + `dpia` + `dinum check` + `sovereignty` + `gouvernance
  lint` couvrent désormais toute la chaîne réglementaire FR/EU. **Pattern
  multi-verbe** : 13 routes utilisent désormais `<command> <subverb>` —
  cohérent avec les architectures REST sub-resources.
- **Conformity coverage 100% — 35 × 4 = 140 garanties anti-drift**
  (#389-#397) — chaque ajout de route au CATALOGUE est immédiatement
  doublé dans `SAFE_INVOCATIONS` du test conformity. Le boucle protectrice
  reste à 4 assertions par route mais la surface explose : passage de
  26 routes (boucle 200) à 35 routes (boucle 210) en 10 boucles
  agentic. **Compactage parallèle systématique** : à chaque nouvelle
  route, un autre schema verbeux est inliné (dpia #394, ci-template list/
  standup/dora record/dora import-git #395, adrs/pii-scan #392) pour
  rester sous le cap effectif 850 LOC.
- **Bench fixtures restaurés** (#392) — 5 fichiers manquants du bench
  `bench/scenario-autonomous-run/url-shortener/` (`scripts/start-bench.sh`,
  `scripts/test-compose-prod.sh`, `Dockerfile`, `.dockerignore`,
  `docker-compose.yml`, `docker-compose.prod.yml`) recréés depuis les
  assertions des tests #172/#179/#180/#186. 15 tests bench fixture
  restorés à vert. La sandbox de validation 3-iter par boucle est à
  nouveau pleinement opérationnelle.
- **Routes supplémentaires au CATALOGUE** (#385, #386) — bench
  (métriques routers v1.7) et workspace analytics (cross-org sovereignty/
  velocity/drift). 24 → 26 routes documentées.
- **Audits finaux composants** (#370, #371) — SovereigntyScore 5
  dimensions sub-shapes détaillées (juridictions/agentsTier1/langueFr/
  autorites/hebergement, parallèle #361 LeadershipMetrics) ;
  workspace doctor summary.totals (cumul cross-projet intents/specs/gaps).
- **Schemas additionnels** (#372, README #369) — dashboard check route
  ajoutée (`{ ok, errors[], pages[] }`) ; README "Publication & CI"
  mentionne désormais OpenAPI 3.1 (22+ routes, 13 composants, codegen
  TypeScript via openapi-typescript). cli-schema.js compacté à 850 LOC
  pile (hard cap).
- **POSIX trailing newline** (#305) — `data.json`, `shields-endpoints.json`,
  `trace.json` se terminent désormais par `\n` (cohérence `git diff`,
  parsers stricts).

### Corrigé

- **#234** — message d'install `ci-template` hardcodé Jenkins → regex
  `extraireCommandes` extrait les vraies commandes par template.
- **#246** — CSP de #244 cassait onboarding/kanban/graph (règle
  `'unsafe-inline'` ignoré si hash présent). Fix pragmatique.
- **#248** — SRI integrity hash D3 obsolète → retrait + procédure pin
  documentée.
- **#255, #264, #265** — drifts doc : FORGES descriptions, help text
  `ci-template` (3 forges au lieu de 6), DOCUMENTATION.md désynchronisée.
- **#275** — `aiad-sdd --version`/`-v` imprimaient le help complet (167
  lignes) au lieu de la version. Bug d'ordre des court-circuits dans
  `main()` ; `command === undefined` matchait help branch avant version.
- **#276** — `aiad-sdd <cmd> --help` imprimait le help global au lieu
  de la section spécifique. Nouvelle façade `extraireAideCommande(aide,
  command)` parse AIDE pour la ligne descriptive + section Options.
  Pattern UX cohérent avec `npm`/`git`/`cargo <cmd> --help`.
- **#277** — `aiad-sdd workspace` sans sous-commande déclenchait erreur
  config trompeuse. Désormais usage propre (cohérent gitlab/azure).

### Ajouté — Garde-fou JNSP (« Je Ne Sais Pas »)

Contrat structurant qui autorise et oblige l'agent à dire « je ne sais
pas » plutôt qu'à inventer. Couvre 5 couches :

- **Source de vérité** — nouvelle section `### INCERTITUDE` dans
  `templates/.aiad/AGENT-GUIDE.md` et politique fail-closed dans
  `templates/.aiad/gouvernance/_index.md` (verdict `UNKNOWN` Tier 1 =
  VETO par défaut).
- **Multi-runtime** — `lib/emit-rules.js` propage automatiquement la
  consigne à `AGENTS.md`, `.cursor/rules/aiad.mdc`, `.codex/AGENT.md`,
  `GEMINI.md` et au header `CLAUDE.md` géré. Fallback intégré quand le
  template projet n'a pas encore la section.
- **Commandes /sdd** — `intent`, `spec`, `gate`, `exec`, `validate`,
  `security`, `drift-check`, `resume` ajoutent un verdict tri-état
  (PASS / FAIL / JNSP). La Gate sort en `INCONNUE` (fail-closed) si ≥ 1
  critère SQS n'est pas scorable. Le prompt agent assemblé par
  `/sdd exec` autorise le marqueur `// TODO-JNSP:` dans le code.
- **Skills** — `sqs-scoring`, `drift-detection`, `ears-validator`,
  `regulatory-veto`, `traceability`, `context-budget`,
  `human-authorship-check` passent en sortie tri-état.
- **Hooks** — `templates/.aiad/hooks/pre-commit.sh` bloque tout diff
  staged contenant un `TODO-JNSP:` non résolu (mode `block`) ou avertit
  en mode `warn`. `templates/.aiad/hooks/session-start.js` affiche un
  rappel à chaque démarrage de session.
- **CLI** — convention `EXIT_JNSP = 2` documentée dans l'aide
  `aiad-sdd --help`. Schéma OpenAPI `JnspVerdict` ajouté à
  `lib/cli-schema.js` pour les consommateurs externes (`--json`).

### Corrigé

- `lib/emit-rules.js` : remplacement de la fausse ancre regex `\Z`
  (interprétée comme caractère littéral `Z` en JavaScript) par `$`. Le
  bug masquait l'extraction quand un bloc terminait sans `###` suivant —
  désormais l'extracteur capture correctement la dernière sous-section
  des règles absolues.

## [1.14.0] — 2026-05-10

### 🎯 Cap stratégique

Cette version franchit un palier fondation **et produit** pour positionner
`aiad-sdd` comme **leader européen des frameworks de développement basés sur
l'intention**. 46 items livrés sur 2 phases, 323 tests automatisés, zero-dep
runtime préservé.

### Nouvelles commandes

- **`aiad-sdd ai-act audit`** — pré-remplit la documentation **Annexe IV** du
  Règlement (UE) 2024/1689 sur les 8 sections requises. Aucun autre framework
  SDD ne génère ce rapport. Argument unique sur le marché EU pour les systèmes
  IA haut risque.
- **`aiad-sdd workspace [doctor|trace]`** — mode multi-projet pour ESN et
  grands groupes EU. Lit `aiad-workspace.json`, agrège la santé / Intents /
  SPECs / gaps cumulés sur N projets. Sortie texte ou `--json`.
- **`aiad-sdd gouvernance --pack-from <dir>`** — marketplace de packs
  communautaires avec **validation cryptographique SHA-256**. Refus si pack
  altéré ou non signé (sauf `--unsafe`). Format ouvert pour étendre AIAD à
  toute juridiction (FR-ANSSI, DE-BSI, ES-AEPD, NL-DUTO, etc.).
- **`aiad-sdd repl`** — REPL interactif avec 6 commandes (help/status/trace/
  doctor/intent/spec). Auto-incrément `INTENT-NNN`/`SPEC-NNN-N-slug`.
- **`aiad-sdd migrate`** — détecte les versions installées < courante et
  applique 5 migrations idempotentes. Mode aperçu par défaut.
- **`aiad-sdd telemetry [opt-in|opt-out|status]`** — télémétrie opt-in
  RGPD-compliant. UUID anonyme, jamais d'IP, pas de chemin projet, page de
  conformité dédiée.

### Nouvelles fonctionnalités

- **`sdd-trace --watch`** — re-génération automatique de la matrice à chaque
  changement Intent / SPEC / code (debounce 200 ms).
- **`sdd-trace --suggest`** — squelette EARS auto-généré pour SPECs orphelines
  référencées dans le code. Devine le `parent_intent`.
- **Annotations multi-language** — Rust, Go, Java, Kotlin, C#, Ruby, PHP,
  Swift, Scala, Elixir en plus de TS/JS/Python.
- **Trace via `git ls-files`** — respecte `.gitignore`, plus rapide sur
  monorepos. Bench : 100k fichiers en ~1.8 s.
- **Métriques de leadership EU/FR** dans `doctor --json` :
  `humanAuthorshipRatio`, `governanceCoverage`, `traceCompleteness`,
  `langueArtefacts`.
- **i18n des messages CLI** — foundation FR/EN, détection ordre
  `--lang` → `AIAD_LANG` → `LANG`/`LC_ALL` → défaut FR.

### Écosystème

- **GitHub Action officielle** `aiad-sdd-action` (composite, 6 modes,
  upload SARIF natif vers GitHub Code Scanning).
- **Templates CI multi-forges** : GitLab CI (avec intégration Security
  Dashboard SARIF), Bitbucket Pipelines, Drone CI.
- **Extension VS Code** légère (sidebar Intents/SPECs + CodeLens `@spec` 9
  langages + validation frontmatter à la sauvegarde).
- **Site documentation** GitHub Pages avec workflow `docs-deploy.yml`.
- **Page de comparaison** vs Spec Kit / Kiro / Cursor Memory Bank.

### Qualité

- **Couverture native Node** (zero-dep, pas de `c8`). Baseline v1.14.0 :
  lines 80.37%, branches 75.29%, funcs 67.75%. Seuils CI bloquants :
  lines ≥ 75%, branches ≥ 70%, funcs ≥ 65%.
- **Bench performance trace** : 75 ms / 5000 fichiers, projection 100k
  fichiers ≈ 1.8 s — pas de parallélisation Worker nécessaire.
- **17 alias EN canoniques** sur 10 modules (`installHooks`, `copyFile`,
  `buildMatrix`, `parseAnnotations`, etc.). Compat FR 100 % préservée.
- **323 tests automatisés** sur 49 fichiers de test.

### Ajouté

- **`aiad-sdd doctor`** — diagnostic unifié sur 7 catégories (structure, fondamentaux, cycle Intent/SPEC, commandes, gouvernance, parité `emit-rules`, hooks, repo Git, version). Sortie texte humaine ou `--json` consommable CI.
- **`aiad-sdd uninstall`** — désinstallation propre du framework, **mode aperçu par défaut**, `--force` pour exécuter, `--purge --force` pour supprimer aussi `.aiad/`. Préservation garantie des artefacts métier (Intents, SPECs, PRD, hooks et règles utilisateur).
- **`aiad-sdd skills validate`** — vérifie le frontmatter des `.claude/skills/<name>/SKILL.md` (champ `name` + `description ≥ 30 caractères` + corps non vide). Détecte les skills silencieusement ignorées par Claude Code.
- **`aiad-sdd docs [--check]`** — documentation utilisateur générée automatiquement depuis 5 sources de vérité (CLI, sous-commandes slash, skills, gouvernance, conventions d'annotations). Frontmatter `source-hash` SHA-256, sentinel anti-édition manuelle, mode `--check` pour CI parity.
- **`aiad-sdd update --check`** — exit 1 si les commandes / la gouvernance / les hooks installés divergent du package npm. Surface CI stable pour bloquer les PR désynchronisées.
- **Packs gouvernance par juridiction** — `aiad-sdd gouvernance --pack <id>` avec `eu-baseline` (défaut, leader EU/FR), `us-baseline` (SOC 2 / HIPAA / ADA / NIST AI RMF), `uk-baseline` (UK DPA 2018 / Equality Act / UK AI 5 principes / SECR-TCFD). `--list` pour énumérer.
- **Flag global `--dry-run`** — sur `init`, `update`, `upgrade`, `emit-rules`, `gouvernance --pack`. Affiche ce qui serait écrit sans toucher au disque. Logs suffixés `(dry-run)`.
- **Sortie JSON** — sur `status`, `bench`, `doctor`, `trace`, `skills validate` (en plus de la sortie humaine). Format stable consommable par CI / dashboards externes / intégrations Slack/Linear.
- **Trace SARIF v2.1.0** — `aiad-sdd trace --format sarif` produit `trace.sarif` consommable nativement par GitHub Code Scanning, GitLab Security Dashboard et SonarQube. 6 règles `AIAD-TRACE-001..006` mappées sur les catégories de gaps.
- **Trace via `git ls-files`** — quand un repo Git est présent, le scan respecte automatiquement le `.gitignore` du projet (ignore `vendor/`, `target/`, `build/`, `node_modules/` même si non listés explicitement) et est plus rapide sur monorepos. Fallback walk récursif sans repo.
- **Dashboard `--serve --watch`** — re-génération automatique du dashboard à chaque modification dans `.aiad/`. Boucle de feedback × 10 sur la rédaction de SPECs. Debounce 200 ms, anti-boucle infinie sur `metrics/`.
- **YAML frontmatter** sur les artefacts Intent / SPEC — mini-parser zero-dep intégré, **compatibilité ascendante 100 %** (les artefacts en format prose continuent de fonctionner). Champs reconnus : `status`, `parent_intent`, `format`, `sqs`, `auteur`, `date`.
- **Lock-file `emit-rules`** — verrou inter-processus via `O_EXCL` avec recovery automatique sur stale (âge ou PID mort). Évite la corruption sur runs CI matrix parallèles.

### Changé

- **Parser CLI** migré vers `node:util.parseArgs` natif. Supporte désormais `--flag=value` (en plus de `--flag value`), short flags `-h`/`-v`, validation native des flags inconnus avec messages d'erreur explicites.
- **Erreurs IO traduites** en français actionnable (EACCES → "Permission refusée. Vérifie les droits avec `ls -ld …`", EPERM, ENOSPC, EROFS, EISDIR, ENOTDIR, EMFILE). `err.code` et `err.cause` préservés pour filtrage programmatique.
- **`emit-rules`** ne fait plus `process.exit(1)` directement — l'exit code est désormais décidé par le bin à partir de `stats.drifts`. Rend la fonction testable et plus prévisible côté API programmatique.
- **`init --sans-gouvernance`** corrigé — la gouvernance n'est plus copiée du tout (avant, le `copierDossierRecursif` global la copiait silencieusement).

### Architecture interne (transparent côté utilisateur)

- **Module `lib/term.js`** — palette ANSI partagée + 12 helpers de log respectant `NO_COLOR`/`AIAD_NO_COLOR`/non-TTY. Plus aucune duplication ANSI dans `lib/`.
- **Module `lib/fs-ops.js`** — sémantique unique de copie / mise à jour avec retours typés (`'created'|'updated'|'unchanged'|'preserved'`), filtre `exclude`, `dryRun` propagé. Alias EN canoniques (`syncFile`, `copyFile`, `copyDir`, `appendIfMissing`).
- **Module `lib/frontmatter.js`** — mini-parser YAML zero-dep + stringifier round-trip.
- **Module `lib/lockfile.js`** — verrou inter-processus + `avecLock(path, fn)` (release garanti même sur exception).
- **`lib/dashboard.js`** éclaté — 2 038 → 138 LOC d'orchestrateur + 5 modules spécialisés (`collect`, `server`, `assets`, `watch`, `render`).

### Qualité

- **197 tests automatisés** (`node --test`, zero devDep) sur 31 fichiers de test.
- **CI matrix** Node 18 / 20 / 22 × ubuntu-latest / macos-latest avec lint zero-dep + tests + validation tarball.
- **Workflow release** avec provenance signée (`npm publish --provenance`) et vérification que le tag git correspond à `package.json#version`.
- **Tarball npm** : 137 fichiers, 251 Ko. `.DS_Store`, `.tgz`, `test/`, `docs/`, `scripts/`, `.github/`, `CONTRIBUTING.md`, `productbacklog.md` exclus.

### Documentation

- **`CONTRIBUTING.md`** — guide complet (setup, tests, conventions code/commit, ajout de pack gouvernance, code de conduite).
- **`docs/architecture.md`** — vue d'ensemble interne destinée aux contributeurs : 18 modules `lib/` documentés, principes de conception, points d'extension.
- **`DOCUMENTATION.md`** — référence utilisateur **auto-générée** (cf. `aiad-sdd docs`).

---

## [1.13.0] — 2026-05-09

### Ajouté

- HTML dashboard, mode `--serve`, workflow GitHub Pages.

## [1.12.0] — 2026-05-07

### Ajouté

- Multi-runtime : `aiad-sdd emit-rules` génère `AGENTS.md` + `.cursor/rules/` + `.codex/AGENT.md` + `GEMINI.md`.

## [1.11.0] — 2026-05

### Ajouté

- Variante EARS optionnelle pour les SPECs critiques + linter strict R1–R7.

## [1.10.0] — 2026-04

### Ajouté

- Matrice de traçabilité machine-vérifiable + `aiad-sdd trace`.

## [1.9.0] — 2026-04

### Ajouté

- 7 skills réutilisables (extraction des blocs récurrents des commandes SDD).

[1.14.0]: https://github.com/everssteeve/sdd-mode/compare/v1.13.0...v1.14.0
[1.13.0]: https://github.com/everssteeve/sdd-mode/compare/v1.12.0...v1.13.0
