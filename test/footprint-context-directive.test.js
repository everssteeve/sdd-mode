// Tests — SPEC-021-2-restitution-empreinte-context — Phase 3 (directive /sdd context)
//
// @spec SPEC-021-2-restitution-empreinte-context
// @intent INTENT-021
// @verified-by test/footprint-context-directive.test.js
// @governance AIAD-RGPD

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// CA-006 — La directive /sdd context inclut une étape affichant l'empreinte mesurée
test('footprint-context-directive::context-step — .claude/sdd/context.md contient l\'étape empreinte', () => {
  const content = readFileSync(join(ROOT, '.claude', 'sdd', 'context.md'), 'utf8');
  assert.ok(
    content.includes('footprint') || content.includes('empreinte mesurée'),
    'directive context.md mentionne footprint ou empreinte mesurée'
  );
  assert.ok(
    content.includes('SPEC-021-2') || content.includes('aiad-sdd footprint'),
    'directive context.md référence SPEC-021-2 ou la commande footprint'
  );
});

// CA-006 — L'étape est dans la section Fast path (§6 estimate)
test('footprint-context-directive::context-step-placement — étape présente dans le fast path', () => {
  const content = readFileSync(join(ROOT, '.claude', 'sdd', 'context.md'), 'utf8');
  const fastPathSection = content.split('## 📖 Mode guidé')[0];
  assert.ok(
    fastPathSection.includes('footprint') || fastPathSection.includes('empreinte'),
    'étape empreinte présente dans le fast path'
  );
});
