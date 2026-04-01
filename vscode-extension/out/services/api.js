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
exports.getCursorContext = getCursorContext;
exports.fetchCompletion = fetchCompletion;
exports.fetchFix = fetchFix;
exports.fetchSuggestions = fetchSuggestions;
const vscode = __importStar(require("vscode"));
function backendUrl() {
    return vscode.workspace
        .getConfiguration("aiCopilot")
        .get("backendUrl", "http://localhost:3000");
}
/**
 * Extracts context around the cursor:
 * - prefix: last N lines before cursor (what the model sees as context)
 * - suffix: next few lines after cursor (so model knows what comes next)
 */
function getCursorContext(document, position, prefixLines = 20, suffixLines = 5) {
    const startLine = Math.max(0, position.line - prefixLines);
    const endLine = Math.min(document.lineCount - 1, position.line + suffixLines);
    const prefix = document.getText(new vscode.Range(new vscode.Position(startLine, 0), position));
    const suffix = document.getText(new vscode.Range(position, new vscode.Position(endLine, 999)));
    return { prefix, suffix };
}
async function fetchCompletion(document, position, language) {
    const { prefix, suffix } = getCursorContext(document, position);
    console.log("🟡 fetching completion for cursor context...");
    const res = await fetch(`${backendUrl()}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prefix,
            suffix,
            language,
            task: "complete",
        }),
    });
    if (!res.ok)
        throw new Error(`Backend error: ${res.status}`);
    const result = (await res.json()).result;
    console.log("🟢 got result:", result.slice(0, 80));
    return result;
}
async function fetchFix(code, language) {
    const res = await fetch(`${backendUrl()}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, task: "fix" }),
    });
    if (!res.ok)
        throw new Error(`Backend error: ${res.status}`);
    return (await res.json()).result;
}
async function fetchSuggestions(code, language) {
    const res = await fetch(`${backendUrl()}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
    });
    if (!res.ok)
        throw new Error(`Backend error: ${res.status}`);
    return res.json();
}
//# sourceMappingURL=api.js.map