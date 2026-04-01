function timestamp() {
  return new Date().toISOString();
}

export const logger = {
  info:  (msg) => console.log(`[${timestamp()}] INFO  ${msg}`),
  warn:  (msg) => console.warn(`[${timestamp()}] WARN  ${msg}`),
  error: (msg) => console.error(`[${timestamp()}] ERROR ${msg}`),

  /**
   * Log a completed request with latency.
   * @param {string} route - e.g. "/complete"
   * @param {string} provider - e.g. "ollama"
   * @param {number} ms - elapsed milliseconds
   */
  request(route, provider, ms) {
    console.log(`[${timestamp()}] REQ   ${route} | provider=${provider} | ${ms}ms`);
  },
};