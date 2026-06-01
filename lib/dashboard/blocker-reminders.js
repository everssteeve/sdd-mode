// AIAD SDD Mode — Dashboard : auto-reminder generator pour blockers (#518).
//
// Génère des **snippets de relance** prêts à copier pour les principaux
// blockers détectés sur le dashboard. Le PM doit pouvoir cliquer
// "copier" sur chaque message et l'envoyer directement à la personne
// concernée (Slack / email / Linear).
//
// Sources signaux :
//   - Intents silencieux > 30j (#489 stakeholderComms)
//   - SPECs bloquées > 14j en review (#507 reviewQueue ou #513 specStuck)
//   - Risques critical/high non-acceptés (#439 risks - #508 acceptedRisks)
//   - Décisions en retard via stagnation hypothèses (#498 hypothesisLifecycle)
//
// Pour chaque blocker, génère un template :
//   "Bonjour {sponsor/owner}, [contexte court] — peux-tu {action demandée} ?"
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

function templateSilent(item) {
  return {
    type: 'sponsor-silent',
    cible: 'sponsor',
    sujet: `Sync sur ${item.id}`,
    corps: `Bonjour ${item.sponsor || '(sponsor)'}, je n'ai pas eu d'occasion d'échanger sur "${item.titre || item.id}" depuis ${item.jours} jours. Statut actuel : ${item.statut}. Pourrais-tu confirmer que la direction reste valide et bloquer 15 min cette semaine pour un point ?`,
    intent: item.id,
  };
}

function templateSpecStuck(spec) {
  return {
    type: 'spec-stuck',
    cible: 'reviewer',
    sujet: `Review en attente : ${spec.id}`,
    corps: `Bonjour, la SPEC ${spec.id} est en statut "${spec.statut}" depuis ${spec.ageJours || '?'} jours${spec.depassement ? ` (dépassement seuil +${spec.depassement}j)` : ''}. Peux-tu prendre 10 min pour la valider ou la remettre en in-progress avec un feedback explicite ?`,
    intent: spec.parentIntent || null,
  };
}

function templateRisqueOuvert(intent, risque) {
  return {
    type: 'risque-ouvert',
    cible: 'owner',
    sujet: `Risque ${risque.niveau} ${intent.id} non-mitigé`,
    corps: `Bonjour ${intent.owner || '(owner)'}, le risque "${(risque.texte || risque.label || 'sans intitulé').slice(0, 80)}" sur ${intent.id} est marqué niveau ${risque.niveau} sans acceptation formalisée ni plan de mitigation. Peux-tu proposer une action ou formaliser l'acceptation dans le frontmatter ?`,
    intent: intent.id,
  };
}

export function calculerBlockerReminders(donnees) {
  const out = [];
  // 1. Sponsors silencieux > 30j (réutilise stakeholderComms #489).
  const stake = donnees?.stakeholderComms?.items || [];
  for (const it of stake) {
    if (it.etat !== 'silencieux' || !it.sponsor) continue;
    out.push(templateSilent(it));
    if (out.length >= 12) break;
  }
  // 2. SPECs stuck (review-queue + spec-stuck — déduplication par id).
  const seenSpecIds = new Set();
  const reviewItems = donnees?.reviewQueue?.items || [];
  const stuckItems = donnees?.specStuck?.items || [];
  for (const spec of [...reviewItems, ...stuckItems]) {
    if (seenSpecIds.has(spec.id)) continue;
    seenSpecIds.add(spec.id);
    if (spec.etat !== 'bloque' && (spec.depassement == null || spec.depassement < 3)) continue;
    out.push(templateSpecStuck(spec));
    if (out.length >= 12) break;
  }
  // 3. Risques critical/high pas dans accepted-risks.
  const acceptedSet = new Set((donnees?.acceptedRisks?.items || []).map((a) => a.id));
  const risks = donnees?.risks?.intents || [];
  const intentMap = new Map((donnees?.intents || []).map((i) => [i.id, i]));
  for (const r of risks) {
    if (r.niveau !== 'critical' && r.niveau !== 'high') continue;
    if (acceptedSet.has(r.id)) continue;
    const intentObj = intentMap.get(r.id) || { id: r.id, titre: r.titre || '' };
    const top = (r.risques || [])[0];
    if (!top) continue;
    out.push(templateRisqueOuvert(intentObj, { niveau: r.niveau, ...top }));
    if (out.length >= 12) break;
  }
  return {
    items: out,
    totaux: {
      total: out.length,
      sponsorSilent: out.filter((x) => x.type === 'sponsor-silent').length,
      specStuck: out.filter((x) => x.type === 'spec-stuck').length,
      risqueOuvert: out.filter((x) => x.type === 'risque-ouvert').length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const BR_CSS = `<style>
.br-card { padding:.55rem .7rem; margin:.4rem 0; border-radius:.4rem; background:rgba(127,127,127,.04); border-left:3px solid var(--accent, #4c6ef5); }
.br-card.t-sponsor-silent { border-left-color:#e8590c; background:rgba(232,89,12,.04); }
.br-card.t-spec-stuck { border-left-color:#4c6ef5; background:rgba(76,110,245,.04); }
.br-card.t-risque-ouvert { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.br-head { display:flex; gap:.4rem; align-items:baseline; font-size:.85rem; flex-wrap:wrap; margin-bottom:.2rem; }
.br-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.br-sujet { font-weight:600; }
.br-corps { font-size:.82rem; padding:.35rem .45rem; margin:.25rem 0; background:rgba(127,127,127,.07); border-radius:.2rem; white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; user-select:all; }
.br-actions { display:flex; gap:.4rem; margin-top:.2rem; }
.br-btn { padding:.2rem .55rem; background:transparent; border:1px solid var(--border, #ccc); border-radius:.2rem; cursor:pointer; font-size:.75rem; color:inherit; }
.br-btn:hover { background:rgba(127,127,127,.06); }
.br-empty { padding:.5rem .7rem; background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.85rem; color:#1c5a2a; }
</style>`;

const BR_SCRIPT = `<script>
(function () {
  function init() {
    document.querySelectorAll('[data-br-action=copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.getAttribute('data-target'));
        if (!target || !navigator.clipboard) return;
        navigator.clipboard.writeText(target.textContent).then(function () {
          var orig = btn.textContent;
          btn.textContent = '✓ Copié';
          setTimeout(function () { btn.textContent = orig; }, 1500);
        });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

const TYPE_LABELS = {
  'sponsor-silent': '📞 Relance sponsor',
  'spec-stuck': '🔍 Relance review SPEC',
  'risque-ouvert': '⚠ Risque non-mitigé',
};

export function blocBlockerReminders(donnees) {
  const r = donnees?.blockerReminders;
  if (!r) return '';
  if (r.items.length === 0) {
    return `${BR_CSS}<section>
      <h2>Relances blockers <span class="count">aucun blocker à relancer</span></h2>
      <div class="br-empty">✓ Aucun blocker prioritaire à relancer : sponsors récents, SPECs review fluides, risques élevés couverts (acceptés ou en mitigation). PM zen.</div>
    </section>`;
  }
  const t = r.totaux;
  const cards = r.items.map((it, idx) => {
    const cleId = `br-msg-${idx}`;
    const intentChip = it.intent ? `<span class="br-tag">${escape(it.intent)}</span>` : '';
    return `<div class="br-card t-${escape(it.type)}">
      <div class="br-head">
        <span class="br-tag">${escape(TYPE_LABELS[it.type] || it.type)}</span>
        <span class="br-sujet">${escape(it.sujet)}</span>
        <span class="br-tag">${escape(it.cible)}</span>
        ${intentChip}
      </div>
      <div class="br-corps" id="${cleId}">${escape(it.corps)}</div>
      <div class="br-actions">
        <button type="button" class="br-btn" data-br-action="copy" data-target="${cleId}">📋 Copier le message</button>
      </div>
    </div>`;
  }).join('');
  return `${BR_CSS}<section>
    <h2>Relances blockers <span class="count">${t.total} message(s) prêt(s) à copier · ${t.sponsorSilent} sponsor · ${t.specStuck} SPEC · ${t.risqueOuvert} risque</span></h2>
    <p class="muted" style="font-size:.85rem">Snippets de relance auto-générés pour les blockers détectés sur le dashboard (sponsors silencieux #489, SPECs bloquées #507/#513, risques élevés non-acceptés #439/#508). Clic "Copier" → presse-papier, prêt à envoyer Slack/email.</p>
    <div>${cards}</div>
  </section>${BR_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  calculerBlockerReminders as computeBlockerReminders,
  blocBlockerReminders as blockerRemindersSection,
};
