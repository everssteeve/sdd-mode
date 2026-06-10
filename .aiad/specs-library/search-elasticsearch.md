---
title: "{{title}}"
parent_intent: "{{parent_intent}}"
status: draft
format: EARS
governance: AIAD-RGPD,AIAD-CRA,AIAD-RGESN
domain: search-elasticsearch
generated-by: aiad-sdd template
---

# {{spec_id}} — {{title}}

> **Domaine** : Recherche full-text via **Elasticsearch / OpenSearch** —
> classification des données indexées, **right to erasure** propagé,
> sobriété (shards, refresh interval, retention).
> **Gouvernance Tier 1 applicable** : RGPD (indexes contiennent souvent
> des PII — droits d'accès, rectification, effacement, opposition à
> propager) + CRA (intégrité de l'index) + RGESN (coût stockage indexes).
> **Format** : EARS strict — règles R1-R7.

## Contexte

Implémenter la recherche pour `{{service}}` avec Elasticsearch/OpenSearch.
L'enjeu RGPD est **majeur** : un index full-text contient des copies des
documents originaux et **survit aux suppressions** dans la base source si
on ne propage pas activement. Voir Intent {{parent_intent}}.

## Critères d'acceptation (EARS)

### R1 — Classification des champs indexés

**THE SYSTEM SHALL** maintenir un **mapping documenté** classifiant chaque
champ indexé en : `public`, `internal`, `sensitive` (PII non sensible :
email, nom), `restricted` (PII sensibles : santé, NIR, IBAN). Les champs
`restricted` sont **par défaut non indexés** ; tout ajout exige validation
DPO.

### R2 — Indexation avec `tenant_id` (si multi-tenant)

**WHEN** un document est indexé, **THE SYSTEM SHALL** inclure le champ
`tenant_id` (mapping `keyword`) et appliquer un alias ou un filtered
index pour garantir l'isolation (voir SPEC `multi-tenant-saas`).

### R3 — Sync des suppressions (Right to Erasure)

**WHEN** un document est supprimé dans la base source (PostgreSQL, etc.),
**THE SYSTEM SHALL** déclencher dans les **5 minutes** une opération
`DELETE /index/_doc/{id}` correspondante via un mécanisme idempotent
(message queue, CDC, ou tombstone). Le succès est confirmé par un
**replay test** automatisé.

### R4 — Right to Rectification

**WHEN** un document est modifié (Article 16 RGPD), **THE SYSTEM SHALL**
re-indexer le document dans les 5 minutes, sans laisser de version
"fantôme" indexée (`refresh=true` sur la mutation critique, ou rotation
d'index avec alias).

### R5 — Right to Access (Article 15)

**WHEN** un utilisateur demande l'accès à ses données, **THE SYSTEM
SHALL** être capable de retrouver **tous** ses documents indexés par
identifiant et fournir un export structuré (JSON), incluant le **mapping
classifié** et les **métadonnées** (date indexation, version).

### R6 — Authentification + chiffrement au repos

**WHEN** un client se connecte au cluster, **THE SYSTEM SHALL** exiger
authentification (basic auth, API key ou TLS client cert), TLS 1.2+ en
transit, et chiffrement au repos via le filesystem ou keystore Elasticsearch.

### R7 — Backup conforme + suppression réelle

**WHEN** un snapshot est créé, **THE SYSTEM SHALL** chiffrer le snapshot et
**propager les suppressions** : un document supprimé doit disparaître des
snapshots > 30 jours (RGPD Article 5.1.e — minimisation temporelle).

### R8 — Logs requêtes anonymisés

**WHEN** les query logs sont activés (Slow Log Elasticsearch), **THE
SYSTEM SHALL** filtrer/redacter les valeurs de requêtes contenant des PII
(query string sur emails, IBAN, etc.) **AVANT** envoi vers observabilité
(voir SPEC `observability-otel`).

### R9 — Refresh interval optimisé (RGESN)

**THE SYSTEM SHALL** configurer le `refresh_interval` selon le besoin réel
(défaut 1s peut être surfait — `5s` ou `30s` pour analytics) afin de réduire
les opérations de fusion de segments (coût CPU + I/O).

## Anti-patterns interdits

- **JAMAIS** indexer un champ `restricted` (santé, NIR, IBAN) sans
  validation DPO documentée et chiffrement applicatif additionnel.
- **JAMAIS** synchroniser un index full depuis la base source en mode
  "wipe & reload" — toujours utiliser des opérations incrémentales pour
  préserver les suppressions intervenues entre 2 syncs.
- **JAMAIS** exposer l'API Elasticsearch directement à internet (proxy
  applicatif obligatoire avec authentification + autorisation).
- **JAMAIS** stocker un index sans backup chiffré + procédure de
  restauration testée.
- **JAMAIS** réutiliser un index entre tenants sans filtered alias /
  document-level security.

## Tests d'exemple

```ts
/**
 * @intent {{parent_intent}}
 * @spec {{spec_id}}
 * @verified-by tests/search/right-to-erasure.test.ts
 * @governance AIAD-RGPD,AIAD-CRA
 */
test('Right to Erasure : supprimer en DB propage à Elasticsearch < 5min', async () => {
  const doc = await createUser({ email: 'erasure@example.com' });
  await indexDocument(doc);
  await deleteUserFromDb(doc.id);
  await waitFor(() => searchByEmail('erasure@example.com'), { timeout: 300000 });
  const results = await searchByEmail('erasure@example.com');
  expect(results.length).toBe(0);
});
```

Tests à couvrir :
- `tests/search/right-to-erasure.test.ts` — supprimer 100 docs en DB,
  vérifier disparition en moins de 5 min.
- `tests/search/rectification.test.ts` — modifier un doc, vérifier qu'on
  ne lit pas la version stale.
- `tests/search/classification.test.ts` — le mapping `restricted` est
  rejeté sans approbation DPO.
- `tests/search/multi-tenant-isolation.test.ts` — recherche cross-tenant
  retourne 0.

## Test de l'Étranger

Un DPO doit pouvoir, **sans contexte préalable**, :
1. Lister **tous** les champs indexés et leur classification.
2. Confirmer la **chaîne de suppression** DB → index → snapshot.
3. Auditer les **query logs** sans risquer d'exposition PII supplémentaire.

## Gouvernance applicable

- **AIAD-RGPD** : indexes = traitements de données personnelles → registre
  Article 30, droits Articles 15/16/17 propagés, minimisation Article 5.1.e.
- **AIAD-CRA** : intégrité de l'index (chiffrement, backup, authentification),
  pas d'exposition directe.
- **AIAD-RGESN** : optimisation refresh, segments, shards — réduit coût
  CPU/storage de 20-50 %.

## Références

- Elastic — Security best practices : https://www.elastic.co/guide/en/elasticsearch/reference/current/secure-cluster.html
- OpenSearch — Document-level security : https://opensearch.org/docs/latest/security/access-control/document-level-security/
- RGPD Articles 15, 16, 17 (droits d'accès, rectification, effacement).
- CNIL — Guide CNIL de la sécurité des données personnelles.

---

*Template généré par `aiad-sdd template search-elasticsearch`. La
classification de chaque champ doit être validée par le DPO avant `/sdd
gate`.*
