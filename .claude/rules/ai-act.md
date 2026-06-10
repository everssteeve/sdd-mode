---
paths:
  - "**/ai/**"
  - "**/ml/**"
  - "**/llm/**"
  - "**/models/**"
  - "**/agents/**"
generated-by: aiad-emit-rules v1.17.0
source-hash: aad6af3f795db48a
---

<!-- DO NOT EDIT — regenerate via /aiad-emit-rules -->

# AIAD-AI-ACT — Conformité EU AI Act (Règlement 2024/1689) — règle à chargement ciblé (pull §3.7)

> Cette règle ne se charge à froid que sur les fichiers de sa zone de risque
> (frontmatter `paths:`). C'est de l'**advisory** allégé : le vrai garde-fou
> reste **enforced** par le hook `PreToolUse`/`Stop` et le subagent read-only
> `.claude/agents/AIAD-AI-ACT.md` (`UNKNOWN = VETO`, fail-closed).
> Source unique : `.aiad/gouvernance/AIAD-AI-ACT.md` — ne pas éditer à la main.

## MISSION DE CET AGENT

Tu es un agent de développement avec une responsabilité structurante : **avant d'écrire le moindre code impliquant un composant IA, tu dois qualifier le niveau de risque du système et adapter l'implémentation en conséquence**. Les obligations de l'AI Act sont proportionnelles au risque : un chatbot d'assistance ≠ un système de scoring de crédit ≠ un logiciel de recrutement automatisé.

**Principe directeur :** L'IA que tu construis aura un impact réel sur des personnes réelles. La transparence, la supervision humaine et la robustesse ne sont pas des options — ce sont les conditions de légitimité d'un système IA.

**Calendrier d'application à retenir :**

| Date | Obligation | Statut |
|------|-----------|--------|
| **Février 2025** | Interdictions absolues (Art. 5) | ✅ En vigueur — date confirmée |
| **Août 2025** | Obligations GPAI — Art. 51-56 (modèles IA à usage général) | ✅ En vigueur — date confirmée |
| **2 août 2026** | Obligations de transparence — Art. 50 (chatbots, deepfakes, contenus IA) | ✅ **Confirmée — NON reportée par l'Omnibus** |
| **2 août 2026** | Systèmes haut risque Annexe III (emploi, crédit, éducation…) | ⚠️ **Proposé reporté au 2 déc. 2027** — *sous réserve adoption Omnibus VII* |
| **2 août 2026** | Systèmes haut risque Annexe I (produits régulés) | ⚠️ **Proposé reporté au 2 août 2028** — *sous réserve adoption Omnibus VII* |
| **2 août 2027** | Application complète (dates originales) | ⚠️ Dates en cours de révision via Omnibus VII |

> ⚠️ **Important — Omnibus VII (v1.4)** : Le Conseil (13 mars 2026) et le Parlement (26 mars 2026) ont adopté leurs positions favorables au report des obligations high-risk. Le trilogue est en cours depuis le 27 mars 2026, avec un accord final attendu mi-2026. **L'Omnibus VII n'est PAS encore adopté.** Si le trilogue n'aboutit pas avant le 2 août 2026, les dates originales s'appliquent. → Voir section "Évolutions réglementaires en cours" pour le suivi.

> ✅ **Art. 50 (transparence) n'est PAS reporté** : Les obligations de divulgation chatbots, marquage contenus IA et watermarking GPAI restent exigibles au 2 août 2026, indépendamment de l'Omnibus VII.


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

*Régénéré par `npx aiad-sdd emit-rules` depuis `.aiad/gouvernance/AIAD-AI-ACT.md`.*
