# Plan — §4 Garde-fous de conception (transverse)

> **Recommandation** : §4 de `analyse-claude-code-best-practice.md`
> **Priorité** : Transverse · à inscrire dans la philosophie SDD
> **Statut** : PLAN — aucune modification du SDD Mode

---

## 1. Intention (le POURQUOI)

Les §3.1→§3.13 sont des évolutions mécaniques. Les garde-fous §4 sont la **philosophie qui les borne** : convergence Karpathy / Dex / Matt / Boris. Sans eux, on risque de sur-ingénierer (contre « léger par défaut ») ou de construire un échafaudage que le prochain modèle rendra inutile. Chaque garde-fou doit être **inscrit dans la doctrine SDD** et **vérifié** au fil des plans précédents. Ce plan ne crée pas de feature ; il définit des **critères de conception transverses** + leur ancrage.

## 2. Les 5 garde-fous → traduction SDD

| # | Garde-fou (§4) | Traduction opérationnelle SDD | Ancrage dans les plans |
|---|----------------|-------------------------------|------------------------|
| GF1 | SDD *est* l'« agentic engineering » de Karpathy formalisé | Positionnement explicite : vibe coding remonte le plancher ; SDD **préserve la barre** (Human Authorship + verifiability) | Doctrine (PRD/README) |
| GF2 | Garder le code en boucle (≠ specs-to-code naïf) | **Discovery obligatoire** ancré dans le code avant toute SPEC | §3.5 |
| GF3 | Léger par défaut, lourd seulement si l'ambiguïté coûte cher | EARS/Research **proportionnés** ; ni PRD ni ticketing imposés | §3.5, §3.6, §3.7, EARS v1.11 |
| GF4 | Gate humain = interactif (grilling 1 question/réponse recommandée) | Les gates posent **une question à la fois + recommandation**, pas un formulaire statique | §3.5, §3.6 (mode `--guided`) |
| GF5 | Prévoir des règles qui se suppriment | Marquer les règles « à retirer quand le modèle n'en a plus besoin » | Transverse (métadonnée) |

## 3. Conception détaillée par garde-fou

### GF1 — Positionnement « agentic engineering »
- Inscrire dans `PRD.md` / `README.md` / `frameworkAIAD.md` une section « SDD = agentic engineering formalisé » : différenciation nette vis-à-vis du vibe coding et du « specs-to-code naïf ».
- Reformuler la valeur **Verifiability** (Karpathy : ce que les LLM automatisent vite) comme pilier — déjà servie par `trace`/annotations.

### GF2 — Code en boucle
- Garde-fou vérifié par §3.5 (Discovery `Explore` obligatoire).
- Ajouter un **critère de conception** : aucune commande SDD ne doit produire de code sans un ancrage codebase préalable (revue à chaque nouvelle commande).

### GF3 — Léger par défaut
- **Heuristique de proportionnalité** : un champ `weight: light|heavy` (ou détection auto sur l'Intent) qui module la lourdeur de Research/SPEC/Gate.
  - Intent simple/réversible → chemin court (façon « better send a PR »).
  - Intent à fort risque (sécurité, paiement, conformité) → EARS + Research complète.
- À implémenter comme **réglage commun** consommé par §3.5 et §3.6, pas comme feature isolée.

### GF4 — Gate humain interactif (« grill me »)
- Les modes `--guided` des gates (`/sdd gate`, `/sdd research`) doivent suivre le pattern **`grill me`** : **une question à la fois**, l'agent **propose sa réponse recommandée**, l'humain valide/corrige (paternité).
- Nouvelle skill optionnelle `grill-me` (façon Matt Pocock) réutilisable par les gates — pattern de design concept de Brooks.

### GF5 — Règles à durée de vie limitée
- Convention de **métadonnée d'obsolescence** dans les règles/skills : frontmatter `sunset_when: "le modèle pose nativement les annotations"` ou `review_at: <version Claude Code>`.
- `/aiad health` (ou `aiad-sdd doctor`) signale les règles candidates au retrait à chaque montée de version majeure (l'analyse note : « plan mode sera *unship* », les best-practices changent à chaque modèle).
- Aligné avec la note finale de l'analyse : « À relire à chaque montée de version majeure de Claude Code ».

## 4. Étapes d'implémentation séquencées

1. **Spec** : SPEC-NNN-garde-fous (doctrine + 2 mécanismes : proportionnalité GF3, sunset GF5).
2. Rédiger la section doctrine GF1 dans `PRD.md`/`README.md`/`frameworkAIAD.md`.
3. Définir le réglage de proportionnalité GF3 (`weight`/auto) — consommé par §3.5/§3.6.
4. Créer la skill `grill-me` (GF4) et la référencer dans les modes `--guided` des gates.
5. Ajouter la métadonnée `sunset_when`/`review_at` (GF5) + check dans `lib/doctor.js`/`/aiad health`.
6. Inscrire GF2 comme critère de revue (checklist de contribution `CONTRIBUTING.md`).

## 5. Fichiers touchés / créés

- **Créés** : `templates/.claude/skills/grill-me/SKILL.md`, tests.
- **Modifiés** : `PRD.md`, `README.md`, `frameworkAIAD.md`, `CONTRIBUTING.md`, `lib/doctor.js`, `templates/.claude/aiad/health.md`, frontmatter des rules/skills (métadonnée sunset), `templates/.claude/sdd/{gate,research}.md`.

## 6. Critères d'acceptation (EARS)

- **the system SHALL** documenter le positionnement « agentic engineering » (GF1).
- **the system SHALL NOT** produire de code sans Discovery codebase préalable (GF2 — vérifié par §3.5).
- **WHERE** un Intent est jugé simple/réversible, **the system SHALL** proposer un chemin léger ; **WHERE** il touche un domaine à risque, **the system SHALL** imposer le chemin lourd (GF3).
- **WHEN** un gate s'exécute en mode `--guided`, **the system SHALL** poser une question à la fois en proposant une réponse recommandée (GF4).
- **the system SHALL** marquer les règles d'une métadonnée d'obsolescence et signaler les candidates au retrait à chaque version majeure (GF5).

## 7. Tests & vérification

- Test GF3 : Intent risqué → chemin lourd forcé ; Intent trivial → chemin court proposé.
- Test GF4 : mode `--guided` pose 1 question/tour + recommandation.
- Test GF5 : `doctor`/`health` liste les règles avec `sunset_when` atteint.
- Revue GF1/GF2 : présence des sections doctrine + checklist contribution.

## 8. Risques, dépendances, rollback

- **Risque** : GF3 mal calibré bloque/allège à tort → heuristique conservatrice + override humain (paternité).
- **Dépendance** : §3.5 (GF2/GF3/GF4), §3.7 (léger par défaut), §3.10 (relire à chaque version).
- **Rollback** : les garde-fous sont surtout doctrinaux + 2 mécanismes additifs, désactivables.

## 9. Effort & découpage en SPECs

- SPEC-A : doctrine GF1/GF2 (doc) + skill `grill-me` GF4. *(Faible)*
- SPEC-B : proportionnalité GF3 + métadonnée sunset GF5. *(Faible-Moyen)*

**Effort global** : Faible. Valeur : **borne la roadmap** — empêche la sur-ingénierie et garde SDD aligné avec l'évolution des modèles.
