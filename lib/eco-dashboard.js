/**
 * @intent INTENT-030
 * @spec SPEC-030-4-dashboard-eco
 * @governance AIAD-RGAA,AIAD-RGESN
 *
 * Dashboard page et widget CO₂ pour l'impact écologique des sessions LLM.
 * Lit .aiad/metrics/hook-runs.jsonl (alimenté par SPEC-030-2).
 * Toutes les valeurs sont indicatives, non certifiées.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { escape } from './dashboard/ui/helpers.js';

const CO2_LABEL = 'estimation indicative (non certifiée)';

function _vide() {
  return {
    sessionCount: 0,
    sessionEstimees: 0,
    sessionsAvecCo2: 0,
    co2Total30: null,
    co2Moyenne: null,
    tokensTotal30: 0,
    tendance: null,
    sessions: [],
  };
}

/**
 * @spec SPEC-030-4-dashboard-eco
 *
 * Lit hook-runs.jsonl et calcule les métriques CO₂ sur les N dernières sessions.
 *
 * @param {string} racine - racine du projet
 * @param {{ limit?: number }} options
 * @returns {EcoDashboardData}
 */
export function collecterEcoMetrics(racine, options = {}) {
  const limit = options.limit ?? 30;
  const jsonlPath = join(racine, '.aiad', 'metrics', 'hook-runs.jsonl');

  if (!existsSync(jsonlPath)) return _vide();

  let lignes;
  try {
    lignes = readFileSync(jsonlPath, 'utf-8').split('\n').filter(Boolean);
  } catch {
    return _vide();
  }

  const sessions = [];
  for (const ligne of lignes) {
    try {
      const entry = JSON.parse(ligne);
      if (entry && entry.ecoMetrics) sessions.push(entry);
    } catch {
      // ligne malformée — ignorée silencieusement
    }
  }

  if (sessions.length === 0) return _vide();

  const fenetre = sessions.slice(-limit);
  const sessionCount = fenetre.length;
  let co2Total30 = 0;
  let tokensTotal30 = 0;
  let sessionEstimees = 0;
  let sessionsAvecCo2 = 0;

  for (const s of fenetre) {
    const eco = s.ecoMetrics;
    if (eco.co2g != null) {
      co2Total30 += eco.co2g;
      sessionsAvecCo2++;
    }
    if (eco.totalTokens != null) tokensTotal30 += eco.totalTokens;
    if (eco.method === 'estimated') sessionEstimees++;
  }

  const co2Moyenne = sessionsAvecCo2 > 0 ? co2Total30 / sessionsAvecCo2 : null;

  let tendance = null;
  if (fenetre.length >= 15) {
    const moitie = Math.floor(fenetre.length / 2);
    const s1 = fenetre.slice(0, moitie).reduce((s, e) => s + (e.ecoMetrics?.co2g ?? 0), 0);
    const s2 = fenetre.slice(moitie).reduce((s, e) => s + (e.ecoMetrics?.co2g ?? 0), 0);
    if (s1 > 0) tendance = Math.round(((s2 - s1) / s1) * 100);
  }

  return {
    sessionCount,
    sessionEstimees,
    sessionsAvecCo2,
    co2Total30: sessionsAvecCo2 > 0 ? co2Total30 : null,
    co2Moyenne,
    tokensTotal30,
    tendance,
    sessions: fenetre.map((s) => ({
      date: s.startedAt || s.ts || null,
      model: s.ecoMetrics?.model || null,
      tokens: s.ecoMetrics?.totalTokens ?? null,
      co2g: s.ecoMetrics?.co2g ?? null,
      method: s.ecoMetrics?.method || 'unknown',
    })),
  };
}

function _fmtCo2(n, decimals = 2) {
  return n == null ? 'N/D' : Number(n).toFixed(decimals);
}

function _fmtTendance(t) {
  if (t == null) return 'Données insuffisantes pour calculer la tendance';
  const sign = t > 0 ? '▲ +' : t < 0 ? '▼ ' : '→ ';
  return `${sign}${t} % vs 15 prev`;
}

/**
 * @spec SPEC-030-4-dashboard-eco
 *
 * Widget EcoLogits pour metrics.html — carte compacte CO₂.
 *
 * @param {EcoDashboardData} eco
 * @returns {string} HTML
 */
export function blocWidgetEco(eco) {
  if (!eco || eco.sessionCount === 0) {
    return `<div class="empty"><strong>Aucune donnée — hook Stop non configuré.</strong></div>`;
  }

  const co2Str = eco.sessionsAvecCo2 === 0 ? 'N/D' : `${_fmtCo2(eco.co2Total30)} g CO₂eq`;
  const fmtTokens = eco.tokensTotal30 ? `${Math.round(eco.tokensTotal30 / 1000)} k` : '—';

  return `<div class="kpi-eco">
  <div class="kpi-eco-header">🌱 Impact écologique (30 dernières)</div>
  <table class="kpi-eco-table" aria-label="Résumé impact écologique">
    <tbody>
      <tr><th scope="row">CO₂ total</th><td>${escape(co2Str)}</td></tr>
      <tr><th scope="row">Tendance</th><td>${_fmtTendance(eco.tendance)}</td></tr>
      <tr><th scope="row">Tokens</th><td>${escape(fmtTokens)}</td></tr>
    </tbody>
  </table>
  <p class="kpi-eco-note">${escape(CO2_LABEL)}</p>
</div>`;
}

/**
 * @spec SPEC-030-4-dashboard-eco
 *
 * Page complète dashboard/eco.html — tableau des 30 dernières sessions.
 *
 * @param {object} donnees - données enrichies du dashboard
 * @returns {string} HTML body
 */
export function pageEco(donnees) {
  const eco = donnees.ecoMetrics;

  if (!eco || eco.sessionCount === 0) {
    return `<section>
  <h2>Impact écologique</h2>
  <div class="empty">
    <strong>Aucune donnée — hook Stop non configuré.</strong>
    <p>Configure le hook Stop (SPEC-030-2) pour capturer les métriques CO₂ à chaque session.</p>
    <div class="actions" style="justify-content:center;margin-top:1rem;">
      <a href="metrics.html">← Métriques</a>
    </div>
  </div>
</section>`;
  }

  const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return String(d); }
  };
  const fmtTokens = (n) => (n == null ? '—' : Number(n).toLocaleString('fr-FR'));
  const fmtTendanceLong = (t) => {
    if (t == null) return 'Données insuffisantes pour calculer la tendance';
    const sign = t > 0 ? '▲ +' : t < 0 ? '▼ ' : '→ ';
    return `${sign}${t} % sessions 16–30 vs 1–15`;
  };

  const avertissement = eco.sessionEstimees < eco.sessionCount
    ? `<div class="warn-box">${eco.sessionCount - eco.sessionEstimees} session(s) sur ${eco.sessionCount} sans estimation (modèle non référencé).</div>`
    : '';

  const rows = eco.sessions.map((s) => `<tr>
    <td>${escape(fmtDate(s.date))}</td>
    <td>${escape(s.model || '—')}</td>
    <td>${escape(fmtTokens(s.tokens))}</td>
    <td>${escape(s.co2g != null ? _fmtCo2(s.co2g) + ' g' : 'N/D')}</td>
    <td>${escape(s.method || '—')}</td>
  </tr>`).join('\n');

  return `<section>
  <h2>Impact écologique — 30 dernières sessions</h2>
  ${avertissement}
  <p class="note">${escape(CO2_LABEL)} — sources&nbsp;: EcoLogits (Apache-2.0), intensité carbone EU 2024.</p>
  <div class="kpis">
    <div class="kpi"><div class="label">CO₂ total (30 sessions)</div><div class="value">${escape(_fmtCo2(eco.co2Total30))} g</div></div>
    <div class="kpi"><div class="label">Moyenne / session</div><div class="value">${escape(eco.co2Moyenne != null ? _fmtCo2(eco.co2Moyenne) : 'N/D')} g</div></div>
    <div class="kpi"><div class="label">Tendance</div><div class="value">${escape(fmtTendanceLong(eco.tendance))}</div></div>
    <div class="kpi"><div class="label">Sessions estimées</div><div class="value">${eco.sessionEstimees}/${eco.sessionCount}</div></div>
  </div>
  <h3>Tableau des sessions</h3>
  <table>
    <thead>
      <tr>
        <th scope="col">Date</th>
        <th scope="col">Modèle</th>
        <th scope="col">Tokens</th>
        <th scope="col">CO₂ (g)</th>
        <th scope="col">Méthode</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="actions" style="margin-top:1.5rem;">
    <a href="metrics.html">← Métriques</a>
  </div>
</section>`;
}
