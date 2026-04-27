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
exports.runDiagnostics = runDiagnostics;
const vscode = __importStar(require("vscode"));
const api_1 = require("../services/api");
const collection = vscode.languages.createDiagnosticCollection("ai-copilot");
async function runDiagnostics(editor) {
    const code = editor.document.getText();
    const lang = editor.document.languageId;
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "AI: Analyzing code..." }, async () => {
        try {
            console.log("🟡 fetching suggestions...");
            const { bugs, optimizations } = await (0, api_1.fetchSuggestions)(code, lang);
            console.log("🟢 bugs:", bugs, "opts:", optimizations);
            const diags = [];
            const lastLine = editor.document.lineCount - 1;
            // Spread bugs across actual lines in the file
            bugs.forEach((msg, i) => {
                const line = Math.min(i, lastLine);
                diags.push(new vscode.Diagnostic(new vscode.Range(line, 0, line, 999), `🐛 ${msg}`, vscode.DiagnosticSeverity.Warning));
            });
            optimizations.forEach((msg, i) => {
                const line = Math.min(bugs.length + i, lastLine);
                diags.push(new vscode.Diagnostic(new vscode.Range(line, 0, line, 999), `💡 ${msg}`, vscode.DiagnosticSeverity.Information));
            });
            collection.set(editor.document.uri, diags);
            vscode.window.showInformationMessage(`AI found ${bugs.length} bug(s) and ${optimizations.length} suggestion(s). Check the Problems panel.`);
        }
        catch (err) {
            console.error("🔴 diagnostics error:", err);
            vscode.window.showErrorMessage(`AI Copilot: ${err.message}`);
        }
    });
}
//# sourceMappingURL=diagnostics.js.map