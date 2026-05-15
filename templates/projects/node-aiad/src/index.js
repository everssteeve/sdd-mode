// @intent INTENT-001
// @spec SPEC-001-1-bootstrap
// @verified-by test/index.test.js

/**
 * Point d'entrée du projet — squelette livré par `aiad-sdd new node-aiad`.
 * Remplace ce fichier par la vraie logique applicative.
 */
export function bonjour(nom = 'AIAD') {
  return `Bonjour, ${nom}.`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(bonjour(process.argv[2]));
}
