// AIAD SDD Mode — Dashboard : quarterly retro auto-generated (#473).
//
// Compose un Markdown de rétrospective trimestrielle PM en agrégeant
// les données collectées par les autres modules :
//   - Intents livrés ce trimestre (statut done/archived + target Qx)
//   - Hypothèses validées vs invalidées (#440)
//   - Outcomes atteints vs ratés (#208)
//   - DORA-like : Cycle time moyen (#438)
//   - Top 3 apprentissages (placeholder à compléter humainement)
//
// L'objectif : 80 % du contenu de la rétro est pré-rempli automatiquement,
// le PM édite juste les apprentissages personnels.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { lireQuarterIntent, formatQuarter } from './roadmap.js';

const STATUTS_LIVRES = new Set(['done', 'archived']);

function quarterActuel(now) {
  const d = new Date(now);
  return { year: d.getUTCFullYear(), quarter: Math.ceil((d.getUTCMonth() + 1) / 3) };
}

function intentsLivresDuQuarter(donnees, qCourant) {
  return (donnees?.intents || []).filter((i) => {
    if (!STATUTS_LIVRES.has(i.statut)) return false;
    const q = lireQuarterIntent(i);
    if (!q) return false;
    return q.year === qCourant.year && q.quarter === qCourant.quarter;
  });
}

function hypothesesParStatut(donnees, statuts) {
  return (donnees?.hypotheses?.hypotheses || []).filter((h) => statuts.includes(h.statut));
}

function outcomesAtteints(donnees) {
  return (donnees?.outcomes?.criteres || []).filter((c) => c.etat === 'ok');
}

function outcomesRates(donnees) {
  return (donnees?.outcomes?.criteres || []).filter((c) => c.etat === 'bad');
}

export function genererRetro(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const qCourant = quarterActuel(now);
  const projet = donnees?.projet?.nom || 'projet';
  const intentsLivres = intentsLivresDuQuarter(donnees, qCourant);
  const hypValidees = hypothesesParStatut(donnees, ['validated']);
  const hypInvalidees = hypothesesParStatut(donnees, ['invalidated']);
  const outOk = outcomesAtteints(donnees);
  const outBad = outcomesRates(donnees);
  const cycle = donnees?.cycleTime?.stats;
  const lignes = [];
  lignes.push(`# Rétrospective ${formatQuarter(qCourant)} — ${projet}`);
  lignes.push('');
  lignes.push(`_Auto-générée le ${new Date(now).toISOString().slice(0, 10)} — à compléter par les apprentissages humains._`);
  lignes.push('');

  lignes.push('## Ce qui a été livré');
  if (intentsLivres.length > 0) {
    for (const i of intentsLivres) {
      lignes.push(`- ${i.id} — ${i.titre || ''}`);
    }
  } else {
    lignes.push('- _Aucun Intent livré sur ce trimestre._');
  }
  lignes.push('');

  lignes.push('## Hypothèses validées');
  if (hypValidees.length > 0) {
    for (const h of hypValidees.slice(0, 5)) {
      lignes.push(`- ${h.id} : ${(h.hypothese || '').slice(0, 120)}`);
    }
  } else {
    lignes.push('- _Aucune hypothèse validée._');
  }
  lignes.push('');

  if (hypInvalidees.length > 0) {
    lignes.push('## Hypothèses invalidées (apprentissages les plus précieux)');
    for (const h of hypInvalidees.slice(0, 5)) {
      lignes.push(`- ${h.id} : ${(h.hypothese || '').slice(0, 120)}`);
    }
    lignes.push('');
  }

  if (outOk.length + outBad.length > 0) {
    lignes.push('## Outcomes PRD §4');
    for (const o of outOk) {
      lignes.push(`- ✓ ${o.critere} — cible ${o.cible} : atteinte (${o.actuel})`);
    }
    for (const o of outBad) {
      lignes.push(`- ✗ ${o.critere} — cible ${o.cible} : ratée (${o.actuel || '—'})`);
    }
    lignes.push('');
  }

  if (cycle) {
    lignes.push('## Métriques de livraison');
    lignes.push(`- Lead time médian : **${cycle.p50} jours** (p95 : ${cycle.p95}, moyenne : ${cycle.moyenne})`);
    lignes.push(`- Intents livrés mesurés : ${cycle.n}`);
    lignes.push('');
  }

  lignes.push('## Top 3 apprentissages humains');
  lignes.push('1. [À compléter — ce qui a marché]');
  lignes.push('2. [À compléter — ce qui n\'a pas marché]');
  lignes.push('3. [À compléter — ce qu\'on va changer le prochain trimestre]');
  lignes.push('');

  lignes.push('## Décisions pour le prochain trimestre');
  lignes.push('- [À compléter]');
  lignes.push('');
  lignes.push('---');
  lignes.push('_Trame auto-générée depuis le dashboard PM aiad-sdd. Conserver dans `.aiad/metrics/retros/`._');
  return lignes.join('\n');
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const RETRO_CSS = `<style>
.retro-pre { background:rgba(127,127,127,.08); padding:.75rem; border-radius:.25rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.78rem; user-select: all; white-space: pre-wrap; max-height: 480px; overflow:auto; border:1px solid var(--border, #ddd); }
.retro-hint { color: var(--muted, #777); font-size:.85rem; margin:.25rem 0 .5rem; }
</style>`;

export function blocQuarterlyRetro(donnees) {
  const md = genererRetro(donnees);
  return `${RETRO_CSS}<section>
    <h2>Rétrospective trimestrielle <span class="count">Markdown · click pour tout sélectionner</span></h2>
    <p class="retro-hint">Trame de rétrospective trimestrielle auto-générée à partir des données collectées (Intents livrés / hypothèses validées-invalidées / outcomes PRD / lead time #438). Le PM édite les <em>Top 3 apprentissages</em> et <em>Décisions pour le prochain trimestre</em>.</p>
    <pre class="retro-pre">${escape(md)}</pre>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  genererRetro as generateQuarterlyRetro,
  blocQuarterlyRetro as quarterlyRetroSection,
};
