---
title: "{{title}}"
parent_intent: "{{parent_intent}}"
status: draft
format: EARS
governance: AIAD-RGPD,AIAD-RGESN,AIAD-CRA
domain: observability-otel
generated-by: aiad-sdd template
---

# {{spec_id}} — {{title}}

> **Domaine** : Observabilité applicative via **OpenTelemetry (OTel)** —
> traces distribuées, métriques temps-réel, logs structurés.
> **Gouvernance Tier 1 applicable** : RGPD (PII dans les logs/traces) +
> RGESN (coût stockage/réseau) + CRA (intégrité chaîne d'observabilité).
> **Format** : EARS strict — tous les critères respectent les règles R1-R7.

## Contexte

Instrumenter le service `{{service}}` avec **OpenTelemetry** (SDK et
collector) pour produire **traces + metrics + logs** standardisés
exportables vers un backend (Tempo / Prometheus / Loki, Datadog,
New Relic, etc.) — voir Intent {{parent_intent}}.

L'enjeu critique : aucune **PII** ni **donnée sensible** ne doit fuir dans
les signaux d'observabilité. La conservation des données obéit aux durées
RGPD article 5.1.e (minimisation temporelle).

## Critères d'acceptation (EARS)

### R1 — SDK OTel auto-instrumenté

**WHEN** le service `{{service}}` démarre, **THE SYSTEM SHALL** initialiser
le SDK OpenTelemetry avec un `Resource` portant les attributs `service.name`,
`service.version`, `deployment.environment`, et activer l'auto-instrumentation
des bibliothèques HTTP/DB/runtime.

### R2 — Export vers un collector OTel

**WHEN** un signal (trace span, metric, log record) est produit, **THE SYSTEM
SHALL** l'exporter vers un OpenTelemetry Collector via OTLP/gRPC (port 4317)
ou OTLP/HTTP (port 4318), avec authentification mTLS si l'environnement le
requiert.

### R3 — Échantillonnage adaptatif des traces

**WHEN** un span racine est créé, **THE SYSTEM SHALL** appliquer un
`ParentBased(TraceIdRatioBased(0.1))` — soit 10 % des traces conservées en
échantillon par défaut, modulable via configuration. Les requêtes en erreur
(`status_code >= 500`) sont **toujours** conservées.

### R4 — Filtrage PII automatique (RGPD)

**WHEN** un attribut span/log contient potentiellement des PII (header
`Authorization`, query `?email=`, `?token=`, body matching patterns
IBAN/NIR/email), **THE SYSTEM SHALL** appliquer un `SpanProcessor` /
`LogRecordProcessor` qui **redacte** la valeur (remplacer par `[REDACTED]`)
**AVANT** export.

### R5 — Logs structurés JSON + correlation

**WHEN** un log est émis dans le service, **THE SYSTEM SHALL** le formatter
en JSON structuré incluant `trace_id`, `span_id`, `service.name`, `level`,
`timestamp` (RFC 3339 UTC), `message`, et propager le contexte trace via
le `LogRecord` OTel.

### R6 — Métriques RED + USE

**WHEN** la collecte démarre, **THE SYSTEM SHALL** exposer les métriques :
- **RED** (Requests/Errors/Duration) : `http.server.request.duration` histogramme,
  `http.server.request.count`, `http.server.request.errors.count`.
- **USE** (Utilization/Saturation/Errors) : `process.cpu.utilization`,
  `process.memory.usage`, `runtime.heap.size`.

### R7 — Retention RGPD-conforme

**WHILE** les signaux d'observabilité sont stockés dans le backend,
**THE SYSTEM SHALL** appliquer une **politique de retention différenciée** :
- Traces : **7 jours** maximum (debug court-terme).
- Metrics : **13 mois** (audit/SLO annuel + comparaison année précédente).
- Logs applicatifs : **30 jours** (incident response).
- Logs de sécurité : **1 an** (RGPD article 32 + obligations CRA).

### R8 — Pas de PII dans les attributs span/log indexés

**THE SYSTEM SHALL** garantir qu'aucun des champs suivants n'apparaît
**jamais** comme valeur d'attribut span/log indexé : `password`,
`authorization`, `api_key`, `secret`, `token`, `card_number`, `iban`,
`nir`, `ssn`. Validation : tests automatisés sur le pipeline OTel.

## Anti-patterns interdits

- **JAMAIS** logger un objet utilisateur complet — toujours filtrer les champs
  exposés (whitelist explicite, pas blacklist).
- **JAMAIS** envoyer les signaux directement à un SaaS hors EU pour les services
  manipulant des données personnelles EU (transferts internationaux RGPD
  Article 44+ — utiliser un collector intermédiaire EU).
- **JAMAIS** désactiver l'échantillonnage en production (coût + bruit).
- **JAMAIS** stocker les payloads complets de requêtes/réponses dans les spans
  (impact RGPD + RGESN majeur).

## Test de l'Étranger

Un ingénieur SRE qui découvre ce service doit pouvoir, **sans contexte
préalable**, :
1. Trouver les **traces d'une requête spécifique** par `trace_id` propagé.
2. Identifier les **endpoints lents** via percentile P95 sur 24 h.
3. Auditer **quelles données** sont indexées et confirmer qu'aucune PII ne
   l'est.

## Tests d'exemple

```ts
/**
 * @intent {{parent_intent}}
 * @spec {{spec_id}}
 * @verified-by tests/observability/no-pii-in-spans.test.ts
 * @governance AIAD-RGPD,AIAD-RGESN,AIAD-CRA
 */
test('aucune PII n\'apparaît dans les spans exportés', () => {
  const span = startSpan('/api/users', { headers: { Authorization: 'Bearer abc' } });
  const exported = exportToOtelCollector(span);
  expect(exported.attributes['http.request.header.authorization']).toBe('[REDACTED]');
});
```

Tests à couvrir :
- `tests/observability/no-pii-in-spans.test.ts` — fuzz 1000 requêtes avec
  headers Authorization, payloads emails/IBAN → vérifier aucun match PII.
- `tests/observability/retention.test.ts` — simuler 32 jours, vérifier
  l'expiration des traces (7j) et logs applicatifs (30j).
- `tests/observability/sampling.test.ts` — requêtes 5xx toujours conservées
  même si ratio normal < 1.

## Gouvernance applicable

- **AIAD-RGPD** : minimisation temporelle (Article 5.1.e), interdiction PII
  dans signaux indexés, transferts internationaux contrôlés.
- **AIAD-RGESN** : sobriété — échantillonnage, retention différenciée,
  pas de payloads bruts dans les spans (coût stockage).
- **AIAD-CRA** : intégrité de la chaîne d'observabilité (signaux non
  altérables, collector authentifié, logs de sécurité 1 an).

## Références

- OpenTelemetry — https://opentelemetry.io/docs/
- OTel Semantic Conventions — https://opentelemetry.io/docs/specs/semconv/
- RGPD Article 5.1.e (minimisation temporelle) — https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2
- CRA EU 2024/2847 (intégrité des artefacts de sécurité)

---

*Template généré par `aiad-sdd template observability-otel`. Compléter les
champs marqués (préciser le pourquoi métier — ...) et remplacer `{{service}}`
par le nom réel du service. Soumettre ensuite à `/sdd gate` pour validation.*
