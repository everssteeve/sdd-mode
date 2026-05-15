// AIAD SDD Mode — Page "Graphe de connaissances" (D3 force-directed).
//
// Sérialise la matrice de traçabilité en un graphe nœuds/arêtes :
//   - Nœuds : Intent, SPEC, fichier code, fichier test, agent gouvernance
//   - Arêtes : SPEC → Intent (parent_intent), Code → SPEC (@spec),
//              Test → Code (@verified-by), SPEC/Code → Agent (@governance)
//
// **Choix D3 v7** : il n'y a pas de bibliothèque natif Node pour rendre du
// SVG force-directed correctement ; D3 est *de facto* standard et chargé
// depuis un CDN (jsdelivr) côté navigateur. Le dashboard reste **généré**
// 100 % zero-dep côté Node — D3 est exclusivement consommé par le
// navigateur de l'utilisateur. Si le CDN est indisponible, la page
// s'affiche sans graphe (les autres pages restent fonctionnelles).
//
// Documentation : https://aiad.ovh

// ─── Sérialisation pure (testable) ──────────────────────────────────────────

/**
 * Construit le graphe nœuds/arêtes depuis les données du dashboard.
 *
 * @param {object} donnees — collecté par dashboard/collect.js
 * @returns {{ nodes: object[], links: object[] }}
 */
export function serialiserGraphe(donnees) {
  const nodes = [];
  const links = [];
  const seen = new Set();

  function ajouterNoeud(id, type, label, attrs = {}) {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, type, label, ...attrs });
  }

  // Intents
  for (const intent of donnees.intents || []) {
    ajouterNoeud(intent.id, 'intent', intent.title || intent.id, {
      status: intent.status,
      humanAuthorship: (intent.body || '').length >= 50,
    });
  }

  // SPECs + lien parent_intent
  for (const spec of donnees.specs || []) {
    ajouterNoeud(spec.id, 'spec', spec.title || spec.id, {
      status: spec.status,
      governance: spec.governance || [],
    });
    if (spec.parent_intent) {
      // Le parent peut ne pas être présent si Intent orphelin → on ajoute
      // un nœud placeholder pour rendre l'arête connectable.
      if (!seen.has(spec.parent_intent)) {
        ajouterNoeud(spec.parent_intent, 'intent', spec.parent_intent, { orphan: true });
      }
      links.push({ source: spec.id, target: spec.parent_intent, type: 'parent' });
    }
    // Liens vers les agents de gouvernance
    for (const gov of spec.governance || []) {
      ajouterNoeud(gov, 'governance', gov);
      links.push({ source: spec.id, target: gov, type: 'governance' });
    }
  }

  // Fichiers code + tests + leurs liens
  for (const fichier of donnees.codeFiles || []) {
    const id = `code:${fichier.path}`;
    const type = fichier.isTest ? 'test' : 'code';
    ajouterNoeud(id, type, fichier.path, { annotated: fichier.annotated });
    // Liens @spec
    for (const s of fichier.annotations?.specs || []) {
      if (!seen.has(s.id)) {
        ajouterNoeud(s.id, 'spec', s.id, { orphan: true });
      }
      links.push({ source: id, target: s.id, type: 'spec' });
    }
    // Liens @intent
    for (const i of fichier.annotations?.intents || []) {
      if (!seen.has(i.id)) {
        ajouterNoeud(i.id, 'intent', i.id, { orphan: true });
      }
      links.push({ source: id, target: i.id, type: 'intent' });
    }
    // Liens @verified-by (test → code)
    for (const v of fichier.annotations?.verifiedBy || []) {
      const cibleId = `code:${v.path}`;
      // pas d'ajout du noeud cible si absent (pas dans le scan code)
      if (seen.has(cibleId)) {
        links.push({ source: id, target: cibleId, type: 'verified-by' });
      }
    }
    // Liens @governance
    for (const g of fichier.annotations?.governance || []) {
      for (const tag of g.tags || []) {
        ajouterNoeud(tag, 'governance', tag);
        links.push({ source: id, target: tag, type: 'governance' });
      }
    }
  }

  return { nodes, links };
}

/**
 * Calcule des stats agrégées sur le graphe (utile pour la barre de filtres).
 */
export function statsGraphe(graphe) {
  const counts = { intent: 0, spec: 0, code: 0, test: 0, governance: 0 };
  for (const n of graphe.nodes) counts[n.type] = (counts[n.type] || 0) + 1;
  return {
    nodes: graphe.nodes.length,
    links: graphe.links.length,
    counts,
    orphans: graphe.nodes.filter((n) => n.orphan).length,
  };
}

// ─── Rendu HTML (page autonome) ─────────────────────────────────────────────

const COULEURS = {
  intent: '#ec4899',
  spec: '#3b82f6',
  code: '#10b981',
  test: '#f59e0b',
  governance: '#8b5cf6',
};

/**
 * Produit le corps HTML de la page graph.
 * Le layout (header, nav, footer) est ajouté par `layout()` dans render.js.
 *
 * @param {object} donnees
 * @returns {string} HTML body
 */
export function pageGraph(donnees) {
  const graphe = serialiserGraphe(donnees);
  const stats = statsGraphe(graphe);
  const data = JSON.stringify(graphe);

  return `
<section class="graph-section">
  <div class="graph-toolbar">
    <div class="graph-stats">
      <span><strong>${stats.nodes}</strong> nœuds · <strong>${stats.links}</strong> arêtes${stats.orphans ? ` · <strong>${stats.orphans}</strong> orphelin(s)` : ''}</span>
    </div>
    <div class="graph-filters">
      ${Object.entries(stats.counts).map(([type, count]) =>
        `<label class="graph-filter"><input type="checkbox" data-type="${type}" checked> <span class="dot" style="background:${COULEURS[type]}"></span> ${type} (${count})</label>`
      ).join('')}
    </div>
    <div class="graph-search">
      <input type="search" id="graph-search" placeholder="Rechercher un nœud (Cmd+F)">
    </div>
  </div>
  <div id="graph-canvas" style="width:100%;height:600px;border:1px solid var(--border, #ccc);border-radius:8px;background:var(--bg-soft, #fafafa);"></div>
  <div class="graph-legend" style="margin-top:1rem;font-size:0.9em;color:var(--text-muted, #666);">
    <strong>Légende</strong> :
    <span style="color:${COULEURS.intent}">● Intent</span>
    <span style="color:${COULEURS.spec}">● SPEC</span>
    <span style="color:${COULEURS.code}">● Code</span>
    <span style="color:${COULEURS.test}">● Test</span>
    <span style="color:${COULEURS.governance}">● Agent gouvernance</span>
  </div>
</section>
<!-- (#248) D3 CDN sans SRI : le hash sha384 hardcodé devenait obsolète a
     chaque republication mineure jsdelivr -> SRI fail bloquait le rendu.
     Pour re-ajouter SRI : pinner a une version exacte (ex: d3@7.9.0) et
     coller son hash sha384 depuis https://www.srihash.org ou jsdelivr UI.
     La CSP script-src https://cdn.jsdelivr.net (#246) protege la source. -->
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js" crossorigin="anonymous"></script>
<script>
  (function() {
    const data = ${data};
    const COULEURS = ${JSON.stringify(COULEURS)};

    const container = document.getElementById('graph-canvas');
    if (!container) return;
    if (typeof d3 === 'undefined') {
      container.innerHTML = '<p style="padding:2rem;text-align:center;color:#666">D3.js indisponible — vérifie ta connexion ou désactive le bloqueur réseau.</p>';
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select('#graph-canvas').append('svg')
      .attr('width', width)
      .attr('height', height);

    const filtres = new Set(Object.keys(COULEURS));

    function nodesVisibles() {
      return data.nodes.filter((n) => filtres.has(n.type));
    }
    function linksVisibles() {
      const ids = new Set(nodesVisibles().map((n) => n.id));
      return data.links.filter((l) =>
        ids.has(typeof l.source === 'object' ? l.source.id : l.source) &&
        ids.has(typeof l.target === 'object' ? l.target.id : l.target)
      );
    }

    const simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id((d) => d.id).distance(60))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(20));

    let linkSel, nodeSel, labelSel;

    function render() {
      const visN = nodesVisibles();
      const visL = linksVisibles().map((l) => ({ ...l }));

      svg.selectAll('*').remove();

      linkSel = svg.append('g')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.5)
        .selectAll('line')
        .data(visL)
        .join('line')
        .attr('stroke-width', 1.5);

      nodeSel = svg.append('g')
        .selectAll('circle')
        .data(visN)
        .join('circle')
        .attr('r', (d) => d.type === 'intent' || d.type === 'governance' ? 9 : 6)
        .attr('fill', (d) => COULEURS[d.type] || '#999')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .call(d3.drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          }));

      nodeSel.append('title').text((d) => d.id + ' — ' + d.label);

      labelSel = svg.append('g')
        .selectAll('text')
        .data(visN)
        .join('text')
        .attr('font-size', '10px')
        .attr('dx', 8)
        .attr('dy', 3)
        .text((d) => d.id.slice(0, 24));

      simulation.nodes(visN).on('tick', tick);
      simulation.force('link').links(visL);
      simulation.alpha(1).restart();
    }

    function tick() {
      linkSel
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);
      nodeSel.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
      labelSel.attr('x', (d) => d.x).attr('y', (d) => d.y);
    }

    document.querySelectorAll('.graph-filter input').forEach((cb) => {
      cb.addEventListener('change', () => {
        const type = cb.dataset.type;
        if (cb.checked) filtres.add(type); else filtres.delete(type);
        render();
      });
    });

    document.getElementById('graph-search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!nodeSel) return;
      nodeSel.attr('opacity', (d) => !q || d.id.toLowerCase().includes(q) || (d.label || '').toLowerCase().includes(q) ? 1 : 0.15);
    });

    render();
  })();
</script>
`;
}
