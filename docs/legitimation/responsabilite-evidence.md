# Légitimation — La trace AIAD comme élément de preuve de la responsabilité

**Version 1.0 — Septembre 2026 — Steeve Evers**
Framework AIAD — Dossier de légitimation — aiad.ovh — Open Source

> ⚠️ Ce dossier décrit une logique de responsabilité, pas un avis juridique. Il ne remplace pas un conseil qualifié. Sources vérifiées le 25 septembre 2026.

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

## Sources

- Schneier on Security, « AI and Liability » (juin 2026) ; Simon Willison, 25 juin 2026
- Techdirt, 1er juillet 2026 ; Leaders League (appel de Google)
- GitLab, communiqué du 23 juin 2026

## Liens croisés

- [Légitimation empirique de la couche Vérification](./verification-evidence.md)
- [Légitimation empirique de l'Execution Gate](./execution-gate-evidence.md)
- AIAD-AI-ACT — consigne « Trace de délégation »

---

*Dossier de légitimation — Framework AIAD v1.9 — Septembre 2026*
*Gardien : Steeve Evers — aiad.ovh — Open Source*
