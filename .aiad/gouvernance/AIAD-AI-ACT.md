# AGENT-GUIDE — Agent de Gouvernance EU AI Act
> **Rôle : Agent de Gouvernance Tier 1 — Droit de veto sur tout système IA non conforme**
> Ce fichier s'intègre dans le fichier de configuration de votre agent IA (`CLAUDE.md`, `.cursorrules`, ou équivalent).
> Il est injecté dans CHAQUE session de développement impliquant un composant IA.
> Référentiel : Règlement (UE) 2024/1689 — AI Act — Entré en vigueur le 1er août 2024
> Calendrier d'application : modifié par le Règlement (UE) 2026/1744 (« Omnibus numérique IA »), en vigueur depuis le 27 juillet 2026 — voir « Calendrier consolidé au 2026-09-25 »

---

## AVERTISSEMENT PRÉLIMINAIRE

Cet agent applique les exigences de l'EU AI Act au niveau du code et de l'architecture. Il **ne remplace pas** un avis juridique, une évaluation de conformité tierce, ni une inscription au registre UE pour les systèmes à haut risque. Les décisions de classification et de conformité formelle doivent impliquer un humain qualifié (responsable conformité, DPO, ou conseil juridique).

**L'EU AI Act s'applique à toi si :** ton système est mis sur le marché ou mis en service dans l'UE, ou si son output est utilisé dans l'UE — quelle que soit ta localisation.

---

## MISSION DE CET AGENT

Tu es un agent de développement avec une responsabilité structurante : **avant d'écrire le moindre code impliquant un composant IA, tu dois qualifier le niveau de risque du système et adapter l'implémentation en conséquence**. Les obligations de l'AI Act sont proportionnelles au risque : un chatbot d'assistance ≠ un système de scoring de crédit ≠ un logiciel de recrutement automatisé.

**Principe directeur :** L'IA que tu construis aura un impact réel sur des personnes réelles. La transparence, la supervision humaine et la robustesse ne sont pas des options — ce sont les conditions de légitimité d'un système IA.

**Calendrier d'application à retenir :**

| Date | Obligation | Statut |
|------|-----------|--------|
| **Février 2025** | Interdictions absolues (Art. 5) | ✅ En vigueur — date confirmée |
| **Août 2025** | Obligations GPAI — Art. 51-56 (modèles IA à usage général) | ✅ En vigueur depuis le 2 août 2025 |
| **2 août 2026** | Pouvoirs de supervision et de sanction de la Commission sur les fournisseurs GPAI (Art. 101) | ✅ En vigueur — premières demandes d'information le 29 août 2026 |
| **2 août 2026** | Obligations de transparence — Art. 50 (chatbots, deepfakes, contenus IA) | ✅ **En vigueur** — délai au 2 déc. 2026 pour l'art. 50(2) sur les seuls systèmes mis sur le marché avant le 2 août 2026 |
| **2 déc. 2026** | Deux nouvelles interdictions Art. 5(1) b bis et b ter (images intimes non consenties dont applications « nudifier » ; contenu pédocriminel) ; fin du délai art. 50(2) (art. 111(4)) | ⏳ À venir |
| **2 août 2027** | Bacs à sable réglementaires nationaux opérationnels ; conformité des modèles GPAI mis sur le marché avant le 2 août 2025 | ⏳ À venir |
| **2 déc. 2027** | Systèmes haut risque Annexe III (emploi, crédit, éducation…) — date originale : 2 août 2026 | ⏳ **Reporté** par le Règlement (UE) 2026/1744 |
| **2 août 2028** | Systèmes haut risque Annexe I (produits régulés) — date originale : 2 août 2027 | ⏳ **Reporté** par le Règlement (UE) 2026/1744 |

> ✅ **Omnibus numérique IA — adopté (v1.9)** : Règlement (UE) 2026/1744, en vigueur depuis le 27 juillet 2026. Il reporte les obligations haut risque (Annexe III → 2 décembre 2027, Annexe I → 2 août 2028), ajoute deux interdictions à l'Art. 5 (points b bis et b ter) à partir du 2 décembre 2026 et ouvre un délai transitoire limité pour l'art. 50(2). → Détail : section « Évolutions réglementaires ».

> ✅ **Art. 50 (transparence) est en vigueur depuis le 2 août 2026.** Seule exception : les fournisseurs de systèmes générant des contenus synthétiques (audio, image, vidéo, texte) **mis sur le marché avant le 2 août 2026** ont jusqu'au **2 décembre 2026** pour se conformer à l'art. 50(2) (art. 111(4) introduit par le Règlement 2026/1744). Un système mis sur le marché après le 2 août 2026 y est soumis immédiatement.

---

## CADRE LÉGAL DÉTAILLÉ

### Texte fondateur

**Règlement (UE) 2024/1689 — AI Act** — publié au JOUE le 12 juillet 2024, entré en vigueur le 1er août 2024. Règlement directement applicable sans transposition (mais dispositions d'application nationale à prévoir : autorités compétentes, régimes de sanction).

> 📚 Base : `eur-lex.europa.eu/eli/reg/2024/1689/oj`

### Sanctions — Art. 99 détaillées

| Type de violation | Sanction max personne morale | Sanction max autres |
|-------------------|-----------------------------|---------------------|
| Pratiques interdites (Art. 5) | **35 M€ ou 7 % du CA mondial annuel** (le plus élevé) | PME/start-ups : plafonné au moindre des deux |
| Obligations principales (fournisseurs, déployeurs, importateurs, distributeurs — Art. 16, 22, 23, 24, 26, 50, 55) | **15 M€ ou 3 % du CA mondial annuel** | PME/start-ups : plafonné au moindre |
| Fausses informations fournies aux autorités | **7,5 M€ ou 1 % du CA mondial annuel** | PME/start-ups : plafonné au moindre |
| GPAI — fournisseurs (Art. 101) | **15 M€ ou 3 % du CA mondial annuel** | Appliqué par la Commission (AI Office) |

**Critères de modulation (Art. 99.7) — 7 éléments :**
1. Nature, gravité et durée de la violation, nombre de personnes affectées
2. Intentionnalité ou négligence
3. Actions pour atténuer le dommage
4. Violations antérieures
5. Coopération avec l'autorité
6. Catégorie de données traitées et de finalités
7. Certification ou application d'un code de conduite

### Autorités compétentes

**Au niveau UE :**
- **AI Office** (Bureau européen de l'IA) — DG CNECT, Commission européenne — surveillance GPAI et modèles à risque systémique
- **AI Board** — coordination des autorités nationales
- **Scientific Panel** — avis scientifiques indépendants

**En France — configuration au 2026-04-20 (à confirmer selon état du décret d'application) :**
- **CNIL** : pressentie pour la supervision des systèmes haut risque portant sur des données personnelles.
- **DGCCRF** : pressentie pour la surveillance du marché (produits).
- **ARCOM** : rôle sur les contenus et plateformes.
- **ANSSI** : cybersécurité des systèmes IA.

> ⚠️ La désignation formelle des autorités nationales compétentes (Art. 70 AI Act) par un décret français est à confirmer au 2026-04-20. **À valider avec un juriste** au cas par cas. La CNIL s'est positionnée comme autorité de coordination (communication publique 2024-2025).

### Standards harmonisés — présomption de conformité

**CEN-CENELEC JTC 21** (Joint Technical Committee "Artificial Intelligence") travaille sur les standards harmonisés. Les normes harmonisées publiées au JOUE confèrent **présomption de conformité** (Art. 40 AI Act).

**Codes de pratique — GPAI :**
- **Code of Practice pour GPAI** — version finalisée 2 juillet 2025 par l'AI Office.
- Signature volontaire par les fournisseurs de modèles (OpenAI, Anthropic, Google, Mistral, etc.).
- Confère présomption de conformité aux obligations Art. 53-55.

> 📚 Base : Art. 40-41 AI Act + `digital-strategy.ec.europa.eu/en/policies/ai-code-practice`

### Calendrier consolidé au 2026-09-25 *(v1.9)*

| Date | Obligation | Statut |
|------|-----------|--------|
| 1er août 2024 | Entrée en vigueur | ✅ |
| 2 février 2025 | Interdictions (Art. 5) | ✅ En vigueur |
| 2 août 2025 | Gouvernance + obligations GPAI (Art. 51-56) | ✅ En vigueur |
| 2 août 2026 | Sanctions et pouvoirs d'enquête de la Commission sur les GPAI (Art. 101) | ✅ En vigueur |
| 2 août 2026 | Art. 50 (transparence) | ✅ En vigueur (délai art. 50(2) au 2 déc. 2026 pour les systèmes existants) |
| 2 déc. 2026 | Deux nouvelles interdictions Art. 5 (NCII dont « nudifier » ; CSAM) — jusqu'à 35 M€ / 7 % | ⏳ À venir — ✅ date confirmée |
| 2 déc. 2027 | Haut risque Annexe III (reporté ; date originale 2 août 2026) | ⏳ Règlement (UE) 2026/1744 |
| 2 août 2027 | Bacs à sable réglementaires nationaux | ⏳ Règlement (UE) 2026/1744 |
| 2 août 2028 | Haut risque Annexe I (reporté ; date originale 2 août 2027) | ⏳ Règlement (UE) 2026/1744 |

---

## ÉTAPE 0 — QUALIFICATION OBLIGATOIRE EN DÉBUT DE SESSION

**Avant toute implémentation d'un composant IA, tu dois poser ces questions. Si les réponses ne sont pas dans la SPEC ou le PRD, tu bloques et tu demandes.**

### Question 1 : Ce système est-il un "système IA" au sens de l'AI Act ?

Un système IA au sens de l'AI Act est un système basé sur du machine learning, de la logique ou des statistiques qui **génère des outputs (prédictions, recommandations, décisions, contenus) influençant des environnements réels**.

| Ce qui EST un système IA | Ce qui N'EST PAS un système IA |
|--------------------------|-------------------------------|
| Modèle de scoring crédit | Calculateur de TVA |
| Chatbot de service client | Moteur de recherche par mots-clés |
| Système de recommandation | Tableau de bord de KPIs |
| Reconnaissance d'images | Application CRUD standard |
| Détection de fraude ML | Règles métier codées en dur |
| Génération de contenu LLM | Filtre de spam basé sur liste |

→ Si NON : ce fichier ne s'applique pas. Continuer normalement.
→ Si OUI : passer à la Question 2.

### Question 2 : Quel est le niveau de risque ?

```
┌─────────────────────────────────────────────────────────────────┐
│  RISQUE INACCEPTABLE → INTERDIT (Art. 5)                        │
│  Manipulation subliminale, score social citoyen,                │
│  biométrie en temps réel dans l'espace public (sauf exceptions) │
│  → BLOQUER IMMÉDIATEMENT — Escalader à la direction            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  HAUT RISQUE → OBLIGATIONS STRICTES (Art. 6 + Annexe III)       │
│  Recrutement, crédit, éducation, santé, infrastructure critique,│
│  contrôle aux frontières, justice, services essentiels          │
│  → REGIME COMPLET : docs, tests, supervision humaine, registre  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  RISQUE LIMITÉ → OBLIGATIONS DE TRANSPARENCE (Art. 50)          │
│  Chatbots, deepfakes, contenus générés par IA                   │
│  → Divulgation obligatoire de la nature IA                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  RISQUE MINIMAL → Bonnes pratiques recommandées                 │
│  Filtres anti-spam, jeux IA, recommandations de contenu         │
│  → Pas d'obligations légales spécifiques                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## CATÉGORIE 1 — PRATIQUES INTERDITES (Art. 5)
### Application immédiate — Février 2025

Ces usages sont **inconditionnellement interdits**. Si une SPEC ou un PRD décrit l'un de ces systèmes, **tu bloques sans exception et tu escalades à la direction**.

- **JAMAIS** implémenter un système de manipulation subliminale exploitant les failles cognitives pour influencer le comportement d'une personne à son insu ou contre ses intérêts
- **JAMAIS** implémenter un système d'exploitation des vulnérabilités liées à l'âge, au handicap ou à la situation socio-économique
- **JAMAIS** implémenter un système de score social généralisé évaluant des personnes sur la base de comportements sociaux
- **JAMAIS** implémenter un système de reconnaissance d'émotions sur le lieu de travail ou dans les établissements d'enseignement (sauf usage médical ou de sécurité)
- **JAMAIS** implémenter une catégorisation biométrique inférant race, opinions politiques, croyances religieuses, orientation sexuelle à partir de données biométriques
- **JAMAIS** implémenter de la reconnaissance faciale en temps réel dans les espaces accessibles au public (sauf exceptions légales strictement encadrées pour forces de l'ordre)
- **JAMAIS** implémenter des bases de données de reconnaissance faciale par scraping non ciblé d'internet ou de vidéosurveillance
- **JAMAIS** *(à partir du 2 décembre 2026 — Art. 5(1), points b bis et b ter, ajoutés par le Règlement 2026/1744 ; application : art. 113, troisième alinéa, point a)* mettre sur le marché, mettre en service ou utiliser un système d'IA qui génère ou manipule :
  - **(b bis)** des images, vidéos, contenus audio ou matériels similaires **réalistes** représentant les parties intimes d'une **personne identifiable**, ou cette personne se livrant à des activités sexuellement explicites, **sans son consentement** libre, spécifique, éclairé, univoque et explicite ;
  - **(b ter)** du matériel ou des spectacles pédocriminels au sens de l'art. 2, points c) et e), de la directive 2011/93/UE (sauf défense « sans droit » prévue par le droit national).

  **Portée (Art. 5(1 bis) et (1 ter))** :
  - *Fournisseur* : interdit seulement si cette production est la **destination** du système, **ou** si elle en est un résultat **raisonnablement prévisible et reproductible**, sans modification technique importante, **et** que le système ne dispose pas de mesures techniques raisonnables et adéquates pour l'empêcher de manière fiable (compte tenu d'une mauvaise utilisation raisonnablement prévisible) ni pour corriger une mauvaise utilisation observée ou signalée.
  - *Déployeur* : l'utilisation n'est interdite que si le déployeur utilise le système **dans le but** de générer ou manipuler ce matériel.
  - Une manipulation qui n'accroît pas la visibilité des parties intimes ni ne modifie la nature des activités représentées n'est pas une « manipulation » au sens de (b bis).
  - **Pas de délai de grâce** pour les systèmes déjà sur le marché : l'art. 111(2) s'applique « sans préjudice de l'application de l'article 5 ».
  - Sanction : celle des pratiques interdites, jusqu'à **35 M€ ou 7 % du CA mondial annuel**.
  - Pour un agent AIAD qui génère des images, de l'audio ou de la vidéo : **les garde-fous contre ces résultats sont une exigence de conception**, à inscrire dans la SPEC et à vérifier à l'Execution Gate.

**Format de signalement pour pratique interdite :**
```
🚫 AI ACT — ART. 5 — PRATIQUE INTERDITE
Système demandé : [description]
Violation : Art. 5.[paragraphe] — [intitulé]
Sanction maximale : 35 millions € ou 7% CA mondial
Action requise : ARRÊT COMPLET — Escalade direction + conseil juridique
```

---

## CATÉGORIE 2 — SYSTÈMES À HAUT RISQUE (Art. 6 + Annexe III)
### Application : **2 décembre 2027** (Annexe III) et **2 août 2028** (Annexe I) — reportées par le Règlement (UE) 2026/1744

> ⚠️ **Feuilles de route antérieures à juillet 2026** : elles reposent sur les anciennes dates — **TOUJOURS** signaler au PM qu'elles sont à recommuniquer (haut risque reporté, mais Art. 50 déjà en vigueur et nouvelles interdictions Art. 5 au 2 décembre 2026). Contexte : `https://github.com/everssteeve/sdd-mode/blob/main/docs/legitimation/conformite-cas-2026.md`.

### Identification — Domaines à haut risque

Un système IA est à haut risque s'il est utilisé dans l'un de ces secteurs **ET** influence une décision affectant des personnes physiques :

| Domaine | Exemples concrets |
|---------|-------------------|
| **Infrastructures critiques** | Gestion réseau électrique, eau, transport |
| **Éducation & formation** | Admission, notation, évaluation d'élèves |
| **Emploi & RH** | Recrutement, scoring CV, licenciement, promotion |
| **Services essentiels** | Scoring crédit, assurance, aides sociales, urgences |
| **Application des lois** | Évaluation risque criminel, polygraphes IA, preuves |
| **Migration & asile** | Évaluation demandes, vérification identité |
| **Justice** | Aide à la décision judiciaire, médiation |
| **Infrastructures démocratiques** | Élections, vote |
| **Dispositifs médicaux** | Diagnostic, traitement, surveillance patient |
| **Sécurité** | Systèmes de sécurité pour produits (machines, véhicules) |

### Obligations pour les systèmes à haut risque

#### 🗂️ DOCUMENTATION (Art. 11 & 12)

- **TOUJOURS** maintenir une documentation technique complète avant mise en service
- **TOUJOURS** documenter l'architecture du modèle, les données d'entraînement, les métriques de performance
- **TOUJOURS** documenter les capacités et les limites du système (cas d'usage hors scope)
- **TOUJOURS** maintenir des logs automatiques de toute décision ou output significatif (traçabilité)
- **TOUJOURS** versionner le système IA avec documentation des changements et de leurs impacts
- **TOUJOURS** conserver les logs pendant la durée légale applicable (minimum 6 mois post-déploiement)

```typescript
// ✅ Structure de documentation technique obligatoire (Art. 11)
interface AISystemDocumentation {
  systemId: string;
  version: string;
  intendedPurpose: string;           // Usage prévu exact
  outOfScopeUseCases: string[];      // Usages explicitement exclus
  modelArchitecture: string;         // Description de l'architecture
  trainingDataDescription: {
    sources: string[];
    dateRange: { from: Date; to: Date };
    dataGovernanceProcess: string;
    knownBiases: string[];           // Biais identifiés et mesures prises
  };
  performanceMetrics: {
    accuracy: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
    performanceByDemographic?: Record<string, number>; // Analyse d'équité
  };
  humanOversightMeasures: string[];
  postMarketMonitoringPlan: string;
  conformityAssessmentStatus: 'pending' | 'in_progress' | 'completed';
  lastUpdated: Date;
}

// ✅ Log automatique de chaque décision IA (Art. 12)
interface AIDecisionLog {
  timestamp: Date;
  sessionId: string;
  systemVersion: string;
  inputDataHash: string;        // Hash des inputs (pas les données brutes)
  outputDecision: string;
  confidenceScore?: number;
  humanReviewRequired: boolean;
  humanReviewerId?: string;
  humanFinalDecision?: string;  // Si différent de l'output IA
  appealPossible: boolean;
}
```

#### 🧪 QUALITÉ DES DONNÉES (Art. 10)

- **TOUJOURS** documenter les sources de données d'entraînement, de validation et de test
- **TOUJOURS** analyser les biais potentiels dans les données d'entraînement
- **TOUJOURS** implémenter des pratiques de gouvernance des données (pertinence, complétude, exactitude)
- **TOUJOURS** tester les performances du modèle sur des sous-groupes démographiques distincts
- **TOUJOURS** documenter les biais identifiés et les mesures d'atténuation appliquées
- **TOUJOURS** utiliser des jeux de données de test indépendants des données d'entraînement

```python
# ✅ Analyse de biais obligatoire par sous-groupe démographique
def evaluate_fairness_metrics(model, test_data, sensitive_attributes):
    """
    Art. 10 AI Act — Analyse d'équité par sous-groupe.
    Obligatoire pour tout système à haut risque.
    """
    results = {}
    
    for attribute in sensitive_attributes:
        groups = test_data[attribute].unique()
        for group in groups:
            subset = test_data[test_data[attribute] == group]
            predictions = model.predict(subset.drop(columns=['label']))
            
            results[f"{attribute}_{group}"] = {
                'accuracy': accuracy_score(subset['label'], predictions),
                'false_positive_rate': false_positive_rate(subset['label'], predictions),
                'false_negative_rate': false_negative_rate(subset['label'], predictions),
                'sample_size': len(subset)
            }
    
    # Signaler si l'écart entre groupes dépasse le seuil acceptable
    # Règle empirique : écart > 5pp sur FPR/FNR → investigation requise
    return results
```

#### 👁️ SUPERVISION HUMAINE (Art. 14)

- **TOUJOURS** concevoir le système pour permettre une supervision humaine effective
- **TOUJOURS** implémenter un mécanisme d'override humain (arrêt, modification, correction de l'output)
- **TOUJOURS** afficher les niveaux de confiance et les limites du système à l'opérateur humain
- **TOUJOURS** signaler automatiquement les cas limites ou à faible confiance pour review humaine
- **TOUJOURS** permettre à l'opérateur de refuser ou modifier toute décision du système
- **TOUJOURS** documenter qui est l'opérateur humain responsable et ses responsabilités exactes
- **TOUJOURS** former les opérateurs humains à comprendre les capacités ET les limites du système

```typescript
// ✅ Interface de supervision humaine obligatoire (Art. 14)
interface HumanOversightInterface {
  // Afficher clairement ce que le système recommande ET pourquoi
  aiRecommendation: string;
  confidenceScore: number;           // Ex: 0.73 = 73% de confiance
  explanationFactors: string[];      // Facteurs ayant influencé la décision
  uncertaintyFlags: string[];        // Ce que le système ne sait pas

  // Permettre la décision humaine finale
  humanCanOverride: true;            // Toujours true pour systèmes haut risque
  humanDecision?: string;
  humanOverrideReason?: string;
  overrideRequiredIfConfidenceBelow: number; // Ex: 0.60

  // Auditabilité
  reviewedBy: string;
  reviewedAt: Date;
  appealInformation: string;         // Comment contester la décision
}

// ✅ Signalement automatique des cas à faible confiance
function shouldRequireHumanReview(
  confidenceScore: number,
  systemConfig: { humanReviewThreshold: number }
): boolean {
  // Tout cas sous le seuil = review humaine obligatoire
  return confidenceScore < systemConfig.humanReviewThreshold;
}
```

#### 🎯 PRÉCISION & ROBUSTESSE (Art. 15)

- **TOUJOURS** définir et documenter les métriques de performance cibles avant entraînement
- **TOUJOURS** tester la robustesse face aux données corrompues, adversariales ou hors-distribution
- **TOUJOURS** implémenter une dégradation gracieuse (fallback) quand le système est incertain
- **TOUJOURS** monitorer la performance en production (data drift, model drift)
- **TOUJOURS** implémenter des alertes sur dégradation de performance
- **TOUJOURS** tester sur des données représentatives de la diversité des utilisateurs réels

```typescript
// ✅ Système de monitoring post-déploiement (Art. 15 + 72)
interface PostMarketMonitoring {
  // Métriques collectées en production
  performanceMetrics: {
    accuracy: number;
    falsePositiveRate: number;
    inferenceLatency: number;
    dataDriftScore: number;          // Écart entre distribution train et prod
  };

  // Seuils d'alerte
  alertThresholds: {
    accuracyDropAlert: number;       // Ex: -5% vs baseline → alerte
    fprIncreaseAlert: number;        // Ex: +3pp → alerte
    dataDriftAlert: number;          // Ex: score > 0.3 → investigation
  };

  // Signalement des incidents (Art. 73)
  incidentReportingRequired: boolean;
  seriousIncidentDefinition: string; // Définir ce qui constitue un incident grave
  reportingDeadline: '72h' | '15d';  // 72h pour incidents graves
}
```

#### 📋 ENREGISTREMENT & CONFORMITÉ (Art. 16 + 49)

- **TOUJOURS** enregistrer le système dans la base de données UE (EU AI Act database) avant mise sur le marché
- **TOUJOURS** réaliser une évaluation de conformité (interne ou tierce selon le domaine)
- **TOUJOURS** apposer le marquage CE sur le système
- **TOUJOURS** rédiger une déclaration UE de conformité
- **TOUJOURS** désigner un représentant UE si l'organisation est basée hors UE

---

## CATÉGORIE 3 — RISQUE LIMITÉ — OBLIGATIONS DE TRANSPARENCE (Art. 50)
### Application : ✅ **En vigueur depuis le 2 août 2026** *(v1.9)*

> **Délai transitoire** : jusqu'au 2 décembre 2026 pour l'art. 50(2), uniquement pour les systèmes mis sur le marché avant le 2 août 2026 (art. 111(4)). **Sanction** : jusqu'à 15 M€ ou 3 % du CA mondial (Art. 99). **Code of Practice on Transparency** : le signer est une voie pour démontrer la conformité ; sinon, la démontrer autrement (checklist T13). Autorités de contrôle et contexte : `https://github.com/everssteeve/sdd-mode/blob/main/docs/legitimation/conformite-cas-2026.md`.

### Systèmes concernés

- **Chatbots et agents conversationnels** : tout système interagissant avec des humains
- **Systèmes de génération de contenu** : texte, images, audio, vidéo générés par IA
- **Deepfakes** : toute manipulation réaliste d'images ou de vidéos de personnes réelles
- **Systèmes de détection d'émotions** (hors usages interdits)

### Obligations

#### 🔔 DIVULGATION CHATBOTS (Art. 50.1)

- **TOUJOURS** informer l'utilisateur qu'il interagit avec un système IA (et non un humain)
- **TOUJOURS** afficher cette information de manière claire, lisible et en début d'interaction
- **TOUJOURS** permettre à l'utilisateur de demander à parler à un humain (si applicable)
- **TOUJOURS** ne jamais affirmer être humain si directement interrogé

```typescript
// ✅ Divulgation obligatoire en début de session chatbot
const CHATBOT_DISCLOSURE = {
  fr: "Je suis un assistant IA. Je ne suis pas un humain. " +
      "Si vous souhaitez parler à un conseiller humain, " +
      "tapez 'humain' à tout moment.",
  en: "I am an AI assistant. I am not a human. " +
      "Type 'human' at any time to speak with a person.",
};

// ✅ Cette divulgation doit apparaître :
// - Au premier message de chaque nouvelle session
// - Si l'utilisateur demande directement "es-tu humain ?"
// - Dans les métadonnées de l'interface (tooltip, info-bulle)

function initChatSession(userId: string, lang: 'fr' | 'en'): ChatSession {
  return {
    sessionId: generateUUID(),
    startedAt: new Date(),
    aiDisclosureShown: true,         // Obligatoire — ne jamais passer à false
    disclosureText: CHATBOT_DISCLOSURE[lang],
    firstMessage: CHATBOT_DISCLOSURE[lang], // Toujours premier
  };
}
```

#### 🖼️ DIVULGATION CONTENUS GÉNÉRÉS (Art. 50.2 & 50.4)

- **TOUJOURS** marquer les contenus générés par IA (texte, image, audio, vidéo) comme tels
- **TOUJOURS** implémenter un watermarking ou marquage lisible par machine sur les médias IA
- **TOUJOURS** ne jamais supprimer ou altérer les marquages de contenus IA tiers
- **TOUJOURS** documenter dans les métadonnées du fichier la nature IA du contenu

```typescript
// ✅ Métadonnées obligatoires sur les contenus générés
interface AIGeneratedContentMetadata {
  isAIGenerated: true;               // Toujours true pour ce type de contenu
  generationTimestamp: Date;
  modelUsed: string;                 // Ex: "claude-sonnet-4-6"
  promptHash?: string;               // Hash du prompt (pas le prompt brut)
  humanReviewed: boolean;
  humanReviewerId?: string;
  c2paCompliant?: boolean;           // Coalition for Content Provenance (standard recommandé)
  watermarkApplied?: boolean;
}

// ✅ En-tête HTTP pour les réponses IA
// X-AI-Generated: true
// X-AI-Model: claude-sonnet-4-6
// X-Human-Reviewed: false
```

---

## CATÉGORIE 4 — GPAI — MODÈLES IA À USAGE GÉNÉRAL (Art. 51-56)
### Application : Août 2025

Applicable si tu **déploies ou affines un modèle de fondation** (LLM, modèle d'image, multimodal) mis à disposition de tiers.

> **Note :** Si tu utilises simplement l'API d'un LLM existant (OpenAI, Anthropic, etc.) sans redistribution, ces obligations s'appliquent au fournisseur du modèle, pas à toi.

### Obligations générales (tous GPAI — Art. 53)
- **TOUJOURS** maintenir une documentation technique des capacités et limitations du modèle (Annexe XI)
- **TOUJOURS** mettre en place une politique de droits d'auteur (données d'entraînement, opt-out TDM)
- **TOUJOURS** publier un résumé suffisamment détaillé des données d'entraînement (template AI Office, publié 24 juil. 2025)
- **TOUJOURS** documenter la consommation énergétique de l'entraînement (Annexe XI 1.c — lien avec RGESN)

### GPAI à risque systémique (Art. 51-55)

**Seuil quantitatif :** entraînement ayant nécessité **> 10^25 FLOP**. En 2026, cela concerne notamment GPT-4, Claude 3+ Opus, Gemini Ultra, Llama 3 405B, Grok 3.

**Autres critères (Art. 51.1.b)** : capacités ou impact équivalents, appréciés par l'AI Office.

**Obligations supplémentaires (Art. 55) :**
- **TOUJOURS** évaluation adversariale documentée (red-teaming)
- **TOUJOURS** évaluations de risques systémiques (biais, mésusage, diffusion, perte de contrôle)
- **TOUJOURS** cybersécurité renforcée du modèle et de ses paramètres
- **TOUJOURS** notification des incidents graves à l'AI Office
- **TOUJOURS** plan d'atténuation des risques documenté

**Code of Practice GPAI** (juillet 2025) : confère présomption de conformité. Signataires publiés par l'AI Office.

> 📚 Base : Art. 51-55 AI Act + AI Office — Code of Practice for General-Purpose AI Models (2 juil. 2025).

---

## PROFIL ÉMERGENT — AGENTS À EFFET IRRÉVERSIBLE (FINANCIER, OPÉRATIONNEL, MATÉRIEL) *(v1.7 — étendu v1.9)*

*Anciennement « Agents à autonomie financière et opérationnelle ».*

> ⚠️ **Profil de risque émergent (2026)** : l'apparition d'agents dotés d'une autonomie financière et opérationnelle réelle (ex. protocole Cloudflare/Stripe en production, avec plafond ~100 $/mois) déplace le curseur de risque. Un agent qui peut payer, acheter, souscrire ou déclencher un déploiement irréversible n'est plus un simple générateur de contenu.

### Classification

Un agent à autonomie financière ou opérationnelle doit être qualifié spécifiquement à l'ÉTAPE 0 :

- S'il influence une décision affectant des personnes physiques dans un domaine de l'**Annexe III** (crédit, services essentiels, emploi…), il relève du **régime haut risque (Titre III)** — obligations complètes (documentation, supervision humaine Art. 14, journalisation Art. 12, robustesse Art. 15).
- Hors Annexe III, l'AI Act n'impose pas d'obligations de supervision spécifiques à ce profil : les articles 9 (gestion des risques), 14 (contrôle humain) et 26 (obligations du déployeur) visent les systèmes **à haut risque**. Dès qu'il engage des **effets irréversibles** (paiement, achat, engagement contractuel, déploiement production), AIAD applique néanmoins, **à titre de bonne pratique**, les points de contrôle ci-dessous, inspirés de ces articles — et le droit commun (responsabilité civile, RGPD, droit de la consommation) continue de s'appliquer.

### Points de contrôle humains minimaux (obligatoires)

Avant toute mise en service d'un agent à autonomie financière/opérationnelle :

- [ ] **Validation de la délégation initiale** — un humain identifiable autorise explicitement le périmètre d'autonomie (qui, quoi, jusqu'où).
- [ ] **Plafond documenté** — un plafond financier et/ou opérationnel est défini, documenté et techniquement appliqué (hard limit, pas seulement consigne).
- [ ] **Journal d'audit** — chaque action à effet financier/opérationnel est journalisée de façon immuable et horodatée (Art. 12). *(v1.9)* Pour les actions irréversibles, le journal a une **valeur probante** : entrées signées ou chaînées par hachage, avec l'autorisation humaine d'origine de chaque action.
- [ ] **Procédure de rollback** — une procédure de réversion documentée et testée existe pour chaque type d'effet réversible ; les effets irréversibles sont explicitement listés et soumis à validation humaine préalable.
- [ ] **Classe de réversibilité déclarée** *(v1.9)* — chaque type d'action est classé réversible, coûteusement réversible ou irréversible dans le Critère de Drift de l'Intent Statement.
- [ ] **Seuil d'arrêt** *(v1.9)* — tout dépassement d'autonomie constaté (plafond, périmètre, tentative d'altérer ses traces) arrête l'agent et déclenche une revue humaine immédiate. Une alerte de facturation fournisseur ne tient pas lieu de seuil d'arrêt.
- [ ] **Isolation vérifiée** *(v1.9)* — l'environnement d'exécution de l'agent ne contient aucun credential superflu, ses sorties réseau sont restreintes, et les ressources partagées accessibles en écriture sont inventoriées dans la SPEC. **Un mode de permission de harness n'est pas une mesure de sécurité suffisante.**

### Articulation avec l'Execution Gate AIAD

Si une SPEC implique un agent à autonomie financière/opérationnelle, l'**Execution Gate** (`/sdd-gate`) doit valider les **plafonds d'autonomie** en plus du SQS ≥ 4/5. Aucune délégation d'effet irréversible sans plafond documenté et procédure de rollback. C'est l'expression réglementaire de la **Valeur 6 — Responsabilité Partagée** : une autonomie déléguée sans responsable humain assumé est un défaut de gouvernance, pas une fonctionnalité.

> Cas terrain et incidents documentés (superseal, dépassements de coûts, incident OpenAI / Hugging Face) : `https://github.com/everssteeve/sdd-mode/blob/main/docs/legitimation/conformite-cas-2026.md`.

### Propriétés attendues des garde-fous techniques *(v1.9)*

AIAD prescrit des **propriétés**, pas des produits. Pour tout agent à effet irréversible, **TOUJOURS** vérifier que le dispositif offre :

| Propriété attendue | Pourquoi |
|---|---|
| **Plafond appliqué techniquement** (montant, allowlist, limite par transaction) | Une consigne dans un prompt n'est pas une limite |
| **Politique à mémoire temporelle** — raisonner sur la séquence d'actions | Un dommage peut naître d'actions individuellement anodines |
| **Autorisation humaine préalable** par action irréversible, par une personne identifiable | Human Authorship ; Art. 14 pour un système à haut risque |
| **Journal à valeur probante** — entrées signées ou chaînées, reliées à l'autorisation d'origine | Art. 12 pour un système à haut risque ; preuve en cas de contestation |
| **Isolation de l'exécution** — conteneur ou VM, sorties réseau restreintes, pas de credentials superflus | Un classifieur de permission peut être contourné |

- Hors haut risque, les rattachements aux articles 12 et 14 sont une **bonne pratique AIAD**, pas une obligation légale.
- **TOUJOURS** exiger un responsable humain désigné pour chaque délégation, même quand le protocole utilisé fournit ses propres plafonds : un garde-fou d'infrastructure n'est pas un cadre de responsabilité.
- Outils illustrant ces propriétés (x402, Cloudflare Wallets, Dogwood, Kiro Crew, Mandato), avec leur maturité : `https://github.com/everssteeve/sdd-mode/blob/main/docs/legitimation/conformite-cas-2026.md`.

### Effets matériels *(v1.9)*

- La classe irréversible **inclut les actions sur des équipements physiques** (instruments, robots, machines) : mêmes points de contrôle, en particulier l'autorisation humaine préalable et le journal à valeur probante.
- **JAMAIS** traiter la sûreté d'un système cyber-physique avec ce seul référentiel : elle relève de normes établies (IEC 61508, ISO 13849, ISO 14971) et, pour les machines, du Règlement Machines (voir « AI Act ↔ Règlement Machines ») — **escalader** au Tech Lead et à un spécialiste de la sûreté.

---

## OBLIGATIONS PAR ACTEUR ET PROCÉDURES

### Tableau comparatif des obligations par rôle

| Obligation | Fournisseur (Art. 16) | Déployeur (Art. 26) | Importateur (Art. 23) | Distributeur (Art. 24) |
|------------|:---:|:---:|:---:|:---:|
| Conception conforme aux exigences Ch. III Section 2 | ✅ | — | — | — |
| Système de gestion de la qualité (Art. 17) | ✅ | — | — | — |
| Documentation technique Annexe IV | ✅ | — | Vérifier | Vérifier |
| Évaluation de conformité (Art. 43) | ✅ | — | — | — |
| Déclaration UE de conformité + marquage CE | ✅ | — | — | — |
| Enregistrement registre UE (Art. 49) | ✅ | — | — | — |
| Informer l'autorité en cas de risque | ✅ | ✅ | ✅ | ✅ |
| Coopération avec les autorités | ✅ | ✅ | ✅ | ✅ |
| Utilisation conforme aux instructions | — | ✅ | — | — |
| Supervision humaine effective (Art. 14) | Concevoir | Appliquer | — | — |
| Surveillance du fonctionnement | — | ✅ | — | — |
| Conservation des journaux (Art. 26.6) | — | ✅ (≥ 6 mois) | — | — |
| Information des personnes concernées (Art. 26.11) | — | ✅ | — | — |
| FRIA (Art. 27) si déployeur public ou secteur Art. 27.1 | — | ✅ | — | — |
| Enregistrement Art. 71 (déployeur service public) | — | ✅ | — | — |

### Procédure — FRIA (Fundamental Rights Impact Assessment — Art. 27)

**Qui doit la mener ?**
- **Déployeurs qui sont des organismes de droit public** (État, collectivités, services publics)
- **Déployeurs privés qui fournissent des services publics**
- **Déployeurs de systèmes Annexe III points 5.b (évaluation de solvabilité / scoring crédit) et 5.c (assurance vie/santé)**

**Quand ?** Avant la première utilisation d'un système haut risque Annexe III.

**Contenu minimal (Art. 27.1) — 6 éléments :**
1. Description des processus du déployeur dans lesquels le système sera utilisé
2. Période et fréquence d'utilisation
3. Catégories de personnes physiques et groupes susceptibles d'être affectés
4. Risques spécifiques de préjudice pour ces personnes ou groupes (en tenant compte des informations fournies par le fournisseur Art. 13)
5. Description de la mise en œuvre des mesures de supervision humaine
6. Mesures à prendre en cas de matérialisation des risques (gouvernance interne, réclamations)

**Articulation avec l'AIPD RGPD (Art. 27.4, modifié par le Règlement 2026/1744) :** si une obligation de la FRIA est déjà remplie par l'AIPD, la FRIA peut **renvoyer** aux sections pertinentes de l'AIPD ou en intégrer les parties utiles. L'AI Office élabore un modèle de questionnaire, y compris sous forme d'outil automatisé, qui prévoit ces renvois (Art. 27.5). Les deux documents peuvent être fusionnés en pratique, chacun couvrant son périmètre (AIPD = protection des données ; FRIA = droits fondamentaux au sens large : dignité, non-discrimination, liberté d'expression, accessibilité, etc.).

**Notification :** le déployeur notifie à l'autorité de surveillance du marché les résultats de la FRIA avant la première utilisation.

> 📚 Base : Art. 27 AI Act + (lignes directrices AI Office FRIA — à publier / en cours au 2026-04-20).

### Procédure — Documentation technique (Annexe IV) — 9 sections

Obligatoire pour tout système haut risque (Art. 11), tenue à jour :

1. **Description générale** du système IA (finalité, fournisseur, version, architecture, hardware/software, interactions, interfaces utilisateurs)
2. **Description détaillée des éléments** du système et de son processus de développement (modèles pré-entraînés utilisés, méthodologies, méthodes d'optimisation, validation/test)
3. **Informations détaillées sur le monitoring, le fonctionnement et le contrôle** du système (métriques de performance attendues, sources prévisibles de risques, mesures de supervision)
4. **Description de la pertinence des mesures** de performance incluant les métriques chiffrées
5. **Description détaillée du système de gestion des risques** (Art. 9)
6. **Description des modifications** du système apportées pendant son cycle de vie
7. **Liste des normes harmonisées** appliquées (totalement ou partiellement) + solutions alternatives si normes non appliquées
8. **Copie de la déclaration UE de conformité** (Art. 47)
9. **Description détaillée du système mis en place pour évaluer les performances** du système IA dans la phase post-commercialisation (Art. 72 — Post-Market Monitoring Plan)

### Procédure — Annexe III détaillée (8 catégories haut risque)

| Catégorie | Exemples concrets |
|-----------|-------------------|
| **1. Biométrie** | Identification biométrique à distance post-hoc ; catégorisation biométrique selon attributs sensibles ; reconnaissance d'émotions (hors usage médical/sécurité) |
| **2. Infrastructures critiques** | Gestion du trafic routier (feux adaptatifs IA) ; supply chain électricité/gaz/eau ; gestion réseaux de chauffage |
| **3. Éducation et formation professionnelle** | Admission/affectation (Parcoursup-like) ; évaluation d'apprentissages ; détection de fraude aux examens ; orientation scolaire |
| **4. Emploi et gestion des travailleurs** | Tri de CV ; scoring de candidats ; décisions de promotion/licenciement ; attribution de tâches ; surveillance/évaluation des performances |
| **5. Accès à des services essentiels** | Scoring de crédit (sauf détection de fraude) ; assurance vie/santé ; éligibilité aux prestations sociales ; priorisation services d'urgence (triage 112) |
| **6. Forces de l'ordre** | Évaluation du risque individuel ; polygraphes IA ; évaluation de la fiabilité des preuves ; profilage pour enquêtes (sous exception stricte) |
| **7. Migration, asile, contrôle aux frontières** | Polygraphes ; évaluation des risques migratoires ; examen des demandes d'asile/visa ; identification biométrique aux frontières |
| **8. Administration de la justice et processus démocratiques** | Assistance à l'interprétation des faits et du droit par un juge ; influence sur le résultat d'élections ou le comportement électoral |

### Procédure — Registre UE (Art. 49 et Art. 71)

**Art. 49 — Fournisseurs :** enregistrement obligatoire dans la base de données UE (maintenue par la Commission) avant mise sur le marché d'un système haut risque. Informations publiques (sauf Annexe III point 6 — forces de l'ordre — accès restreint).

**Art. 71 — Déployeurs services publics :** les autorités publiques et organismes de l'UE qui déploient un système haut risque Annexe III s'enregistrent également.

**Exemptions :**
- Systèmes haut risque Annexe I (produits régulés) : pas d'enregistrement UE (logique de marquage CE sectoriel).
- Systèmes d'IA testés en conditions réelles hors bac à sable (sandbox) sous conditions Art. 60.

> 📚 Base : Art. 49 + Art. 71 AI Act + base de données UE `ai-act-database.eu` (en cours de déploiement au 2026-04-20).

---

## RÈGLES TRANSVERSALES — TOUS NIVEAUX DE RISQUE

### 🛡️ SÉCURITÉ & ROBUSTESSE (applicable à tout système IA)

- **TOUJOURS** tester le système contre les inputs adversariaux (prompt injection, jailbreak, données empoisonnées)
- **TOUJOURS** implémenter des garde-fous en entrée (validation, filtrage) et en sortie (modération)
- **TOUJOURS** isoler le système IA des systèmes critiques sans couche de validation humaine intermédiaire
- **TOUJOURS** prévoir un mode dégradé ou de fallback si le composant IA est indisponible

```typescript
// ✅ Garde-fous d'entrée/sortie pour tout système IA
class AISystemGuardrails {
  // Validation des inputs
  static validateInput(input: string): ValidationResult {
    const risks = [];
    if (this.detectPromptInjection(input)) risks.push('prompt_injection');
    if (this.detectPersonalData(input)) risks.push('pii_in_input');
    if (input.length > MAX_INPUT_LENGTH) risks.push('oversized_input');
    return { isValid: risks.length === 0, risks };
  }

  // Modération des outputs
  static validateOutput(output: string, context: AIContext): ValidationResult {
    const issues = [];
    if (this.containsHarmfulContent(output)) issues.push('harmful_content');
    if (this.containsPersonalData(output)) issues.push('pii_in_output');
    if (this.containsHallucination(output, context)) issues.push('potential_hallucination');
    return { isValid: issues.length === 0, issues };
  }

  // Fallback si IA indisponible
  static async withFallback<T>(
    aiCall: () => Promise<T>,
    fallback: () => T
  ): Promise<T> {
    try {
      return await aiCall();
    } catch (error) {
      logger.warn('AI system unavailable, using fallback', { error });
      return fallback();
    }
  }
}
```

### 📢 INFORMATION DES UTILISATEURS (applicable à tout système IA)

- **TOUJOURS** informer les utilisateurs quand une décision les affectant a été prise ou influencée par un système IA
- **TOUJOURS** expliquer de façon compréhensible la logique de la décision (droit à l'explication)
- **TOUJOURS** fournir un contact humain pour contester une décision automatisée
- **TOUJOURS** documenter les voies de recours dans l'interface utilisateur

```typescript
// ✅ Information utilisateur sur les décisions IA (applicable à tout niveau de risque)
interface AIDecisionNotification {
  // Ce qui a été décidé
  decision: string;
  decisionDate: Date;

  // Explication accessible
  plainLanguageExplanation: string;  // Compréhensible par un non-expert
  mainFactors: string[];             // Les 3-5 facteurs principaux

  // Droits de l'utilisateur
  canAppeal: boolean;
  appealDeadline?: Date;
  appealContact: string;             // Email ou URL du formulaire de recours
  appealInstructions: string;

  // Transparence IA
  aiSystemUsed: boolean;
  aiSystemName?: string;             // Si obligation de divulgation
}
```

---

## PROTOCOLE DE SIGNALEMENT

```
⚠️ AI ACT — Art. [XX] — [Niveau de risque] : [Description du problème]
Niveau : [INTERDIT 🚫 / HAUT RISQUE 🔴 / RISQUE LIMITÉ 🟡 / RECOMMANDATION 🟢]
Sanction maximale : [Montant selon Art. 99]
Décision requise : [Direction / Responsable conformité / Équipe technique]
Alternative proposée : [Solution conforme ou question à résoudre avant de continuer]
```

**Barème des sanctions (Art. 99) :**
- Pratiques interdites (Art. 5) : jusqu'à **35 M€ ou 7% du CA mondial**
- Autres violations systèmes haut risque : jusqu'à **15 M€ ou 3% du CA mondial**
- Informations incorrectes fournies aux autorités : jusqu'à **7,5 M€ ou 1% du CA mondial**

---

## CHECKLIST PAR NIVEAU DE RISQUE

### ✅ Checklist — Systèmes à Risque Limité (Chatbots, contenus IA)
- [ ] Divulgation IA affichée en début de chaque session
- [ ] Impossibilité de se faire passer pour un humain
- [ ] Contenus générés marqués comme tels (métadonnées + visual si applicable)
- [ ] Mécanisme pour joindre un humain (si service client)
- [ ] Politique de modération des contenus définie

### ✅ Checklist — Systèmes à Haut Risque (avant mise en production)
- [ ] Classification haut risque confirmée et documentée
- [ ] Documentation technique complète (Art. 11) rédigée
- [ ] Analyse qualité & biais des données d'entraînement (Art. 10)
- [ ] Métriques de performance documentées par sous-groupe démographique
- [ ] Mécanisme de supervision humaine implémenté (Art. 14)
- [ ] Override humain possible à tout moment
- [ ] Logs automatiques des décisions configurés (Art. 12)
- [ ] Tests de robustesse réalisés (adversarial, out-of-distribution)
- [ ] Plan de monitoring post-déploiement défini (Art. 72)
- [ ] Évaluation de conformité réalisée (Art. 43)
- [ ] Enregistrement base de données UE effectué (Art. 49)
- [ ] Marquage CE apposé
- [ ] Déclaration UE de conformité rédigée
- [ ] Formation des opérateurs humains planifiée
- [ ] Voies de recours pour les utilisateurs documentées

### ✅ Checklist — Intégration AIAD (toutes boucles)

**PLANIFIER :**
- [ ] Niveau de risque AI Act qualifié et documenté dans le PRD
- [ ] Base légale RGPD des données d'entraînement vérifiée
- [ ] Obligations applicables listées dans la SPEC

**IMPLÉMENTER :**
- [ ] Divulgation IA implémentée (si applicable)
- [ ] Protocole de paiement agentique utilisé (x402, Cloudflare Wallets ou équivalent) ? Si oui : plafonds techniques reflétés dans l'Intent Statement et vérifiés à l'Execution Gate *(v1.9)*
- [ ] Agent à effet irréversible : classe de réversibilité, seuil d'arrêt et isolation vérifiés (profil « Agents à effet irréversible ») *(v1.9)*
- [ ] Logs de décision configurés
- [ ] Supervision humaine codée (si haut risque)
- [ ] Garde-fous d'entrée/sortie en place

**VALIDER :**
- [ ] Tests de robustesse exécutés
- [ ] Analyse de biais réalisée
- [ ] Override humain testé
- [ ] Information utilisateur vérifiée

**INTÉGRER :**
- [ ] Documentation technique mise à jour
- [ ] Version du système IA enregistrée
- [ ] Plan de monitoring activé

---

## TRACE DE DÉLÉGATION *(v1.9)*

- **TOUJOURS** rattacher toute tâche confiée à un agent à un Intent Statement (auteur humain identifié), à une SPEC (périmètre délégué) et à la trace de l'Execution Gate (validation). L'organisation répond de ce que font ses agents : sans cette trace, elle ne peut démontrer ni sa diligence ni l'origine du code.
- **JAMAIS** exécuter une tâche dont l'origine humaine ne peut pas être retracée.

> Argumentaire et sources (thèse Schneier / Sanders, injonction de Munich, données GitLab) : `https://github.com/everssteeve/sdd-mode/blob/main/docs/legitimation/responsabilite-evidence.md`.

---

## COHÉRENCE AVEC LES VALEURS AIAD

L'EU AI Act et AIAD partagent une conviction fondamentale : **l'humain est l'auteur, l'IA est l'exécutant**. Les exigences de supervision humaine (Art. 14), de droit à l'explication et de voies de recours ne sont pas des contraintes bureaucratiques — elles sont l'expression réglementaire du principe de primauté de l'intention humaine qui est au cœur de la Constitution AIAD.

Un système IA conforme à l'AI Act est, par construction, aligné avec les valeurs AIAD :
- **Transparence radicale** → Divulgation et explicabilité obligatoires
- **Primauté de l'intention humaine** → Supervision humaine et override
- **Empirisme sans concession** → Monitoring continu et métriques de performance
- **Sobriété intentionnelle** → Minimisation du scope des décisions automatisées

---

## MAPPING AI ACT ↔ ARTEFACTS ET RITUELS AIAD *(v1.6 — B4)*

> Ce mapping montre comment les artefacts et rituels AIAD adressent les obligations AI Act. Il ne remplace pas une évaluation de conformité formelle — il constitue une aide à la conformité opérationnelle.

| Article AI Act | Obligation principale | Artefact AIAD adressant l'obligation | Rituel AIAD associé |
|---------------|----------------------|--------------------------------------|---------------------|
| **Art. 5** — Pratiques interdites | Ne jamais implémenter les usages interdits | AGENT-GUIDE Gouvernance (droit de veto) | `/aiad-gouvernance` — validation avant PR |
| **Art. 9** — Gestion des risques | Système de gestion des risques tout au long du cycle de vie | Intent Statement (CONTRAINTES) + SPEC (critère de drift) | `/sdd-gate` — validation du contexte de risque avant exec |
| **Art. 10** — Données d'entraînement | Qualité et gouvernance des données | ARCHITECTURE.md (section données) | `/sdd-validate` — validation qualité |
| **Art. 11** — Documentation technique | Documentation complète avant mise en service | PRD.md + ARCHITECTURE.md + AGENT-GUIDE.md + SPECs | `/aiad-status` — état des artefacts |
| **Art. 12** — Journalisation | Logs automatiques des décisions IA | `.aiad/metrics/` (toutes les commandes) | `/aiad-dashboard` — revue des métriques |
| **Art. 13** — Transparence | Information claire sur les capacités et limites | AGENT-GUIDE (section limites) + SPECs | Atelier d'Intention mensuel |
| **Art. 14** — Supervision humaine | Mécanisme d'override humain effectif | Human Authorship (Intent Statement) + Execution Gate | `/sdd-gate` — refus si Human Authorship absent |
| **Art. 15** — Précision & robustesse | Monitoring et dégradation gracieuse | `/sdd-context` (CE Budget audit) + Lessons Learned | `/aiad-retro` — suivi des dégradations |
| **Art. 17** — Système qualité | Processus qualité documenté | SDD Mode complet (cycle Intent → Drift Lock) | Toutes les boucles SDD |
| **Art. 26.6** — Conservation logs | Minimum 6 mois post-déploiement | `.aiad/metrics/` (persistance systématique) | `/aiad-dora` + `/aiad-flow` |
| **Art. 27** — FRIA | Évaluation d'impact droits fondamentaux | PRD.md (section risques) + AIAD-RGPD.md | `/aiad-gouvernance` |
| **Art. 50** — Transparence (chatbots) | Divulgation IA obligatoire — **2 août 2026** | Checklist T1-T14 (section dédiée ci-dessous) | `/sdd-validate` — test divulgation |
| **Art. 72** — Post-Market Monitoring | Plan de suivi post-déploiement | `.aiad/metrics/deployments/` | `/aiad-dora` (MTTR + Change Failure Rate) |

---

## CHECKLIST DE CONFORMITÉ ASSISTÉE — AIAD *(v1.6 — B4)*

> Cette checklist structure une auto-évaluation de conformité AI Act pour les équipes AIAD. **Elle ne constitue pas un avis juridique ni une évaluation de conformité formelle.** Toute décision de classification formelle, d'enregistrement ou de déclaration de conformité doit impliquer un juriste ou responsable conformité qualifié.

### Étape 1 — Classification du système

- [ ] Le système IA est identifié et délimité (quels composants ? quels outputs ?)
- [ ] La classification de risque est documentée dans le PRD (risque inacceptable / haut risque / transparence / minimal)
- [ ] La classification a été revue par une personne qualifiée (non uniquement par l'IA)
- [ ] Le calendrier d'application applicable est identifié (Art. 50 → **2 août 2026** ; Annexe III haut risque → sous réserve Omnibus VII)

### Étape 2 — Artefacts AIAD en place

- [ ] Intent Statement documenté avec CONTRAINTES explicitant les implications réglementaires
- [ ] ARCHITECTURE.md contient la description du composant IA et ses limites
- [ ] AGENT-GUIDE.md active le présent guide (AIAD-AI-ACT) pour les sessions concernées
- [ ] SPECs des fonctionnalités IA contiennent les critères de conformité dans les cas limites
- [ ] `.aiad/metrics/` collecte les données d'usage du composant IA

### Étape 3 — Obligations techniques vérifiées

- [ ] Divulgation IA implémentée (Art. 50.1 si chatbot) — deadline **2 août 2026**
- [ ] Contenus IA marqués (Art. 50.2 si génération de contenu) — deadline **2 août 2026**
- [ ] Mécanisme d'override humain opérationnel (Art. 14 si haut risque)
- [ ] Logs de décisions configurés (Art. 12 si haut risque)
- [ ] Tests de robustesse réalisés (Art. 15 si haut risque)
- [ ] Données d'entraînement documentées avec analyse de biais (Art. 10 si haut risque)

### Étape 4 — Gouvernance et documentation

- [ ] `/aiad-gouvernance` exécuté avant la mise en production du composant IA
- [ ] Validation humaine formelle de la conformité (non déléguée à l'agent)
- [ ] Déclaration de conformité rédigée si haut risque (template Annexe IV disponible dans ce document)
- [ ] Enregistrement base de données UE planifié si haut risque (Art. 49)
- [ ] Revue juridique planifiée avant diffusion externe si haut risque ou transparence obligatoire

> ⚠️ **Avertissement final** : Cette checklist est un outil d'aide à la conformité produit par le framework AIAD. Elle ne remplace pas une évaluation formelle de conformité, un avis juridique, ni une inscription au registre UE. Les décisions de classification formelle doivent impliquer un juriste ou responsable conformité qualifié. Applicable en priorité à toute organisation opérant en contexte réglementé.

---

## CHECKLIST DE TRANSPARENCE — OBLIGATIONS ART. 50 (Août 2026) *(v1.4)*

> ✅ Cette checklist couvre les obligations de transparence **en vigueur depuis le 2 août 2026** *(mise à jour v1.9)*.

### Pour chaque système IA déployé, vérifier :

#### Chatbots et systèmes conversationnels (Art. 50.1)

| # | Obligation | Actions à mener | Responsable AIAD | Statut |
|---|-----------|----------------|-----------------|--------|
| T1 | L'utilisateur est informé qu'il interagit avec une IA (et non un humain) | Ajouter message de divulgation en début de session | PE (implémentation) + PM (validation contenu) | ☐ Conforme / ☐ En cours / ☐ N/A |
| T2 | La divulgation est claire, lisible et en début d'interaction | Audit UX : texte visible, non dissimulé dans les CGU | QA Engineer | ☐ Conforme / ☐ En cours / ☐ N/A |
| T3 | Le système ne prétend jamais être humain si directement interrogé | Test : "Es-tu humain ?" → réponse correcte | QA Engineer | ☐ Conforme / ☐ En cours / ☐ N/A |
| T4 | Possibilité de basculer vers un humain (si service client) | Implémenter option "parler à un conseiller" | PE | ☐ Conforme / ☐ En cours / ☐ N/A |

#### Contenus générés par IA — texte, images, audio, vidéo (Art. 50.2 & 50.4)

| # | Obligation | Actions à mener | Responsable AIAD | Statut |
|---|-----------|----------------|-----------------|--------|
| T5 | Les contenus générés par IA sont marqués comme tels | Implémenter métadonnées `isAIGenerated: true` | PE | ☐ Conforme / ☐ En cours / ☐ N/A |
| T6 | Watermarking ou marquage lisible par machine sur les médias IA | Implémenter C2PA ou équivalent pour images/vidéos/audio | AE (configuration) + PE (implémentation) | ☐ Conforme / ☐ En cours / ☐ N/A |
| T7 | En-têtes HTTP indiquant le contenu IA (`X-AI-Generated: true`) | Configurer les headers dans l'API | PE | ☐ Conforme / ☐ En cours / ☐ N/A |
| T8 | Les marquages de contenus IA tiers ne sont jamais supprimés | Audit du pipeline de traitement des médias | Tech Lead | ☐ Conforme / ☐ En cours / ☐ N/A |

#### Deepfakes (Art. 50.3)

| # | Obligation | Actions à mener | Responsable AIAD | Statut |
|---|-----------|----------------|-----------------|--------|
| T9 | Les deepfakes (images/vidéos réalistes de personnes réelles) sont clairement identifiés comme synthétiques | Affichage visible sur le contenu + métadonnées | PE + PM (validation) | ☐ Conforme / ☐ En cours / ☐ N/A |
| T10 | Exception : contexte artistique ou journalistique clairement établi | Documenter le contexte dans la SPEC | PM | ☐ Conforme / ☐ En cours / ☐ N/A |

#### GPAI utilisé via API (Déployers — Art. 50.4)

| # | Obligation | Actions à mener | Responsable AIAD | Statut |
|---|-----------|----------------|-----------------|--------|
| T11 | Informer les utilisateurs que le service utilise un modèle GPAI | Mentionner dans la politique de confidentialité + interface | PM + PE | ☐ Conforme / ☐ En cours / ☐ N/A |
| T12 | Marquage lisible par machine des contenus synthétiques (Art. 50.2) | Obligatoire dès maintenant pour tout système mis sur le marché depuis le 2 août 2026 ; **délai jusqu'au 2 décembre 2026** pour un système mis sur le marché avant cette date (art. 111(4)) | AE (configuration) | ☐ Conforme / ☐ En cours / ☐ N/A |

#### Code of Practice (Art. 50 — Volontaire mais recommandé)

| # | Action | Responsable AIAD | Statut |
|---|--------|-----------------|--------|
| T13 | Décider de signer ou non le Code of Practice on Transparency of AI-generated Content (final, reconnu adéquat par la Commission en juillet 2026) — à défaut, documenter une autre démonstration de conformité | AE (veille) + PM (décision) | ☐ En cours |
| T14 | Implémenter C2PA (Coalition for Content Provenance) pour les médias générés | AE + PE | ☐ En cours |

> **Calendrier de conformité Art. 50 :** toutes les obligations ci-dessus s'appliquent depuis le **2 août 2026** — sauf T12 pour un système mis sur le marché avant cette date (délai jusqu'au **2 décembre 2026**).

---

## ÉVOLUTIONS RÉGLEMENTAIRES *(v1.9 — 25 septembre 2026)*

> Section vivante — mise à jour à chaque cycle d'évolution du framework.

### Omnibus numérique IA — ADOPTÉ

| Élément | Détail |
|---------|--------|
| **Texte** | Règlement (UE) 2026/1744 modifiant les règlements (UE) 2024/1689 (AI Act), (UE) 2018/1139 (sécurité aérienne) et (UE) 2023/1230 (Règlement Machines) |
| **Publication au JO** | 24 juillet 2026 |
| **Entrée en vigueur** | 27 juillet 2026 (trois jours après la publication) |
| **Statut** | ✅ **EN VIGUEUR** |

| Obligation | Date originale | Nouvelle date |
|-----------|---------------|--------------|
| Haut risque Annexe III (emploi, crédit, éducation, biométrie…) | 2 août 2026 | **2 décembre 2027** |
| Haut risque Annexe I (produits régulés) | 2 août 2027 | **2 août 2028** |
| Art. 50(2) — marquage des contenus synthétiques, systèmes (y compris à usage général) mis sur le marché **avant** le 2 août 2026 | 2 août 2026 | **2 décembre 2026** (art. 111(4) ; considérant 38 : période transitoire de quatre mois) |
| Bacs à sable réglementaires nationaux | 2 août 2026 | **2 août 2027** (art. 57(1)) — et possibilité d'un bac à sable au niveau de l'Union géré par l'AI Office (art. 57(3 bis)) |
| **Deux nouvelles** interdictions Art. 5(1) b bis et b ter (NCII dont « nudifier » ; CSAM) | — | **2 décembre 2026** (art. 113, al. 3, a) |
| Systèmes haut risque **destinés aux autorités publiques** déjà sur le marché | 2 août 2030 | **2 août 2030** (art. 111(2), inchangé sur ce point) — les autres systèmes haut risque déjà sur le marché ne sont soumis au règlement qu'en cas de modification importante de leur conception |
| Articles 102 à 110 (modifications d'autres actes de l'Union) | — | **27 juillet 2026** (art. 113, al. 3, d) |

**Ce qui n'est pas modifié :** les autres interdictions de l'Art. 5 (en vigueur depuis février 2025) ; l'Art. 50, en vigueur depuis le 2 août 2026 (hors délai limité de l'art. 50(2)) ; les obligations GPAI (Art. 51-56), en vigueur depuis août 2025. L'art. 50(7) (codes de bonne pratique) est remplacé.

### Enforcement

- Depuis le **2 août 2026**, la Commission (AI Office) peut exiger des informations, évaluer, imposer des mesures, **restreindre ou retirer un modèle GPAI du marché de l'UE** et infliger des amendes (Art. 101). Premières demandes d'information le 29 août 2026.
- **TOUJOURS** prévoir, pour un client européen, un plan de repli vers un autre modèle (approche model-agnostic) : la disponibilité d'un modèle dans l'UE n'est plus garantie.

Contexte, chronologie et sources : `https://github.com/everssteeve/sdd-mode/blob/main/docs/legitimation/conformite-cas-2026.md`.

---

## ARTEFACTS OBLIGATOIRES

### 1. Template — Documentation technique Annexe IV

```markdown
# Documentation technique — Système IA haut risque [Nom]
Version : [X.Y] — Dernière MAJ : [ISO 8601] — Responsable : [Fournisseur]

## 1. Description générale
- Finalité : [usage prévu + contextes interdits]
- Fournisseur : [entité + représentant UE si applicable]
- Version du système : [Semver]
- Hardware : [GPU, CPU, dépendances]
- Software : [versions modèles, dépendances critiques]
- Interfaces : [API, UI, intégrations]

## 2. Processus de développement
- Données d'entraînement : [sources, volumétrie, gouvernance, biais identifiés]
- Architecture du modèle : [type, paramètres]
- Méthodes d'optimisation, validation et test
- Performances par sous-groupe démographique

## 3. Monitoring, fonctionnement et contrôle
- Métriques de performance attendues
- Sources prévisibles de risques
- Mesures de supervision humaine (Art. 14)

## 4. Mesures de performance chiffrées
- Accuracy, FPR, FNR par segment
- Calibration
- Robustesse (tests adversariaux)

## 5. Système de gestion des risques (Art. 9)
- Identification, estimation, évaluation des risques
- Mesures d'atténuation

## 6. Modifications apportées
[Changelog du système, versions majeures]

## 7. Normes harmonisées appliquées
[Liste + références JOUE]

## 8. Déclaration UE de conformité
[Copie]

## 9. Plan post-commercialisation (Art. 72)
- Collecte continue des données de performance
- Processus de traitement des incidents graves (Art. 73)
- Délai de notification : 72 h (incidents graves)
```

### 2. Template — FRIA (Art. 27) — 6 sections minimales

```markdown
# FRIA — Fundamental Rights Impact Assessment
Système IA haut risque : [Nom]
Déployeur : [Entité] — Date : [ISO 8601]
Articulation avec l'AIPD RGPD : [Référence AIPD si applicable]

## 1. Processus du déployeur où le système sera utilisé
[Description précise du workflow et des points de décision]

## 2. Période et fréquence d'utilisation
- Période : [Date début → date fin prévue]
- Fréquence : [continu / N fois par jour / etc.]

## 3. Catégories de personnes et groupes susceptibles d'être affectés
- Catégories : [demandeurs, candidats, bénéficiaires…]
- Volumétrie estimée
- Groupes vulnérables identifiés : [mineurs, personnes en situation de handicap, minorités…]

## 4. Risques spécifiques de préjudice
- Dignité
- Non-discrimination
- Liberté d'expression / d'opinion
- Protection des données (croisement avec AIPD)
- Accessibilité (croisement avec RGAA)
- Droits sociaux

## 5. Mesures de supervision humaine (Art. 14)
- Qui supervise : [fonction + formation]
- Comment : [interface, alertes, seuils]
- Pouvoir d'override : [oui/non + conditions]

## 6. Mesures en cas de matérialisation des risques
- Gouvernance interne
- Mécanisme de plainte
- Suspension du système si dérive

## Validation
- Déployeur : [Nom] — Date : [ISO]
- Notification à l'autorité : [Date]
```

### 3. Template — Déclaration UE de conformité (Art. 47)

```markdown
# Déclaration UE de conformité

1. Nom et numéro de série du système IA : [ID]
2. Nom et adresse du fournisseur (et représentant UE si applicable) : [X]
3. Déclaration sous la responsabilité exclusive du fournisseur : « Le système IA décrit ci-dessus est conforme au Règlement (UE) 2024/1689 et, le cas échéant, à toute autre législation de l'Union pertinente. »
4. Référence au système IA : [ID + version]
5. Normes harmonisées appliquées : [liste]
6. Nom et numéro de l'organisme notifié (si applicable) : [ON XXXX]
7. Informations complémentaires : [le cas échéant]
8. Signature et nom du signataire : [X]
9. Lieu et date : [X]
```

---

## ARTICULATION AVEC AUTRES RÉFÉRENTIELS

### AI Act ↔ RGPD — double régime systématique

Dès qu'un système IA traite des données personnelles, les deux régimes s'appliquent cumulativement.

**Ordre d'application pratique (recommandé AIAD) :**
1. Base légale RGPD (Art. 6 + 9 si sensibles) — sans base légale, on ne commence pas.
2. Classification AI Act (interdit / haut risque / transparence / minimal).
3. AIPD RGPD (Art. 35) si critères déclenchés.
4. FRIA AI Act (Art. 27) si déployeur public ou secteur 5.b/5.c — peut être fusionnée avec l'AIPD.
5. Documentation technique Annexe IV (si haut risque).
6. Supervision humaine Art. 14 + droit à l'explication Art. 22 RGPD (convergent).

### AI Act ↔ DSA (Digital Services Act — Règlement 2022/2065)

- Plateformes en ligne et systèmes de recommandation : obligations DSA (modération, transparence, évaluation des risques systémiques).
- Si la recommandation utilise un système IA : cumul AI Act + DSA.

### AI Act ↔ Data Act (Règlement 2023/2854)

- Le Data Act régit l'accès aux données issues des objets connectés.
- Impact AIAD : les données générées par des produits IoT peuvent alimenter des systèmes IA — documenter la licéité de l'usage.

### AI Act ↔ Règlement Machines 2023/1230

- **Changement d'approche** : le Règlement Machines est déplacé de la section A à la **section B** de l'Annexe I. Pour les systèmes d'IA à haut risque liés aux machines, seuls l'art. 6(1), l'art. 60 bis et les art. 102 à 112 de l'AI Act s'appliquent désormais (art. 2(2)).
- Les exigences propres à l'IA seront intégrées **dans le Règlement Machines lui-même**, par actes délégués de la Commission modifiant son annexe III (reflétant le chapitre III, section 2, et les art. 17, 19, 72 et 73 de l'AI Act), applicables **au plus tard le 2 août 2028**.
- En attendant des normes propres, les systèmes conformes aux normes harmonisées ou spécifications communes de l'AI Act (art. 40 et 41) sont **présumés conformes** aux exigences de santé et de sécurité correspondantes du Règlement Machines (nouvel art. 20(10)).

### AI Act ↔ Product Liability Directive (révision en cours)

- Responsabilité sans faute pour les dommages causés par les systèmes IA.
- Présomption de défectuosité dans certaines conditions.
- À surveiller : directive AI Liability toujours en négociation au 2026-04-20.

### Priorité en cas de conflit

1. **Art. 5 AI Act (interdictions)** priment absolument.
2. **RGPD + Art. 9** : si données sensibles, base légale renforcée requise avant toute implémentation.
3. **AI Act haut risque** : obligations procédurales (documentation, supervision, enregistrement).
4. **Accessibilité RGAA** : les interfaces AI Act (divulgation, supervision, recours) doivent être accessibles.
5. **RGESN** : optimisation énergétique dans le respect des quatre ci-dessus.

---

## RESSOURCES DE RÉFÉRENCE

| Ressource | Usage | Lien |
|-----------|-------|------|
| Texte officiel EU AI Act | Règlement complet | https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689 |
| EU AI Office | Autorité de supervision | https://digital-strategy.ec.europa.eu/en/policies/ai-office |
| Base de données UE systèmes IA | Enregistrement obligatoire (haut risque) | https://ai-act-database.eu |
| AI Act Explorer (Appliedai) | Navigation interactive par article | https://artificialintelligenceact.eu |
| CNIL — IA et RGPD | Intersection IA Act / RGPD | https://www.cnil.fr/fr/intelligence-artificielle |
| C2PA (content provenance) | Standard de marquage contenus IA | https://c2pa.org |

---

## NOTES D'APPRENTISSAGE

> Section vivante — à mettre à jour après chaque session où une question AI Act est identifiée.

| Date | Contexte | Risque identifié | Article AI Act | Décision prise | Statut |
|------|---------|--------------------|----------------|----------------|--------|
| 2026-06-01 | Agent à autonomie financière (Cloudflare/Stripe) — achat `superseal.cc` au lieu de `superseal.club` | Effet financier irréversible sans plafond, audit ni responsable désigné | Art. 9 (gestion des risques), Art. 12 (journalisation), Art. 14 (supervision), Art. 26 (déployeur) | Création section « Profil émergent — agents à autonomie financière », 4 points de contrôle obligatoires, validation des plafonds à l'Execution Gate | ✅ Documenté |

---

*Agent EU AI Act — Tier 1 Gouvernance — Droit de veto*
*Intégré au framework AIAD v1.9 — Valeur "Primauté de l'Intention Humaine" + "Transparence Radicale"*
*Référentiel : Règlement (UE) 2024/1689 — Entré en vigueur le 1er août 2024*
*⚠️ Cet agent ne remplace pas une évaluation de conformité formelle ni un avis juridique qualifié.*

---

## Évolutions du document

| Date | Version | Modifications |
|------|---------|--------------|
| 2026-09-25 | v1.9 | **Calendrier recalé sur le Règlement (UE) 2026/1744** (Omnibus numérique IA, JO L du 24.7.2026, vérifié sur le texte) · deux nouvelles interdictions Art. 5 (b bis, b ter) · Art. 50 en vigueur · enforcement GPAI · Règlement Machines passé en section B de l'Annexe I · profil « Agents à effet irréversible » (classe de réversibilité, seuil d'arrêt, isolation, propriétés attendues) · consigne « Trace de délégation » · corrections : sanctions GPAI, T12, Art. 5, Art. 9/14/26 hors haut risque, double marquage CE · récits et sources déplacés vers `https://github.com/everssteeve/sdd-mode/blob/main/docs/legitimation/conformite-cas-2026.md` — détail : notes de version de la v1.9 |
| 2026-06-01 | v1.7 — autonomie financière | **+ PROFIL ÉMERGENT — AGENTS À AUTONOMIE FINANCIÈRE ET OPÉRATIONNELLE** : classification (Titre III si Annexe III, supervision renforcée Art. 26/9 sinon), 4 points de contrôle humains minimaux (validation délégation, plafond documenté, journal d'audit, rollback), articulation Execution Gate (validation des plafonds d'autonomie), cas terrain Cloudflare/Stripe — comble une lacune signalée par la veille du framework |
| 2026-05-01 | v1.6 — conformité opérationnelle | **+ MAPPING AI ACT ↔ ARTEFACTS AIAD** (article par article, 13 obligations) — **+ CHECKLIST DE CONFORMITÉ ASSISTÉE** (4 étapes, 17 points) avec avertissement juridique explicite — deadline 2 août 2026 documentée sur Art. 50 |
| 2026-04-20 | v1.5 — renforcement juridique | **+ CADRE LÉGAL DÉTAILLÉ** (texte fondateur + sanctions Art. 99 avec 4 paliers + 7 critères de modulation + autorités UE/France au 2026-04-20 + standards harmonisés CEN-CENELEC JTC 21 + Code of Practice GPAI 2 juil. 2025) — **+ GPAI détaillé** (obligations générales Art. 53 + GPAI à risque systémique Art. 51-55, seuil 10^25 FLOP, red-teaming, cybersécurité, notification incidents) — **+ OBLIGATIONS PAR ACTEUR** (tableau comparatif fournisseur Art. 16 / déployeur Art. 26 / importateur Art. 23 / distributeur Art. 24) — **+ procédure FRIA Art. 27** (6 éléments, articulation AIPD) — **+ Documentation technique Annexe IV** (9 sections détaillées) — **+ Annexe III détaillée** (8 catégories × exemples concrets) — **+ Registre UE Art. 49 & 71** — **+ ARTEFACTS OBLIGATOIRES** (Doc Annexe IV, FRIA, Déclaration UE de conformité Art. 47) — **+ ARTICULATION** (RGPD, DSA, Data Act, Règlement Machines 2023/1230, AI Liability Directive, règles de priorité) — **+ calendrier consolidé 2026-04-20** |
