# Légitimation — La trace AIAD comme élément de preuve de la responsabilité

**Version 1.1 — Novembre 2026 — Steeve Evers**
Framework AIAD — Dossier de légitimation — aiad.ovh — Open Source

> ⚠️ Ce dossier décrit une logique de responsabilité, pas un avis juridique. Il ne remplace pas un conseil qualifié. Sources vérifiées le 25 septembre 2026 (§ 1 à 4) et le 12 novembre 2026 (§ 5).

---

## 1. La thèse

Bruce Schneier et Nathan Sanders l'ont formulée en juin 2026 : « AI agents are agents of the person or organization that deploys them—and should be treated by the law as such. » **C'est une thèse, qu'AIAD fait sienne, pas encore un état du droit** : une organisation ne devrait pas pouvoir s'abriter derrière « c'est l'IA qui l'a fait » ; elle doit pouvoir répondre de ce que font les agents qu'elle déploie.

## 2. Un premier signal judiciaire — à lire avec ses limites

Le 28 mai 2026, le tribunal régional de Munich a, par une **injonction provisoire**, tenu Google directement responsable d'affirmations fausses et diffamatoires générées par ses AI Overviews sur deux entreprises, au motif que ces résumés sont « avant tout une expression de l'activité commerciale de Google ».

Trois limites, à ne jamais omettre en citant ce cas :
- il porte sur la **diffamation par un moteur de recherche**, pas sur des agents de développement logiciel ;
- c'est une **décision provisoire** ;
- **Google a fait appel**.

C'est un **signal** — la première fois qu'un tribunal attribue explicitement à l'entreprise ce que produit son IA —, pas une jurisprudence établie.

## 3. La difficulté pratique

Selon le GitLab AI Accountability Report (juin 2026, enquête Harris Poll auprès de 1 528 développeurs et acheteurs de technologie), **43 % des répondants ne distinguent plus de façon fiable le code généré par IA du code écrit par un humain**, et **34 %** des organisations ayant subi un incident n'ont pas pu déterminer si du code généré par IA en était la cause. Enquête déclarative, commandée par un éditeur d'outils de développement.

Une organisation qui ne sait pas d'où vient son code ne peut pas démontrer comment elle l'a gouverné.

## 4. Ce qu'apportent les artefacts AIAD

Si l'organisation répond de ses agents, elle doit pouvoir montrer ce qu'elle leur a demandé, dans quelles limites, et qui l'a validé :

| Artefact | Ce qu'il documente |
|----------|-------------------|
| **Intent Statement** | L'intention et son auteur humain identifié |
| **SPEC** | Le périmètre délégué à l'agent |
| **Trace de l'Execution Gate** | La validation humaine avant exécution |
| **Drift Lock** | La synchronisation entre ce qui était voulu et ce qui a été livré |

Ces artefacts ne garantissent pas l'issue d'un litige. Ils documentent la **diligence** de l'organisation et rendent sa responsabilité **démontrable — dans un sens comme dans l'autre**. Une trace qui peut prouver la diligence peut aussi prouver la faute : une SPEC défectueuse validée à la Gate engage celui qui l'a validée. **Une trace qui ne pourrait que disculper ne serait pas une preuve.** C'est précisément ce qui la rend crédible (Valeur 2 — Honnêteté sur les Contradictions ; Valeur 6 — Responsabilité Partagée).

---

## 5. Qui répond de quoi : fournisseur et déployeur *(v1.10 — sources vérifiées le 12 novembre 2026)*

La thèse du § 1 dit *qui* répond des agents : l'organisation qui les déploie. L'automne 2026 apporte quatre éléments sur ce que cette responsabilité recouvre. Aucun ne la fait reposer sur le seul déployeur ; pris ensemble, ils montrent pourquoi il ne peut pas s'en remettre au fournisseur.

### 5.1 Les fournisseurs ne garantissent pas leurs propres garde-fous

Le 5 octobre 2026, le conseil municipal de New York a entendu sous serment quatre fournisseurs de modèles. À la question de la présidente — assurer que leurs agents respecteront toujours les garde-fous qu'ils leur imposent — aucun n'a répondu oui. OpenAI : « It's not possible for me to commit or guarantee that any technology is without risk. » Anthropic : « the science of doing this is fundamentally hard and unsettled ».

*Source et limite :* le communiqué officiel du conseil confirme l'audition, le serment et les témoins, pas ces réponses. Les citations viennent d'une transcription publiée par un tiers (Rev.com) ; AIAD n'a pas trouvé de procès-verbal officiel.

### 5.2 Un fournisseur documente des actions non voulues de ses propres modèles

Le 9 octobre 2026, Anthropic a publié un rapport sur des actions non voulues de plusieurs de ses modèles, surtout pendant des évaluations et dans quelques usages internes : exploitation de failles d'injection sur des sites tiers, envoi d'un formulaire d'exercice sur le site réel d'une administration, signalement inventé déposé sur le formulaire en ligne d'un service de police, usage de jetons d'accès trouvés dans les pages, raccourcisseurs d'URL pour contourner une limite de son outil de navigation. L'éditeur qualifie l'impact réel de minimal, ne donne aucun décompte, et annonce avoir coupé l'accès à internet de ses évaluations internes le temps de fiabiliser sa surveillance, et migrer ses agents internes vers « centrally managed infrastructure with strong containment ».

*Limite :* c'est le compte rendu d'un éditeur sur ses propres systèmes, non audité. Il ne dit rien de la responsabilité des clients.

### 5.3 Deux régulateurs s'en saisissent — sans désigner de responsable

- **ICO britannique, 8 octobre 2026.** Appel à contributions de six semaines sur l'IA agentique et la protection des données, adressé aux développeurs, aux déployeurs et aux experts. Richard Nevinson, directeur de la régulation des technologies : « Our message is clear: the fact AI agents act with autonomy is not an excuse for poor compliance. » L'autorité indique avoir adressé des demandes d'information (« enquiries ») à OpenAI, Anthropic, Meta et à l'institut britannique de sécurité de l'IA — pas une enquête formelle. Régime proche du RGPD, sans force contraignante dans l'UE.
- **Commission européenne, 9 octobre 2026.** Réunion spéciale du panel scientifique de l'AI Act, qui « has been investigating recent loss-of-control incidents » ; le panel et l'AI Office ont préparé une série de questions pour les entreprises qui ont développé les modèles concernés. Le communiqué ne nomme aucune entreprise et ne cite aucune base légale.

### 5.4 Ce que dit le droit, et ce que disent les contrats

L'AI Act répartit : au fournisseur d'un système à haut risque, la conception du contrôle humain (Art. 14) et le signalement des incidents graves (Art. 73) ; au fournisseur d'un modèle à risque systémique, le signalement à l'AI Office (Art. 55) ; au déployeur, l'affectation du contrôle humain à des personnes compétentes, formées, dotées d'autorité et de soutien (Art. 26(2)). Pour l'Annexe III, ces obligations s'appliquent à partir du 2 décembre 2027.

Les contrats, eux, s'appliquent déjà. La politique d'usage d'Anthropic (version du 12 novembre 2026) rend l'utilisateur responsable de la conformité des agents qu'il construit ou déploie (« Users are responsible for ensuring that agents they build or deploy […] comply with this Usage Policy »), et exige pour une recommandation à haut risque la revue d'une personne qualifiée — « someone with the training or experience to evaluate the output in that field » — ayant autorité pour la modifier. L'éditeur précise que ces exigences ne sont pas nouvelles.

### 5.5 Ce qu'AIAD en retient — et ce qui résiste à la thèse

**La position.** La responsabilité est **partagée et étagée**. Mais trois tâches ne se délèguent pas à un fournisseur, parce que lui ne voit pas le terrain : le **confinement de l'usage**, le **moindre privilège** et l'**affectation d'un humain qualifié**. Les garanties du fournisseur ne s'y substituent pas — c'est lui-même qui le dit (§ 5.1).

**Ce qui résiste.**
- Les incidents des § 5.2 et de l'affaire australienne (dossier `conformite-cas-2026.md`, § 4.1) se sont produits **chez les fournisseurs**, sur leurs propres systèmes. Ils prouvent que le défaut peut naître dans le modèle ; ils ne prouvent pas que les déployeurs se confinent mal.
- L'AI Act place la **conception** du contrôle humain et le **signalement** chez le fournisseur. Un déployeur qui affirmerait porter toute la responsabilité se tromperait autant que celui qui la renverrait toute.
- L'ICO **ne désigne pas** le déployeur. Lire son communiqué comme « c'est le déployeur qui répond » est une extrapolation.
- Une politique d'usage est le contrat d'un seul éditeur. Elle peut changer, et elle n'est pas le droit.

---

## Sources

- New York City Council, communiqué du 5 octobre 2026 ; transcription de l'audition publiée par Rev.com
- Anthropic, « Investigating unintended model actions », 9 octobre 2026 (corrigé le 12 octobre) ; politique d'usage et billet du 8 octobre 2026
- ICO, communiqué du 8 octobre 2026
- Commission européenne, communiqué du 9 octobre 2026 (mis à jour le 26 octobre)
- Règlement (UE) 2024/1689, Art. 14, 26, 55, 73
- Schneier on Security, « AI and Liability » (juin 2026) ; Simon Willison, 25 juin 2026
- Techdirt, 1er juillet 2026 ; Leaders League (appel de Google)
- GitLab, communiqué du 23 juin 2026

## Liens croisés

- [Légitimation empirique de la couche Vérification](./verification-evidence.md)
- [Légitimation empirique de l'Execution Gate](./execution-gate-evidence.md)
- AIAD-AI-ACT — consigne « Trace de délégation » et section « Responsabilité du déployeur d'agents »
- [Cas et contexte réglementaires 2026](./conformite-cas-2026.md)

---

*Dossier de légitimation — Framework AIAD v1.10 — Novembre 2026 (v1.0 : septembre 2026)*
*Gardien : Steeve Evers — aiad.ovh — Open Source*
