# SPEC-027-3 — Steps CI post-deploy (`site-deploy.yml` + `release.yml`)

**Intent parent** : INTENT-027
**Auteur** : Steeve Evers
**Date** : 2026-06-29
**Statut** : done
**Format** : EARS
**SQS** : 5/5 — Gate OUVERTE

---

## 1. Contexte

INTENT-027 requiert qu'après chaque déploiement en production, un fichier `.aiad/metrics/deployments/` soit créé automatiquement avec `cycle_time_days` renseigné. SPEC-027-1 et SPEC-027-2 ont posé les fondations (stamp `validated_at` + calcul `--auto`). Cette SPEC ajoute les steps post-deploy dans les deux workflows GitHub Actions qui produisent des déploiements : `site-deploy.yml` (gh-pages) et `release.yml` (npm). Elle ajoute aussi un step `git commit + push` pour persister le fichier de métriques dans le dépôt.

## 2. Comportement Attendu

### Input

- Événement GitHub Actions : push sur `main` avec `site/**` (site-deploy) ou push d'un tag `v*` (release)
- Contexte CI : `github.sha`, `github.ref_name`, date courante (variables GitHub Actions)
- Fichiers SPEC avec `validated_at` présent (posés par SPEC-027-1 via `/sdd validate`)

### Processing

**Dans `site-deploy.yml`** — après le step `peaceiris/actions-gh-pages` :

1. Step `Record DORA metrics` (`if: success()`) :
   - `npx aiad-sdd dora --record --auto --status=success --release=site-${{ github.sha }} --commit=${{ github.sha }}`
2. Step `Commit metrics to repository` (`if: success()`) :
   - `git config user.name "github-actions[bot]"` + `git config user.email "..."`
   - `git add .aiad/metrics/deployments/`
   - `git diff --cached --quiet || git commit -m "chore(metrics): record site deploy $(date -u +%Y-%m-%d)"`
   - `git push`

**Dans `release.yml`** — après le step `npm publish` :

1. Step `Record DORA metrics` (`if: success()`) :
   - `npx aiad-sdd dora --record --auto --status=success --release=${{ github.ref_name }} --commit=${{ github.sha }}`
2. Step `Commit metrics to repository` (`if: success()`) :
   - Même pattern git commit/push que ci-dessus

### Output

- Fichier `.aiad/metrics/deployments/YYYY-MM-DD-deploy-NN.md` créé avec `cycle_time_days` dans le dépôt
- Commit `chore(metrics): record site deploy YYYY-MM-DD` ou `chore(metrics): record release vX.Y.Z` poussé sur `main`
- Log GitHub Actions visible dans la run summary

### Cas limites

- **`--auto` sans `validated_at` disponible** : step `Record DORA metrics` exit 1, step `Commit` skippé (`if: success()`), déploiement lui-même non bloqué (step indépendant, `continue-on-error: true`)
- **Conflit de push** (autre commit entre le deploy et le push metrics) : `git pull --rebase` avant `git push`, retry une fois
- **Permissions GitHub Token insuffisantes** : erreur explicite dans les logs, step en échec mais déploiement non bloqué (`continue-on-error: true`)
- **Déploiement en failure** : steps metrics skippés (`if: success()`)
- **`npx aiad-sdd` indisponible en CI** : step exit 1, `continue-on-error: true` — ne bloque pas le pipeline principal

## 3. Critères d'Acceptation (EARS)

### CA-001 — Record après site deploy réussi

> Pattern : Event-driven

`WHEN a push to \`main\` touching \`site/**\` triggers \`site-deploy.yml\` and the \`actions-gh-pages\` step succeeds, the workflow SHALL execute \`aiad-sdd dora --record --auto --status=success --release=site-\${{ github.sha }} --commit=\${{ github.sha }}\`.`

- [x] Implémenté
- [ ] Testé : vérification manuelle post-merge (workflow CI uniquement)

### CA-002 — Record après release npm réussie

> Pattern : Event-driven

`WHEN a tag push matching \`v*\` triggers \`release.yml\` and the \`npm publish\` step succeeds, the workflow SHALL execute \`aiad-sdd dora --record --auto --status=success --release=\${{ github.ref_name }} --commit=\${{ github.sha }}\`.`

- [x] Implémenté
- [ ] Testé : vérification manuelle post-tag (workflow CI uniquement)

### CA-003a — Commit du fichier de métriques

> Pattern : Event-driven

`WHEN the \`Record DORA metrics\` step exits 0, the workflow SHALL commit the new deployment file with message \`chore(metrics): record <deploy-type> <date-or-version>\`.`

- [x] Implémenté
- [ ] Testé : vérification manuelle (présence du commit dans git log après CI)

### CA-003b — Push du commit de métriques

> Pattern : Event-driven

`WHEN a metrics commit has been staged after a successful \`Record DORA metrics\` step, the workflow SHALL push it to \`main\`.`

- [x] Implémenté
- [ ] Testé : vérification manuelle (commit visible sur la branche main après CI)

### CA-004 — Isolation du déploiement principal

> Pattern : Ubiquitous

`The \`Record DORA metrics\` and \`Commit metrics\` steps SHALL have \`continue-on-error: true\` so that a failure in metrics recording does not block or revert the production deployment.`

- [x] Implémenté
- [x] Testé : inspection YAML (`grep continue-on-error .github/workflows/site-deploy.yml`) → 2/2 dans chaque fichier

### CA-005 — Skip si déploiement en échec

> Pattern : State-driven

`WHILE the preceding deploy step has not succeeded (\`if: success()\` condition not met), the workflow SHALL skip both \`Record DORA metrics\` and \`Commit metrics\` steps.`

- [x] Implémenté
- [x] Testé : inspection YAML (`grep "if: success()"`) → 2/2 dans chaque fichier

### CA-006a — Pull --rebase sur conflit push

> Pattern : Unwanted behaviour

`IF the \`git push\` in the metrics commit step fails due to a non-fast-forward conflict, THEN the step SHALL execute \`git pull --rebase origin main\`.`

- [x] Implémenté
- [x] Testé : inspection du script shell dans le YAML → pattern `|| (git pull --rebase origin main && git push origin main)` présent

### CA-006b — Retry push après rebase réussi

> Pattern : Unwanted behaviour

`IF \`git pull --rebase origin main\` succeeds after a push conflict, THEN the step SHALL retry \`git push origin main\` once.`

- [x] Implémenté
- [x] Testé : inspection du script shell dans le YAML → retry implicite dans le `&&`

## 4. Interface / API

```yaml
# Extrait site-deploy.yml (après l'étape peaceiris/actions-gh-pages)
      - name: Record DORA metrics
        if: success()
        continue-on-error: true
        run: |
          npx aiad-sdd dora --record --auto \
            --status=success \
            --release=site-${{ github.sha }} \
            --commit=${{ github.sha }}

      - name: Commit metrics to repository
        if: success()
        continue-on-error: true
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .aiad/metrics/deployments/
          if ! git diff --cached --quiet; then
            git commit -m "chore(metrics): record site deploy $(date -u +%Y-%m-%d)"
            git push origin main || (git pull --rebase origin main && git push origin main)
          fi

# Extrait release.yml (après l'étape npm publish)
      - name: Record DORA metrics
        if: success()
        continue-on-error: true
        run: |
          npx aiad-sdd dora --record --auto \
            --status=success \
            --release=${{ github.ref_name }} \
            --commit=${{ github.sha }}

      - name: Commit metrics to repository
        if: success()
        continue-on-error: true
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .aiad/metrics/deployments/
          if ! git diff --cached --quiet; then
            git commit -m "chore(metrics): record release ${{ github.ref_name }}"
            git push origin main || (git pull --rebase origin main && git push origin main)
          fi
```

## 5. Dépendances

- **SPEC-027-2** — `aiad-sdd dora --record --auto` doit être opérationnel
- `.github/workflows/site-deploy.yml:71` — step d'insertion après `peaceiris/actions-gh-pages`
- `.github/workflows/release.yml:47` — step d'insertion après `npm publish`
- Permissions GitHub Actions : `contents: write` requis pour le push metrics (à vérifier dans les settings du dépôt)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE (condensé) : ~300 tokens
- SPEC-027-2 (interface --auto) : ~200 tokens
- Cette SPEC : ~600 tokens
- `.github/workflows/site-deploy.yml` (79 lignes) : ~200 tokens
- `.github/workflows/release.yml` (71 lignes) : ~200 tokens
- **Total estimé** : ~1 500 tokens

## 7. Definition of Output Done (DoOD)

- [x] `site-deploy.yml` modifié — steps `Record DORA metrics` + `Commit metrics` ajoutés
- [x] `release.yml` modifié — mêmes steps ajoutés
- [-] **EARS lint : 0 violation** (skill `ears-validator`) — CAs dans le YAML non lintables, EARS appliqué à la rédaction SPEC uniquement
- [x] `continue-on-error: true` présent sur les deux steps dans les deux fichiers (4/4)
- [x] `if: success()` présent sur les deux steps dans les deux fichiers (4/4)
- [x] SPEC mise à jour : statut → done
- [x] Annotations posées : `@intent INTENT-027`, `@spec SPEC-027-3-ci-workflow-steps` dans le commentaire du step YAML
- [ ] Vérification manuelle : après un push de test, le fichier `.aiad/metrics/deployments/` est créé et commité
- [x] Gouvernance : RGESN — steps conditionnels (`if: success()`), `continue-on-error` évite les retries superflus, zero dépendance runtime ajoutée
