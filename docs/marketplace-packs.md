---
layout: default
title: Marketplace de packs gouvernance — guide auteur
lang: fr-FR
---

# Marketplace de packs gouvernance

> Crée et publie un pack de gouvernance Tier 1 communautaire pour étendre AIAD à ta juridiction (FR, DE, IT, ES, PL, NL, BE, LU, …) ou ton secteur (banque, santé, défense, secteur public).

## Pourquoi

Les 3 packs intégrés (`eu-baseline`, `us-baseline`, `uk-baseline`) couvrent les piliers réglementaires majeurs. Mais beaucoup de référentiels EU ne sont pas encore là :

- **France** : RGS (ANSSI), PASSI, Référentiel Cloud SecNumCloud, doctrine de l'État
- **Allemagne** : BSI IT-Grundschutz, C5
- **Espagne** : ENS, AEPD
- **Pays-Bas** : DUTO, BIO
- **Belgique** : NBN ISO/IEC 27002:2022 belge, Digital Belgium
- **Luxembourg** : CSSF Circulaire 12/552

Un pack **communautaire** permet à n'importe qui de packager ces référentiels et de les diffuser sans modifier le core.

## Anatomie d'un pack

```
fr-asn/                     ← un dossier = un pack
├── aiad-pack.json          ← manifest obligatoire
├── AIAD-FR-RGS.md          ← un agent Tier 1 par référentiel
├── AIAD-FR-PASSI.md
└── AIAD-FR-SECNUMCLOUD.md
```

### Manifest `aiad-pack.json`

```json
{
  "id": "fr-asn",
  "title": "Pack ANSSI / Référentiels FR",
  "description": "Référentiel Général de Sécurité, PASSI, SecNumCloud.",
  "jurisdiction": "France",
  "version": "1.0.0",
  "author": "Communauté AIAD-FR <contact@example.fr>",
  "agents": [
    "AIAD-FR-RGS.md",
    "AIAD-FR-PASSI.md",
    "AIAD-FR-SECNUMCLOUD.md"
  ],
  "checksum": "sha256-<calculé via computePackChecksum()>"
}
```

Champs obligatoires : `id`, `title`, `description`, `jurisdiction`, `version`, `agents`. Le `checksum` est optionnel mais **fortement recommandé** : sans lui, les utilisateurs doivent passer `--unsafe` pour installer.

### Format des agents Tier 1

Identique aux agents intégrés : `AIAD-XXX.md` avec sections `MISSION`, `DÉCLENCHEURS`, `RÈGLES ABSOLUES — TOUJOURS`, `RÈGLES ABSOLUES — JAMAIS`, `PROTOCOLE DE SIGNALEMENT`. Voir [`templates/.aiad/gouvernance/AIAD-RGPD.md`](https://github.com/everssteeve/sdd-mode/blob/main/templates/.aiad/gouvernance/AIAD-RGPD.md) pour un exemple complet.

## Calculer le checksum

Pour signer ton pack avant publication :

```bash
node -e "
import('aiad-sdd/lib/governance-marketplace.js').then(m => {
  const pack = m.loadCommunityPack('./fr-asn');
  console.log(m.computePackChecksum(pack));
});
"
```

Copie ensuite la sortie dans le champ `checksum` du manifest.

## Installer un pack tiers

```bash
# Pack signé (recommandé) :
npx aiad-sdd gouvernance --pack-from /path/to/fr-asn

# Pack non signé (déconseillé, accepte avec --unsafe) :
npx aiad-sdd gouvernance --pack-from /path/to/fr-asn --unsafe
```

L'installation refuse si :
- le manifest est invalide ou incomplet,
- un agent référencé est absent du dossier,
- le checksum diverge (pack altéré),
- le checksum est absent et `--unsafe` n'est pas passé.

## Publier un pack

1. Crée un repo Git public avec le dossier `aiad-pack/` à la racine.
2. Calcule et inclus le `checksum` dans le manifest.
3. Tag `v1.0.0` et publie une release GitHub.
4. Demande à l'ajouter à la [liste communautaire](https://github.com/everssteeve/sdd-mode/issues) — un index sera maintenu.
5. À terme : support natif de l'installation depuis `git+https://github.com/<user>/<repo>` (à venir, voir backlog).

## Bonnes pratiques

- **Une juridiction par pack**, pas un pack géant. Préfère `fr-anssi`, `fr-cnil-spec` plutôt qu'un `fr-baseline` monolithique.
- **Référentiel cité explicitement** dans chaque AIAD-*.md (pour audit légal).
- **Versionne** ton pack en SemVer comme une lib npm.
- **Test localement** avant publication : `aiad-sdd gouvernance --pack-from . --dry-run`.
- **Indique la responsabilité** : cite l'auteur, la date de dernière revue par un juriste.

## Limites actuelles

- Installation depuis une URL HTTPS pas encore supportée (à venir, voir [issue #46 backlog](https://github.com/everssteeve/sdd-mode/issues)).
- Pas encore de signature cryptographique asymétrique (clé publique) — le checksum SHA-256 protège contre la corruption mais pas contre un attaquant qui modifie le pack ET le manifest.

---

*Le marketplace fédère la communauté EU autour du framework. Plus il y a de packs, plus AIAD couvre les besoins réels du marché européen — toutes juridictions et tous secteurs.*
