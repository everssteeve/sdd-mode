---
name: aiad
description: Rituels AIAD + métriques — status standup retro demo intention sync-strat dora flow dashboard
---

# AIAD Router

Tu es un facilitateur AIAD. L'utilisateur a invoqué `/aiad` avec des arguments.

## Sous-commandes disponibles

| Sous-commande   | Rôle                                                          |
| --------------- | ------------------------------------------------------------- |
| `init`          | Bootstrapper AIAD sur un projet existant                      |
| `onboard`       | Briefing d'onboarding pour un nouveau membre                  |
| `status`        | État des lieux complet du projet SDD                          |
| `health`        | Diagnostic santé des artefacts (orphelins, obsolescence)      |
| `gouvernance`   | Conformité aux 4 agents de gouvernance Tier 1                 |
| `tech-review`   | Animer la tech review (Sync 3)                                |
| `standup`       | Animer le standup quotidien (Sync 5)                          |
| `demo`          | Faciliter démo & feedback (Sync 2)                            |
| `retro`         | Conduire la rétrospective de fin d'itération                  |
| `intention`     | Atelier d'Intention (rituel mensuel)                          |
| `sync-strat`    | Synchronisation alignement stratégique (Sync 1)               |
| `dora`          | Calculer et analyser les 4 métriques DORA                     |
| `flow`          | Calculer et analyser les Flow Metrics                         |
| `dashboard`     | Dashboard équipe (hebdo / mensuel)                            |

## Routage

1. Lis `$ARGUMENTS`.
   - Vide ou `help` → liste les sous-commandes ci-dessus, puis arrête-toi.
   - Sinon, le **premier mot** est la sous-commande, le **reste** devient le nouvel `$ARGUMENTS`.
2. Charge `.claude/aiad/<sous-commande>.md` avec ton outil `Read` et suis ses instructions à la lettre, en lui passant les arguments restants.
3. Si la sous-commande est inconnue, signale l'erreur et propose les sous-commandes proches.

## Notes d'architecture

- Les corps des sous-commandes sont hors de `.claude/commands/` (dans `.claude/aiad/`) pour ne pas peser sur le system prompt à froid.
- Anciens alias `/aiad-status`, `/aiad-retro`, `/aiad-dora`, … restent fonctionnels pendant 1 version. S'ils sont utilisés, signale brièvement la migration (`/aiad-status` → `/aiad status`).
- Pour l'aide globale ou contextuelle (parcours type, choix de commande), voir `/aiad-help`.

$ARGUMENTS
