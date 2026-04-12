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
exports.getBackendDir = getBackendDir;
exports.getEnvPath = getEnvPath;
exports.startBackend = startBackend;
exports.stopBackend = stopBackend;
exports.restartBackend = restartBackend;
exports.isBackendRunning = isBackendRunning;
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
let backendProcess = null;
let outputChannel;
function getBackendDir(extensionUri) {
    return path.join(extensionUri.fsPath, "backend");
}
function getEnvPath(extensionUri) {
    return path.join(getBackendDir(extensionUri), ".env");
}
async function startBackend(extensionUri, context) {
    if (backendProcess) {
        outputChannel.appendLine("Backend already running.");
        return;
    }
    outputChannel = vscode.window.createOutputChannel("AI Copilot Backend");
    outputChannel.show(true);
    const backendDir = getBackendDir(extensionUri);
    // Install dependencies if node_modules doesn't exist
    if (!fs.existsSync(path.join(backendDir, "node_modules"))) {
        outputChannel.appendLine("📦 Installing backend dependencies...");
        await runCommand("npm install", backendDir, outputChannel);
        outputChannel.appendLine("✅ Dependencies installed.");
    }
    outputChannel.appendLine("🚀 Starting AI Copilot backend...");
    backendProcess = cp.spawn("node", ["index.js"], {
        cwd: backendDir,
        env: { ...process.env },
        shell: true,
    });
    backendProcess.stdout?.on("data", (data) => {
        outputChannel.appendLine(data.toString().trim());
    });
    backendProcess.stderr?.on("data", (data) => {
        outputChannel.appendLine(`[err] ${data.toString().trim()}`);
    });
    backendProcess.on("exit", (code) => {
        outputChannel.appendLine(`Backend exited with code ${code}`);
        backendProcess = null;
    });
    // Register cleanup on extension deactivation
    context.subscriptions.push({
        dispose: () => stopBackend(),
    });
    // Wait briefly for backend to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));
    outputChannel.appendLine("✅ Backend ready on http://localhost:3000");
}
function stopBackend() {
    if (backendProcess) {
        backendProcess.kill();
        backendProcess = null;
        outputChannel?.appendLine("🛑 Backend stopped.");
    }
}
function restartBackend(extensionUri, context) {
    stopBackend();
    setTimeout(() => startBackend(extensionUri, context), 500);
}
function isBackendRunning() {
    return backendProcess !== null;
}
function runCommand(cmd, cwd, output) {
    return new Promise((resolve, reject) => {
        const proc = cp.exec(cmd, { cwd });
        proc.stdout?.on("data", (d) => output.appendLine(d.toString().trim()));
        proc.stderr?.on("data", (d) => output.appendLine(d.toString().trim()));
        proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
    });
}
//# sourceMappingURL=backendManager.js.map