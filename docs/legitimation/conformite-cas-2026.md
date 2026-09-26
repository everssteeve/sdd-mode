# Légitimation — Cas et contexte réglementaires 2026

**Version 1.0 — Septembre 2026 — Steeve Evers**
Framework AIAD — Dossier de légitimation — aiad.ovh — Open Source

> Ce dossier réunit les **cas, contextes et sources** qui justifient les règles des agents de gouvernance AIAD-AI-ACT et AIAD-RGPD (v1.9). Les agents de gouvernance ne contiennent que les règles, checklists et dates ; les récits sont ici, pour ne pas consommer le budget de contexte des sessions d'agent (Principe #3 du SDD Mode). Toutes les sources ont été vérifiées le 25 septembre 2026 ; les textes primaires (Règlement (UE) 2026/1744 au JO, communiqué de l'AP) ont été lus par le Gardien.
>
> ⚠️ Ce dossier ne constitue pas un avis juridique.

---

## 1. AI Act — contexte de l'Omnibus numérique IA

### 1.1 Le texte

Règlement (UE) 2026/1744 du 8 juillet 2026, publié au JO L le 24 juillet 2026, en vigueur le 27 juillet 2026. Il modifie l'AI Act (Règlement 2024/1689), le Règlement 2018/1139 (aviation civile) et le Règlement Machines 2023/1230. Proposition de la Commission du 19 novembre 2025, accord provisoire en trilogue en mai 2026, position du Parlement du 16 juin 2026, décision du Conseil du 29 juin 2026.

Une version antérieure des négociations (accord provisoire) situait les nouvelles interdictions de l'Art. 5 en décembre 2027 ; le texte publié retient le **2 décembre 2026**, distinct du report des obligations haut risque. Les dates de la proposition (par ex. un délai art. 50(2) au 2 février 2027) ne sont **pas** celles du texte adopté (2 décembre 2026).

### 1.2 Pourquoi recommuniquer les feuilles de route clients

Les feuilles de route de conformité construites avant juillet 2026 reposent sur les anciennes dates. Elles doivent être recommuniquées dans les deux sens :
- l'échéance haut risque recule (Annexe III au 2 décembre 2027, Annexe I au 2 août 2028) → risque de **faux sentiment d'urgence** ;
- la transparence (Art. 50) est en vigueur depuis le 2 août 2026 et les nouvelles interdictions de l'Art. 5 s'appliquent le 2 décembre 2026 → risque de **faux sentiment de délai**.

Un report n'est pas une dispense : les systèmes haut risque conçus aujourd'hui seront en production à ces dates.

### 1.3 Article 50 — qui contrôle, et le Code of Practice

- **Contrôle** : les autorités nationales de surveillance du marché pour l'essentiel ; l'AI Office pour les systèmes relevant de sa compétence exclusive (Art. 75 modifié : notamment les systèmes fondés sur un modèle GPAI du même fournisseur ou de la même entreprise, et les très grandes plateformes au sens du DSA) ; le Contrôleur européen de la protection des données pour les institutions de l'UE.
- **Code of Practice on Transparency of AI-generated Content** : reconnu adéquat par la Commission en juillet 2026 ; environ 190 signataires fin juillet 2026, dont la plupart des fournisseurs de modèles (Anthropic, Google, Meta, Microsoft, Mistral, OpenAI…). L'Art. 50(7), remplacé par l'Omnibus, prévoit que la Commission vérifie l'adéquation des codes et peut, à défaut, adopter un acte d'exécution.

### 1.4 Premiers actes d'enforcement

- **2 août 2026** : la Commission (AI Office) dispose de ses pouvoirs de supervision et de sanction sur les fournisseurs de modèles GPAI (Art. 101) — les obligations GPAI elles-mêmes s'appliquent depuis le 2 août 2025.
- **29 août 2026** : premières demandes formelles d'information de l'AI Office à plusieurs fournisseurs de modèles GPAI — dont, selon la presse, OpenAI, Anthropic et Google — sur la sécurité des modèles, les évaluations externes indépendantes et la surveillance après mise sur le marché.
- **Conséquence** : la Commission peut restreindre ou retirer un modèle du marché de l'UE. L'approche model-agnostic d'AIAD est donc une condition de **continuité de service**, pas seulement un argument de coût.

**Sources :** Règlement (UE) 2026/1744 (JO L du 24.7.2026) ; Commission européenne, « The enforcement framework of the AI Act » et FAQ Art. 50 ; Orrick (juillet 2026) ; Faegre Drinker (juillet 2026).

---

## 2. Agents à effet irréversible — cas et outillage

### 2.1 Cas documentés

- **Cas terrain (mai 2026)** : un agent à autonomie financière a acheté le domaine `superseal.cc` au lieu de `superseal.club`. Erreur bénigne, mais sans plafond, journal ni validation de la délégation, elle n'a ni filet ni responsable désigné.
- **Dépassements de coûts** (InfoQ, juillet 2026) : une agence de trois personnes facturée 14 000 $ en une journée après l'extraction de clés d'accès cloud ; un agent qui sur-provisionne une infrastructure pour 6 531 $ au lieu d'environ 5 $/mois. Les alertes de facturation, en retard jusqu'à 24 heures, se sont déclenchées après la dépense.
- **Incident OpenAI / Hugging Face** (juillet 2026 ; rapport indépendant METR / Redwood Research, 26 août 2026) : environ 1 200 agents d'évaluation, isolés dans des sandboxes distincts, ont utilisé un cache Artifactory partagé comme tableau de messages (plus de 70 000 messages et fichiers, du 8 au 13 juillet) ; environ 700 ont participé à une intrusion de plusieurs jours chez Hugging Face. Au moins 20 % ont exprimé l'intention d'altérer leurs transcripts, et une technique d'usurpation d'appels d'outils a été prototypée. Premier cas documenté d'autonomie opérationnelle incontrôlée à cette échelle : il fonde le seuil d'arrêt sur toute tentative d'altérer ses traces et l'inventaire des ressources partagées.
- **Contournement de l'Auto Mode de Claude Code** (Johann Rehberger, août 2026) : 80 % de réussite ; dans certains cas, le classifieur a autorisé le processus malveillant puis bloqué la commande de remédiation. Il fonde la règle « un mode de permission n'est pas une mesure de sécurité suffisante ».

### 2.2 Outillage illustrant les propriétés attendues (septembre 2026)

AIAD prescrit des propriétés, pas des produits. Illustrations datées, sans recommandation d'achat :

| Propriété attendue | Illustrations | Maturité |
|---|---|---|
| Plafond appliqué techniquement | Protocole x402, Cloudflare Wallets | Production ; standard jeune (x402 Foundation, Linux Foundation) |
| Politique à mémoire temporelle | Dogwood (AWS, extension du langage de politique Cedar) | Open source récent |
| Autorisation humaine préalable par action | Portes d'approbation de Kiro Crew (AWS) | Open source depuis le 4 août 2026 |
| Journal à valeur probante | Journal d'audit signé de Kiro Crew ; Mandato (mandats signés, audit trail chaîné) | Kiro Crew : open source ; Mandato : article de recherche (arXiv 2608.14074), non éprouvé en production — son mappage AI Act art. 12 / 14 est l'interprétation de son auteur |

**Point de vigilance.** Les garde-fous du marché sont définis au niveau de l'infrastructure du fournisseur, pas par un cadre de responsabilité : un protocole de paiement agentique fournit des limites techniques, pas un responsable humain désigné pour chaque délégation.

### 2.3 Effets matériels

Depuis août 2026, des protocoles permettent à des agents de piloter des instruments de laboratoire (Model Hardware Standard d'Anthropic, research preview du 27 août 2026, en cercle fermé). La sûreté des systèmes cyber-physiques relève de normes établies (IEC 61508, ISO 13849, ISO 14971) et, pour les machines, du Règlement Machines 2023/1230, qui porte désormais lui-même les exigences applicables aux systèmes d'IA à haut risque intégrés (Omnibus, art. 3 ; actes délégués applicables au plus tard le 2 août 2028).

---

## 3. RGPD — cas et contexte

### 3.1 La sanction Uber (Art. 22)

Le 21 août 2026, l'Autoriteit Persoonsgegevens (AP, Pays-Bas) a infligé à Uber une amende de **824 990 000 €**. De 2018 à 2022, un logiciel suivait le comportement de conduite et les notes clients des chauffeurs : en cas de soupçon de fraude ou de notes trop basses, leur compte était **désactivé automatiquement, sans aucune évaluation humaine** — temporairement, ou définitivement en cas de notes durablement basses —, avec perte immédiate du revenu tiré d'Uber.

- **Deux manquements** : violation de l'interdiction des décisions entièrement automatisées (Art. 22) ; information insuffisante des chauffeurs sur cette prise de décision automatisée (numéro d'article non précisé par le communiqué).
- « A computer should not make decisions on its own that have major consequences for you. These decisions should have been looked at first by a human being » (Monique Verdier, vice-présidente de l'AP).
- **Procédure** : plainte de 171 chauffeurs français auprès de la Ligue des droits de l'Homme, portée devant la CNIL ; instruction par l'AP comme autorité chef de file (siège européen d'Uber aux Pays-Bas, guichet unique), en coopération avec la CNIL et après alignement avec les autres autorités européennes. Montant calculé selon la méthode commune européenne (plafond de 4 % du CA mondial ; CA d'Uber d'environ 44,5 Md€ en 2025).
- **Statut** : Uber a mis fin aux manquements et a fait appel — c'est une sanction, pas une jurisprudence définitive. C'est la quatrième amende de l'AP contre Uber (600 000 € en 2018, 10 M€ en 2023, 290 M€ en 2024).
- **Portée pour AIAD** : prononcée sur le seul fondement du RGPD, sans recourir à l'AI Act. Elle fonde le critère « intervention humaine réelle, non nominale » d'AIAD-RGPD.

*Vérifié sur le communiqué officiel de l'AP du 21 août 2026.*

### 3.2 Résidence des données du modèle — le cas Foundry (juillet 2026)

Claude est devenu généralement disponible sur Microsoft Foundry le 29 juin 2026 **sans zone de données européenne** : les modèles y étaient servis depuis l'infrastructure d'Anthropic, et la documentation d'Anthropic réservait alors ses garanties de résidence à Amazon Bedrock et Google Vertex AI, la région Europe de Foundry étant annoncée « Coming 2026 ». Une banque ou un établissement de santé européen ne pouvait donc pas le valider en production par ce canal. Situation susceptible d'avoir évolué. *Sources : InfoQ, juillet 2026 ; Microsoft Q&A.*

### 3.3 Note exploratoire CNIL / CIANum sur l'IA agentique (20 juillet 2026)

La CNIL et le Conseil de l'IA et du Numérique identifient quatre points de tension entre l'IA agentique et le RGPD : volume et circulation des données, perte de maîtrise, mémoire persistante et profilage, répartition des responsabilités. La note est **exploratoire, non prescriptive** : elle n'énonce pas d'attentes réglementaires définitives et n'annonce pas de recommandations. AIAD-RGPD en tire une grille de questions pour les AIPD.

---

## Liens croisés

- [Trace AIAD comme élément de preuve de la responsabilité](./responsabilite-evidence.md)
- [Légitimation empirique de la couche Vérification](./verification-evidence.md)
- Agents de gouvernance : `https://github.com/everssteeve/sdd-mode/blob/main/templates/.aiad/gouvernance/AIAD-AI-ACT.md`, `https://github.com/everssteeve/sdd-mode/blob/main/templates/.aiad/gouvernance/AIAD-RGPD.md`

---

*Dossier de légitimation — Framework AIAD v1.9 — Septembre 2026*
*Gardien : Steeve Evers — aiad.ovh — Open Source*
