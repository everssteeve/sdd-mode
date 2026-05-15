# Politique de sécurité

> **TL;DR** : si tu trouves une vulnérabilité dans `aiad-sdd`, **ne crée pas d'issue publique**. Utilise [GitHub Security Advisories](https://github.com/everssteeve/sdd-mode/security/advisories/new) ou écris à [evers.steeve@gmail.com](mailto:evers.steeve@gmail.com). Tu auras une réponse sous 72 h.

## Versions supportées

Seules les versions ci-dessous reçoivent des correctifs de sécurité. Les versions plus anciennes ne sont **pas** supportées — migre vers une version supportée pour bénéficier des correctifs.

| Version    | Supportée |
|------------|:---------:|
| 1.14.x     | ✅        |
| 1.13.x     | ✅ (jusqu'à 2026-08) |
| 1.12.x     | ❌        |
| < 1.12     | ❌        |

## Surface d'attaque considérée

`aiad-sdd` est un CLI Node.js zero-dep qui :

- **Lit et écrit dans le projet courant** (`.aiad/`, `.claude/`, `.cursor/`, `AGENTS.md`, `CLAUDE.md`, hooks Git).
- **Exécute le binaire `git`** localement (pour `git ls-files` et `git diff`).
- **Émet des requêtes HTTP** uniquement si `AIAD_TELEMETRY_URL` est configuré explicitement par l'utilisateur (opt-in strict).
- **N'exécute aucun code utilisateur** (pas d'`eval`, pas de `Function()`, pas de `vm`).
- **Ne télécharge rien** sans demande explicite de l'utilisateur (commandes `gouvernance --pack-from <chemin local>` uniquement).

Les classes de vulnérabilités prioritaires :

1. **Path traversal** dans `init`, `update`, `upgrade`, `dashboard`, `serveDashboard` — chemins fournis par l'utilisateur normalisés via `path.join` + `path.resolve`. Corrigé en cas de bypass connu.
2. **Code injection** via les artefacts Markdown (Intent, SPEC, gouvernance) — le parsing reste pur (frontmatter + regex), pas d'évaluation. À reporter immédiatement si une variante est trouvée.
3. **Supply chain** — `aiad-sdd` n'a aucune dépendance npm runtime (`zero-dep`). À reporter si une dépendance fantôme est détectée.
4. **Marketplace de packs** (`gouvernance --pack-from`) — validation cryptographique SHA-256 obligatoire ; refus de packs non signés sans `--unsafe`. À reporter si un contournement est trouvé.

## Comment signaler une vulnérabilité

### Canal préféré : GitHub Security Advisories

[Crée un advisory privé](https://github.com/everssteeve/sdd-mode/security/advisories/new) directement sur le repo. C'est privé jusqu'à publication coordonnée.

### Canal alternatif : email

[evers.steeve@gmail.com](mailto:evers.steeve@gmail.com) — sujet `[SECURITY] aiad-sdd <vX.Y.Z>`.

Si la vulnérabilité est sensible (ex. exfiltration de fichiers), tu peux chiffrer le message avec ma clé PGP publiée sur [keys.openpgp.org](https://keys.openpgp.org/) (à venir — pour l'instant l'email simple suffit, le repo est encore petit).

### Ce qu'il faut inclure

- Version de `aiad-sdd` affectée
- Version de Node.js et OS
- Description technique précise
- Étapes de reproduction (proof of concept minimal)
- Impact attendu (lecture de fichiers ? écriture arbitraire ? RCE ?)
- Mitigation suggérée (si tu en as une)

## Notre engagement

| Étape | SLA |
|-------|-----|
| Accusé de réception | **72 h ouvrées** |
| Premier diagnostic | **7 jours** |
| Correctif livré | **30 jours** pour critique, 90 jours pour majeur |
| Publication advisory | Coordonné avec le rapporteur |
| Allocation CVE | Si applicable, via GitHub Security |

Les vulnérabilités critiques (RCE, exfiltration, compromission supply-chain) sont traitées en priorité absolue — patch d'urgence si nécessaire.

## Reconnaissance

Toute personne qui signale une vulnérabilité de manière responsable est créditée dans le `CHANGELOG.md` au moment de la publication du correctif (sauf demande de rester anonyme). Pas de bug bounty financier pour le moment, mais ton nom sera mentionné dans les remerciements de la release.

## Hors scope

- **Bugs fonctionnels** non sécurité → utilise les [issues publiques](https://github.com/everssteeve/sdd-mode/issues).
- **Demandes de fonctionnalités** → idem, issues publiques.
- **Dépendances de runtime tierces** que tu ajoutes toi-même au projet où `aiad-sdd` est installé — pas notre périmètre. (Note : `aiad-sdd` lui-même est zero-dep runtime.)
- **Vulnérabilités dans Node.js, Git, ou un agent IA** (Claude Code, Cursor, Codex, Gemini) — à signaler à l'éditeur concerné.

## Bonnes pratiques côté utilisateur

Pour limiter ta propre surface d'attaque :

- Toujours utiliser `npx aiad-sdd@<version-épinglée>` plutôt que `latest` en CI.
- Vérifier la signature `--provenance` du tarball npm avant de le commiter dans un environnement sensible.
- Activer `aiad-sdd update --check` dans ta CI pour détecter les divergences entre commandes installées et package.
- Ne **jamais** committer de secrets dans `.aiad/` (Intents, SPECs, etc.). Les artefacts métier sont versionnés avec le code.
- Quand tu installes un pack gouvernance communautaire, vérifie le `checksum` SHA-256 affiché à l'installation.

## Process de divulgation coordonnée

1. **Réception** (T+0) — accusé de réception envoyé.
2. **Triage** (T+72h) — confirmation que le bug est exploitable, niveau de gravité (critical/high/medium/low CVSS).
3. **Patch** — développement en privé sur une branche advisory.
4. **Validation** — le rapporteur valide le correctif si volontaire.
5. **Release** — publication du correctif sur npm + tag git.
6. **Disclosure** — publication de l'advisory GitHub avec crédits, 1 à 7 jours après la release.

Une vulnérabilité critique non corrigée 90 jours après divulgation est considérée comme acquise au public — disclosure forcée.

---

**Référence** : [responsible disclosure principles (CERT/CC)](https://www.cert.org/vulnerability-analysis/), conforme aux exigences du [Cyber Resilience Act EU 2024/2847](https://eur-lex.europa.eu/eli/reg/2024/2847/oj) (vulnerability handling) qui s'appliquera dès 2027 aux logiciels commercialisés en EU.
