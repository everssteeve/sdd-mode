// AIAD SDD Mode — Dashboard : stakeholder communication tracker (#489).
//
// Pour chaque Intent actif, indique **la dernière fois que le PM a
// communiqué dessus** (demo / sync-strat / journal mention) afin de
// repérer les Intents "silencieux" (sponsor pas informé depuis > 30j).
//
// Sources :
//   - .aiad/metrics/demo/*.{md,json}      (mtime du fichier le plus récent)
//   - .aiad/metrics/sync-strat/*          (idem)
//   - .aiad/metrics/pm-journal/*.md       (scan textuel des mentions INTENT-NNN)
//
// Politique :
//   - Calcule pour chaque Intent : lastDemo, lastSync, lastJournalMention
//   - `derniereComm` = max(lastDemo, lastSync, lastJournalMention)
//   - Classe : `recent` ≤ 7j, `tiede` ≤ 30j, `silencieux` > 30j ou jamais
//
// Aucun effet de bord. Pure transformation côté lecture.
//
// Documentation : https://aiad.ovh

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SEUIL_RECENT = 7 * 24 * 3600 * 1000;
const SEUIL_TIEDE = 30 * 24 * 3600 * 1000;

function lireRep(rep) {
  try { return readdirSync(rep); } catch (e) { return []; }
}

function mtimePlusRecent(rep) {
  const fichiers = lireRep(rep);
  let max = 0;
  for (const n of fichiers) {
    if (n.startsWith('.')) continue;
    try {
      const m = statSync(join(rep, n)).mtimeMs;
      if (m > max) max = m;
    } catch { /* ignore */ }
  }
  return max || null;
}

// Scan `pm-journal/*.md` à la recherche de mentions `INTENT-NNN`.
// Retourne Map(INTENT-NNN → derniereMention timestamp).
export function scannerMentionsJournal(racineProjet) {
  const rep = join(racineProjet || '.', '.aiad', 'metrics', 'pm-journal');
  const out = new Map();
  for (const n of lireRep(rep)) {
    if (!n.endsWith('.md')) continue;
    const chemin = join(rep, n);
    let texte = '';
    let mtime = 0;
    try {
      texte = readFileSync(chemin, 'utf8');
      mtime = statSync(chemin).mtimeMs;
    } catch { continue; }
    // Date implicite dans le nom du fichier `YYYY-MM-DD.md` si parsable.
    const dateParsed = Date.parse(n.replace(/\.md$/, ''));
    const ts = !isNaN(dateParsed) ? dateParsed : mtime;
    const regex = /INTENT-\d+/g;
    let match;
    while ((match = regex.exec(texte)) != null) {
      const id = match[0];
      if (!out.has(id) || ts > out.get(id)) out.set(id, ts);
    }
  }
  return out;
}

function classerDelai(ts, now) {
  if (!ts) return { etat: 'silencieux', jours: null };
  const delta = now - ts;
  const jours = Math.floor(delta / (24 * 3600 * 1000));
  if (delta < SEUIL_RECENT) return { etat: 'recent', jours };
  if (delta < SEUIL_TIEDE) return { etat: 'tiede', jours };
  return { etat: 'silencieux', jours };
}

export function calculerStakeholderComms(racineProjet, donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const repDemo = join(racineProjet || '.', '.aiad', 'metrics', 'demo');
  const repSync = join(racineProjet || '.', '.aiad', 'metrics', 'sync-strat');
  const lastDemo = mtimePlusRecent(repDemo);
  const lastSync = mtimePlusRecent(repSync);
  const mentions = scannerMentionsJournal(racineProjet);
  const items = [];
  for (const i of donnees?.intents || []) {
    if (['archived'].includes(i.statut)) continue;
    const court = i.id.split('-').slice(0, 2).join('-');
    const lastJournal = mentions.get(court) || null;
    // derniereComm : max des 3 (demo et sync sont globaux, journal est par Intent).
    const candidats = [lastDemo, lastSync, lastJournal].filter((x) => x != null);
    const derniereComm = candidats.length ? Math.max(...candidats) : null;
    const c = classerDelai(derniereComm, now);
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      sponsor: i.sponsor || null,
      lastDemo,
      lastSync,
      lastJournal,
      derniereComm,
      ...c,
    });
  }
  // Tri : silencieux d'abord (à relancer).
  const RANK = { silencieux: 0, tiede: 1, recent: 2 };
  items.sort((a, b) => (RANK[a.etat] ?? 99) - (RANK[b.etat] ?? 99));
  const totaux = {
    total: items.length,
    recent: items.filter((i) => i.etat === 'recent').length,
    tiede: items.filter((i) => i.etat === 'tiede').length,
    silencieux: items.filter((i) => i.etat === 'silencieux').length,
  };
  return { items, totaux, lastDemo, lastSync, mentions: mentions.size };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const SC_CSS = `<style>
.sc-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.5rem; margin:.5rem 0; }
.sc-stat { padding:.5rem; border-radius:.3rem; text-align:center; }
.sc-stat.lvl-recent { background:rgba(43,138,62,.07); border:1px solid rgba(43,138,62,.3); }
.sc-stat.lvl-tiede { background:rgba(232,89,12,.05); border:1px solid rgba(232,89,12,.3); }
.sc-stat.lvl-silencieux { background:rgba(201,42,42,.06); border:1px solid rgba(201,42,42,.3); }
.sc-stat .sc-val { font-size:1.3rem; font-weight:700; }
.sc-stat .sc-label { font-size:.72rem; text-transform:uppercase; color:var(--muted, #777); }
.sc-row { padding:.35rem .55rem; margin:.25rem 0; border-radius:.25rem; background:rgba(127,127,127,.04); display:flex; gap:.6rem; flex-wrap:wrap; align-items:baseline; font-size:.82rem; }
.sc-row.row-silencieux { border-left:3px solid #c92a2a; background:rgba(201,42,42,.04); }
.sc-row.row-tiede { border-left:3px solid #e8590c; background:rgba(232,89,12,.03); }
.sc-row.row-recent { border-left:3px solid #2b8a3e; }
.sc-meta { font-size:.74rem; color:var(--muted, #777); }
.sc-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

const LABELS = {
  recent: '✓ Récent (≤ 7j)',
  tiede: '◐ Tiède (8-30j)',
  silencieux: '⚠ Silencieux (> 30j)',
};

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fr-FR');
}

export function blocStakeholderComms(donnees) {
  const c = donnees?.stakeholderComms;
  if (!c) return '';
  if (c.items.length === 0) {
    return `${SC_CSS}<section>
      <h2>Communication stakeholder <span class="count">aucun Intent à suivre</span></h2>
      <p class="muted" style="font-size:.85rem">Le tracker repère les Intents <strong>silencieux</strong> (sponsor pas informé depuis &gt; 30j). Sources : <code>.aiad/metrics/demo/</code>, <code>.aiad/metrics/sync-strat/</code>, mentions <code>INTENT-NNN</code> dans <code>pm-journal/</code>.</p>
    </section>`;
  }
  const t = c.totaux;
  const grid = ['silencieux', 'tiede', 'recent'].map((etat) => `<div class="sc-stat lvl-${etat}">
      <div class="sc-val">${t[etat] || 0}</div>
      <div class="sc-label">${escape(LABELS[etat])}</div>
    </div>`).join('');
  const rows = c.items.slice(0, 20).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const sponsor = it.sponsor ? `<span class="sc-meta">sponsor : ${escape(String(it.sponsor))}</span>` : '';
    const dern = it.derniereComm ? `<span class="sc-meta">dernière comm : ${escape(fmtDate(it.derniereComm))} (${it.jours} j)</span>` : '<span class="sc-meta">jamais mentionné</span>';
    return `<div class="sc-row row-${escape(it.etat)}">
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 60))}</span>
      <span class="sc-meta">[${escape(it.statut || '?')}]</span>
      ${dern}
      ${sponsor}
    </div>`;
  }).join('');
  const conseil = t.silencieux > 0
    ? `<p class="muted" style="font-size:.85rem">⚠ <strong>${t.silencieux} Intent(s) silencieux</strong> — programmer un sync rapide avec sponsor / stakeholder + une entrée dans <code>pm-journal/</code> via <code>/aiad standup</code>.</p>`
    : `<p class="muted" style="font-size:.85rem">✓ <strong>${t.recent}/${t.total} récent(s)</strong> — communication stakeholder à jour.</p>`;
  return `${SC_CSS}<section>
    <h2>Communication stakeholder <span class="count">${t.total} Intent(s) — dernière demo ${c.lastDemo ? escape(fmtDate(c.lastDemo)) : 'jamais'}</span></h2>
    <p class="muted" style="font-size:.85rem">Pour chaque Intent actif, dernière trace de communication (demo / sync-strat / mention pm-journal). Détecte les Intents silencieux où sponsor / stakeholder n'a pas été informé récemment.</p>
    <div class="sc-grid">${grid}</div>
    ${conseil}
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  scannerMentionsJournal as scanJournalMentions,
  calculerStakeholderComms as computeStakeholderComms,
  blocStakeholderComms as stakeholderCommsSection,
};
