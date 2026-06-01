// Tests #215 — Glossaire AIAD inline tooltips.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { GLOSSAIRE, termesPourBrowser, GLOSSARY, termsForBrowser } from '../lib/dashboard/glossaire.js';
import { APP_JS, CSS } from '../lib/dashboard/assets.js';

test('GLOSSAIRE — contient les termes core AIAD', () => {
  for (const k of ['intent', 'spec', 'sqs', 'gate', 'drift', 'jnsp', 'gouvernance', 'sbom', 'sovereignty', 'adr', 'ears']) {
    assert.ok(GLOSSAIRE[k], `terme ${k} présent`);
    assert.ok(GLOSSAIRE[k].titre, `${k}.titre non-vide`);
    assert.ok(GLOSSAIRE[k].desc, `${k}.desc non-vide`);
    assert.ok(GLOSSAIRE[k].keywords?.length >= 1, `${k}.keywords ≥ 1`);
  }
});

test('termesPourBrowser — flatten + tri DESC par longueur', () => {
  const r = termesPourBrowser();
  assert.ok(r.length >= 13, '≥ 13 keywords total');
  // Premier élément doit être le plus long (ex: "Intent Statement" 16 chars > "DPIA" 4)
  for (let i = 1; i < r.length; i++) {
    assert.ok(r[i - 1].kw.length >= r[i].kw.length, `tri DESC respecté à i=${i}`);
  }
});

test('termesPourBrowser — chaque entrée a kw/titre/desc', () => {
  const r = termesPourBrowser();
  for (const e of r) {
    assert.ok(typeof e.kw === 'string' && e.kw.length > 0);
    assert.ok(typeof e.titre === 'string' && e.titre.length > 0);
    assert.ok(typeof e.desc === 'string' && e.desc.length > 0);
  }
});

test('Alias EN canoniques', () => {
  assert.equal(GLOSSARY, GLOSSAIRE);
  assert.equal(termsForBrowser, termesPourBrowser);
});

// ─── Intégration assets.js ──────────────────────────────────────────────────

test('APP_JS — contient la fonction autoTagGlossaire', () => {
  assert.match(APP_JS, /function autoTagGlossaire\(\)/);
  assert.match(APP_JS, /autoTagGlossaire\(\);.*\/\/ \(#215\)/);
});

test('APP_JS — embarque les termes du glossaire', () => {
  // Le JSON des termes doit être présent dans APP_JS
  assert.match(APP_JS, /AIAD_GLOSSAIRE\s*=/);
  assert.match(APP_JS, /"Intent Statement"/);
  assert.match(APP_JS, /"SQS — Spec Quality Score"/);
});

test('APP_JS — skip tags réservés (CODE, A, DFN, ...)', () => {
  assert.match(APP_JS, /GLOSSAIRE_SKIP\s*=.*['"]CODE['"]/);
  assert.match(APP_JS, /GLOSSAIRE_SKIP\s*=.*['"]A['"]/);
  assert.match(APP_JS, /GLOSSAIRE_SKIP\s*=.*['"]DFN['"]/);
});

test('CSS — règles dfn.aiad-term présentes', () => {
  assert.match(CSS, /dfn\.aiad-term\s*\{/);
  assert.match(CSS, /border-bottom:\s*1px dotted/);
  assert.match(CSS, /cursor:\s*help/);
});

// ─── Test d'intégration via jsdom-like ──────────────────────────────────────

test('APP_JS — supporte opt-out ?notooltips=1', () => {
  // Le pattern doit être présent
  assert.match(APP_JS, /notooltips/);
  assert.match(APP_JS, /aiad-no-tooltips/);
});

test('autoTagGlossaire — wrap 1ère occurrence + skip <code>/<a>/<dfn>', async () => {
  // Mini sandbox : exécute l'extrait JS dans un faux DOM.
  const { JSDOM } = await import('jsdom').catch(() => ({ JSDOM: null }));
  if (!JSDOM) return; // skip si jsdom absent

  const dom = new JSDOM(`<html><body>
    <p>Une SPEC valide nécessite un SQS &gt;= 4. La Drift Lock vérifie.</p>
    <p>Cette SPEC est déjà mentionnée mais pas tag (dédupe).</p>
    <code>SPEC dans code, skip.</code>
    <a href="#">SQS dans lien, skip.</a>
  </body></html>`);
  const { window } = dom;

  // Inject our fonction
  const fnCode = APP_JS.split('function autoTagGlossaire()')[1].split('document.addEventListener')[0];
  // eval dans le scope window
  window.AIAD_GLOSSAIRE = termesPourBrowser();
  window.GLOSSAIRE_TAGS = ['P', 'LI', 'TD', 'SUMMARY', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN'];
  window.GLOSSAIRE_SKIP = ['CODE', 'A', 'DFN', 'INPUT', 'PRE', 'SCRIPT', 'BUTTON', 'SELECT', 'TEXTAREA'];
  // Recompose la fonction puis l'exécute
  window.eval('function autoTagGlossaire()' + fnCode + ' autoTagGlossaire();');

  const dfns = window.document.querySelectorAll('dfn.aiad-term');
  const texts = [...dfns].map((d) => d.textContent);
  assert.ok(texts.includes('SPEC'), 'SPEC wrappé');
  assert.ok(texts.includes('SQS'), 'SQS wrappé');
  // Drift Lock est aussi un terme — taggé
  assert.ok(texts.includes('Drift Lock'));
  // Le 2ème <p> "SPEC mentionnée mais pas tag" ne doit PAS contenir un <dfn>
  // car la 1ère occurrence a déjà été consommée (déduplicage).
  const tousLesSpec = [...window.document.querySelectorAll('dfn.aiad-term')]
    .filter((d) => d.textContent === 'SPEC');
  assert.equal(tousLesSpec.length, 1, '1 seul SPEC tag (dédupe)');
  // <code> et <a> doivent toujours être intacts
  assert.equal(window.document.querySelector('code').textContent, 'SPEC dans code, skip.');
  assert.equal(window.document.querySelector('a').textContent, 'SQS dans lien, skip.');
  // Tooltip présent avec titre + desc
  const specDfn = [...dfns].find((d) => d.textContent === 'SPEC');
  assert.match(specDfn.getAttribute('title') || '', /SPEC.*Spécification atomique/);
});

test('autoTagGlossaire — opt-out via ?notooltips=1 → aucun tag', async () => {
  const { JSDOM } = await import('jsdom').catch(() => ({ JSDOM: null }));
  if (!JSDOM) return;
  const dom = new JSDOM(`<html><body><p>Une SPEC nécessite un SQS &gt;= 4.</p></body></html>`, {
    url: 'http://localhost/qa.html?notooltips=1',
  });
  const { window } = dom;
  // Mock localStorage minimal
  window.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); } };
  window.AIAD_GLOSSAIRE = termesPourBrowser();
  window.GLOSSAIRE_TAGS = ['P', 'LI', 'TD'];
  window.GLOSSAIRE_SKIP = ['CODE', 'A', 'DFN'];
  const fnCode = APP_JS.split('function autoTagGlossaire()')[1].split('document.addEventListener')[0];
  window.eval('function autoTagGlossaire()' + fnCode + ' autoTagGlossaire();');
  const dfns = window.document.querySelectorAll('dfn.aiad-term');
  assert.equal(dfns.length, 0, 'aucun tag quand ?notooltips=1');
  assert.equal(window.localStorage.getItem('aiad-no-tooltips'), '1', 'localStorage mémorise l\'opt-out');
});
