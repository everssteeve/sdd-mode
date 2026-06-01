# REPORT-RUN2 — Findings sur l'application **vivante**

**Date** : 2026-05-13 (suite du REPORT.md initial)
**Contexte** : suite à la demande "passe en option B", l'app tinr.ly a été rendue **réellement fonctionnelle** :
- `package.json` + 4 deps prod (fastify, pg, ioredis, nanoid, pino) + dev (tsx, typescript)
- `docker-compose.yml` (Postgres 16 sur 5439, Redis 7 sur 6389)
- 4 migrations SQL appliquées
- Module manquants : `src/services/links.ts` (createLink + resolveSlug avec pii-scan), `src/lib/db.ts`, `src/lib/redis.ts`, `src/server.ts` (Fastify wiring + rate limit preHandler)
- `tests/shorten.test.ts` (5 tests `node --test` via fetch HTTP)

**Résultat** : serveur up sur `http://localhost:3091`, 5/5 tests passent, 7/7 endpoints smoke-testés (POST /shorten, GET /:slug, validations URL/alias/PII, rate-limit 429, collision, 404, redirect 302).

Ce qui suit sont les findings **second tour**, capturés en relançant le tooling SDD sur une codebase qui s'exécute pour de vrai (avec deps, tests passants, data en DB+Redis).

---

## Findings nouveaux (run 2)

### F-026 🟠 `trace` continue d'ignorer la liaison Intent ↔ SPEC, même avec code+tests annotés
**Reproduction** : `npx aiad-sdd trace` après la mise en place du code complet.
**Observation** :
```
Code annoté   : 11 / 15
Tests annotés : 1 / 1
Intents sans SPEC : 10
SPECs orphelins référencés dans code : 0
Intents orphelins référencés dans code : 9
```
Toutes les annotations `@spec`/`@intent` dans le code sont reconnues. Tous les Intents sont vus. Tous les SPECs sont vus. Mais la **jointure Intent → SPEC reste vide** (toutes les SPECs apparaissent comme "non-liées à un Intent" dans `trace.json` : `"specs": []` pour chaque intent).
**Cause** : la jointure se fait via le pattern Markdown `**Intent parent** : INTENT-NNN` dans le corps de la SPEC. Mes SPECs ont `intent: INTENT-NNN` en frontmatter YAML. Le `trace.js` ne lit que le pattern Markdown.
**Impact** : un PE peut avoir 100 % d'annotations `@spec` dans le code, 100 % de SPECs ready, et `trace` rapporte malgré tout "10 Intents orphelins" → faux positifs bloquants en CI (`--fail-on-gap` exit 1 confirmé).
**Suggestion** : confirme F-013 du REPORT initial. Priorité P0.

### F-027 🟠 `Trace Completeness : — (0/0 SPECs avec code+tests)` malgré la couverture réelle
**Reproduction** : `doctor` ou `status`.
**Observation** : 11/15 fichiers source annotés, 1/1 test annoté, et pourtant la métrique `Trace Completeness` affiche `— (0/0)`. Même avec des couples code↔test↔spec réellement liés (ex: `src/services/links.ts` ↔ `tests/shorten.test.ts` via `SPEC-001-1`), la métrique ne se construit pas.
**Cause probable** : la fonction qui calcule la couverture cherche un mapping qui n'est jamais peuplé (cf. F-026 — la jointure SPEC↔Intent vide casse aussi SPEC↔Code↔Test).
**Impact** : la métrique annoncée comme "Trace Completeness" est inopérante. Un PE n'a aucun indicateur de couverture.

### F-028 🔴 `Governance Coverage : — (0/0 fichiers sensibles annotés)` malgré 7+ fichiers `@governance`
**Reproduction** : `doctor`.
**Observation** : nous avons `@governance AIAD-RGPD,AIAD-CRA` dans `src/lib/auth.ts`, `@governance AIAD-RGPD` dans `src/services/analytics.ts`, `@governance AIAD-RGAA,AIAD-RGESN,AIAD-CRA` dans `public/app.js`, etc. La métrique affiche `0/0`.
**Cause probable** : le compteur de "fichiers sensibles" n'est pas alimenté (peut-être qu'il dépend d'un classifier RGPD/AI-Act qui scanne le code, jamais alimenté par les annotations).
**Impact** : un PE rigoureusement annoté reçoit un signal "0 coverage" — démotivant et trompeur. Priorité P0 si le framework veut promettre la traçabilité réglementaire.

### F-029 🟢 `sbom` fonctionne dès qu'il y a un `package.json`
**Reproduction** : `npx aiad-sdd sbom` après `npm install`.
**Observation** : génère `sbom.cdx.json` (CycloneDX v1.5) avec **150 composants tiers**. Compatible Dependency-Track, OSS Review Toolkit, GHAS.
**Confirmation** : confirme que F-015 du run 1 était bien un défaut de message (pas un défaut fonctionnel). La commande marche dès que les prérequis sont là.
**Suggestion** : conserve la suggestion de message d'aide explicite quand `package.json` absent (F-015).

### F-030 🟠 `dpia` produit "Fichiers annotés : 5" sans préciser lesquels ni leur traçabilité avec les SPECs RGPD
**Reproduction** : `npx aiad-sdd dpia`.
**Observation** : la commande compte 5 fichiers code annotés `@governance AIAD-RGPD`, mais le rapport DPIA généré ne liste pas la **matrice** SPEC RGPD ↔ Fichier code ↔ Test. Or c'est exactement ce qu'un DPO demande lors d'une AIPD : "montre-moi quel code implémente quel traitement, et où il est testé."
**Suggestion** : injecter dans la section 2 ou 3 du DPIA un tableau `SPEC | Fichiers @governance AIAD-RGPD | Tests | Veto` issu de `trace`. Couplage naturel avec F-027.

### F-031 🟠 `pii-scan <directory>` plante avec `EISDIR: illegal operation on a directory, read`
**Reproduction** : `npx aiad-sdd pii-scan src/`
**Observation** : le scanner ne récurse pas. Pour audit pré-commit RGPD c'est attendu (un PE veut "scan everything"), mais l'erreur est nue (pas de message d'aide).
**Suggestion** : (a) supporter `pii-scan <dir>` avec récursion en respectant `.gitignore`, ou (b) print "PII scan does not recurse into directories. Use --recursive or list files."

### F-032 🟠 `trace` flagge `dashboard/assets/app.js` comme "Code sans @spec" — c'est un artefact généré par `aiad-sdd dashboard` lui-même
**Reproduction** : `aiad-sdd dashboard` puis `aiad-sdd trace`.
**Observation** : la trace voit le JS du dashboard généré et le compte comme du code applicatif non annoté. Idem pour `scripts/migrate.ts` qui est de l'infra (et reste légitimement non-annoté).
**Cause** : pas de liste d'exclusion par défaut.
**Suggestion** : `.aiadignore` ou config dans `.aiad/config.yml` avec un défaut sensé (`dashboard/`, `node_modules/`, `dist/`, `build/`, `scripts/`, `migrations/`).

### F-033 🟠 La maturité reste "Complet 5/5" même quand `Trace Completeness` et `Governance Coverage` sont à 0/0
**Reproduction** : `npx aiad-sdd status --json`
**Observation** :
```json
"maturite": { "score": 5, "total": 5, "label": "Complet" }
```
…alors même qu'un examen visuel montre des trous (intents orphelins, métriques de leadership à 0/0). Le score additionne ce qui est présent, pas la cohérence/couverture.
**Suggestion** : pondérer par les métriques de leadership (Human Authorship, Governance Coverage, Trace Completeness). Tant qu'au moins 2 sur 3 ne sont pas à `—`, ne pas afficher "Complet".

### F-034 🟢 La pipeline réelle marche : 5/5 tests verts, 7/7 endpoints fonctionnels en moins de 5 min depuis 0
**Reproduction** : `docker compose up -d` → `npm install` → `npm run migrate` → `npm start` → `npm test`
**Observation** : depuis la fin du REPORT initial jusqu'à un serveur tinr.ly réellement bootant et passant 5 tests d'intégration HTTP réels, **2 corrections code** ont suffi :
1. ajout `dotenv` dans `package.json`
2. consolidation de la logique de validation alias dans `createLink` (deux chemins clairs : `fromAlias: true` → regex + PII, `fromAlias: false` → regex slug seule)
**Confirmation** : l'architecture documentée dans `.aiad/ARCHITECTURE.md` était suffisante. Le framework SDD a rempli son rôle de pré-spec : pas de retour-arrière sur la conception.

### F-035 🟡 Sur ces 8 commandes relancées, **aucune** ne s'est plantée sur des données réelles
- `trace`, `doctor`, `status`, `sbom`, `dpia`, `dashboard`, `sovereignty`, `gouvernance lint` : toutes ont produit un output.
- Seul `pii-scan <dir>` plante (F-031).
**Confirmation** : robustesse globale solide. Les défauts sont sur la **qualité du signal**, pas sur la fiabilité d'exécution.

### F-036 🟡 La commande `trace --fail-on-gap` retourne exit 1 **à cause des faux gaps de F-026**
**Reproduction** : `npx aiad-sdd trace --fail-on-gap` → exit 1
**Impact** : si activé en CI (comme le suggère le CLAUDE.md template via `.github/workflows/sdd-trace.yml`), **toute PR est bloquée tant que F-026 n'est pas corrigée** — même un projet parfaitement annoté.
**Priorité** : P0, dépend de F-013/F-026.

---

## Récapitulatif des deux runs

| Catégorie | Run 1 (audit doc + simulation) | Run 2 (app vivante) | Verdict |
|-----------|-------------------------------|---------------------|---------|
| Cohérence doc | 6+ versions de retard (v1.6 → v1.12) | inchangé | P0 |
| Compteurs hétérogènes | doctor 14, trace 13, dashboard 13 | identique en run 2 | P1 |
| Init partiel | 7 cmds sans `--force` | n/a en run 2 (déjà initialisé) | P0 |
| Gouvernance lint YAML bug | 9 faux positifs | 9 faux positifs **identiques** | P0 |
| Liaison Intent↔SPEC | trace ignore frontmatter | **inchangée même avec code+test annotés** | P0 critique |
| Governance Coverage | 0/0 (aucune donnée) | **0/0 malgré 7+ fichiers annotés** | P0 |
| Trace Completeness | 0/0 (aucune donnée) | **0/0 malgré code+tests annotés** | P0 |
| Maturité crédible | "Complet" injustifié | "Complet" injustifié confirmé | P1 |
| sbom prérequis | échec sur projet sans package.json | ✅ 150 composants détectés | confirmé |
| pii-scan récursif | non testé | ❌ EISDIR | P2 |
| Trace artefacts générés | non testé | dashboard/assets/app.js flaggé | P2 |
| `--fail-on-gap` CI | non testé | bloque CI à cause de F-026 | P0 critique pour adoption |

---

## Recommandations consolidées

### Priorité absolue (P0) — la traceability est cassée

Le triplet **F-013 / F-026 / F-027 / F-028 / F-036** forme un seul bug structurel : la liaison `Intent ↔ SPEC ↔ Code ↔ Test ↔ Governance` n'est jamais construite, ce qui cascade sur toutes les métriques de leadership et bloque la CI.

→ **Action #1 (P0)** : dans `lib/sdd-trace.js` (ou équivalent), accepter le frontmatter YAML `intent: INTENT-NNN` (ou `intent_id`/`parent_intent`) sur les SPECs comme source primaire, avec fallback sur le pattern Markdown `**Intent parent** :`. Documenter le schéma canonique. Effort : S.

→ **Action #2 (P0)** : fixer `lib/governance-lint.js` (cf. F-010) pour parser YAML. Cinq lignes de code probablement. Effort : XS.

→ **Action #3 (P0)** : exécuter `emit-rules` automatiquement à la fin de `init` (cf. F-003). Effort : XS.

### Priorité P1 — crédibilité des métriques

→ **Action #4** : factoriser un module `counters.js` partagé par `doctor`, `status`, `dashboard`, `trace`, `storybook` (cf. F-002, F-008, F-011). Effort : M.

→ **Action #5** : raffiner le score de maturité avec un seuil sur `Governance Coverage` et `Trace Completeness` (cf. F-012, F-033). Effort : S.

### Priorité P2 — DX et messages

→ **Action #6** : ajouter `.aiadignore` ou config par défaut pour exclure les artefacts générés (cf. F-032). Effort : S.

→ **Action #7** : tags `[REQUIRES: ollama|git|package.json]` dans `--help` (cf. F-014, F-015, F-024). Effort : S.

→ **Action #8** : `pii-scan <dir>` récursif avec `.gitignore` respect (cf. F-031). Effort : S.

---

## État de la sandbox

| Élément | Statut |
|---------|--------|
| Postgres 16 (port 5439) | ✅ up, healthy |
| Redis 7 (port 6389) | ✅ up, healthy |
| Migrations appliquées | ✅ 4/4 (`SELECT * FROM _migrations`) |
| Serveur tinr.ly | ✅ écoute sur :3091 (background) |
| Tests | ✅ 5/5 |
| Endpoints smoke | ✅ 7/7 (shorten auto, shorten alias, invalid URL, PII rejected, collision, redirect 302, 404) |
| Rate limit | ✅ 429 après 10/min, header `Retry-After: 60` |

### Nettoyage si tu veux arrêter la sandbox

```bash
cd /Users/steeve/Dev/packages/aiad-sdd/bench/scenario-autonomous-run/url-shortener
# Stopper le serveur (background bash id baiv1ydh7 / bxpuri2ah)
docker compose down -v   # supprime aussi le volume Postgres
```

---

*Run 2 généré sur app fonctionnelle. Toutes les commandes SDD listées ont été exécutées en réel, pas simulées. Les findings F-026 à F-036 sont reproductibles à partir de la sandbox.*
