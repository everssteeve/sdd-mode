// AIAD SDD Mode — Dashboard : reading time estimator pour artefacts (#524).
//
// Estime le temps de lecture moyen pour chaque Intent et chaque SPEC
// basé sur le nombre de mots du body. Vitesse référence : 220 mots/min
// (lecture technique). Ajoute un signal "trop long" si > 8 min.
//
// Sources :
//   - intent.body / intent.fullText (depuis collect.js si exposé)
//   - sinon, estimation à partir de intent.sections (POURQUOI/POUR QUI/…)
//
// Pure transformation.

const VITESSE = 220; // mots/min lecture technique

function compterMots(s) {
  if (!s || typeof s !== 'string') return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function estimerArtefact(artefact, options = {}) {
  // Source primaire : body si disponible, sinon concat sections.
  let texte = '';
  if (typeof artefact?.body === 'string') texte = artefact.body;
  else if (typeof artefact?.contenu === 'string') texte = artefact.contenu;
  else if (artefact?.sections) {
    texte = Object.values(artefact.sections).filter(Boolean).join(' ');
  } else if (typeof artefact?.titre === 'string') {
    texte = artefact.titre; // fallback minimal
  }
  const mots = compterMots(texte);
  const minutes = mots === 0 ? 0 : Math.max(1, Math.round(mots / VITESSE));
  return { mots, minutes };
}

export function calculerReadingTime(donnees, options = {}) {
  const intents = (donnees?.intents || []).map((i) => {
    const { mots, minutes } = estimerArtefact(i);
    return {
      type: 'intent',
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      mots,
      minutes,
      trop_long: minutes > 8,
    };
  });
  const specs = (donnees?.specs || []).map((s) => {
    const { mots, minutes } = estimerArtefact(s);
    return {
      type: 'spec',
      id: s.id,
      titre: s.titre || '',
      file: s.file || null,
      statut: s.statut,
      mots,
      minutes,
      trop_long: minutes > 8,
    };
  });
  const all = [...intents, ...specs];
  all.sort((a, b) => b.minutes - a.minutes);
  const totalMinutes = all.reduce((sum, x) => sum + x.minutes, 0);
  const tropLongs = all.filter((x) => x.trop_long);
  return {
    items: all,
    intents,
    specs,
    totaux: {
      total: all.length,
      intents: intents.length,
      specs: specs.length,
      totalMinutes,
      moyenneMinutes: all.length === 0 ? 0 : Math.round(totalMinutes / all.length * 10) / 10,
      tropLongs: tropLongs.length,
      vitesseMotsParMin: VITESSE,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const RT_CSS = `<style>
.rt-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:.4rem; margin:.4rem 0; }
.rt-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.rt-stat .rt-val { font-size:1.2rem; font-weight:700; }
.rt-stat .rt-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.rt-row { padding:.3rem .45rem; margin:.15rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.22rem; display:flex; gap:.5rem; flex-wrap:wrap; align-items:baseline; }
.rt-row.trop-long { border-left:3px solid #e8590c; background:rgba(232,89,12,.04); }
.rt-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.rt-tag.intent { background:rgba(76,110,245,.12); color:#3a4cba; }
.rt-tag.spec { background:rgba(232,89,12,.12); color:#7a3a08; }
.rt-meta { font-size:.74rem; color:var(--muted, #777); }
</style>`;

export function blocReadingTime(donnees) {
  const r = donnees?.readingTime;
  if (!r) return '';
  const t = r.totaux;
  if (t.total === 0) {
    return `${RT_CSS}<section>
      <h2>Temps de lecture artefacts <span class="count">aucun artefact</span></h2>
      <p class="muted" style="font-size:.85rem">Estime le temps de lecture (vitesse ${VITESSE} mots/min) par Intent et SPEC pour aider à planifier les revues.</p>
    </section>`;
  }
  const grid = [
    `<div class="rt-stat"><div class="rt-val">${t.total}</div><div class="rt-label">Artefacts</div></div>`,
    `<div class="rt-stat"><div class="rt-val">${t.totalMinutes}min</div><div class="rt-label">Total lecture</div></div>`,
    `<div class="rt-stat"><div class="rt-val">${t.moyenneMinutes}min</div><div class="rt-label">Moyen / artefact</div></div>`,
    `<div class="rt-stat"${t.tropLongs > 0 ? ' style="background:rgba(232,89,12,.07); border-color:rgba(232,89,12,.3)"' : ''}><div class="rt-val">${t.tropLongs}</div><div class="rt-label">Trop longs (&gt; 8min)</div></div>`,
  ].join('');
  // Top 15 par minutes
  const top = r.items.slice(0, 15);
  const rows = top.map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    return `<div class="rt-row ${it.trop_long ? 'trop-long' : ''}">
      <span class="rt-tag ${escape(it.type)}">${escape(it.type)}</span>
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 50))}</span>
      <span class="rt-meta"><strong>${it.minutes} min</strong> · ${it.mots} mots${it.trop_long ? ' · ⚠ trop long' : ''}</span>
    </div>`;
  }).join('');
  return `${RT_CSS}<section>
    <h2>Temps de lecture artefacts <span class="count">${t.total} artefacts · ${t.totalMinutes} min cumulé</span></h2>
    <p class="muted" style="font-size:.85rem">Estime le temps de lecture (vitesse ${t.vitesseMotsParMin} mots/min) par Intent et SPEC pour planifier les revues. Un artefact &gt; 8 min est marqué "trop long" — proposer un découpage.</p>
    <div class="rt-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerReadingTime as computeReadingTime,
  blocReadingTime as readingTimeSection,
  VITESSE as READING_SPEED_WPM,
};
