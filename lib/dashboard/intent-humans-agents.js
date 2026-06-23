/**
 * @intent INTENT-018
 * @spec SPEC-018-4-bilan-humains-agents
 * @governance AIAD-RGPD,AIAD-RGAA
 */
import { escape } from './render.js';

// Patterns identifying AI agents by name
const AGENT_PATTERNS = [/claude/i, /gpt/i, /gemini/i, /copilot/i, /mistral/i, /llama/i];

function classifierActeur(nom) {
  if (nom === null || nom === undefined) return { nom: null, type: 'inconnu' };
  const s = String(nom).trim();
  if (!s) return { nom: null, type: 'inconnu' };
  const type = AGENT_PATTERNS.some((re) => re.test(s)) ? 'agent' : 'human';
  return { nom: s, type };
}

const STATUT_ORDER = { active: 0, 'in-progress': 1 };
function statutRang(s) { return STATUT_ORDER[s] ?? 99; }

export function calculerBilanHumainsAgents(donnees) {
  const { intents = [], specs = [] } = donnees;

  const governanceParIntent = new Map();
  for (const spec of specs) {
    const tags = spec.governanceTags ?? [];
    if (!tags.length) continue;
    const pid = spec.parentIntent;
    if (!pid) continue;
    const existing = governanceParIntent.get(pid) ?? new Set();
    for (const t of tags) existing.add(t);
    governanceParIntent.set(pid, existing);
  }

  return intents
    .filter((i) => (i.statut || '').toLowerCase() !== 'archived')
    .map((i) => ({
      id: i.id,
      titre: i.titre ?? i.id,
      statut: i.statut ?? 'unknown',
      formulateur: classifierActeur(i.auteur ?? null),
      executor: classifierActeur(i.executor ?? null),
      validator: classifierActeur(i.validator ?? null),
      agentsGouvernance: [...(governanceParIntent.get(i.id) ?? [])],
    }))
    .sort((a, b) => statutRang(a.statut) - statutRang(b.statut));
}

const BADGE = {
  human: 'Humain',
  agent: 'Agent IA',
  inconnu: '—',
};

function celluleActeur(acteur) {
  if (acteur.type === 'inconnu' || acteur.nom === null) return '<td>—</td>';
  const label = BADGE[acteur.type] ?? acteur.type;
  const nom = escape(acteur.nom);
  return `<td><span class="badge badge-${acteur.type}" aria-label="${nom} (${label})">${nom}</span><span class="badge-type"> ${label}</span></td>`;
}

export function blocBilanHumainsAgents(donnees) {
  const bilan = donnees.bilanHumainsAgents ?? calculerBilanHumainsAgents(donnees);

  if (!bilan.length) {
    return '<section class="bilan-humains-agents"><p class="empty-state">Aucun Intent à afficher.</p></section>';
  }

  const rows = bilan.map((item) => {
    const gouvernance = item.agentsGouvernance.length
      ? escape(item.agentsGouvernance.join(', '))
      : '—';
    return `    <tr>
      <td><span class="intent-id">${escape(item.id)}</span> ${escape(item.titre)}</td>
      ${celluleActeur(item.formulateur)}
      ${celluleActeur(item.executor)}
      ${celluleActeur(item.validator)}
      <td>${gouvernance}</td>
    </tr>`;
  }).join('\n');

  return `<section class="bilan-humains-agents">
  <table>
    <caption>Bilan humains / agents par Intent</caption>
    <thead>
      <tr>
        <th scope="col">Intent</th>
        <th scope="col">Formulé par</th>
        <th scope="col">Exécuté par</th>
        <th scope="col">Validé par</th>
        <th scope="col">Gouvernance</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</section>`;
}

export { calculerBilanHumainsAgents as computeHumansAgentsSummary, blocBilanHumainsAgents as humansAgentsSection };
