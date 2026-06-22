// @spec SPEC-016-1-architecture-4-couches
// @intent INTENT-016

import { escape } from './helpers.js';

export function badge(valeur, classes = '') {
  return `<span class="badge ${classes}">${escape(valeur)}</span>`;
}

export function statutBadge(statut) {
  if (!statut) return badge('—', 'badge-muted');
  const s = String(statut).toLowerCase();
  const map = {
    draft: 'badge-warn',
    review: 'badge-info',
    ready: 'badge-info',
    'in-progress': 'badge-info',
    validation: 'badge-info',
    done: 'badge-ok',
    active: 'badge-ok',
    archived: 'badge-muted',
    template: 'badge-warn',
    unknown: 'badge-muted',
  };
  return `<span class="badge ${map[s] || 'badge-muted'}">${escape(s)}</span>`;
}

export function sqsBadge(valeur) {
  if (valeur == null || valeur === '' || isNaN(Number(valeur))) {
    return badge('—', 'badge-muted');
  }
  const v = Number(valeur);
  let cls = 'badge-bad';
  if (v >= 4) cls = 'badge-ok';
  else if (v >= 3) cls = 'badge-warn';
  return `<span class="badge ${cls}">SQS ${v.toFixed(1)}/5</span>`;
}

// Badge "fraîcheur des données" (#145). Échelle : `< 1h` ok / `< TTL/4 h` ok /
// `< TTL h` warn / `≥ TTL h` bad. TTL configurable via env
// `AIAD_DASHBOARD_TTL_HOURS` (défaut 24, #178). Rituel hebdo → TTL=168.
export function freshnessBadge(isoTimestamp, opts = {}) {
  const t = isoTimestamp ? Date.parse(isoTimestamp) : NaN;
  if (isNaN(t)) return '';
  const envTtl = Number(process.env.AIAD_DASHBOARD_TTL_HOURS);
  const ttlH = opts.ttlHours ?? (Number.isFinite(envTtl) && envTtl > 0 ? envTtl : 24);
  const warnH = Math.max(1, Math.round(ttlH / 4));
  const ageMin = Math.round((Date.now() - t) / 60000);
  const ageHrs = Math.round((Date.now() - t) / 3600000);
  const ageDays = Math.round((Date.now() - t) / 86400000);
  let cls, label;
  if (ageMin < 60) { cls = 'ok'; label = ageMin < 1 ? 'à l\'instant' : `il y a ${ageMin} min`; }
  else if (ageHrs < warnH) { cls = 'ok'; label = `il y a ${ageHrs} h`; }
  else if (ageHrs < ttlH) { cls = 'warn'; label = `il y a ${ageHrs} h — à régénérer`; }
  else { cls = 'bad'; label = ageHrs < 48 ? `il y a ${ageHrs} h — données obsolètes` : `il y a ${ageDays} j — données obsolètes`; }
  const titre = `Données générées : ${new Date(t).toLocaleString('fr-FR')}. TTL ${ttlH}h. Cliquer pour copier la commande de rafraîchissement.`;
  // (#177) Badge cliquable : copie la commande au clipboard, feedback via JS
  // (cf. lib/dashboard/assets.js handler global). Reste un <span> pour
  // rétrocompat (les anciens dashboards sans JS resteront lisibles).
  return `<span class="badge badge-${cls} freshness" role="button" tabindex="0" data-copy="npx aiad-sdd dashboard" title="${escape(titre)}">${escape(label)}</span>`;
}
