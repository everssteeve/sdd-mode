// AIAD SDD Mode — Dashboard : page Onboarding (#141).
//
// Visite guidée par rôle (PM / PE / AE / QA / TL) avec sélecteur en haut
// + glossaire AIAD inline. Le but : un nouveau membre arrive sur le projet
// → il sélectionne son rôle → il voit les 4-5 widgets qui le concernent +
// les concepts AIAD essentiels pour son quotidien.
//
// 100% côté HTML statique (les onglets sont gérés en JS via attribut
// `data-role`). Pas de dépendance, pas de fetch.

import { escape } from './render.js';

// Configuration par rôle : titre, 1-paragraphe d'intro, 4-5 widgets clés
// (label + page cible + une phrase de motivation), glossaire prioritaire.
const ROLES = {
  pm: {
    label: 'Product Manager',
    intro: "Tu portes l'intention. Ton job : valider que ce qui est livré correspond à ce qui était demandé, repérer ce qui dérive et débloquer ton équipe.",
    widgets: [
      { label: 'Section "À valider cette semaine"', page: 'index.html', pourquoi: "Zombies + drafts vieux + SPECs done non démontrées — ta queue PM en un coup d'œil." },
      { label: 'Page Intents', page: 'intents.html', pourquoi: 'Pulse global du POURQUOI capturé. Filtre `status` pour voir les actifs.' },
      { label: 'Page Métriques (DORA + Flow)', page: 'metrics.html', pourquoi: 'Vitesse réelle de livraison + qualité gate, sans BI tiers.' },
      { label: 'Fil "Activité rituelle"', page: 'index.html', pourquoi: 'Standup / Demo / Rétro — narration courte des rituels de la semaine.' },
    ],
    glossaire: ['intent', 'spec', 'sqs', 'gate'],
  },
  pe: {
    label: 'Product Engineer',
    intro: "Tu orchestres l'exécution. Ton job : passer un Intent à une SPEC validée, ouvrir la Gate, lancer l'agent, vérifier la traçabilité.",
    widgets: [
      { label: 'Page SPECs', page: 'specs.html', pourquoi: 'État de chaque SPEC : draft/ready/in-progress/done + score SQS.' },
      { label: 'Page Traçabilité', page: 'traceability.html', pourquoi: 'Matrice machine-vérifiable Intent ↔ SPEC ↔ Code ↔ Tests. Gaps mis en évidence.' },
      { label: 'Page Drifts & Facts', page: 'drifts.html', pourquoi: 'Drifts détectés (code/SPEC désynchronisés) + facts capturés via /sdd fact.' },
      { label: 'Page Graphe', page: 'graph.html', pourquoi: 'Vue D3 force-directed des dépendances Intent/SPEC/Code/Gouvernance.' },
      { label: 'KPI Maturité (index)', page: 'index.html', pourquoi: 'Score 0..5 + plafond. Indique si tu travailles sur de la roche solide.' },
    ],
    glossaire: ['spec', 'sqs', 'gate', 'drift', 'jnsp'],
  },
  ae: {
    label: 'Agent Engineer / Tech',
    intro: "Tu instrumentes les agents. Ton job : déployer du code annoté, contrôler la couverture, garantir la conformité gouvernance.",
    widgets: [
      { label: 'Page Gouvernance Tier 1', page: 'governance.html', pourquoi: 'AI-ACT, RGPD, RGAA, RGESN, CRA — droit de veto. Vérifie la couverture.' },
      { label: 'Page Legal & Compliance', page: 'legal.html', pourquoi: 'AI Act audit, DPIA, SBOM, sovereignty score, packs juridictionnels.' },
      { label: 'Page Métriques · Leadership EU/FR', page: 'metrics.html', pourquoi: 'Human Authorship + Governance Coverage + Trace Completeness, en local.' },
      { label: 'KPI Composants tiers SBOM (index)', page: 'index.html', pourquoi: 'Alerte si > 50 composants tiers — audit recommandé.' },
    ],
    glossaire: ['gouvernance', 'sbom', 'sovereignty', 'tier1'],
  },
  qa: {
    label: 'Quality Assurance',
    intro: "Tu garantis que ce qui passe la Gate est vraiment livré et testé. Ton job : queue actionnable, coverage par SPEC, suivi des régressions.",
    widgets: [
      { label: 'Page Quality Assurance', page: 'qa.html', pourquoi: 'Queue SPECs ready sans test + coverage par SPEC + EARS lint + régressions.' },
      { label: 'Section Coverage par SPEC', page: 'qa.html', pourquoi: 'Si `.aiad/metrics/tests/coverage-summary.json` existe → coverage RÉEL c8/istanbul.' },
      { label: 'Section Régressions détectées', page: 'qa.html', pourquoi: 'Tests pass → fail entre 2 derniers runs (lit `.aiad/metrics/tests/runs.jsonl`).' },
      { label: 'Page Traçabilité', page: 'traceability.html', pourquoi: 'Matrice backward Tests → Code → SPEC. Repérer les tests orphelins.' },
    ],
    glossaire: ['spec', 'verified-by', 'ears', 'sqs'],
  },
  tl: {
    label: 'Tech Lead',
    intro: "Tu prends les décisions techniques structurantes. Ton job : ADRs à jour, drift architecture détecté, dette technique sous contrôle.",
    widgets: [
      { label: 'Page Architecture Decision Records', page: 'adrs.html', pourquoi: 'Tous les ADR extraits de ARCHITECTURE.md + drift code → ADR archivé.' },
      { label: 'Section "Drift Architecture"', page: 'adrs.html', pourquoi: 'Code référençant un ADR absent de ARCHITECTURE.md (archivé sans nettoyage).' },
      { label: 'Page Traçabilité', page: 'traceability.html', pourquoi: 'Gap "code sans @spec" — repérer le code non-annoté.' },
      { label: 'Page Changelog', page: 'changelog.html', pourquoi: 'Historique des évolutions d\'artefacts architecturaux.' },
    ],
    glossaire: ['adr', 'drift', 'tier1'],
  },
};

const GLOSSAIRE = {
  intent: { titre: 'Intent Statement', desc: 'Le POURQUOI capturé avant toute spec. Document `INTENT-NNN.md` qui exprime le besoin, jamais la solution.' },
  spec: { titre: 'SPEC', desc: 'Spécification atomique (1 unité de livrable). Lie un Intent au code via `@spec SPEC-NNN-x` dans le code et `@verified-by` dans les tests.' },
  sqs: { titre: 'SQS (Spec Quality Score)', desc: 'Score 0..5 attribué par la Gate. ≥ 4/5 → la SPEC est prête à être exécutée par l\'agent.' },
  gate: { titre: 'Execution Gate', desc: 'Validation humaine de la SPEC avant exécution. Vérifie SQS + EARS lint + Test de l\'Étranger.' },
  drift: { titre: 'Drift Lock', desc: 'Mécanisme qui détecte une désynchronisation code ↔ SPEC. Hook pre-commit + matrice de traçabilité.' },
  jnsp: { titre: 'JNSP — Je Ne Sais Pas', desc: 'Verdict honnête plutôt qu\'invention. Code spécial 2 dans les CLI AIAD : "décision humaine requise".' },
  gouvernance: { titre: 'Agent de gouvernance Tier 1', desc: 'AI-ACT, RGPD, RGAA, RGESN, CRA. Ont un droit de veto sur le code/SPEC.' },
  sbom: { titre: 'SBOM — Software Bill of Materials', desc: 'Liste de tous les composants tiers (format CycloneDX). Exigé par le Cyber Resilience Act EU.' },
  sovereignty: { titre: 'Score Souveraineté', desc: 'Score composite 0..100 (Bronze→Platinum) qui mesure 5 dimensions : juridictions, agents Tier 1, langue, autorités, hébergement.' },
  tier1: { titre: 'Tier 1', desc: 'Niveau de gouvernance avec droit de veto. AIAD-AI-ACT, AIAD-RGPD, AIAD-RGAA, AIAD-RGESN, AIAD-CRA.' },
  adr: { titre: 'ADR — Architecture Decision Record', desc: 'Décision technique structurante documentée dans ARCHITECTURE.md sous forme `**ADR-NNN** : décision`. Le code peut y référer via `@adr ADR-NNN`.' },
  'verified-by': { titre: '@verified-by', desc: 'Annotation dans un fichier de test qui pointe vers la SPEC qu\'il vérifie. Alimente la matrice backward.' },
  ears: { titre: 'EARS — Easy Approach to Requirements Syntax', desc: 'Format de SPEC strict (WHEN/WHILE/IF/WHERE + sujet + SHALL). Activé via `format: EARS` en frontmatter.' },
};

export function pageOnboarding() {
  const tabs = Object.entries(ROLES).map(([k, r]) =>
    `<button class="onboard-tab" data-role="${k}" style="padding:.5rem 1rem;border:1px solid var(--border);background:transparent;color:inherit;cursor:pointer;border-radius:6px">${escape(r.label)}</button>`
  ).join(' ');

  const panels = Object.entries(ROLES).map(([k, r]) => {
    const widgets = r.widgets.map((w) => `
      <li style="margin-bottom:.75rem">
        <a href="${w.page}"><strong>${escape(w.label)}</strong></a>
        <div class="muted" style="margin-top:.25rem">${escape(w.pourquoi)}</div>
      </li>`).join('');
    const termes = r.glossaire.filter((t) => GLOSSAIRE[t]).map((t) => `
      <details style="margin-bottom:.5rem">
        <summary><strong>${escape(GLOSSAIRE[t].titre)}</strong></summary>
        <p class="muted" style="margin-top:.25rem">${escape(GLOSSAIRE[t].desc)}</p>
      </details>`).join('');
    return `
    <div class="onboard-panel" data-role="${k}" style="display:none">
      <p>${escape(r.intro)}</p>
      <h3>Widgets clés</h3>
      <ul style="list-style:none;padding-left:0">${widgets}</ul>
      <h3>Glossaire utile</h3>
      ${termes}
    </div>`;
  }).join('');

  return `
<section>
  <h2>Onboarding</h2>
  <p class="muted">Nouveau dans le projet ? Sélectionne ton rôle pour voir les widgets et concepts qui te concernent.</p>
  <div class="alerte alerte-info" style="margin:1rem 0;font-size:.9rem">
    <div class="alerte-titre">💡 Tooltips automatiques sur le jargon AIAD</div>
    <div class="alerte-detail">Les termes <dfn class="aiad-term-demo" style="border-bottom:1px dotted var(--accent);cursor:help">soulignés en pointillés</dfn> dans le dashboard (Intent, SPEC, SQS, Gate, EARS, Tier 1…) affichent leur définition au survol. <a href="?notooltips=1">Désactiver pour cette session</a>.</div>
  </div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:1rem 0">${tabs}</div>
  ${panels}
  <p class="muted">Aucune information envoyée vers un serveur — tout est statique, généré localement par <code>aiad-sdd dashboard</code>.</p>
</section>
<script>
  (function () {
    var tabs = document.querySelectorAll('.onboard-tab');
    var panels = document.querySelectorAll('.onboard-panel');
    function activate(role) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-role') === role;
        t.style.background = on ? 'var(--ok-bg)' : 'transparent';
        t.style.color = on ? 'var(--ok-fg)' : 'inherit';
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panels.forEach(function (p) {
        p.style.display = p.getAttribute('data-role') === role ? 'block' : 'none';
      });
      try { localStorage.setItem('aiad-onboard-role', role); } catch (e) {}
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { activate(t.getAttribute('data-role')); });
    });
    var url = new URLSearchParams(window.location.search);
    var fromUrl = url.get('role');
    var stored;
    try { stored = localStorage.getItem('aiad-onboard-role'); } catch (e) { stored = null; }
    activate(fromUrl || stored || 'pm');
  })();
</script>`;
}

export { pageOnboarding as onboardingPage };
