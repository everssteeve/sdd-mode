---
title: "{{title}}"
parent_intent: "{{parent_intent}}"
status: draft
format: EARS
governance: AIAD-RGPD,AIAD-CRA
domain: billing-stripe-tax
generated-by: aiad-sdd template
---

# {{spec_id}} — {{title}}

> **Domaine** : Facturation B2C/B2B avec **Stripe Tax** + conformité TVA EU
> (OSS / IOSS / régime national). Cible : SaaS européens vendant en UE et
> hors UE.
> **Gouvernance Tier 1 applicable** : RGPD (données fiscales clients =
> données personnelles) + CRA (intégrité chaîne de facturation).
> **Format** : EARS strict — tous les critères respectent les règles R1-R7.

## Contexte

Implémenter la facturation pour `{{service}}` avec **Stripe** comme PSP et
**Stripe Tax** comme moteur de calcul de la TVA. Le service est immatriculé
au **One Stop Shop (OSS)** pour les ventes intra-UE de services
électroniques (Article 58 directive TVA 2006/112/CE) et, le cas échéant,
**Import One Stop Shop (IOSS)** pour les biens importés < 150 €.

Voir Intent {{parent_intent}} pour la justification métier.

**Cap fiscal EU à intégrer** :
- **OSS** (services électroniques B2C intra-UE) — TVA du pays du **client**.
- **IOSS** (biens importés < 150 € B2C) — TVA pays du client, déclaration
  unique mensuelle.
- **Reverse charge B2B intra-UE** (numéro TVA validé VIES) — pas de TVA.
- **Régime hors-UE** — TVA selon règles locales (US sales tax, GST UK, etc.).

## Critères d'acceptation (EARS)

### R1 — Détection du régime fiscal applicable

**WHEN** un panier est validé pour un client `c`, **THE SYSTEM SHALL**
déterminer le régime fiscal applicable selon :
- pays du client (`billing_address.country`),
- type de client (B2C ou B2B),
- numéro de TVA intracommunautaire B2B vérifié via **VIES**
  (https://ec.europa.eu/taxation_customs/vies/),
- nature du bien/service (électronique, physique, < 150 €).

### R2 — Calcul de TVA via Stripe Tax

**WHEN** une session de paiement est créée, **THE SYSTEM SHALL** activer
`automatic_tax: { enabled: true }` dans l'API Stripe Checkout/PaymentIntent
pour déléguer le calcul TVA à Stripe Tax, avec `customer_details` complets
(adresse + numéro TVA si B2B).

### R3 — Validation VIES pour reverse charge B2B

**WHEN** un client soumet un numéro de TVA intracommunautaire, **THE SYSTEM
SHALL** valider ce numéro via l'API VIES SOAP/REST **AVANT** d'appliquer le
reverse charge, et conserver le résultat de validation (timestamp + statut)
dans la base pendant **10 ans** (obligation de conservation fiscale française).

### R4 — Facture conforme

**WHEN** un paiement réussit, **THE SYSTEM SHALL** générer une facture
incluant : numéro de facture séquentiel (chronologique, sans saut), date,
identité émetteur + n° TVA, identité client + n° TVA si B2B, détail HT/TVA/TTC,
**mention "Autoliquidation"** si reverse charge B2B intra-UE, devise, méthode
de paiement, mention "TVA acquittée selon les encaissements" si applicable.

### R5 — Conservation des factures

**THE SYSTEM SHALL** conserver chaque facture émise pendant **10 ans
minimum** (Article 1741 CGI français, Article 244-3 BIS CGI ; analogue EU)
dans un format **non modifiable** (PDF/A-3 horodaté ou format archivage à
valeur probante NF Z42-013).

### R6 — Déclaration OSS / IOSS trimestrielle/mensuelle

**WHEN** un trimestre s'achève (OSS) ou un mois (IOSS), **THE SYSTEM SHALL**
agréger les ventes par pays consommateur et fournir un export CSV/XML
exploitable pour la déclaration OSS / IOSS via le portail français
(impots.gouv.fr) ou national équivalent — avec montants en EUR (taux de
change BCE J-1 du dernier jour de la période).

### R7 — Webhook Stripe sécurisé

**WHEN** Stripe envoie un webhook `invoice.paid`, `invoice.payment_failed`,
`charge.refunded`, **THE SYSTEM SHALL** vérifier la signature
`Stripe-Signature` HMAC-SHA256 avec le webhook secret, rejeter toute
requête sans signature valide, et idempotenter le traitement via
`event.id` stocké (table `stripe_events_processed`).

### R8 — Remboursement et avoirs

**WHEN** un remboursement est demandé, **THE SYSTEM SHALL** émettre un
**avoir** numéroté (séquence distincte), référençant la facture initiale,
recalculer la TVA via Stripe Tax, et conserver l'avoir 10 ans au même
titre que la facture.

### R9 — Pas de PCI-DSS leak côté serveur

**THE SYSTEM SHALL** garantir qu'**aucune donnée carte** (PAN, CVV, expiry,
nom porteur) ne transite jamais par les serveurs propres : utiliser
Stripe Elements / Checkout côté client uniquement (cap SAQ A). Pour les
SPECs avec données carte custom, voir le template `payment-pci` séparé.

## Anti-patterns interdits

- **JAMAIS** calculer la TVA en local (taux écrits en dur) — utiliser
  **Stripe Tax** ou un moteur fiscal certifié (Avalara, Stripe Tax,
  Quaderno). Les taux changent.
- **JAMAIS** stocker un numéro de carte côté serveur, même chiffré.
- **JAMAIS** facturer un client B2B intra-UE avec TVA quand le n° VIES est
  validé (sauf cas spécifique livraison physique).
- **JAMAIS** rompre la séquence des numéros de facture (chronologie linéaire
  obligatoire, jamais de suppression — utiliser des avoirs).
- **JAMAIS** envoyer des données de facturation à un sous-traitant hors-EU
  sans clauses contractuelles type RGPD + analyse d'impact.

## Test de l'Étranger

Un comptable qui découvre le système doit pouvoir, **sans contexte
préalable**, :
1. Retrouver toute facture par numéro **et** par date émission.
2. Vérifier que la **série de numéros** est continue (pas de saut).
3. Exporter un fichier OSS trimestriel **prêt à soumettre** à impots.gouv.fr.
4. Confirmer qu'**aucun numéro de carte** n'est stocké côté serveur (audit
   sécurité).

## Tests d'exemple

```ts
/**
 * @intent {{parent_intent}}
 * @spec {{spec_id}}
 * @verified-by tests/billing/tax-vies-b2b.test.ts
 * @governance AIAD-RGPD,AIAD-CRA
 */
test('VIES valide → reverse charge B2B intra-UE', async () => {
  const session = await createCheckoutSession({
    customer: { country: 'DE', vat_id: 'DE123456789' },
    automatic_tax: { enabled: true },
  });
  expect(session.total_details.amount_tax).toBe(0);
});
```

Tests à couvrir :
- `tests/billing/tax-eu-b2c.test.ts` — 5 pays UE, taux TVA = pays client.
- `tests/billing/tax-vies-b2b.test.ts` — VIES valide → reverse charge ;
  invalide → TVA standard.
- `tests/billing/invoice-sequence.test.ts` — 100 factures, séquence
  continue, pas de gap.
- `tests/billing/webhook-signature.test.ts` — rejet sans signature, invalide ;
  idempotence sur double `event.id`.
- `tests/billing/retention.test.ts` — simuler 10 ans + 1 jour, factures
  toujours présentes.

## Gouvernance applicable

- **AIAD-RGPD** : les données fiscales (n° TVA, adresse facturation) sont
  des données personnelles → minimisation, durée conservation 10 ans
  justifiée par obligation fiscale (Article 6.1.c).
- **AIAD-CRA** : intégrité de la chaîne de facturation (numéros séquentiels
  non modifiables, webhook signature obligatoire, idempotence).

## Références

- Stripe Tax — https://stripe.com/docs/tax
- OSS / IOSS portal — https://ec.europa.eu/taxation_customs/business/vat/oss_en
- VIES validation — https://ec.europa.eu/taxation_customs/vies/
- CGI Article 1741 (conservation 10 ans) — https://www.legifrance.gouv.fr/
- Directive TVA 2006/112/CE Article 58 (lieu de prestation des services
  électroniques).
- NF Z42-013 (archivage à valeur probante).

---

*Template généré par `aiad-sdd template billing-stripe-tax`. Compléter
`{{service}}` et la nature exacte du bien/service vendu, puis soumettre à
`/sdd gate` pour validation. Si tu vends en dehors de l'EU, ajouter une
SPEC dédiée pour les régimes US/UK/CH.*
