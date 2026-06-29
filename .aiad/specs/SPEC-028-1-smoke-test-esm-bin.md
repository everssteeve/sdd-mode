# SPEC-028-1 — Smoke test ESM bin/

**Intent parent** : INTENT-028
**Research** : RESEARCH-038 (GO 90 %)
**Auteur** : Steeve Evers
**Date** : 2026-06-29
**Statut** : done
**validated_at** : 2026-06-29
**Format** : prose
**SQS** : 5/5

---

## 1. Contexte

INTENT-028 (LL-2026-06-24-a) : un import nommé manquant dans `bin/` a provoqué une `ReferenceError` runtime non détectée avant CI. Les workflows actuels (`ci.yml`, `bun-smoke.yml`) exécutent le bin via shell sur des commandes spécifiques — ce qui ne garantit pas l'atteinte du code fautif si la `ReferenceError` est dans une branche peu exercée. Le package est `"type": "module"` (ESM) ; la formule `require()` citée dans l'Intent est incompatible — la SPEC utilise `import()` dynamique.

## 2. Comportement Attendu

### Input

Tout diff touchant `bin/aiad-sdd.js` ou un module `lib/` importé en tête du fichier.

### Processing

1. Le script `npm run smoke` lance `node -e "import('./bin/aiad-sdd.js').catch(e=>{console.error(e.message);process.exit(1)})"`.
2. Node résout toute la chaîne d'imports ESM de `bin/aiad-sdd.js` (imports statiques en tête de fichier).
3. Si un nom importé est manquant dans le module source → `SyntaxError` ou `ReferenceError` → le process quitte avec code 1.
4. Si tous les imports se résolvent → process quitte avec code 0 (le code applicatif n'est PAS exécuté — seul l'arbre d'import est évalué).
5. Dans `ci.yml`, le step `Smoke test import ESM bin/` appelle `npm run smoke` dans le job `test`, **avant** le step `Tests`.

### Output

- Exit 0 : tous les imports résolus, step CI vert.
- Exit 1 : import cassé détecté, message d'erreur affiché, step CI rouge.

### Cas limites

- Import circulaire : Node lève un avertissement mais n'exit pas en erreur — comportement acceptable (hors périmètre).
- Module `lib/` chargé en lazy (hors import statique) : non détecté par ce smoke test — hors périmètre.
- Exécution sur Bun : non requis dans cette SPEC (`bun-smoke.yml` couvre déjà les appels shell Bun).

## 3. Critères d'Acceptation

- [ ] **CA-1** : `package.json` contient un script `"smoke"` dont la valeur est `node -e "import('./bin/aiad-sdd.js').catch(e=>{console.error(e.message);process.exit(1)})"`.
- [ ] **CA-2** : `npm run smoke` retourne exit 0 sur le HEAD courant (`main`), en < 2 s (mesuré localement avec `time npm run smoke`).
- [ ] **CA-3** : `ci.yml` contient un step nommé `Smoke test import ESM bin/` qui exécute `npm run smoke`, positionné **avant** le step `Tests` dans le job `test`.
- [ ] **CA-4** : Si l'on supprime manuellement un import nommé réel dans `bin/aiad-sdd.js`, `npm run smoke` retourne exit 1 (test de régression simulé, réversible).
- [ ] **CA-5** : La Lesson Learned 2026-06-24 dans `AGENT-GUIDE.md` est mise à jour pour remplacer `node -e "require('./bin/aiad-sdd')"` par `npm run smoke` (formule ESM correcte).

## 4. Interface / API

Nouveaux scripts `package.json` :

```json
"smoke": "node -e \"import('./bin/aiad-sdd.js').catch(e=>{console.error(e.message);process.exit(1)})\""
```

Nouveau step `ci.yml` (job `test`, avant `Tests`) :

```yaml
- name: Smoke test import ESM bin/
  run: npm run smoke
```

## 5. Dépendances

- `bin/aiad-sdd.js` — point d'entrée CLI (ESM, `"type": "module"`)
- `package.json` — ajout du script `smoke`
- `.github/workflows/ci.yml` — ajout du step dans le job `test`
- `AGENT-GUIDE.md` — correction LL-2026-06-24 (CA-5)

## 6. Estimation Context Engineering Budget

- AGENT-GUIDE condensé : ~300 tokens
- Cette SPEC : ~400 tokens
- Fichiers source pertinents : `package.json`, `.github/workflows/ci.yml`, `bin/aiad-sdd.js` (lecture seule), `.aiad/AGENT-GUIDE.md` (LL uniquement)
- **Total estimé** : ~1 000 tokens (tâche mineure)

## 7. Definition of Output Done (DoOD)

- [ ] Script `smoke` ajouté dans `package.json`
- [ ] Step CI ajouté dans `ci.yml` (avant `Tests`)
- [ ] `npm run smoke` passe en < 2 s localement
- [ ] CA-4 vérifié manuellement (injection d'un import cassé + rollback)
- [ ] LL-2026-06-24 dans AGENT-GUIDE mise à jour (CA-5)
- [ ] Lint passing (`npm run lint`)
- [ ] SPEC statut → `done` à la même PR
