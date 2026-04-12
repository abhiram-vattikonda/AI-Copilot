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
    // ── Inline completion provider (keeps ghost text working if VS Code allows it)
    ctx.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, new completion_1.AICompletionProvider()));
    // ── Auto-complete on typing pause ─────────────────────────────
    let typingTimer = null;
    let lastInsertedText = "";
    ctx.subscriptions.push(vscode.workspace.onDidChangeTextDocument(async (event) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || event.document !== editor.document)
            return;
        // Clear previous timer on every keystroke
        if (typingTimer)
            clearTimeout(typingTimer);
        typingTimer = setTimeout(async () => {
            const code = event.document.getText();
            if (code.trim().length < 2)
                return;
            if (code === lastInsertedText)
                return;
            try {
                console.log("🟡 auto-triggering completion...");
                await vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
                console.log("🟢 suggestion triggered");
            }
            catch (err) {
                console.error("🔴 auto-complete error:", err);
            }
        }, 1500); // 1.5 seconds after you stop typing
    }));
    // ── Commands ──────────────────────────────────────────────────
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.suggest", async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor)
            await (0, diagnostics_1.runDiagnostics)(editor);
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.chat", () => {
        chatPanel_1.ChatPanel.show(ctx);
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
    ctx.subscriptions.push(vscode.commands.registerCommand("aiCopilot.explain", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (!selectedText.trim()) {
            vscode.window.showWarningMessage("AI Copilot: Please select some code to explain.");
            return;
        }
        // Open chat panel first
        chatPanel_1.ChatPanel.show(ctx);
        // Send the explain request to the chat panel
        vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "AI: Explaining code..." }, async () => {
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