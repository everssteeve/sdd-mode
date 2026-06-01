// AIAD SDD Mode — Dashboard : glossaire AIAD (#215).
//
// Audit DASHBOARD-AUDIT.md section 6f Onboarding ligne 226 : "Pas de
// glossaire AIAD inline (Intent, SPEC, SQS, Drift Lock — les nouveaux
// doivent ouvrir un autre doc)."
//
// Source unique des termes du jargon AIAD. Chaque entrée :
//   - keywords : mots / expressions à matcher dans le DOM (case-sensitive
//                pour les acronymes en majuscules, insensitive sinon)
//   - titre    : libellé complet pour le tooltip
//   - desc     : 1-2 phrases de définition
//
// Le helper `autoTagGlossaire()` (côté browser, injecté via `assets.js`)
// parcourt les `<p>`, `<li>`, `<td>`, `<summary>` du DOM et wrap la
// première occurrence de chaque keyword dans `<dfn class="aiad-term"
// title="...">...</dfn>`. Évite `<code>`, `<a>`, `<dfn>`, `<input>`, etc.

export const GLOSSAIRE = {
  intent: {
    keywords: ['Intent Statement', 'Intent', 'Intents'],
    titre: 'Intent Statement',
    desc: 'Le POURQUOI capturé avant toute spec. Document INTENT-NNN.md qui exprime le besoin, jamais la solution.',
  },
  spec: {
    keywords: ['SPEC', 'SPECs'],
    titre: 'SPEC',
    desc: 'Spécification atomique (1 unité de livrable). Lie un Intent au code via @spec dans le code et @verified-by dans les tests.',
  },
  sqs: {
    keywords: ['SQS'],
    titre: 'SQS — Spec Quality Score',
    desc: 'Score 0..5 attribué par la Gate. >= 4/5 → la SPEC est prête à être exécutée par l\'agent.',
  },
  gate: {
    keywords: ['Execution Gate', 'la Gate'],
    titre: 'Execution Gate',
    desc: 'Validation humaine de la SPEC avant exécution. Vérifie SQS + EARS lint + Test de l\'Étranger.',
  },
  drift: {
    keywords: ['Drift Lock', 'drift'],
    titre: 'Drift Lock',
    desc: 'Mécanisme qui détecte une désynchronisation code ↔ SPEC. Hook pre-commit + matrice de traçabilité.',
  },
  jnsp: {
    keywords: ['JNSP'],
    titre: 'JNSP — Je Ne Sais Pas',
    desc: 'Verdict honnête plutôt qu\'invention. Code spécial 2 dans les CLI AIAD : "décision humaine requise".',
  },
  gouvernance: {
    keywords: ['Tier 1', 'gouvernance Tier 1'],
    titre: 'Agent de gouvernance Tier 1',
    desc: 'AI-ACT, RGPD, RGAA, RGESN, CRA. Ont un droit de veto sur le code/SPEC.',
  },
  sbom: {
    keywords: ['SBOM'],
    titre: 'SBOM — Software Bill of Materials',
    desc: 'Liste de tous les composants tiers (format CycloneDX). Exigé par le Cyber Resilience Act EU.',
  },
  sovereignty: {
    keywords: ['Souveraineté', 'sovereignty'],
    titre: 'Score Souveraineté',
    desc: 'Score composite 0..100 (Bronze→Platinum) mesurant 5 dimensions : juridictions, agents Tier 1, langue, autorités, hébergement.',
  },
  adr: {
    keywords: ['ADR', 'ADRs'],
    titre: 'ADR — Architecture Decision Record',
    desc: 'Décision technique structurante documentée dans ARCHITECTURE.md sous forme **ADR-NNN** : décision.',
  },
  ears: {
    keywords: ['EARS'],
    titre: 'EARS — Easy Approach to Requirements Syntax',
    desc: 'Format de SPEC strict (WHEN/WHILE/IF/WHERE + sujet + SHALL). Activé via format: EARS en frontmatter.',
  },
  dpia: {
    keywords: ['DPIA'],
    titre: 'DPIA — Data Protection Impact Assessment',
    desc: 'Analyse d\'impact relative à la protection des données (Article 35 RGPD, méthode CNIL en 9 sections).',
  },
  dora: {
    keywords: ['DORA'],
    titre: 'DORA Metrics',
    desc: 'Deployment Frequency, Lead Time, Change Failure Rate, MTTR — métriques de performance d\'équipe.',
  },
};

// Retourne tous les keywords avec leur titre + desc, prêt à être consommé
// par le JS du browser. Optimisé pour matching : tri par longueur DESC
// pour matcher d'abord les expressions longues ("Intent Statement" avant
// "Intent").
export function termesPourBrowser() {
  const out = [];
  for (const entry of Object.values(GLOSSAIRE)) {
    for (const kw of entry.keywords) {
      out.push({ kw, titre: entry.titre, desc: entry.desc });
    }
  }
  out.sort((a, b) => b.kw.length - a.kw.length);
  return out;
}

// Alias EN canoniques (#42)
export {
  GLOSSAIRE as GLOSSARY,
  termesPourBrowser as termsForBrowser,
};
