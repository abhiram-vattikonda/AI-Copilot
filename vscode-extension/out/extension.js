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
const api_1 = require("./services/api");
const chatPanel_1 = require("./panels/chatPanel");
const settingsPanel_1 = require("./panels/settingsPanel");
const backendManager_1 = require("./services/backendManager");
async function activate(ctx) {
    // ── Auto-start the embedded backend ──────────────────────────
    vscode.window.showInformationMessage("🚀 AI Copilot starting backend...");
    await (0, backendManager_1.startBackend)(ctx.extensionUri, ctx);
    // ── Inline completion provider ────────────────────────────────
    ctx.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, new completion_1.AICompletionProvider()));
    // ── Chat sidebar ──────────────────────────────────────────────
    ctx.subscriptions.push(vscode.window.registerWebviewViewProvider(chatPanel_1.ChatViewProvider.viewType, new chatPanel_1.ChatViewProvider(ctx.extensionUri)));
    // ── Auto-complete on typing pause ─────────────────────────────
    let typingTimer = null;
    let lastInsertedText = "";
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
            if (code === lastInsertedText)
                return;
            try {
                await vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
            }
            catch (err) {
                console.error("auto-complete error:", err);
            }
        }, 1500);
    }));
    // ── Commands ──────────────────────────────────────────────────
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.suggest", async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor)
            await (0, diagnostics_1.runDiagnostics)(editor);
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.fix", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "AI: Fixing bugs..." }, async () => {
            try {
                const result = await (0, api_1.fetchFix)(editor.document.getText(), editor.document.languageId);
                await editor.edit((eb) => eb.replace(new vscode.Range(new vscode.Position(0, 0), editor.document.lineAt(editor.document.lineCount - 1).range.end), result));
            }
            catch (err) {
                vscode.window.showErrorMessage(`AI Copilot: ${err.message}`);
            }
        });
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.triggerComplete", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "AI: Completing..." }, async () => {
            try {
                const result = await (0, api_1.fetchCompletion)(editor.document, editor.selection.active, editor.document.languageId);
                await editor.edit((eb) => eb.insert(editor.selection.active, result));
            }
            catch (err) {
                vscode.window.showErrorMessage(`AI Copilot: ${err.message}`);
            }
        });
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.openSettings", () => {
        settingsPanel_1.SettingsPanel.open(ctx.extensionUri, ctx);
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.restartBackend", () => {
        (0, backendManager_1.restartBackend)(ctx.extensionUri, ctx);
        vscode.window.showInformationMessage("🔄 Backend restarting...");
    }));
    console.log("✅ AI Copilot extension active");
}
function deactivate() {
    (0, backendManager_1.stopBackend)();
}
//# sourceMappingURL=extension.js.map