// AIAD SDD Mode — Dashboard : strategic narrative generator (#487).
//
// Compose UN paragraphe factuel de 4-6 phrases qui résume l'état
// stratégique du projet pour le PM :
//   - Counts (Intents actifs, in-delivery, done)
//   - Top priorité P0/P1 + avancement
//   - Risque majeur
//   - Vélocité (rythme + tendance)
//   - Santé (score + tendance)
//
// Output : texte français + meta-data (signaux structurés pour relecture
// machine). Anti-fluff : pas de "passionnant", "exceptionnel", "incroyable".
//
// Utile pour : copier dans une PR description, Slack daily, email exec.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const PRANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

function meilleurePrio(intents) {
  const pipeline = intents.filter((i) => i.priority && !['done', 'archived'].includes(i.statut));
  if (pipeline.length === 0) return null;
  pipeline.sort((a, b) => {
    const pa = PRANK[String(a.priority).toUpperCase()] ?? 99;
    const pb = PRANK[String(b.priority).toUpperCase()] ?? 99;
    return pa - pb;
  });
  return pipeline[0];
}

function risqueMajeur(donnees) {
  const r = donnees?.risks?.intents || [];
  const critiques = r.filter((x) => x.niveau === 'critical');
  if (critiques.length > 0) return { intent: critiques[0], niveau: 'critical' };
  const eleves = r.filter((x) => x.niveau === 'high');
  if (eleves.length > 0) return { intent: eleves[0], niveau: 'high' };
  return null;
}

function phraseVelocity(donnees) {
  const f = donnees?.velocityForecast;
  if (!f || f.message) return null;
  const dir = f.reg?.slope > 0.1 ? 'en accélération' : f.reg?.slope < -0.1 ? 'en décélération' : 'stable';
  return `Vélocité **${f.rythmeMoyen} SPECs/sem** ${dir} (projection ${f.horizonSem}sem : ${f.projectionHorizon} SPECs)${f.etaSemaines != null ? ', ETA backlog ~' + f.etaSemaines + ' sem' : ''}.`;
}

function phraseSante(donnees) {
  const t = donnees?.healthTimeline;
  const sante = donnees?.santeGlobale;
  if (!t || t.nbPoints < 2) {
    return sante?.score != null ? `Score santé actuel ${sante.score}/100 (${sante.niveau || '?'}).` : null;
  }
  const trend = t.tendance?.direction;
  const trendTxt = trend === 'up' ? `en amélioration (+${t.tendance.delta} pts)`
    : trend === 'down' ? `en dégradation (${t.tendance.delta} pts)`
    : 'stable';
  const courant = t.points[t.points.length - 1];
  return `Santé du projet **${courant.score}/100** ${trendTxt} sur ${t.nbPoints} snapshots.`;
}

function phraseTopPrio(intents, avancement) {
  const top = meilleurePrio(intents);
  if (!top) return null;
  const av = avancement?.find((a) => a.id === top.id);
  const avTxt = av && av.total > 0 ? ` (${av.done}/${av.total} SPECs livrées)` : '';
  return `Top priorité : **${top.id} — ${top.titre}** [${String(top.priority).toUpperCase()}, ${top.statut}]${avTxt}.`;
}

function phraseRisque(donnees) {
  const r = risqueMajeur(donnees);
  if (!r) return null;
  const top = (r.intent.risques || [])[0]?.texte || r.intent.titre;
  return `Risque majeur : **${r.intent.id}** [${r.niveau}] — ${top}.`;
}

function phraseCounts(donnees) {
  const intents = donnees?.intents || [];
  const actifs = intents.filter((i) => i.statut === 'active' || i.statut === 'in-progress').length;
  const inDelivery = (donnees?.pm?.funnel?.inDelivery) || 0;
  const done = intents.filter((i) => i.statut === 'done').length;
  return `${actifs} Intent(s) actif(s), ${inDelivery} en delivery, ${done} livré(s).`;
}

function phraseAiAct(donnees) {
  const a = donnees?.aiActCompliance?.totaux;
  if (!a || (a.unacceptable + a.high) === 0) return null;
  return `**Conformité AI Act** : ${a.unacceptable + a.high} Intent(s) à risque élevé/interdit — DPO requis.`;
}

export function genererNarratif(donnees) {
  const projet = donnees?.projet?.nom || 'le projet';
  const date = new Date().toISOString().slice(0, 10);
  const intents = donnees?.intents || [];
  const avancement = donnees?.pm?.avancement || [];
  const phrases = [
    `**${projet}** — état ${date} : ${phraseCounts(donnees)}`,
    phraseTopPrio(intents, avancement),
    phraseRisque(donnees),
    phraseVelocity(donnees),
    phraseSante(donnees),
    phraseAiAct(donnees),
  ].filter(Boolean);
  const meta = {
    intentsActifs: intents.filter((i) => ['active', 'in-progress'].includes(i.statut)).length,
    risquesEleves: (donnees?.risks?.intents || []).filter((r) => r.niveau === 'critical' || r.niveau === 'high').length,
    healthScore: donnees?.santeGlobale?.score ?? null,
    healthTrend: donnees?.healthTimeline?.tendance?.direction || null,
    veloMoyen: donnees?.velocityForecast?.rythmeMoyen ?? null,
  };
  return {
    texte: phrases.join(' '),
    phrases,
    meta,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const SN_CSS = `<style>
.sn-narrative { padding:.7rem .9rem; background:rgba(76,110,245,.05); border-left:3px solid var(--accent, #4c6ef5); border-radius:.3rem; line-height:1.55; font-size:.92rem; }
.sn-narrative strong { color:var(--accent, #4c6ef5); }
.sn-actions { display:flex; gap:.4rem; margin:.5rem 0; }
.sn-btn { padding:.3rem .65rem; background:transparent; border:1px solid var(--border, #ccc); border-radius:.25rem; cursor:pointer; font-size:.78rem; color:inherit; }
.sn-btn:hover { background:rgba(127,127,127,.06); }
.sn-meta { font-size:.75rem; color:var(--muted, #777); margin-top:.4rem; display:flex; gap:.4rem; flex-wrap:wrap; }
.sn-chip { padding:.1rem .4rem; background:rgba(127,127,127,.08); border-radius:.2rem; }
</style>`;

function rendreMarkdownLeger(s) {
  // Simple **bold** → <strong>. Anti-XSS : escape d'abord.
  return escape(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

const SN_SCRIPT = `<script>
(function () {
  function init() {
    var btn = document.getElementById('sn-copy-btn');
    var txt = document.getElementById('sn-raw-text');
    if (!btn || !txt) return;
    btn.addEventListener('click', function () {
      var content = txt.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).then(function () {
          var orig = btn.textContent;
          btn.textContent = '✓ Copié';
          setTimeout(function () { btn.textContent = orig; }, 1600);
        });
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocStrategicNarrative(donnees) {
  const n = donnees?.strategicNarrative;
  if (!n) return '';
  if (n.phrases.length === 0) {
    return `${SN_CSS}<section>
      <h2>Narratif stratégique <span class="count">données insuffisantes</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun Intent, aucune métrique ne permet de générer un narratif. Capture un Intent avec <code>/sdd intent</code>.</p>
    </section>`;
  }
  const html = n.phrases.map(rendreMarkdownLeger).join(' ');
  const raw = n.texte.replace(/\*\*([^*]+)\*\*/g, '$1');
  const meta = n.meta;
  return `${SN_CSS}<section>
    <h2>Narratif stratégique <span class="count">snapshot factuel à copier-coller</span></h2>
    <p class="muted" style="font-size:.85rem">Paragraphe factuel généré depuis les données dashboard — top priorité / risque majeur / vélocité / santé / AI Act. Prêt à coller dans une PR, un email exec ou un Slack daily.</p>
    <div class="sn-narrative">${html}</div>
    <div class="sn-actions">
      <button type="button" class="sn-btn" id="sn-copy-btn">📋 Copier le narratif</button>
    </div>
    <textarea id="sn-raw-text" hidden readonly>${escape(raw)}</textarea>
    <div class="sn-meta">
      <span class="sn-chip">${meta.intentsActifs} actifs</span>
      ${meta.risquesEleves ? `<span class="sn-chip" style="color:#7a1717">${meta.risquesEleves} risque(s) élevé(s)</span>` : ''}
      ${meta.healthScore != null ? `<span class="sn-chip">santé ${meta.healthScore}/100${meta.healthTrend === 'up' ? ' ↗' : meta.healthTrend === 'down' ? ' ↘' : ''}</span>` : ''}
      ${meta.veloMoyen != null ? `<span class="sn-chip">vélocité ${meta.veloMoyen}/sem</span>` : ''}
    </div>
  </section>${SN_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  genererNarratif as generateNarrative,
  blocStrategicNarrative as strategicNarrativeSection,
};
