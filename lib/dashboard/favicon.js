// AIAD SDD Mode — Dashboard : favicon SVG (#237).
//
// Petit SVG 32×32 servi à la racine du dashboard. Supprime le 404 récurrent
// favicon.ico dans la console et apporte un branding visuel discret aux
// onglets navigateur (utile quand plusieurs dashboards sont ouverts).
//
// Design : rond bleu accent (#2563eb, var --accent du CSS), lettre "A"
// blanche centrée. Format SVG → reste net à toute taille (favicon haute
// densité Retina + onglets condensés).

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#2563eb"/>
  <text x="16" y="22" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" text-anchor="middle" fill="#ffffff">A</text>
</svg>
`;
