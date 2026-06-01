# La dette de maintenance agentique — pourquoi spec-first

> **Argumentaire d'opportunité (cycle mai 2026).** Document de légitimation : il s'appuie sur
> une fenêtre narrative datée (modèle Shore, signal « back to hand coding »). À réévaluer aux
> cycles suivants.
>
> ⚠️ Chiffres et références issus de la veille ALIS — **à confirmer avant publication externe.**

## Le problème : produire plus n'allège pas la maintenance

Quand des agents IA **doublent** la quantité de code produit **sans réduire d'autant l'effort de
maintenance**, la capacité d'évolution de l'équipe s'érode mécaniquement. Le modèle quantitatif
attribué à **James Shore** illustre l'effet : à production doublée sans gain de maintenabilité,
une équipe peut voir sa **capacité utile chuter d'environ 50 % en ~2,5 ans** — l'essentiel du
temps passant à entretenir un volume de code croissant que personne n'a vraiment conçu.

C'est la **dette de maintenance agentique** : non pas la dette technique classique, mais celle
qui naît d'un code généré vite, accepté sans modèle conceptuel partagé, et qu'il faut ensuite
porter indéfiniment.

## La métaphore : le *tar pit*

Martin Fowler reprend l'image du **tar pit** (la fosse à goudron) — déjà chez Fred Brooks dans
*The Mythical Man-Month* : plus on produit sans structure, plus on s'enlise ; chaque mouvement
supplémentaire coûte davantage que le précédent. La vélocité apparente du jour 1 devient la
viscosité du mois 12.

## Le signal terrain : « back to hand coding »

La communauté technique nomme désormais cette fatigue. Le fil **« back to hand coding »**
(~599 points sur Hacker News) traduit un retour de balancier : des praticiens crédibles
reviennent à un code écrit et compris à la main, faute d'avoir maîtrisé la dette générée par
une délégation non gouvernée. **Le problème est reconnu — pas seulement théorisé.**

## La réponse AIAD : spec-first + Drift Lock

AIAD attaque la dette de maintenance agentique en amont, par deux mécanismes :

1. **Spec-first** — l'intention et la spécification (Intent Statement → SPEC, SQS ≥ 4/5)
   précèdent le code. On ne génère pas du code qu'on ne comprend pas : on génère du code qui
   réalise une intention explicitée et validée par un humain.
2. **Drift Lock** — code et SPEC évoluent **dans la même PR**. Le code ne peut pas dériver
   silencieusement de l'intention documentée ; la traçabilité (`/sdd trace`) rend l'écart
   mesurable, pas supposé.

### Pourquoi spec-first réduit la maintenance

- **Le modèle conceptuel est écrit avant le code** → la connaissance n'est pas enfermée dans
  l'implémentation, elle survit au turnover et à l'oubli.
- **Chaque ligne se rattache à une intention** (`@intent`, `@spec`) → la maintenance sait
  *pourquoi* le code existe, pas seulement *ce qu'*il fait.
- **Le drift est bloqué à la source** → pas d'accumulation d'écarts code/intention, donc pas de
  fosse à goudron qui se remplit en silence.

En d'autres termes : la dette de maintenance agentique vient d'un code qu'on **accepte sans
comprendre** ; AIAD impose de **comprendre (et valider l'intention) avant de produire**.

## Liens internes

- Légitimation de l'Execution Gate : [`execution-gate-evidence.md`](./execution-gate-evidence.md)
- Context Engineering Budget & spec-first : [`SDDMode.md`](../../SDDMode.md)

## Sources (à vérifier avant publication)

- Modèle de dette de maintenance — James Shore (à sourcer précisément).
- *Tar pit* — Martin Fowler ; Fred Brooks, *The Mythical Man-Month*.
- Fil « back to hand coding » — Hacker News (~599 pts), mai 2026.
