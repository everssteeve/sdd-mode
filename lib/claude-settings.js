// AIAD SDD Mode — Fusion et retrait des hooks AIAD dans `.claude/settings.json`.
//
// Un projet qui adopte SDD Mode a souvent déjà un `.claude/settings.json`
// (permissions, hooks maison). Les garde-fous AIAD doivent y être câblés sans
// toucher aux entrées de l'utilisateur, et pouvoir en être retirés exactement.
//
// Une entrée est « AIAD » si sa commande référence un script de
// `.aiad/hooks/` : c'est le seul marqueur stable, indépendant de la version.
//
// @intent INTENT-039
// @spec SPEC-039-1-installation-fiable
// @verified-by test/claude-settings.test.js
//
// Documentation : https://aiad.ovh

const MARQUEUR = /\.aiad\/hooks\//;

/** Vrai si le handler de hook a été posé par AIAD. */
export function estHookAiad(handler) {
  if (!handler || typeof handler !== 'object') return false;
  const args = Array.isArray(handler.args) ? handler.args.join(' ') : '';
  return MARQUEUR.test(`${handler.command || ''} ${args}`);
}

/**
 * Retire de `settings` tous les hooks AIAD (et le statusLine AIAD), en
 * conservant les entrées de l'utilisateur. Ne modifie pas l'objet reçu.
 *
 * @param {object} settings
 * @returns {object} copie nettoyée
 */
export function retirerHooksAiad(settings) {
  const out = structuredClone(settings || {});
  if (out.statusLine && estHookAiad(out.statusLine)) delete out.statusLine;
  if (!out.hooks || typeof out.hooks !== 'object') return out;
  for (const evenement of Object.keys(out.hooks)) {
    const groupes = Array.isArray(out.hooks[evenement]) ? out.hooks[evenement] : [];
    const gardes = [];
    for (const groupe of groupes) {
      const handlers = Array.isArray(groupe?.hooks) ? groupe.hooks : [];
      const restants = handlers.filter((h) => !estHookAiad(h));
      if (restants.length === handlers.length) { gardes.push(groupe); continue; }
      if (restants.length > 0) gardes.push({ ...groupe, hooks: restants });
    }
    if (gardes.length > 0) out.hooks[evenement] = gardes;
    else delete out.hooks[evenement];
  }
  if (Object.keys(out.hooks).length === 0) delete out.hooks;
  return out;
}

/**
 * Câble dans `cible` tous les hooks AIAD du gabarit `tpl`. Idempotent : les
 * anciennes entrées AIAD sont remplacées, celles de l'utilisateur conservées
 * et placées en premier. Sobriété : dans un fichier existant, seuls les hooks
 * (et le statusLine s'il n'y en a pas) sont ajoutés — aucune autre clé du
 * gabarit n'est imposée aux réglages de l'utilisateur. L'ordre des clés
 * existantes est conservé, pour que l'opération rejouée ne produise aucun diff.
 *
 * @param {object} cible  — settings.json existant (ou {})
 * @param {object} tpl    — gabarit livré
 * @returns {object} settings fusionné
 */
export function fusionnerHooksAiad(cible, tpl) {
  const base = retirerHooksAiad(cible);
  const hooks = { ...(base.hooks || {}) };
  for (const [evenement, groupes] of Object.entries(tpl?.hooks || {})) {
    hooks[evenement] = [...(hooks[evenement] || []), ...structuredClone(groupes)];
  }
  const fusion = { ...base };
  if (Object.keys(hooks).length > 0) fusion.hooks = hooks;
  if (tpl?.statusLine && !fusion.statusLine) fusion.statusLine = structuredClone(tpl.statusLine);

  // Ordre stable : clés d'origine d'abord (dans leur ordre), nouvelles ensuite.
  const ordonner = (obj, ordre) => {
    const out = {};
    for (const k of ordre) if (k in obj) out[k] = obj[k];
    for (const k of Object.keys(obj)) if (!(k in out)) out[k] = obj[k];
    return out;
  };
  const out = ordonner(fusion, Object.keys(cible || {}));
  if (out.hooks) out.hooks = ordonner(out.hooks, Object.keys(cible?.hooks || {}));
  return out;
}

/**
 * Liste les scripts `.aiad/hooks/<nom>` que le gabarit câble — sert à
 * `doctor` pour comparer « attendu » et « réellement câblé ».
 *
 * @param {object} settings
 * @returns {string[]} noms de scripts (ex. `veto.js`), triés, sans doublon
 */
export function scriptsHooksCables(settings) {
  const noms = new Set();
  const lire = (h) => {
    if (!estHookAiad(h)) return;
    const texte = `${h.command || ''} ${Array.isArray(h.args) ? h.args.join(' ') : ''}`;
    const m = texte.match(/\.aiad\/hooks\/([\w.-]+)/);
    if (m) noms.add(m[1]);
  };
  if (settings?.statusLine) lire(settings.statusLine);
  for (const groupes of Object.values(settings?.hooks || {})) {
    for (const groupe of Array.isArray(groupes) ? groupes : []) {
      for (const h of Array.isArray(groupe?.hooks) ? groupe.hooks : []) lire(h);
    }
  }
  return [...noms].sort();
}

export {
  estHookAiad as isAiadHook,
  retirerHooksAiad as removeAiadHooks,
  fusionnerHooksAiad as mergeAiadHooks,
  scriptsHooksCables as wiredHookScripts,
};
