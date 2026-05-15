import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { bonjour } from '../src/index.js';

test('bonjour — défaut "AIAD"', () => {
  assert.equal(bonjour(), 'Bonjour, AIAD.');
});

test('bonjour — accepte un nom personnalisé', () => {
  assert.equal(bonjour('Steeve'), 'Bonjour, Steeve.');
});
