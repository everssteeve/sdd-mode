// AIAD SDD Mode — Auto-détection de `--source-base` depuis `git remote.origin.url`.
//
// (#315) Évite à l'utilisateur de hardcoder
// `--source-base https://github.com/org/repo/blob/main` quand le projet est
// déjà un dépôt git connu. Utilise `git config --get remote.origin.url` et
// dérive l'URL de blob/src selon le host (github.com, gitlab.com,
// bitbucket.org). Utilise `HEAD` comme branche (interprété comme branche par
// défaut par les 3 hébergeurs — pas besoin de détecter `main` vs `master`).
//
// Hosts non-reconnus → null (l'appelant fait fallback sur `_sourceBase = ''`).
// Préfère échouer silencieusement : c'est un confort, pas une feature critique.

import { spawnSync } from 'node:child_process';

// (#323) Le segment de chemin entre l'hôte et la révision diffère selon
// l'hébergeur. Format final : `https://${host}/${path}${infix}${ref}` où
// `ref` vaut `HEAD` par défaut ou une branche spécifiée par l'utilisateur
// via `--source-base auto:main`.
const HOSTS = [
  { host: 'github.com', infix: '/blob/' },
  { host: 'gitlab.com', infix: '/-/blob/' },
  { host: 'bitbucket.org', infix: '/src/' },
];

export function parserGitUrl(url, branche) {
  if (!url || typeof url !== 'string') return null;
  const ref = branche && typeof branche === 'string' && branche.trim() ? branche.trim() : 'HEAD';
  const trim = url.trim();
  // SSH form : git@host:org/repo.git OR git@host:org/repo
  const ssh = trim.match(/^[\w-]+@([^:]+):(.+?)\/?(\.git)?$/);
  // HTTPS form : https://host/org/repo.git OR https://user@host/org/repo
  const https = trim.match(/^https?:\/\/(?:[^@/]+@)?([^/]+)\/(.+?)\/?(\.git)?$/);
  let host;
  let path;
  if (ssh) {
    host = ssh[1];
    path = ssh[2];
  } else if (https) {
    host = https[1];
    path = https[2];
  } else {
    return null;
  }
  path = path.replace(/\.git$/, '').replace(/\/+$/, '');
  const cfg = HOSTS.find((h) => h.host === host);
  if (!cfg) return null;
  return `https://${host}/${path}${cfg.infix}${ref}`;
}

export function detecterSourceBase(racine, branche) {
  const r = spawnSync('git', ['config', '--get', 'remote.origin.url'], {
    cwd: racine,
    encoding: 'utf-8',
  });
  if (r.status !== 0) return null;
  return parserGitUrl((r.stdout || '').trim(), branche);
}

// Alias EN canoniques (#42)
export { parserGitUrl as parseGitUrl, detecterSourceBase as detectSourceBase };
