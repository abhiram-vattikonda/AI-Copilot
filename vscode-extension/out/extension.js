"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const completion_1 = require("./providers/completion");
const diagnostics_1 = require("./providers/diagnostics");
const chatPanel_1 = require("./panels/chatPanel");
const api_1 = require("./services/api");
function activate(ctx) {
    // ── Inline completion ─────────────────────────────────────────
    ctx.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, new completion_1.AICompletionProvider()));
    // ── Auto-complete on typing pause ─────────────────────────────
    let typingTimer = null;
    ctx.subscriptions.push(vscode.workspace.onDidChangeTextDocument(async (event) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || event.document !== editor.document)
            return;
        if (typingTimer)
            clearTimeout(typingTimer);
        typingTimer = setTimeout(async () => {
            const code = event.document.getText();
            if (code.trim().length < 2)
                return;
            try {
                await vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
            }
            catch (err) {
                console.error("🔴 auto-complete error:", err);
            }
        }, 1500);
    }));
    // ── Status bar ────────────────────────────────────────────────
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = "aiCopilot.switchModel";
    statusBar.tooltip = "AI Copilot — click to switch model";
    function updateStatusBar() {
        const { label, model } = (0, api_1.getActiveModel)();
        statusBar.text = label && model
            ? `$(circuit-board) ${label} · ${model}`
            : `$(circuit-board) AI: select model`;
        statusBar.show();
    }
    updateStatusBar();
    ctx.subscriptions.push(statusBar);
    // Keep status bar in sync when settings change (e.g. another window updated them)
    ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("aiCopilot"))
            updateStatusBar();
    }));
    // ── switchModel command ───────────────────────────────────────
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.switchModel", async () => {
        const allProviders = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "AI Copilot: Fetching available models…" }, () => (0, api_1.fetchModels)());
        if (!allProviders.length) {
            vscode.window.showErrorMessage("AI Copilot: Backend unreachable or no providers configured in .env");
            return;
        }
        const items = [];
        for (const p of allProviders) {
            items.push({
                label: `${p.label}  (${p.type})`,
                kind: vscode.QuickPickItemKind.Separator,
            });
            for (const m of p.models) {
                const { providerKey: curKey, model: curModel } = (0, api_1.getActiveModel)();
                const isActive = curKey === p.providerKey && curModel === m;
                items.push({
                    label: m,
                    description: p.label,
                    detail: isActive ? "✓ currently active" : undefined,
                    providerKey: p.providerKey,
                    modelId: m,
                    providerLabel: p.label,
                });
            }
        }
        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: "Select a model — all AI features will use it",
            matchOnDescription: true,
            matchOnDetail: false,
        });
        if (!picked || !picked.providerKey)
            return;
        const cfg = vscode.workspace.getConfiguration("aiCopilot");
        await cfg.update("activeProviderKey", picked.providerKey, vscode.ConfigurationTarget.Global);
        await cfg.update("activeModel", picked.modelId, vscode.ConfigurationTarget.Global);
        await cfg.update("activeLabel", picked.providerLabel, vscode.ConfigurationTarget.Global);
        updateStatusBar();
        chatPanel_1.ChatPanel.notifyModelChanged(picked.providerLabel, picked.modelId);
        vscode.window.showInformationMessage(`AI Copilot: switched to ${picked.providerLabel} · ${picked.modelId}`);
    }));
    // ── Other commands ────────────────────────────────────────────
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.suggest", async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor)
            await (0, diagnostics_1.runDiagnostics)(editor);
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.chat", () => chatPanel_1.ChatPanel.show(ctx)));
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.fix", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "AI: Fixing bugs…" }, async () => {
            try {
                const result = await (0, api_1.fetchFix)(editor.document.getText(), editor.document.languageId);
                await editor.edit(eb => eb.replace(new vscode.Range(new vscode.Position(0, 0), editor.document.lineAt(editor.document.lineCount - 1).range.end), result));
            }
            catch (err) {
                vscode.window.showErrorMessage(`AI Copilot: ${err.message}`);
            }
        });
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.explain", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const selectedText = editor.document.getText(editor.selection);
        if (!selectedText.trim()) {
            vscode.window.showWarningMessage("AI Copilot: Please select some code to explain.");
            return;
        }
        chatPanel_1.ChatPanel.show(ctx);
        vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "AI: Explaining code…" }, async () => {
            try {
                const explanation = await (0, api_1.fetchExplain)(selectedText, editor.document.languageId);
                chatPanel_1.ChatPanel.sendExplanation(ctx, selectedText, editor.document.languageId, explanation);
            }
            catch (err) {
                vscode.window.showErrorMessage(`AI Copilot: ${err.message}`);
            }
        });
    }));
    console.log("✅ AI Copilot extension active");
}
function deactivate() { }
//# sourceMappingURL=extension.js.map