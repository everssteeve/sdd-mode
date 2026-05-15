---
title: "{{title}}"
parent_intent: "{{parent_intent}}"
status: draft
format: EARS
governance: AIAD-RGPD,AIAD-CRA
domain: auth-oidc
generated-by: aiad-sdd template
---

# {{spec_id}} — {{title}}

> **Domaine** : Authentification OIDC (OpenID Connect 1.0).
> **Gouvernance Tier 1 applicable** : RGPD (données personnelles) + CRA (cybersécurité produit).
> **Format** : EARS strict — tous les critères respectent les règles R1-R7.

## Contexte

Connecter l'utilisateur via un IdP OIDC (Authorization Code Flow + PKCE) pour
*(préciser le pourquoi métier — voir Intent {{parent_intent}})*.

## Critères d'acceptation (EARS)

### R1 — Initiation du flow

**WHEN** un utilisateur clique sur le bouton "Se connecter avec {{idp}}",
**THE SYSTEM SHALL** rediriger vers l'endpoint `/authorize` de l'IdP avec
les paramètres `client_id`, `redirect_uri`, `state` (généré cryptographiquement,
stocké en session), `nonce`, `scope=openid profile email`, `code_challenge`
(SHA-256 base64url d'un `code_verifier` 43-128 chars) et `code_challenge_method=S256`.

### R2 — Validation du callback

**WHEN** l'IdP redirige vers `/callback?code=...&state=...`,
**THE SYSTEM SHALL** vérifier que `state` reçu === `state` stocké en session
**AVANT** d'échanger le code contre un token.

### R3 — Échange code → tokens

**WHEN** la validation `state` réussit,
**THE SYSTEM SHALL** appeler l'endpoint `/token` de l'IdP avec
`grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier`,
`client_id` (et `client_secret` si confidential client).

### R4 — Validation du `id_token`

**WHEN** l'IdP retourne un `id_token`,
**THE SYSTEM SHALL** valider la signature JWT via les JWKS de l'IdP
(rotation supportée), vérifier `iss`, `aud`, `exp`, `nbf`, `iat`, `nonce`.

### R5 — Stockage de session

**THE SYSTEM SHALL** stocker uniquement le `subject` (sub) + scopes consentis
en session serveur (cookie HttpOnly + Secure + SameSite=Lax). **JAMAIS** le
`id_token` ni le `access_token` en clair côté client (cookie tiers, localStorage).

### R6 — Logout

**WHEN** l'utilisateur clique "Déconnexion",
**THE SYSTEM SHALL** invalider la session locale **ET** appeler le
`end_session_endpoint` (RP-Initiated Logout) si l'IdP le supporte.

### R7 — Audit

**THE SYSTEM SHALL** logger chaque tentative d'auth (succès/échec) avec
horodatage, hash du `sub`, IP tronquée (RGPD), user-agent. Logs append-only,
rétention conforme à la politique RGPD du projet.

## Gouvernance applicable

- **AIAD-RGPD** — base légale Article 6.1.b (contrat) ou .a (consentement),
  information Article 13, droits Articles 15-22, registre Article 30.
- **AIAD-CRA** — Annexe I Partie I points 4 (intégrité), 12 (auth/RBAC), 13
  (protection interfaces). Mises à jour signées + journalisation.

## Anti-patterns interdits

- `JAMAIS` Implicit Flow ou Resource Owner Password Credentials.
- `JAMAIS` accepter un `id_token` sans valider la signature.
- `JAMAIS` propager `access_token` côté client (SPA → BFF pattern requis).
- `JAMAIS` désactiver PKCE pour un client public.

## Tests d'exemple

```ts
// @spec {{spec_id}}
// @verified-by tests/auth/{{slug}}.test.ts
// @governance AIAD-RGPD,AIAD-CRA

describe('{{spec_id}} — Auth OIDC', () => {
  it('R1 — redirige avec PKCE + state + nonce générés cryptographiquement', () => {
    /* … */
  });
  it('R2 — refuse un callback avec state forgé', () => {
    /* … */
  });
  it('R4 — refuse un id_token signé avec une clé non-JWKS', () => {
    /* … */
  });
  it('R5 — ne stocke jamais l\'access_token en cookie tiers', () => {
    /* … */
  });
});
```

## Test de l'Étranger

Un développeur qui ne connaît pas le projet peut-il **implémenter** cette SPEC
sans poser de question ? Si non, lister les points ambigus ci-dessous et
demander la clarification à l'humain (Human Authorship).

- *(à compléter)*

---

*Squelette généré par `aiad-sdd template auth-oidc`. À adapter au contexte
projet — l'intention humaine reste obligatoire (Human Authorship).*
