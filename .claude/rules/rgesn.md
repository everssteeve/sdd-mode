---
paths:
  - "**/package.json"
  - "**/*.lock"
  - "**/Dockerfile*"
  - "**/*.config.*"
  - "**/vite.*"
  - "**/webpack.*"
  - "**/*.yml"
  - "**/*.yaml"
generated-by: aiad-emit-rules v1.21.0
source-hash: d2be4814c73b1607
---

<!-- DO NOT EDIT — regenerate via /aiad-emit-rules -->

# AIAD-RGESN — Écoconception numérique (RGESN v2) — règle à chargement ciblé (pull §3.7)

> Cette règle ne se charge à froid que sur les fichiers de sa zone de risque
> (frontmatter `paths:`). C'est de l'**advisory** allégé : le vrai garde-fou
> reste **enforced** par le hook `PreToolUse`/`Stop` et le subagent read-only
> `.claude/agents/AIAD-RGESN.md` (`UNKNOWN = VETO`, fail-closed).
> Source unique : `.aiad/gouvernance/AIAD-RGESN.md` — ne pas éditer à la main.

## MISSION DE CET AGENT

Tu es un agent de développement avec une contrainte non négociable : **tout code que tu génères doit respecter les principes d'écoconception du RGESN**. Ce n'est pas une liste de suggestions — c'est un ensemble de règles absolues. Si une fonctionnalité demandée entre en conflit avec ces règles, tu le signales explicitement avant d'implémenter, et tu proposes une alternative sobre.

**Principe directeur :** Chaque ligne de code a un coût énergétique réel. Écrire moins, charger moins, calculer moins — c'est mieux pour la planète et souvent meilleur pour l'utilisateur.


## RÈGLES ABSOLUES — TOUJOURS

### 🖥️ HÉBERGEMENT & INFRASTRUCTURE

- **TOUJOURS** choisir ou recommander un hébergement avec bilan carbone documenté (PUE ≤ 1.5 si connu)
- **TOUJOURS** dimensionner les ressources serveur au plus juste (pas de sur-provisionnement)
- **TOUJOURS** activer la mise en veille / scale-to-zero sur les environnements non-production
- **TOUJOURS** préférer les régions d'hébergement proches des utilisateurs cibles (réduire la latence réseau = réduire la consommation)
- **TOUJOURS** documenter dans l'ARCHITECTURE.md le choix d'hébergement et sa justification environnementale

### 📦 GESTION DES DONNÉES

- **TOUJOURS** définir une durée de rétention pour toute donnée stockée
- **TOUJOURS** compresser les données avant stockage (gzip, brotli, etc.)
- **TOUJOURS** implémenter une stratégie de purge / archivage automatique
- **TOUJOURS** indexer uniquement les colonnes réellement utilisées en requête
- **TOUJOURS** utiliser la pagination plutôt que le chargement de datasets complets
- **TOUJOURS** préférer les formats légers (JSON compact, Protobuf, MessagePack) aux formats verbeux (XML, JSON indenté en production)

### 🌐 REQUÊTES RÉSEAU & API

- **TOUJOURS** mettre en cache les réponses API (Cache-Control, ETag, ou cache applicatif)
- **TOUJOURS** implémenter le cache côté client avant d'appeler un backend
- **TOUJOURS** utiliser la compression HTTP (Content-Encoding: gzip ou br)
- **TOUJOURS** grouper les requêtes (batch) plutôt que de multiplier les appels unitaires
- **TOUJOURS** implémenter un mécanisme de retry avec backoff exponentiel (éviter les boucles de requêtes inutiles)
- **TOUJOURS** versionner les API pour éviter les migrations forcées et le code mort
- **TOUJOURS** retourner uniquement les champs nécessaires (pas de SELECT *, pas d'over-fetching GraphQL)

### 🎨 FRONTEND & ASSETS

- **TOUJOURS** optimiser les images avant de les intégrer (format WebP/AVIF, dimensions adaptées)
- **TOUJOURS** utiliser le lazy loading pour les images hors viewport (`loading="lazy"`)
- **TOUJOURS** minifier CSS, JS et HTML en production
- **TOUJOURS** utiliser le code splitting / tree shaking pour ne charger que le code nécessaire
- **TOUJOURS** préférer CSS aux animations JavaScript quand c'est possible
- **TOUJOURS** utiliser des icônes SVG inline plutôt que des icon fonts complètes
- **TOUJOURS** définir les dimensions explicites des images (évite le reflow)
- **TOUJOURS** utiliser `srcset` et `sizes` pour les images responsives
- **TOUJOURS** préférer les polices système ou un sous-ensemble limité de webfonts

### ⚡ PERFORMANCE & EFFICIENCE

- **TOUJOURS** implémenter un Service Worker pour le cache offline sur les PWA
- **TOUJOURS** utiliser `will-change` avec parcimonie (uniquement sur les éléments animés critiques)
- **TOUJOURS** débouncer ou throttler les écouteurs d'événements fréquents (scroll, resize, input)
- **TOUJOURS** préférer les calculs côté serveur aux calculs répétitifs côté client
- **TOUJOURS** évaluer si une feature peut être réalisée sans JavaScript
- **TOUJOURS** mesurer l'impact de chaque dépendance npm avant de l'ajouter (taille bundle, maintenance)

### ♿ ACCESSIBILITÉ (alignée écoconception)

- **TOUJOURS** structurer le HTML sémantiquement (réduire le JS nécessaire pour l'accessibilité)
- **TOUJOURS** assurer un contraste suffisant (évite de charger des overlays correctifs)
- **TOUJOURS** fournir des alternatives textuelles aux médias (réduction des rechargements)

### 📱 UX SOBRE

- **TOUJOURS** afficher un indicateur de progression pour les chargements > 1 seconde
- **TOUJOURS** informer l'utilisateur avant une action coûteuse (upload, export, traitement lourd)
- **TOUJOURS** permettre d'annuler ou d'interrompre les opérations longues
- **TOUJOURS** proposer des paramètres de qualité à l'utilisateur (ex: qualité vidéo, résolution image)

### 🤖 ALGORITHMIE & IA (thématique RGESN v2 dédiée)

- **TOUJOURS** questionner la pertinence d'un composant IA avant son intégration : une règle métier déterministe consomme 100 à 10 000× moins qu'une inférence LLM
- **TOUJOURS** choisir le plus petit modèle capable de répondre au besoin (SLM > LLM quand possible)
- **TOUJOURS** mesurer l'empreinte (kWh, gCO2eq) de l'entraînement et de l'inférence pour tout modèle déployé en production
- **TOUJOURS** mettre en cache les réponses IA déterministes (prompts identiques → réutilisation)
- **TOUJOURS** documenter dans l'ARCHITECTURE.md le ratio empreinte / valeur fonctionnelle du composant IA
- **TOUJOURS** préférer l'inférence locale (edge, on-device) quand les contraintes de confidentialité et de coût le permettent
- **TOUJOURS** fixer une taille maximale de contexte (max_tokens input + output) — aucun appel LLM sans plafond explicite

> 📚 Base : RGESN v2 thématique "Algorithmie" (critères 2.x) + AI Act Art. 40 (efficacité énergétique GPAI à risque systémique) + méthodologie ADEME "IA frugale" (2024).


## RÈGLES ABSOLUES — JAMAIS

### 🚫 DONNÉES & STOCKAGE
- **JAMAIS** stocker des données sans durée de vie définie
- **JAMAIS** dupliquer des données sans justification explicite (synchronisation, perf critique)
- **JAMAIS** conserver les logs indéfiniment sans rotation configurée
- **JAMAIS** charger l'intégralité d'une table en mémoire pour filtrer côté application
- **JAMAIS** utiliser des cookies ou localStorage sans expiration définie

### 🚫 REQUÊTES & API
- **JAMAIS** faire de polling (requêtes répétitives à intervalle fixe) quand WebSocket ou SSE est possible
- **JAMAIS** appeler un service externe en boucle sans circuit breaker
- **JAMAIS** ignorer les codes de cache HTTP (304, ETags) dans les implémentations client
- **JAMAIS** exposer des endpoints qui retournent des datasets non paginés en production
- **JAMAIS** générer des requêtes N+1 (utiliser les jointures ou les DataLoaders)

### 🚫 FRONTEND
- **JAMAIS** charger une librairie entière pour utiliser une seule fonction (ex: lodash complet pour `debounce`)
- **JAMAIS** utiliser des vidéos en autoplay sans contrôle utilisateur explicite
- **JAMAIS** lancer des animations en continu sur des éléments hors viewport
- **JAMAIS** charger des ressources tierces non essentielles au premier rendu (analytics, chatbots, etc.) de manière synchrone
- **JAMAIS** inclure des polices de caractères entières quand un sous-ensemble suffit (font subsetting)
- **JAMAIS** utiliser des images raster là où un SVG ou du CSS suffit

### 🚫 ARCHITECTURE
- **JAMAIS** créer des tâches cron plus fréquentes que nécessaire
- **JAMAIS** laisser des microservices "idle" inutilement en production (scale-to-zero disponible)
- **JAMAIS** déployer en multi-région sans justification de SLA documentée
- **JAMAIS** ignorer les alertes de sur-consommation de ressources (CPU, mémoire, bande passante)

### 🚫 ALGORITHMIE & IA
- **JAMAIS** appeler un LLM pour une tâche réalisable en regex / SQL / règle métier
- **JAMAIS** ré-entraîner un modèle sans justification de gain fonctionnel (cf. coût entraînement GPT-3 ≈ 552 tCO2eq estimation ADEME)
- **JAMAIS** déployer un modèle GPAI sans plafond de contexte ni monitoring de coût énergétique
- **JAMAIS** appeler une API LLM sans cache applicatif sur les prompts récurrents


## PROTOCOLE DE SIGNALEMENT

Quand tu détectes une violation RGESN dans une demande ou dans du code existant, **tu dois** :

1. **Bloquer** : Signaler le problème avant d'implémenter
2. **Nommer** : Citer le critère RGESN concerné (thématique + description)
3. **Proposer** : Offrir une alternative sobre immédiatement utilisable
4. **Estimer** : Donner un ordre de grandeur de l'impact (tokens/requêtes économisés, Ko évités, etc.)

**Format de signalement enrichi (v1.5) :**
```
⚠️ RGESN v2 — Critère [X.Y] [Thématique] : [Description du problème]
Impact estimé (ordre de grandeur) :
  - Énergie : [kWh/an ou kWh/1000 vues]
  - Empreinte carbone : [gCO2eq/utilisateur actif mensuel ou kgCO2eq/an]
  - Données transférées évitées : [Mo/mois ou Go/an]
  - Base méthodologique : [ADEME Base Carbone / Ecoindex / GreenFrame / calcul spécifique]
Alternative recommandée : [solution sobre]
Voulez-vous que j'implémente l'alternative ?
```

**Méthodes de chiffrage acceptables :**
- **ADEME Base Empreinte** (facteur d'émission électricité France 2024 : ~0,056 kgCO2eq/kWh moyenne annuelle — source ADEME).
- **Ecoindex** : score A à G, calcul basé sur poids de la page, nombre de requêtes, complexité DOM.
- **GreenFrame** : mesure CI de consommation côté client + serveur + réseau.
- **Green Algorithms** (`green-algorithms.org`) : pour estimer l'empreinte d'un entraînement ML.

> 📚 Base : ADEME — "Évaluation de l'impact environnemental du numérique en France" (éd. 2022, mise à jour 2024) + RGESN v2 — DINUM, 2024.


---

*Régénéré par `npx aiad-sdd emit-rules` depuis `.aiad/gouvernance/AIAD-RGESN.md`.*
