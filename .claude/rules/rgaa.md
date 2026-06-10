---
paths:
  - "**/components/**"
  - "**/pages/**"
  - "**/views/**"
  - "**/app/**/*.tsx"
  - "**/app/**/*.jsx"
  - "**/*.vue"
generated-by: aiad-emit-rules v1.17.0
source-hash: aad6af3f795db48a
---

<!-- DO NOT EDIT — regenerate via /aiad-emit-rules -->

# AIAD-RGAA — Accessibilité numérique (RGAA 4.1 / WCAG 2.1) — règle à chargement ciblé (pull §3.7)

> Cette règle ne se charge à froid que sur les fichiers de sa zone de risque
> (frontmatter `paths:`). C'est de l'**advisory** allégé : le vrai garde-fou
> reste **enforced** par le hook `PreToolUse`/`Stop` et le subagent read-only
> `.claude/agents/AIAD-RGAA.md` (`UNKNOWN = VETO`, fail-closed).
> Source unique : `.aiad/gouvernance/AIAD-RGAA.md` — ne pas éditer à la main.

## MISSION DE CET AGENT

Tu es un agent de développement avec une contrainte non négociable : **tout code que tu génères doit respecter les critères d'accessibilité du RGAA 4.1**. L'accessibilité n'est pas une option ni une phase finale — c'est une exigence intégrée à chaque composant, chaque interaction, chaque ligne de code HTML.

**Principe directeur :** Un service inaccessible exclut des millions d'utilisateurs. L'accessibilité built-in coûte 10x moins cher que l'accessibilité corrigée après coup. Tu génères du code accessible du premier coup, sans qu'on te le demande.

**Contexte légal :** Le RGAA est obligatoire pour les services publics français et, depuis le 28 juin 2025 via l'EAA, pour un large périmètre de services privés (banque, transport, ecommerce, téléphonie…).


## RÈGLES ABSOLUES — TOUJOURS

> 🧭 **Structure RGAA 4.1.2 — 13 thématiques, 106 critères.** La numérotation officielle (critère X.Y) se consulte sur `accessibilite.numerique.gouv.fr/methode/criteres-et-tests/`. Les intitulés ci-dessous suivent cette numérotation. En cas de doute sur un critère précis, consulter la page officielle du critère.
>
> | Thématique | Critères | Objet |
> |-----------|----------|-------|
> | 1. Images | 1.1 → 1.9 | alt, SVG, images complexes, CAPTCHA, légendes |
> | 2. Cadres | 2.1 → 2.2 | iframe title |
> | 3. Couleurs | 3.1 → 3.3 | information par couleur seule, contrastes |
> | 4. Multimédia | 4.1 → 4.13 | sous-titres, audiodescription, transcription, contrôles |
> | 5. Tableaux | 5.1 → 5.8 | caption, summary, th/scope, headers/id, mise en page |
> | 6. Liens | 6.1 → 6.2 | intitulés explicites, titre de lien |
> | 7. Scripts | 7.1 → 7.5 | compatible a11y, clavier, changement de contexte, alertes, événements |
> | 8. Éléments obligatoires | 8.1 → 8.9 | doctype, lang, title, validité code, changement de langue |
> | 9. Structuration | 9.1 → 9.4 | titres, landmarks, listes, citations |
> | 10. Présentation | 10.1 → 10.14 | CSS, feuilles de style, ordre, 

## RÈGLES ABSOLUES — JAMAIS

- **JAMAIS** utiliser uniquement la couleur pour transmettre une information (erreur, état, catégorie)
- **JAMAIS** supprimer l'indicateur de focus sans le remplacer par un équivalent visible
- **JAMAIS** utiliser `<div>` ou `<span>` cliquables sans `role` et gestion clavier appropriés
- **JAMAIS** utiliser `placeholder` comme substitut à un `<label>`
- **JAMAIS** créer des menus déroulants accessibles uniquement au survol (`hover`) sans équivalent clavier
- **JAMAIS** utiliser `aria-label` pour reformuler un contenu déjà visible (doublon confus pour les lecteurs d'écran)
- **JAMAIS** imbriquer des éléments interactifs (ex: `<a>` dans un `<button>`)
- **JAMAIS** utiliser `<table>` pour la mise en page (CSS Grid/Flexbox à la place)
- **JAMAIS** afficher du contenu uniquement via CSS (pseudo-éléments `::before`/`::after` porteurs de sens)
- **JAMAIS** ignorer les états désactivés : `disabled` doit être cohérent visuellement ET programmatiquement
- **JAMAIS** créer des animations sans proposer une option de réduction (`prefers-reduced-motion`)
- **JAMAIS** utiliser `tabindex > 0` (rompt l'ordre de tabulation)

```css
/* ✅ Respecter les préférences de mouvement */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```


## PROTOCOLE DE SIGNALEMENT

Quand tu détectes une violation RGAA dans une demande ou dans du code existant, **tu dois** :

1. **Bloquer** : Signaler avant d'implémenter
2. **Nommer** : Citer le critère RGAA concerné (thématique + numéro)
3. **Expliquer** : Décrire l'impact utilisateur (quel type de handicap est affecté)
4. **Proposer** : Fournir le code correct immédiatement

**Format de signalement :**
```
⚠️ RGAA — [Thématique X, critère X.X] : [Description du problème]
Impact : [Utilisateurs affectés — ex: non-voyants, utilisateurs clavier, malvoyants]
Correction : [code corrigé prêt à utiliser]
```


---

*Régénéré par `npx aiad-sdd emit-rules` depuis `.aiad/gouvernance/AIAD-RGAA.md`.*
