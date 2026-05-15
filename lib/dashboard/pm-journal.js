// AIAD SDD Mode — Dashboard : journal PM (#460).
//
// Permet au PM de capturer un journal quotidien (décisions du jour,
// blockers identifiés, notes d'interview utilisateur) dans
// `.aiad/metrics/pm-journal/YYYY-MM-DD.md` (un fichier par jour) — le
// dashboard agrège les N derniers jours et propose un bouton de
// capture rapide qui copie la commande shell prête à coller.
//
// Format de fichier (libre, mais convention) :
//   # 2026-05-15
//   ## Décisions
//   - Décision X parce que Y
//   ## Blockers
//   - Bloqué par Z
//   ## Notes utilisateur
//   - Interview Marketing EU : friction sur l'onboarding mobile
//
// Aucun effet de bord (lecture seule). Pure transformation.
//
// Documentation : https://aiad.ovh

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { lireFichier } from './collect.js';

export function lireJournalEntries(racineProjet, options = {}) {
  const dir = join(racineProjet, '.aiad', 'metrics', 'pm-journal');
  if (!existsSync(dir)) return { fichier: null, entries: [] };
  const limite = options.limite || 7;
  const out = [];
  for (const f of readdirSync(dir)) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    if (!m) continue;
    const chemin = join(dir, f);
    let mtime = null;
    try { mtime = statSync(chemin).mtimeMs; } catch { /* fichier disparu */ }
    const contenu = lireFichier(chemin) || '';
    // Compte les lignes "- " comme entrées atomiques.
    const items = (contenu.match(/^[*-]\s+.+$/gm) || []).length;
    out.push({
      date: m[1],
      fichier: relative(racineProjet, chemin),
      contenu,
      items,
      mtime,
    });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return {
    fichier: relative(racineProjet, dir),
    entries: out.slice(0, limite),
    totalEntries: out.reduce((s, e) => s + e.items, 0),
    totalJours: out.length,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const JOURNAL_CSS = `<style>
.journal-item { padding:.5rem .7rem; margin:.4rem 0; border-left:3px solid var(--accent, #4c6ef5); background:rgba(76,110,245,.04); border-radius:.25rem; font-size:.85rem; }
.journal-item-date { font-weight:600; font-size:.78rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted, #777); }
.journal-item-count { font-size:.7rem; color:var(--muted, #777); margin-left:.5rem; }
.journal-item-content { margin-top:.3rem; white-space:pre-wrap; font-size:.82rem; line-height:1.4; max-height: 200px; overflow:auto; }
.journal-capture {
  margin-top:.5rem; padding:.5rem .65rem;
  background: rgba(127,127,127,.05); border-radius:.3rem;
  font-size:.85rem;
}
.journal-capture pre {
  margin:.3rem 0 0; padding:.4rem .55rem;
  background:#0c0c0c; color:#d5d5d5;
  border-radius:.25rem; font-size:.75rem;
  user-select:all; white-space:pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>`;

function commandeCaptureRapide(racineProjet) {
  const today = new Date().toISOString().slice(0, 10);
  return `# Capturer une entrée dans le journal du jour
mkdir -p .aiad/metrics/pm-journal
cat >> .aiad/metrics/pm-journal/${today}.md <<'EOF'

## $(date +%H:%M) — [Type]

- [Note]

EOF`;
}

export function blocPmJournal(donnees) {
  const j = donnees?.pmJournal;
  if (!j) return '';
  if (j.entries.length === 0) {
    return `${JOURNAL_CSS}<section>
      <h2>Journal PM <span class="count">aucune entrée</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun fichier <code>.aiad/metrics/pm-journal/YYYY-MM-DD.md</code> trouvé. Capture tes décisions du jour, blockers, notes d'interview utilisateur — le dashboard agrège les 7 derniers jours en lecture.</p>
      <div class="journal-capture">
        <strong>Commande de capture rapide (click pour tout sélectionner) :</strong>
        <pre>${escape(commandeCaptureRapide())}</pre>
      </div>
    </section>`;
  }
  const items = j.entries.map((e) => {
    const fileLink = e.fichier ? lienSource(e.fichier, `${e.date}.md`) : `<code>${escape(e.date)}</code>`;
    return `<div class="journal-item">
      <span class="journal-item-date">${escape(e.date)}</span>
      <span class="journal-item-count">${e.items} entrée(s) · ${fileLink}</span>
      <div class="journal-item-content">${escape(e.contenu).slice(0, 1200)}${e.contenu.length > 1200 ? '\n…' : ''}</div>
    </div>`;
  }).join('');
  return `${JOURNAL_CSS}<section>
    <h2>Journal PM <span class="count">${j.entries.length} dernier(s) jour(s) · ${j.totalEntries} entrée(s) totales sur ${j.totalJours} jour(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Captures quotidiennes (décisions, blockers, notes utilisateur) depuis <code>${escape(j.fichier || '.aiad/metrics/pm-journal/')}</code>. Une ligne <code>- ...</code> = une entrée atomique.</p>
    ${items}
    <div class="journal-capture">
      <strong>Commande de capture rapide pour aujourd'hui :</strong>
      <pre>${escape(commandeCaptureRapide())}</pre>
    </div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lireJournalEntries as readJournalEntries,
  blocPmJournal as pmJournalSection,
};
