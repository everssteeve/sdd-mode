---
title: "{{title}}"
parent_intent: "{{parent_intent}}"
status: draft
format: EARS
governance: AIAD-RGPD,AIAD-CRA,AIAD-PSD2
domain: payment-pci
generated-by: aiad-sdd template
---

# {{spec_id}} — {{title}}

> **Domaine** : Paiement carte avec exigences PCI-DSS + PSD2 SCA + Dynamic Linking.
> **Gouvernance Tier 1 applicable** : RGPD + CRA + PSD2 (eu-financial pack).
> **Format** : EARS strict.

## Contexte

Implémenter un flux de paiement carte conforme **PCI-DSS** (jamais stocker le
PAN en clair) **+ PSD2** (SCA 2 facteurs + Dynamic Linking sur montant et
bénéficiaire). L'intégration se fait via un PSP (Stripe / Adyen / Worldline)
qui assume la responsabilité PCI-DSS Level 1 ; notre code reste **PCI-DSS SAQ A**
(Hosted Fields ou Redirect, jamais d'iFrame self-hosted manipulant le PAN).

## Critères d'acceptation (EARS)

### R1 — Tokenisation côté client

**WHEN** l'utilisateur saisit ses données carte dans le composant **fourni
par le PSP** (Stripe Elements, Adyen Components, etc.),
**THE SYSTEM SHALL** ne **jamais** voir transiter le PAN, le CVV ou la date
d'expiration sur son backend. Seul un **token PSP** opaque est échangé.

### R2 — Strong Customer Authentication (SCA)

**WHEN** la transaction est ≥ 30 € **OR** initiée par un PSP en mode SCA,
**THE SYSTEM SHALL** déclencher une authentification 3D Secure 2.x
(challenge ou frictionless selon scoring PSP) couvrant 2 facteurs
**indépendants** parmi : connaissance / possession / inhérence.

### R3 — Dynamic Linking

**WHEN** la SCA est validée,
**THE SYSTEM SHALL** vérifier que le code d'authentification reçu du PSP
est lié au **montant exact ET au bénéficiaire exact** affichés à l'utilisateur.
Toute modification ultérieure invalide le code.

### R4 — Webhook idempotent

**WHEN** le PSP envoie un webhook de confirmation `payment_intent.succeeded`,
**THE SYSTEM SHALL** vérifier la signature HMAC du webhook **AVANT** toute
opération métier. Le traitement est **idempotent** : un même `event_id` traité
deux fois ne déclenche pas deux écritures comptables.

### R5 — Réconciliation

**THE SYSTEM SHALL** réconcilier quotidiennement les transactions internes
avec les exports PSP (Balance + Payouts) et signaler tout écart > 0,01 €.

### R6 — Reporting d'incident

**WHEN** un incident opérationnel ou de sécurité majeur affecte le service
de paiement,
**THE SYSTEM SHALL** notifier l'autorité compétente (ACPR en France) dans
les **4 heures** après classification de l'incident (Article 96 PSD2 +
DORA Article 18).

### R7 — Logs et anti-fraude

**THE SYSTEM SHALL** logger toutes les tentatives de paiement (succès/échec)
avec : horodatage, hash du `customer_id`, montant, monnaie, statut, raison
si refusé. Anti-fraude : rate limiting 5 tentatives / 10 min / IP, vérification
geo-IP vs adresse de facturation.

## Gouvernance applicable

- **AIAD-RGPD** — données de paiement = données personnelles. Base légale
  Article 6.1.b. Pseudonymisation `customer_id`. Pas de stockage CVV.
- **AIAD-CRA** — Annexe I Partie I tous les points (chiffrement, signature
  webhook, journalisation, SBOM des deps PSP).
- **AIAD-PSD2** — SCA Article 97 + Dynamic Linking + RTS 2018/389.

## Anti-patterns interdits

- `JAMAIS` stocker le PAN, CVV, ou date d'expiration sur le backend.
- `JAMAIS` accepter un webhook sans vérifier la signature HMAC.
- `JAMAIS` traiter une transaction sans Dynamic Linking au-dessus du seuil SCA.
- `JAMAIS` rejouer un webhook avec un `event_id` déjà traité.
- `JAMAIS` désactiver les exemptions SCA sans documentation tracée et accord
  conformité.

## Tests d'exemple

```ts
// @spec {{spec_id}}
// @verified-by tests/payment/{{slug}}.test.ts
// @governance AIAD-RGPD,AIAD-CRA,AIAD-PSD2

describe('{{spec_id}} — Payment PCI / PSD2', () => {
  it('R1 — backend ne reçoit jamais le PAN, seulement un token PSP', () => {});
  it('R2 — déclenche SCA 3DS 2.x pour transaction ≥ 30 €', () => {});
  it('R3 — refuse un code SCA dont le montant ne match pas', () => {});
  it('R4 — webhook avec signature invalide → 401', () => {});
  it('R4 — webhook idempotent : event_id dupliqué → no-op', () => {});
  it('R5 — alerte si écart réconciliation > 0,01 €', () => {});
  it('R6 — incident classifié majeur → notification 4h', () => {});
});
```

## Test de l'Étranger

- *(à compléter — points d'ambiguïté à clarifier avec le métier / DPO / RSSI)*

---

*Squelette généré par `aiad-sdd template payment-pci`. Révision juriste +
DPO + RSSI obligatoire avant exécution Gate.*
