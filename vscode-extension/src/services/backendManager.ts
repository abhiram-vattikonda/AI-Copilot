import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";
import * as fs from "fs";

let backendProcess: cp.ChildProcess | null = null;
let outputChannel: vscode.OutputChannel;

export function getBackendDir(extensionUri: vscode.Uri): string {
  return path.join(extensionUri.fsPath, "backend");
}

export function getEnvPath(extensionUri: vscode.Uri): string {
  return path.join(getBackendDir(extensionUri), ".env");
}

export async function startBackend(
  extensionUri: vscode.Uri,
  context: vscode.ExtensionContext
): Promise<void> {
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

export function stopBackend(): void {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
    outputChannel?.appendLine("🛑 Backend stopped.");
  }
}

export function restartBackend(extensionUri: vscode.Uri, context: vscode.ExtensionContext): void {
  stopBackend();
  setTimeout(() => startBackend(extensionUri, context), 500);
}

export function isBackendRunning(): boolean {
  return backendProcess !== null;
}

function runCommand(
  cmd: string,
  cwd: string,
  output: vscode.OutputChannel
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = cp.exec(cmd, { cwd });
    proc.stdout?.on("data", (d) => output.appendLine(d.toString().trim()));
    proc.stderr?.on("data", (d) => output.appendLine(d.toString().trim()));
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
  });
}