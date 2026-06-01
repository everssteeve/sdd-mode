# RUN-LOG — Scénario autonome SDD Mode

**Cible** : URL shortener minimal (Node.js + Fastify)
**Date d'exécution** : 2026-05-13
**Sandbox** : `bench/scenario-autonomous-run/url-shortener/`
**Acteur** : Agent autonome simulant PM / PE / AE / QA / Tech Lead
**Version package effective** : `aiad-sdd@1.14.0` (CLI) — CLAUDE.md déclare `SDD Mode v1.12`
**Version doc de référence** : `SDDMode.md` figée à `v1.6`

---

## Légende sévérité findings

- 🔴 **Bloquant** — empêche d'exécuter le cycle SDD documenté
- 🟠 **Friction** — comportement réel ne correspond pas à la promesse doc, surprise notable
- 🟡 **Nice-to-have** — manque mineur ou opportunité d'amélioration UX
- 🟢 **Confirmé** — la promesse doc est tenue

---

## Findings pre-iteration (depuis l'inspection CLI + init réel)

### F-001 🟠 Décalage de version doc vs package
`SDDMode.md` est figée à v1.6, package distribué en v1.14.0, CLAUDE.md installé se déclare v1.12. 6 versions majeures de désynchro. Trois sources de vérité (README, SDDMode.md, CLAUDE.md installé) divergent.
**Impact** : un PE qui lit `SDDMode.md` n'a aucune idée des routers, skills, EARS, trace, dashboard-html, JNSP, CRA.
**Suggestion** : (a) emit-rules-check étendu à `SDDMode.md` ; (b) badge de version en tête de doc + bandeau "Dernière vérif : version X" ; (c) script `npm run docs:check` qui compare la doc aux fichiers installés.

### F-002 🟠 Nombre de commandes incohérent entre 3 endroits
- `SDDMode.md` parle de "27 commandes slash" puis "24 commandes" plus bas (structure `.aiad/`)
- CLI dit "30 commandes slash" (storybook)
- Disque installé : 30 alias plats + 2 routers + 1 aide = 33 fichiers
**Impact** : on ne sait pas combien d'outils on a vraiment.

### F-003 🔴 Init sans `--force` n'écrit PAS de CLAUDE.md ni d'AGENTS.md
Le premier `init` sans `--force` a créé `.aiad/` et `.claude/commands/` mais **n'a pas généré CLAUDE.md à la racine**. Seul le 2ᵉ passage `init --force` a déclenché `emit-rules` qui a créé CLAUDE.md + AGENTS.md.
**Impact** : un utilisateur primo-installant n'a pas le fichier d'identité agent — le projet démarre sans contexte permanent côté Claude Code.
**Reproduction** : `npx aiad-sdd init --runtime claude-code` puis `ls CLAUDE.md` → absent.
**Suggestion** : déclencher `emit-rules` systématiquement à la fin de `init`, sans option.

### F-004 🟠 Init sans `--force` n'installe PAS les commandes `/sdd-*`
Le premier `init` n'a écrit que 7 commandes `aiad-*` dans `.claude/commands/` (dashboard, demo, dora, emit-rules, flow, gouvernance, help) — aucune commande SDD. Le 2ᵉ passage `--force` a complété à 30+ commandes.
**Impact** : un premier install partiel laisse le projet sans cycle SDD. Pas de message d'erreur visible.
**Reproduction** : voir transcript bash.
**Suggestion** : (a) atomicité de l'install (tout ou rien) ; (b) doctor capable de détecter cet état partiel ; (c) log écrit dans `.aiad/.install-log` traçant l'état.

### F-005 🟡 5ᵉ agent de gouvernance Tier 1 absent de la doc
`.aiad/gouvernance/` installe **5 agents** : AI-ACT, RGPD, RGAA, RGESN, **CRA** (Cyber Resilience Act). La doc `SDDMode.md` n'en mentionne que 4. Idem pour `gouvernance-packs/` (FADP, BSI, ENS, HIPAA, SOC2, NIST-AI-RMF, etc.) qui constituent un Tier 2/3 entièrement absent de la doc.
**Suggestion** : section "Gouvernance multi-niveaux" dans `SDDMode.md`, ou pointer vers `marketplace`.

### F-006 🟡 Skills `.claude/skills/` invisibles dans la doc
8 skills sont installées (`context-budget`, `drift-detection`, `ears-validator`, `human-authorship-check`, `reasons-canvas`, `regulatory-veto`, `sqs-scoring`, `traceability`) et orchestrées par les commandes. CLAUDE.md les documente proprement, `SDDMode.md` non.
**Suggestion** : nouvelle section "Skills v1.9" dans `SDDMode.md`.

---

## Itérations

### Iter 0 — Bootstrap (`/sdd init`)
- Init réel via `node bin/aiad-sdd.js init --runtime claude-code` → écrit `.aiad/` + 7 commandes seulement (cf. F-004)
- 2ᵉ passage `--force` → 30 commandes + CLAUDE.md + AGENTS.md (cf. F-003)
- Rédigé PRD.md / ARCHITECTURE.md / AGENT-GUIDE.md (URL shortener tinr.ly)

### Iter 1 — Core shortening (`POST /shorten`)
- INTENT-001 + SPEC-001-1 écrits
- Code `src/routes/shorten.ts` annoté `@intent` `@spec` `@verified-by`
- Trace ne reconnaît pas la liaison frontmatter `intent:` → F-013

### Iter 2 — Redirect (`GET /:slug`)
- INTENT-002 + SPEC-002-1, code `src/routes/redirect.ts`
- Cas limites OK : 410 (expired) vs 404 (unknown)

### Iter 3 — Custom alias (EARS)
- INTENT-003 + SPEC-003-1 **format EARS**
- 6 critères EARS, ears-validator devrait passer en mode strict à la Gate
- `pii-scan` testé sur INTENT-001 → ✅ 0 finding

### Iter 4 — Analytics anonymisées (`/sdd security`)
- INTENT-004 + SPEC-004-1 + SPEC-004-2 (export DPO)
- Code `src/services/analytics.ts` avec uaBucket pur, pas d'IP brute
- Rapport `.aiad/metrics/security/2026-05-13-SPEC-006-1-auth-jwt.md` créé

### Iter 5 — Rate limiting (`/sdd fact`)
- INTENT-005 + SPEC-005-1, code `src/middleware/rate-limit.ts` (ip-hashed)
- Drift simulé : fail-open Redis non spécifié → FACT-001 créé dans `.aiad/facts/`
- Décision : ajustement SPEC-005-1 (pas nouvel Intent)

### Iter 6 — Auth JWT (`/sdd audit` + EARS)
- INTENT-006 + SPEC-006-1 EARS (7 critères)
- Code `src/lib/auth.ts` avec assertJwtSecret() fail-closed
- Rapport audit `.aiad/metrics/audit/2026-05-13-SPEC-007-2-domain-routing.md`

### Iter 7 — Custom domains (`/sdd split`)
- INTENT-007 → SPEC-007-1 (onboarding), SPEC-007-2 (routing EARS), SPEC-007-3 (TLS, draft SQS=3)
- SPEC-007-3 simule une Gate fermée → SQS=3 → `/sdd split` à faire
- Code `src/middleware/tenant.ts` annoté

### Iter 8 — Expiry (`/sdd drift-check`)
- INTENT-008 + SPEC-008-1, code `src/cron/purge-expired.ts`
- Décision documentée : conserver `clicks_daily` 13 mois (CNIL)

### Iter 9 — Dashboard admin (UI)
- INTENT-009 + SPEC-009-1 (RGAA + RGESN + CRA)
- Code `public/app.js` annoté avec `@governance AIAD-RGAA,AIAD-RGESN,AIAD-CRA`
- Test a11y prévu via axe-core

### Iter 10 — Observabilité (rituels + métriques)
- INTENT-010 + SPEC-010-1 (OTel)
- Commandes lancées en réel : `trace`, `doctor` x2, `dashboard`, `gouvernance lint`, `score`, `refactor-spec`, `spec-version`, `pii-scan`, `dpia`, `sbom`, `ai-act audit`, `status --json`, `emit-rules --check`, `skills validate`, `sovereignty`, `bench`, `storybook`

---

## Findings additionnels capturés en cours d'itération

Tous consolidés dans **REPORT.md** sous F-007 → F-025. Voir ce document pour la priorisation et les suggestions actionnables.
