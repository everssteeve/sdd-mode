// AIAD SDD Mode — Dashboard : wizard de capture d'Intent (#448).
//
// Le PM ne peut pas créer un Intent depuis le HTML statique (pas de
// backend), mais on peut générer un formulaire qui (a) collecte les 5
// sections canoniques (POURQUOI MAINTENANT / POUR QUI / OBJECTIF /
// CONTRAINTES / CRITÈRE DE DRIFT) plus quelques metadata, (b) construit
// dynamiquement un fichier Markdown frontmatter + body, (c) génère la
// commande shell prête à copier qui crée le fichier via `cat > ... <<EOF`.
//
// Bilan : 1 minute pour capturer un Intent depuis le dashboard sans
// quitter le navigateur — résultat collable directement dans le terminal.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { escape } from './render.js';

const CAPTURE_CSS = `<style>
.qc-form { display:grid; gap:.55rem; margin:.5rem 0; }
.qc-field { display:flex; flex-direction:column; gap:.2rem; }
.qc-field label { font-size:.78rem; font-weight:600; color:var(--muted, #777); text-transform:uppercase; letter-spacing:.03em; }
.qc-field input, .qc-field textarea, .qc-field select {
  font-family: inherit; font-size:.88rem; padding:.35rem .5rem;
  border:1px solid var(--border, #ccc); border-radius:.25rem;
  background:var(--card-bg, #fff); color:inherit;
}
.qc-field textarea { min-height: 60px; resize:vertical; }
.qc-grid-2 { display:grid; grid-template-columns: 1fr 1fr; gap:.5rem; }
@media (max-width: 720px) { .qc-grid-2 { grid-template-columns: 1fr; } }
.qc-out { margin-top:.5rem; padding:.5rem .65rem; background:rgba(127,127,127,.06); border-radius:.3rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.75rem; line-height:1.4; user-select:all; white-space:pre-wrap; max-height: 320px; overflow:auto; border:1px solid var(--border, #ddd); }
.qc-cli { background:#0c0c0c; color:#d5d5d5; }
.qc-actions { display:flex; gap:.4rem; flex-wrap:wrap; margin:.5rem 0; }
.qc-btn { padding:.35rem .7rem; background:var(--accent, #4c6ef5); color:var(--accent-fg, #fff); border-radius:.25rem; border:0; cursor:pointer; font-size:.85rem; font-weight:500; }
.qc-btn:hover { filter:brightness(1.1); }
.qc-btn.secondary { background:transparent; color:inherit; border:1px solid var(--border, #ccc); }
.qc-tabs { display:flex; gap:.3rem; margin:.4rem 0; }
.qc-tab { padding:.3rem .6rem; background:transparent; border:1px solid var(--border, #ccc); border-radius:.25rem; cursor:pointer; font-size:.78rem; }
.qc-tab[aria-selected="true"] { background:var(--accent, #4c6ef5); color:var(--accent-fg, #fff); border-color:var(--accent, #4c6ef5); }
</style>`;

const CAPTURE_SCRIPT = `<script>
(function () {
  function init() {
    var form = document.getElementById('qc-form');
    if (!form) return;
    var outMd = document.getElementById('qc-out-md');
    var outCli = document.getElementById('qc-out-cli');
    function readVal(name) {
      var el = form.elements[name];
      if (!el) return '';
      return (el.value || '').trim();
    }
    function slugify(s) {
      return String(s || '').toLowerCase()
        .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
    }
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function isoDate() {
      var d = new Date();
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function update() {
      var id = readVal('id') || 'INTENT-XXX';
      var slug = slugify(readVal('titre')) || 'intent-rapide';
      var path = '.aiad/intents/' + id + '-' + slug + '.md';
      var auteur = readVal('auteur') || '[Auteur]';
      var priorite = readVal('priorite');
      var owner = readVal('owner');
      var target = readVal('target');
      var statut = readVal('statut') || 'draft';
      var fm = ['---'];
      fm.push('id: ' + id);
      if (readVal('titre')) fm.push('title: ' + readVal('titre'));
      fm.push('status: ' + statut);
      fm.push('author: ' + auteur);
      fm.push('date: ' + isoDate());
      if (priorite) fm.push('priority: ' + priorite);
      if (owner) fm.push('owner: ' + owner);
      if (target) fm.push('target: ' + target);
      fm.push('---');
      var body = ['', '# ' + id + (readVal('titre') ? ' — ' + readVal('titre') : ''), ''];
      body.push('**Auteur** : ' + auteur);
      body.push('**Date** : ' + isoDate());
      body.push('**Statut** : ' + statut);
      body.push('', '---', '');
      body.push('## POURQUOI MAINTENANT', '', readVal('pourquoi') || '[Quel événement / constat déclenche ce besoin aujourd\\'hui ?]', '');
      body.push('## POUR QUI', '', readVal('pourQui') || '[Quel persona ou segment est impacté ?]', '');
      body.push('## OBJECTIF', '', readVal('objectif') || '[Quel changement mesurable vise-t-on ? ≥ 1 métrique]', '');
      body.push('## CONTRAINTES', '', readVal('contraintes') || '[Quelles limites — temps, budget, technique, réglementaire ?]', '');
      body.push('## CRITÈRE DE DRIFT', '', readVal('drift') || '[Comment saura-t-on que l\\'implémentation a dérivé ?]', '');
      body.push('', '---', '', '## SPECs liées', '', '- [ ] [À créer via /sdd spec]', '');
      var md = fm.join('\\n') + body.join('\\n');
      var cli = "cat > " + path + " <<'AIAD_INTENT_EOF'\\n" + md + "AIAD_INTENT_EOF";
      if (outMd) outMd.textContent = md;
      if (outCli) outCli.textContent = cli;
    }
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', function(e) { e.preventDefault(); update(); });
    update();
    // Tabs
    var tabs = document.querySelectorAll('button.qc-tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
        var target = t.getAttribute('data-tab');
        document.querySelectorAll('[data-tab-panel]').forEach(function (p) {
          p.style.display = p.getAttribute('data-tab-panel') === target ? '' : 'none';
        });
      });
    });
    // Copy buttons
    document.querySelectorAll('button.qc-btn[data-copy-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var el = document.getElementById(btn.getAttribute('data-copy-target'));
        if (!el) return;
        try {
          navigator.clipboard.writeText(el.textContent);
          var prev = btn.textContent;
          btn.textContent = '✓ Copié';
          setTimeout(function () { btn.textContent = prev; }, 1200);
        } catch (e) {
          var sel = window.getSelection();
          var range = document.createRange();
          range.selectNodeContents(el);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

function nextSuggestedId(donnees) {
  const intents = donnees?.intents || [];
  let max = 0;
  for (const i of intents) {
    const m = String(i.id || '').match(/^INTENT-(\d+)/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const n = max + 1;
  return `INTENT-${String(n).padStart(3, '0')}`;
}

export function blocQuickCapture(donnees) {
  const suggestedId = nextSuggestedId(donnees);
  return `${CAPTURE_CSS}<section>
    <h2>Capturer un nouvel Intent <span class="count">wizard offline · pas de backend requis</span></h2>
    <p class="muted" style="font-size:.85rem">Remplis les 5 champs canoniques de l'Intent Statement (POURQUOI / POUR QUI / OBJECTIF / CONTRAINTES / CRITÈRE DE DRIFT). Le wizard génère un fichier Markdown + une commande shell prête à coller dans le terminal — pas besoin d'ouvrir un éditeur.</p>
    <form id="qc-form" autocomplete="off">
      <div class="qc-grid-2">
        <div class="qc-field"><label for="qc-id">ID Intent</label><input id="qc-id" name="id" value="${escape(suggestedId)}" placeholder="INTENT-XXX"/></div>
        <div class="qc-field"><label for="qc-titre">Titre (court)</label><input id="qc-titre" name="titre" placeholder="Améliorer la conversion checkout"/></div>
      </div>
      <div class="qc-grid-2">
        <div class="qc-field"><label for="qc-auteur">Auteur (humain)</label><input id="qc-auteur" name="auteur" placeholder="Steeve"/></div>
        <div class="qc-field"><label for="qc-priorite">Priorité</label>
          <select id="qc-priorite" name="priorite">
            <option value="">—</option>
            <option value="P0">P0 — urgent</option>
            <option value="P1">P1 — important</option>
            <option value="P2">P2 — planifié</option>
            <option value="P3">P3 — backlog</option>
          </select>
        </div>
      </div>
      <div class="qc-grid-2">
        <div class="qc-field"><label for="qc-owner">Owner / PM</label><input id="qc-owner" name="owner" placeholder="alice"/></div>
        <div class="qc-field"><label for="qc-target">Target</label><input id="qc-target" name="target" placeholder="Q3-2026 ou 2026-09-30"/></div>
      </div>
      <div class="qc-field"><label for="qc-statut">Statut initial</label>
        <select id="qc-statut" name="statut">
          <option value="draft" selected>draft (par défaut)</option>
          <option value="active">active (déjà validé)</option>
        </select>
      </div>
      <div class="qc-field"><label for="qc-pourquoi">POURQUOI MAINTENANT</label><textarea id="qc-pourquoi" name="pourquoi" placeholder="Quel événement / constat déclenche ce besoin aujourd'hui ?"></textarea></div>
      <div class="qc-field"><label for="qc-pourQui">POUR QUI</label><textarea id="qc-pourQui" name="pourQui" placeholder="Quel persona ou segment est impacté ?"></textarea></div>
      <div class="qc-field"><label for="qc-objectif">OBJECTIF (avec métrique)</label><textarea id="qc-objectif" name="objectif" placeholder="Quel changement mesurable vise-t-on ? Doit contenir une métrique."></textarea></div>
      <div class="qc-field"><label for="qc-contraintes">CONTRAINTES</label><textarea id="qc-contraintes" name="contraintes" placeholder="Limites temps / budget / technique / réglementaire."></textarea></div>
      <div class="qc-field"><label for="qc-drift">CRITÈRE DE DRIFT</label><textarea id="qc-drift" name="drift" placeholder="Signal observable indiquant que l'implémentation a dérivé."></textarea></div>
      <button type="submit" class="qc-btn">Prévisualiser</button>
    </form>
    <div class="qc-tabs" role="tablist">
      <button type="button" class="qc-tab" data-tab="md" aria-selected="true">Markdown</button>
      <button type="button" class="qc-tab" data-tab="cli" aria-selected="false">Commande shell</button>
    </div>
    <div class="qc-actions">
      <button type="button" class="qc-btn" data-copy-target="qc-out-md">Copier Markdown</button>
      <button type="button" class="qc-btn secondary" data-copy-target="qc-out-cli">Copier commande shell</button>
    </div>
    <pre id="qc-out-md" class="qc-out" data-tab-panel="md" aria-label="Aperçu Markdown"></pre>
    <pre id="qc-out-cli" class="qc-out qc-cli" data-tab-panel="cli" aria-label="Commande shell" style="display:none"></pre>
  </section>${CAPTURE_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  blocQuickCapture as quickCaptureSection,
  nextSuggestedId as suggestNextIntentId,
};
