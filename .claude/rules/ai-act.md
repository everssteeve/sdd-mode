---
paths:
  - "**/ai/**"
  - "**/ml/**"
  - "**/llm/**"
  - "**/models/**"
  - "**/agents/**"
generated-by: aiad-emit-rules v1.19.0
source-hash: bfe8e08f4a6ec5bd
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
| **Août 2025** | Obligations GPAI — Art. 51-56 (modèles IA à usage général) | ✅ En vigueur depuis le 2 août 2025 |
| **2 août 2026** | Pouvoirs de supervision et de sanction de la Commission sur les fournisseurs GPAI (Art. 101) | ✅ En vigueur — premières demandes d'information le 29 août 2026 |
| **2 août 2026** | Obligations de transparence — Art. 50 (chatbots, deepfakes, contenus IA) | ✅ **En vigueur** — délai au 2 déc. 2026 pour l'art. 50(2) sur les seuls systèmes mis sur le marché avant le 2 août 2026 |
| **2 déc. 2026** | Deux nouvelles interdictions Art. 5(1) b bis et b ter (images intimes non consenties dont applications « nudifier » ; contenu pédocriminel) ; fin du délai art. 50(2) (art. 111(4)) | ⏳ À venir |
| **2 août 2027** | Bacs à sable réglementaires nationaux opérationnels ; conformité des modèles GPAI mis sur le marché avant le 2 août 2025 | ⏳ À venir |
| **2 déc. 2027** | Systèmes haut risque Annexe III (emploi, crédit, éducation…) — date originale : 2 août 2026 | ⏳ **Reporté** par le Règlement (UE) 2026/1744 |
| **2 août 2028** | Systèmes haut risque Annexe I (produits régulés) — date originale : 2 août 2027 | ⏳ **Reporté** par le Règlement (UE) 2026/1744 |

> ✅ **Omnibus numérique IA — adopté (v1.9)** : Règlement (UE) 2026/1744, en vigueur depuis le 27 juillet 2026. Il reporte les obligations haut risque (Annexe III → 2 décembre 2027, Annexe I → 2 août 2028), ajoute deux interdictions à l'Art. 5 (points b bis et b ter) à partir du 2 décembre 2026 et ouvre un délai transitoire limité pour l'art. 50(2). → Détail : section « Évolutions réglementaires ».

> ✅ **Art. 50 (transparence) est en vigueur depuis le 2 août 2026.** Seule exception : les fournisseurs de systèmes générant des contenus synthétiques (audio, image, vidéo, texte) **mis sur le marché avant le 2 août 2026** ont jusqu'au **2 décembre 2026** pour se conformer à l'art. 50(2) (art. 111(4) introduit par le Règlement 2026/1744). Un système mis sur le marché après le 2 août 2026 y est soumis immédiatement.


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
