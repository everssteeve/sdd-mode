---
title: "{{title}}"
parent_intent: "{{parent_intent}}"
status: draft
format: EARS
governance: AIAD-RGPD
domain: gdpr-data-export
generated-by: aiad-sdd template
---

# {{spec_id}} — {{title}}

> **Domaine** : Droit à la portabilité (Article 20 RGPD) + droit d'accès
> (Article 15 RGPD).
> **Gouvernance Tier 1 applicable** : RGPD.
> **Format** : EARS strict.

## Contexte

Permettre à un utilisateur d'exercer son **droit à la portabilité** (Article 20)
et son **droit d'accès** (Article 15) en téléchargeant ses données dans un
format structuré, courant et lisible par machine.

## Critères d'acceptation (EARS)

### R1 — Demande authentifiée

**WHEN** un utilisateur authentifié clique "Exporter mes données" dans son
espace privé,
**THE SYSTEM SHALL** créer une **DemandeExport** (statut `pending`) avec
horodatage, type (`portabilité` ou `accès`), périmètre (toutes les catégories
de données traitées par le contrôleur).

### R2 — Vérification d'identité

**WHEN** le demandeur n'est pas authentifié (par exemple via un formulaire
public ou un email DPO),
**THE SYSTEM SHALL** vérifier l'identité par un mécanisme **proportionné**
(double opt-in email, KYC light) avant de générer l'export. Tout doute
documenté → notification au DPO.

### R3 — Formats produits

**WHEN** la DemandeExport est traitée,
**THE SYSTEM SHALL** générer **simultanément** :
- `data.json` — dump structuré, navigable par machine.
- `data.csv` — fichier plat des tables principales (utilisateur, transactions,
  événements).
- `README.md` — explication des champs en français clair, base légale par
  catégorie, durée de conservation, destinataires.

### R4 — Périmètre exhaustif

**THE SYSTEM SHALL** inclure **toutes** les catégories de données personnelles
traitées : profil, journaux d'activité (login, navigation), contributions
(messages, fichiers), métadonnées techniques (IP tronquée, user-agent),
préférences, consentements, communications transactionnelles. **Exception** :
données dérivées tierces (ex. score de risque) sont fournies brutes — pas la
formule propriétaire.

### R5 — Délai légal

**THE SYSTEM SHALL** rendre l'export disponible dans un délai **≤ 30 jours**
après la demande (Article 12.3 RGPD). Délai prolongeable de 2 mois
maximum si justifié par la complexité, avec notification motivée à l'utilisateur
sous 1 mois.

### R6 — Téléchargement sécurisé

**WHEN** l'export est prêt,
**THE SYSTEM SHALL** notifier l'utilisateur (email + dashboard) avec un
lien à usage unique, expiration ≤ 7 jours, accès via authentification
forte (mot de passe + MFA si configuré). Le téléchargement chiffre le ZIP
avec un mot de passe envoyé par canal séparé (option recommandée).

### R7 — Effacement automatique

**WHEN** l'export est téléchargé OR le délai d'expiration atteint,
**THE SYSTEM SHALL** supprimer l'export du stockage temporaire dans les 24 h.

### R8 — Audit RGPD

**THE SYSTEM SHALL** logger chaque DemandeExport avec : date, demandeur (hash),
type, statut, délai effectif, format produit. Conservation 5 ans
(preuves de respect du droit en cas de contrôle CNIL).

## Gouvernance applicable

- **AIAD-RGPD** — Articles 12 (modalités), 15 (droit d'accès), 20 (portabilité),
  Article 5.1.f (sécurité).

## Anti-patterns interdits

- `JAMAIS` exiger une procédure plus lourde que l'inscription au service.
- `JAMAIS` facturer l'export (Article 12.5 — gratuit sauf demande
  manifestement excessive).
- `JAMAIS` inclure les données d'autrui dans l'export (ex. messages reçus
  contenant des données identifiantes de tiers — anonymisation requise).
- `JAMAIS` exporter sans authentification ou vérification d'identité.
- `JAMAIS` conserver les exports temporaires au-delà de 7 jours.

## Tests d'exemple

```ts
// @spec {{spec_id}}
// @verified-by tests/gdpr/{{slug}}.test.ts
// @governance AIAD-RGPD

describe('{{spec_id}} — Export RGPD', () => {
  it('R3 — produit data.json + data.csv + README.md cohérents', () => {});
  it('R4 — inclut journaux d\'activité, consentements, IP tronquée', () => {});
  it('R5 — délai ≤ 30 jours respecté', () => {});
  it('R6 — lien d\'export expiré → 410 Gone', () => {});
  it('R7 — export téléchargé → supprimé du stockage sous 24h', () => {});
  it('R8 — log d\'audit conservé 5 ans, hash demandeur, jamais en clair', () => {});
});
```

## Test de l'Étranger

- *(à compléter — quelles tables exactes inclure ? quel format prioritaire ?
  données tierces dans les messages ?)*

---

*Squelette généré par `aiad-sdd template gdpr-data-export`. Validation DPO
obligatoire avant Gate.*
