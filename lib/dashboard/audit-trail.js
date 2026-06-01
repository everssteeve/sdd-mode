// AIAD SDD Mode — Dashboard : visibilité de l'audit trail (#201, AE).
//
// Audit DASHBOARD-AUDIT.md ligne 97 : "Pas d'Audit Trail — `aiad-sdd audit
// log` existe (signature crypto append-only), pas exposé dans le dashboard."
//
// Source : `.aiad/audit/audit.jsonl` (1 événement JSON par ligne, écrit par
// `aiad-sdd audit append`). Format : `{ts, actor, action, artifact, hashAvant,
// hashApres, hashChain, sig}`. Cf. `lib/audit.js`.
//
// Stratégie de sécurité : on N'EXPOSE PAS les signatures HMAC (`sig`) ni
// les hashChain complets dans le HTML — uniquement les 12 premiers caractères
// pour debug. Le secret HMAC reste côté CI uniquement.
//
// Vérification de chaîne : appelée SANS secret (vérifie seulement
// l'intégrité sha256 chainée, pas les signatures). Si la chaîne est cassée,
// on l'affiche en rouge — signal d'altération.

import { lireLog, verifierChaine } from '../audit.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const JOUR = 86_400_000;

export function calculerAuditTrail(racineProjet, options = {}) {
  const fichier = join(racineProjet, '.aiad', 'audit', 'audit.jsonl');
  if (!existsSync(fichier)) {
    return {
      fichier: null,
      total: 0,
      parAction: {},
      recents7j: 0,
      recents30j: 0,
      derniers: [],
      chaine: { valide: null, raisons: [] },
    };
  }
  const events = lireLog(racineProjet);
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const parAction = {};
  let recents7j = 0;
  let recents30j = 0;
  for (const e of events) {
    parAction[e.action] = (parAction[e.action] || 0) + 1;
    const t = Date.parse(e.ts || '');
    if (Number.isFinite(t)) {
      const ageJ = (now - t) / JOUR;
      if (ageJ <= 7) recents7j += 1;
      if (ageJ <= 30) recents30j += 1;
    }
  }
  // Vérification chaîne (sans secret — vérifie hashChain uniquement).
  const chaineCheck = events.length > 0 ? verifierChaine(events, null) : { valid: true, raisons: [] };
  // 10 derniers événements, ordre décroissant.
  const derniers = events.slice(-10).reverse().map((e) => ({
    ts: e.ts,
    actor: e.actor,
    action: e.action,
    artifact: e.artifact,
    // Affichage tronqué pour ne pas exposer le hash complet (paranoïa).
    hashChain: e.hashChain ? String(e.hashChain).slice(0, 16) + '…' : null,
    signe: Boolean(e.sig),
  }));
  return {
    fichier: '.aiad/audit/audit.jsonl',
    total: events.length,
    parAction,
    recents7j,
    recents30j,
    derniers,
    chaine: {
      valide: chaineCheck.valid,
      raisons: chaineCheck.raisons.slice(0, 5),
    },
  };
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeAction(action) {
  const couleurs = {
    created: 'badge-ok',
    modified: 'badge-info',
    deleted: 'badge-bad',
    imported: 'badge-info',
    archived: '',
  };
  const c = couleurs[action] || '';
  return `<span class="badge ${c}" style="font-size:.7rem">${escape(action)}</span>`;
}

export function blocAuditTrail(donnees) {
  const audit = donnees?.auditTrail;
  if (!audit) return '';
  // Section omise si pas de log et aucun events — pas de pollution pour
  // les projets qui n'ont pas activé l'audit.
  if (!audit.fichier && audit.total === 0) return '';
  const chaineBadge = audit.chaine.valide === false
    ? `<span class="badge badge-bad" style="font-size:.75rem">⚠ chaîne cassée (${audit.chaine.raisons.length} cassure(s))</span>`
    : audit.chaine.valide === true && audit.total > 0
    ? '<span class="badge badge-ok" style="font-size:.75rem">✓ chaîne intègre</span>'
    : '<span class="badge" style="font-size:.75rem">—</span>';
  const parActionRows = Object.entries(audit.parAction)
    .sort((a, b) => b[1] - a[1])
    .map(([action, n]) => `<li>${badgeAction(action)} <strong>${n}</strong></li>`)
    .join('');
  // (#353) Artifact hyperlié via lienSource (typically path .aiad/specs/...).
  // Heuristique : ressemble à un path (contient `/` ou extension `.X`) → lien,
  // sinon texte simple (cas artifact = ID arbitraire).
  const estPath = (s) => typeof s === 'string' && (s.includes('/') || /\.[a-z0-9]{1,5}$/i.test(s));
  const derniersRows = audit.derniers.map((e) => `
    <tr>
      <td class="muted" style="white-space:nowrap;font-size:.85rem">${escape(String(e.ts || '').slice(0, 19).replace('T', ' '))}</td>
      <td>${badgeAction(e.action)}</td>
      <td>${e.artifact ? (estPath(e.artifact) ? lienSource(e.artifact) : escape(e.artifact)) : ''}</td>
      <td class="muted" style="font-size:.8rem">${escape(e.actor || '—')}</td>
      <td class="muted" style="font-size:.75rem">${e.signe ? '<span title="Signature HMAC présente">🔒</span>' : '<span title="Non signé" class="muted">·</span>'} <code>${escape(e.hashChain || '—')}</code></td>
    </tr>`).join('');

  // Raisons de cassure de chaîne — affichées seulement si invalides.
  const raisonsBloc = audit.chaine.valide === false ? `
    <div class="alerte alerte-bad" style="margin-top:.5rem">
      <div class="alerte-titre">Chaîne d'intégrité cassée</div>
      <div class="alerte-detail">
        <ul style="margin:.3rem 0 0;padding-left:1.2rem;font-size:.85rem">
          ${audit.chaine.raisons.map((r) => `<li>${escape(r)}</li>`).join('')}
        </ul>
      </div>
      <div class="alerte-action" style="margin-top:.3rem;font-size:.85rem">
        → Lance <code>aiad-sdd audit verify</code> pour le diagnostic complet (avec secret HMAC).
      </div>
    </div>` : '';

  return `<section>
    <h2>Audit Trail <span class="count">${audit.total}</span></h2>
    <div class="kpis">
      <div class="kpi"><div class="label">Événements total</div><div class="value">${audit.total}</div><div class="delta">${chaineBadge}</div></div>
      <div class="kpi"><div class="label">7 derniers jours</div><div class="value">${audit.recents7j}</div><div class="delta">événements récents</div></div>
      <div class="kpi"><div class="label">30 derniers jours</div><div class="value">${audit.recents30j}</div><div class="delta">tendance courte</div></div>
    </div>
    ${raisonsBloc}
    ${parActionRows ? `<p class="muted" style="font-size:.85rem">Par action : <ul style="display:inline-flex;gap:.6rem;padding:0;margin:0;list-style:none">${parActionRows}</ul></p>` : ''}
    ${audit.derniers.length > 0 ? `
      <details open>
        <summary><strong>10 derniers événements</strong></summary>
        <table>
          <thead><tr><th>Timestamp</th><th>Action</th><th>Artifact</th><th>Acteur</th><th>Intégrité</th></tr></thead>
          <tbody>${derniersRows}</tbody>
        </table>
      </details>` : ''}
    ${audit.fichier ? `<p class="muted" style="font-size:.85rem">Source : ${lienSource(audit.fichier)} · vérification crypto : <code>aiad-sdd audit verify</code>.</p>` : ''}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerAuditTrail as computeAuditTrail,
  blocAuditTrail as auditTrailSection,
};
