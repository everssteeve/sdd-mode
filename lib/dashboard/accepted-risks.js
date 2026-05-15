// AIAD SDD Mode — Dashboard : registre des risques acceptés (#508).
//
// Distingue les **risques acceptés** (décision explicite de vivre avec)
// des risques actifs à mitiger. Lit deux signaux frontmatter :
//   - `risks_accepted: [...]`   liste texte directe
//   - `risk_status: accepted`   marque l'Intent entier comme acceptation
//                                de tous ses risques
//
// Permet une gouvernance lisible : "voici ce qu'on a choisi de NE PAS
// adresser, et pourquoi". Utile en audit & en sync sponsor.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

function lireListe(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

export function extraireAcceptes(intent) {
  const accepted = lireListe(intent?.risks_accepted || intent?.risksAccepted || intent?.accepted_risks || intent?.acceptedRisks);
  const statutAccept = (intent?.risk_status || intent?.riskStatus || '').toString().toLowerCase().trim();
  const tousAcceptes = statutAccept === 'accepted' || statutAccept === 'accepte' || statutAccept === 'all-accepted';
  return { accepted, tousAcceptes };
}

export function calculerAcceptedRisks(donnees) {
  const items = [];
  for (const i of donnees?.intents || []) {
    if (['archived'].includes(i.statut)) continue;
    const { accepted, tousAcceptes } = extraireAcceptes(i);
    if (accepted.length === 0 && !tousAcceptes) continue;
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      sponsor: i.sponsor || null,
      accepted,
      tousAcceptes,
      nbRisques: accepted.length || (tousAcceptes ? 1 : 0),
    });
  }
  // Tri : Intents avec plus de risques acceptés en tête.
  items.sort((a, b) => b.nbRisques - a.nbRisques);
  const totalAcceptes = items.reduce((s, i) => s + i.accepted.length, 0);
  return {
    items,
    totaux: {
      intents: items.length,
      risquesAcceptes: totalAcceptes,
      tousAcceptes: items.filter((i) => i.tousAcceptes).length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const AR_CSS = `<style>
.ar-card { padding:.5rem .65rem; margin:.3rem 0; border-radius:.3rem; background:rgba(127,127,127,.04); border-left:3px solid #f5a623; font-size:.85rem; }
.ar-card.all-accepted { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.ar-head { display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.ar-titre { font-weight:600; }
.ar-meta { font-size:.74rem; color:var(--muted, #777); }
.ar-list { margin:.3rem 0 .1rem; padding-left:1.1rem; font-size:.8rem; }
.ar-list li { margin:.1rem 0; }
.ar-stats { display:flex; gap:.5rem; flex-wrap:wrap; margin:.3rem 0; font-size:.78rem; }
.ar-chip { padding:.1rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; }
.ar-chip.all-accepted { background:rgba(201,42,42,.12); color:#7a1717; }
.ar-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

export function blocAcceptedRisks(donnees) {
  const a = donnees?.acceptedRisks;
  if (!a) return '';
  if (a.items.length === 0) {
    return `${AR_CSS}<section>
      <h2>Registre des risques acceptés <span class="count">aucun risque accepté formalisé</span></h2>
      <div class="ar-empty">Ajoute <code>risks_accepted: [...]</code> ou <code>risk_status: accepted</code> au frontmatter d'un Intent pour formaliser une **décision d'acceptation de risque**. Utile en audit & sync sponsor.</div>
    </section>`;
  }
  const t = a.totaux;
  const stats = `<div class="ar-stats">
    <span class="ar-chip">${t.intents} Intent(s) concerné(s)</span>
    <span class="ar-chip">${t.risquesAcceptes} risque(s) listé(s)</span>
    ${t.tousAcceptes > 0 ? `<span class="ar-chip all-accepted">${t.tousAcceptes} Intent(s) "all-accepted"</span>` : ''}
  </div>`;
  const cards = a.items.slice(0, 15).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const sponsor = it.sponsor ? ` <span class="ar-meta">sponsor : ${escape(String(it.sponsor))}</span>` : '';
    const liste = it.accepted.length > 0
      ? `<ul class="ar-list">${it.accepted.slice(0, 6).map((r) => `<li>${escape(r)}</li>`).join('')}</ul>`
      : (it.tousAcceptes ? '<div class="ar-meta">Statut <code>risk_status: accepted</code> sur l\'Intent entier.</div>' : '');
    return `<div class="ar-card${it.tousAcceptes ? ' all-accepted' : ''}">
      <div class="ar-head">
        <span class="ar-titre">${idCell}</span>
        <span>${escape((it.titre || '').slice(0, 60))}</span>
        <span class="ar-meta">[${escape(it.statut || '?')}]</span>
        ${sponsor}
      </div>
      ${liste}
    </div>`;
  }).join('');
  return `${AR_CSS}<section>
    <h2>Registre des risques acceptés <span class="count">${t.intents} Intent(s) · ${t.risquesAcceptes} risque(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Liste les Intents qui ont formalisé des risques acceptés (<code>risks_accepted: [...]</code>) ou marqué <code>risk_status: accepted</code> sur tout l'Intent. Gouvernance lisible : "voici ce qu'on a choisi de NE PAS adresser, et pourquoi".</p>
    ${stats}
    <div>${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  extraireAcceptes as extractAccepted,
  calculerAcceptedRisks as computeAcceptedRisks,
  blocAcceptedRisks as acceptedRisksSection,
};
