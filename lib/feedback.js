// @intent INTENT-001
// @spec SPEC-001-1-feedback-qualitatif
// @governance AIAD-RGPD
//
// AIAD SDD Mode — Feedback qualitatif opt-in.
//
// Conformité RGPD stricte (ART. 6 §1 a — consentement explicite) :
//   - Désactivé par défaut. Consentement distinct de la télémétrie.
//   - Anonymisé : UUID local (réutilise celui de la télémétrie si disponible).
//   - Données minimales : réponses texte libres, version, UUID anonyme.
//     Aucun chemin projet, aucun identifiant personnel.
//   - Fail-safe : ne bloque jamais une commande utilisateur.
//   - Réversible : `aiad-sdd feedback opt-out` désactive définitivement.
//
// État : ~/.aiad-sdd/feedback.json
//   { consent: boolean|null, sessionCount: number, lastInviteSession: number, localAnonymousId: string|null }
//
// Stockage local  : ~/.aiad-sdd/feedback-responses.jsonl
// Envoi distant   : GitHub Issues via AIAD_FEEDBACK_GITHUB_TOKEN (ou GITHUB_TOKEN)
//                   Repo cible configurable via AIAD_FEEDBACK_GITHUB_REPO
//                   (défaut : everssteeve/sdd-mode)
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { C, log, logHeader } from './term.js';
import { getAnonymousId as telemetryAnonymousId } from './telemetry.js';

const STATE_DIR = join(homedir(), '.aiad-sdd');
const STATE_FILE = join(STATE_DIR, 'feedback.json');
const LOCAL_LOG = join(STATE_DIR, 'feedback-responses.jsonl');

const DEFAULT_GITHUB_REPO = 'everssteeve/sdd-mode';
const INVITE_INTERVAL = 15;

const QUESTIONS = [
  'Quelle commande a le plus ralenti ou cassé ton flow récemment ?',
  "Qu'est-ce que tu as fait à la place d'une commande SDD ? (workaround, contournement)",
  'Quel artefact génère le plus de retravail ? (PRD / SPEC / ARCHITECTURE / autre)',
];

const DEFAULT_STATE = {
  consent: null,
  sessionCount: 0,
  lastInviteSession: 0,
  localAnonymousId: null,
};

function ensureStateDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

function readState() {
  if (!existsSync(STATE_FILE)) return { ...DEFAULT_STATE };
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(readFileSync(STATE_FILE, 'utf-8')) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeState(state) {
  ensureStateDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

function resolveAnonymousId(state) {
  const telemetryId = telemetryAnonymousId();
  if (telemetryId) return telemetryId;
  if (state.localAnonymousId) return state.localAnonymousId;
  const id = randomUUID();
  writeState({ ...state, localAnonymousId: id });
  return id;
}

function ask(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function collectResponses(rl) {
  const responses = [];
  console.log('');
  for (let i = 0; i < QUESTIONS.length; i++) {
    console.log(`  ${C.gras}${i + 1}/${QUESTIONS.length}${C.reset} ${QUESTIONS[i]}`);
    console.log(`  ${C.gris}(Entrée pour passer)${C.reset}`);
    const answer = await ask(rl, `  ${C.cyan}→ ${C.reset}`);
    responses.push({ question: QUESTIONS[i], answer: answer.trim() });
    console.log('');
  }
  return responses;
}

function storeLocally(record) {
  ensureStateDir();
  appendFileSync(LOCAL_LOG, JSON.stringify(record) + '\n', 'utf-8');
}

function sendToGithub(record, version) {
  const token = process.env.AIAD_FEEDBACK_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) return;

  const repo = process.env.AIAD_FEEDBACK_GITHUB_REPO || DEFAULT_GITHUB_REPO;
  const answered = record.responses.filter((r) => r.answer);

  const body = [
    `## Feedback anonyme — aiad-sdd v${version}`,
    '',
    `**ID anonyme :** \`${record.anonymousId}\`  `,
    `**Date :** ${record.timestamp}`,
    '',
    ...answered.map((r, i) =>
      `### Q${i + 1} — ${r.question}\n\n${r.answer}`
    ),
  ].join('\n');

  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 5000);
  fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      title: `[Feedback] aiad-sdd v${version} — ${new Date().toISOString().slice(0, 10)}`,
      body,
      labels: ['feedback'],
    }),
    signal: ctrl.signal,
  }).catch(() => {});
}

async function requestConsent(rl) {
  console.log(`
${C.gris}  Avant de continuer — consentement RGPD :${C.reset}

  Les réponses seront stockées ${C.gras}localement${C.reset} (${LOCAL_LOG})
  et soumises ${C.gras}anonymement${C.reset} comme issue GitHub sur le repo aiad-sdd
  si AIAD_FEEDBACK_GITHUB_TOKEN ou GITHUB_TOKEN est configuré.

  Données collectées : réponses texte libres + version + UUID anonyme local.
  Aucun chemin projet, aucune IP, aucun identifiant personnel.
  ${C.gris}Conformité RGPD Art. 6 §1 a — consentement explicite.${C.reset}
`);
  const answer = await ask(rl, `  ${C.cyan}Acceptes-tu de partager ces réponses ?${C.reset} [O/n] `);
  return answer.trim().toLowerCase() !== 'n';
}

async function runSession(version) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const state = readState();

    let consent = state.consent;
    if (consent === null) {
      consent = await requestConsent(rl);
      writeState({ ...readState(), consent });
      if (!consent) {
        console.log(`\n  ${C.gris}Compris. Tu peux relancer à tout moment via \`aiad-sdd feedback\`.${C.reset}\n`);
        return;
      }
    }

    logHeader('Feedback SDD Mode', "3 questions — moins d'une minute");

    const responses = await collectResponses(rl);
    const hasAnswers = responses.some((r) => r.answer);

    if (!hasAnswers) {
      console.log(`  ${C.gris}Rien renseigné. À une prochaine fois !${C.reset}\n`);
      return;
    }

    const freshState = readState();
    const anonymousId = resolveAnonymousId(freshState);
    const record = {
      anonymousId,
      version,
      timestamp: new Date().toISOString(),
      responses,
    };

    storeLocally(record);
    sendToGithub(record, version);

    writeState({ ...freshState, lastInviteSession: freshState.sessionCount });

    log(`${C.vert}✓${C.reset}`, 'Feedback enregistré. Merci !');
    log(' ', `${C.gris}Log local : ${LOCAL_LOG}${C.reset}`);
    console.log('');
  } finally {
    try { rl.close(); } catch { /* déjà fermé */ }
  }
}

export function incrementSession() {
  try {
    const state = readState();
    writeState({ ...state, sessionCount: (state.sessionCount || 0) + 1 });
  } catch {
    // fail-safe absolu
  }
}

export function shouldInvite() {
  try {
    const state = readState();
    if (state.consent === false) return false;
    const sessionCount = state.sessionCount || 0;
    const lastInvite = state.lastInviteSession || 0;
    return (sessionCount - lastInvite) >= INVITE_INTERVAL;
  } catch {
    return false;
  }
}

export async function tryInvite(version) {
  try {
    if (!process.stdin.isTTY) return;
    if (!shouldInvite()) return;

    const state = readState();
    // Marque immédiatement pour éviter double-invitation si la session est interrompue
    writeState({ ...state, lastInviteSession: state.sessionCount });

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      console.log(`\n${C.cyan}${C.gras}  💬 Feedback SDD Mode${C.reset} — 1 min chrono`);
      console.log(`${C.gris}  ${state.sessionCount} session(s) depuis le début. Une question rapide ?${C.reset}\n`);
      const answer = await ask(rl, `  [O]ui / [N]on / [J]amais  `);
      const normalized = answer.trim().toLowerCase();

      if (normalized === 'jamais' || normalized === 'j') {
        writeState({ ...readState(), consent: false });
        console.log(`\n  ${C.gris}Compris — tu ne seras plus sollicité. \`aiad-sdd feedback\` reste disponible.${C.reset}\n`);
        return;
      }
      if (normalized === 'non' || normalized === 'n') {
        console.log(`\n  ${C.gris}À une prochaine fois.${C.reset}\n`);
        return;
      }

      // Oui ou Entrée
      rl.close();
      await runSession(version);
    } finally {
      try { rl.close(); } catch { /* déjà fermé */ }
    }
  } catch {
    // fail-safe absolu — l'invitation ne bloque jamais le CLI
  }
}

export async function runFeedbackCommand(sub, version) {
  const state = readState();

  if (sub === 'status') {
    const tokenPresent = Boolean(process.env.AIAD_FEEDBACK_GITHUB_TOKEN || process.env.GITHUB_TOKEN);
    const consentLabel =
      state.consent === true ? `${C.vert}donné${C.reset}` :
      state.consent === false ? `${C.rouge}refusé${C.reset}` :
      `${C.gris}non demandé${C.reset}`;

    logHeader('Feedback SDD Mode — état', '');
    log(' ', `Consentement : ${consentLabel}`);
    log(' ', `Sessions totales : ${C.gris}${state.sessionCount}${C.reset}`);
    log(' ', `Dernière invitation : session ${C.gris}${state.lastInviteSession || 0}${C.reset}`);
    log(' ', `Prochaine invitation : session ${C.gris}${(state.lastInviteSession || 0) + INVITE_INTERVAL}${C.reset}`);
    log(' ', `Log local : ${C.gris}${existsSync(LOCAL_LOG) ? LOCAL_LOG : 'aucun encore'}${C.reset}`);
    log(' ', `GitHub Issues : ${tokenPresent ? `${C.vert}token configuré${C.reset}` : `${C.gris}aucun token (stockage local uniquement)${C.reset}`}`);
    console.log('');
    return;
  }

  if (sub === 'opt-out') {
    writeState({ ...state, consent: false });
    log(`${C.vert}✓${C.reset}`, "Feedback désactivé. Lance `aiad-sdd feedback opt-in` pour réactiver.");
    console.log('');
    return;
  }

  if (sub === 'opt-in') {
    writeState({ ...state, consent: true });
    log(`${C.vert}✓${C.reset}`, 'Consentement enregistré. Lance `aiad-sdd feedback` pour répondre maintenant.');
    console.log('');
    return;
  }

  if (state.consent === false) {
    logHeader('Feedback SDD Mode', 'Désactivé');
    log(`${C.gris}-${C.reset}`, 'Lance `aiad-sdd feedback opt-in` pour réactiver.');
    console.log('');
    return;
  }

  await runSession(version);
}
