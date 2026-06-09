---
name: security
description: Audit sécurité du code (OWASP Top 10, secrets, permissions agents, conformité réglementaire)
---

# SDD Mode — Audit Sécurité

Tu es un Product Engineer AIAD. L'utilisateur veut un audit de sécurité du code implémenté.

`/sdd security` est un audit structuré sur 4 axes — recommandé après toute implémentation impliquant des accès, des données utilisateur, des secrets ou un composant IA, et avant toute PR critique. Le rapport est persisté dans `.aiad/metrics/security/`.

**Recommandation modèle** : Opus 4.8 ou équivalent frontier pour maximiser la détection.

## Skills invoquées

- 🔧 [`regulatory-veto`](../skills/regulatory-veto/SKILL.md) — couvre l'axe 4 (conformité réglementaire — AI-ACT / RGPD / RGAA / RGESN).

## Modes

- `--guided` : audit section par section
- `--fast` : rapport direct
- *(par défaut)* : auto-détection

## 🚀 Fast path

**Input** : SPEC-NNN concernée + fichiers implémentés.
**Output** : rapport persisté dans `.aiad/metrics/security/YYYY-MM-DD-SPEC-NNN.md`.

1. Recommander Opus 4.8 si pas déjà actif.
2. Parcourir les **4 axes** : OWASP / secrets / permissions agents / conformité.
3. Pour l'axe 4 (conformité), appliquer la skill `regulatory-veto`.
4. Produire le rapport : risques critiques / moyens / bonnes pratiques confirmées.

## 📖 Mode guidé

### Étape 0 — Recommandation modèle

Affiche : *"Cet audit est plus efficace avec Opus 4.8. Si tu n'es pas sur Opus 4.8, considère de basculer (`/fast` dans Claude Code)."*

### Étape 1 — Axe OWASP Top 10

Parcours le code sur les 10 catégories : A01 Broken Access Control, A02 Crypto, A03 Injection (SQL, prompt, command), A04 Insecure Design, A05 Misconfig, A06 Vulnerable Components, A07 Auth Failures, A08 Integrity, A09 Logging, A10 SSRF.

### Étape 2 — Gestion des secrets

- Secrets hardcodés ou dans les logs ?
- Variables d'env correctement référencées ?
- `.env.example` présent + `.env` dans `.gitignore` ?
- Rotation des clés documentée ?

### Étape 3 — Permissions des agents (Harness Engineering)

Principe **minimal necessary permissions** :
- Un agent de génération n'a pas accès à la prod ?
- Webhooks et tokens d'API scopés au minimum ?
- Permissions documentées dans l'AGENT-GUIDE ?

### Étape 4 — Conformité réglementaire

Applique la skill `regulatory-veto`. Si VETO → rapport **risque critique** ; si WARN → **risque moyen** avec plan.

### Étape 5 — Produire le rapport

```markdown
# Rapport Sécurité — [SPEC-NNN] — [YYYY-MM-DD]

**Modèle utilisé** : claude-opus-4-7
**SPEC auditée** : [SPEC-NNN]
**Périmètre** : [fichiers]

## Risques Critiques 🚨
[Bloquants — corriger avant merge]

## Risques Moyens ⚠️
[À adresser dans la prochaine itération]

## Bonnes Pratiques Confirmées ✅
[À conserver]

## Recommandations
[Actions priorisées : BLOQUANT / IMPORTANT / SUGGESTION]
```

Persiste dans `.aiad/metrics/security/YYYY-MM-DD-SPEC-NNN.md`.

## Règles

- Un risque critique bloque le merge — équivalent à un veto Tier 1.
- Ne pas ignorer les avertissements sur les secrets, même en dev.
- Documenter les faux positifs pour affiner les audits suivants.
- Pattern non classifiable → `JNSP` plutôt que classification optimiste « safe » (fail-closed).

## Verdict JNSP (pattern non classifiable)

L'audit sécurité est un domaine où l'optimisme par défaut est dangereux.
Sortir un verdict `JNSP` (pas « safe », pas « risque ») quand :

- Tu identifies un pattern (auth, crypto, parser, exec, sérialisation,
  comparaison de signature) **mais** tu ne peux pas vérifier sa sûreté
  sans accéder à du code non lu dans cette session.
- La dépendance utilisée n'est pas connue : pas de version, pas de
  CVE-history disponible → ne pas affirmer « non vulnérable ».
- Le scope agent est ambigu (token sans permissions documentées, hook
  utilisateur chargé depuis source non vérifiée).

Forme dans le rapport :

```markdown
## Zones non classifiables (JNSP) ❓
- [fichier:ligne] <pattern>
  Motif : <ce qui empêche de trancher>
  Question : <reformulation pour l'humain>
```

Une zone JNSP est traitée **comme un risque** pour les décisions
opérationnelles (merge bloqué) jusqu'à arbitrage humain.

## Anti-patterns

- **Audit superficiel** : parcourir le code visible sans vérifier les dépendances.
- **Reporter les risques critiques** : c'est de la dette de sécurité active.
- **Ignorer l'axe agents** : leurs permissions sont une surface d'attaque à part entière.
- **Conclure "safe" par absence de preuve** : préférer JNSP sur la zone non analysée.

$ARGUMENTS
