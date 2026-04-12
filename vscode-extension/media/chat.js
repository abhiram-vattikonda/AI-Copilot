// @ts-check
(function () {
  const vscode    = acquireVsCodeApi();
  const log       = document.getElementById("log");
  const input     = document.getElementById("input");
  const sendBtn   = document.getElementById("send");
  const clearBtn  = document.getElementById("clear");
  const explainBtn= document.getElementById("explain");
  const modelPill = document.getElementById("model-pill");
  const pillText  = document.getElementById("model-pill-text");

  let streamingEl  = null;
  let streamingRaw = "";
  let streamRaf    = null;

  // ── Model pill ────────────────────────────────────────────────
  modelPill?.addEventListener("click", () => {
    vscode.postMessage({ type: "switchModel" });
  });

  // ── Markdown rendering ────────────────────────────────────────
  function appendMdText(container, text) {
    if (!text) return;
    const div = document.createElement("div");
    div.className = "md-text";
    div.textContent = text;
    container.appendChild(div);
  }

  function appendCodeBlock(container, lang, code) {
    const wrap    = document.createElement("div");
    wrap.className = "code-block";
    const head    = document.createElement("div");
    head.className = "code-block-head";
    const label   = document.createElement("span");
    label.className = "code-lang";
    label.textContent = lang || "code";
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "copy-code";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(code).then(
        () => { copyBtn.textContent = "Copied!"; setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500); },
        () => { copyBtn.textContent = "Failed"; }
      );
    });
    head.appendChild(label);
    head.appendChild(copyBtn);
    wrap.appendChild(head);
    const pre  = document.createElement("pre");
    const code_= document.createElement("code");
    code_.textContent = code;
    pre.appendChild(code_);
    wrap.appendChild(pre);
    container.appendChild(wrap);
  }

  function renderMessageBody(container, text) {
    container.innerHTML = "";
    if (!text) return;
    let i = 0;
    while (i < text.length) {
      const fence = text.indexOf("```", i);
      if (fence === -1) { appendMdText(container, text.slice(i)); break; }
      if (fence > i) appendMdText(container, text.slice(i, fence));
      const afterOpen = fence + 3;
      const lineEnd   = text.indexOf("\n", afterOpen);
      let lang = "", bodyStart = afterOpen;
      if (lineEnd !== -1) {
        const firstLine = text.slice(afterOpen, lineEnd).trim();
        if (/^[\w.+-]+$/.test(firstLine) && firstLine.length < 48) { lang = firstLine; bodyStart = lineEnd + 1; }
      }
      const close = text.indexOf("```", bodyStart);
      if (close === -1) { appendMdText(container, text.slice(fence)); break; }
      appendCodeBlock(container, lang, text.slice(bodyStart, close));
      i = close + 3;
    }
  }

  function scheduleStreamRender() {
    if (streamRaf !== null) return;
    streamRaf = requestAnimationFrame(() => {
      streamRaf = null;
      if (streamingEl) renderMessageBody(streamingEl, streamingRaw);
      if (log) log.scrollTop = log.scrollHeight;
    });
  }

  function appendBubble(role, text) {
    if (!log) return null;
    const wrap  = document.createElement("div");
    wrap.className = "bubble " + role;
    const lbl   = document.createElement("div");
    lbl.className = "role";
    lbl.textContent = role === "user" ? "You" : role === "assistant" ? "Assistant" : role;
    const body  = document.createElement("div");
    body.className = "message-body";
    renderMessageBody(body, text || "");
    wrap.appendChild(lbl);
    wrap.appendChild(body);
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    return body;
  }

  function renderHistory(messages) {
    if (!log) return;
    log.innerHTML = "";
    streamingEl  = null;
    streamingRaw = "";
    for (const m of messages) appendBubble(m.role, m.content);
    log.scrollTop = log.scrollHeight;
  }

  function setBusy(busy) {
    if (sendBtn) sendBtn.disabled = busy;
    if (input)   input.disabled   = busy;
  }

  // ── Button listeners ──────────────────────────────────────────
  sendBtn?.addEventListener("click", () => {
    const text = input?.value ?? "";
    if (!text.trim() || sendBtn?.disabled) return;
    vscode.postMessage({ type: "send", text });
    if (input) input.value = "";
  });

  clearBtn?.addEventListener("click", () => vscode.postMessage({ type: "clear" }));
  explainBtn?.addEventListener("click", () => vscode.postMessage({ type: "explainSelection" }));

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBtn?.click(); }
  });

  // ── Message handler ───────────────────────────────────────────
  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "history":
        renderHistory(msg.messages || []);
        break;

      case "modelChanged":
        if (pillText) {
          pillText.textContent = msg.label && msg.model
            ? `${msg.label} · ${msg.model}`
            : "select model";
        }
        break;

      case "assistantStart":
        setBusy(true);
        streamingRaw = "";
        streamingEl  = appendBubble("assistant", "");
        break;

      case "assistantDelta":
        streamingRaw += msg.token || "";
        scheduleStreamRender();
        break;

      case "assistantDone":
        setBusy(false);
        streamingEl  = null;
        streamingRaw = "";
        break;

      case "assistantError":
        setBusy(false);
        streamingRaw = "";
        if (streamingEl && streamingEl.parentElement) {
          streamingEl.parentElement.classList.add("error");
          streamingEl.innerHTML = "";
          const err = document.createElement("div");
          err.className = "md-text";
          err.textContent = msg.message || "Error";
          streamingEl.appendChild(err);
        } else if (log) {
          const el = appendBubble("assistant", msg.message || "Error");
          el?.parentElement?.classList.add("error");
        }
        streamingEl = null;
        break;
    }
  });

  vscode.postMessage({ type: "ready" });
})();
