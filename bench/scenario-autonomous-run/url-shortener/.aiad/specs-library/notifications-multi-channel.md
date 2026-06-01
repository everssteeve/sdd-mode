---
title: "{{title}}"
parent_intent: "{{parent_intent}}"
status: draft
format: EARS
governance: AIAD-RGPD,AIAD-CRA,AIAD-RGAA
domain: notifications-multi-channel
generated-by: aiad-sdd template
---

# {{spec_id}} — {{title}}

> **Domaine** : Notifications multi-canal — email + SMS + push +
> in-app — avec **opt-in granulaire**, **opt-out simple**, conformité
> RGPD + LCEN + ePrivacy + accessibilité RGAA.
> **Gouvernance Tier 1 applicable** : RGPD (consentement + droits) +
> CRA (signature webhooks) + RGAA (lisibilité des notifications HTML
> et SMS pour personnes en situation de handicap).
> **Format** : EARS strict — règles R1-R7.

## Contexte

Construire le système de notifications pour `{{service}}`. Chaque canal a
ses contraintes :
- **Email** — consentement transactionnel implicite (Article 22 LCEN) ou
  explicite opt-in (marketing).
- **SMS** — consentement explicite obligatoire en EU (ePrivacy).
- **Push mobile** — consentement explicite OS + consentement applicatif.
- **In-app** — pas de consentement (l'utilisateur est dans l'app).

Voir Intent {{parent_intent}}.

## Critères d'acceptation (EARS)

### R1 — Préférences canal granulaires

**WHEN** un utilisateur accède à ses préférences, **THE SYSTEM SHALL**
afficher une matrice **canal × catégorie** (transactionnel, marketing,
sécurité) avec opt-in/opt-out indépendant par cellule. Les préférences
sont persistées avec horodatage et IP (preuve de consentement RGPD).

### R2 — Consentement explicite SMS et push marketing

**WHEN** une notification SMS marketing ou push marketing est envoyée,
**THE SYSTEM SHALL** vérifier qu'un consentement **explicite** (case à
cocher non pré-cochée, horodatée) existe pour ce canal × cette catégorie.
Sans consentement → ne pas envoyer.

### R3 — Transactionnel autorisé sans opt-in marketing

**WHEN** une notification transactionnelle est émise (confirmation de
commande, alerte sécurité, mot de passe oublié), **THE SYSTEM SHALL**
l'envoyer même si l'utilisateur a opté out du marketing.

### R4 — Opt-out 1-clic obligatoire

**WHEN** une notification email/SMS est envoyée, **THE SYSTEM SHALL**
inclure un **mécanisme d'opt-out 1 clic** :
- Email : header `List-Unsubscribe` (RFC 8058) + lien `Se désabonner`.
- SMS : mention `STOP au XXXXX` (numéro court).
Le délai de prise en compte est **immédiat** (avant prochain envoi).

### R5 — RGAA accessibility des emails HTML

**WHEN** un email HTML est généré, **THE SYSTEM SHALL** respecter les
contraintes RGAA 4.1 / WCAG 2.1 AA :
- Texte alternatif sur les images (`alt`).
- Contraste ≥ 4.5:1 pour texte normal, 3:1 pour texte large.
- Structure sémantique (h1/h2/p, pas de `<table>` pour mise en page hors
  templates emailing).
- Lang attribute (`<html lang="fr">`).

### R6 — Traçabilité des envois (CRA + RGPD)

**WHEN** une notification est envoyée, **THE SYSTEM SHALL** journaliser
sans exposer le contenu sensible : `timestamp`, `user_id`, `channel`,
`category`, `provider`, `provider_message_id`, `status`. Retention 13
mois (légitime audit + débogage).

### R7 — Webhooks providers signés

**WHEN** un provider (SendGrid, Twilio, Firebase) envoie un webhook
(delivery, bounce, click), **THE SYSTEM SHALL** vérifier la signature
HMAC-SHA256 et rejeter les requêtes non signées (cap supply-chain).

### R8 — Gestion des bounces et plaintes

**WHEN** un bounce hard ou une plainte (FBL) est reçu, **THE SYSTEM
SHALL** désactiver automatiquement l'envoi futur sur ce canal pour cet
utilisateur et l'horodater. Réactivation manuelle uniquement (action
support).

### R9 — Multi-provider fallback (sobriété + résilience)

**WHEN** un provider échoue (5xx ou rate limit), **THE SYSTEM SHALL**
basculer sur un provider secondaire (Mailjet ↔ SendGrid, Twilio ↔
Vonage) sans perdre l'idempotence (event store par `notification_id`).

## Anti-patterns interdits

- **JAMAIS** envoyer du marketing à un utilisateur n'ayant pas opté in
  **explicitement** pour ce canal × catégorie.
- **JAMAIS** mettre un opt-out derrière un login obligatoire (RGPD
  Article 7.3 — opt-out aussi simple que opt-in).
- **JAMAIS** stocker en clair le contenu d'un SMS ou push avec PII
  sensible (santé, opinions politiques).
- **JAMAIS** envoyer SMS depuis un service tiers hors EU sans clause
  RGPD de transfert (US providers → BCR/CCT obligatoires).
- **JAMAIS** continuer d'envoyer après bounce hard ou plainte FBL.

## Tests d'exemple

```ts
/**
 * @intent {{parent_intent}}
 * @spec {{spec_id}}
 * @verified-by tests/notifications/opt-out-immediate.test.ts
 * @governance AIAD-RGPD,AIAD-CRA
 */
test('opt-out 1-clic prend effet immédiat (avant prochain envoi)', async () => {
  const user = await signup({ marketing: true });
  await sendNewsletter(user.id);
  await unsubscribeOneClick(user.id);
  await sendNewsletter(user.id);
  const sent = await listSentTo(user.id);
  expect(sent.length).toBe(1); // pas 2
});
```

Tests à couvrir :
- `tests/notifications/opt-out-immediate.test.ts` — opt-out → prochain
  envoi bloqué.
- `tests/notifications/transactional-allowed.test.ts` — opt-out marketing,
  reset-password reste autorisé.
- `tests/notifications/sms-consent-required.test.ts` — SMS marketing sans
  consentement explicite → bloqué.
- `tests/notifications/bounce-disable.test.ts` — bounce hard → canal
  désactivé.
- `tests/notifications/webhook-signature.test.ts` — webhook provider sans
  signature → rejeté.

## Test de l'Étranger

Un DPO doit pouvoir, **sans contexte préalable**, :
1. Voir pour chaque user les **preuves de consentement** par canal.
2. Tracer l'**opt-out** d'un utilisateur jusqu'à sa prise en compte.
3. Lister les **providers actifs** et leur conformité (sub-processor RGPD).

## Gouvernance applicable

- **AIAD-RGPD** : Article 7 (consentement libre/spécifique/éclairé/univoque),
  Article 21 (opposition), conservation des preuves 5 ans (CNIL).
- **AIAD-CRA** : webhooks signés HMAC, traçabilité envois, anti-spoofing.
- **AIAD-RGAA** : accessibilité emails HTML (texte alternatif, contraste,
  structure sémantique).
- **ePrivacy + LCEN** Article 22 (consentement préalable communications
  électroniques marketing).

## Références

- LCEN Article 22 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032925633
- RFC 8058 — One-Click Unsubscribe.
- RGAA 4.1 — https://accessibilite.numerique.gouv.fr/
- CNIL — Guide pratique sur le consentement.
- ePrivacy Directive 2002/58/EC.

---

*Template généré par `aiad-sdd template notifications-multi-channel`.
Compléter `{{service}}` et la liste exacte des providers retenus.
Soumettre ensuite à `/sdd gate`.*
