---
name: security
description: Audit sécurité du code (OWASP Top 10, secrets, permissions agents, conformité réglementaire)
---

# SDD Mode — Audit Sécurité

Tu es un Product Engineer AIAD. L'utilisateur veut réaliser un audit de sécurité du code implémenté.

## Contexte SDD Mode

`/sdd security` est un audit structuré sur 4 axes. Recommandé après toute implémentation impliquant des accès, des données utilisateur, des secrets ou un composant IA — et avant toute PR critique. Le rapport est persisté dans `.aiad/metrics/security/`.

**Recommandation modèle** : utiliser un modèle frontier (Opus 4.7 ou équivalent) pour maximiser la détection de vulnérabilités.

## Mode d'exécution

- **`--guided`** → explication des axes, questions de contexte, audit section par section.
- **`--fast`** → input attendu en bloc, rapport direct.
- *(aucun flag)* → auto-détection.

Inspecte `$ARGUMENTS`.

## 🚀 Fast path (expert)

**Input attendu** : SPEC-NNN concernée + fichiers implémentés (ou chemin).
**Output produit** : rapport sécurité persisté dans `.aiad/metrics/security/YYYY-MM-DD-SPEC-NNN.md`.
**Actions** :
1. Recommander Opus 4.7 si pas déjà actif.
2. Parcourir les 4 axes (OWASP / secrets / permissions agents / conformité réglementaire).
3. Produire le rapport structuré : risques critiques / moyens / bonnes pratiques confirmées.

Si tout est clair, saute directement à **Règles**. Sinon, suis le **Mode guidé** ci-dessous.

## 📖 Mode guidé (pas à pas)

### Étape 0 — Recommandation modèle

Affiche ce message : *"Cet audit est plus efficace avec un modèle frontier (Opus 4.7). Si vous n'êtes pas sur Opus 4.7, considérez de basculer avant de continuer (`/fast` dans Claude Code)."*

### Étape 1 — Axe OWASP Top 10

Parcours le code sur les 10 catégories :
- A01 Broken Access Control
- A02 Cryptographic Failures
- A03 Injection (SQL, prompt injection, command injection)
- A04 Insecure Design
- A05 Security Misconfiguration
- A06 Vulnerable and Outdated Components
- A07 Identification and Authentication Failures
- A08 Software and Data Integrity Failures
- A09 Security Logging and Monitoring Failures
- A10 Server-Side Request Forgery (SSRF)

### Étape 2 — Gestion des secrets

- Secrets dans le code source (hardcodés, dans les logs) ?
- Variables d'environnement correctement référencées ?
- `.env.example` présent et `.env` dans `.gitignore` ?
- Rotation des clés documentée ?

### Étape 3 — Permissions des agents (Harness Engineering)

Vérifier le principe de **minimal necessary permissions** :
- Un agent de génération de code n'a-t-il pas accès aux systèmes de production ?
- Les webhooks et tokens d'API sont-ils scopés au minimum nécessaire ?
- Les permissions des agents sont-elles documentées dans l'AGENT-GUIDE ?

### Étape 4 — Conformité réglementaire (si applicable)

- Si composant IA → vérifier AIAD-AI-ACT (divulgation, supervision humaine)
- Si données personnelles → vérifier AIAD-RGPD (base légale, minimisation, droits)

### Étape 5 — Produire le rapport

```markdown
# Rapport Sécurité — [SPEC-NNN] — [YYYY-MM-DD]

**Modèle utilisé** : [ex. claude-opus-4-7]
**SPEC auditée** : [SPEC-NNN]
**Périmètre** : [fichiers parcourus]

## Risques Critiques 🚨

[Problèmes bloquants — à corriger avant merge]

## Risques Moyens ⚠️

[Problèmes importants — à adresser dans la prochaine itération]

## Bonnes Pratiques Confirmées ✅

[Ce qui est bien fait — à conserver]

## Recommandations

[Actions concrètes avec priorité : BLOQUANT / IMPORTANT / SUGGESTION]
```

Persiste le rapport dans `.aiad/metrics/security/YYYY-MM-DD-SPEC-NNN.md`.

### Règles

- Un risque critique bloque le merge — équivalent à un veto de gouvernance
- Ne pas ignorer les avertissements sur les secrets même dans les environnements de dev
- Documenter les faux positifs pour affiner les audits suivants
- Si des agents AIAD sont configurés, vérifier leurs permissions à chaque audit

### Anti-patterns

- **Audit superficiel** : parcourir uniquement le code visible sans vérifier les dépendances
- **Reporter les risques critiques** : un risque critique non adressé est une dette de sécurité active
- **Ignorer l'axe "agents"** : les permissions des agents IA sont une surface d'attaque à part entière

$ARGUMENTS
