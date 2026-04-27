// Automated endpoint test suite for AI Copilot Backend
const BASE = "http://localhost:3000";

const tests = [];
let passed = 0;
let failed = 0;

function log(status, name, detail) {
  const icon = status === "PASS" ? "✅" : "❌";
  console.log(`${icon} ${status} | ${name}`);
  if (detail) console.log(`        ${detail}`);
  tests.push({ status, name, detail });
  if (status === "PASS") passed++;
  else failed++;
}

async function run() {
  console.log("=".repeat(60));
  console.log("   AI COPILOT — BACKEND TEST SUITE");
  console.log("=".repeat(60));
  console.log(`Started: ${new Date().toISOString()}\n`);

  // TC-01: Health check
  try {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    if (res.ok && data.status === "ok" && typeof data.uptime === "number") {
      log("PASS", "TC-01: GET /health returns status OK", `uptime=${data.uptime.toFixed(1)}s`);
    } else {
      log("FAIL", "TC-01: GET /health returns status OK", JSON.stringify(data));
    }
  } catch (e) { log("FAIL", "TC-01: GET /health", e.message); }

  // TC-02: Models endpoint
  try {
    const res = await fetch(`${BASE}/models`);
    const data = await res.json();
    if (res.ok && Array.isArray(data.providers)) {
      log("PASS", "TC-02: GET /models returns provider list", `providers=${data.providers.length}`);
    } else {
      log("FAIL", "TC-02: GET /models returns provider list", JSON.stringify(data));
    }
  } catch (e) { log("FAIL", "TC-02: GET /models", e.message); }

  // TC-03: Models have expected structure
  try {
    const res = await fetch(`${BASE}/models`);
    const data = await res.json();
    const p = data.providers[0];
    if (p && p.providerKey && p.label && p.type && Array.isArray(p.models)) {
      log("PASS", "TC-03: Provider object has correct schema", `key=${p.providerKey}, models=${p.models.length}`);
    } else {
      log("FAIL", "TC-03: Provider object has correct schema", JSON.stringify(p));
    }
  } catch (e) { log("FAIL", "TC-03: Provider schema", e.message); }

  // TC-04: POST /complete — missing body returns 400
  try {
    const res = await fetch(`${BASE}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 400) {
      const data = await res.json();
      log("PASS", "TC-04: POST /complete with empty body returns 400", `error="${data.error}"`);
    } else {
      log("FAIL", "TC-04: POST /complete with empty body returns 400", `got ${res.status}`);
    }
  } catch (e) { log("FAIL", "TC-04: Input validation", e.message); }

  // TC-05: POST /suggest — missing body returns 400
  try {
    const res = await fetch(`${BASE}/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 400) {
      const data = await res.json();
      log("PASS", "TC-05: POST /suggest with empty body returns 400", `error="${data.error}"`);
    } else {
      log("FAIL", "TC-05: POST /suggest with empty body returns 400", `got ${res.status}`);
    }
  } catch (e) { log("FAIL", "TC-05: Suggest validation", e.message); }

  // TC-06: POST /chat/stream — missing messages returns 400
  try {
    const res = await fetch(`${BASE}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 400) {
      const data = await res.json();
      log("PASS", "TC-06: POST /chat/stream with empty body returns 400", `error="${data.error}"`);
    } else {
      log("FAIL", "TC-06: POST /chat/stream with empty body returns 400", `got ${res.status}`);
    }
  } catch (e) { log("FAIL", "TC-06: Chat validation", e.message); }

  // TC-07: CORS headers present
  try {
    const res = await fetch(`${BASE}/health`);
    const cors = res.headers.get("access-control-allow-origin");
    if (cors === "*") {
      log("PASS", "TC-07: CORS headers present", `Access-Control-Allow-Origin: ${cors}`);
    } else {
      log("FAIL", "TC-07: CORS headers present", `header=${cors}`);
    }
  } catch (e) { log("FAIL", "TC-07: CORS check", e.message); }

  // TC-08: Unknown route returns 404
  try {
    const res = await fetch(`${BASE}/nonexistent`);
    if (res.status === 404) {
      log("PASS", "TC-08: Unknown route returns 404", `status=${res.status}`);
    } else {
      log("FAIL", "TC-08: Unknown route returns 404", `got ${res.status}`);
    }
  } catch (e) { log("FAIL", "TC-08: 404 handling", e.message); }

  // TC-09: POST /complete with valid body (provider unreachable -> 500 expected)
  try {
    const res = await fetch(`${BASE}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "function hello() {", suffix: "}", language: "javascript", task: "complete" }),
    });
    // With no running provider, we expect 500 (provider error), which proves routing works
    if (res.status === 500 || res.status === 200) {
      const data = await res.json();
      log("PASS", "TC-09: POST /complete routes correctly with valid body", `status=${res.status}`);
    } else {
      log("FAIL", "TC-09: POST /complete routing", `unexpected status ${res.status}`);
    }
  } catch (e) { log("FAIL", "TC-09: Complete routing", e.message); }

  // TC-10: JSON Content-Type in responses
  try {
    const res = await fetch(`${BASE}/health`);
    const ct = res.headers.get("content-type");
    if (ct && ct.includes("application/json")) {
      log("PASS", "TC-10: Responses use application/json Content-Type", `content-type=${ct}`);
    } else {
      log("FAIL", "TC-10: JSON Content-Type", `content-type=${ct}`);
    }
  } catch (e) { log("FAIL", "TC-10: Content-Type check", e.message); }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log(`   RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log("=".repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

run();
