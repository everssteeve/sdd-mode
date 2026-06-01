// AIAD SDD Mode — Dashboard : web manifest PWA (#241).
//
// Permet d'installer le dashboard comme PWA sur Chrome/Edge desktop et
// surtout sur mobile (iOS Safari "Add to Home Screen" + Android). Utile
// pour rituel standup où les membres consultent le dashboard depuis leur
// téléphone (PM/AE/exec sponsors).
//
// Spec : https://developer.mozilla.org/fr/docs/Web/Manifest

// Construit le webmanifest JSON.
// donnees.projet.nom         → name + short_name
// donnees.publicUrl (#240)   → start_url absolu si défini
export function genererManifest(donnees) {
  const projet = donnees?.projet || {};
  const nom = projet.nom || 'AIAD SDD';
  const short = nom.length > 12 ? nom.slice(0, 12) : nom;
  const startUrl = donnees?.publicUrl ? `${donnees.publicUrl.replace(/\/+$/, '')}/index.html` : './index.html';

  return {
    name: `${nom} — AIAD SDD Dashboard`,
    short_name: short,
    description: `Dashboard SDD Mode pour ${nom} — santé, maturité, gouvernance, rituels.`,
    start_url: startUrl,
    scope: './',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f7f8fa',
    theme_color: '#2563eb',
    lang: 'fr',
    categories: ['productivity', 'business', 'developer-tools'],
    icons: [
      {
        src: 'favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}

// Sérialise le manifest avec 2-space indent (debuggable).
export function manifestJson(donnees) {
  return JSON.stringify(genererManifest(donnees), null, 2);
}

export {
  genererManifest as generateManifest,
  manifestJson as manifestJsonString,
};
