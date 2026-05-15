// AIAD SDD Mode — Dashboard : daily focus / north star widget (#465).
//
// Place une bannière visuelle large en haut de pm.html avec **UN seul
// signal** (la pire alerte critique) pour aiguiller le PM en arrivant
// le matin. Si rien de critique → message positif "Pas de feu, focus
// sur tes priorités".
//
// Sources analysées (par ordre de gravité) :
//   1. Cycle de dépendance détecté (#434) — bloque tout
//   2. Fact critique ouvert
//   3. Intent en retard sur target (#431)
//   4. Goulot d'étranglement (#436)
//   5. Pari risqué actif (#459)
//   6. Intent urgent ≤ 14j
//
// Pour chaque alerte, propose un libellé court + l'action concrète à
// mener (cliquable vers l'ancre de la section concernée).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const SOURCES = [
  {
    key: 'cycle',
    extract: (d) => {
      const c = d?.intentDeps?.cycles || [];
      return c.length > 0 ? {
        gravite: 'critical',
        titre: `${c.length} cycle(s) de dépendance détecté(s)`,
        action: 'Casser le cycle avant tout autre travail',
        ancre: '#dependances-intent',
      } : null;
    },
  },
  {
    key: 'fact',
    extract: (d) => {
      const fcts = (d?.facts || []).filter((f) => f.gravite === 'critical' && !['closed', 'resolu', 'résolu'].includes(f.statut));
      return fcts.length > 0 ? {
        gravite: 'critical',
        titre: `${fcts.length} fact critique ouvert${fcts.length > 1 ? 's' : ''}`,
        action: 'Investigation immédiate requise',
        ancre: '#decisions-et-facts',
      } : null;
    },
  },
  {
    key: 'retard',
    extract: (d) => {
      const r = d?.deadlines?.totaux?.retard || 0;
      return r > 0 ? {
        gravite: 'critical',
        titre: `${r} Intent(s) en retard sur target`,
        action: 'Re-planifier ou escalader au sponsor',
        ancre: '#echeances-intent',
      } : null;
    },
  },
  {
    key: 'goulot',
    extract: (d) => {
      const total = d?.bottlenecks?.total || 0;
      return total > 0 ? {
        gravite: 'warn',
        titre: `${total} goulot(s) d'étranglement détecté(s)`,
        action: 'Décharger un statut saturé',
        ancre: '#goulots-detranglement',
      } : null;
    },
  },
  {
    key: 'pari',
    extract: (d) => {
      const p = d?.confidenceTracker?.totaux?.paris || 0;
      return p > 0 ? {
        gravite: 'warn',
        titre: `${p} pari(s) risqué(s) en cours`,
        action: 'Valider ou abandonner l\'hypothèse',
        ancre: '#confidence-tracker',
      } : null;
    },
  },
  {
    key: 'urgent',
    extract: (d) => {
      const u = d?.deadlines?.totaux?.urgent || 0;
      return u > 0 ? {
        gravite: 'warn',
        titre: `${u} Intent(s) urgent(s) (≤ 14 j)`,
        action: 'Maintenir le focus sur ces deliveries',
        ancre: '#echeances-intent',
      } : null;
    },
  },
];

export function calculerDailyFocus(donnees) {
  for (const src of SOURCES) {
    const alerte = src.extract(donnees);
    if (alerte) return { ...alerte, source: src.key };
  }
  return null; // tout est calme
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const FOCUS_CSS = `<style>
.pm-daily-focus {
  margin: -.5rem -1rem 1rem; padding: 1rem 1.2rem;
  border-radius: 0; font-size: .95rem;
  display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;
}
.pm-daily-focus.gravite-critical {
  background: linear-gradient(90deg, rgba(201,42,42,.18), rgba(201,42,42,.05));
  border-bottom: 2px solid #c92a2a;
  color: #7a1717;
}
.pm-daily-focus.gravite-warn {
  background: linear-gradient(90deg, rgba(232,89,12,.15), rgba(232,89,12,.04));
  border-bottom: 2px solid #e8590c;
  color: #7a3a08;
}
.pm-daily-focus.gravite-calme {
  background: linear-gradient(90deg, rgba(43,138,62,.12), rgba(43,138,62,.02));
  border-bottom: 2px solid #2b8a3e;
  color: #1f6b2f;
}
.pm-daily-focus-emoji { font-size: 1.8rem; line-height: 1; flex-shrink: 0; }
.pm-daily-focus-content { flex: 1; min-width: 200px; }
.pm-daily-focus-titre { font-weight: 700; font-size: 1.05rem; }
.pm-daily-focus-action { font-size: .85rem; opacity: .85; margin-top: .15rem; }
.pm-daily-focus a { color: inherit; text-decoration: underline; font-weight: 600; }
.pm-daily-focus-meta { font-size: .7rem; opacity: .65; text-transform: uppercase; letter-spacing: .05em; }
@media print {
  .pm-daily-focus { background: #fff; color: #000; border: 1px solid #888; }
}
</style>`;

const EMOJI_GRAVITE = {
  critical: '🚨',
  warn: '⚠️',
  calme: '✓',
};

export function blocDailyFocus(donnees) {
  const f = donnees?.dailyFocus;
  if (!f) {
    return `${FOCUS_CSS}<div class="pm-daily-focus gravite-calme" role="status" aria-live="polite">
      <div class="pm-daily-focus-emoji">${EMOJI_GRAVITE.calme}</div>
      <div class="pm-daily-focus-content">
        <div class="pm-daily-focus-titre">Pas de feu — focus sur tes priorités</div>
        <div class="pm-daily-focus-action">Top priorités ci-dessous ↓</div>
      </div>
      <div class="pm-daily-focus-meta">Focus du jour</div>
    </div>`;
  }
  return `${FOCUS_CSS}<div class="pm-daily-focus gravite-${escape(f.gravite)}" role="alert" aria-live="assertive">
    <div class="pm-daily-focus-emoji">${EMOJI_GRAVITE[f.gravite] || '⚠️'}</div>
    <div class="pm-daily-focus-content">
      <div class="pm-daily-focus-titre"><a href="${escape(f.ancre)}">${escape(f.titre)}</a></div>
      <div class="pm-daily-focus-action">→ ${escape(f.action)}</div>
    </div>
    <div class="pm-daily-focus-meta">Focus du jour</div>
  </div>`;
}

// Alias EN canoniques (#42)
export {
  calculerDailyFocus as computeDailyFocus,
  blocDailyFocus as dailyFocusSection,
};
