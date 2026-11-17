// Tests du design system du dashboard (SPEC-037-1).
//
// @spec SPEC-037-1-dashboard-par-role

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CSS, allegerCss } from '../lib/dashboard/assets.js';
import { CSS_TOKENS } from '../lib/dashboard/design-tokens.js';
import { CSS_COMPONENTS } from '../lib/dashboard/design-components.js';

/** Luminance relative WCAG d'une couleur #rrggbb. */
function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
/** Variables d'un bloc de thème : le 1er `:root {` (clair) ou `[data-theme="dark"] {`. */
function variables(selecteur) {
  const debut = CSS_TOKENS.indexOf(selecteur);
  const bloc = CSS_TOKENS.slice(debut, CSS_TOKENS.indexOf('}', debut));
  return Object.fromEntries([...bloc.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
}

describe('dashboard — design system', () => {
  test('CA-006 — une seule feuille : tokens + composants', () => {
    assert.equal(CSS, allegerCss(CSS_TOKENS + CSS_COMPONENTS));
    assert.ok(CSS.length < (CSS_TOKENS + CSS_COMPONENTS).length * 0.9, 'feuille émise allégée');
    assert.ok(!CSS.includes('/*'), 'commentaires retirés de la feuille émise');
    assert.ok(!/@import|url\(\s*["']?https?:/i.test(CSS), 'aucune ressource externe');
  });

  test('CA-006 — une couleur par responsabilité, en clair et en sombre', () => {
    for (const theme of [':root {', ':root[data-theme="dark"] {']) {
      const v = variables(theme);
      for (const r of ['global', 'pm', 'pe', 'ae', 'qa', 'tl']) assert.ok(v[`--role-${r}`], `${theme} --role-${r}`);
      assert.equal(new Set(['pm', 'pe', 'ae', 'qa', 'tl'].map((r) => v[`--role-${r}`])).size, 5, 'couleurs de rôle distinctes');
    }
    for (const r of ['pm', 'pe', 'ae', 'qa', 'tl']) assert.ok(CSS_TOKENS.includes(`body[data-onglet="${r}"] { --role: var(--role-${r}); }`));
  });

  test('CA-007 — contrastes AA (≥ 4,5:1) des couples texte / fond, dans les deux thèmes', () => {
    for (const theme of [':root {', ':root[data-theme="dark"] {']) {
      const v = variables(theme);
      const couples = [
        ['--fg', '--bg'], ['--fg', '--bg-alt'], ['--fg-muted', '--bg'], ['--fg-muted', '--bg-alt'], ['--fg-muted', '--bg-sunken'],
        ['--ok-fg', '--ok-bg'], ['--warn-fg', '--warn-bg'], ['--bad-fg', '--bad-bg'], ['--info-fg', '--info-bg'], ['--muted-fg', '--muted-bg'],
        ['--accent-strong', '--bg-alt'], ['--accent-fg', '--accent'],
        ['--role-pm', '--bg-alt'], ['--role-pe', '--bg-alt'], ['--role-ae', '--bg-alt'], ['--role-qa', '--bg-alt'], ['--role-tl', '--bg-alt'],
      ];
      for (const [texte, fond] of couples) {
        const c = contraste(v[texte], v[fond]);
        assert.ok(c >= 4.5, `${theme} ${texte} sur ${fond} : ${c.toFixed(2)}:1`);
      }
    }
  });

  test('CA-008 — sélecteurs historiques conservés (les blocs existants ne changent pas de balisage)', () => {
    for (const sel of ['.kpis', '.kpi .value', '.card', '.badge-ok', '.badge-warn', '.badge-bad', '.badge-info', '.badge-muted', '.alertes-list', '.alerte-warn',
      '.dist-bar', '.seg-ok', '.maturite .barre .fill', '.filter input', '.empty', '.actions a', '.split', '.src-link', 'dfn.aiad-term', 'code.id-copyable',
      '.lens-btn.active', 'svg.spark', 'td.rowspan', '.toggle-theme', 'header.page-header', '.row-cluster', 'ul.compact']) {
      assert.ok((CSS_TOKENS + CSS_COMPONENTS).includes(sel), `sélecteur conservé : ${sel}`);
    }
    for (const v of ['--bg-alt', '--fg-muted', '--card-bg', '--bg-soft', '--text-muted', '--code-bg', '--muted', '--accent-fg']) {
      assert.ok(CSS_TOKENS.includes(`${v}:`), `variable conservée : ${v}`);
    }
  });

  test('CA-009 — accessibilité et sobriété : focus visible, mouvement réduit, impression, thème sombre', () => {
    assert.ok(CSS.includes(':focus-visible') && CSS.includes('3px solid'));
    assert.ok(CSS.includes('@media (prefers-reduced-motion: reduce)'));
    assert.ok(CSS.includes('@media print'));
    assert.ok(CSS.includes('@media (prefers-color-scheme: dark)') && CSS.includes(':root[data-theme="dark"]'));
    assert.ok(CSS.includes('.skip-link') && CSS.includes('.visually-hidden'));
  });
});
