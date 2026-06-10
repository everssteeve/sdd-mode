---
id: RESEARCH-NNN
intent: INTENT-NNN
author: [PE / humain identifiable]
date: [YYYY-MM-DD]
status: draft
---

# RESEARCH-NNN — [titre]  (← INTENT-NNN)

> Phase Research (§3.5) — entre l'Intent et la SPEC. Elle ne score PAS la
> qualité d'une SPEC (c'est le rôle du SQS) mais la **viabilité de l'intention**,
> ancrée dans le code réel. La Research informe ; **l'humain tranche le GO/NO-GO**.
> Verdict machine : `npx aiad-sdd research RESEARCH-NNN`.

## Discovery (ancrage code — agent Explore, read-only)

> Obligatoire. Cite des fichiers/zones RÉELS sous la forme `chemin:ligne`
> (ou `evidence: …`). Sans au moins un ancrage code, le verdict reste `JNSP`
> (anti-pattern « specs-to-code » : le code est le champ de bataille).

- Fichiers / zones impactés : [ex. `src/auth/login.ts:42`, `evidence: …`]
- Contraintes existantes : [patterns, dettes, dépendances déjà en place]
- Surface de test existante : [ex. `test/auth/*.test.ts`]

## Faisabilité

[Le changement est-il réalisable avec l'architecture actuelle ? À quel coût ?]

## Risques & inconnues

> Chaque item non levé devient une condition (si CONDITIONAL GO) ou un motif
> de DEFER. Une inconnue qui exige une décision humaine se note `TODO-JNSP:`.

- [Risque / inconnue 1]

## Verdict : GO | CONDITIONAL GO | DEFER | NO-GO  (confidence: NN %)

> Ligne tranchée par un humain. Sémantique des verdicts machine dérivés :
> - **GO** → PASS (exit 0) — Discovery ancré, aucune inconnue ouverte.
> - **CONDITIONAL GO** → CONDITIONAL (exit 0) — conditions ci-dessous à lever.
> - **DEFER / NO-GO** → FAIL (exit 1) — pas de passage en SPEC sans nouvelle Research.
> - Discovery vide · `TODO-JNSP` ouvert · ligne Verdict absente → JNSP (exit 2).

## Conditions (si CONDITIONAL GO)

- [Condition 1 à lever avant ou pendant la SPEC]
