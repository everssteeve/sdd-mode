# Memory — store projet (§3.8)

> Mémoire **from logs** : on ne promeut un apprentissage que s'il **récurre**
> sur plusieurs sources (facts, drifts), jamais sur un cas isolé. La promotion
> exige un **auteur humain** (Human Authorship). Le store s'auto-cure : au-delà
> de 200 lignes, `MEMORY.md` est éclaté par thème dans `memory/<theme>.md`.

## Cycle

```bash
npx aiad-sdd memory propose                    # patterns récurrents (≥ seuil)
npx aiad-sdd memory promote --auteur "Nom"     # promotion (1er candidat)
npx aiad-sdd memory promote --auteur "Nom" --apply   # tous les candidats
npx aiad-sdd memory curate                     # éclatement si > 200 lignes
```

## Anti dock rot

```bash
npx aiad-sdd archive --delivered           # artefacts livrés/clos (liste)
npx aiad-sdd archive --delivered --apply   # archive les ✓ (les ⚠ restent chauds)
```

`MEMORY.md` est créé à la première promotion. `AGENT-GUIDE.md` reste la source
du **contexte permanent stable** ; la mémoire native est **additive**.
