---
name: sdd
description: Cycle SDD — intent spec gate exec validate drift trace fact security audit context resume split init
---

# SDD Router

Tu es un Product Engineer AIAD. L'utilisateur a invoqué `/sdd` avec des arguments.

## Sous-commandes disponibles

| Sous-commande   | Rôle                                                          |
| --------------- | ------------------------------------------------------------- |
| `init`          | Cadrage initial (PRD + ARCHITECTURE + AGENT-GUIDE)            |
| `intent`        | Capturer une intention humaine (Intent Statement)             |
| `spec`          | Rédiger une SPEC depuis un Intent                             |
| `gate`          | Valider une SPEC via l'Execution Gate (SQS ≥ 4/5)             |
| `exec`          | Lancer l'exécution agent post-Gate                            |
| `validate`      | Valider le code produit par l'agent                           |
| `drift-check`   | Vérifier la synchronisation artefacts/code (Drift Lock)       |
| `trace`         | Matrice de traçabilité Intent ↔ SPEC ↔ Code ↔ Tests           |
| `fact`          | Capturer un écart livré/désiré                                |
| `security`      | Audit sécurité (OWASP, secrets, permissions agents)           |
| `audit`         | Audit qualité (conformité SPEC, dette, AGENT-GUIDE)           |
| `context`       | Audit Context Engineering Budget (estimation vs réel)         |
| `resume`        | Reprendre une session agent interrompue                       |
| `split`         | Découper une SPEC trop volumineuse en sous-SPECs              |

## Routage

1. Lis `$ARGUMENTS`.
   - Vide ou `help` → liste les sous-commandes ci-dessus avec une ligne d'usage chacune, puis arrête-toi.
   - Sinon, le **premier mot** est la sous-commande, le **reste** devient le nouvel `$ARGUMENTS` à passer.
2. Charge le fichier `.claude/sdd/<sous-commande>.md` (chemin relatif au repo) avec ton outil `Read` et **suis ses instructions à la lettre**, en lui passant les arguments restants.
3. Si la sous-commande est inconnue, signale l'erreur et propose les 2-3 sous-commandes les plus proches (distance d'édition).

## Notes d'architecture

- **Pourquoi les corps sont hors de `.claude/commands/`** : Claude Code charge le frontmatter de chaque fichier de `commands/` (et de ses sous-dossiers) dans le system prompt à froid. En stockant les 13 prompts SDD dans `.claude/sdd/`, ils sont chargés **uniquement à la demande** via `Read` — c'est la condition pour atteindre la cible de -70% sur le cold-start.
- Les anciens alias `/sdd-init`, `/sdd-spec`, `/sdd-gate`, … restent fonctionnels pendant 1 version et redirigent ici. S'ils sont utilisés, signale-le brièvement à l'utilisateur (« migration : `/sdd-spec` → `/sdd spec` »).
- Aucun comportement métier n'est modifié — toute la logique reste dans les sous-commandes.

$ARGUMENTS
