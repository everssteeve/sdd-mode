---
layout: default
title: Télémétrie — Politique de confidentialité RGPD
lang: fr-FR
---

# Télémétrie

> **TL;DR** : aiad-sdd ne collecte **aucune donnée par défaut**. La télémétrie est strictement opt-in, anonymisée, RGPD-compliant. Tu peux à tout moment retirer ton consentement (`aiad-sdd telemetry opt-out`) — ton UUID local et le journal d'événements sont supprimés immédiatement (droit à l'effacement, Article 17 RGPD).

## Pourquoi (et pourquoi pas)

aiad-sdd se veut le **leader européen** des frameworks de développement basés sur l'intention. Cela exige deux choses qui semblent contradictoires :

1. **Comprendre les usages réels** pour prioriser le développement (item #30 du backlog).
2. **Respecter strictement la vie privée** — aucun framework leader EU ne peut collecter des données sans consentement explicite.

La résolution : **télémétrie désactivée par défaut, opt-in explicite, anonymisée, transparente**.

## Que se passe-t-il avant l'opt-in ?

**Rien.** Pas de fichier créé, pas de requête réseau, pas d'UUID généré. La fonction `track()` retourne immédiatement si `optIn === false` (qui est le défaut).

## Que se passe-t-il après `aiad-sdd telemetry opt-in` ?

1. Un UUID v4 anonyme est généré et stocké dans `~/.aiad-sdd/telemetry.json`. Cet UUID **n'est jamais associé à ton identité** (email, nom, IP, projet) côté client.
2. Chaque commande aiad-sdd que tu lances déclenche un événement `command_run` avec :
   - `event: "command_run"`
   - `anonymousId: "<ton UUID>"`
   - `timestamp: "ISO-8601"`
   - `command: "init" | "trace" | …`
   - `version: "1.14.0"`
   - `runtimes: ["cursor", …]` (uniquement quand explicitement passé via `--runtime`)
3. L'événement est appendé dans `~/.aiad-sdd/events.jsonl` (trace locale).
4. **Si** la variable d'environnement `AIAD_TELEMETRY_URL` est définie, l'événement est aussi envoyé en HTTP POST vers cet endpoint, **fire-and-forget avec timeout 1.5 s**. Si l'envoi échoue (offline, timeout, erreur 5xx), aucune trace, aucun retry — la commande utilisateur reste fluide.

## Données qui ne sont JAMAIS collectées

- **Chemins de projet** (cwd, racine, fichiers ouverts).
- **Adresse IP côté client**. Si un endpoint est configuré, le serveur peut voir l'IP via la couche TCP — mais le serveur s'engage à ne pas la logger (cf. politique self-hosted).
- **Identifiant utilisateur** (email, nom, login, hash quelconque dérivé d'identité).
- **Contenu d'Intent / SPEC / code** (jamais agrégé, jamais transmis).

## Conformité RGPD — bases légales

| Article | Conformité |
|---------|------------|
| **Art. 5(1)(a) — Licéité, loyauté, transparence** | Désactivée par défaut, message d'opt-in explicite avec liste des données collectées. |
| **Art. 5(1)(c) — Minimisation** | 6 champs uniquement, pas un de plus. |
| **Art. 6(1)(a) — Consentement** | Opt-in explicite via commande dédiée. |
| **Art. 7(3) — Retrait du consentement** | `telemetry opt-out` à tout moment, aussi simple que l'opt-in. |
| **Art. 13 — Information** | Cette page + sortie console au moment de l'opt-in. |
| **Art. 17 — Droit à l'effacement** | `opt-out` supprime l'UUID local **et** le journal `events.jsonl`. |
| **Art. 25 — Privacy by Design** | UUID anonyme, pas de PII, fail-safe, désactivé par défaut. |
| **Art. 32 — Sécurité** | Si endpoint configuré, **HTTPS obligatoire** côté admin. |

## Endpoint personnalisé (self-hosted)

Si tu déploies un endpoint télémétrie pour ton équipe :

```bash
export AIAD_TELEMETRY_URL=https://telemetry.exemple.fr/aiad
aiad-sdd telemetry opt-in
```

Recommandations supplémentaires côté serveur :
- **HTTPS uniquement** (Art. 32 RGPD).
- **Ne pas logger l'IP** dans les nginx/CloudFront access logs.
- **Rétention courte** (30 jours suffisent pour les analyses produit).
- **Sous-traitant EU** ou auto-hébergé (Art. 28 RGPD).
- **Document RoPA** (Article 30 RGPD) à tenir.

## Inspecter ton journal local

```bash
cat ~/.aiad-sdd/events.jsonl   # ligne par ligne, jq-able
aiad-sdd telemetry status      # état + chemin du log
aiad-sdd telemetry status --json  # consommable script
```

## Effacer toutes les traces

```bash
aiad-sdd telemetry opt-out
# → supprime ~/.aiad-sdd/telemetry.json + events.jsonl
```

## Observabilité native (OpenTelemetry + statusLine + usage skills) — §3.11

SDD se branche sur les **primitives natives** de Claude Code plutôt que sur des
collecteurs maison.

### Export OpenTelemetry (opt-in)

Les clés sont livrées **désactivées** (préfixe `_`) dans `templates/.claude/settings.json` →
renomme `_OTEL_*` en `OTEL_*` et pointe vers ton collecteur :

```jsonc
"env": {
  "OTEL_METRICS_EXPORTER": "otlp",
  "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318",
  "OTEL_RESOURCE_ATTRIBUTES": "service.name=aiad-sdd"   // jamais de PII
}
```

Claude Code exporte alors ses métriques (sessions, coût, tokens) vers n'importe
quel backend OTLP. **Consentement** : n'active OTel que si ta politique de
confidentialité le permet ; `OTEL_RESOURCE_ATTRIBUTES` ne doit pas contenir de
données personnelles.

### statusLine live

`settings.statusLine.command` appelle `aiad-sdd statusline` (via le hook
`.aiad/hooks/statusline.js`) à chaque rafraîchissement. La ligne affiche la SPEC
active, l'état de Gate (déduit du SQS), l'étape de cycle (§3.9), le % de contexte
(alerte ≥ 70 %), l'effort et le coût :

```
SPEC-042-1 │ Gate ✅ │ étape EXEC │ ctx 58% │ effort max │ Opus 4.8 │ $0.42
```

### Mesure d'usage des skills

Le hook `PreToolUse(Skill)` (`.aiad/hooks/skill-usage.js`) journalise chaque
invocation dans `.aiad/metrics/skill-usage.jsonl` — pour savoir **lesquelles
servent vraiment** (Sobriété Intentionnelle : retirer les inutilisées). Jamais
bloquant, bypass `AIAD_HOOK_SILENT=1`.

### Attribution garantie

`settings.includeCoAuthoredBy: true` impose le trailer `Co-Authored-By` sur les
commits **indépendamment du modèle** — la paternité de l'outil est tracée par le
harness, pas par le bon vouloir de l'agent.

---

*Dernière mise à jour : 2026-06-09. Pour toute question, [issue GitHub](https://github.com/everssteeve/sdd-mode/issues).*
