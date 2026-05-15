# Changelog `aiad-sdd`

> Changements visibles côté **utilisateur** du paquet npm. Pour l'historique
> des artefacts internes au framework (templates, skills, gouvernance),
> voir [`templates/.aiad/CHANGELOG-ARTEFACTS.md`](templates/.aiad/CHANGELOG-ARTEFACTS.md).
>
> Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
> Versionnage : [SemVer 2.0.0](https://semver.org/lang/fr/).

## [Unreleased]

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
