// AIAD SDD Mode — Dashboard : collecte de données.
//
// Lecture pure des artefacts SDD pour produire le modèle JSON-sérialisable
// consommé par les rendus de pages. Aucun effet de bord console / FS write.
// Découpé du gros lib/dashboard.js pour rendre la lecture testable seule
// et isoler les helpers de parsing Markdown du code de rendu HTML.
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { construireMatrice } from '../sdd-trace.js';
import { parseFrontmatter } from '../frontmatter.js';
// Cycle d'import contrôlé : leadership-metrics.js importe lireFichier/listerFichiersMd
// depuis ce module ; cet import statique fonctionne car computeLeadershipMetrics
// n'est appelée qu'au runtime (jamais au chargement) — Node ESM résout le cycle.
import { computeLeadershipMetrics, enregistrerSnapshotLeadership, lireHistoireLeadership } from '../leadership-metrics.js';
import { collecterDonneesSupplementaires } from './collect-supplementary.js';

// Lecture frontmatter prioritaire, fallback regex tolérante. Permet aux
// utilisateurs d'adopter le frontmatter YAML standard quand ils le
// souhaitent, sans casser les artefacts existants en format prose.
function lireChampPriorite(contenu, ...alias) {
  const { data, body } = parseFrontmatter(contenu || '');
  for (const a of alias) {
    if (data[a] !== undefined && data[a] !== null) return String(data[a]);
    // Aussi tolérant à la casse pour le frontmatter
    const trouve = Object.keys(data).find((k) => k.toLowerCase() === a.toLowerCase());
    if (trouve && data[trouve] !== null) return String(data[trouve]);
  }
  for (const a of alias) {
    const v = extraireChamp(body, a);
    if (v) return v;
  }
  return null;
}

// ─── Helpers FS / parsing Markdown ──────────────────────────────────────────

export function lireFichier(chemin) {
  try { return readFileSync(chemin, 'utf-8'); } catch { return null; }
}

export function listerFichiersMd(dir, opts = {}) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => opts.includeIndex || !f.startsWith('_'))
    .map((f) => join(dir, f));
}

export function extraireChamp(contenu, nom) {
  if (!contenu) return null;
  // Reconnaît: "Champ : valeur", "**Champ** : valeur", "Champ: valeur"
  const re = new RegExp(`(?:^|\\n)\\s*\\*{0,2}\\s*${nom}\\s*\\*{0,2}\\s*:\\s*([^\\n]+)`, 'i');
  const m = contenu.match(re);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

export function extraireTitre(contenu) {
  if (!contenu) return null;
  const m = contenu.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

// (#230) Extrait le contenu d'une section `## Titre` du corps Markdown,
// jusqu'au prochain `##` (même niveau) ou jusqu'à la fin. Insensible à la
// casse et aux accents normalisés (NFD). Retourne null si non trouvée.
// Tolère les variantes `## **Titre**`, `## Titre :`, espaces multiples.
function normaliserPourMatch(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[*_`:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extraireSection(body, titre) {
  if (!body) return null;
  const cible = normaliserPourMatch(titre);
  const lignes = String(body).split(/\r?\n/);
  let i = 0;
  let debutContenu = -1;
  while (i < lignes.length) {
    const m = lignes[i].match(/^##\s+(.+?)\s*$/);
    if (m) {
      const tete = normaliserPourMatch(m[1]);
      if (tete === cible || tete.startsWith(cible + ' ') || tete.startsWith(cible + ':')) {
        debutContenu = i + 1;
        break;
      }
    }
    i++;
  }
  if (debutContenu < 0) return null;
  let fin = debutContenu;
  while (fin < lignes.length && !/^##\s+/.test(lignes[fin]) && !/^---\s*$/.test(lignes[fin])) {
    fin++;
  }
  const txt = lignes.slice(debutContenu, fin).join('\n').trim();
  // Strip leading HTML comments (`<!-- ... -->`) which are used by templates
  // to add inline hints (`## OBJECTIF  <!-- ≥ 1 métrique mesurable -->`).
  return txt.replace(/<!--[\s\S]*?-->/g, '').trim() || null;
}

// (#230) Parse les 5 sections canoniques d'un Intent Statement.
// Format défini par `templates/.claude/sdd/intent.md` :
//   ## POURQUOI MAINTENANT / ## POUR QUI / ## OBJECTIF /
//   ## CONTRAINTES / ## CRITÈRE DE DRIFT
// Le PM peut ainsi valider un Intent sans ouvrir le .md.
export function extraireSectionsIntent(body) {
  if (!body) return null;
  const sections = {
    pourquoi: extraireSection(body, 'POURQUOI MAINTENANT')
      || extraireSection(body, 'Pourquoi maintenant'),
    pourQui: extraireSection(body, 'POUR QUI')
      || extraireSection(body, 'Pour qui'),
    objectif: extraireSection(body, 'OBJECTIF')
      || extraireSection(body, 'Objectif'),
    contraintes: extraireSection(body, 'CONTRAINTES')
      || extraireSection(body, 'Contraintes'),
    critereDrift: extraireSection(body, 'CRITERE DE DRIFT')
      || extraireSection(body, 'Critère de Drift')
      || extraireSection(body, 'Drift Criterion'),
  };
  // Retourne null si aucune section reconnue → évite d'alourdir data.json
  // avec des objets vides pour les Intents en frontmatter pur ou anciens
  // formats non-canoniques.
  const aDuContenu = Object.values(sections).some((v) => v != null);
  return aDuContenu ? sections : null;
}

// ─── Lecture des artefacts ──────────────────────────────────────────────────

export function lireProjet(racineProjet) {
  const pkg = lireFichier(join(racineProjet, 'package.json'));
  let nom = basename(racineProjet);
  let version = null;
  if (pkg) {
    try {
      const o = JSON.parse(pkg);
      if (o.name) nom = o.name;
      if (o.version) version = o.version;
    } catch { /* ignore */ }
  }
  return {
    nom,
    version,
    racine: racineProjet,
    genere: new Date().toISOString(),
  };
}

const SENTINELLES_FONDAMENTAUX = {
  'PRD.md': '[Titre fonctionnel court]',
  'ARCHITECTURE.md': '[max 5 principes]',
  'AGENT-GUIDE.md': '[Nom du projet]',
};

export function lireFondamentaux(racineProjet) {
  return ['PRD.md', 'ARCHITECTURE.md', 'AGENT-GUIDE.md'].map((nom) => {
    const chemin = join(racineProjet, '.aiad', nom);
    const contenu = lireFichier(chemin);
    const present = contenu !== null;
    const sentinelle = SENTINELLES_FONDAMENTAUX[nom];
    const rempli = present && sentinelle ? !contenu.includes(sentinelle) : present;
    return {
      nom,
      chemin: present ? relative(racineProjet, chemin) : null,
      titre: present ? extraireTitre(contenu) : null,
      present,
      rempli,
      tailleKo: present ? Math.round(Buffer.byteLength(contenu) / 1024 * 10) / 10 : 0,
    };
  });
}

export function lireIntents(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'intents');
  return listerFichiersMd(dir).map((chemin) => {
    const contenu = lireFichier(chemin);
    const m = basename(chemin).match(/^(INTENT-[A-Za-z0-9-]+)\.md$/);
    const { body } = parseFrontmatter(contenu || '');
    let mtime = null;
    try { mtime = statSync(chemin).mtimeMs; } catch { /* fichier disparu */ }
    return {
      id: m ? m[1] : basename(chemin, '.md'),
      file: relative(racineProjet, chemin),
      titre: lireChampPriorite(contenu, 'title', 'titre') || extraireTitre(body) || (m ? m[1] : basename(chemin)),
      statut: (lireChampPriorite(contenu, 'status', 'statut') || 'unknown').toLowerCase(),
      auteur: lireChampPriorite(contenu, 'auteur', 'author'),
      date: lireChampPriorite(contenu, 'date'),
      // (#158) Date de bascule en `active` posée par /sdd intent quand
      // l'humain valide. Source plus juste que le mtime (qui change à
      // chaque édition cosmétique). Si absent → fallback sur mtime côté
      // consommateur (intentsZombies).
      activatedAt: lireChampPriorite(contenu, 'activated_at', 'activatedAt'),
      problem: lireChampPriorite(contenu, 'problem', 'Problème'),
      // (#230) Parse les 5 sections canoniques (POURQUOI / POUR QUI /
      // OBJECTIF / CONTRAINTES / CRITÈRE DE DRIFT) pour permettre au PM
      // de réviser l'Intent depuis le dashboard sans ouvrir le fichier.
      sections: extraireSectionsIntent(body),
      mtime,
    };
  });
}

export function lireSpecs(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'specs');
  const fichiers = listerFichiersMd(dir).filter((c) => !basename(c).startsWith('spec-ears-template'));
  return fichiers.map((chemin) => {
    const contenu = lireFichier(chemin);
    const m = basename(chemin).match(/^(SPEC-[A-Za-z0-9-]+)\.md$/);
    const { body } = parseFrontmatter(contenu || '');
    let mtime = null;
    try { mtime = statSync(chemin).mtimeMs; } catch { /* fichier disparu */ }
    // (#187) `parallel_with: [SPEC-A, SPEC-B]` ou `parallel_with: SPEC-A,SPEC-B`
    // dans le frontmatter → SPECs autorisées à tourner en parallèle de
    // celle-ci. L'absence signale "à valider, peut conflicter".
    const rawPar = lireChampPriorite(contenu, 'parallel_with', 'parallelWith');
    const parallelWith = rawPar
      ? String(rawPar).replace(/^\[|\]$/g, '').split(/[,;]/).map((x) => x.trim()).filter(Boolean)
      : [];
    return {
      id: m ? m[1] : basename(chemin, '.md'),
      file: relative(racineProjet, chemin),
      titre: lireChampPriorite(contenu, 'title', 'titre') || extraireTitre(body) || (m ? m[1] : basename(chemin)),
      parentIntent: lireChampPriorite(contenu, 'parent_intent', 'Intent parent', 'parent'),
      statut: (lireChampPriorite(contenu, 'status', 'Statut') || 'unknown').toLowerCase(),
      format: (lireChampPriorite(contenu, 'format', 'Format') || 'prose').toLowerCase(),
      sqs: lireChampPriorite(contenu, 'sqs', 'SQS'),
      governance: lireChampPriorite(contenu, 'governance', 'gouvernance'),
      parallelWith,
      auteur: lireChampPriorite(contenu, 'auteur', 'Auteur', 'author'),
      date: lireChampPriorite(contenu, 'date', 'Date'),
      mtime,
    };
  });
}

const DECLENCHEURS_GOUVERNANCE = {
  'AIAD-AI-ACT': 'Composant IA (ML, LLM, scoring, recommandation)',
  'AIAD-RGPD': 'Traitement de données personnelles',
  'AIAD-RGAA': "Production d'une interface utilisateur",
  'AIAD-RGESN': 'Toute décision technique (perf, ressources, dépendances)',
  'AIAD-CRA': 'Produit logiciel commercialisable en UE (SBOM, vulnérabilités, mises à jour)',
};

const REFERENTIELS_GOUVERNANCE = {
  'AIAD-AI-ACT': 'Règlement (UE) 2024/1689 — EU AI Act',
  'AIAD-RGPD': 'RGPD (UE) 2016/679',
  'AIAD-RGAA': 'RGAA 4.1 / WCAG 2.1',
  'AIAD-RGESN': 'RGESN v2 — Référentiel Général Écoconception',
  'AIAD-CRA': 'Règlement (UE) 2024/2847 — Cyber Resilience Act',
};

export function lireGouvernance(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'gouvernance');
  const fichiers = listerFichiersMd(dir);
  const attendus = ['AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN', 'AIAD-CRA'];
  const presents = new Set(fichiers.map((c) => basename(c, '.md')));
  return attendus.map((id) => {
    const chemin = join(dir, `${id}.md`);
    const contenu = lireFichier(chemin);
    return {
      id,
      present: presents.has(id),
      titre: extraireTitre(contenu) || id,
      file: presents.has(id) ? relative(racineProjet, chemin) : null,
      tailleKo: contenu ? Math.round(Buffer.byteLength(contenu) / 1024 * 10) / 10 : 0,
      declenche: DECLENCHEURS_GOUVERNANCE[id] || '—',
      referentiel: REFERENTIELS_GOUVERNANCE[id] || '—',
    };
  });
}

export function lireFacts(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'facts');
  if (!existsSync(dir)) return [];
  return listerFichiersMd(dir, { includeIndex: false }).map((chemin) => {
    const contenu = lireFichier(chemin);
    return {
      id: basename(chemin, '.md'),
      file: relative(racineProjet, chemin),
      titre: extraireTitre(contenu) || basename(chemin),
      date: extraireChamp(contenu, 'Date') || extraireChamp(contenu, 'date'),
      gravite: extraireChamp(contenu, 'Gravité') || extraireChamp(contenu, 'severity') || extraireChamp(contenu, 'gravite'),
      statut: (extraireChamp(contenu, 'Statut') || extraireChamp(contenu, 'status') || 'open').toLowerCase(),
      cause: extraireChamp(contenu, 'Cause') || extraireChamp(contenu, 'cause'),
    };
  });
}

export function lireChangelog(racineProjet) {
  const chemin = join(racineProjet, '.aiad', 'CHANGELOG-ARTEFACTS.md');
  const contenu = lireFichier(chemin);
  if (!contenu) return { entrees: [], file: null };
  // Entrées au format : "## [Date] — [Artefact] — [Type]"
  const entrees = [];
  const re = /^##\s+(\d{4}-\d{2}-\d{2})\s*—\s*([^—\n]+?)\s*—\s*([^\n]+)$/gm;
  let m;
  while ((m = re.exec(contenu)) !== null) {
    const start = m.index + m[0].length;
    const reste = contenu.slice(start);
    const m2 = reste.match(/\n##\s+/);
    const fin = m2 ? start + m2.index : contenu.length;
    const corps = contenu.slice(start, fin).trim();
    entrees.push({
      date: m[1],
      artefact: m[2].trim(),
      type: m[3].trim(),
      auteur: extraireChamp(corps, 'Auteur'),
      raison: extraireChamp(corps, 'Raison'),
      impact: extraireChamp(corps, 'Impact'),
    });
  }
  return { entrees, file: relative(racineProjet, chemin) };
}

// ─── Lecture des metrics ─────────────────────────────────────────────────────

export function parserKv(contenu) {
  if (!contenu) return {};
  const out = {};
  const lignes = contenu.split('\n');
  for (const ligne of lignes) {
    const m = ligne.match(/^\s*-?\s*(?:\*\*)?([A-Za-z][\w-]*)(?:\*\*)?\s*:\s*([^\n#]+?)\s*$/);
    if (!m) continue;
    const cle = m[1].trim();
    let val = m[2].trim().replace(/^["']|["']$/g, '');
    if (/^-?\d+(?:\.\d+)?$/.test(val)) val = Number(val);
    if (val === 'true') val = true;
    if (val === 'false') val = false;
    out[cle] = val;
  }
  return out;
}

export function lireMetricsCategorie(racineProjet, categorie) {
  const dir = join(racineProjet, '.aiad', 'metrics', categorie);
  if (!existsSync(dir)) return { categorie, dir: null, fichiers: [] };
  const fichiers = [];
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    let st;
    try { st = statSync(chemin); } catch { continue; }
    if (!st.isFile()) continue;
    if (!/\.(md|yml|yaml|json)$/i.test(nom)) continue;
    if (nom.startsWith('_')) continue;
    const contenu = lireFichier(chemin);
    let data;
    if (nom.endsWith('.json')) {
      try { data = JSON.parse(contenu || '{}'); } catch { data = {}; }
    } else {
      data = parserKv(contenu);
    }
    fichiers.push({
      nom,
      file: relative(racineProjet, chemin),
      mtime: st.mtimeMs,
      data,
    });
  }
  fichiers.sort((a, b) => b.mtime - a.mtime);
  return { categorie, dir: relative(racineProjet, dir), fichiers };
}

function moyenne(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}

const CATS_METRICS = ['deployments', 'specs', 'standup', 'drift', 'retro', 'demo', 'sync-strat', 'tech-review', 'security', 'audit'];

export function lireMetrics(racineProjet) {
  const data = {};
  for (const c of CATS_METRICS) data[c] = lireMetricsCategorie(racineProjet, c);

  const deps = data.deployments.fichiers.map((f) => f.data);
  const specs = data.specs.fichiers.map((f) => f.data);
  const standup = data.standup.fichiers.map((f) => f.data);
  const drift = data.drift.fichiers.map((f) => f.data);

  const cycleTimes = deps.map((d) => Number(d.cycle_time_days)).filter((x) => !isNaN(x));
  const leadTimes = deps.map((d) => Number(d.lead_time_days)).filter((x) => !isNaN(x));
  const sqsScores = specs.map((d) => Number(d.sqs_score)).filter((x) => !isNaN(x));
  const wips = standup.map((d) => Number(d.wip)).filter((x) => !isNaN(x));
  const driftCount = drift.reduce((s, d) => s + (Number(d.drifts_count) || 0), 0);
  const driftRes = drift.reduce((s, d) => s + (Number(d.drifts_corriges) || 0), 0);

  const agregats = {
    deployments: {
      total: deps.length,
      success: deps.filter((d) => d.status === 'success').length,
      hotfix: deps.filter((d) => d.status === 'hotfix').length,
      cycleTimeMoyen: moyenne(cycleTimes),
      leadTimeMoyen: moyenne(leadTimes),
    },
    specs: {
      total: specs.length,
      sqsMoyen: moyenne(sqsScores),
      gateFirstPass: specs.filter((d) => Number(d.attempts) === 1).length,
    },
    standup: {
      total: standup.length,
      wipMoyen: moyenne(wips),
    },
    drift: {
      total: drift.length,
      driftsDetectes: driftCount,
      driftsResolus: driftRes,
    },
  };

  return { categories: data, agregats };
}

// ─── Maturité ────────────────────────────────────────────────────────────────

const NIVEAUX_MATURITE = [
  { label: 'Non initialisé', cls: 'maturite-bad' },
  { label: 'Démarrage', cls: 'maturite-warn' },
  { label: 'Cadrage', cls: 'maturite-warn' },
  { label: 'Opérationnel', cls: 'maturite-info' },
  { label: 'Actif', cls: 'maturite-ok' },
  { label: 'Complet', cls: 'maturite-ok' },
];

// Pondération du score (item backlog #133). Un projet fraîchement initié peut
// avoir PRD/ARCHI/GUIDE/Intent/SPEC rédigés mais aucune métrique de leadership
// définie, aucun repo Git et aucun hook pre-commit installé — afficher 5/5
// "Complet" dans ce cas est trompeur. Règle : 5/5 réservé aux projets ayant
// au minimum 2/3 leadership metrics définies ET git+hooks. Sinon plafond.
export function calculerMaturite(donnees, signaux = {}) {
  const fond = donnees.fondamentaux;
  const score = [
    fond.find((f) => f.nom === 'PRD.md')?.rempli,
    fond.find((f) => f.nom === 'ARCHITECTURE.md')?.rempli,
    fond.find((f) => f.nom === 'AGENT-GUIDE.md')?.rempli,
    donnees.intents.length > 0,
    donnees.specs.length > 0,
  ].filter(Boolean).length;

  const leadership = signaux.leadership;
  const ratios = leadership
    ? [leadership.humanAuthorshipRatio, leadership.governanceCoverage, leadership.traceCompleteness]
        .map((m) => (m && typeof m.ratio === 'number' ? m.ratio : null))
    : null;
  const indefinies = ratios ? ratios.filter((r) => r === null).length : null;
  const gitOk = signaux.git === true;
  const hooksOk = signaux.hooks === true;

  let plafond = 5;
  let raisonPlafond = null;
  if (indefinies !== null && indefinies >= 2) {
    plafond = 3;
    raisonPlafond = `2/3 métriques leadership indéfinies (${indefinies}/3)`;
  } else if (signaux.git !== undefined && signaux.hooks !== undefined && (!gitOk || !hooksOk)) {
    plafond = 4;
    const manque = [!gitOk && 'git', !hooksOk && 'hooks pre-commit'].filter(Boolean).join(' + ');
    raisonPlafond = `Drift Lock incomplet (${manque})`;
  }

  const scoreFinal = Math.min(score, plafond);
  return {
    score: scoreFinal,
    scoreBrut: score,
    total: 5,
    plafond,
    raisonPlafond,
    signaux: { git: gitOk, hooks: hooksOk, indefinies },
    ...NIVEAUX_MATURITE[scoreFinal],
  };
}

// ─── Modèle complet ─────────────────────────────────────────────────────────

/**
 * @typedef {object} Signaux
 * @property {boolean} git    Présence d'un dossier `.git/` à la racine.
 * @property {boolean} hooks  Présence du hook pre-commit AIAD installé.
 * @property {object|null} leadership   Sortie de `computeLeadershipMetrics` ;
 *   null si le calcul a échoué (fail-safe).
 */

/**
 * @typedef {object} Supplementaire
 * @property {object} dpia        — voir `lib/dashboard/collect-supplementary.js`.
 * @property {object} aiAct
 * @property {object} sbom
 * @property {object} sovereignty
 * @property {object} hookStats
 */

// Calcule les signaux (#133/#148). Fail-safe par construction : aucune
// exception ne sort de cette fonction.
/** @returns {Signaux} */
function calculerSignaux(racineProjet) {
  const git = existsSync(join(racineProjet, '.git'));
  const hooks = existsSync(join(racineProjet, '.aiad', 'hooks', 'pre-commit.sh'));
  let leadership = null;
  let leadershipHistory = [];
  try {
    leadership = computeLeadershipMetrics(racineProjet);
    // (#169) Snapshot mensuel idempotent + lecture historique 12 mois.
    // Fail-safe : si l'écriture échoue (FS read-only), on continue avec
    // l'historique disponible.
    try { enregistrerSnapshotLeadership(racineProjet, leadership); } catch { /* ignore */ }
    try { leadershipHistory = lireHistoireLeadership(racineProjet, { derniersMois: 12 }); } catch { leadershipHistory = []; }
  } catch { leadership = null; }
  return { git, hooks, leadership, leadershipHistory };
}

// Wrapper fail-safe (#134/#148). Évite que collecterDonnees soit
// interrompu si un lecteur supplémentaire jette.
/** @returns {Supplementaire} */
function collecterSupplementaireSafe(racineProjet) {
  try { return collecterDonneesSupplementaires(racineProjet); }
  catch {
    return {
      dpia: { fichiers: [], total: 0 },
      aiAct: { fichiers: [], total: 0 },
      sbom: { present: false },
      sovereignty: { available: false },
      hookStats: { available: false },
    };
  }
}

export function collecterDonnees(racineProjet) {
  const projet = lireProjet(racineProjet);
  const fondamentaux = lireFondamentaux(racineProjet);
  const intents = lireIntents(racineProjet);
  const specs = lireSpecs(racineProjet);
  const gouvernance = lireGouvernance(racineProjet);
  const facts = lireFacts(racineProjet);
  const changelog = lireChangelog(racineProjet);
  const metrics = lireMetrics(racineProjet);
  const matrice = construireMatrice(racineProjet);

  // Signaux additionnels (#133, #148) — calculés en amont pour rendre le
  // contrat de `collecterDonnees` explicite et permettre une déclaration
  // immutable du conteneur `donnees`. Fail-safe : si un lecteur jette,
  // valeur neutre ; jamais d'exception qui casse tout le dashboard.
  const signaux = calculerSignaux(racineProjet);
  const supplementaire = collecterSupplementaireSafe(racineProjet);

  const donnees = {
    projet,
    fondamentaux,
    intents,
    specs,
    gouvernance,
    facts,
    changelog,
    metrics,
    matrice,
    signaux,
    supplementaire,
  };
  donnees.maturite = calculerMaturite(donnees, signaux);

  // Indices utiles
  const specsParIntent = new Map();
  for (const s of specs) {
    if (!s.parentIntent) continue;
    if (!specsParIntent.has(s.parentIntent)) specsParIntent.set(s.parentIntent, []);
    specsParIntent.get(s.parentIntent).push(s);
  }
  donnees.specsParIntent = specsParIntent;

  return donnees;
}
