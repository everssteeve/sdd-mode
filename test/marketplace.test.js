// Tests `lib/marketplace.js` — catalogue packs verticaux premium.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  chargerCatalogue, listerPacksPremium, trouverPack, rendrePackMarkdown,
  // alias EN
  loadCatalogue, listPremiumPacks, findPack, renderPackMarkdown,
} from '../lib/marketplace.js';

// ─── chargerCatalogue ──────────────────────────────────────────────────────

test('chargerCatalogue — JSON valide chargé avec ≥ 4 packs', () => {
  const c = chargerCatalogue();
  assert.ok(c.packs.length >= 4, `attendu ≥ 4 packs, vu ${c.packs.length}`);
  assert.ok(c.version >= 1);
  assert.match(c.updated, /\d{4}-\d{2}-\d{2}/);
});

test('chargerCatalogue — chaque pack a id + title + secteur + juridiction', () => {
  const { packs } = chargerCatalogue();
  for (const p of packs) {
    assert.ok(typeof p.id === 'string' && p.id.length > 0, 'id absent');
    assert.ok(p.title);
    assert.ok(p.secteur);
    assert.ok(p.juridiction);
  }
});

test('chargerCatalogue — IDs uniques', () => {
  const { packs } = chargerCatalogue();
  const ids = packs.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'IDs dupliqués');
});

// ─── listerPacksPremium ────────────────────────────────────────────────────

test('listerPacksPremium — sans filtre → tous les packs', () => {
  const all = listerPacksPremium();
  assert.equal(all.length, chargerCatalogue().packs.length);
});

test('listerPacksPremium — tri par secteur via localeCompare', () => {
  const all = listerPacksPremium();
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1].secteur || '';
    const b = all[i].secteur || '';
    assert.ok(a.localeCompare(b) <= 0, `non trié : ${a} > ${b}`);
  }
});

test('listerPacksPremium — filtre par secteur', () => {
  const sante = listerPacksPremium({ secteur: 'santé' });
  assert.ok(sante.every((p) => p.secteur.toLowerCase().includes('santé')));
});

test('listerPacksPremium — filtre par juridiction', () => {
  const eu = listerPacksPremium({ juridiction: 'européenne' });
  assert.ok(eu.length > 0);
  assert.ok(eu.every((p) => p.juridiction.toLowerCase().includes('européenne')));
});

test('listerPacksPremium — filtre vide si aucun match', () => {
  assert.deepEqual(listerPacksPremium({ secteur: 'inexistant-xyz' }), []);
});

// ─── trouverPack ───────────────────────────────────────────────────────────

test('trouverPack — IDs des 4 verticaux livrés', () => {
  for (const id of ['eu-health', 'automotive', 'aerospace', 'industrial']) {
    const p = trouverPack(id);
    assert.ok(p, `pack ${id} introuvable`);
    assert.equal(p.id, id);
  }
});

test('trouverPack — id inconnu → null', () => {
  assert.equal(trouverPack('inexistant-pack'), null);
});

// ─── Pack content checks (4 verticaux) ─────────────────────────────────────

test('pack eu-health — couverture HDS + ISO 27799 + MDR + IVDR', () => {
  const p = trouverPack('eu-health');
  const cov = p.couverture.join(' ');
  assert.match(cov, /HDS/);
  assert.match(cov, /ISO\/IEC 27799|ISO 27799/);
  assert.match(cov, /MDR|2017\/745/);
  assert.match(cov, /IVDR|2017\/746/);
});

test('pack automotive — couverture TISAX + UN R155 + ISO 21434 + ISO 26262', () => {
  const p = trouverPack('automotive');
  const cov = p.couverture.join(' ');
  assert.match(cov, /TISAX/);
  assert.match(cov, /UN R155/);
  assert.match(cov, /ISO\/SAE 21434|ISO 21434/);
  assert.match(cov, /ISO 26262/);
});

test('pack aerospace — couverture DO-178C + DO-326A + ED-203A + ARP-4754A', () => {
  const p = trouverPack('aerospace');
  const cov = p.couverture.join(' ');
  assert.match(cov, /DO-178C|ED-12C/);
  assert.match(cov, /DO-326A|ED-202A/);
  assert.match(cov, /ED-203A/);
  assert.match(cov, /ARP-4754A/);
});

test('pack industrial — couverture IEC 62443 + NIS2 + Machinery Regulation', () => {
  const p = trouverPack('industrial');
  const cov = p.couverture.join(' ');
  assert.match(cov, /IEC 62443/);
  assert.match(cov, /NIS2|2022\/2555/);
  assert.match(cov, /Machinery|2023\/1230/);
});

test('chaque pack — fournisseur avec contact + URL aiad.ovh', () => {
  for (const p of listerPacksPremium()) {
    assert.ok(p.fournisseur, `${p.id} : fournisseur absent`);
    assert.ok(p.fournisseur.contact);
    assert.match(p.fournisseur.url, /aiad\.ovh\/marketplace/);
  }
});

test('chaque pack — modèle "premium" et prix indicatif (sauf devis)', () => {
  for (const p of listerPacksPremium()) {
    assert.equal(p.modele, 'premium', `${p.id} : modèle != premium`);
    assert.ok(p.prix_indicatif_eur, `${p.id} : prix manquant`);
  }
});

test('chaque pack — format_distribution mentionne SHA-256 (cohérence #46)', () => {
  for (const p of listerPacksPremium()) {
    assert.match(p.format_distribution || '', /SHA-256/);
  }
});

// ─── rendrePackMarkdown ────────────────────────────────────────────────────

test('rendrePackMarkdown — produit un Markdown structuré', () => {
  const p = trouverPack('eu-health');
  const md = rendrePackMarkdown(p);
  assert.match(md, /^## Santé EU/);
  assert.match(md, /\*\*Secteur\*\*/);
  assert.match(md, /\*\*Couverture réglementaire\*\*/);
  assert.match(md, /\*\*Agents Tier 1 fournis\*\*/);
  assert.match(md, /AIAD-HDS/);
  assert.match(md, /\*\*Fournisseur\*\*/);
});

test('rendrePackMarkdown — pack minimal sans agents/essai gratuit', () => {
  const md = rendrePackMarkdown({
    id: 'min', title: 'Min Pack', secteur: 'X', juridiction: 'Y', modele: 'free',
  });
  assert.match(md, /^## Min Pack/);
  assert.ok(!md.includes('Agents Tier 1 fournis'), 'agents inclus malgré absence');
});

// ─── alias EN ───────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(loadCatalogue, chargerCatalogue);
  assert.equal(listPremiumPacks, listerPacksPremium);
  assert.equal(findPack, trouverPack);
  assert.equal(renderPackMarkdown, rendrePackMarkdown);
});
