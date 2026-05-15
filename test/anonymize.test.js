// Tests `lib/anonymize.js` — helpers RGPD réutilisables (item #118).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  hashPii, hashIban, hashEmail, hashPhone,
  generaliserAge, generaliserCodePostal,
  supprimerChamps, kAnonymity, filtrerKAnonymity,
  bruitLaplace, appliquerLaplace, anonymiserBatch,
  CONSTANTS,
  // alias EN
  hashPiiValue, hashIbanValue, hashEmailValue, hashPhoneValue,
  generalizeAge, generalizePostalCode, suppressFields,
  kAnonymityCheck, filterKAnonymity, laplaceNoise, applyLaplace, anonymizeBatch,
} from '../lib/anonymize.js';

// ─── hashPii ───────────────────────────────────────────────────────────────

test('hashPii — préfixe + 64 hex', () => {
  const r = hashPii('alice@example.com');
  assert.match(r, /^pii_sha256:[0-9a-f]{64}$/);
});

test('hashPii — déterministe pour même valeur', () => {
  assert.equal(hashPii('foo'), hashPii('foo'));
});

test('hashPii — salt change le hash', () => {
  const a = hashPii('foo');
  const b = hashPii('foo', 'salt-1');
  const c = hashPii('foo', 'salt-2');
  assert.notEqual(a, b);
  assert.notEqual(b, c);
});

test('hashPii — null/vide → null', () => {
  assert.equal(hashPii(null), null);
  assert.equal(hashPii(''), null);
  assert.equal(hashPii('   '), null);
  assert.equal(hashPii(undefined), null);
});

test('hashPii — trim systématique', () => {
  assert.equal(hashPii('foo'), hashPii('  foo  '));
});

// ─── hashIban ──────────────────────────────────────────────────────────────

test('hashIban — normalise espaces et casse', () => {
  const a = hashIban('FR76 3000 6000 0112 3456 7890 189');
  const b = hashIban('fr7630006000011234567890189');
  assert.equal(a, b);
});

test('hashIban — non-string → null', () => {
  assert.equal(hashIban(null), null);
  assert.equal(hashIban(123), null);
});

// ─── hashEmail ─────────────────────────────────────────────────────────────

test('hashEmail — case-insensitive', () => {
  const a = hashEmail('Alice@Example.COM');
  const b = hashEmail('alice@example.com');
  assert.equal(a, b);
});

// ─── hashPhone ─────────────────────────────────────────────────────────────

test('hashPhone — ignore séparateurs', () => {
  const a = hashPhone('+33 6 12 34 56 78');
  const b = hashPhone('33612345678');
  assert.equal(a, b);
});

test('hashPhone — < 6 chiffres → null', () => {
  assert.equal(hashPhone('123'), null);
  assert.equal(hashPhone(''), null);
});

// ─── generaliserAge ────────────────────────────────────────────────────────

test('generaliserAge — bins 10 ans', () => {
  assert.equal(generaliserAge(0), '0-9');
  assert.equal(generaliserAge(7), '0-9');
  assert.equal(generaliserAge(25), '20-29');
  assert.equal(generaliserAge(34), '30-39');
  assert.equal(generaliserAge(89), '80-89');
});

test('generaliserAge — 90+ regroupé', () => {
  assert.equal(generaliserAge(90), '90+');
  assert.equal(generaliserAge(120), '90+');
});

test('generaliserAge — invalide → null', () => {
  assert.equal(generaliserAge(null), null);
  assert.equal(generaliserAge(-1), null);
  assert.equal(generaliserAge(NaN), null);
  assert.equal(generaliserAge('25'), null);
});

// ─── generaliserCodePostal ─────────────────────────────────────────────────

test('generaliserCodePostal — niveau 2 (ville)', () => {
  assert.equal(generaliserCodePostal('75001', 2), '750XX');
  assert.equal(generaliserCodePostal('44000', 2), '440XX');
});

test('generaliserCodePostal — niveau 1 (département)', () => {
  assert.equal(generaliserCodePostal('75001', 1), '75XXX');
});

test('generaliserCodePostal — niveau 3 (4 chars)', () => {
  assert.equal(generaliserCodePostal('75001', 3), '7500X');
});

test('generaliserCodePostal — espace toléré', () => {
  assert.equal(generaliserCodePostal('75 001', 2), '750XX');
});

test('generaliserCodePostal — format invalide → null', () => {
  assert.equal(generaliserCodePostal('abc'), null);
  assert.equal(generaliserCodePostal(null), null);
  assert.equal(generaliserCodePostal('123'), null);
});

// ─── supprimerChamps ──────────────────────────────────────────────────────

test('supprimerChamps — retire les champs spécifiés', () => {
  const r = supprimerChamps({ name: 'Alice', email: 'a@b.c', age: 25 }, ['email']);
  assert.deepEqual(r, { name: 'Alice', age: 25 });
});

test('supprimerChamps — record non-objet → renvoie tel quel', () => {
  assert.equal(supprimerChamps(null, ['x']), null);
});

test('supprimerChamps — ne mute pas l\'original', () => {
  const orig = { a: 1, b: 2 };
  supprimerChamps(orig, ['a']);
  assert.deepEqual(orig, { a: 1, b: 2 });
});

// ─── kAnonymity ──────────────────────────────────────────────────────────

test('kAnonymity — k=2 sur jeu uniforme → tout conforme', () => {
  const records = [
    { age: '30-39', cp: '750XX', sexe: 'M' },
    { age: '30-39', cp: '750XX', sexe: 'M' },
    { age: '30-39', cp: '750XX', sexe: 'F' },
    { age: '30-39', cp: '750XX', sexe: 'F' },
  ];
  const r = kAnonymity(records, 2, ['age', 'cp', 'sexe']);
  assert.equal(r.conforme, true);
  assert.equal(r.isoles.length, 0);
});

test('kAnonymity — détecte un isolé', () => {
  const records = [
    { age: '30-39', cp: '750XX' },
    { age: '30-39', cp: '750XX' },
    { age: '40-49', cp: '440XX' },  // isolé
  ];
  const r = kAnonymity(records, 2, ['age', 'cp']);
  assert.equal(r.conforme, false);
  assert.equal(r.isoles.length, 1);
  assert.equal(r.isoles[0].cp, '440XX');
});

test('kAnonymity — k invalide → throw', () => {
  assert.throws(() => kAnonymity([], 0, ['x']), /k doit être/);
  assert.throws(() => kAnonymity([], 'a', ['x']), /k doit être/);
});

test('kAnonymity — quasiIds vide → throw', () => {
  assert.throws(() => kAnonymity([], 5, []), /quasiIds/);
});

test('filtrerKAnonymity — élimine les isolés', () => {
  const records = [
    { age: '30-39', cp: '750XX' },
    { age: '30-39', cp: '750XX' },
    { age: '40-49', cp: '440XX' },
  ];
  const r = filtrerKAnonymity(records, 2, ['age', 'cp']);
  assert.equal(r.length, 2);
});

// ─── bruitLaplace ─────────────────────────────────────────────────────────

test('bruitLaplace — epsilon invalide → throw', () => {
  assert.throws(() => bruitLaplace(0), /epsilon/);
  assert.throws(() => bruitLaplace(-1), /epsilon/);
  assert.throws(() => bruitLaplace('a'), /epsilon/);
});

test('bruitLaplace — sensitivite invalide → throw', () => {
  assert.throws(() => bruitLaplace(1, 0), /sensitivite/);
  assert.throws(() => bruitLaplace(1, -1), /sensitivite/);
});

test('bruitLaplace — produit un nombre fini', () => {
  for (let i = 0; i < 50; i++) {
    const n = bruitLaplace(1.0, 1);
    assert.ok(Number.isFinite(n), `bruit ${n} non fini`);
  }
});

test('bruitLaplace — epsilon plus petit → variance plus grande (moyenne sur N)', () => {
  // Test statistique : avec ε=0.1, |bruit| est en moyenne plus grand
  // qu'avec ε=10. On vérifie sur 1000 échantillons.
  let sumLow = 0, sumHigh = 0;
  for (let i = 0; i < 1000; i++) {
    sumLow += Math.abs(bruitLaplace(0.1));
    sumHigh += Math.abs(bruitLaplace(10));
  }
  assert.ok(sumLow > sumHigh * 5, `low=${sumLow} doit être >> high=${sumHigh}`);
});

test('appliquerLaplace — ajoute le bruit à la valeur', () => {
  const original = 100;
  const bruite = appliquerLaplace(original, 1.0);
  // Le bruit peut être positif ou négatif, mais valeur est un nombre fini
  assert.ok(Number.isFinite(bruite));
  // Sur ε=1 et sensitivité=1, le bruit est rarement > 10 (mais peut l'être)
});

test('appliquerLaplace — valeur non-numérique → throw', () => {
  assert.throws(() => appliquerLaplace('100', 1), /valeur/);
});

// ─── anonymiserBatch ──────────────────────────────────────────────────────

test('anonymiserBatch — hash + suppression + généralisation', () => {
  const records = [
    { email: 'Alice@x.com', age: 35, cp: '75001', secret: 'ssn' },
    { email: 'bob@x.com', age: 67, cp: '44000', secret: 'ssn' },
  ];
  const { records: out } = anonymiserBatch(records, {
    hashChamps: [{ champ: 'email', type: 'email' }],
    supprimerChamps: ['secret'],
    generaliser: [
      { champ: 'age', type: 'age' },
      { champ: 'cp', type: 'cp', niveau: 2 },
    ],
    salt: 's',
  });
  assert.match(out[0].email, /^pii_sha256:/);
  assert.equal(out[0].age, '30-39');
  assert.equal(out[0].cp, '750XX');
  assert.equal(out[0].secret, undefined);
});

test('anonymiserBatch — k-anonymity strict retire les isolés', () => {
  const records = [
    { age: 30, cp: '75001' },
    { age: 30, cp: '75001' },
    { age: 70, cp: '44000' },  // isolé après généralisation
  ];
  const { records: out, rapport } = anonymiserBatch(records, {
    generaliser: [{ champ: 'age', type: 'age' }, { champ: 'cp', type: 'cp' }],
    kAnonymity: { k: 2, quasiIds: ['age', 'cp'], strict: true },
  });
  assert.equal(out.length, 2);
  assert.equal(rapport.isoles, 1);
  assert.equal(rapport.conforme, false);
});

test('anonymiserBatch — k-anonymity sans strict garde tous les records', () => {
  const records = [
    { age: 30, cp: '75001' },
    { age: 30, cp: '75001' },
    { age: 70, cp: '44000' },
  ];
  const { records: out, rapport } = anonymiserBatch(records, {
    generaliser: [{ champ: 'age', type: 'age' }, { champ: 'cp', type: 'cp' }],
    kAnonymity: { k: 2, quasiIds: ['age', 'cp'] },
  });
  assert.equal(out.length, 3);
  assert.equal(rapport.isoles, 1);
});

test('anonymiserBatch — input non-tableau → throw', () => {
  assert.throws(() => anonymiserBatch('pas-un-tableau'), /tableau/);
});

test('anonymiserBatch — record vide géré', () => {
  const { records: out } = anonymiserBatch([{}], {
    hashChamps: [{ champ: 'email', type: 'email' }],
  });
  assert.deepEqual(out, [{}]);
});

// ─── Cohérence : pseudonymisation préserve les jointures ──────────────────

test('cohérence — même valeur + même salt → même hash (inter-records)', () => {
  const r1 = { email: 'alice@x.com', achat: 1 };
  const r2 = { email: 'Alice@X.COM', achat: 2 };
  const { records: out } = anonymiserBatch([r1, r2], {
    hashChamps: [{ champ: 'email', type: 'email' }],
    salt: 'shared',
  });
  assert.equal(out[0].email, out[1].email);
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(hashPiiValue, hashPii);
  assert.equal(hashIbanValue, hashIban);
  assert.equal(hashEmailValue, hashEmail);
  assert.equal(hashPhoneValue, hashPhone);
  assert.equal(generalizeAge, generaliserAge);
  assert.equal(generalizePostalCode, generaliserCodePostal);
  assert.equal(suppressFields, supprimerChamps);
  assert.equal(kAnonymityCheck, kAnonymity);
  assert.equal(filterKAnonymity, filtrerKAnonymity);
  assert.equal(laplaceNoise, bruitLaplace);
  assert.equal(applyLaplace, appliquerLaplace);
  assert.equal(anonymizeBatch, anonymiserBatch);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.PREFIX_HASH, 'pii_sha256:');
});
