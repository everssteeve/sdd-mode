---
title: "{{title}}"
parent_intent: "{{parent_intent}}"
status: draft
format: EARS
governance: AIAD-AI-ACT,AIAD-RGPD,AIAD-RGESN
domain: rag-llm
generated-by: aiad-sdd template
---

# {{spec_id}} — {{title}}

> **Domaine** : RAG (Retrieval-Augmented Generation) avec un LLM (souverain
> ou commercial). Convergence AI Act × RGPD × écoconception.
> **Gouvernance Tier 1 applicable** : AI-ACT (système IA), RGPD (si données
> personnelles dans le corpus), RGESN (consommation énergétique).
> **Format** : EARS strict.

## Contexte

Construire un système RAG qui répond à une question utilisateur en récupérant
des documents pertinents depuis un corpus puis en demandant à un LLM de
synthétiser une réponse **avec citations vérifiables**.

## Critères d'acceptation (EARS)

### R1 — Indexation contrôlée

**WHEN** un document est ingéré dans le corpus,
**THE SYSTEM SHALL** chunker (taille 500-1000 tokens, overlap ~10 %),
embarquer (modèle d'embeddings versionné), stocker dans une base vectorielle
(pgvector / Qdrant / etc.). Le **contrôle d'accès** au document est répliqué
au chunk (un chunk ne peut **jamais** être servi à un utilisateur qui n'a
pas le droit de lire le document source).

### R2 — Retrieval sécurisé

**WHEN** une question utilisateur arrive,
**THE SYSTEM SHALL** filtrer le retrieval par **ACL utilisateur** **AVANT**
le scoring de similarité. Un utilisateur ne peut **jamais** retrouver un
chunk qu'il n'a pas le droit de lire (zero leak inter-tenant).

### R3 — Prompt injection defense

**THE SYSTEM SHALL** appliquer ces défenses minimales :
- Délimitation claire entre instruction système et contenu user / docs.
- Refus de toute instruction trouvée dans les docs (`ignore previous instructions`).
- Whitelist de sortie : pas d'exécution de code, pas d'URL externes non-allowlistées.
- Garde-fou anti-PII en sortie (regex emails, CB, IBAN).

### R4 — Citations vérifiables

**THE SYSTEM SHALL** retourner avec chaque réponse la liste des **sources**
(IDs de documents + offsets) effectivement utilisées par le LLM. L'utilisateur
peut cliquer pour voir le passage source. Si aucune source pertinente n'est
trouvée, le système répond **"Je ne sais pas"** plutôt que d'halluciner.

### R5 — Article 22 RGPD — décision humaine

**WHEN** la réponse RAG influence une décision affectant l'utilisateur
(crédit, recrutement, santé),
**THE SYSTEM SHALL** rendre la décision **non purement automatisée** :
intervention humaine documentée + droit de contester (Article 22 RGPD +
Article 14 AI Act).

### R6 — Article 50 AI Act — divulgation IA

**WHEN** l'utilisateur final interagit avec le LLM,
**THE SYSTEM SHALL** afficher clairement qu'il s'agit d'une IA, pas d'un
humain. Marquage des contenus générés par IA (métadonnées + visuel si UI).

### R7 — Sobriété énergétique (RGESN)

**THE SYSTEM SHALL** cacher les requêtes fréquentes (TTL configurable),
limiter le nombre maximal de tokens en sortie (default 512), choisir le
modèle le plus petit acceptable pour la tâche. Métriques : tokens consommés
par requête, coût énergétique estimé.

### R8 — Audit AI Act

**THE SYSTEM SHALL** maintenir des logs auditables (Article 12 AI Act) :
horodatage, hash question, IDs sources retrievées, modèle utilisé, version,
latence, satisfaction utilisateur si signalée. Conservation ≥ 6 mois.

## Gouvernance applicable

- **AIAD-AI-ACT** — système IA risque limité minimum (Article 50 transparence).
  Si décisions automatisées affectant des personnes → potentiellement **haut
  risque** (Annexe III). Documentation Annexe IV via `aiad-sdd ai-act audit`.
- **AIAD-RGPD** — si corpus contient des données personnelles : base légale,
  AIPD (Article 35) via `aiad-sdd dpia`, droits utilisateur.
- **AIAD-RGESN** — consommation énergétique du modèle, optimisation
  des prompts et caching.

## Anti-patterns interdits

- `JAMAIS` indexer un corpus sans répliquer son ACL au niveau chunk.
- `JAMAIS` exécuter une instruction trouvée dans un document retrievé.
- `JAMAIS` halluciner une réponse sans citation — préférer "Je ne sais pas".
- `JAMAIS` envoyer des prompts contenant des données personnelles vers une
  API LLM hors EU sans DPA + TIA Schrems II conforme.
- `JAMAIS` désactiver le whitelisting d'URL pour gain de scope.

## Tests d'exemple

```ts
// @spec {{spec_id}}
// @verified-by tests/rag/{{slug}}.test.ts
// @governance AIAD-AI-ACT,AIAD-RGPD,AIAD-RGESN

describe('{{spec_id}} — RAG LLM', () => {
  it('R2 — utilisateur sans droit de lire document X ne retrouve aucun chunk de X', () => {});
  it('R3 — instruction "ignore previous" dans un doc → ignorée', () => {});
  it('R4 — réponse sans source pertinente → "Je ne sais pas"', () => {});
  it('R6 — chaque session affiche la mention "Vous interagissez avec une IA"', () => {});
  it('R7 — requête en cache → 0 token LLM facturé', () => {});
});
```

## Test de l'Étranger

- *(à compléter — niveau de risque AI Act ? Données personnelles dans le corpus ?
  Modèle souverain (Mistral, Llama local) ou cloud ?)*

---

*Squelette généré par `aiad-sdd template rag-llm`. Évaluation AI Act
obligatoire avant Gate (haut risque ?).*
