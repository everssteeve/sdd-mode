# Passer de `aiad-sdd` 1.x à 2.0

La 2.0 fait d'un outil de recherche un outil que l'on peut poser dans un projet réel. Les changements de rupture ci-dessous vont tous dans le même sens : ce qui est annoncé comme bloquant l'est vraiment, et l'outil ne touche plus à ce qui ne lui appartient pas.

## Avant de commencer

1. Validez ou remisez votre travail en cours : `git status` doit être propre, pour pouvoir relire ce que la mise à jour change.
2. Installez la version dans le projet, plutôt que de la lancer par `npx` sans version :
   ```bash
   npm install --save-dev aiad-sdd@^2
   ```
   C'est maintenant nécessaire : le veto de gouvernance refuse un commit d'agent quand il ne trouve pas la CLI.
3. Regardez ce qui va changer, sans rien écrire :
   ```bash
   npx aiad-sdd update --dry-run
   ```
4. Appliquez, puis vérifiez :
   ```bash
   npx aiad-sdd update
   npx aiad-sdd doctor
   ```

## Ce qui change

### Les garde-fous sont réellement installés

- **Avant** : si votre projet avait déjà un `.claude/settings.json`, `init` n'y installait aucun hook et `update` n'en posait qu'un. Le veto, le Drift Lock et le scan JNSP n'étaient donc pas actifs, sans que rien ne le signale.
- **Maintenant** : `update` fusionne tous les hooks AIAD dans votre `settings.json` et conserve vos propres hooks et permissions. `doctor` échoue en nommant les hooks manquants.
- **À faire** : lancez `update`, puis relisez le diff de `.claude/settings.json`.

### Le veto de gouvernance refuse quand il ne peut pas vérifier

- **Avant** : CLI absente ou en erreur, le commit passait.
- **Maintenant** : sans verdict lisible, le commit d'un agent est refusé, avec la marche à suivre. Un humain peut toujours passer outre hors agent avec `git commit --no-verify`.
- **À faire** : installez `aiad-sdd` en dépendance de développement (étape 2).

### Le chaînage automatique du cycle est désactivé par défaut

- **Avant** : la SPEC partait en Gate, l'exécution en validation, la validation en Drift Check, sans confirmation.
- **Maintenant** : chaque étape est lancée par un humain.
- **À faire** : rien si ce comportement vous convient. Pour retrouver l'ancien, mettez `auto_chain.enabled: true` dans `.aiad/config.yml`, en connaissance de cause.

### L'agent ne peut plus modifier ses propres garde-fous

Le `settings.json` livré refuse à l'agent la modification de `.aiad/hooks/**`, `.aiad/hook-bypass.yml`, `.aiad/hooks-config*.json`, `.aiad/gouvernance/**` et le commit avec `--no-verify`. Modifier `.aiad/config.yml` demande votre confirmation. Ces règles sont ajoutées à vos permissions existantes.

Limite à connaître : une règle de permission n'empêche pas un script lancé depuis le shell d'écrire dans ces fichiers. Le contrôle opposable reste celui que vous rejouez en intégration continue.

### Le pré-contrôle de Gate refuse une SPEC non rédigée

`aiad-sdd gate-precheck` renvoyait PASS sur un fichier vide. Il renvoie maintenant FAIL si la SPEC est vide, contient encore les marqueurs du gabarit, n'a pas d'Intent parent ou n'a aucun critère d'acceptation.

### Le Drift Lock du pre-commit demande une vraie SPEC

Modifier `.aiad/specs/_index.md` ne suffit plus à faire passer un commit de code : il faut qu'un fichier `.aiad/specs/SPEC-*.md` fasse partie du commit.

### Les instantanés de métriques ne sont plus purgés

Ils étaient supprimés au bout de 180 jours à chaque génération du tableau de bord. Ils sont maintenant conservés. Pour purger, fixez `dashboard.retentionJours` dans `.aiad/config.json`.

### Les alias plats sont retirés

`/sdd-spec`, `/aiad-status` et les autres alias plats disparaissent : utilisez `/sdd spec`, `/aiad status`. `update` retire les alias livrés en 1.x ; une commande que vous avez écrite ou modifiée est conservée.

### `uninstall` ne retire que ce que l'outil a installé

- Le texte que vous avez écrit dans `CLAUDE.md`, avant ou après la section SDD Mode, est conservé.
- Une commande du projet nommée `sdd-*.md` ou `aiad-*.md` n'est plus supprimée.
- Les hooks AIAD sont retirés de `settings.json`, vos réglages restent.

Les sections SDD Mode posées par la 2.0 sont délimitées par des balises `<!-- aiad-sdd:section-start -->` et `<!-- aiad-sdd:section-end -->`. Une section posée par une 1.x est retirée si elle est restée identique au gabarit ; sinon elle est laissée en place et signalée.

### Workflows d'intégration continue

Les workflows déjà présents dans votre dépôt ne sont pas modifiés par `update`. Deux points à reprendre à la main :

- remplacez `aiad-sdd@latest` par une version fixée (`aiad-sdd@^2`, ou mieux, votre dépendance de développement) ;
- `aiad-dashboard.yml` publiait le tableau de bord sur GitHub Pages à chaque push sur `main`. Le tableau de bord contient vos Intents et vos SPEC : dans la 2.0, la publication ne se fait que sur demande. Retirez le déclencheur `push` si vous ne voulez pas publier.

### Node.js

Node 22 au minimum (Node 18 et 20 ne sont plus maintenus).

### Guides de gouvernance

Les guides RGAA, RGESN, AI Act et RGPD ont été corrigés après vérification sur les textes officiels (dates d'arrêtés, base légale et montants des sanctions, délais de signalement des incidents graves, seuils CSRD). `update` sauvegarde vos adaptations locales avant d'écraser ; reportez-les dans les guides mis à jour. Le détail figure dans le journal « Évolutions du document » de chaque guide.

## Revenir en arrière

```bash
npm install --save-dev aiad-sdd@1.21
npx aiad-sdd update
```

Aucun format d'artefact (`.aiad/intents/`, `.aiad/specs/`, métriques) n'est modifié par la 2.0 : vos Intents et vos SPEC restent lisibles par la 1.21.

## Ce que la 2.0 ne fait pas encore

Dit sans détour, pour que vous sachiez sur quoi vous pouvez compter :

- L'ouverture de la Gate n'est pas encore un enregistrement signé par un humain : c'est une ligne de statut dans la SPEC.
- `/sdd validate` et `/sdd security` reposent sur une relecture par l'agent ; l'exécution déterministe des tests et des analyseurs, avec conservation des preuves, n'est pas livrée.
- Windows n'est pas testé ; le hook pre-commit exige bash.
- Le comportement des agents de rôle n'est pas mesuré par des évaluations rejouables.
- Les guides de gouvernance n'ont pas été relus en entier par un juriste.
