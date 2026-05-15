// AIAD SDD — Extension VS Code légère.
//
// Apporte la découverte des Intents et SPECs dans la sidebar VS Code, la
// navigation par les annotations `@spec` (CodeLens), et un bouton pour
// régénérer la matrice de traçabilité. Aucune dépendance lourde — utilise
// `npx aiad-sdd trace --json` pour rester aligné avec le CLI canonique.
//
// Cible principale : équipes EU qui utilisent VS Code (et non Claude Code)
// mais veulent quand même la rigueur AIAD.
//
// Documentation : https://aiad.ovh

const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// ─── Helpers ────────────────────────────────────────────────────────────────

function workspaceRoot() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return null;
  return folders[0].uri.fsPath;
}

function aiadSddCmd() {
  const cfg = vscode.workspace.getConfiguration('aiad-sdd');
  return cfg.get('aiadSddPath') || 'npx aiad-sdd';
}

function listMd(dir, filterFn = () => true) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .filter(filterFn)
    .sort();
}

function readTitle(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const m = content.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : path.basename(filePath, '.md');
  } catch { return path.basename(filePath, '.md'); }
}

// ─── TreeView Providers ─────────────────────────────────────────────────────

class IntentSpecProvider {
  constructor(kind /* 'intents' | 'specs' */) {
    this.kind = kind;
    this._onDidChange = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChange.event;
  }

  refresh() {
    this._onDidChange.fire();
  }

  getTreeItem(element) {
    return element;
  }

  getChildren() {
    const root = workspaceRoot();
    if (!root) return [];
    const dir = path.join(root, '.aiad', this.kind);
    const filterFn = this.kind === 'specs'
      ? (f) => !f.startsWith('spec-ears-template')
      : () => true;

    return listMd(dir, filterFn).map((nom) => {
      const fullPath = path.join(dir, nom);
      const title = readTitle(fullPath);
      const id = nom.replace(/\.md$/, '');
      const item = new vscode.TreeItem(`${id} — ${title}`, vscode.TreeItemCollapsibleState.None);
      item.tooltip = path.relative(root, fullPath);
      item.resourceUri = vscode.Uri.file(fullPath);
      item.command = {
        command: 'vscode.open',
        title: 'Ouvrir',
        arguments: [item.resourceUri],
      };
      item.iconPath = new vscode.ThemeIcon(this.kind === 'intents' ? 'lightbulb' : 'symbol-class');
      return item;
    });
  }
}

// ─── CodeLens : "Aller à la SPEC" sur les annotations ───────────────────────

class SpecCodeLensProvider {
  provideCodeLenses(document) {
    const root = workspaceRoot();
    if (!root) return [];
    const lenses = [];
    const re = /@spec\s+(SPEC-[A-Za-z0-9-]+)/g;
    const text = document.getText();
    let match;
    while ((match = re.exec(text)) !== null) {
      const start = document.positionAt(match.index);
      const end = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(start, end);
      const specId = match[1];
      const specPath = path.join(root, '.aiad', 'specs', `${specId}.md`);
      const exists = fs.existsSync(specPath);
      lenses.push(new vscode.CodeLens(range, {
        title: exists ? `→ ${specId}` : `⚠ ${specId} (manquante)`,
        command: 'aiad.gotoSpec',
        arguments: [specId],
      }));
    }
    return lenses;
  }
}

// ─── Validation à la sauvegarde ─────────────────────────────────────────────

function validateOnSave(document) {
  const root = workspaceRoot();
  if (!root) return;
  const rel = path.relative(root, document.uri.fsPath);
  if (!rel.startsWith('.aiad/')) return;

  // Validation simple frontmatter pour SPECs
  if (rel.startsWith('.aiad/specs/') && rel.endsWith('.md') && !rel.includes('_index')) {
    const text = document.getText();
    const champsAttendus = ['parent_intent', 'status'];
    const manquants = champsAttendus.filter((c) => !new RegExp(`^${c}\\s*:`, 'm').test(text));
    if (manquants.length > 0) {
      vscode.window.showWarningMessage(
        `AIAD SDD : champs frontmatter manquants dans ${path.basename(rel)} — ${manquants.join(', ')}.`,
      );
    }
  }

  // Auto-trace optionnel
  const cfg = vscode.workspace.getConfiguration('aiad-sdd');
  if (cfg.get('autoTraceOnSave')) {
    runTraceJson();
  }
}

function runTraceJson() {
  const root = workspaceRoot();
  if (!root) return null;
  const cmd = aiadSddCmd().split(/\s+/);
  const r = spawnSync(cmd[0], [...cmd.slice(1), 'trace', '--json'], {
    cwd: root,
    encoding: 'utf-8',
    timeout: 15_000,
  });
  if (r.status !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

// ─── Activation ─────────────────────────────────────────────────────────────

function activate(context) {
  const intentsProvider = new IntentSpecProvider('intents');
  const specsProvider = new IntentSpecProvider('specs');

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('aiad.intents', intentsProvider),
    vscode.window.registerTreeDataProvider('aiad.specs', specsProvider),
    vscode.languages.registerCodeLensProvider(
      [
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'javascriptreact' },
        { scheme: 'file', language: 'python' },
        { scheme: 'file', language: 'rust' },
        { scheme: 'file', language: 'go' },
        { scheme: 'file', language: 'java' },
        { scheme: 'file', language: 'kotlin' },
        { scheme: 'file', language: 'csharp' },
        { scheme: 'file', language: 'ruby' },
      ],
      new SpecCodeLensProvider(),
    ),
    vscode.commands.registerCommand('aiad.refresh', () => {
      intentsProvider.refresh();
      specsProvider.refresh();
      vscode.window.showInformationMessage('AIAD SDD : Intents et SPECs rafraîchis.');
    }),
    vscode.commands.registerCommand('aiad.openTrace', async () => {
      const root = workspaceRoot();
      if (!root) return;
      const traceMd = path.join(root, '.aiad', 'metrics', 'traceability', 'trace.md');
      if (fs.existsSync(traceMd)) {
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(traceMd));
      } else {
        const choix = await vscode.window.showInformationMessage(
          'Matrice non générée. La générer maintenant ?',
          'Oui',
          'Annuler',
        );
        if (choix === 'Oui') {
          runTraceJson();
          if (fs.existsSync(traceMd)) {
            await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(traceMd));
          }
        }
      }
    }),
    vscode.commands.registerCommand('aiad.runDoctor', () => {
      const term = vscode.window.createTerminal('AIAD SDD');
      term.sendText(`${aiadSddCmd()} doctor`);
      term.show();
    }),
    vscode.commands.registerCommand('aiad.gotoSpec', async (specId) => {
      const root = workspaceRoot();
      if (!root) return;
      const specPath = path.join(root, '.aiad', 'specs', `${specId}.md`);
      if (fs.existsSync(specPath)) {
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(specPath));
      } else {
        const choix = await vscode.window.showWarningMessage(
          `${specId} introuvable. Générer un squelette EARS via \`aiad-sdd trace --suggest\` ?`,
          'Oui',
          'Annuler',
        );
        if (choix === 'Oui') {
          const term = vscode.window.createTerminal('AIAD SDD');
          term.sendText(`${aiadSddCmd()} trace --suggest`);
          term.show();
        }
      }
    }),
    vscode.workspace.onDidSaveTextDocument(validateOnSave),
  );
}

function deactivate() {
  // Rien — VS Code clean les subscriptions pour nous.
}

module.exports = { activate, deactivate };
