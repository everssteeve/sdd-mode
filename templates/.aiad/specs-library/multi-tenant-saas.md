---
title: "{{title}}"
parent_intent: "{{parent_intent}}"
status: draft
format: EARS
governance: AIAD-RGPD,AIAD-CRA,AIAD-AI-ACT
domain: multi-tenant-saas
generated-by: aiad-sdd template
---

# {{spec_id}} — {{title}}

> **Domaine** : Multi-tenant SaaS — isolation des données, billing par
> tenant, conformité RGPD avec contrôleur distinct par tenant.
> **Gouvernance Tier 1 applicable** : RGPD (chaque tenant peut être un
> responsable de traitement distinct) + CRA (cybersécurité produit) +
> AI-ACT (si features IA partagées entre tenants — éviter le data leak
> d'entraînement).
> **Format** : EARS strict — règles R1-R7.

## Contexte

Architecturer `{{service}}` en mode **multi-tenant** : N organisations
clientes (tenants) partagent l'infrastructure mais ne voient **jamais** les
données des autres. La stratégie d'isolation est un **choix architectural
majeur** documenté ici. Voir Intent {{parent_intent}}.

**3 stratégies possibles** (à choisir explicitement) :
- **Pool partagé** (database/schema unique avec `tenant_id` partout) —
  coût bas, isolation logique. Risque de leak par bug applicatif.
- **Schema par tenant** (PostgreSQL schemas) — isolation forte au niveau
  base, coût modéré.
- **Database par tenant** — isolation maximale, coût élevé, cible
  banques/santé.

## Critères d'acceptation (EARS)

### R1 — Tenant context propagé partout

**WHEN** une requête authentifiée arrive, **THE SYSTEM SHALL** extraire le
`tenant_id` depuis le JWT (claim `tid` ou équivalent) et le propager dans
**chaque** appel DB, cache, queue, log, span OTel via un AsyncLocalStorage
ou contexte applicatif équivalent.

### R2 — Filtrage row-level systématique (stratégie pool)

**WHILE** la stratégie d'isolation est "pool partagé", **THE SYSTEM SHALL**
appliquer un middleware ORM ou un Postgres **Row-Level Security (RLS)** qui
ajoute `WHERE tenant_id = current_setting('app.tenant_id')` à **chaque**
requête, sans exception possible côté code applicatif.

### R3 — Connexion DB scopée (stratégie schema/db)

**WHEN** une requête arrive (stratégies schema-per-tenant ou db-per-tenant),
**THE SYSTEM SHALL** ouvrir une connexion DB dédiée au schema/database du
tenant ; pool de connexions par tenant (max N par instance).

### R4 — Données croisées impossibles dans le code

**THE SYSTEM SHALL** garantir par revue de code statique (lint rule ou
test) qu'aucune requête SQL n'omet le filtre `tenant_id` (stratégie pool)
ni qu'aucune requête SQL ne contient `tenant_id IN (?, ?)` (lecture
multi-tenant interdite hors super-admin).

### R5 — Billing par tenant

**WHEN** un événement facturable survient (API call, MB stockés, user
créé), **THE SYSTEM SHALL** l'enregistrer avec le `tenant_id` dans un
event store dédié, agrégeable à la facturation mensuelle (Stripe, Chargebee
ou équivalent — voir SPEC `billing-stripe-tax`).

### R6 — RGPD : DPO et DPA par tenant

**THE SYSTEM SHALL** maintenir, pour chaque tenant, le contact DPO du
tenant (responsable de traitement) et un **Data Processing Agreement
(DPA)** signé entre l'éditeur (sous-traitant Article 28) et chaque tenant
(responsable Article 24).

### R7 — Suppression d'un tenant (RGPD Right to Erasure)

**WHEN** un tenant résilie, **THE SYSTEM SHALL** :
1. Suspendre l'accès dans les **24 heures**.
2. Programmer la **purge complète** des données (DB + objects storage +
   indexes Elasticsearch + caches + backups expirables) sous **30 jours**
   maximum.
3. Émettre un **certificat de suppression** signé HMAC (réutilise
   `lib/audit.js` AIAD).

### R8 — Pas de cross-tenant analytics sans agrégation

**THE SYSTEM SHALL** garantir que toute analytique agrégée multi-tenant
(produit, support, ML) opère sur des données **anonymisées au sens RGPD**
(k-anonymity ≥ 5, suppression identifiants directs) **AVANT** ingestion
dans l'entrepôt d'analyse.

## Anti-patterns interdits

- **JAMAIS** stocker un `tenant_id` dans le JWT puis lui faire confiance
  côté DB sans **revérification** au niveau RLS / middleware.
- **JAMAIS** désactiver RLS pour un job batch (utiliser un super-user
  séparé avec audit trail crypto-signé).
- **JAMAIS** mélanger tenants différents dans un même cache key (toujours
  préfixer par `tenant:{id}:`).
- **JAMAIS** entraîner un modèle IA cross-tenant sur des données brutes —
  obligation anonymisation (AI Act Article 10 — qualité données entraînement).
- **JAMAIS** conserver les backups d'un tenant résilié au-delà du délai
  prévu au contrat (RGPD Article 5.1.e).

## Tests d'exemple

```ts
/**
 * @intent {{parent_intent}}
 * @spec {{spec_id}}
 * @verified-by tests/multitenant/no-cross-tenant-leak.test.ts
 * @governance AIAD-RGPD,AIAD-CRA
 */
test('un tenant A ne peut JAMAIS lire les données du tenant B', async () => {
  const a = await login('alice@tenant-a.com');
  const b = await login('bob@tenant-b.com');
  await createOrder(a.token, { item: 'X' });
  const ordersB = await listOrders(b.token);
  expect(ordersB.length).toBe(0);
});
```

Tests à couvrir :
- `tests/multitenant/no-cross-tenant-leak.test.ts` — N tenants, M
  utilisateurs ; pour chaque permutation, vérifier qu'aucun ne voit les
  données des autres.
- `tests/multitenant/erasure.test.ts` — résilier un tenant, vérifier
  purge complète sous 30 j (DB + storage + indexes + caches).
- `tests/multitenant/rls.test.ts` — RLS désactivé manuellement → la
  requête échoue (au lieu de retourner tout).

## Test de l'Étranger

Un auditeur RGPD doit pouvoir, **sans contexte préalable**, :
1. Lister tous les **endroits** où des données tenants sont stockées.
2. Vérifier qu'**aucune** requête SQL ne peut s'exécuter sans `tenant_id`.
3. Confirmer la **procédure de suppression** documentée et auditée.

## Gouvernance applicable

- **AIAD-RGPD** : chaque tenant = potentiel responsable de traitement →
  DPA signé, droit d'accès / portabilité / effacement par tenant, registre
  des activités de traitement Article 30.
- **AIAD-CRA** : isolation = mesure technique de sécurité (Article 13),
  audit trail crypto pour les opérations cross-tenant (super-admin).
- **AIAD-AI-ACT** : Article 10 — données d'entraînement, anonymisation
  obligatoire si feature IA cross-tenant.

## Références

- PostgreSQL Row-Level Security — https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- RGPD Article 28 (sous-traitant), Article 24 (responsable de traitement).
- AI Act EU 2024/1689 Article 10 (qualité des données d'entraînement).
- k-anonymity — Sweeney 2002, "k-anonymity: A model for protecting privacy".

---

*Template généré par `aiad-sdd template multi-tenant-saas`. Choisir
explicitement la stratégie d'isolation et compléter `{{service}}`. La
revue par DPO+RSSI est **obligatoire** avant `/sdd gate`.*
